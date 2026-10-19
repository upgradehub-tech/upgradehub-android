import { StepType, StepStatus } from "@prisma/client";

export const STEP_ORDER: readonly StepType[] = [
  StepType.LECTURE_TRACKING,
  StepType.THEORY_NOTES,
  StepType.NCERT_LINE_BY_LINE,
  StepType.LEVEL_1_PYQS,
  StepType.ADVANCED_PROBLEM_SET,
  StepType.MISTAKE_NOTEBOOK_ENTRY,
  StepType.SHORT_NOTES,
  StepType.FORMULA_RECALL,
  StepType.CBT_UNIT_TEST,
] as const;

export const STEP_WEIGHTS: Record<StepType, number> = {
  [StepType.LECTURE_TRACKING]: 10,
  [StepType.THEORY_NOTES]: 10,
  [StepType.NCERT_LINE_BY_LINE]: 15,
  [StepType.LEVEL_1_PYQS]: 15,
  [StepType.ADVANCED_PROBLEM_SET]: 15,
  [StepType.MISTAKE_NOTEBOOK_ENTRY]: 10,
  [StepType.SHORT_NOTES]: 5,
  [StepType.FORMULA_RECALL]: 10,
  [StepType.CBT_UNIT_TEST]: 10,
};

export interface StepPayloadMap {
  LECTURE_TRACKING: {
    totalLectures: number;
    completedLectureIndices: number[];
  };
  THEORY_NOTES: {
    theoryNotesRead: boolean;
    reviewedTopicIds: string[];
    totalTopicIds: string[];
  };
  NCERT_LINE_BY_LINE: {
    completedDrillIds: string[];
    totalDrillIds: string[];
    verifiedTableIds: string[];
    totalTableIds: string[];
    verifiedGraphIds: string[];
    totalGraphIds: string[];
    verifiedExceptionIds: string[];
    totalExceptionIds: string[];
  };
  LEVEL_1_PYQS: {
    pyqsAttempted: number;
    pyqsTarget: number;
    correctCount: number;
  };
  ADVANCED_PROBLEM_SET: {
    advancedAttempted: number;
    advancedTarget: number;
    correctCount: number;
  };
  MISTAKE_NOTEBOOK_ENTRY: {
    totalMistakesIdentified: number;
    mistakesLoggedCount: number;
    signedOffZeroMistakes?: boolean;
  };
  SHORT_NOTES: {
    condensedSheetReviewed: boolean;
    selfSummaryRecorded: boolean;
  };
  FORMULA_RECALL: {
    scorePct: number; // Must be >= 80%
    promptsTested: number;
    promptsCorrect: number;
  };
  CBT_UNIT_TEST: {
    testSubmissionId: string;
    marksObtained: number;
    totalMarks: number;
    accuracyPct: number;
    passed: boolean;
  };
}

export interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
  stepScorePct?: number;
}

export class ChapterTrackerStateMachine {
  /**
   * Determine the subsequent step in the fixed linear sequence.
   */
  public static getNextStep(current: StepType): StepType | null {
    const idx = STEP_ORDER.indexOf(current);
    if (idx === -1 || idx === STEP_ORDER.length - 1) return null;
    return STEP_ORDER[idx + 1];
  }

