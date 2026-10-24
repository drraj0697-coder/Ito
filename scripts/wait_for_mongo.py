"""Wait briefly for MongoDB before starting the container web process."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import get_db


for attempt in range(1, 31):
    try:
        get_db().command("ping")
        print("MongoDB is ready.")
        raise SystemExit(0)
    except Exception as exc:  # pragma: no cover - deployment runtime
        if attempt == 30:
            print(f"MongoDB was not reachable after 30 attempts: {exc}", file=sys.stderr)
            raise SystemExit(1)
        print(f"Waiting for MongoDB ({attempt}/30)…")
        time.sleep(2)
