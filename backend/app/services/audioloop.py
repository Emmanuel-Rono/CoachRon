

from zipfile import Path

from backend.app.schemas.audioSchema import AudioTranscriptMetadataSchema
from backend.app.core.config import settings


class AudioLoop:
    def  work_on_audio(

            self,
            audio_file_content: bytes,
            input_format: str = ".webm"
                    )-> AudioTranscriptMetadataSchema:

        whisper_executable = Path(settings.whisper_executable)
        transcription_model= settings.whisper_model
        ffmpeg_executable = Path(settings.ffmpeg_executable)

        self._validate_dependencies(whisper_executable, 
                                    ffmpeg_executable,
                                    transcription_model,
                                    ffmpeg_executable,
                                    
                                    )

       
        
        



