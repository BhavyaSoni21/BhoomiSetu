# Bhashini Integration Examples - Practical Use Cases

## Example 1: Multilingual Notifications

When a workflow step is completed, send notification in citizen's preferred language.

### Backend Route Enhancement

```python
# In app/routers/workflows.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.services.bhashini import translate_text
from app.database import get_db
from app.models import Workflow, User

router = APIRouter()

@router.patch("/api/v1/workflows/{workflow_id}/steps/{step_id}")
async def update_workflow_step(
    workflow_id: str,
    step_id: str,
    body: dict,
    db: Session = Depends(get_db)
):
    """Update workflow step and send translated notification"""
    
    # Existing workflow logic...
    workflow = db.query(Workflow).get(workflow_id)
    citizen = db.query(User).get(workflow.citizen_id)
    
    # Determine citizen's preferred language
    preferred_lang = citizen.preferences.get('language', 'hi')  # Default: Hindi
    
    # Get step status message
    status_message = f"Your workflow step {step_id} has been {body.get('action')}"
    
    # Translate if not in English
    if preferred_lang != 'en':
        result = await translate_text(status_message, 'en', preferred_lang)
        translated_message = result.translated_text
    else:
        translated_message = status_message
    
    # Send notification in citizen's language
    send_notification(
        citizen_id=citizen.id,
        message=translated_message,
        language=preferred_lang
    )
    
    return {"status": "updated", "notification_sent": translated_message}
```

## Example 2: Multilingual Parcel Search with Transliteration

Enable citizens to search by parcel name/owner in any script.

### Backend Route Enhancement

```python
# In app/routers/parcels.py

from app.services.bhashini import transliterate_text

@router.get("/api/v1/parcels/search")
async def search_parcels(
    query: str,  # e.g., "Pune" or "पुणे"
    language: str = "en"
):
    """
    Search parcels by name or owner, supporting both Roman and Devanagari scripts
    """
    
    # Collect search terms
    search_terms = [query]
    
    # If input is in one script, also search the other script
    is_devanagari = any('\u0900' <= c <= '\u097F' for c in query)
    
    if not is_devanagari:  # Roman input
        # Transliterate Roman → Devanagari
        result = await transliterate_text(query, "en", "hi")
        search_terms.append(result.transliterated_text)
    else:  # Devanagari input
        # Transliterate Devanagari → Roman
        result = await transliterate_text(query, "hi", "en")
        search_terms.append(result.transliterated_text)
    
    # Search with all variants
    parcels = []
    for term in search_terms:
        found = db.query(Parcel).filter(
            or_(
                Parcel.owner_name.ilike(f"%{term}%"),
                Parcel.survey_number.ilike(f"%{term}%"),
                Parcel.local_identifier.ilike(f"%{term}%")
            )
        ).all()
        parcels.extend(found)
    
    # Remove duplicates
    parcel_ids = set(p.id for p in parcels)
    unique_parcels = [p for p in parcels if p.id in parcel_ids]
    
    # Translate results if requested
    if language != "en":
        for parcel in unique_parcels:
            parcel.owner_name = (
                await translate_text(parcel.owner_name, "en", language)
            ).translated_text
    
    return {
        "query": query,
        "search_terms": search_terms,
        "results": unique_parcels,
        "count": len(set(p.id for p in unique_parcels))
    }
```

### Frontend Integration

```javascript
// In frontend/src/features/search/SearchBox.tsx

import { useState } from 'react';
import axios from 'axios';

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [language, setLanguage] = useState('hi');
  
  const handleSearch = async (e) => {
    e.preventDefault();
    
    try {
      const response = await axios.get('/api/v1/parcels/search', {
        params: {
          query: query,
          language: language
        }
      });
      
      setResults(response.data.results);
      console.log(`Found ${response.data.results.length} parcels searching: ${response.data.search_terms.join(', ')}`);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };
  
  return (
    <div className="search-box">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="पार्सल का नाम या मालिक का नाम खोजें"
        />
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="en">English</option>
          <option value="hi">हिंदी</option>
        </select>
        <button type="submit">खोजें</button>
      </form>
      
      {results.map(parcel => (
        <div key={parcel.id} className="result">
          <h4>{parcel.owner_name}</h4>
          <p>Survey: {parcel.survey_number}</p>
        </div>
      ))}
    </div>
  );
}
```

