#!/usr/bin/env python
"""Tiny MCP-like JSON command server for local testing.

Usage:
  echo '{"tool":"get_global_trends","arguments":{"limit":3}}' | python mcp/server.py
"""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mcp import tools

TOOL_MAP = {
    "get_global_trends": tools.get_global_trends,
    "get_local_trends": tools.get_local_trends,
    "recommend_topics": tools.recommend_topics,
    "get_topic_deep_dive": tools.get_topic_deep_dive,
    "get_matrix_opportunities": tools.get_matrix_opportunities,
}

def main():
    request = json.loads(sys.stdin.read() or "{}")
    name = request.get("tool")
    args = request.get("arguments", {})
    if name not in TOOL_MAP:
        print(json.dumps({"error": f"Unknown tool: {name}"}))
        return
    print(json.dumps({"result": TOOL_MAP[name](**args)}, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
