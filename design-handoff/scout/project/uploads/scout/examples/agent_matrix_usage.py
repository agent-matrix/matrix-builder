import requests

opps = requests.get("http://127.0.0.1:8000/api/v1/matrix/opportunities", params={"country":"Italy", "city":"Rome"}).json()
for item in opps["opportunities"]:
    print(item["recommended_artifact"])