## Example 3: Audio Alerts for Governance Issues

When a critical governance alert is created, notify officer via TTS.

### Backend Service

```python
# In app/services/governance_alerts_service.py

from app.services.bhashini import text_to_speech
from app.notification_feed import notify_officer

async def create_governance_alert(parcel_id: str, alert_type: str, severity: str):
    """Create alert and generate audio notification for officer"""
    
    # Create alert record
    alert = GovernanceAlert(
        parcel_id=parcel_id,
        alert_type=alert_type,
        severity=severity
    )
    db.add(alert)
    db.commit()
    
    # Generate alert message
    alert_message = (
        f"Critical governance alert: {alert_type} detected on parcel {parcel_id}. "
        f"Severity: {severity}. Please review immediately."
    )
    
    # Generate audio in officer's language preference
    officer = get_assigned_officer(parcel_id)
    officer_lang = officer.preferences.get('language', 'hi')
    
    # Translate message if needed
    if officer_lang != 'en':
        translated = await translate_text(alert_message, 'en', officer_lang)
        message_to_speak = translated.translated_text
    else:
        message_to_speak = alert_message
    
    # Generate audio
    try:
        audio_result = await text_to_speech(message_to_speak, officer_lang)
        
        # Send audio notification
        await notify_officer(
            officer_id=officer.id,
            message=alert_message,
            audio_url=f"/api/v1/alerts/{alert.id}/audio",
            audio_bytes=audio_result.audio_bytes
        )
    except Exception as e:
        logger.error(f"Failed to generate audio alert: {e}")
        # Fallback to text notification
        await notify_officer(officer_id=officer.id, message=alert_message)
    
    return alert

@router.get("/api/v1/alerts/{alert_id}/audio")
async def get_alert_audio(alert_id: str):
    """Serve pre-generated audio for alert"""
    alert = db.query(GovernanceAlert).get(alert_id)
    if not alert or not alert.audio_bytes:
        raise HTTPException(status_code=404, detail="Audio not found")
    
    return StreamingResponse(
        iter([alert.audio_bytes]),
        media_type="audio/wav",
        headers={"Content-Disposition": f"attachment; filename=alert_{alert_id}.wav"}
    )
```

## Example 4: Voice-Based Workflow Filing

Citizens can file requests by speaking instead of typing.

### Frontend Component

```jsx
// frontend/src/features/workflows/VoiceWorkflowForm.tsx

import { useState, useRef } from 'react';
import axios from 'axios';

export function VoiceWorkflowForm({ parcelId }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('hi');
  const mediaRecorderRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      
      recorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        
        try {
          // Send audio to ASR endpoint
          const formData = new FormData();
          formData.append('audio', audioBlob);
          formData.append('language', language);
          
          const response = await axios.post(
            '/api/v1/multilingual/asr',
            formData
          );
          
          setTranscript(response.data.transcribed_text);
        } catch (error) {
          console.error('Transcription failed:', error);
          alert('Could not understand your voice. Please try again or type instead.');
        } finally {
          setIsProcessing(false);
        }
      };
      
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Please allow microphone access to use voice filing.');
    }
  };
  
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };
  
  const submitRequest = async () => {
    try {
      // Create workflow with transcribed text as request details
      const response = await axios.post('/api/v1/workflows', {
        parcelId: parcelId,
        workflowType: 'DOCUMENT_REQUEST',
        requestDetails: transcript,
        requestMethod: 'voice'
      });
      
      alert('Request filed successfully!');
      setTranscript('');
    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Failed to submit request. Please try again.');
    }
  };
  
  return (
    <div className="voice-workflow-form">
      <div className="language-selector">
        <label>Speak in: </label>
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value)}
          disabled={isRecording}
        >
          <option value="en">English</option>
          <option value="hi">हिंदी (Hindi)</option>
        </select>
      </div>
      
      <div className="recording-area">
        {isRecording && <div className="recording-indicator">🔴 Recording...</div>}
        
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          className={`record-button ${isRecording ? 'active' : ''}`}
          disabled={isProcessing}
        >
          🎤 {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
      
      {isProcessing && <p>Processing your voice...</p>}
      
      {transcript && (
        <div className="transcript-area">
          <h4>Your Request:</h4>
          <textarea 
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
          />
          
          <div className="button-group">
            <button onClick={submitRequest} className="submit-btn">
              Submit Request
            </button>
            <button onClick={() => setTranscript('')} className="clear-btn">
              Clear & Record Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Example 5: Translated Status Badges

Show workflow status in citizen's preferred language on Parcel 360.

### Backend Route

```python
# In app/routers/parcels.py

