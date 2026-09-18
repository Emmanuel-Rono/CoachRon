# CoachRon

CoachRon is a local-first AI coach for improving conversational English, grammar, pace, and speaking flow. It provides focused feedback without sending the core coaching workflow to a cloud AI service.

## Technology

- React and TypeScript for the web interface
- FastAPI for the backend API
- LangChain for the coaching workflow
- Ollama with Qwen3 for local language-model inference
- whisper.cpp for local speech transcription
- Silero VAD for automatic turn detection
- SQLite for sessions, transcripts, feedback, and progress

## Current Status

The text coaching flow is working end to end:

```text
React -> FastAPI -> LangChain -> Ollama -> structured feedback
```

Audio upload and local transcription are currently being developed.

## Requirements

- Python 3.11 or later
- Node.js 20 or later
- Ollama
- Qwen3 1.7B
- whisper.cpp for the voice transcription milestone

Install the Ollama model:

```powershell
ollama pull qwen3:1.7b
```

## Backend Setup

From the project directory:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The backend runs at `http://127.0.0.1:8000`.

- API documentation: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

## Frontend Setup

Open another terminal from the project directory:

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check whether the backend is running. |
| `POST` | `/api/coach` | Generate structured coaching feedback. |
| `POST` | `/api/transcribe` | Upload an audio turn for transcription. |

## Privacy

CoachRon is designed for local processing. Audio should remain temporary unless the user explicitly chooses to save it.

