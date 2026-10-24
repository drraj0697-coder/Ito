"""Seed a tiny, clearly labelled PWA UI smoke-test dataset.

This script neither downloads nor represents a production question bank. It
only gives a fresh Mongo database enough text-only records to verify `/study/`.
It removes/replaces only documents marked ``pwa_demo: true``.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import Collections, get_collection


DEMO = [
    ("Cardiovascular basics", "Physiology", "Which chamber of the heart normally pumps blood into the pulmonary artery?", ["Left atrium", "Right ventricle", "Left ventricle", "Right atrium"], 2, "The right ventricle ejects deoxygenated blood into the pulmonary trunk and pulmonary arteries."),
    ("Cardiovascular basics", "Physiology", "Which phase of the cardiac cycle begins immediately after closure of the atrioventricular valves?", ["Atrial systole", "Isovolumetric ventricular contraction", "Rapid ventricular filling", "Reduced ventricular ejection"], 2, "Ventricular contraction initially occurs with all valves closed, so ventricular volume does not change."),
    ("Antimicrobial principles", "Pharmacology", "Which statement best describes a bactericidal antimicrobial agent?", ["It only slows bacterial replication", "It directly kills susceptible bacteria", "It acts only against viruses", "It has no concentration-response relationship"], 2, "Bactericidal agents kill susceptible bacteria; bacteriostatic agents primarily inhibit growth."),
    ("Antimicrobial principles", "Pharmacology", "A medicine’s therapeutic index is most closely related to which concept?", ["The difference between beneficial and toxic dose ranges", "The time a dose takes to dissolve", "The colour of the formulation", "The number of daily doses"], 1, "The therapeutic index is a safety measure comparing toxic and effective doses."),
    ("Cell injury", "Pathology", "Which process is generally considered reversible when the injurious stimulus is removed early?", ["Cellular swelling", "Coagulative necrosis", "Gangrene", "Liquefactive necrosis"], 1, "Early cellular swelling is a reversible cell injury; necrosis is irreversible."),
    ("Cell injury", "Pathology", "Apoptosis is best described as:", ["Unregulated cell rupture with marked inflammation", "Programmed cell death with cellular fragmentation", "An infection caused by bacteria", "A permanent increase in cell size"], 2, "Apoptosis is regulated programmed cell death and usually causes less surrounding inflammation than necrosis."),
]


def main() -> None:
    subjects = get_collection(Collections.subjects)
    topics = get_collection(Collections.topics)
    lessons = get_collection(Collections.lessons)
    qbanks = get_collection(Collections.qbanks)
    mcqs = get_collection(Collections.mcqs)

    demo_subjects = list(subjects.find({"pwa_demo": True}, {"_id": 1}))
    demo_subject_ids = [row["_id"] for row in demo_subjects]
    demo_topics = list(topics.find({"pwa_demo": True}, {"_id": 1}))
    demo_topic_ids = [row["_id"] for row in demo_topics]
    demo_lessons = list(lessons.find({"pwa_demo": True}, {"_id": 1}))
    demo_lesson_ids = [row["_id"] for row in demo_lessons]
    mcqs.delete_many({"pwa_demo": True})
    qbanks.delete_many({"pwa_demo": True})
    lessons.delete_many({"pwa_demo": True})
    topics.delete_many({"pwa_demo": True})
    subjects.delete_many({"pwa_demo": True})

    subject_ids, topic_ids, lesson_ids, qbank_ids = {}, {}, {}, {}
    for topic_name, subject_name, *_ in DEMO:
        if subject_name not in subject_ids:
            subject_ids[subject_name] = subjects.insert_one({"name": subject_name, "name_lower": subject_name.lower(), "pwa_demo": True}).inserted_id
        key = (subject_name, topic_name)
        if key not in topic_ids:
            topic_ids[key] = topics.insert_one({"name": topic_name, "name_lower": topic_name.lower(), "subject_id": subject_ids[subject_name], "pwa_demo": True}).inserted_id
            lesson_ids[key] = lessons.insert_one({"name": topic_name, "name_lower": topic_name.lower(), "topic_id": topic_ids[key], "pwa_demo": True}).inserted_id
            qbank_ids[key] = qbanks.insert_one({"title": f"{topic_name} practice", "title_lower": f"{topic_name} practice".lower(), "lesson_id": lesson_ids[key], "pwa_demo": True}).inserted_id

    for number, (topic_name, subject_name, question, options, answer_index, explanation) in enumerate(DEMO, start=1):
        key = (subject_name, topic_name)
        mcqs.insert_one({
            "title": question, "option_1": options[0], "option_2": options[1], "option_3": options[2], "option_4": options[3],
            "answer": f"option_{answer_index}", "answer_desc": explanation, "source_id": f"pwa-demo-{number}",
            "subject_id": subject_ids[subject_name], "topic_id": topic_ids[key], "lesson_id": lesson_ids[key], "qbank_id": qbank_ids[key], "pwa_demo": True,
        })
    print("Seeded 6 clearly labelled demo questions. Run scripts/setup_pwa.py next.")


if __name__ == "__main__":
    main()
