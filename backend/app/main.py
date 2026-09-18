from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.coach import router as coach_router
from app.core.config import settings


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(coach_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

app.include_router(coach_router)
