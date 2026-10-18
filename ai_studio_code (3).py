from rest_framework import serializers
from planner.models import BatchPlan, PlanDay, PlanSlot, VALID_DURATIONS


class PlanSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanSlot
        fields = ["id", "slot_type", "slot_order", "title", "planned_tasks", "allocated_minutes"]


class PlanDaySerializer(serializers.ModelSerializer):
    slots = PlanSlotSerializer(many=True, read_only=True)

    class Meta:
        model = PlanDay
        fields = ["id", "day_number", "focus_chapter", "focus_topic", "is_buffer_or_milestone", "slots"]


class BatchPlanDetailSerializer(serializers.ModelSerializer):
    days = PlanDaySerializer(many=True, read_only=True)

    class Meta:
        model = BatchPlan
        fields = [
            "id",
            "title",
            "source_batch_url",
            "batch_identifier",
            "curriculum_title",
            "target_exam",
            "duration_days",
            "total_chapters",
            "total_topics",
            "created_at",
            "updated_at",
            "days",
        ]


class PreviewBatchRequestSerializer(serializers.Serializer):
    batch_url = serializers.URLField(required=True)


class GenerateScheduleRequestSerializer(serializers.Serializer):
    batch_url = serializers.URLField(required=True)
    duration_days = serializers.ChoiceField(choices=VALID_DURATIONS, required=True)
    custom_title = serializers.CharField(max_length=255, required=False, allow_blank=True)