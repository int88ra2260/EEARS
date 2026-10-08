# Resident faster-whisper transcriber. The English model stays in memory.
# Each job transcribes one audio file and returns text. It does not see the
# target sentence, so the transcript is not pulled toward the correct words.

from __future__ import annotations

import os

# conda MKL (libiomp5md) and ctranslate2 (libomp) both ship an OpenMP runtime.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import json
import os
import socket
import subprocess
import sys
import traceback


def decode_audio(audio_path: str):
    import numpy as np

    ffmpeg = os.environ.get("SPEAKING_FFMPEG_COMMAND") or "ffmpeg"
    proc = subprocess.run(
        [
            ffmpeg,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            audio_path,
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "f32le",
            "-",
        ],
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout:
        detail = proc.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(detail[:500] or "ffmpeg could not decode the recording.")
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


class ResidentTranscriber:
    def __init__(self, model_name: str):
        from faster_whisper import WhisperModel

        self.model_name = model_name
        self.model = WhisperModel(model_name, device="cpu", compute_type="int8")

    def transcribe(self, audio_path: str) -> str:
        # Decode with ffmpeg. faster-whisper 1.2.1 passes metadata_errors to
        # av.open, and PyAV 19 no longer accepts that argument.
        beam_size = int(os.environ.get("SPEAKING_WHISPER_BEAM", "5"))
        segments, _info = self.model.transcribe(
            decode_audio(audio_path),
            language="en",
            beam_size=max(1, beam_size),
            vad_filter=True,
            condition_on_previous_text=False,
            without_timestamps=True,
        )
        parts = [segment.text.strip() for segment in segments if segment.text and segment.text.strip()]
        return " ".join(parts).strip()


def serve(transcriber: ResidentTranscriber, port: int) -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", port))
    server.listen(8)
    log(f"ready {port}")
    while True:
        conn, _addr = server.accept()
        try:
            raw = b""
            while b"\n" not in raw:
                chunk = conn.recv(65536)
                if not chunk:
                    break
                raw += chunk
                if len(raw) > 1_000_000:
                    break
            line = raw.decode("utf-8", errors="replace").split("\n", 1)[0].strip()
            job = json.loads(line) if line else {}
            audio_path = job.get("audioPath")
            if not audio_path:
                payload = {"ok": True, "ready": True}
            else:
                text = transcriber.transcribe(str(audio_path))
                payload = {"ok": True, "text": text, "model": transcriber.model_name}
            conn.sendall((json.dumps(payload) + "\n").encode("utf-8"))
        except Exception as error:
            message = "".join(traceback.format_exception_only(type(error), error)).strip()
            log(traceback.format_exc())
            try:
                conn.sendall((json.dumps({"ok": False, "error": message[:2000]}) + "\n").encode("utf-8"))
            except Exception:
                pass
        finally:
            try:
                conn.close()
            except Exception:
                pass


def main() -> None:
    model_name = os.environ.get("SPEAKING_WHISPER_MODEL") or "small.en"
    port = int(os.environ.get("SPEAKING_WHISPER_WORKER_PORT", "18766"))
    log(f"loading {model_name}")
    transcriber = ResidentTranscriber(model_name)
    log("model loaded")
    serve(transcriber, port)


if __name__ == "__main__":
    main()
