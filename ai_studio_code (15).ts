import { ActiveLearningEngine } from './learningLoopEngine';
import {
  FIXTURE_CHAPTER,
  FIXTURE_INITIAL_FLASHCARDS,
  FIXTURE_PRACTICE_ITEMS,
  FIXTURE_TOPICS,
} from './fixtures';
import { calculateNextSrsState, createInitialSrsState } from './srsScheduler';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export function runTests(): void {
  console.log('====================================================');
  console.log('RUNNING ACTIVE-LEARNING LOOP SPECIFICATION SUITE');
  console.log('====================================================\n');

  const baseDate = new Date('2026-10-21T09:00:00.000Z');

  // TEST 1: SM-2 Spaced Repetition Scheduling Transitions
  console.log('[Test 1: SM-2 Spaced Repetition Deterministic Transitions]');
  {
    const initial = createInitialSrsState(baseDate);
    assert(initial.repetitions === 0, 'Initial repetitions is 0');
    assert(initial.easeFactor === 2.5, 'Initial ease factor is 2.50');

    // Rating GOOD on first review
    const rev1 = calculateNextSrsState(initial, 'GOOD', baseDate);
    assert(rev1.repetitions === 1, 'Rev 1 GOOD sets repetitions to 1');
    assert(rev1.intervalDays === 1, 'Rev 1 GOOD sets interval to 1 day');
    assert(rev1.dueDate === '2026-10-22T09:00:00.000Z', 'Due date is +1 day');

    // Rating GOOD on second review (+1 day later)
    const day2 = new Date('2026-10-22T09:00:00.000Z');
    const rev2 = calculateNextSrsState(rev1, 'GOOD', day2);
    assert(rev2.repetitions === 2, 'Rev 2 GOOD sets repetitions to 2');
    assert(rev2.intervalDays === 6, 'Rev 2 GOOD sets interval to 6 days');
    assert(rev2.dueDate === '2026-10-28T09:00:00.000Z', 'Due date is +6 days');

    // Rating AGAIN resets repetitions and shrinks ease factor
    const day8 = new Date('2026-10-28T09:00:00.000Z');
    const rev3 = calculateNextSrsState(rev2, 'AGAIN', day8);
    assert(rev3.repetitions === 0, 'Rev 3 AGAIN resets repetitions to 0');
    assert(rev3.intervalDays === 1, 'Rev 3 AGAIN resets interval to 1 day');
    assert(rev3.easeFactor === 2.3, 'Ease factor reduced by 0.20 (2.5 -> 2.3)');
  }

  // TEST 2: Practice Stack queue filtering
  console.log('\n[Test 2: Practice Stack Queue Filtering]');
  {
    const engine = new ActiveLearningEngine({
      chapters: [FIXTURE_CHAPTER],
      practiceItems: FIXTURE_PRACTICE_ITEMS,
    });

    const allCalculus = engine.getPracticeQueue({ chapterId: 'chap_calculus' });
    assert(allCalculus.length === 3, 'Found 3 practice items for calculus chapter');

    const derivativesOnly = engine.getPracticeQueue({
      chapterId: 'chap_calculus',
      topicId: 'top_derivatives',
    });
    assert(derivativesOnly.length === 2, 'Found 2 items filtered by top_derivatives');
  }

  // TEST 3: Practice failure automatically captures into Mistake Notebook
  console.log('\n[Test 3: Automatic Mistake Capture on Failure]');
  {
    const engine = new ActiveLearningEngine({
      chapters: [FIXTURE_CHAPTER],
      practiceItems: FIXTURE_PRACTICE_ITEMS,
    });

    const submission = engine.submitPracticeAnswer({
      practiceItemId: 'pr_chain_01',
      userAnswer: '12x(3x^2 + 1)^3', // Wrong coefficient (omitted outer power factor)
      timeSpentMs: 42000,
      now: baseDate,
      defaultTags: ['CALCULATION_ERROR'],
    });

    assert(!submission.attempt.isCorrect, 'Attempt is evaluated as incorrect');
    assert(!!submission.mistakeEntry, 'Mistake entry was auto-generated');
    assert(submission.mistakeEntry?.tags.includes('CALCULATION_ERROR'), 'Assigned CALCULATION_ERROR tag');
    assert(submission.mistakeEntry?.status === 'OPEN', 'Mistake entry status is OPEN');

    // Duplicated mistake increments attempts
    const secondTry = engine.submitPracticeAnswer({
      practiceItemId: 'pr_chain_01',
      userAnswer: '4(3x^2 + 1)^3',
      timeSpentMs: 31000,
      now: new Date('2026-10-21T09:10:00.000Z'),
    });
    assert(secondTry.mistakeEntry?.attemptsCount === 2, 'Mistake attemptsCount incremented to 2');
  }

  // TEST 4: Mistake Notebook Edit, Resolve, and Reopen Workflow
  console.log('\n[Test 4: Mistake Notebook Edit, Resolve, and Reopen]');
  {
    const engine = new ActiveLearningEngine({
      chapters: [FIXTURE_CHAPTER],
      practiceItems: FIXTURE_PRACTICE_ITEMS,
    });

    const sub = engine.submitPracticeAnswer({
      practiceItemId: 'pr_lim_01',
      userAnswer: '0',
      timeSpentMs: 15000,
      now: baseDate,
      defaultTags: ['CONCEPTUAL_GAP'],
    });

    const mistakeId = sub.mistakeEntry!.id;

    // Edit notes and add tags
    const edited = engine.updateMistake({
      mistakeId,
      notes: 'Remember L Hopital or sin(x)/x geometric squeeze around origin',
      tags: ['CONCEPTUAL_GAP', 'FORMULA_MISREMEMBERED'],
      now: baseDate,
    });
    assert(edited.tags.length === 2, 'Tags successfully updated');
    assert(edited.notes.includes('L Hopital'), 'Notes successfully updated');

    // Resolve mistake
    const resolved = engine.resolveMistake(mistakeId, new Date('2026-10-22T09:00:00.000Z'));
    assert(resolved.status === 'RESOLVED', 'Status transitioned to RESOLVED');
    assert(!!resolved.resolvedAt, 'resolvedAt timestamp recorded');

    // Reopen mistake upon subsequent regression
    const reopened = engine.reopenMistake(mistakeId, 'MISREAD_QUESTION', new Date('2026-10-25T09:00:00.000Z'));
    assert(reopened.status === 'REOPENED', 'Status transitioned to REOPENED');
    assert(reopened.resolvedAt === undefined, 'resolvedAt cleared');
    assert(reopened.tags.includes('MISREAD_QUESTION'), 'Appended new diagnosis tag upon reopen');
  }

  // TEST 5: Complete Active-Learning Loop Round-Trip & Chapter Progress Reaction
  console.log('\n[Test 5: Full Active-Learning Loop Round-Trip & Chapter Progress]');
  {
    const engine = new ActiveLearningEngine({
      chapters: [FIXTURE_CHAPTER],
      practiceItems: FIXTURE_PRACTICE_ITEMS,
      flashcards: FIXTURE_INITIAL_FLASHCARDS,
    });

    // Step 1: Baseline Progress
    let progress = engine.getChapterProgress('chap_calculus', baseDate);
    assert(progress.masteryScore === 0, 'Initial progress without attempts has 0 mastery score');

    // Step 2: Answer 1 correctly, 1 incorrectly
    engine.submitPracticeAnswer({
      practiceItemId: 'pr_chain_02',
      userAnswer: '2e^(2x)', // Correct
      timeSpentMs: 12000,
      now: baseDate,
    });

    const wrongSub = engine.submitPracticeAnswer({
      practiceItemId: 'pr_chain_01',
      userAnswer: 'wrong answer',
      timeSpentMs: 25000,
      now: baseDate,
      defaultTags: ['FORMULA_MISREMEMBERED'],
    });

    progress = engine.getChapterProgress('chap_calculus', baseDate);
    assert(progress.totalAttempts === 2, 'Total attempts is 2');
    assert(progress.accuracyRate === 0.5, 'Accuracy rate is 50%');
    assert(progress.openMistakesCount === 1, 'Open mistakes count is 1');
    const midMastery = progress.masteryScore;
    console.log(`    -> Mid-loop mastery score with 1 open mistake: ${midMastery}`);

    // Step 3: Convert mistake to a high-yield flashcard
    const generatedCard = engine.createFlashcardFromMistake({
      mistakeId: wrongSub.mistakeEntry!.id,
      front: 'Recall d/dx [(3x^2 + 1)^4]',
      now: baseDate,
    });
    assert(generatedCard.sourceMistakeId === wrongSub.mistakeEntry!.id, 'Card linked back to mistake');

    // Step 4: Review cycle 1: Rate GOOD
    engine.reviewFlashcard({
      cardId: generatedCard.id,
      rating: 'GOOD',
      now: baseDate,
      autoResolveMistakeOnMastery: true,
    });

    // Step 5: Review cycle 2 (+1 day later): Rate EASY
    const nextDay = new Date('2026-10-22T10:00:00.000Z');
    const reviewResult = engine.reviewFlashcard({
      cardId: generatedCard.id,
      rating: 'EASY',
      now: nextDay,
      autoResolveMistakeOnMastery: true,
    });

    assert(reviewResult.mistakeResolved === true, 'Mistake automatically marked RESOLVED upon 2nd successful review');

    // Step 6: Verify Chapter Progress has recovered
    progress = engine.getChapterProgress('chap_calculus', nextDay);
    assert(progress.openMistakesCount === 0, 'Open mistakes decreased to 0');
    assert(progress.resolvedMistakesCount === 1, 'Resolved mistakes increased to 1');
    assert(progress.masteryScore > midMastery, `Mastery increased from ${midMastery} to ${progress.masteryScore}`);
  }

  console.log('\n====================================================');
  console.log('ALL ACTIVE-LEARNING TESTS PASSED (100% SPEC COMPLIANCE)');
  console.log('====================================================');
}

// Execute tests
runTests();