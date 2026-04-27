import urllib.request
import urllib.error
import json

url = "https://prompt-hub-xtqi.onrender.com/projects/674ff2f1-4278-447a-9880-d2e60286074d/generate-plan"
data = json.dumps({"instructions": ""}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()}")
