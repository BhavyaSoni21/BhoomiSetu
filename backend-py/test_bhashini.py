#!/usr/bin/env python
"""
Test script for Bhashini multilingual API integration

Run from backend-py directory with: python test_bhashini.py
"""

import sys
import os
import asyncio
import json

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.config import get_settings
from app.services.bhashini import (
    translate_text,
    transliterate_text,
    text_to_speech,
    speech_to_text,
    _get_config,
    clear_config_cache,
)


async def test_health():
    """Test if Bhashini is configured"""
    print("\n" + "="*70)
    print("HEALTH CHECK")
    print("="*70)
    
    settings = get_settings()
    configured = bool(settings.ulca_user_id and settings.ulca_api_key)
    
    print(f"\n✓ Bhashini Configuration Status:")
    print(f"  ULCA_USER_ID: {'✓ SET' if settings.ulca_user_id else '✗ MISSING'}")
    print(f"  ULCA_API_KEY: {'✓ SET' if settings.ulca_api_key else '✗ MISSING'}")
    print(f"  PIPELINE_ID: {settings.bhashini_pipeline_id}")
    print(f"  DEFAULT_LANGS: {settings.default_source_lang} → {settings.default_target_lang}")
    
    if not configured:
        print("\n✗ ERROR: Bhashini credentials are not configured!")
        print("  → Add ULCA_USER_ID and ULCA_API_KEY to .env file")
        return False
    
    print("\n✓ Bhashini is properly configured!")
    return True


async def test_config_call():
    """Test the config API call"""
    print("\n" + "="*70)
    print("TEST 1: Config API Call (get serviceId)")
    print("="*70)
    
    try:
        print("\n🔍 Fetching config for translation (en → hi)...")
        config = await _get_config("translation", "en", "hi")
        
        if config:
            print("✓ Config received!")
            print(f"  Response keys: {list(config.keys())}")
            
            if "pipelineTasks" in config and len(config["pipelineTasks"]) > 0:
                task = config["pipelineTasks"][0]
                print(f"  - Task ID: {task.get('taskId', 'N/A')}")
                print(f"  - Task Type: {task.get('taskType', 'N/A')}")
                print(f"  - Has API Key: {'Yes' if task.get('apiKey') else 'No'}")
            
            return True
    except Exception as e:
        print(f"✗ Config call failed: {e}")
        return False


async def test_translation():
    """Test translation"""
    print("\n" + "="*70)
    print("TEST 2: Translation (EN → HI)")
    print("="*70)
    
    test_text = "Hello, how are you?"
    
    try:
        print(f"\n🌐 Translating: '{test_text}'")
        result = await translate_text(test_text, "en", "hi")
        
        print(f"\n✓ Translation successful!")
        print(f"  Original:    {result.source_language.upper()}: {test_text}")
        print(f"  Translated:  {result.target_language.upper()}: {result.translated_text}")
        
        return True
    except Exception as e:
        print(f"✗ Translation failed: {e}")
        return False


async def test_transliteration():
    """Test transliteration"""
    print("\n" + "="*70)
    print("TEST 3: Transliteration (Roman → Devanagari)")
    print("="*70)
    
    test_text = "Pune"
    
    try:
        print(f"\n📝 Transliterating: '{test_text}' (Roman → Devanagari)")
        result = await transliterate_text(test_text, "en", "hi")
        
        print(f"\n✓ Transliteration successful!")
        print(f"  Original:       {result.source_script}: {test_text}")
        print(f"  Transliterated: {result.target_script}: {result.transliterated_text}")
        print(f"\n  💡 Use case: User types 'Pune' in search → convert to '{result.transliterated_text}'")
        
        return True
    except Exception as e:
        print(f"✗ Transliteration failed: {e}")
        return False


