import json
import os
import re
from typing import Dict, Any, Tuple, Optional
from django.conf import settings


class BatchImportError(Exception):
    def __init__(self, code: str, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


class CurriculumImporter:
    """
    Deterministic curriculum resolver with safe failure states.
    Does NOT invoke external web scraping or non-deterministic APIs.
    """
    _cached_fixtures: Optional[Dict[str, Any]] = None

    @classmethod
    def _load_fixtures(cls) -> Dict[str, Any]:
        if cls._cached_fixtures is None:
            fixture_path = os.path.join(
                os.path.dirname(__file__), "..", "fixtures", "curriculum_fixtures.json"
            )
            try:
                with open(fixture_path, "r", encoding="utf-8") as f:
                    cls._cached_fixtures = json.load(f).get("curricula", {})
            except Exception as e:
                raise BatchImportError(
                    code="FIXTURE_LOAD_FAILURE",
                    message="Failed to load curriculum fixtures.",
                    details={"internal_error": str(e)},
                )
        return cls._cached_fixtures

    @classmethod
    def resolve_batch_url(cls, raw_url: str) -> Dict[str, Any]:
        if not raw_url or not isinstance(raw_url, str):
            raise BatchImportError(
                code="INVALID_URL_EMPTY",
                message="A valid batch URL is required.",
                details={"input": raw_url},
            )

        clean_url = raw_url.strip()
        fixtures = cls._load_fixtures()

        for identifier, batch_data in fixtures.items():
            patterns = batch_data.get("allowed_url_patterns", [])
            for pattern in patterns:
                if re.match(pattern, clean_url, re.IGNORECASE):
                    # Flatten chapters and topics for deterministic validation
                    chapters = batch_data.get("chapters", [])
                    total_topics = sum(len(ch.get("topics", [])) for ch in chapters)
                    return {
                        "batch_identifier": identifier,
                        "curriculum_title": batch_data["curriculum_title"],
                        "target_exam": batch_data["target_exam"],
                        "source_batch_url": clean_url,
                        "chapters": chapters,
                        "total_chapters": len(chapters),
                        "total_topics": total_topics,
                    }

        # Safe Failure State
        raise BatchImportError(
            code="UNSUPPORTED_BATCH_URL",
            message="The provided batch URL does not match any recognized curriculum fixture.",
            details={
                "provided_url": clean_url,
                "supported_formats": [
                    "https://academy.test/batches/jee-phys-mechanics-2026",
                    "https://institutes.test/portal/p/jee-phys-mechanics-2026",
                    "https://academy.test/batches/neet-bio-genetics-2026",
                ],
            },
        )