import httpx
import asyncio
from app.services.bhashini import _get_config
from app.config import get_settings

async def run():
    config = await _get_config("tts", "hi", "hi")
    settings = get_settings()
    
    # We should search for the exact serviceId for 'hi'
    service_id = None
    for c in config["pipelineResponseConfig"][0]["config"]:
        if c["language"]["sourceLanguage"] == "hi":
            service_id = c["serviceId"]
            break
            
    if not service_id:
        service_id = config["pipelineResponseConfig"][0]["config"][0]["serviceId"]

    payload = {
        "pipelineTasks": [
            {
                "taskType": "tts",
                "config": {
                    "language": {"sourceLanguage": "hi", "targetLanguage": "hi"},
                    "serviceId": service_id,
                    "gender": "female"
                }
            }
        ],
        "inputData": {
            "input": [{"source": "नमस्कार"}]
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        config["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]["name"]: config["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]["value"]
    }
    
    async with httpx.AsyncClient() as client:
        r = await client.post(settings.bhashini_inference_url, json=payload, headers=headers)
        print("Status:", r.status_code)
        print("Response:", r.text)

if __name__ == "__main__":
    asyncio.run(run())
