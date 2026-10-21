import { Flashcard, SrsCardState, SrsRating } from './types';

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const MINIMUM_EASE_FACTOR = 1.3;

export function createInitialSrsState(now: Date = new Date()): SrsCardState {
  return {
    repetitions: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    dueDate: now.toISOString(),
  };
}

/**
 * Calculates next review interval, ease factor, and due date deterministically.
 */
export function calculateNextSrsState(
  currentState: SrsCardState,
  rating: SrsRating,
  now: Date
): SrsCardState {
  let { repetitions, intervalDays, easeFactor } = currentState;

  switch (rating) {
    case 'AGAIN': {
      repetitions = 0;
      intervalDays = 1;
      easeFactor = Math.max(MINIMUM_EASE_FACTOR, easeFactor - 0.2);
      break;
    }
    case 'HARD': {
      repetitions = repetitions === 0 ? 1 : repetitions;
      intervalDays = intervalDays <= 1 ? 1 : Math.round(intervalDays * 1.2);
      easeFactor = Math.max(MINIMUM_EASE_FACTOR, easeFactor - 0.15);
      break;
    }
    case 'GOOD': {
      if (repetitions === 0) {
        intervalDays = 1;
      } else if (repetitions === 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      repetitions += 1;
      break;
    }
    case 'EASY': {
      if (repetitions === 0) {
        intervalDays = 4;
      } else if (repetitions === 1) {
        intervalDays = 8;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor * 1.3);
      }
      repetitions += 1;
      easeFactor += 0.15;
      break;
    }
  }

  const nextDue = new Date(now.getTime() + intervalDays * MILLIS_PER_DAY);

  return {
    repetitions,
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    dueDate: nextDue.toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

export function isCardDue(card: Flashcard, asOf: Date): boolean {
  return new Date(card.srs.dueDate).getTime() <= asOf.getTime();
}