from app.services.bhashini import translate_text

@router.get("/api/v1/parcels/{parcel_id}/status-badges")
async def get_status_badges(parcel_id: str, language: str = "en"):
    """Get parcel status badges in requested language"""
    
    parcel = db.query(Parcel).get(parcel_id)
    
    status_map = {
        "ownership_verified": "Ownership Verified",
        "documents_complete": "Documents Complete",
        "restrictions_active": "Restrictions Active",
        "dispute_pending": "Dispute Pending"
    }
    
    badges = []
    for key, label in status_map.items():
        if getattr(parcel, key, False):
            # Translate status if not in English
            if language != "en":
                translated = await translate_text(label, "en", language)
                display_label = translated.translated_text
            else:
                display_label = label
            
            badges.append({
                "key": key,
                "label": display_label,
                "icon": get_badge_icon(key)
            })
    
    return badges
```

### Frontend Display

```jsx
// frontend/src/components/ParcelBadges.tsx

export function ParcelBadges({ parcelId, language = 'en' }) {
  const [badges, setBadges] = React.useState([]);
  
  React.useEffect(() => {
    fetch(`/api/v1/parcels/${parcelId}/status-badges?language=${language}`)
      .then(r => r.json())
      .then(setBadges);
  }, [parcelId, language]);
  
  return (
    <div className="badges">
      {badges.map(badge => (
        <div key={badge.key} className="badge">
          <span className="icon">{badge.icon}</span>
          <span className="label">{badge.label}</span>
        </div>
      ))}
    </div>
  );
}
```

## Summary of Integration Points

| Feature | Use Case | Bhashini Service | File |
|---------|----------|------------------|------|
| **Notifications** | Send in citizen's language | `translate_text()` | `routers/workflows.py` |
| **Search** | Support both scripts | `transliterate_text()` | `routers/parcels.py` |
| **Alerts** | Audio notification for critical issues | `text_to_speech()` | `services/governance_alerts.py` |
| **Voice Filing** | Citizens can speak requests | `speech_to_text()` | `features/workflows/VoiceForm.tsx` |
| **Status Display** | Translated status badges | `translate_text()` | `components/ParcelBadges.tsx` |

## Testing the Integrations

### Test Multilingual Search
```bash
# Test Roman script
curl "http://localhost:8000/api/v1/parcels/search?query=Pune&language=en"

# Test Devanagari
curl "http://localhost:8000/api/v1/parcels/search?query=पुणे&language=hi"
```

### Test Voice Filing
1. Open frontend: http://localhost:5173
2. Go to Citizen Portal → File Request
3. Click "🎤 Speak" button
4. Speak your request in Hindi or English
5. Verify transcription appears
6. Submit

### Test Translated Alerts
1. Create a governance alert via admin panel
2. Check officer's notification
3. Verify it's in officer's preferred language

## Performance Optimization Tips

1. **Cache translations on frontend**:
   ```javascript
   const translationCache = new Map();
   
   async function cachedTranslate(text, lang) {
     const key = `${text}:${lang}`;
     if (translationCache.has(key)) {
       return translationCache.get(key);
     }
     
     const result = await translateText(text, lang);
     translationCache.set(key, result);
     return result;
   }
   ```

2. **Batch translate**: Send multiple strings in one request

3. **Use config caching**: 1-hour TTL means 99% cache hit rate

4. **Pre-translate common strings**: Cache at app startup

---

Now your BhoomiSetu platform is fully multilingual! 🌍
