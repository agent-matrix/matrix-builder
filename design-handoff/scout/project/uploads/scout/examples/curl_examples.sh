#!/usr/bin/env bash
curl http://127.0.0.1:8000/api/v1/health
curl http://127.0.0.1:8000/api/v1/trends/global
curl "http://127.0.0.1:8000/api/v1/recommendations?country=Italy&city=Rome&goal=career"
