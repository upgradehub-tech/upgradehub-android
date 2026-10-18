import math
from typing import List, Dict, Any
from planner.models import BatchPlan, PlanDay, PlanSlot, VALID_DURATIONS
from planner.services.curriculum_importer import CurriculumImporter, BatchImportError


class DynamicBatchPlanner:
    """
    Allocates curriculum topics across selected duration (30/45/60/75/90/120/150)
    generating strict 4 slots per day:
      1. Concept Clearing
      2. Problem Drill
      3. Revision
      4. Mistake Analysis
    """

    @staticmethod
    def validate_duration(duration_days: int):
        if duration_days not in VALID_DURATIONS:
            raise BatchImportError(
                code="INVALID_DURATION",
                message=f"Duration {duration_days} is invalid. Choose one of {VALID_DURATIONS}.",
                details={"valid_options": VALID_DURATIONS},
            )

    @classmethod
    def generate_plan_structure(cls, curriculum_data: Dict[str, Any], duration_days: int) -> List[Dict[str, Any]]:
        cls.validate_duration(duration_days)

        flattened_topics = []
        for chapter in curriculum_data["chapters"]:
            ch_name = chapter["chapter_name"]
            for topic in chapter["topics"]:
                flattened_topics.append({
                    "chapter": ch_name,
                    "topic": topic
                })

        num_topics = len(flattened_topics)
        days_schedule = []

        # Buffer / Milestone days reserved every 10th day
        milestone_intervals = [d for d in range(10, duration_days + 1, 10)]

        topic_idx = 0
        cleared_topics_history = []

        for current_day in range(1, duration_days + 1):
            is_milestone = current_day in milestone_intervals

            if is_milestone:
                focus_ch = "Checkpoint Assessment"
                focus_tp = f"Milestone Review & Comprehensive Testing (Day {current_day})"
                slots = [
                    {
                        "slot_type": "concept_clearing",
                        "slot_order": 1,
                        "title": f"Milestone Core Summary - Days {current_day - 9} to {current_day - 1}",
                        "allocated_minutes": 60,
                        "planned_tasks": [
                            "Audit high-weightage formulas and reaction mechanisms",
                            "Review consolidated cheat-sheets and boundary conditions"
                        ]
                    },
                    {
                        "slot_type": "problem_drill",
                        "slot_order": 2,
                        "title": "Comprehensive Milestone Timed Drill",
                        "allocated_minutes": 90,
                        "planned_tasks": [
                            "Solve 25 mixed timed questions covering the last 9 study days",
                            "Log time taken per question and negative markings"
                        ]
                    },
                    {
                        "slot_type": "revision",
                        "slot_order": 3,
                        "title": "Cumulative Cross-Chapter Linking",
                        "allocated_minutes": 60,
                        "planned_tasks": [
                            "Re-solve flagged starred problems from prior chapters",
                            "Re-read key NCERT/Standard Reference notes"
                        ]
                    },
                    {
                        "slot_type": "mistake_analysis",
                        "slot_order": 4,
                        "title": "Milestone Test Error Root-Cause Log",
                        "allocated_minutes": 60,
                        "planned_tasks": [
                            "Classify errors: Conceptual, Calculation, or Reading trap",
                            "Update Error Logbook with corrected problem steps"
                        ]
                    }
                ]
            else:
                active_item = flattened_topics[topic_idx % num_topics]
                topic_idx += 1
                cleared_topics_history.append(active_item)

                focus_ch = active_item["chapter"]
                focus_tp = active_item["topic"]

                # Determine Spaced Repetition Revision Target:
                # Cycle through topics completed previously (at least 2 days prior if available)
                if len(cleared_topics_history) > 2:
                    rev_target = cleared_topics_history[-3]
                else:
                    rev_target = active_item

                slots = [
                    {
                        "slot_type": "concept_clearing",
                        "slot_order": 1,
                        "title": f"Concept Clearing: {focus_tp}",
                        "allocated_minutes": 75,
                        "planned_tasks": [
                            f"Study theoretical definitions and derivations for {focus_tp}",
                            f"Analyze 3 core textbook solved examples from {focus_ch}",
                            "Synthesize summary notes & formula flashcards"
                        ]
                    },
                    {
                        "slot_type": "problem_drill",
                        "slot_order": 2,
                        "title": f"Problem Drill: {focus_tp}",
                        "allocated_minutes": 90,
                        "planned_tasks": [
                            f"Attempt 15 targeted level-1 single-concept problems",
                            f"Attempt 10 targeted level-2 multi-concept problems from {focus_ch}",
                            "Mark unsolved or time-exceeded questions for analysis"
                        ]
                    },
                    {
                        "slot_type": "revision",
                        "slot_order": 3,
                        "title": f"Active Recall Revision: {rev_target['topic']}",
                        "allocated_minutes": 45,
                        "planned_tasks": [
                            f"Rapid retrieval test on {rev_target['topic']} without notes",
                            f"Re-solve 5 high-yield benchmark questions from {rev_target['chapter']}"
                        ]
                    },
                    {
                        "slot_type": "mistake_analysis",
                        "slot_order": 4,
                        "title": f"Mistake Analysis & Error Ledger: {focus_tp}",
                        "allocated_minutes": 45,
                        "planned_tasks": [
                            "Deconstruct failed problem drill attempts from Slot 2",
                            "Isolate blind spots, unit errors, and conceptual gaps",
                            "Draft actionable 'Next-Attempt' rules in the error journal"
                        ]
                    }
                ]

            days_schedule.append({
                "day_number": current_day,
                "focus_chapter": focus_ch,
                "focus_topic": focus_tp,
                "is_buffer_or_milestone": is_milestone,
                "slots": slots
            })

        return days_schedule

    @classmethod
    def save_plan(cls, url: str, duration_days: int, custom_title: Optional[str] = None) -> BatchPlan:
        curriculum = CurriculumImporter.resolve_batch_url(url)
        cls.validate_duration(duration_days)

        title = custom_title or f"{curriculum['curriculum_title']} - {duration_days} Day Master Plan"
        days_payload = cls.generate_plan_structure(curriculum, duration_days)

        plan = BatchPlan.objects.create(
            title=title,
            source_batch_url=curriculum["source_batch_url"],
            batch_identifier=curriculum["batch_identifier"],
            curriculum_title=curriculum["curriculum_title"],
            target_exam=curriculum["target_exam"],
            duration_days=duration_days,
            total_chapters=curriculum["total_chapters"],
            total_topics=curriculum["total_topics"]
        )

        plan_days = []
        plan_slots = []

        for d in days_payload:
            day_obj = PlanDay(
                plan=plan,
                day_number=d["day_number"],
                focus_chapter=d["focus_chapter"],
                focus_topic=d["focus_topic"],
                is_buffer_or_milestone=d["is_buffer_or_milestone"]
            )
            plan_days.append(day_obj)

        PlanDay.objects.bulk_create(plan_days)

        # Map saved days to bulk-create slots
        persisted_days = {p_day.day_number: p_day for p_day in plan.days.all()}
        for d in days_payload:
            day_instance = persisted_days[d["day_number"]]
            for s in d["slots"]:
                plan_slots.append(
                    PlanSlot(
                        day=day_instance,
                        slot_type=s["slot_type"],
                        slot_order=s["slot_order"],
                        title=s["title"],
                        planned_tasks=s["planned_tasks"],
                        allocated_minutes=s["allocated_minutes"]
                    )
                )

        PlanSlot.objects.bulk_create(plan_slots)
        return plan