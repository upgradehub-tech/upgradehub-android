import {
  TestPaper,
  QuestionResponse,
  TestEvaluationResult,
  QuestionScoreResult,
  SectionScoreResult
} from '../types/cbt';

/**
 * Deterministic Marks-to-Rank Benchmark Fixture (300-Mark Scale)
 * Standardized reference table based on cohort percentiles.
 */
export const MARKS_RANK_FIXTURE = [
  { minMarks: 290, maxMarks: 300, minRank: 1,      maxRank: 35,      percentile: 99.997 },
  { minMarks: 275, maxMarks: 289, minRank: 36,     maxRank: 180,     percentile: 99.98 },
  { minMarks: 250, maxMarks: 274, minRank: 181,    maxRank: 750,     percentile: 99.92 },
  { minMarks: 220, maxMarks: 249, minRank: 751,    maxRank: 2400,    percentile: 99.76 },
  { minMarks: 190, maxMarks: 219, minRank: 2401,   maxRank: 6200,    percentile: 99.38 },
  { minMarks: 160, maxMarks: 189, minRank: 6201,   maxRank: 13500,   percentile: 98.65 },
  { minMarks: 130, maxMarks: 159, minRank: 13501,  maxRank: 26000,   percentile: 97.40 },
  { minMarks: 100, maxMarks: 129, minRank: 26001,  maxRank: 52000,   percentile: 94.80 },
  { minMarks: 70,  maxMarks: 99,  minRank: 52001,  maxRank: 105000,  percentile: 89.50 },
  { minMarks: 40,  maxMarks: 69,  minRank: 105001, maxRank: 220000,  percentile: 78.00 },
  { minMarks: 0,   maxMarks: 39,  minRank: 220001, maxRank: 550000,  percentile: 45.00 },
  { minMarks: -75, maxMarks: -1,  minRank: 550001, maxRank: 1100000, percentile: 10.00 }
];

export function predictRankAndPercentile(score: number, maxScore: number = 300) {
  // Normalize score to 300 scale for fixture lookup
  const normalizedScore = (score / maxScore) * 300;

  for (const bucket of MARKS_RANK_FIXTURE) {
    if (normalizedScore >= bucket.minMarks && normalizedScore <= bucket.maxMarks) {
      // Deterministic linear interpolation inside bucket
      const span = bucket.maxMarks - bucket.minMarks || 1;
      const progress = (bucket.maxMarks - normalizedScore) / span; // 0 at top, 1 at bottom
      const estimatedRank = Math.round(bucket.minRank + progress * (bucket.maxRank - bucket.minRank));
      
      return {
        estimatedRank,
        rankRange: [bucket.minRank, bucket.maxRank] as [number, number],
        percentile: bucket.percentile,
        confidenceInterval: '95% deterministic-fit'
      };
    }
  }

  // Fallback edge case (below -75)
  return {
    estimatedRank: 1100000,
    rankRange: [1100000, 1200000] as [number, number],
    percentile: 0.1,
    confidenceInterval: 'Out of bracket'
  };
}

export function evaluateCBTSubmission(
  paper: TestPaper,
  responses: Record<string, QuestionResponse>,
  timeSpentSeconds: number
): TestEvaluationResult {
  const questionResults: Record<string, QuestionScoreResult> = {};
  const sectionResults: Record<string, SectionScoreResult> = {};

  let totalScore = 0;
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;

  for (const section of paper.sections) {
    let sectionScore = 0;
    let sectionMaxScore = 0;
    let sectionAttempted = 0;
    let sectionCorrect = 0;
    let sectionIncorrect = 0;

    for (const qId of section.questionIds) {
      const q = paper.questions[qId];
      const resp = responses[qId];
      sectionMaxScore += q.markingScheme.correct;

      const isAnswered =
        resp &&
        (resp.status === 'ANSWERED' || resp.status === 'ANSWERED_AND_MARKED');

      let isCorrect = false;
      let marksAwarded = 0;
      let userAnswer: string | number | undefined = undefined;

      if (!isAnswered) {
        marksAwarded = q.markingScheme.unattempted;
      } else {
        sectionAttempted++;
        totalAttempted++;

        if (q.type === 'MCQ') {
          userAnswer = resp.selectedOptionId;
          isCorrect = userAnswer === q.correctAnswer;
        } else if (q.type === 'NUMERICAL') {
          userAnswer = resp.numericalValue !== undefined ? parseFloat(resp.numericalValue) : NaN;
          const target = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseFloat(q.correctAnswer);
          const tol = q.tolerance ?? 0.001;
          isCorrect = !isNaN(userAnswer) && Math.abs(userAnswer - target) <= tol;
        }

        if (isCorrect) {
          marksAwarded = q.markingScheme.correct;
          sectionCorrect++;
          totalCorrect++;
        } else {
          // Ensure negative marking reduces the score correctly
          const penalty = Math.abs(q.markingScheme.incorrect);
          marksAwarded = -penalty;
          sectionIncorrect++;
          totalIncorrect++;
        }
      }

      sectionScore += marksAwarded;
      totalScore += marksAwarded;

      questionResults[qId] = {
        questionId: qId,
        sectionId: section.id,
        subject: q.subject,
        isAttempted: Boolean(isAnswered),
        isCorrect,
        marksAwarded,
        timeSpentSeconds: resp?.timeSpentSeconds || 0,
        userAnswer,
        correctAnswer: q.correctAnswer
      };
    }

    sectionResults[section.id] = {
      sectionId: section.id,
      name: section.name,
      score: sectionScore,
      maxScore: sectionMaxScore,
      attempted: sectionAttempted,
      correct: sectionCorrect,
      incorrect: sectionIncorrect,
      accuracyPercentage:
        sectionAttempted > 0 ? (sectionCorrect / sectionAttempted) * 100 : 0
    };
  }

  const accuracyPercentage =
    totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;

  const { estimatedRank, rankRange, percentile, confidenceInterval } =
    predictRankAndPercentile(totalScore, paper.totalMarks);

  return {
    testId: paper.id,
    totalScore,
    maxScore: paper.totalMarks,
    accuracyPercentage,
    totalAttempted,
    totalCorrect,
    totalIncorrect,
    timeSpentSeconds,
    sectionResults,
    questionResults,
    percentile,
    predictedRank: {
      estimatedRank,
      rankRange,
      confidenceInterval
    }
  };
}