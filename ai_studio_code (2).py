from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from planner.models import BatchPlan, VALID_DURATIONS
from planner.serializers import (
    BatchPlanDetailSerializer,
    PreviewBatchRequestSerializer,
    GenerateScheduleRequestSerializer,
)
from planner.services.curriculum_importer import CurriculumImporter, BatchImportError
from planner.services.batch_planner import DynamicBatchPlanner


class BatchCurriculumPreviewView(APIView):
    """
    Step 1 & 2: Paste Batch URL -> Identify/Import curriculum fixture -> Preview chapters/topics
    """
    def post(self, request):
        serializer = PreviewBatchRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error_code": "INVALID_INPUT", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch_url = serializer.validated_data["batch_url"]
        try:
            curriculum = CurriculumImporter.resolve_batch_url(batch_url)
            return Response({
                "status": "success",
                "data": {
                    "batch_identifier": curriculum["batch_identifier"],
                    "curriculum_title": curriculum["curriculum_title"],
                    "target_exam": curriculum["target_exam"],
                    "source_batch_url": curriculum["source_batch_url"],
                    "total_chapters": curriculum["total_chapters"],
                    "total_topics": curriculum["total_topics"],
                    "allowed_durations": VALID_DURATIONS,
                    "chapters": curriculum["chapters"],
                }
            }, status=status.HTTP_200_OK)
        except BatchImportError as err:
            return Response({
                "status": "error",
                "error_code": err.code,
                "message": err.message,
                "details": err.details,
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)


class GenerateAndSavePlanView(APIView):
    """
    Step 3 & 4: Choose duration -> generate daily 4 slots -> save to database
    """
    def post(self, request):
        serializer = GenerateScheduleRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error_code": "VALIDATION_ERROR", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch_url = serializer.validated_data["batch_url"]
        duration = serializer.validated_data["duration_days"]
        custom_title = serializer.validated_data.get("custom_title")

        try:
            plan = DynamicBatchPlanner.save_plan(
                url=batch_url,
                duration_days=duration,
                custom_title=custom_title
            )
            out = BatchPlanDetailSerializer(plan).data
            return Response({
                "status": "success",
                "message": "Plan successfully generated and saved.",
                "plan": out
            }, status=status.HTTP_201_CREATED)
        except BatchImportError as err:
            return Response({
                "status": "error",
                "error_code": err.code,
                "message": err.message,
                "details": err.details,
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)


class ReopenPlanView(APIView):
    """
    Step 5: Reopen existing plan by UUID
    """
    def get(self, request, plan_id):
        plan = get_object_or_404(BatchPlan, id=plan_id)
        data = BatchPlanDetailSerializer(plan).data
        return Response({
            "status": "success",
            "plan": data
        }, status=status.HTTP_200_OK)