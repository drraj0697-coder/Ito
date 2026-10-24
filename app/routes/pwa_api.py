"""Small, mobile-oriented API for the online-first PWA.

This blueprint reads the existing Marrow-ITO Mongo schema. It does not bundle
or serve a local question dump to the browser: only the currently requested
subject/topic/test payload is returned.
"""
from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from flask import Blueprint, jsonify, request
from pymongo import ASCENDING, DESCENDING

from app.db import Collections, get_collection, get_db


pwa_api_bp = Blueprint("pwa_api", __name__, url_prefix="/api/pwa")

MAX_PAGE_SIZE = 100
MAX_QUERY_LENGTH = 100
DEVICE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{16,80}$")


def _string_id(value: Any) -> str:
    return str(value) if value is not None else ""


def _as_object_id(value: str | None) -> ObjectId | None:
    if not value or not ObjectId.is_valid(value):
        return None
    return ObjectId(value)


def _integer(value: str | None, default: int, minimum: int, maximum: int) -> int:
    try:
        candidate = int(value or default)
    except (TypeError, ValueError):
        candidate = default
    return max(minimum, min(maximum, candidate))


def _display_mcq(doc: dict[str, Any], include_answer: bool = True) -> dict[str, Any]:
    """Return only fields the PWA needs; avoid leaking DB/internal fields."""
    item = {
        "id": _string_id(doc.get("_id")),
        "source_id": str(doc.get("source_id") or ""),
        "question": doc.get("title", ""),
        "options": [
            doc.get("option_1", ""),
            doc.get("option_2", ""),
            doc.get("option_3", ""),
            doc.get("option_4", ""),
        ],
        "subject_id": _string_id(doc.get("subject_id")),
        "topic_id": _string_id(doc.get("topic_id")),
        "lesson_id": _string_id(doc.get("lesson_id")),
    }
    if include_answer:
        item["answer"] = doc.get("answer", "")
        item["explanation"] = doc.get("answer_desc", "")
    return item


def _safe_device_id(value: Any) -> str | None:
    value = str(value or "")
    return value if DEVICE_ID_RE.fullmatch(value) else None


def _collection_exists(name: str) -> bool:
    return name in get_db().list_collection_names()


@pwa_api_bp.get("/health")
def health() -> Any:
    db = get_db()
    try:
        db.command("ping")
        ready = True
    except Exception:  # pragma: no cover - database runtime safety
        ready = False
    return jsonify({
        "ok": ready,
        "online_first": True,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }), (200 if ready else 503)


@pwa_api_bp.get("/bootstrap")
def bootstrap() -> Any:
    """A compact initial payload: summary cards, not all questions."""
    subjects = get_collection(Collections.subjects)
    mcqs = get_collection(Collections.mcqs)
    counts = {
        row["_id"]: row["count"]
        for row in mcqs.aggregate([
            {"$group": {"_id": "$subject_id", "count": {"$sum": 1}}}
        ])
        if row.get("_id") is not None
    }
    payload = []
    for subject in subjects.find({}, {"name": 1, "name_lower": 1}).sort("name_lower", ASCENDING):
        payload.append({
            "id": _string_id(subject["_id"]),
            "name": subject.get("name", "Untitled"),
            "question_count": int(counts.get(subject["_id"], 0)),
        })
    return jsonify({
        "subjects": payload,
        "question_total": int(mcqs.count_documents({})),
        "cache_policy": "Question and explanation data is online-only.",
    })


@pwa_api_bp.get("/subjects/<subject_id>/topics")
def topics(subject_id: str) -> Any:
    subject_oid = _as_object_id(subject_id)
    if subject_oid is None:
        return jsonify({"error": "Invalid subject id."}), 400
    topic_coll = get_collection(Collections.topics)
    mcq_coll = get_collection(Collections.mcqs)
    if not get_collection(Collections.subjects).find_one({"_id": subject_oid}, {"_id": 1}):
        return jsonify({"error": "Subject not found."}), 404
    counts = {
        row["_id"]: row["count"]
        for row in mcq_coll.aggregate([
            {"$match": {"subject_id": subject_oid}},
            {"$group": {"_id": "$topic_id", "count": {"$sum": 1}}},
        ])
        if row.get("_id") is not None
    }
    payload = [
        {
            "id": _string_id(topic["_id"]),
            "name": topic.get("name", "Untitled"),
            "question_count": int(counts.get(topic["_id"], 0)),
        }
        for topic in topic_coll.find({"subject_id": subject_oid}, {"name": 1, "name_lower": 1}).sort("name_lower", ASCENDING)
    ]
    return jsonify({"topics": payload})


