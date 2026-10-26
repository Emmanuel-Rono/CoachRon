import logging

from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.schemas.audioSchema import AudioTranscriptMetadataSchema
from app.services.audioloop import audio_loop


router = APIRouter(prefix="/api", tags=["Transcription"])
logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 15 * 1024 * 1024

AUDIO_FORMATS = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/x-m4a": ".m4a",
    "audio/mp4": ".mp4",
}


@router.post("/transcribe", response_model=AudioTranscriptMetadataSchema)
async def transcribe_audio(
    audio: UploadFile = File(...),
) -> AudioTranscriptMetadataSchema:
    try:
        content_type = (audio.content_type or "").split(";")[0].strip().lower()
        input_format = AUDIO_FORMATS.get(content_type)

        if input_format is None:
            raise HTTPException(
                status_code=415,
                detail="Unsupported audio format.",
            )

        content = await audio.read(MAX_AUDIO_BYTES + 1)

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The audio file is empty.",
            )

        if len(content) > MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Audio must not exceed 15 MB.",
            )

        try:
            return await run_in_threadpool(
                audio_loop.work_on_audio,
                audio_file_content=content,
                input_format=input_format,
            )
        except FileNotFoundError as error:
            logger.exception("A transcription dependency is missing.")
            raise HTTPException(
                status_code=503,
                detail="Transcription is not configured correctly.",
            ) from error
        except RuntimeError as error:
            logger.exception("Audio processing failed.")
            raise HTTPException(
                status_code=422,
                detail="The audio could not be transcribed. Try a clear recording.",
            ) from error
    finally:
        await audio.close()