export type QuestionType = 'MCQ' | 'NUMERICAL';

export type QuestionStatus =
  | 'NOT_VISITED'
  | 'NOT_ANSWERED'
  | 'ANSWERED'
  | 'MARKED_FOR_REVIEW'
  | 'ANSWERED_AND_MARKED';

export interface MarkingScheme {
  correct: number;
  incorrect: number;   // e.g. -1 (pass as negative number or absolute magnitude)
  unattempted: number; // typically 0
}

export interface Question {
  id: string;
  sectionId: string;
  type: QuestionType;
  prompt: string;
  options?: { id: string; text: string }[]; // MCQ only
  correctAnswer: string | number;           // Option ID or numerical target
  tolerance?: number;                       // For NUMERICAL questions (e.g. +/- 0.02)
  markingScheme: MarkingScheme;
  subject: string;
  topic: string;
}

export interface Section {
  id: string;
  name: string;
  instructions?: string;
  maxAttemptsAllowed?: number; // e.g., attempt any 5 of 10
  questionIds: string[];
}

export interface TestPaper {
  id: string;
  title: string;
  durationSeconds: number;
  totalMarks: number;
  sections: Section[];
  questions: Record<string, Question>;
}

export interface QuestionResponse {
  questionId: string;
  status: QuestionStatus;
  selectedOptionId?: string;
  numericalValue?: string;
  timeSpentSeconds: number;
  visitedAt?: number;
}

export interface QuestionScoreResult {
  questionId: string;
  sectionId: string;
  subject: string;
  isAttempted: boolean;
  isCorrect: boolean;
  marksAwarded: number;
  timeSpentSeconds: number;
  userAnswer?: string | number;
  correctAnswer: string | number;
}

export interface SectionScoreResult {
  sectionId: string;
  name: string;
  score: number;
  maxScore: number;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracyPercentage: number;
}

export interface TestEvaluationResult {
  testId: string;
  totalScore: number;
  maxScore: number;
  accuracyPercentage: number;
  totalAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  timeSpentSeconds: number;
  sectionResults: Record<string, SectionScoreResult>;
  questionResults: Record<string, QuestionScoreResult>;
  percentile: number;
  predictedRank: {
    estimatedRank: number;
    rankRange: [number, number];
    confidenceInterval: string;
  };
}