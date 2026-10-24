"""Create the indexes used by the online-first PWA.

Run this once after data ingestion and whenever the database is rebuilt:
    uv run python scripts/setup_pwa.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo import ASCENDING, TEXT

from app.db import Collections, get_collection


def main() -> None:
    mcqs = get_collection(Collections.mcqs)
    progress = get_collection(Collections.study_progress)

    # Supports the browser's live text-search endpoint. The language override
    # avoids requiring an undocumented field on imported MedMCQA records.
    mcqs.create_index([( "title", TEXT), ("answer_desc", TEXT)], name="pwa_question_text")
    mcqs.create_index([("subject_id", ASCENDING), ("topic_id", ASCENDING)], name="pwa_subject_topic")
    progress.create_index([("device_id", ASCENDING), ("question_id", ASCENDING)], unique=True, name="pwa_device_question")
    progress.create_index([("device_id", ASCENDING), ("updated_at", ASCENDING)], name="pwa_device_updated")
    print("PWA indexes are ready.")


if __name__ == "__main__":
    main()
