import { Chapter, Flashcard, PracticeItem, Topic } from './types';

export const FIXTURE_CHAPTER: Chapter = {
  id: 'chap_calculus',
  title: 'Differential Calculus',
  subject: 'Mathematics',
};

export const FIXTURE_TOPICS: Topic[] = [
  { id: 'top_limits', chapterId: 'chap_calculus', title: 'Limits & Continuity' },
  { id: 'top_derivatives', chapterId: 'chap_calculus', title: 'Chain Rule & Product Rule' },
];

export const FIXTURE_PRACTICE_ITEMS: PracticeItem[] = [
  {
    id: 'pr_lim_01',
    chapterId: 'chap_calculus',
    topicId: 'top_limits',
    prompt: 'What is the limit of (sin x) / x as x approaches 0?',
    options: ['0', '1', 'Infinity', 'Undefined'],
    correctAnswer: '1',
    explanation: 'Fundamental trigonometric limit: lim x->0 (sin x)/x = 1.',
    difficulty: 'EASY',
  },
  {
    id: 'pr_chain_01',
    chapterId: 'chap_calculus',
    topicId: 'top_derivatives',
    prompt: 'Differentiate f(x) = (3x^2 + 1)^4 with respect to x.',
    correctAnswer: '24x(3x^2 + 1)^3',
    explanation: 'By the chain rule: d/dx[u^4] = 4*u^3 * u\', where u = 3x^2 + 1 and u\' = 6x.',
    difficulty: 'MEDIUM',
  },
  {
    id: 'pr_chain_02',
    chapterId: 'chap_calculus',
    topicId: 'top_derivatives',
    prompt: 'What is the derivative of e^(2x)?',
    correctAnswer: '2e^(2x)',
    explanation: 'By the chain rule: d/dx[e^(u)] = e^(u) * du/dx, so e^(2x) * 2.',
    difficulty: 'EASY',
  },
];

export const FIXTURE_INITIAL_FLASHCARDS: Flashcard[] = [
  {
    id: 'fc_chain_rule_formula',
    chapterId: 'chap_calculus',
    topicId: 'top_derivatives',
    front: 'State the Chain Rule formula for (f ∘ g)(x)',
    back: "(f ∘ g)'(x) = f'(g(x)) * g'(x)",
    srs: {
      repetitions: 1,
      intervalDays: 1,
      easeFactor: 2.5,
      dueDate: '2026-10-21T00:00:00.000Z',
      lastReviewedAt: '2026-10-20T00:00:00.000Z',
    },
  },
];