"""Serve the PWA locally at /study/.

The same files also live in ``frontend/`` for GitHub Pages. When Flask serves
this route it provides a dynamic config.js that points at the same-origin API;
when GitHub Pages serves it, the committed frontend/config.js supplies the
public external API URL instead.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from flask import Blueprint, Response, request, send_from_directory


pwa_bp = Blueprint("pwa", __name__)
PWA_DIR = Path(__file__).resolve().parents[2] / "frontend"


@pwa_bp.route("/study/")
def study_app():
    return send_from_directory(PWA_DIR, "index.html", max_age=0)


@pwa_bp.route("/study/config.js")
def study_config():
    # This contains only a public route, never a secret. It keeps local /study/
    # working without hand-editing frontend/config.js.
    configured = os.getenv("PWA_API_BASE_URL", "").strip().rstrip("/")
    api_base = configured or f"{request.url_root.rstrip('/')}/api/pwa"
    body = "window.MEDQ_CONFIG = Object.freeze({ apiBase: " + json.dumps(api_base) + " });\n"
    response = Response(body, mimetype="application/javascript")
    response.cache_control.no_cache = True
    response.cache_control.max_age = 0
    return response


@pwa_bp.route("/study/<path:asset>")
def study_assets(asset: str):
    response = send_from_directory(PWA_DIR, asset)
    if asset in {"index.html", "sw.js", "config.js"}:
        response.cache_control.no_cache = True
        response.cache_control.max_age = 0
    else:
        response.cache_control.public = True
        response.cache_control.max_age = 60 * 60 * 24 * 7
    return response
