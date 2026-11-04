"""LLM / voice client stubs — credentials ONLY from environment variables.

Scaffolding rule: this module never makes a live paid call on its own.
- `complete()` raises unless ANTHROPIC_API_KEY is set AND the caller
  explicitly opts in. The hackathon demo runs on the deterministic modules.
- `transcribe()` / `speak()` describe the ElevenLabs integration point and
  raise unless ELEVENLABS_API_KEY is set AND the caller opts in.

Real credentials must NEVER be written into files. Copy .env.example to .env
(local only, gitignored) if you ever configure keys.
"""

import os
import json
import uuid
from urllib import error, parse, request


class NotConfiguredError(RuntimeError):
    pass


class VoiceServiceError(RuntimeError):
    pass


def complete(prompt, *, allow_live=False):
    """Send a prompt to Claude. Requires ANTHROPIC_API_KEY + allow_live=True."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or not allow_live:
        raise NotConfiguredError(
            "LLM calls are disabled in scaffolding. Set ANTHROPIC_API_KEY and "
            "pass allow_live=True to enable them."
        )
    # Integration point: call the Anthropic API here with `prompt`.
    # Kept unimplemented in scaffolding so no paid call can happen by accident.
    raise NotImplementedError("Wire the Anthropic API call here during the build.")


def _audio_filename(content_type):
    ctype = (content_type or "").split(";", 1)[0].strip().lower()
    return {
        "audio/webm": "question.webm",
        "audio/wav": "question.wav",
        "audio/x-wav": "question.wav",
        "audio/wave": "question.wav",
        "audio/mpeg": "question.mp3",
        "audio/mp3": "question.mp3",
        "audio/mp4": "question.mp4",
        "audio/m4a": "question.m4a",
        "audio/x-m4a": "question.m4a",
        "audio/ogg": "question.ogg",
        "audio/flac": "question.flac",
        "audio/aiff": "question.aiff",
        "audio/x-aiff": "question.aiff",
    }.get(ctype, "question.webm")


def _multipart_body(fields, file_field, filename, content_type, audio_bytes):
    boundary = "noc" + uuid.uuid4().hex
    chunks = []
    for name, value in fields:
        chunks.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n".encode()
        )
    chunks.append(
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'
        f"Content-Type: {content_type or 'application/octet-stream'}\r\n\r\n".encode()
    )
    chunks.append(audio_bytes)
    chunks.append(f"\r\n--{boundary}--\r\n".encode())
    return boundary, b"".join(chunks)


def transcribe(audio_bytes, *, allow_live=False, content_type="audio/webm"):
    """Transcribe recorded audio with ElevenLabs. Returns the transcript text."""
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key or not allow_live:
        raise NotConfiguredError("ElevenLabs no está configurado")
    if not isinstance(audio_bytes, (bytes, bytearray)) or len(audio_bytes) == 0:
        raise ValueError("empty audio")
    audio_bytes = bytes(audio_bytes)
    filename = _audio_filename(content_type)
    part_type = (content_type or "audio/webm").split(";", 1)[0].strip() or "application/octet-stream"
    url = "https://api.elevenlabs.io/v1/speech-to-text"

    def call(model_id):
        boundary, body = _multipart_body(
            [("model_id", model_id)], "file", filename, part_type, audio_bytes)
        req = request.Request(
            url, data=body, method="POST",
            headers={
                "xi-api-key": key,
                "Accept": "application/json",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            })
        with request.urlopen(req, timeout=60) as response:
            return json.load(response)

    try:
        payload = call("scribe_v2")
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace").lower()
        if exc.code in (400, 422) and "model" in details:
            try:
                payload = call("scribe_v1")
            except (error.HTTPError, error.URLError, ValueError, OSError) as retry_exc:
                raise VoiceServiceError("ElevenLabs transcription failed") from retry_exc
        else:
            raise VoiceServiceError("ElevenLabs transcription failed") from exc
    except (error.URLError, ValueError, OSError) as exc:
        raise VoiceServiceError("ElevenLabs transcription failed") from exc

    text = payload.get("text") if isinstance(payload, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise VoiceServiceError("ElevenLabs transcription failed")
    return text.strip()


# Premade ElevenLabs voice (Rachel). Used when the key can synthesize speech
# but is not allowed to list voices.
PREMADE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


def _voice_id(key):
    """Resolve the voice to speak with, without requiring voices_read."""
    configured = (os.environ.get("ELEVENLABS_VOICE_ID") or "").strip()
    if configured:
        return configured
    voices_url = "https://api.elevenlabs.io/v2/voices?page_size=1"
    voices_req = request.Request(voices_url, headers={"xi-api-key": key})
    try:
        with request.urlopen(voices_req, timeout=15) as response:
            voices = json.load(response).get("voices", [])
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace").lower()
        if exc.code in (401, 403) and (
            "voices_read" in details or "missing_permissions" in details
        ):
            return PREMADE_VOICE_ID
        raise VoiceServiceError("Could not retrieve ElevenLabs voices") from exc
    except (error.URLError, ValueError, OSError) as exc:
        raise VoiceServiceError("Could not retrieve ElevenLabs voices") from exc
    if not voices or not voices[0].get("voice_id"):
        return PREMADE_VOICE_ID
    return voices[0]["voice_id"]


def speak(text, *, allow_live=False):
    """ElevenLabs text-to-speech integration point. Returns audio bytes."""
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key or not allow_live:
        raise NotConfiguredError(
            "Voice calls are disabled in scaffolding. Set ELEVENLABS_API_KEY "
            "and pass allow_live=True to enable them."
        )
    if not isinstance(text, str) or not text.strip():
        raise ValueError("text must be a non-empty string")

    voice_id = _voice_id(key)

    url = ("https://api.elevenlabs.io/v1/text-to-speech/"
           + parse.quote(voice_id, safe="") + "?output_format=mp3_44100_128")
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                           "style": 0, "use_speaker_boost": True},
    }

    def convert(body):
        req = request.Request(
            url, data=json.dumps(body).encode("utf-8"), method="POST",
            headers={"xi-api-key": key, "Content-Type": "application/json",
                     "Accept": "audio/mpeg"})
        with request.urlopen(req, timeout=45) as response:
            return response.read()

    try:
        return convert(payload)
    except error.HTTPError as exc:
        # Retry only when ElevenLabs explicitly rejects the requested model.
        details = exc.read().decode("utf-8", errors="replace").lower()
        if exc.code in (400, 422) and "model" in details:
            payload.pop("model_id")
            try:
                return convert(payload)
            except (error.HTTPError, error.URLError, OSError) as retry_exc:
                raise VoiceServiceError("ElevenLabs speech generation failed") from retry_exc
        raise VoiceServiceError("ElevenLabs speech generation failed") from exc
    except (error.URLError, OSError) as exc:
        raise VoiceServiceError("ElevenLabs speech generation failed") from exc