  /**
   * Validates whether a user can complete a given step with their submission payload.
   */
  public static validateStepCompletion<K extends StepType>(
    step: K,
    payload: StepPayloadMap[K]
  ): TransitionValidationResult {
    switch (step) {
      case StepType.LECTURE_TRACKING: {
        const data = payload as StepPayloadMap["LECTURE_TRACKING"];
        if (data.totalLectures <= 0) {
          return { valid: false, reason: "Chapter must contain at least one lecture." };
        }
        if (data.completedLectureIndices.length < data.totalLectures) {
          return {
            valid: false,
            reason: `All lectures must be completed. Completed ${data.completedLectureIndices.length} of ${data.totalLectures}.`,
          };
        }
        return { valid: true, stepScorePct: 100 };
      }

      case StepType.THEORY_NOTES: {
        const data = payload as StepPayloadMap["THEORY_NOTES"];
        if (!data.theoryNotesRead) {
          return { valid: false, reason: "Comprehensive theory notes must be confirmed as read." };
        }
        if (data.reviewedTopicIds.length < data.totalTopicIds.length) {
          return {
            valid: false,
            reason: `Topic checklist incomplete: ${data.reviewedTopicIds.length}/${data.totalTopicIds.length} topics confirmed.`,
          };
        }
        return { valid: true, stepScorePct: 100 };
      }

      case StepType.NCERT_LINE_BY_LINE: {
        const data = payload as StepPayloadMap["NCERT_LINE_BY_LINE"];
        if (data.completedDrillIds.length < data.totalDrillIds.length) {
          return {
            valid: false,
            reason: `Incomplete NCERT drills. Completed ${data.completedDrillIds.length}/${data.totalDrillIds.length}.`,
          };
        }
        if (data.verifiedTableIds.length < data.totalTableIds.length) {
          return { valid: false, reason: "All approved NCERT Tables must be reviewed." };
        }
        if (data.verifiedGraphIds.length < data.totalGraphIds.length) {
          return { valid: false, reason: "All NCERT Graphs and inflection points must be analyzed." };
        }
        if (data.verifiedExceptionIds.length < data.totalExceptionIds.length) {
          return { valid: false, reason: "All NCERT Reaction Exceptions must be acknowledged." };
        }
        return { valid: true, stepScorePct: 100 };
      }

      case StepType.LEVEL_1_PYQS: {
        const data = payload as StepPayloadMap["LEVEL_1_PYQS"];
        if (data.pyqsAttempted < data.pyqsTarget) {
          return {
            valid: false,
            reason: `PYQ threshold not met: ${data.pyqsAttempted}/${data.pyqsTarget} attempted.`,
          };
        }
        const accuracy = data.pyqsAttempted > 0 ? (data.correctCount / data.pyqsAttempted) * 100 : 0;
        if (accuracy < 60) {
          return {
            valid: false,
            reason: `Level-1 PYQ accuracy must be at least 60%. Current accuracy: ${accuracy.toFixed(1)}%.`,
            stepScorePct: accuracy,
          };
        }
        return { valid: true, stepScorePct: accuracy };
      }

      case StepType.ADVANCED_PROBLEM_SET: {
        const data = payload as StepPayloadMap["ADVANCED_PROBLEM_SET"];
        if (data.advancedAttempted < data.advancedTarget) {
          return {
            valid: false,
            reason: `Advanced questions threshold not met: ${data.advancedAttempted}/${data.advancedTarget} attempted.`,
          };
        }
        const accuracy = (data.correctCount / data.advancedAttempted) * 100;
        return { valid: true, stepScorePct: accuracy };
      }

      case StepType.MISTAKE_NOTEBOOK_ENTRY: {
        const data = payload as StepPayloadMap["MISTAKE_NOTEBOOK_ENTRY"];
        if (data.totalMistakesIdentified === 0 && !data.signedOffZeroMistakes) {
          return {
            valid: false,
            reason: "Must confirm zero mistakes logged or sign off error-free status.",
          };
        }
        if (data.totalMistakesIdentified > 0 && data.mistakesLoggedCount < data.totalMistakesIdentified) {
          return {
            valid: false,
            reason: `Mistake notebook mismatch: logged ${data.mistakesLoggedCount} of ${data.totalMistakesIdentified} errors.`,
          };
        }
        return { valid: true, stepScorePct: 100 };
      }

      case StepType.SHORT_NOTES: {
        const data = payload as StepPayloadMap["SHORT_NOTES"];
        if (!data.condensedSheetReviewed || !data.selfSummaryRecorded) {
          return {
            valid: false,
            reason: "Short notes revision checklist and self-summary confirmation are mandatory.",
          };
        }
        return { valid: true, stepScorePct: 100 };
      }

      case StepType.FORMULA_RECALL: {
        const data = payload as StepPayloadMap["FORMULA_RECALL"];
        if (data.promptsTested === 0) {
          return { valid: false, reason: "Formula recall test must be taken." };
        }
        const score = (data.promptsCorrect / data.promptsTested) * 100;
        if (score < 80.0) {
          return {
            valid: false,
            reason: `Formula recall requires >= 80% accuracy. Achieved: ${score.toFixed(1)}%.`,
            stepScorePct: score,
          };
        }
        return { valid: true, stepScorePct: score };
      }

      case StepType.CBT_UNIT_TEST: {
        const data = payload as StepPayloadMap["CBT_UNIT_TEST"];
        if (!data.passed || data.accuracyPct < 50.0) {
          return {
            valid: false,
            reason: `CBT Unit Test requires passing score (>= 50%). Achieved: ${data.accuracyPct.toFixed(1)}%.`,
            stepScorePct: data.accuracyPct,
          };
        }
        return { valid: true, stepScorePct: data.accuracyPct };
      }

      default:
        return { valid: false, reason: `Unknown step: ${step}` };
    }
  }

  /**
   * Calculates total weighted completion progress percentage (0.0 to 100.0)
   */
  public static calculateOverallProgress(
    states: Array<{ step: StepType; status: StepStatus }>
  ): number {
    const totalWeight = Object.values(STEP_WEIGHTS).reduce((a, b) => a + b, 0);
    const completedWeight = states.reduce((accum, curr) => {
      if (curr.status === StepStatus.COMPLETED) {
        return accum + (STEP_WEIGHTS[curr.step] || 0);
      }
      return accum;
    }, 0);

    return Number(((completedWeight / totalWeight) * 100).toFixed(2));
  }

  /**
   * Calculates overall mastery index incorporating weighted accuracy on problem-solving stages.
   */
  public static calculateMasteryScore(
    states: Array<{ step: StepType; status: StepStatus; scorePct: number | null }>
  ): number {
    const testSteps = [
      StepType.LEVEL_1_PYQS,
      StepType.ADVANCED_PROBLEM_SET,
      StepType.FORMULA_RECALL,
      StepType.CBT_UNIT_TEST,
    ];

    const scores = states
      .filter((s) => testSteps.includes(s.step) && s.status === StepStatus.COMPLETED && s.scorePct !== null)
      .map((s) => s.scorePct as number);

    if (scores.length === 0) return 0.0;
    const avg = scores.reduce((sum, val) => sum + val, 0) / scores.length;
    return Number(avg.toFixed(2));
  }
}