@pwa_api_bp.get("/questions")
def questions() -> Any:
    """Return a small online practice batch. No data is preloaded globally."""
    subject_oid = _as_object_id(request.args.get("subject_id"))
    topic_oid = _as_object_id(request.args.get("topic_id"))
    count = _integer(request.args.get("count"), 10, 1, MAX_PAGE_SIZE)
    if request.args.get("subject_id") and subject_oid is None:
        return jsonify({"error": "Invalid subject id."}), 400
    if request.args.get("topic_id") and topic_oid is None:
        return jsonify({"error": "Invalid topic id."}), 400

    filters: dict[str, Any] = {}
    if subject_oid is not None:
        filters["subject_id"] = subject_oid
    if topic_oid is not None:
        filters["topic_id"] = topic_oid
    cursor = get_collection(Collections.mcqs).aggregate([
        {"$match": filters},
        {"$sample": {"size": count}},
        {"$project": {
            "title": 1, "option_1": 1, "option_2": 1, "option_3": 1, "option_4": 1,
            "answer": 1, "answer_desc": 1, "source_id": 1,
            "subject_id": 1, "topic_id": 1, "lesson_id": 1,
        }},
    ])
    # Answers/explanations are deliberately excluded from the initial batch.
    # The app asks for a reveal only after the learner selects an option.
    items = [_display_mcq(doc, include_answer=False) for doc in cursor]
    return jsonify({
        "questions": items,
        "returned": len(items),
        "requested": count,
        "online_only": True,
    })


@pwa_api_bp.get("/search")
def search_questions() -> Any:
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"results": []})
    if len(query) > MAX_QUERY_LENGTH:
        return jsonify({"error": f"Search is limited to {MAX_QUERY_LENGTH} characters."}), 400
    # A normal Mongo text index is created by scripts/setup_pwa.py. Regex
    # fallback makes the endpoint usable before the index is created.
    mcqs = get_collection(Collections.mcqs)
    limit = _integer(request.args.get("limit"), 15, 1, 30)
    try:
        docs = list(mcqs.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}, "title": 1, "subject_id": 1, "topic_id": 1},
        ).sort([( "score", {"$meta": "textScore"})]).limit(limit))
    except Exception:
        pattern = re.escape(query)
        docs = list(mcqs.find(
            {"title": {"$regex": pattern, "$options": "i"}},
            {"title": 1, "subject_id": 1, "topic_id": 1},
        ).limit(limit))
    return jsonify({
        "results": [
            {"id": _string_id(row["_id"]), "question": row.get("title", ""),
             "subject_id": _string_id(row.get("subject_id")),
             "topic_id": _string_id(row.get("topic_id"))}
            for row in docs
        ]
    })


@pwa_api_bp.get("/questions/<question_id>")
def question_detail(question_id: str) -> Any:
    question_oid = _as_object_id(question_id)
    if question_oid is None:
        return jsonify({"error": "Invalid question id."}), 400
    doc = get_collection(Collections.mcqs).find_one({"_id": question_oid})
    if doc is None:
        return jsonify({"error": "Question not found."}), 404
    return jsonify({"question": _display_mcq(doc, include_answer=False)})


@pwa_api_bp.get("/questions/<question_id>/reveal")
def question_reveal(question_id: str) -> Any:
    """Reveal just one answer/explanation after a learner answers online."""
    question_oid = _as_object_id(question_id)
    if question_oid is None:
        return jsonify({"error": "Invalid question id."}), 400
    doc = get_collection(Collections.mcqs).find_one(
        {"_id": question_oid}, {"answer": 1, "answer_desc": 1}
    )
    if doc is None:
        return jsonify({"error": "Question not found."}), 404
    return jsonify({
        "id": _string_id(doc["_id"]),
        "answer": doc.get("answer", ""),
        "explanation": doc.get("answer_desc", ""),
    })


@pwa_api_bp.post("/progress")
def save_progress() -> Any:
    """Store lightweight attempt summaries per anonymous installation id.

    It intentionally does not use the browser cache as the source of truth.
    Add real account authentication before offering cross-device sync.
    """
    body = request.get_json(silent=True) or {}
    device_id = _safe_device_id(body.get("device_id"))
    if not device_id:
        return jsonify({"error": "A valid device id is required."}), 400
    question_id = _as_object_id(body.get("question_id"))
    if question_id is None:
        return jsonify({"error": "A valid question id is required."}), 400
    selected = body.get("selected")
    if selected not in {"option_1", "option_2", "option_3", "option_4"}:
        return jsonify({"error": "Invalid selected option."}), 400
    mcq = get_collection(Collections.mcqs).find_one({"_id": question_id}, {"answer": 1})
    if mcq is None:
        return jsonify({"error": "Question not found."}), 404
    # Never trust a client-supplied score; the server derives correctness.
    correct = selected == mcq.get("answer")
    get_collection(Collections.study_progress).update_one(
        {"device_id": device_id, "question_id": question_id},
        {"$set": {
            "device_id": device_id,
            "question_id": question_id,
            "selected": selected,
            "correct": correct,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return jsonify({"saved": True})


@pwa_api_bp.get("/progress")
def read_progress() -> Any:
    device_id = _safe_device_id(request.args.get("device_id"))
    if not device_id:
        return jsonify({"error": "A valid device id is required."}), 400
    docs = list(get_collection(Collections.study_progress).find(
        {"device_id": device_id}, {"question_id": 1, "correct": 1, "updated_at": 1}
    ).sort("updated_at", DESCENDING).limit(1000))
    return jsonify({
        "attempts": [
            {"question_id": _string_id(row["question_id"]), "correct": bool(row.get("correct")),
             "updated_at": row.get("updated_at").isoformat() if row.get("updated_at") else None}
            for row in docs
        ],
        "count": len(docs),
    })
