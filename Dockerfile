# The server image. The GitHub Pages frontend is deliberately static and is
# deployed separately by .github/workflows/deploy-pages.yml.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5001 \
    FLASK_DEBUG=false

WORKDIR /app
RUN pip install --no-cache-dir "uv>=0.8"

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .
RUN chmod +x scripts/start_server.sh

EXPOSE 5001
CMD ["./scripts/start_server.sh"]
