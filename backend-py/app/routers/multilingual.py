"""
Multilingual API endpoints powered by Bhashini

Includes:
- POST /api/v1/multilingual/translate - Translate text
- POST /api/v1/multilingual/transliterate - Convert script (Roman <-> Devanagari)
- POST /api/v1/multilingual/tts - Text-to-speech
- POST /api/v1/multilingual/asr - Speech-to-text
"""

import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, File, Form, UploadFile, status
from fastapi.responses import Response as HTTPResponse
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from app.services.bhashini import (
    translate_text,
    transliterate_text,
    text_to_speech,
    speech_to_text,
    TranslationResult,
    TransliterationResult,
    TTSResult,
    ASRResult,
)

router = APIRouter(prefix="/api/v1/multilingual", tags=["Multilingual"])
logger = logging.getLogger(__name__)


# Request/Response Models
class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to translate")
    source_lang: str = Field(default="en", description="Source language code (en, hi, etc.)")
    target_lang: str = Field(default="hi", description="Target language code")


class TranslateResponse(BaseModel):
    translated_text: str
    source_language: str
    target_language: str
    confidence: float | None = None


class TransliterateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to transliterate")
    source_lang: str = Field(default="en", description="Source language")
    target_lang: str = Field(default="hi", description="Target language")


class TransliterateResponse(BaseModel):
    transliterated_text: str
    source_script: str
    target_script: str


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to convert to speech")
    language: str = Field(default="hi", description="Language code (hi, en, etc.)")


class ASRResponse(BaseModel):
    transcribed_text: str
    confidence: float | None = None


# Endpoints

@router.post(
    "/translate",
    response_model=TranslateResponse,
    summary="Translate text using Bhashini NMT",
    description="Translate text from one language to another using Government of India's Bhashini platform"
)
async def translate(request: TranslateRequest):
    """
    Translate text between languages
    
    Supported languages: en (English), hi (Hindi)
    
    Example:
        POST /api/v1/multilingual/translate
        {
            "text": "Hello, how are you?",
            "source_lang": "en",
            "target_lang": "hi"
        }
    """
    try:
        result = await translate_text(
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
        return TranslateResponse(
            translated_text=result.translated_text,
            source_language=result.source_language,
            target_language=result.target_language,
            confidence=result.confidence
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Translation service temporarily unavailable. Showing original text."
        )


@router.post(
    "/transliterate",
    response_model=TransliterateResponse,
    summary="Transliterate text between scripts",
    description="Convert text from Roman to Devanagari script or vice versa"
)
async def transliterate(request: TransliterateRequest):
    """
    Transliterate text between different scripts
    
    Useful for search: User types "Pune" (Roman) → convert to "पुणे" (Devanagari)
    
    Example:
        POST /api/v1/multilingual/transliterate
        {
            "text": "Pune",
            "source_lang": "en",
            "target_lang": "hi"
        }
    """
    try:
        result = await transliterate_text(
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
        return TransliterateResponse(
            transliterated_text=result.transliterated_text,
            source_script=result.source_script,
            target_script=result.target_script
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transliteration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transliteration service temporarily unavailable. Showing original text."
        )


@router.post(
    "/tts",
    response_class=HTTPResponse,
    response_description="Audio file (WAV format)",
    summary="Convert text to speech",
    description="Generate audio from text using Bhashini TTS"
)
async def text_to_speech_endpoint(request: TTSRequest):
    """
    Convert text to speech audio
    
    Returns: WAV audio file
    
    Example:
        POST /api/v1/multilingual/tts
        {
            "text": "नमस्कार",
            "language": "hi"
        }
    """
    try:
        result = await text_to_speech(
            text=request.text,
            language=request.language
        )
        return HTTPResponse(
            content=result.audio_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=speech.wav"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Text-to-speech service temporarily unavailable"
        )


@router.post(
    "/asr",
    response_model=ASRResponse,
    summary="Convert speech to text",
    description="Transcribe audio to text using Bhashini ASR"
)
async def speech_to_text_endpoint(
    audio: UploadFile = File(..., description="Audio file (WAV format)"),
    language: str = Form(default="hi", description="Language code (hi, en, etc.)")
):
    """
    Convert speech audio to text
    
    Accepts: WAV, MP3, FLAC format audio files
    
    Example:
        POST /api/v1/multilingual/asr
        Form data:
            audio: <audio file>
            language: hi
    """
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No audio data provided"
            )
        
        result = await speech_to_text(
            audio_bytes=audio_bytes,
            language=language
        )
        return ASRResponse(
            transcribed_text=result.transcribed_text,
            confidence=result.confidence
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ASR error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech-to-text service temporarily unavailable"
        )


@router.get(
    "/ui-text/{lang}",
    summary="Get cached UI text strings for a language",
    description="Returns the full ui_strings_<lang>.json content. Falls back to English if language not found."
)
async def get_ui_text(lang: str):
    """
    Get pre-translated static UI strings for a language
    
    Supported languages: en, hi, bn, gu, kn, ml, mr, or, pa, ta, te
    
    Example:
        GET /api/v1/multilingual/ui-text/hi
    """
    # Normalize language code
    lang = lang.lower().strip()
    
    # Supported languages
    supported_langs = {"en", "hi", "bn", "gu", "kn", "ml", "mr", "or", "pa", "ta", "te"}
    if lang not in supported_langs:
        lang = "en"
    
    static_dir = Path(__file__).parent.parent.parent / "static"
    file_path = static_dir / f"ui_strings_{lang}.json"
    fallback_path = static_dir / "ui_strings_en.json"
    
    try:
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            # Fallback to English
            with open(fallback_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        return JSONResponse(content=data)
    except Exception as e:
        logger.error(f"Failed to load UI text for {lang}: {e}")
        # Final fallback - return empty object, never error
        return JSONResponse(content={})


@router.get(
    "/health",
    summary="Check if Bhashini integration is available",
    tags=["Health"]
)
async def check_bhashini_health():
    """
    Check if Bhashini API credentials are configured
    
    Returns:
        - configured: true/false
        - message: status message
    """
    from app.config import get_settings
    settings = get_settings()
    configured = bool(settings.ulca_user_id and settings.ulca_api_key)
    
    return {
        "configured": configured,
        "message": "Bhashini multilingual API is configured" if configured else "Bhashini API credentials not configured"
    }
