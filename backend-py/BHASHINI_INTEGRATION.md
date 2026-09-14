# Bhashini Multilingual API Integration Guide

## Overview

BhoomiSetu now supports real-time multilingual capabilities through integration with **Bhashini** (Government of India's AI platform). This enables:

1. **Translation (NMT)** - English ↔ Hindi text translation
2. **Transliteration** - Roman ↔ Devanagari script conversion
3. **Text-to-Speech (TTS)** - Convert text to audio
4. **Speech-to-Text (ASR)** - Transcribe audio to text

## Architecture

### Two-Step Bhashini API Flow

All Bhashini operations follow this pattern:

```
1. CONFIG CALL
   POST /ulca/apis/v0/model/getModelsPipeline
   ├─ User credentials (ULCA_USER_ID, ULCA_API_KEY)
   ├─ Task type (translation, transliteration, tts, asr)
   ├─ Language pair
   └─ Returns: serviceId + inference API key
           ↓
2. INFERENCE CALL
   POST /services/inference/pipeline
   ├─ serviceId from config
   ├─ Inference API key
   ├─ Actual text/audio to process
   └─ Returns: Result (translated text, audio, transcript, etc.)
```

**Key Design**: 
- Config results are cached (3600s TTL by default) to avoid redundant API calls
- Never hardcoded: serviceId is always fetched dynamically per language pair
- Retry logic (2 retries with exponential backoff) handles transient failures
- All operations are async/await for performance

## Setup Instructions

### 1. Get Bhashini Credentials

1. Visit [https://bhashini.gov.in/](https://bhashini.gov.in/)
2. Register and obtain:
   - **ULCA_USER_ID** - Your registered user ID
   - **ULCA_API_KEY** - API key for authentication
   - **BHASHINI_PIPELINE_ID** - Pipeline ID (default: `64392f96daac500b55c543cd`)

### 2. Configure Environment Variables

Edit `backend-py/.env`:

```env
# Bhashini API Configuration
ULCA_USER_ID=your-user-id-here
ULCA_API_KEY=your-api-key-here
BHASHINI_PIPELINE_ID=64392f96daac500b55c543cd

# Language Configuration
DEFAULT_SOURCE_LANG=en
DEFAULT_TARGET_LANG=hi

# API Endpoints (usually don't need to change)
BHASHINI_AUTH_URL=https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline
BHASHINI_INFERENCE_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline

# Timeouts (milliseconds)
BHASHINI_TRANSLATION_TIMEOUT=30
BHASHINI_TRANSLITERATION_TIMEOUT=10
BHASHINI_TTS_TIMEOUT=30
BHASHINI_ASR_TIMEOUT=30

# Caching
BHASHINI_CACHE_TTL=3600       # 1 hour
BHASHINI_MAX_RETRIES=2
BHASHINI_RETRY_BACKOFF_MS=500  # Exponential: 500ms, 1s, 2s, etc.
```

### 3. Restart the Backend

```bash
cd backend-py
python -m uvicorn app.main:app --reload
```

## API Endpoints

### 1. Translation

Translate text between languages.

**Endpoint**: `POST /api/v1/multilingual/translate`

**Request**:
```json
{
    "text": "Hello, how are you?",
    "source_lang": "en",
    "target_lang": "hi"
}
```

**Response**:
```json
{
    "translated_text": "नमस्ते, आप कैसे हैं?",
    "source_language": "en",
    "target_language": "hi",
    "confidence": null
}
```

**Error Handling**:
- If Bhashini is not configured: `503 Bhashini is not configured`
- If API fails: `503 Bhashini translation API failed`
- Falls back to showing original text on error

### 2. Transliteration

Convert text between Roman and Devanagari scripts.

**Endpoint**: `POST /api/v1/multilingual/transliterate`

**Request**:
```json
{
    "text": "Pune",
    "source_lang": "en",
    "target_lang": "hi"
}
```

**Response**:
```json
{
    "transliterated_text": "पुणे",
    "source_script": "roman",
    "target_script": "devanagari"
}
```

**Use Case**: Parcel search - user types "Pune" (Roman) → transliterate to "पुणे" (Devanagari) → search database for matching records in both scripts.

### 3. Text-to-Speech

Convert text to audio (WAV format).

**Endpoint**: `POST /api/v1/multilingual/tts`

**Request**:
```json
{
    "text": "नमस्कार",
    "language": "hi"
}
```

**Response**: Binary WAV audio file

**Use Case**: Read status messages, notifications, and parcel details aloud in the citizen portal.

### 4. Speech-to-Text

Transcribe audio to text.

**Endpoint**: `POST /api/v1/multilingual/asr`

**Request** (multipart form):
```
audio: <binary WAV file>
language: hi
```

**Response**:
```json
{
    "transcribed_text": "पुणे जिले में पार्सल खोजें",
    "confidence": null
}
```

**Use Case**: Citizen can search parcels or file requests by voice instead of typing.

### 5. Health Check

Check if Bhashini integration is available.

**Endpoint**: `GET /api/v1/multilingual/health`

**Response**:
```json
{
    "configured": true,
    "message": "Bhashini multilingual API is configured"
}
```

## Frontend Integration

### Language Toggle

Add to navbar/settings:

```javascript
// Toggle language between English and Hindi
const toggleLanguage = async () => {
    const newLang = currentLang === 'en' ? 'hi' : 'en';
    
    // Save preference
    localStorage.setItem('preferred_language', newLang);
    setCurrentLang(newLang);
    
    // Update all UI text
    await reloadPageContent(newLang);
};
```

### Translation Helper Function

```javascript
// In your frontend utils
async function translateText(text, targetLang = 'hi') {
    try {
        const response = await axios.post('/api/v1/multilingual/translate', {
            text: text,
            source_lang: 'en',
            target_lang: targetLang
        });
        return response.data.translated_text;
    } catch (error) {
        console.error('Translation failed:', error);
        return text; // Fallback: return original text
    }
}
```

### Transliteration in Search

```javascript
// When user types in search box
async function handleSearchInput(query) {
    let searchQuery = query;
    
    // If input is in Roman letters, transliterate to Devanagari
    if (isRomanScript(query)) {
        const response = await axios.post('/api/v1/multilingual/transliterate', {
            text: query,
            source_lang: 'en',
            target_lang: 'hi'
        });
        searchQuery = response.data.transliterated_text;
    }
    
    // Search with both original and transliterated text
    const results = await searchParcels([query, searchQuery]);
    return results;
}
```

### Text-to-Speech Button

```jsx
// Add to notification/status message component
function StatusMessage({ message, language = 'hi' }) {
    const [isPlaying, setIsPlaying] = React.useState(false);
    
    const handleSpeak = async () => {
        try {
            setIsPlaying(true);
            const response = await axios.post(
                '/api/v1/multilingual/tts',
                { text: message, language: language },
                { responseType: 'blob' }
            );
            
            const audio = new Audio(URL.createObjectURL(response.data));
            audio.play();
            audio.onended = () => setIsPlaying(false);
        } catch (error) {
            console.error('TTS failed:', error);
        }
    };
    
    return (
        <div className="status-message">
            <span>{message}</span>
            <button onClick={handleSpeak} disabled={isPlaying}>
                🔊 {isPlaying ? 'Playing...' : 'Listen'}
            </button>
        </div>
    );
}
```

### Speech-to-Text Microphone

```jsx
// Microphone input for search/filing requests
function MicrophoneInput({ onTranscribe }) {
    const [isRecording, setIsRecording] = React.useState(false);
    const mediaRecorderRef = React.useRef(null);
    
    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: 'audio/wav' });
            
            // Send to backend for transcription
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('language', 'hi');
            
            try {
                const response = await axios.post(
                    '/api/v1/multilingual/asr',
                    formData
                );
                onTranscribe(response.data.transcribed_text);
            } catch (error) {
                console.error('ASR failed:', error);
            }
        };
        
        recorder.start();
        setIsRecording(true);
    };
    
    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };
    
    return (
        <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={isRecording ? 'recording' : ''}
        >
            🎤 {isRecording ? 'Recording...' : 'Voice Search'}
        </button>
    );
}
```

## Error Handling

### Bhashini Service Errors

The service handles these scenarios gracefully:

| Scenario | Status Code | User Message |
|----------|-------------|---|
| Credentials not configured | 503 | "Bhashini is not configured" |
| Network timeout | 503 | "Bhashini API unreachable" |
| Server error | 503 | "Bhashini API failed" + "Showing original text" |
| Invalid request | 400 | "Text cannot be empty" |
| Cache hit | 200 | Instant response (from cache) |

### Retry Strategy

```
Attempt 1: Immediate
Attempt 2: Wait 500ms, retry
Attempt 3: Wait 1000ms, retry
(Exponential backoff: base * 2^attempt)
```

## Testing the Integration

### 1. Health Check

```bash
curl http://localhost:8000/api/v1/multilingual/health
```

### 2. Translation Test

```bash
curl -X POST http://localhost:8000/api/v1/multilingual/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "source_lang": "en", "target_lang": "hi"}'
```

### 3. Transliteration Test

```bash
curl -X POST http://localhost:8000/api/v1/multilingual/transliterate \
  -H "Content-Type: application/json" \
  -d '{"text": "Pune", "source_lang": "en", "target_lang": "hi"}'
```

### 4. TTS Test (save audio)

```bash
curl -X POST http://localhost:8000/api/v1/multilingual/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "नमस्कार", "language": "hi"}' \
  --output test.wav
```

### 5. ASR Test

```bash
curl -X POST http://localhost:8000/api/v1/multilingual/asr \
  -F "audio=@test.wav" \
  -F "language=hi"
```

## Adding More Languages

To support additional languages in the future (Tamil, Telugu, Kannada, Marathi, etc.):

1. **Update config**: Add language codes to `.env`:
   ```env
   SUPPORTED_LANGUAGES=en,hi,ta,te,kn,mr
   ```

2. **Update request validation**: Modify request models to accept any language code

3. **No code changes needed**: The Bhashini service module is language-agnostic; it works with any ISO 639-1 language code

Example for Tamil:
```bash
curl -X POST http://localhost:8000/api/v1/multilingual/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "source_lang": "en", "target_lang": "ta"}'
```

## Performance Considerations

- **Config caching**: 1 hour TTL reduces API calls by ~99%
- **Async/await**: Non-blocking I/O for concurrent requests
- **Timeouts**: 30s for translation, 10s for transliteration (configurable)
- **Retry backoff**: Prevents hammering the API during outages

**Expected latencies** (first request, no cache):
- Translation: 2-5 seconds
- Transliteration: 1-3 seconds
- TTS: 3-8 seconds
- ASR: 5-15 seconds (depends on audio length)

**Cached requests**: < 100ms

## Troubleshooting

### "Bhashini is not configured"

**Issue**: Missing credentials in `.env`

**Fix**:
```bash
# Check if env vars are set
echo $ULCA_USER_ID
echo $ULCA_API_KEY

# If empty, add them to .env and restart
```

### "No supported tasks found for this request"

**Issue**: Language pair not supported or invalid task type

**Fix**: Verify language codes are correct (use `en`, `hi` not `eng`, `hin`)

### API Timeout (> 30 seconds)

**Issue**: Bhashini servers are overloaded or slow

**Fix**: 
1. Increase timeout in `.env`: `BHASHINI_TRANSLATION_TIMEOUT=60`
2. Wait and retry (automatic retry logic will handle this)

### Blank Translation/Transliteration

**Issue**: Service returned empty response

**Fix**: 
1. Check Bhashini credentials are valid
2. Check that text input is not empty
3. Review server logs for error details

## References

- Bhashini Official: https://bhashini.gov.in/
- ULCA Platform: https://ulcacontrib.org/
- Language Codes: https://www.w3.org/International/O-charset-lang.html
- ISO 639-1: https://en.wikipedia.org/wiki/ISO_639-1

## Next Steps

1. ✅ Configure `ULCA_USER_ID` and `ULCA_API_KEY` in `.env`
2. ✅ Restart backend: `uvicorn app.main:app --reload`
3. ✅ Test endpoints with curl or Swagger UI at `/api/docs`
4. ✅ Integrate translation into frontend pages
5. ✅ Add language toggle to navbar
6. ✅ Add TTS buttons to status messages
7. ✅ Add microphone button to search bar
