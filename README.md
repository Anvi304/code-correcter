# Trivu

Trivu is an AI-assisted code debugging workspace. It sends submitted code and optional error context to NVIDIA's hosted inference API, presents a proposed correction and explanation, and reports static validation separately from model output. It does not execute submitted code.

## Architecture

- `frontend/`: Next.js App Router UI (TypeScript). The code input is a native, accessible monospace editor; no editor package is added until its value is justified.
- `backend/`: FastAPI request validation, bounded prompt construction, NVIDIA adapter, response validation, and safe Python syntax checking.
- No database: debugging sessions are transient and the product has no account/history requirement.

Browser → Next.js → Python API → NVIDIA NIM `POST https://integrate.api.nvidia.com/v1/chat/completions` → validated result → UI.

## Requirements

- Node.js 20.9+ and npm
- Python 3.11+
- NVIDIA API key from [build.nvidia.com](https://build.nvidia.com/)

## Setup

Backend (PowerShell):

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Set NVIDIA_API_KEY in backend/.env
uvicorn app.main:app --reload --port 8000
```

Frontend (second terminal):

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The API docs are at http://localhost:8000/docs.

## Configuration

Backend `backend/.env`:

| Variable | Default | Purpose |
|---|---|---|
| `NVIDIA_API_KEY` | required | Server-side bearer credential; never sent to the browser |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | NVIDIA NIM OpenAI-compatible API base |
| `NVIDIA_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` | Configurable hosted model identifier |
| `NVIDIA_TIMEOUT_SECONDS` | `90` | Upstream request timeout |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed browser origin |

Debug requests accept `code`, `language`, `error_message`, `expected_behavior`, and bounded `context`. The response sets `fix_status` to either `fix_proposed` or `needs_context`; follow-up questions and remaining issues are explicit fields, and model output cannot set the validation result.

Frontend `frontend/.env.local`:

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Python API origin |

## Validation and privacy

The API validates request and response shapes, caps request bodies at 45 KB, source code at 30,000 characters, and context fields at 4,000 characters. It also applies a small in-memory per-IP request limit (20/minute per backend process; production deployments should enforce shared rate limits at their gateway). For Python, the proposed result is parsed with Python's AST without execution. Other languages are explicitly reported as not statically checked. Runtime and test execution are unavailable: arbitrary submitted code is never run on the backend. NVIDIA receives submitted source code, error text, and expected behavior for inference; avoid pasting secrets or sensitive code. The app does not persist requests and application code does not log source content.

NVIDIA's current NIM API reference documents `https://integrate.api.nvidia.com/v1/chat/completions`, bearer authentication, JSON and SSE modes, and 401/402/422/429 failure responses. This implementation uses non-streaming JSON for strict response parsing. The selected `nvidia/nemotron-3.5-lightning-30b-a3b` endpoint documents up to 1M context, a 32,768-token generation ceiling, recommended temperature 1.0 and top-p 0.95, plus a reasoning budget; this service caps completion at 16,384 tokens and reasoning at 8,192 to leave room for the returned correction. NVIDIA lists an available free prototype endpoint, subject to NVIDIA API Trial Terms and the model's OpenMDW License Agreement v1.1. Free availability does not mean unlimited use; quotas, credits, and service availability can vary by account. Review NVIDIA's [model-specific API reference](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-lightning-30b-a3b-infer), [model card](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b/modelcard), and [NIM API reference](https://docs.api.nvidia.com/nim/reference/llm-apis). NVIDIA's handling and retention of submitted prompts follow its applicable service terms; avoid sending sensitive code.

## Tests and builds

```powershell
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

```powershell
cd frontend
npm run lint
npm run build
```

Backend tests use mocked HTTP and never need a live API key. A live smoke test requires an NVIDIA API key and should only be run with valid account access. Runtime validation remains unavailable until a dedicated isolated sandbox is deployed.

## Known limitations

- No authentication, persistent history, multi-file analysis, or runtime execution.
- Static checking currently covers Python syntax only.
- Very large full-file repairs may exceed the configured 16,384-token completion budget. Truncated completions are rejected instead of shown as successful fixes.
- The model is asked for JSON and its answer is validated locally; provider-specific structured-output guarantees are not assumed.
- A successful AI response is a proposal, not proof that the fix works.
