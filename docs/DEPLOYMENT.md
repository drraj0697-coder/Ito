# Deployment: GitHub Pages frontend + external API server

This repository intentionally separates the static iPad PWA from its live
data service:

```text
https://USER.github.io/REPOSITORY/  →  https://API-HOST.example/api/pwa
```

GitHub Pages supplies the PWA’s HTTPS static files. A Flask/Gunicorn container
and MongoDB supply all live data. Do not try to start Flask or MongoDB with a
GitHub Pages workflow: workflows are temporary jobs, not persistent servers.

## Backend

Deploy the repository’s `Dockerfile` to Render, Railway, Fly.io, a VPS, or any
other container-capable HTTPS host. `render.yaml` and `railway.toml` are
included as optional deployment descriptors.

Required API-host variables:

```text
MONGO_URI=<private MongoDB Atlas URI>
MONGO_DB=medq_online
FLASK_DEBUG=false
FLASK_SECRET_KEY=<long random value>
CORS_ORIGINS=https://USER.github.io
SEED_DEMO=false
```

For a first smoke test, set `SEED_DEMO=true`, deploy once, and confirm that
`/api/pwa/health` reports `ok: true`. Set it back to `false` before using real
data. The source-controlled demo seed does not download or represent a real
question bank.

The container starts by waiting for MongoDB, creates required PWA indexes, and
launches Gunicorn. It is safe for this setup step to repeat at each restart.

## Frontend

Before the Pages workflow runs, set the GitHub repository **Actions variable**:

```text
MEDQ_API_BASE_URL=https://API-HOST.example/api/pwa
```

Then set **Settings → Pages → Build and deployment → GitHub Actions**. A push
to `main` triggers `.github/workflows/deploy-pages.yml`. That workflow publishes
`frontend/` and injects the public API URL into the deployment artifact only;
it never publishes private environment values.

## CORS

The API origin is different from the Pages origin, so the API host must allow
only the Pages **origin**:

```text
https://USER.github.io
```

Do not include the repository path in `CORS_ORIGINS`, and do not use `*` in a
production deployment.

## Local test

Use Docker Compose for the quickest local full-stack test:

```bash
docker compose up --build
# Then visit http://localhost:5001/study/
```

The local Flask route serves the same `frontend/` files and dynamically gives
them a same-origin `/api/pwa` configuration. No GitHub Pages deployment is
needed for this local test.

For iPad installation, use the final GitHub Pages **HTTPS** URL in Safari.