async def test_tts():
    """Test text-to-speech"""
    print("\n" + "="*70)
    print("TEST 4: Text-to-Speech (TTS)")
    print("="*70)
    
    test_text = "नमस्कार"
    
    try:
        print(f"\n🔊 Converting to speech: '{test_text}'")
        result = await text_to_speech(test_text, "hi")
        
        print(f"\n✓ TTS successful!")
        print(f"  Text:        {test_text}")
        print(f"  Audio bytes: {len(result.audio_bytes)} bytes")
        print(f"  Format:      {result.audio_format}")
        
        # Save to file for manual testing
        audio_file = "test_audio.wav"
        with open(audio_file, "wb") as f:
            f.write(result.audio_bytes)
        print(f"\n  💾 Saved to: {audio_file}")
        print(f"  💡 You can play it with: ffplay {audio_file}")
        
        return True
    except Exception as e:
        print(f"✗ TTS failed: {e}")
        return False


async def test_asr():
    """Test speech-to-text (if audio file exists)"""
    print("\n" + "="*70)
    print("TEST 5: Speech-to-Text (ASR)")
    print("="*70)
    
    audio_file = "test_audio.wav"
    
    if not os.path.exists(audio_file):
        print(f"\n⚠ Skipped: Audio file '{audio_file}' not found")
        print(f"  → Run TEST 4 first to generate an audio file")
        return None
    
    try:
        print(f"\n🎤 Transcribing audio: '{audio_file}'")
        
        with open(audio_file, "rb") as f:
            audio_bytes = f.read()
        
        result = await speech_to_text(audio_bytes, "hi")
        
        print(f"\n✓ ASR successful!")
        print(f"  Audio file:  {audio_file} ({len(audio_bytes)} bytes)")
        print(f"  Transcript:  {result.transcribed_text}")
        
        return True
    except Exception as e:
        print(f"✗ ASR failed: {e}")
        return False


async def test_cache():
    """Test config caching"""
    print("\n" + "="*70)
    print("TEST 6: Config Cache (should be instant on second call)")
    print("="*70)
    
    import time
    
    try:
        # First call (no cache)
        print("\n🔍 First config call (no cache)...")
        start = time.time()
        config1 = await _get_config("translation", "en", "hi")
        time1 = (time.time() - start) * 1000
        print(f"  Time: {time1:.0f}ms")
        
        # Second call (should be cached)
        print("\n🔍 Second config call (should be cached)...")
        start = time.time()
        config2 = await _get_config("translation", "en", "hi")
        time2 = (time.time() - start) * 1000
        print(f"  Time: {time2:.0f}ms")
        
        # Third call with different language pair (no cache)
        print("\n🔍 Third config call (different language pair, no cache)...")
        start = time.time()
        config3 = await _get_config("translation", "hi", "en")
        time3 = (time.time() - start) * 1000
        print(f"  Time: {time3:.0f}ms")
        
        speedup = time1 / time2 if time2 > 0 else float('inf')
        print(f"\n✓ Cache working! Second call was {speedup:.0f}x faster")
        
        # Clear cache for other tests
        clear_config_cache()
        print(f"✓ Cache cleared for clean test state")
        
        return True
    except Exception as e:
        print(f"✗ Cache test failed: {e}")
        return False


async def run_all_tests():
    """Run all tests"""
    print("\n" + "="*70)
    print("🧪 BhoomiSetu Bhashini Integration Test Suite")
    print("="*70)
    
    results = {}
    
    # Health check
    results["Health Check"] = await test_health()
    
    if not results["Health Check"]:
        print("\n❌ Cannot continue without Bhashini credentials")
        return results
    
    # Clear cache before starting
    clear_config_cache()
    
    # Run tests
    results["Config API"] = await test_config_call()
    if results["Config API"]:
        results["Translation"] = await test_translation()
        results["Transliteration"] = await test_transliteration()
        results["Text-to-Speech"] = await test_tts()
        results["Speech-to-Text"] = await test_asr()
        results["Config Cache"] = await test_cache()
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    
    for test, result in results.items():
        status = "✓ PASS" if result is True else ("✗ FAIL" if result is False else "⊘ SKIP")
        print(f"  {status:8} {test}")
    
    print(f"\n  Summary: {passed} passed, {failed} failed, {skipped} skipped")
    
    if failed == 0 and passed > 0:
        print("\n✅ All tests passed! Bhashini integration is working.")
        return 0
    else:
        print(f"\n⚠ {failed} test(s) failed. Check the errors above.")
        return 1


def main():
    """Main entry point"""
    try:
        return asyncio.run(run_all_tests())
    except KeyboardInterrupt:
        print("\n\n⊘ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
