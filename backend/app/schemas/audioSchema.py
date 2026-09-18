
#Schena to be used when passing the audio file to backend for processing.
from pydantic import BaseModel, Field


class WordTimeStampMetadataSchema(BaseModel):
    word: str
    start_time: float
    end_time: float


class AudioTranscriptMetadataSchema(BaseModel):
    transcript : str
    duration_seconds: float = Field(ge=0)
    word_count: int
    words : list[WordTimeStampMetadataSchema] = []