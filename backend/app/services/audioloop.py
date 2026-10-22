import subprocess
import tempfile
from pathlib import Path
from app.schemas.audioSchema import AudioTranscriptMetadataSchema
from app.core.config import settings
import json
import wave

class AudioLoop:
    def  work_on_audio(

            self,
            audio_file_content: bytes,
            input_format: str = ".webm"
                    )-> AudioTranscriptMetadataSchema:

        whisper_executable = Path(settings.whisper_executable)
        transcription_model= Path(settings.whisper_model)
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
                                 uploaded_audio_path= input_path,
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

        

    @staticmethod
    def _validate_dependencies(
        whisper_executable: Path,
        ffmpeg_executable: Path,
        transcription_model: Path,
    ) -> None:
        dependencies = {
            "whisper_executable": whisper_executable,
            "ffmpeg_executable": ffmpeg_executable,
            "transcription_model": transcription_model,
        }

        for name, path in dependencies.items():
            if not path.is_file():
                raise FileNotFoundError(f"{name} not found at {path}")

    @staticmethod
    def _convert_to_wav(
        ffmpeg_executable: Path,
        uploaded_audio_path: Path,
        wav_path: Path,
    ) -> None:
        command = [
            str(ffmpeg_executable),
            "-nostdin",
            "-y",
            "-i", str(uploaded_audio_path),
            "-vn",
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            str(wav_path),
        ]

        try:
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                timeout=60,
            )
        except subprocess.TimeoutExpired as error:
            raise RuntimeError("Audio conversion timed out.") from error
        except subprocess.CalledProcessError as error:
            raise RuntimeError(
                "FFmpeg could not convert the audio."
            ) from error


@staticmethod
def _run_whisper(
    whisper_executable: Path,
    whisper_model: Path,
    wav_path: Path,
    output_base: Path,
) -> None:
    command = [
        str(whisper_executable),
        "-m",
        str(whisper_model),
        "-f",
        str(wav_path),
        "-oj",
        "-l",
        -"en",
    ]

    try:
        result= subprocess.run(
            command,
            check=True,
            capture_output=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("Whisper transcription timed out.") from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError(
            "Whisper could not transcribe the audio."
        ) from error


@staticmethod
def _read_transcript_from_json(json_path: Path) -> str:
    with open(json_path, "r", encoding="utf-8") as f:
        payload = json.load(f)
        segments = payload.get("transcription", [])

        transcript = " ".join(
            segment.get("text", "").strip()
            for segment in segments
        ).strip()
        if not transcript:
            raise RuntimeError("No speech was recognized in the recording.")

        return transcript

    @staticmethod
    def _get_audio_duration(wav_path:Path)-> float:
        with wave.open(str(wav_path), "rb") as audio:
            frame_count = audio.getnframes()
            frame_rate = audio.getframerate()

            return round (frame_count / frame_rate, 3)

@staticmethod
def _count_words(transcript: str) -> int:
    return len(transcript.split())



audio_loop = AudioLoop()