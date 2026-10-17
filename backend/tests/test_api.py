import asyncio

import httpx

from app.main import app

def api_client():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


def test_health_discloses_configuration_without_claiming_live_inference():
    async def run():
        async with api_client() as client:
            response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert isinstance(response.json()["provider_configured"], bool)
    asyncio.run(run())


def test_invalid_debug_requests_are_rejected_before_provider_call():
    async def run():
        async with api_client() as client:
            response = await client.post("/api/debug", json={"code": "", "language": "python"})
        assert response.status_code == 422
    asyncio.run(run())


def test_request_body_limit_applies_to_large_payloads():
    async def run():
        async with api_client() as client:
            response = await client.post("/api/debug", content=b" " * 45_001, headers={"Content-Type": "application/json"})
        assert response.status_code == 413
    asyncio.run(run())
