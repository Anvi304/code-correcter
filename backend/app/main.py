import json
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import settings
from app.debugger import DebuggerError, debug
from app.schemas import DebugRequest

app = FastAPI(title="Trivu Debug API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_methods=["POST", "GET"], allow_headers=["Content-Type"])
_request_times: dict[str, deque[float]] = defaultdict(deque)
_max_request_bytes = 45_000
_rate_window_seconds = 60
_rate_limit = 20


@app.get("/health")
async def health():
    return {"status": "ok", "provider_configured": bool(settings.nvidia_api_key)}


@app.post("/api/debug")
async def debug_code(request: Request):
    peer = request.client.host if request.client else "unknown"
    now = time.monotonic()
    recent = _request_times[peer]
    while recent and now - recent[0] >= _rate_window_seconds:
        recent.popleft()
    if len(_request_times) > 1_000:
        for address, timestamps in list(_request_times.items()):
            while timestamps and now - timestamps[0] >= _rate_window_seconds:
                timestamps.popleft()
            if not timestamps:
                _request_times.pop(address, None)
    if len(recent) >= _rate_limit:
        return JSONResponse(status_code=429, content={"detail": "Too many debugging requests. Wait a minute, then retry."})
    recent.append(now)
    if request.headers.get("content-type", "").split(";")[0].lower() != "application/json":
        return JSONResponse(status_code=415, content={"detail": "Send a JSON request."})
    try:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > _max_request_bytes:
            return JSONResponse(status_code=413, content={"detail": "Request body is too large."})
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > _max_request_bytes:
                return JSONResponse(status_code=413, content={"detail": "Request body is too large."})
        payload = json.loads(body)
        debug_request = DebugRequest.model_validate(payload)
    except (ValueError, ValidationError, TypeError):
        return JSONResponse(status_code=422, content={"detail": "Provide code (up to 30,000 characters), language, and bounded optional context."})
    try:
        return await debug(debug_request, settings)
    except DebuggerError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
