export type MistakeTag =
  | 'CONCEPTUAL_GAP'
  | 'CALCULATION_ERROR'
  | 'MISREAD_QUESTION'
  | 'FORMULA_MISREMEMBERED'
  | 'CARELESS_INPUT';

export type MistakeStatus = 'OPEN' | 'RESOLVED' | 'REOPENED';

export type SrsRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

export interface Chapter {
  id: string;
  title: string;
  subject: string;
}

export interface Topic {
  id: string;
  chapterId: string;
  title: string;
}

export interface PracticeItem {
  id: string;
  chapterId: string;
  topicId: string;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface PracticeAttempt {
  id: string;
  practiceItemId: string;
  chapterId: string;
  topicId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
  timestamp: string; // ISO 8601
}

export interface SrsCardState {
  repetitions: number;
  intervalDays: number;
  easeFactor: number; // starts at 2.5
  dueDate: string;     // ISO 8601
  lastReviewedAt?: string;
}

export interface Flashcard {
  id: string;
  chapterId: string;
  topicId: string;
  sourceMistakeId?: string;
  front: string;
  back: string;
  srs: SrsCardState;
}

export interface MistakeEntry {
  id: string;
  sourcePracticeItemId?: string;
  chapterId: string;
  topicId: string;
  questionSnippet: string;
  userAnswer: string;
  correctAnswer: string;
  notes: string;
  tags: MistakeTag[];
  status: MistakeStatus;
  attemptsCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ChapterProgressSummary {
  chapterId: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyRate: number;        // 0.0 to 1.0
  openMistakesCount: number;
  resolvedMistakesCount: number;
  totalCards: number;
  dueCardsCount: number;
  masteryScore: number;        // 0 to 100
}