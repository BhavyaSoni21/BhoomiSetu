"""
Bhashini Multilingual API Integration Service

Government of India's Bhashini platform for:
- Translation (NMT) - English <-> Hindi
- Transliteration - Roman <-> Devanagari script
- Text-to-Speech (TTS) - Convert text to audio
- Speech-to-Text (ASR) - Convert audio to text

Two-step flow:
1. Config call: Get serviceId and inference API key for language pair
2. Inference call: Use serviceId to perform actual operation

Always cache config results to avoid redundant API calls.
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import httpx
from fastapi import HTTPException, status

from app.config import get_settings

logger = logging.getLogger(__name__)

# Cache for config results: key = (task_type, source_lang, target_lang)
_config_cache: dict[tuple, dict] = {}
_cache_timestamps: dict[tuple, float] = {}


@dataclass
class TranslationResult:
    """Result from translation operation"""
    translated_text: str
    source_language: str
    target_language: str
    confidence: Optional[float] = None


@dataclass
class TransliterationResult:
    """Result from transliteration operation"""
    transliterated_text: str
    source_script: str
    target_script: str


@dataclass
class TTSResult:
    """Result from text-to-speech operation"""
    audio_bytes: bytes
    audio_format: str = "wav"


@dataclass
class ASRResult:
    """Result from speech-to-text operation"""
    transcribed_text: str
    confidence: Optional[float] = None


def _is_bhashini_configured() -> bool:
    """Check if Bhashini is properly configured"""
    settings = get_settings()
    return bool(settings.ulca_user_id and settings.ulca_api_key)


def _validate_language_code(lang_code: str, supported: list[str]) -> bool:
    """Validate that language code is in supported list"""
    return lang_code.lower() in supported


def _should_use_cache(cache_key: tuple) -> bool:
    """Check if cached config is still valid"""
    if cache_key not in _cache_timestamps:
        return False
    settings = get_settings()
    age = time.time() - _cache_timestamps[cache_key]
    return age < settings.bhashini_cache_ttl


async def _get_config(task_type: str, source_lang: str, target_lang: str) -> dict:
    """
    Step 1: Get config (serviceId + inference API key) from Bhashini
    
    Args:
        task_type: 'translation', 'transliteration', 'tts', 'asr'
        source_lang: ISO 639-1 language code (e.g., 'en', 'hi')
        target_lang: ISO 639-1 language code (for translation/transliteration)
    
    Returns:
        Config dict with serviceId, apiKey, and other metadata
    
    Raises:
        HTTPException with 503 if Bhashini is not configured or API fails
    """
    settings = get_settings()
    
    if not _is_bhashini_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bhashini is not configured (ULCA_USER_ID or ULCA_API_KEY is missing)"
        )
    
    cache_key = (task_type, source_lang.lower(), target_lang.lower())
    
    # Check cache
    if cache_key in _config_cache and _should_use_cache(cache_key):
        logger.debug(f"Using cached config for {task_type} {source_lang}->{target_lang}")
        return _config_cache[cache_key]
    
    # Prepare payload - different structure per task type
    if task_type in ("translation", "transliteration"):
        payload = {
            "pipelineTasks": [
                {
                    "taskType": task_type,
                    "config": {
                        "language": {
                            "sourceLanguage": source_lang.lower(),
                            "targetLanguage": target_lang.lower()
                        }
                    }
                }
            ],
            "pipelineRequestConfig": {
                "pipelineId": settings.bhashini_pipeline_id
            }
        }
    elif task_type == "tts":
        payload = {
            "pipelineTasks": [
                {
                    "taskType": task_type,
                    "config": {
                        "language": {"sourceLanguage": source_lang.lower()},
                        "gender": "female"
                    }
                }
            ],
            "pipelineRequestConfig": {
                "pipelineId": settings.bhashini_pipeline_id
            }
        }
    elif task_type == "asr":
        payload = {
            "pipelineTasks": [
                {
                    "taskType": task_type,
                    "config": {
                        "language": {"sourceLanguage": source_lang.lower()}
                    }
                }
            ],
            "pipelineRequestConfig": {
                "pipelineId": settings.bhashini_pipeline_id
            }
        }
    else:
        raise ValueError(f"Unknown task type: {task_type}")
    
    headers = {
        "userID": settings.ulca_user_id,
        "ulcaApiKey": settings.ulca_api_key,
        "Content-Type": "application/json"
    }
    
    # Retry logic for transient failures
    for attempt in range(settings.bhashini_max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    settings.bhashini_auth_url,
                    json=payload,
                    headers=headers
                )
            
            if response.status_code == 200:
                data = response.json()
                # Cache the result
                _config_cache[cache_key] = data
                _cache_timestamps[cache_key] = time.time()
                logger.info(f"Got config for {task_type} {source_lang}->{target_lang}")
                return data
            else:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", {}).get("message", error_detail)
                except:
                    pass
                logger.error(f"Bhashini config failed: HTTP {response.status_code}: {error_detail}")
                
                if response.status_code >= 500:
                    # Server error - retry
                    if attempt < settings.bhashini_max_retries:
                        wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                        await asyncio.sleep(wait_ms / 1000)
                        continue
                
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Bhashini config API failed: {error_detail}"
                )
        
        except httpx.HTTPError as e:
            logger.error(f"Bhashini config network error (attempt {attempt + 1}): {e}")
            if attempt < settings.bhashini_max_retries:
                wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                await asyncio.sleep(wait_ms / 1000)
                continue
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Bhashini config API unreachable: {str(e)}"
            )
    
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Bhashini config API failed after retries"
    )

def _find_matching_service(config: dict, source_lang: str, target_lang: Optional[str] = None) -> dict:
    for task_cfg in config.get("pipelineResponseConfig", []):
        for svc in task_cfg.get("config", []):
            lang = svc.get("language", {})
            if lang.get("sourceLanguage") == source_lang and (
                target_lang is None or lang.get("targetLanguage") == target_lang
            ):
                return svc
    raise ValueError(f"No matching service found for {source_lang} -> {target_lang}")

async def translate_text(
    text: str,
    source_lang: str = "en",
    target_lang: str = "hi"
) -> TranslationResult:
    """
    Translate text from source to target language using Bhashini NMT
    """
    if not text or not text.strip():
        return TranslationResult(
            translated_text="",
            source_language=source_lang,
            target_language=target_lang
        )
    
    settings = get_settings()
    config = await _get_config("translation", source_lang, target_lang)
    
    try:
        svc = _find_matching_service(config, source_lang, target_lang)
        service_id = svc["serviceId"]
        api_key = config["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]
    except (KeyError, IndexError, ValueError) as e:
        logger.error(f"Failed to parse config response: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invalid Bhashini config response structure"
        )
    
    inference_payload = {
        "pipelineTasks": [
            {
                "taskType": "translation",
                "config": {
                    "language": {"sourceLanguage": source_lang, "targetLanguage": target_lang},
                    "serviceId": service_id
                }
            }
        ],
        "inputData": {
            "input": [{"source": text}]
        }
    }
    headers = {
        "Content-Type": "application/json",
        api_key["name"]: api_key["value"]
    }
    
    for attempt in range(settings.bhashini_max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.bhashini_translation_timeout) as client:
                response = await client.post(
                    settings.bhashini_inference_url,
                    json=inference_payload,
                    headers=headers
                )
            
            if response.status_code == 200:
                data = response.json()
                output_text = data.get("pipelineResponse", [{}])[0].get("output", [{}])[0].get("target", text)
                logger.info(f"Translated: {len(text)} chars from {source_lang} to {target_lang}")
                return TranslationResult(
                    translated_text=output_text,
                    source_language=source_lang,
                    target_language=target_lang
                )
            else:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", {}).get("message", error_detail)
                except:
                    pass
                logger.error(f"Bhashini inference failed: HTTP {response.status_code}: {error_detail}")
                
                if response.status_code >= 500 and attempt < settings.bhashini_max_retries:
                    wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                    await asyncio.sleep(wait_ms / 1000)
                    continue
                
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Bhashini translation API failed"
                )
        
        except httpx.HTTPError as e:
            logger.error(f"Bhashini inference network error (attempt {attempt + 1}): {e}")
            if attempt < settings.bhashini_max_retries:
                wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                await asyncio.sleep(wait_ms / 1000)
                continue
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Bhashini translation API unreachable"
            )
    
    return TranslationResult(
        translated_text=text,  # Fallback to original
        source_language=source_lang,
        target_language=target_lang
    )

async def transliterate_text(
    text: str,
    source_lang: str = "en",
    target_lang: str = "hi"
) -> TransliterationResult:
    """
    Transliterate text from Roman to Devanagari script (or vice versa)
    """
    if not text or not text.strip():
        return TransliterationResult(
            transliterated_text="",
            source_script="roman" if source_lang == "en" else "devanagari",
            target_script="devanagari" if target_lang == "hi" else "roman"
        )
    
    settings = get_settings()
    config = await _get_config("transliteration", source_lang, target_lang)
    
    try:
        svc = _find_matching_service(config, source_lang, target_lang)
        service_id = svc["serviceId"]
        api_key = config["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]
    except (KeyError, IndexError, ValueError) as e:
        logger.error(f"Failed to parse config response: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invalid Bhashini config response structure"
        )
    
    inference_payload = {
        "pipelineTasks": [
            {
                "taskType": "transliteration",
                "config": {
                    "language": {"sourceLanguage": source_lang, "targetLanguage": target_lang},
                    "serviceId": service_id
                }
            }
        ],
        "inputData": {
            "input": [{"source": text}]
        }
    }
    headers = {
        "Content-Type": "application/json",
        api_key["name"]: api_key["value"]
    }
    
    for attempt in range(settings.bhashini_max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.bhashini_transliteration_timeout) as client:
                response = await client.post(
                    settings.bhashini_inference_url,
                    json=inference_payload,
                    headers=headers
                )
            
            if response.status_code == 200:
                data = response.json()
                output_text = data.get("pipelineResponse", [{}])[0].get("output", [{}])[0].get("target", text)
                logger.info(f"Transliterated: {len(text)} chars")
                return TransliterationResult(
                    transliterated_text=output_text,
                    source_script="roman" if source_lang == "en" else "devanagari",
                    target_script="devanagari" if target_lang == "hi" else "roman"
                )
            else:
                if response.status_code >= 500 and attempt < settings.bhashini_max_retries:
                    wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                    await asyncio.sleep(wait_ms / 1000)
                    continue
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Bhashini transliteration API failed"
                )
        except httpx.HTTPError as e:
            if attempt < settings.bhashini_max_retries:
                wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                await asyncio.sleep(wait_ms / 1000)
                continue
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Bhashini transliteration API unreachable"
            )
    
    return TransliterationResult(
        transliterated_text=text,
        source_script="roman" if source_lang == "en" else "devanagari",
        target_script="devanagari" if target_lang == "hi" else "roman"
    )

async def text_to_speech(
    text: str,
    language: str = "hi"
) -> TTSResult:
    """
    Convert text to speech audio using Bhashini TTS
    """
    if not text or not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text cannot be empty"
        )
    
    settings = get_settings()
    gender = "female"

    # Step 1: Discovery call with the correct payload shape for TTS
    config = await _get_config("tts", language, language)

    try:
        svc = _find_matching_service(config, language)
        service_id = svc["serviceId"]
        api_key = config["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]
    except (KeyError, IndexError, ValueError) as e:
        logger.error(f"Failed to parse TTS config response: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invalid Bhashini config response structure"
        )

    # Step 2: Inference payload — exact confirmed-working shape
    inference_payload = {
        "pipelineTasks": [
            {
                "taskType": "tts",
                "config": {
                    "language": {"sourceLanguage": language},
                    "serviceId": service_id,
                    "gender": gender,
                    "samplingRate": 8000
                }
            }
        ],
        "inputData": {
            "input": [{"source": text}]
        }
    }
    headers = {
        "Content-Type": "application/json",
        api_key["name"]: api_key["value"]
    }

    for attempt in range(settings.bhashini_max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.bhashini_tts_timeout) as client:
                response = await client.post(
                    settings.bhashini_inference_url,
                    json=inference_payload,
                    headers=headers
                )

            # Check HTTP status FIRST — log the raw error body if not 200
            if response.status_code != 200:
                error_body = response.text
                logger.error(f"Bhashini TTS API error HTTP {response.status_code}: {error_body}")
                if response.status_code >= 500 and attempt < settings.bhashini_max_retries:
                    wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                    await asyncio.sleep(wait_ms / 1000)
                    continue
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Bhashini TTS API failed ({response.status_code}): {error_body}"
                )

            # Parse the confirmed-correct response path
            import base64
            data = response.json()
            audio_content = data["pipelineResponse"][0]["audio"][0]["audioContent"]
            audio_bytes = base64.b64decode(audio_content)

            logger.info(f"Generated TTS audio: {len(audio_bytes)} bytes for {language}")
            return TTSResult(audio_bytes=audio_bytes, audio_format="wav")

        except httpx.HTTPError as e:
            logger.error(f"Bhashini TTS network error (attempt {attempt + 1}): {e}")
            if attempt < settings.bhashini_max_retries:
                wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                await asyncio.sleep(wait_ms / 1000)
                continue
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Bhashini TTS API unreachable"
            )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Bhashini TTS failed after retries"
    )

async def speech_to_text(
    audio_bytes: bytes,
    language: str = "hi"
) -> ASRResult:
    """
    Convert speech audio to text using Bhashini ASR
    """
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio data cannot be empty"
        )
    
    settings = get_settings()
    config = await _get_config("asr", language, language)
    
    try:
        svc = _find_matching_service(config, language)
        service_id = svc["serviceId"]
        api_key = config["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]
    except (KeyError, IndexError, ValueError) as e:
        logger.error(f"Failed to parse config response: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invalid Bhashini config response structure"
        )
    
    import base64
    audio_b64 = base64.b64encode(audio_bytes).decode()
    
    inference_payload = {
        "pipelineTasks": [
            {
                "taskType": "asr",
                "config": {
                    "language": {"sourceLanguage": language, "targetLanguage": language},
                    "serviceId": service_id
                }
            }
        ],
        "inputData": {
            "audio": [{"audioContent": audio_b64}]
        }
    }
    headers = {
        "Content-Type": "application/json",
        api_key["name"]: api_key["value"]
    }
    
    for attempt in range(settings.bhashini_max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.bhashini_asr_timeout) as client:
                response = await client.post(
                    settings.bhashini_inference_url,
                    json=inference_payload,
                    headers=headers
                )
            
            if response.status_code == 200:
                data = response.json()
                transcript = data.get("pipelineResponse", [{}])[0].get("output", [{}])[0].get("target", "")
                logger.info(f"Transcribed audio: {len(transcript)} chars for {language}")
                return ASRResult(transcribed_text=transcript)
            else:
                if response.status_code >= 500 and attempt < settings.bhashini_max_retries:
                    wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                    await asyncio.sleep(wait_ms / 1000)
                    continue
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Bhashini ASR API failed"
                )
        except httpx.HTTPError as e:
            if attempt < settings.bhashini_max_retries:
                wait_ms = settings.bhashini_retry_backoff_ms * (2 ** attempt)
                await asyncio.sleep(wait_ms / 1000)
                continue
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Bhashini ASR API unreachable"
            )
    
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Bhashini ASR failed after retries"
    )

def clear_config_cache() -> int:
    """Clear the config cache (useful for testing or manual reset)"""
    count = len(_config_cache)
    _config_cache.clear()
    _cache_timestamps.clear()
    logger.info(f"Cleared {count} cached configs")
    return count
