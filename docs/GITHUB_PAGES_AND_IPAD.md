# GitHub Pages + iPad quick guide

GitHub Pages hosts only `frontend/`. It provides HTTPS, which is enough for
Safari to install the website as a PWA, but it cannot host the Python API or a
database. Keep the backend on the external Docker/Render/Railway/VPS host.

## Required addresses

Example only:

```text
PWA: https://example-user.github.io/medq-online/
API: https://medq-online-api.example.com/api/pwa
```

Set the public API address in the GitHub repository **Actions variable**
`MEDQ_API_BASE_URL`. Set the backend `CORS_ORIGINS` to only:

```text
https://example-user.github.io
```

The repository name is not included in a browser `Origin` header, which is why
CORS uses only the scheme + hostname.

## iPad installation

1. Open the Pages address in Safari while online.
2. Confirm the subjects/question count loads.
3. Safari Share → **Add to Home Screen** → **Add**.
4. Launch it from the new icon.

The PWA caches only its visual shell. In Airplane Mode it can still open, but
it must show Offline and cannot obtain a new question, answer reveal, search
result, or progress write. That confirms it remains online-first.
