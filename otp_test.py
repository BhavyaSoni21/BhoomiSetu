import requests
import random

otp = random.randint(100000, 999999)

API_KEY = "txb_826K1qAyM4x4ObfxEgz5wFpUG0hmAu6Y"

url = "https://api.textbee.dev/api/v1/gateway/send-sms"

headers = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
}

sms_message = f"Your One Time Password is {otp}. It is valid for 5 minutes. Do not share this OTP with anyone."

data = {
    "deviceId": "6aa1a924ccb6c72709469822",
    "simSubscriptionId": 2,
    "recipients": ["+918655126504","9157144832" , "+919867180809"],
    "message": sms_message
}

response = requests.post(url, json=data, headers=headers)

print("Status:", response.status_code)
print("Response:", response.text)