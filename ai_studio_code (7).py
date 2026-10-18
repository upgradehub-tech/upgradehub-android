import uuid
from django.db import models
from django.core.exceptions import ValidationError

VALID_DURATIONS = [30, 45, 60, 75, 90, 120, 150]


class BatchPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    source_batch_url = models.URLField(max_length=1000)
    batch_identifier = models.CharField(max_length=128, db_index=True)
    curriculum_title = models.CharField(max_length=255)
    target_exam = models.CharField(max_length=100)
    duration_days = models.IntegerField(choices=[(d, f"{d} Days") for d in VALID_DURATIONS])
    total_chapters = models.PositiveIntegerField(default=0)
    total_topics = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.duration_days not in VALID_DURATIONS:
            raise ValidationError(
                f"Invalid duration {self.duration_days}. Must be one of {VALID_DURATIONS}."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.duration_days} Days) - {self.batch_identifier}"


class PlanDay(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(BatchPlan, related_name="days", on_delete=models.CASCADE)
    day_number = models.PositiveIntegerField()
    focus_chapter = models.CharField(max_length=255)
    focus_topic = models.CharField(max_length=255)
    is_buffer_or_milestone = models.BooleanField(default=False)

    class Meta:
        ordering = ["day_number"]
        unique_together = ("plan", "day_number")

    def __str__(self):
        return f"Day {self.day_number}: {self.focus_topic} ({self.plan.title})"


class PlanSlot(models.Model):
    SLOT_CHOICES = [
        ("concept_clearing", "Concept Clearing"),
        ("problem_drill", "Problem Drill"),
        ("revision", "Revision"),
        ("mistake_analysis", "Mistake Analysis"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.ForeignKey(PlanDay, related_name="slots", on_delete=models.CASCADE)
    slot_type = models.CharField(max_length=32, choices=SLOT_CHOICES)
    slot_order = models.PositiveSmallIntegerField()  # 1, 2, 3, 4
    title = models.CharField(max_length=255)
    planned_tasks = models.JSONField(default=list)  # list of strings
    allocated_minutes = models.PositiveIntegerField(default=60)

    class Meta:
        ordering = ["slot_order"]
        unique_together = ("day", "slot_order")

    def __str__(self):
        return f"Slot {self.slot_order} [{self.get_slot_type_display()}] - Day {self.day.day_number}"