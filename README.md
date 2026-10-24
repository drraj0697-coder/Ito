# MedQ Online — GitHub Pages PWA + Live Flask Server

This is a **single GitHub repository** containing both halves of a working,
online-first iPad app:

```text
GitHub Pages  ── HTTPS ──>  Flask API container  ──>  MongoDB Atlas
(frontend/)                      (app/, scripts/)          (data)
```

- **GitHub Pages** publishes the installable PWA in `frontend/`.
- **Flask + MongoDB** stay on an always-running host (Render, Railway, VPS,
  Docker host, etc.). GitHub Pages cannot run Python or MongoDB.
- The PWA requests subjects, topics, question batches, answers/explanations,
  search, and progress from the live API. It does **not** download or cache a
  complete question bank.
- `Dockerfile`, `docker-compose.yml`, `render.yaml`, `railway.toml`, and a
  GitHub Pages workflow are included.

The public app URL will be:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/
```

Open it in iPad Safari, then use **Share → Add to Home Screen**.

> This is a technical study-app template, not an official Marrow product. The
> repository contains no MedMCQA dump and no licensed Marrow content. Obtain,
> host, and use any real dataset only with the required rights and licence.

---

## Deployment order — do these in order

### Step 1 — Create a GitHub repository

1. Create a new **private** GitHub repository, for example `medq-online`.
2. Extract this ZIP and upload/push its contents to the repository root.
3. Do **not** commit `.env`, MongoDB credentials, question dumps, or private
   API keys. The supplied `.gitignore` blocks the common local files.

### Step 2 — Create the MongoDB database

Create a MongoDB Atlas cluster/database, then create a database user. Copy its
connection string, for example:

```text
mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/?retryWrites=true&w=majority
```

Call the database `medq_online` or choose your own name.

### Step 3 — Deploy the always-running API server

GitHub Pages cannot run this server. Use **one** of these supplied paths:

- **Render:** create a new Blueprint/Web Service from the GitHub repository;
  `render.yaml` and `Dockerfile` are included.
- **Railway:** create a service from the GitHub repository; `railway.toml` and
  `Dockerfile` are included.
- **Any Docker host/VPS:** deploy the supplied `Dockerfile`.

Set these environment variables on the API host:

```text
MONGO_URI=your-private-mongodb-atlas-uri
MONGO_DB=medq_online
FLASK_DEBUG=false
FLASK_SECRET_KEY=a-long-random-secret
CORS_ORIGINS=https://YOUR-GITHUB-USERNAME.github.io
SEED_DEMO=true
```

For the first deployment, `SEED_DEMO=true` creates six labelled sample
questions, allowing you to prove the complete system before importing real
data. It is safe to leave it on only for a demo database; set it to `false`
when using your real data.

Wait for the server deployment to finish. Copy its public HTTPS address, for
example:

```text
https://medq-online-api.onrender.com
```

Test it in a browser:

```text
https://medq-online-api.onrender.com/api/pwa/health
```

A working API returns JSON with `"ok": true`.

### Step 4 — Set the GitHub Pages API address

In the GitHub repository:

1. Open **Settings → Secrets and variables → Actions → Variables**.
2. Create a repository variable exactly named:

   ```text
   MEDQ_API_BASE_URL
   ```

3. Set its value to the full API path, with no trailing slash:

   ```text
   https://medq-online-api.onrender.com/api/pwa
   ```

This is a public URL, not a secret. Do not put database credentials in it.

### Step 5 — Enable GitHub Pages deployment

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions**.
3. Push to the `main` branch, or open **Actions → Deploy PWA to GitHub Pages →
   Run workflow**.
4. Wait for the workflow to complete successfully.
5. The workflow copies `frontend/`, writes your public API URL into its build
   artifact, and publishes the PWA to Pages.

The URL appears in the deployment result and has this form:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/
```

The workflow intentionally fails if `MEDQ_API_BASE_URL` has not been set. That
prevents accidentally publishing a PWA with a broken placeholder API address.

### Step 6 — Test before installing on iPad

Open the GitHub Pages URL in a normal browser. Confirm that it can:

1. show a nonzero question total;
2. open **Demo Medicine** subjects/topics when demo seeding is enabled;
3. load a 10-question session;
4. fetch an answer/explanation only after an option is selected; and
5. show an attempt under **Profile → Refresh**.

