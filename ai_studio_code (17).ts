import {
  Chapter,
  ChapterProgressSummary,
  Flashcard,
  MistakeEntry,
  MistakeStatus,
  MistakeTag,
  PracticeAttempt,
  PracticeItem,
  SrsRating,
} from './types';
import { calculateNextSrsState, createInitialSrsState, isCardDue } from './srsScheduler';

export class ActiveLearningEngine {
  private chapters = new Map<string, Chapter>();
  private practiceItems = new Map<string, PracticeItem>();
  private attempts: PracticeAttempt[] = [];
  private mistakes = new Map<string, MistakeEntry>();
  private flashcards = new Map<string, Flashcard>();

  constructor(fixtures?: {
    chapters?: Chapter[];
    practiceItems?: PracticeItem[];
    flashcards?: Flashcard[];
    mistakes?: MistakeEntry[];
  }) {
    fixtures?.chapters?.forEach((c) => this.chapters.set(c.id, c));
    fixtures?.practiceItems?.forEach((p) => this.practiceItems.set(p.id, p));
    fixtures?.flashcards?.forEach((f) => this.flashcards.set(f.id, f));
    fixtures?.mistakes?.forEach((m) => this.mistakes.set(m.id, m));
  }

  // --- PRACTICE STACK API ---
  public getPracticeQueue(filter: { chapterId?: string; topicId?: string }): PracticeItem[] {
    return Array.from(this.practiceItems.values()).filter((item) => {
      if (filter.chapterId && item.chapterId !== filter.chapterId) return false;
      if (filter.topicId && item.topicId !== filter.topicId) return false;
      return true;
    });
  }

  public submitPracticeAnswer(params: {
    practiceItemId: string;
    userAnswer: string;
    timeSpentMs: number;
    now: Date;
    autoCaptureMistake?: boolean;
    defaultTags?: MistakeTag[];
  }): { attempt: PracticeAttempt; mistakeEntry?: MistakeEntry } {
    const item = this.practiceItems.get(params.practiceItemId);
    if (!item) {
      throw new Error(`Practice item not found: ${params.practiceItemId}`);
    }

    const isCorrect = item.correctAnswer.trim().toLowerCase() === params.userAnswer.trim().toLowerCase();
    const attempt: PracticeAttempt = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceItemId: item.id,
      chapterId: item.chapterId,
      topicId: item.topicId,
      userAnswer: params.userAnswer,
      isCorrect,
      timeSpentMs: params.timeSpentMs,
      timestamp: params.now.toISOString(),
    };
    this.attempts.push(attempt);

    let mistakeEntry: MistakeEntry | undefined;

    // Active Loop: If answer is incorrect and auto-capture enabled, route to Mistake Notebook
    if (!isCorrect && params.autoCaptureMistake !== false) {
      mistakeEntry = this.recordPracticeMistake({
        item,
        userAnswer: params.userAnswer,
        tags: params.defaultTags || ['CONCEPTUAL_GAP'],
        now: params.now,
      });
    }

