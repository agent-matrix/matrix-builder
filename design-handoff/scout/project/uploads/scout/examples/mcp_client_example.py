import json, subprocess, sys

request = {"tool": "get_global_trends", "arguments": {"limit": 3}}
out = subprocess.check_output([sys.executable, "mcp/server.py"], input=json.dumps(request).encode())
print(out.decode())
