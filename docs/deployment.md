# Deployment

Run `make release-checks`, then deploy API, web, and worker with Docker Compose or Helm. Replace all dev-only secrets, set exact CORS origins and allowed hosts, enable HSTS, and scrape `/metrics`.
