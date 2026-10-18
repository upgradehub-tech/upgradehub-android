import uuid
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from planner.models import BatchPlan, PlanDay, PlanSlot, VALID_DURATIONS
from planner.services.curriculum_importer import CurriculumImporter, BatchImportError
from planner.services.batch_planner import DynamicBatchPlanner


class DynamicBatchPlannerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.valid_jee_url = "https://academy.test/batches/jee-phys-mechanics-2026"
        self.valid_neet_url = "https://academy.test/batches/neet-bio-genetics-2026"
        self.invalid_url = "https://random-unknown-site.org/course/123"
        self.malformed_url = "not-a-url"

    def test_importer_resolves_valid_jee_url(self):
        curriculum = CurriculumImporter.resolve_batch_url(self.valid_jee_url)
        self.assertEqual(curriculum["batch_identifier"], "jee-phys-mechanics-2026")
        self.assertEqual(curriculum["total_chapters"], 4)
        self.assertEqual(curriculum["total_topics"], 13)

    def test_importer_resolves_valid_neet_url(self):
        curriculum = CurriculumImporter.resolve_batch_url(self.valid_neet_url)
        self.assertEqual(curriculum["batch_identifier"], "neet-bio-genetics-2026")
        self.assertEqual(curriculum["total_chapters"], 2)
        self.assertEqual(curriculum["total_topics"], 8)

    def test_importer_safe_failure_state_for_unknown_batch_url(self):
        with self.assertRaises(BatchImportError) as ctx:
            CurriculumImporter.resolve_batch_url(self.invalid_url)
        self.assertEqual(ctx.exception.code, "UNSUPPORTED_BATCH_URL")
        self.assertIn("supported_formats", ctx.exception.details)

    def test_plan_generation_all_allowed_durations(self):
        for duration in VALID_DURATIONS:
            curriculum = CurriculumImporter.resolve_batch_url(self.valid_jee_url)
            days = DynamicBatchPlanner.generate_plan_structure(curriculum, duration)
            self.assertEqual(len(days), duration, f"Day count must match duration {duration}")
            for day in days:
                self.assertEqual(len(day["slots"]), 4, "Every single day must contain exactly 4 slots")
                slot_types = [s["slot_type"] for s in day["slots"]]
                self.assertEqual(
                    slot_types,
                    ["concept_clearing", "problem_drill", "revision", "mistake_analysis"],
                    "Slot order and slot types must match exactly."
                )

    def test_invalid_duration_rejected(self):
        with self.assertRaises(BatchImportError) as ctx:
            DynamicBatchPlanner.validate_duration(100)  # 100 is not in [30, 45, 60, 75, 90, 120, 150]
        self.assertEqual(ctx.exception.code, "INVALID_DURATION")

    def test_api_preview_success(self):
        url = reverse("batch-planner-preview")
        response = self.client.post(url, {"batch_url": self.valid_jee_url}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["data"]["batch_identifier"], "jee-phys-mechanics-2026")
        self.assertEqual(len(response.data["data"]["chapters"]), 4)

    def test_api_preview_safe_failure(self):
        url = reverse("batch-planner-preview")
        response = self.client.post(url, {"batch_url": self.invalid_url}, format="json")
        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data["error_code"], "UNSUPPORTED_BATCH_URL")
        self.assertIn("supported_formats", response.data["details"])

    def test_api_generate_and_reopen_plan_lifecycle(self):
        gen_url = reverse("batch-planner-generate")
        payload = {
            "batch_url": self.valid_jee_url,
            "duration_days": 45,
            "custom_title": "Mechanics Sprint 45"
        }
        gen_response = self.client.post(gen_url, payload, format="json")
        self.assertEqual(gen_response.status_code, status.HTTP_201_CREATED)

        plan_id = gen_response.data["plan"]["id"]
        self.assertTrue(uuid.UUID(plan_id))
        self.assertEqual(len(gen_response.data["plan"]["days"]), 45)

        # Reopen Plan by ID
        reopen_url = reverse("batch-planner-reopen", kwargs={"plan_id": plan_id})
        reopen_response = self.client.get(reopen_url)
        self.assertEqual(reopen_response.status_code, status.HTTP_200_OK)
        reopened_data = reopen_response.data["plan"]
        self.assertEqual(reopened_data["id"], plan_id)
        self.assertEqual(reopened_data["duration_days"], 45)
        self.assertEqual(len(reopened_data["days"]), 45)

        # Verify Day 1 slots persistence
        day_1 = reopened_data["days"][0]
        self.assertEqual(day_1["day_number"], 1)
        self.assertEqual(len(day_1["slots"]), 4)
        self.assertEqual(day_1["slots"][0]["slot_type"], "concept_clearing")
        self.assertEqual(day_1["slots"][1]["slot_type"], "problem_drill")
        self.assertEqual(day_1["slots"][2]["slot_type"], "revision")
        self.assertEqual(day_1["slots"][3]["slot_type"], "mistake_analysis")

    def test_reopen_nonexistent_plan_returns_404(self):
        random_id = uuid.uuid4()
        reopen_url = reverse("batch-planner-reopen", kwargs={"plan_id": random_id})
        response = self.client.get(reopen_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)