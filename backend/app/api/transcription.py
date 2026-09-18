

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.app.schemas.audioSchema import AudioTranscriptMetadataSchema


router = APIRouter(prefix = "/api", tags = ["Transcription"])
ALLOWED_AUDIO_TYPES =
{
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/x-m4a",
    "audio/mp4",
}
@router.post("/transcribe", response_model = AudioTranscriptMetadataSchema)
async def transcribe_audio(
    audio: UploadFile = File(...),
)-> AudioTranscriptMetadataSchema:

    if audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type: {audio.content_type}. Allowed types are: {', '.join(ALLOWED_AUDIO_TYPES)}",
        )
    content = await audio.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Empty audio file provided.",
        )

    if len(content) > 15 * 1024 * 1024:  # 15 MB limit
        raise HTTPException(
            status_code=413,
            detail="Audio file is too large. Maximum allowed size is 15 MB.",
        )

    #Temporary placeholder for transcription logic. In a real implementation, you would call your transcription service here.
    return AudioTranscriptMetadataSchema(
        transcript="",
        duration_seconds=0.0,
        word_count=0,
        words=[],
    )