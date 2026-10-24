# MedQ Online PWA

An **online-first, installable iPad/web PWA** layered onto the public
`Marrow-ITO/marrow_ito_content` Flask + MongoDB project.

It is deliberately **not** a full offline question-bank download:

- The small interface is cacheable for fast Home-Screen launch.
- Subject lists, topics, questions, answers, explanations, search, and synced
  attempt summaries are requested from the hosted API as needed.
- A practice batch initially receives only question text and options. The answer
  and explanation are fetched after the learner chooses an option.
- The service worker never stores `/api/*` responses.

Open the app at **`https://YOUR-DOMAIN/study/`** after deployment, then choose
**Share → Add to Home Screen** in Safari on the iPad.

> The original prototype README is preserved as
> [`README-upstream.md`](README-upstream.md). This package does not include the
> MedMCQA dataset or any licensed Marrow content.

## What was added

| Path | Purpose |
| --- | --- |
| `app/static/study/` | Dependency-free responsive PWA shell, manifest, icon, and shell-only service worker. |
| `app/routes/pwa.py` | Serves the installable app at `/study/`. |
| `app/routes/pwa_api.py` | Compact mobile API under `/api/pwa/`; uses the existing Mongo schema. |
| `scripts/setup_pwa.py` | Creates text/search/progress indexes. |
| `scripts/seed_pwa_demo.py` | Optional, clearly marked six-question demo seed for a UI smoke test. |
| `docs/DEPLOYMENT.md` | Hosting, HTTPS, CORS, and security steps. |
| `docs/DATA_USE.md` | Transparent iPad/network-use budgets and cache behavior. |

## Important scope and content rights

This is a technical app adaptation, **not an official Marrow application**.
Do not load, scrape, redistribute, or brand unlicensed third-party material.
The upstream project expects the independently obtained **MedMCQA** dataset;
review its licence and any applicable institutional/content permissions before
hosting it. This repository intentionally contains no MedMCQA dump.

## Quick local run

Requirements: Python 3.10+, [uv](https://docs.astral.sh/uv/), and MongoDB or
MongoDB Atlas.

```bash
cp .env.example .env
# Edit MONGO_URI, MONGO_DB, FLASK_SECRET_KEY, and CORS_ORIGINS.
uv sync

# Optional: a six-question local smoke-test dataset, not production content.
uv run python scripts/seed_pwa_demo.py
uv run python scripts/setup_pwa.py

uv run python run.py
# Visit http://localhost:5001/study/
```

For real data, use the existing upstream pipeline in the following order:

```bash
# Place an independently acquired MedMCQA JSON/JSONL file outside version control.
uv run python scripts/extract_subjects.py /safe/path/medmcqa.jsonl
uv run python scripts/enrich_syllabus.py
uv run python scripts/seed_taxonomy.py
uv sync --group ingest
uv run --group ingest python scripts/ingest_mcqs.py /safe/path/medmcqa.jsonl \
  --per-subject 2000 --threshold 0.6
uv run python scripts/setup_pwa.py
```

The semantic ingestion step needs PyTorch/FAISS and is a **server build task**;
it never runs on the iPad. Once the database is populated, the iPad only uses
small HTTPS API requests while studying.

## Deploying it online

1. Provision a managed MongoDB database and populate it using the ingestion
   process above.
2. Deploy this Flask project to a Python host behind HTTPS (Render, Railway,
   Fly.io, a VM/container, etc.). Configure the environment from `.env.example`.
3. Use a production WSGI server rather than `python run.py`; the included
   `Procfile` is suitable for hosts that recognise it.
4. Serve the app and API from the **same HTTPS domain**. The PWA expects
   `/study/` and `/api/pwa/` on that domain. This avoids a cross-origin API
   dependency on the iPad.
5. Open `/study/` once in Safari and use **Add to Home Screen**.

Read [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) before publishing. In
particular, replace the anonymous-installation attempt store with real account
authentication if progress must be private or work across devices.

## Data behavior

See [`docs/DATA_USE.md`](docs/DATA_USE.md). The target for text-only use is:

- app shell: roughly **2–6 MB** first installation/open;
- a 100-question text-and-explanation session: typically **0.5–3 MB**;
- no mandatory 55 MB dataset download or 150+ MB decoded local database;
- images/video are not included by this PWA and should be separately streamed
  only after an explicit tap.

The Profile screen records an **in-app estimate** of decoded API JSON delivered
to this installation. It is not a replacement for iOS cellular/Wi-Fi totals,
and it deliberately excludes app installation bytes and any future media.

## Verification commands

```bash
node --check app/static/study/app.js
python -m py_compile app/routes/pwa.py app/routes/pwa_api.py scripts/setup_pwa.py
uv run python scripts/setup_pwa.py
```
