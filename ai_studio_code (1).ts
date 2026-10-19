import { PrismaClient, StepType, StepStatus } from "@prisma/client";
import {
  ChapterTrackerStateMachine,
  STEP_ORDER,
  StepPayloadMap,
} from "./chapter-tracker.state-machine";

export class ChapterTrackerService {
  constructor(private prisma: PrismaClient) {}

  public async initializeChapterTracker(userId: string, chapterId: string) {
    const chapter = await this.prisma.chapter.findUniqueOrThrow({
      where: { id: chapterId },
      include: { topics: true },
    });

    return this.prisma.$transaction(async (tx) => {
      let tracker = await tx.chapterTracker.findUnique({
        where: { userId_chapterId: { userId, chapterId } },
      });

      if (!tracker) {
        tracker = await tx.chapterTracker.create({
          data: {
            userId,
            chapterId,
            currentStep: StepType.LECTURE_TRACKING,
            overallProgressPct: 0.0,
            masteryScore: 0.0,
          },
        });

        // Initialize all 9 steps: first step AVAILABLE, subsequent LOCKED
        const stepRecords = STEP_ORDER.map((step, index) => ({
          trackerId: tracker.id,
          step,
          status: index === 0 ? StepStatus.AVAILABLE : StepStatus.LOCKED,
          scorePct: null,
          metadata: {},
        }));

        await tx.chapterStepState.createMany({ data: stepRecords });
      }

      return tracker;
    });
  }

  public async completeStep<K extends StepType>(
    trackerId: string,
    step: K,
    payload: StepPayloadMap[K]
  ) {
    const tracker = await this.prisma.chapterTracker.findUniqueOrThrow({
      where: { id: trackerId },
      include: { stepStates: true },
    });

    if (tracker.currentStep !== step) {
      throw new Error(`Illegal transition: Tracker is currently at ${tracker.currentStep}, not ${step}`);
    }

    const stepState = tracker.stepStates.find((s) => s.step === step);
    if (!stepState || stepState.status === StepStatus.LOCKED) {
      throw new Error(`Step ${step} is currently locked`);
    }

    // Run business validation rules
    const validation = ChapterTrackerStateMachine.validateStepCompletion(step, payload);
    if (!validation.valid) {
      throw new Error(`Validation failed for step ${step}: ${validation.reason}`);
    }

    const nextStep = ChapterTrackerStateMachine.getNextStep(step);

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark current step COMPLETED
      await tx.chapterStepState.update({
        where: { trackerId_step: { trackerId, step } },
        data: {
          status: StepStatus.COMPLETED,
          scorePct: validation.stepScorePct ?? 100,
          metadata: payload as object,
          completedAt: new Date(),
        },
      });

      // 2. Unlock next step if exists
      if (nextStep) {
        await tx.chapterStepState.update({
          where: { trackerId_step: { trackerId, step: nextStep } },
          data: { status: StepStatus.AVAILABLE },
        });

        await tx.chapterTracker.update({
          where: { id: trackerId },
          data: { currentStep: nextStep },
        });
      } else {
        // Final unit test passed -> Chapter is mastered
        await tx.chapterTracker.update({
          where: { id: trackerId },
          data: { isMastered: true },
        });
      }

      // 3. Recalculate overall progress and mastery
      const allStates = await tx.chapterStepState.findMany({ where: { trackerId } });
      const overallProgress = ChapterTrackerStateMachine.calculateOverallProgress(allStates);
      const masteryScore = ChapterTrackerStateMachine.calculateMasteryScore(allStates);

      return tx.chapterTracker.update({
        where: { id: trackerId },
        data: {
          overallProgressPct: overallProgress,
          masteryScore: masteryScore,
        },
        include: { stepStates: true },
      });
    });
  }

  public async logLectureProgress(
    trackerId: string,
    lectureIndex: number,
    watchedMinutes: number,
    durationMinutes: number,
    title: string,
    externalRefCode?: string
  ) {
    const isCompleted = watchedMinutes >= durationMinutes;

    return this.prisma.lectureLog.upsert({
      where: {
        trackerId_lectureIndex: { trackerId, lectureIndex },
      },
      update: {
        watchedMinutes,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      create: {
        trackerId,
        lectureIndex,
        title,
        durationMinutes,
        watchedMinutes,
        isCompleted,
        externalRefCode,
        completedAt: isCompleted ? new Date() : null,
      },
    });
  }
}