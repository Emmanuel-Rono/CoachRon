

import tempfile
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
                                    )
        with tempfile.TemporaryDirectory(prefix="coachron-") as temp_directory:
            temp_path = Path(temp_directory)
            input_path = temp_path / f"recording{input_format}"
            wav_path = temp_path / "recording.wav"
            output_base = temp_path / "transcript"
            input_path.write_bytes(audio_file_content)


            self._convert_to_wav(ffmpeg_executable = ffmpeg_executable,
                                 input_path= input_path,
                                 wav_path= wav_path
                                 )
            self._run_whisper(whisper_executable=whisper_executable,
                               whisper_model=transcription_model,
                               wav_path=wav_path,
                               output_base=output_base
                               )
            output_json_path = output_base.with_suffix(".json")

            if not output_json_path.exists():
                raise RuntimeError(f"Whisper output JSON file not found at {output_json_path}")

            transcript = self._read_transcript_from_json(output_json_path)
            duration_seconds = self._get_audio_duration(wav_path)
            word_count = self._count_words(transcript)

            return AudioTranscriptMetadataSchema(
                transcript=transcript,
                duration_seconds=duration_seconds,
                word_count=word_count,
                words = [],
            )

        

        
        
        

       
        
        



