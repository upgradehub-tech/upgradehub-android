import { describe, it, expect, beforeEach, vi } from "vitest";
import { StepType, StepStatus } from "@prisma/client";
import {
  ChapterTrackerStateMachine,
  STEP_ORDER,
} from "../src/services/chapter-tracker.state-machine";
import { ChapterTrackerService } from "../src/services/chapter-tracker.service";

describe("ChapterTrackerStateMachine - Transition Guard Unit Tests", () => {
  it("should enforce sequential next-step logic", () => {
    expect(ChapterTrackerStateMachine.getNextStep(StepType.LECTURE_TRACKING)).toBe(
      StepType.THEORY_NOTES
    );
    expect(ChapterTrackerStateMachine.getNextStep(StepType.CBT_UNIT_TEST)).toBeNull();
  });

  it("should fail LECTURE_TRACKING validation if lectures are missing", () => {
    const result = ChapterTrackerStateMachine.validateStepCompletion(
      StepType.LECTURE_TRACKING,
      {
        totalLectures: 5,
        completedLectureIndices: [1, 2, 3], // missing 4, 5
      }
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("All lectures must be completed");
  });

  it("should pass LECTURE_TRACKING when all lecture indices are covered", () => {
    const result = ChapterTrackerStateMachine.validateStepCompletion(
      StepType.LECTURE_TRACKING,
      {
        totalLectures: 3,
        completedLectureIndices: [1, 2, 3],
      }
    );
    expect(result.valid).toBe(true);
    expect(result.stepScorePct).toBe(100);
  });

  it("should fail NCERT_LINE_BY_LINE if reaction exceptions or graphs are unverified", () => {
    const result = ChapterTrackerStateMachine.validateStepCompletion(
      StepType.NCERT_LINE_BY_LINE,
      {
        completedDrillIds: ["d1", "d2"],
        totalDrillIds: ["d1", "d2"],
        verifiedTableIds: ["t1"],
        totalTableIds: ["t1"],
        verifiedGraphIds: [], // Empty
        totalGraphIds: ["g1"],
        verifiedExceptionIds: ["e1"],
        totalExceptionIds: ["e1"],
      }
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("NCERT Graphs and inflection points must be analyzed");
  });

  it("should reject LEVEL_1_PYQS if accuracy is below 60%", () => {
    const result = ChapterTrackerStateMachine.validateStepCompletion(StepType.LEVEL_1_PYQS, {
      pyqsAttempted: 20,
      pyqsTarget: 20,
      correctCount: 11, // 55% accuracy
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("must be at least 60%");
  });

  it("should reject FORMULA_RECALL if score is below 80%", () => {
    const result = ChapterTrackerStateMachine.validateStepCompletion(StepType.FORMULA_RECALL, {
      scorePct: 75,
      promptsTested: 20,
      promptsCorrect: 15,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("requires >= 80% accuracy");
  });

  it("should calculate progressive weighted progress accurately", () => {
    const mockStates = STEP_ORDER.map((step, idx) => ({
      step,
      status: idx < 3 ? StepStatus.COMPLETED : StepStatus.LOCKED,
    }));

    // Step 1 (10) + Step 2 (10) + Step 3 (15) = 35%
    const progress = ChapterTrackerStateMachine.calculateOverallProgress(mockStates);
    expect(progress).toBe(35.0);
  });
});

describe("ChapterTrackerService - Integration Workflow", () => {
  let mockPrisma: any;
  let service: ChapterTrackerService;

  beforeEach(() => {
    mockPrisma = {
      chapter: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "chap-1", title: "Aldehydes" }),
      },
      chapterTracker: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      chapterStepState: {
        createMany: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      lectureLog: {
        upsert: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };
    service = new ChapterTrackerService(mockPrisma);
  });

  it("should block step completion when user attempts to skip ahead", async () => {
    mockPrisma.chapterTracker.findUniqueOrThrow.mockResolvedValue({
      id: "trk-123",
      currentStep: StepType.LECTURE_TRACKING,
      stepStates: [{ step: StepType.CBT_UNIT_TEST, status: StepStatus.LOCKED }],
    });

    await expect(
      service.completeStep("trk-123", StepType.CBT_UNIT_TEST, {
        testSubmissionId: "sub-1",
        marksObtained: 90,
        totalMarks: 100,
        accuracyPct: 90,
        passed: true,
      })
    ).rejects.toThrow("Illegal transition: Tracker is currently at LECTURE_TRACKING, not CBT_UNIT_TEST");
  });

  it("should advance state, unlock next step, and update progress on valid completion", async () => {
    mockPrisma.chapterTracker.findUniqueOrThrow.mockResolvedValue({
      id: "trk-123",
      currentStep: StepType.LECTURE_TRACKING,
      stepStates: [
        { step: StepType.LECTURE_TRACKING, status: StepStatus.AVAILABLE },
        { step: StepType.THEORY_NOTES, status: StepStatus.LOCKED },
      ],
    });

    mockPrisma.chapterStepState.findMany.mockResolvedValue([
      { step: StepType.LECTURE_TRACKING, status: StepStatus.COMPLETED, scorePct: 100 },
      { step: StepType.THEORY_NOTES, status: StepStatus.AVAILABLE, scorePct: null },
    ]);

    await service.completeStep("trk-123", StepType.LECTURE_TRACKING, {
      totalLectures: 2,
      completedLectureIndices: [1, 2],
    });

    expect(mockPrisma.chapterStepState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trackerId_step: { trackerId: "trk-123", step: StepType.LECTURE_TRACKING } },
        data: expect.objectContaining({ status: StepStatus.COMPLETED }),
      })
    );

    expect(mockPrisma.chapterStepState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trackerId_step: { trackerId: "trk-123", step: StepType.THEORY_NOTES } },
        data: { status: StepStatus.AVAILABLE },
      })
    );
  });
});