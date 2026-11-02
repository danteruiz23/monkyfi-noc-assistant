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


def transcribe(audio_bytes, *, allow_live=False):
    """ElevenLabs speech-to-text integration point."""
    if not os.environ.get("ELEVENLABS_API_KEY") or not allow_live:
        raise NotConfiguredError(
            "Voice calls are disabled in scaffolding. Set ELEVENLABS_API_KEY "
            "and pass allow_live=True to enable them."
        )
    raise NotImplementedError("Wire the ElevenLabs STT call here during the build.")


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

    voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
    if not voice_id:
        voices_url = "https://api.elevenlabs.io/v2/voices?page_size=1"
        voices_req = request.Request(voices_url, headers={"xi-api-key": key})
        try:
            with request.urlopen(voices_req, timeout=15) as response:
                voices = json.load(response).get("voices", [])
        except (error.HTTPError, error.URLError, ValueError, OSError) as exc:
            raise VoiceServiceError("Could not retrieve ElevenLabs voices") from exc
        if not voices or not voices[0].get("voice_id"):
            raise VoiceServiceError("No ElevenLabs voice is available")
        voice_id = voices[0]["voice_id"]

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