    return { attempt, mistakeEntry };
  }

  // --- MISTAKE NOTEBOOK API ---
  public recordPracticeMistake(params: {
    item: PracticeItem;
    userAnswer: string;
    tags: MistakeTag[];
    notes?: string;
    now: Date;
  }): MistakeEntry {
    const existing = Array.from(this.mistakes.values()).find(
      (m) => m.sourcePracticeItemId === params.item.id && m.status !== 'RESOLVED'
    );

    if (existing) {
      // Increment attempt count on duplicate failure
      existing.attemptsCount += 1;
      existing.userAnswer = params.userAnswer;
      existing.updatedAt = params.now.toISOString();
      return existing;
    }

    const newMistake: MistakeEntry = {
      id: `mst_${params.item.id}_${Date.now()}`,
      sourcePracticeItemId: params.item.id,
      chapterId: params.item.chapterId,
      topicId: params.item.topicId,
      questionSnippet: params.item.prompt,
      userAnswer: params.userAnswer,
      correctAnswer: params.item.correctAnswer,
      notes: params.notes || params.item.explanation,
      tags: params.tags,
      status: 'OPEN',
      attemptsCount: 1,
      createdAt: params.now.toISOString(),
      updatedAt: params.now.toISOString(),
    };

    this.mistakes.set(newMistake.id, newMistake);
    return newMistake;
  }

  public updateMistake(params: {
    mistakeId: string;
    notes?: string;
    tags?: MistakeTag[];
    now: Date;
  }): MistakeEntry {
    const entry = this.mistakes.get(params.mistakeId);
    if (!entry) throw new Error(`Mistake entry ${params.mistakeId} not found`);

    if (params.notes !== undefined) entry.notes = params.notes;
    if (params.tags !== undefined) entry.tags = [...params.tags];
    entry.updatedAt = params.now.toISOString();
    return entry;
  }

  public resolveMistake(mistakeId: string, now: Date): MistakeEntry {
    const entry = this.mistakes.get(mistakeId);
    if (!entry) throw new Error(`Mistake entry ${mistakeId} not found`);

    entry.status = 'RESOLVED';
    entry.resolvedAt = now.toISOString();
    entry.updatedAt = now.toISOString();
    return entry;
  }

  public reopenMistake(mistakeId: string, reasonTag: MistakeTag, now: Date): MistakeEntry {
    const entry = this.mistakes.get(mistakeId);
    if (!entry) throw new Error(`Mistake entry ${mistakeId} not found`);

    entry.status = 'REOPENED';
    entry.resolvedAt = undefined;
    entry.attemptsCount += 1;
    if (!entry.tags.includes(reasonTag)) {
      entry.tags.push(reasonTag);
    }
    entry.updatedAt = now.toISOString();
    return entry;
  }

  public getMistakes(filter?: {
    chapterId?: string;
    topicId?: string;
    status?: MistakeStatus;
    tag?: MistakeTag;
  }): MistakeEntry[] {
    return Array.from(this.mistakes.values()).filter((m) => {
      if (filter?.chapterId && m.chapterId !== filter.chapterId) return false;
      if (filter?.topicId && m.topicId !== filter.topicId) return false;
      if (filter?.status && m.status !== filter.status) return false;
      if (filter?.tag && !m.tags.includes(filter.tag)) return false;
      return true;
    });
  }

  // --- FLASHCARDS & SPACED REPETITION API ---
  public createFlashcardFromMistake(params: {
    mistakeId: string;
    front?: string;
    back?: string;
    now: Date;
  }): Flashcard {
    const mistake = this.mistakes.get(params.mistakeId);
    if (!mistake) throw new Error(`Mistake ${params.mistakeId} not found`);

    const card: Flashcard = {
      id: `fc_${mistake.id}`,
      chapterId: mistake.chapterId,
      topicId: mistake.topicId,
      sourceMistakeId: mistake.id,
      front: params.front || mistake.questionSnippet,
      back: params.back || `Correct: ${mistake.correctAnswer}\nContext: ${mistake.notes}`,
      srs: createInitialSrsState(params.now),
    };

    this.flashcards.set(card.id, card);
    return card;
  }

  public getDueFlashcards(asOf: Date, chapterId?: string): Flashcard[] {
    return Array.from(this.flashcards.values()).filter((card) => {
      if (chapterId && card.chapterId !== chapterId) return false;
      return isCardDue(card, asOf);
    });
  }

  public reviewFlashcard(params: {
    cardId: string;
    rating: SrsRating;
    now: Date;
    autoResolveMistakeOnMastery?: boolean;
  }): { card: Flashcard; mistakeResolved?: boolean } {
    const card = this.flashcards.get(params.cardId);
    if (!card) throw new Error(`Flashcard ${params.cardId} not found`);

    card.srs = calculateNextSrsState(card.srs, params.rating, params.now);

    let mistakeResolved = false;
    // When reviewed with 'GOOD' or 'EASY' and reps >= 2, auto-resolve source mistake
    if (
      params.autoResolveMistakeOnMastery &&
      card.sourceMistakeId &&
      (params.rating === 'GOOD' || params.rating === 'EASY') &&
      card.srs.repetitions >= 2
    ) {
      const mistake = this.mistakes.get(card.sourceMistakeId);
      if (mistake && mistake.status !== 'RESOLVED') {
        this.resolveMistake(mistake.id, params.now);
        mistakeResolved = true;
      }
    }

    return { card, mistakeResolved };
  }

  // --- CHAPTER PROGRESS LINKAGE ---
  public getChapterProgress(chapterId: string, asOf: Date): ChapterProgressSummary {
    const attempts = this.attempts.filter((a) => a.chapterId === chapterId);
    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((a) => a.isCorrect).length;
    const accuracyRate = totalAttempts > 0 ? Number((correctAttempts / totalAttempts).toFixed(2)) : 0;

    const chapterMistakes = Array.from(this.mistakes.values()).filter((m) => m.chapterId === chapterId);
    const openMistakesCount = chapterMistakes.filter((m) => m.status === 'OPEN' || m.status === 'REOPENED').length;
    const resolvedMistakesCount = chapterMistakes.filter((m) => m.status === 'RESOLVED').length;

    const chapterCards = Array.from(this.flashcards.values()).filter((c) => c.chapterId === chapterId);
    const dueCardsCount = chapterCards.filter((c) => isCardDue(c, asOf)).length;

    /**
     * Mastery calculation:
     * - Base component: accuracy * 60 points
     * - Mistake penalty: up to -30 points for open mistakes (5 points per open mistake)
     * - Resolution recovery: +10 points if all recorded mistakes are resolved
     * - SRS health component: 30 points * (1 - dueCards/totalCards) if flashcards exist
     */
    let mastery = 0;
    if (totalAttempts > 0) {
      const practiceComponent = accuracyRate * 60;
      const mistakePenalty = Math.min(30, openMistakesCount * 5);
      const resolutionBonus = chapterMistakes.length > 0 && openMistakesCount === 0 ? 10 : 0;

      let srsRetentionComponent = 20;
      if (chapterCards.length > 0) {
        const healthyRatio = (chapterCards.length - dueCardsCount) / chapterCards.length;
        srsRetentionComponent = Math.round(healthyRatio * 30);
      }

      mastery = Math.max(0, Math.min(100, Math.round(practiceComponent - mistakePenalty + resolutionBonus + srsRetentionComponent)));
    }

    return {
      chapterId,
      totalAttempts,
      correctAttempts,
      accuracyRate,
      openMistakesCount,
      resolvedMistakesCount,
      totalCards: chapterCards.length,
      dueCardsCount,
      masteryScore: mastery,
    };
  }
}