import os

from flask import Flask
from flask_cors import CORS

from app.routes import register_blueprints
from app.config import settings


def create_app() -> Flask:
    app = Flask(__name__)
    # Required by Flask's flash() / session machinery. POC-only; rotate
    # for any real deployment via the FLASK_SECRET_KEY env var.
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-not-for-prod")
    # Cap uploads at 10 MB per request — covers reasonably large note pages.
    app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
    # The installed PWA is same-origin. For a separately hosted frontend,
    # set CORS_ORIGINS to its exact comma-separated HTTPS origin(s); do not use *.
    CORS(app, resources={r"/api/*": {"origins": list(settings.cors_origins)}})
    register_blueprints(app)
    return app
