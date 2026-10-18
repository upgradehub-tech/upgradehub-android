from django.urls import path
from planner.views import (
    BatchCurriculumPreviewView,
    GenerateAndSavePlanView,
    ReopenPlanView
)

urlpatterns = [
    path("api/planner/preview/", BatchCurriculumPreviewView.as_view(), name="batch-planner-preview"),
    path("api/planner/generate/", GenerateAndSavePlanView.as_view(), name="batch-planner-generate"),
    path("api/planner/plans/<uuid:plan_id>/", ReopenPlanView.as_view(), name="batch-planner-reopen"),
]