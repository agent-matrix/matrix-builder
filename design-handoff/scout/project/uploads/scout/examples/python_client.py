import requests

base = "http://127.0.0.1:8000"
print(requests.get(f"{base}/api/v1/trends/global").json())