If the browser shows a network/CORS error, set the API server’s
`CORS_ORIGINS` exactly to:

```text
https://YOUR-GITHUB-USERNAME.github.io
```

Restart/redeploy the API after changing it.

### Step 7 — Install on iPad

1. On the iPad, open the GitHub Pages URL in **Safari**.
2. Confirm the top-right status says **Online**.
3. Tap Safari’s **Share** button.
4. Choose **Add to Home Screen**.
5. Name it **MedQ Online** and tap **Add**.
6. Open the new Home Screen icon.

The PWA shell is cached for quick launch, but new questions, answer reveals,
search, and progress sync remain online-only. This is intentional.

---

## Local full-stack test

For a quick test before deploying, install Docker Desktop and run:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:5001/study/
```

The Compose setup starts MongoDB, starts the Flask API, creates the sample
data, sets indexes, and serves the same PWA locally. Stop it with:

```bash
docker compose down
```

To erase the local demo database as well:

```bash
docker compose down -v
```

---

## Loading a real question dataset

The server database starts with only six demo questions if `SEED_DEMO=true`.
For real content:

1. Set `SEED_DEMO=false` on the API host.
2. Acquire MedMCQA or another permitted data source independently; never add
   its dump to this repository.
3. Run the existing ingestion pipeline from a trusted computer/server with
   access to the same Atlas database:

```bash
cp .env.example .env
# Set MONGO_URI and MONGO_DB to the production Atlas database.
uv sync
uv run python scripts/extract_subjects.py /safe/path/medmcqa.jsonl
uv run python scripts/enrich_syllabus.py
uv run python scripts/seed_taxonomy.py
uv sync --group ingest
uv run --group ingest python scripts/ingest_mcqs.py /safe/path/medmcqa.jsonl \
  --per-subject 2000 --threshold 0.6
uv run python scripts/setup_pwa.py
```

The embedding/FAISS ingestion is a server-side build job and may require
substantial RAM/storage. It does not run on iPad or GitHub Pages.

---

## Repository map

| Path | Role |
| --- | --- |
| `frontend/` | GitHub Pages PWA: HTML/CSS/JS, manifest, icons and shell-only service worker. |
| `.github/workflows/deploy-pages.yml` | Publishes `frontend/` to GitHub Pages and injects the public API URL. |
| `app/routes/pwa_api.py` | Online PWA API: catalog, topics, question batches, answer reveal, search and progress. |
| `app/routes/pwa.py` | Lets Flask serve the same PWA locally at `/study/`. |
| `Dockerfile` | Production Flask API image. |
| `docker-compose.yml` | One-command local MongoDB + API + demo stack. |
| `render.yaml` / `railway.toml` | Optional host deployment descriptors. |
| `scripts/start_server.sh` | Waits for MongoDB, optionally seeds demo data, creates indexes, launches Gunicorn. |
| `scripts/setup_pwa.py` | Creates the necessary MongoDB indexes. |
| `scripts/seed_pwa_demo.py` | Small source-controlled demo seed only. |

---

## Security and production notes

- The frontend configuration contains only a public API endpoint. Never expose
  `MONGO_URI`, database passwords, `FLASK_SECRET_KEY`, or service credentials.
- The current progress feature uses a locally generated anonymous installation
  id. It is fine for testing, but it is **not account authentication**.
- Before storing real private progress or paid/licensed content, add proper
  user authentication, server-side authorisation, API rate limits, backups,
  monitoring, and content-access controls.
- Keep CORS restricted to your exact GitHub Pages origin; do not use `*` in
  production.
- Do not call this app “Marrow” or load third-party content without permission.

More detail: [`docs/DATA_USE.md`](docs/DATA_USE.md),
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), and
[`README-online-pwa.md`](README-online-pwa.md).

## Included working features

- responsive subject and topic browsing from MongoDB;
- 10, 20, or 50-question live practice batches;
- Data Saver mode, which limits practice to ten questions;
- answer/explanation reveal only after an option is selected;
- server-validated answer correctness and stored attempt summaries;
- live server-side text search;
- online/offline status and an API-payload usage estimate;
- a shell-only service worker that does not cache question/API responses;
- local Docker Compose test stack plus a deployment-ready Gunicorn server;
- GitHub Pages Action deployment with a configurable, public API endpoint.
