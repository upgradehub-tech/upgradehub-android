import { evaluateCBTSubmission, predictRankAndPercentile } from '../engine/scoringEngine';
import { AnalyticsPipeline, StudySessionLog } from '../engine/analyticsPipeline';
import { TestPaper, QuestionResponse } from '../types/cbt';

describe('Deterministic CBT Scoring & Rank Engine', () => {
  // Deterministic Mock Paper: 2 Sections, 4 Questions, 300 Max Points (scaled marks)
  const mockPaper: TestPaper = {
    id: 'JEE_SIM_001',
    title: 'Joint Mock Simulation',
    durationSeconds: 10800,
    totalMarks: 300,
    sections: [
      {
        id: 'SEC_PHY',
        name: 'Physics',
        questionIds: ['Q1', 'Q2']
      },
      {
        id: 'SEC_CHEM',
        name: 'Chemistry',
        questionIds: ['Q3', 'Q4']
      }
    ],
    questions: {
      Q1: {
        id: 'Q1',
        sectionId: 'SEC_PHY',
        type: 'MCQ',
        prompt: 'What is the unit of Planck constant?',
        correctAnswer: 'OPT_B',
        markingScheme: { correct: 100, incorrect: -25, unattempted: 0 },
        subject: 'Physics',
        topic: 'Units'
      },
      Q2: {
        id: 'Q2',
        sectionId: 'SEC_PHY',
        type: 'NUMERICAL',
        prompt: 'Calculate escape velocity in km/s (approx 11.2)',
        correctAnswer: 11.2,
        tolerance: 0.05,
        markingScheme: { correct: 50, incorrect: 0, unattempted: 0 },
        subject: 'Physics',
        topic: 'Gravitation'
      },
      Q3: {
        id: 'Q3',
        sectionId: 'SEC_CHEM',
        type: 'MCQ',
        prompt: 'Identify the inert gas',
        correctAnswer: 'OPT_D',
        markingScheme: { correct: 75, incorrect: -20, unattempted: 0 },
        subject: 'Chemistry',
        topic: 'Noble Gases'
      },
      Q4: {
        id: 'Q4',
        sectionId: 'SEC_CHEM',
        type: 'NUMERICAL',
        prompt: 'pH of neutral water at 25C',
        correctAnswer: 7.0,
        tolerance: 0.01,
        markingScheme: { correct: 75, incorrect: -15, unattempted: 0 },
        subject: 'Chemistry',
        topic: 'Equilibrium'
      }
    }
  };

  test('Test Case 1: Perfect Score Scenario (All Correct with Tolerances)', () => {
    const responses: Record<string, QuestionResponse> = {
      Q1: { questionId: 'Q1', status: 'ANSWERED', selectedOptionId: 'OPT_B', timeSpentSeconds: 60 },
      // 11.23 is within 11.2 +/- 0.05
      Q2: { questionId: 'Q2', status: 'ANSWERED', numericalValue: '11.23', timeSpentSeconds: 120 },
      Q3: { questionId: 'Q3', status: 'ANSWERED_AND_MARKED', selectedOptionId: 'OPT_D', timeSpentSeconds: 40 },
      Q4: { questionId: 'Q4', status: 'ANSWERED', numericalValue: '7.005', timeSpentSeconds: 80 }
    };

    const result = evaluateCBTSubmission(mockPaper, responses, 300);

    expect(result.totalScore).toBe(300);
    expect(result.totalCorrect).toBe(4);
    expect(result.totalIncorrect).toBe(0);
    expect(result.accuracyPercentage).toBe(100);
    expect(result.percentile).toBeGreaterThan(99.9);
    expect(result.predictedRank.estimatedRank).toBeLessThanOrEqual(35);
  });

  test('Test Case 2: Negative Marking and Unattempted Handled Accurately', () => {
    const responses: Record<string, QuestionResponse> = {
      // Correct: +100
      Q1: { questionId: 'Q1', status: 'ANSWERED', selectedOptionId: 'OPT_B', timeSpentSeconds: 50 },
      // Unattempted: 0
      Q2: { questionId: 'Q2', status: 'NOT_ANSWERED', timeSpentSeconds: 10 },
      // Incorrect MCQ: -20
      Q3: { questionId: 'Q3', status: 'ANSWERED', selectedOptionId: 'OPT_A', timeSpentSeconds: 45 },
      // Numerical outside tolerance (7.5 vs 7.0 +/- 0.01): -15
      Q4: { questionId: 'Q4', status: 'ANSWERED', numericalValue: '7.5', timeSpentSeconds: 90 }
    };

    const result = evaluateCBTSubmission(mockPaper, responses, 195);

    // Expected: 100 - 20 - 15 = 65
    expect(result.totalScore).toBe(65);
    expect(result.totalAttempted).toBe(3);
    expect(result.totalCorrect).toBe(1);
    expect(result.totalIncorrect).toBe(2);
    // Accuracy: 1/3 = 33.333%
    expect(result.accuracyPercentage).toBeCloseTo(33.33, 1);

    // Section Breakdown checks
    expect(result.sectionResults['SEC_PHY'].score).toBe(100);
    expect(result.sectionResults['SEC_CHEM'].score).toBe(-35);
  });

  test('Test Case 3: Marks vs Rank Deterministic Interpolation Bounds', () => {
    const r1 = predictRankAndPercentile(295, 300);
    expect(r1.estimatedRank).toBeGreaterThanOrEqual(1);
    expect(r1.estimatedRank).toBeLessThanOrEqual(35);

    const r2 = predictRankAndPercentile(100, 300);
    expect(r2.rankRange).toEqual([26001, 52000]);
    expect(r2.percentile).toBe(94.8);

    const r3 = predictRankAndPercentile(-20, 300);
    expect(r3.rankRange).toEqual([550001, 1100000]);
  });
});

describe('Deterministic Analytics Pipeline', () => {
  const sampleLogs: StudySessionLog[] = [
    { id: '1', date: '2026-10-10', durationMinutes: 120, subject: 'Physics', questionsAttempted: 50, questionsCorrect: 40 },
    { id: '2', date: '2026-10-10', durationMinutes: 60,  subject: 'Chemistry', questionsAttempted: 30, questionsCorrect: 25 },
    { id: '3', date: '2026-10-11', durationMinutes: 180, subject: 'Physics', questionsAttempted: 60, questionsCorrect: 48 },
    { id: '4', date: '2026-10-12', durationMinutes: 90,  subject: 'Mathematics', questionsAttempted: 40, questionsCorrect: 20 },
    { id: '5', date: '2026-10-13', durationMinutes: 150, subject: 'Chemistry', questionsAttempted: 50, questionsCorrect: 45 }
  ];

  const pipeline = new AnalyticsPipeline(sampleLogs);

  test('Aggregates study hours accurately per subject and total', () => {
    const totalHours = pipeline.aggregateStudyHours();
    // 120 + 60 + 180 + 90 + 150 = 600 mins = 10 hrs
    expect(totalHours).toBe(10);

    const physicsHours = pipeline.aggregateStudyHours('Physics');
    // 120 + 180 = 300 mins = 5 hrs
    expect(physicsHours).toBe(5);
  });

  test('Calculates weekly efficiency index deterministically', () => {
    const weekly = pipeline.calculateWeeklyEfficiency();
    expect(weekly.length).toBeGreaterThan(0);
    const w = weekly[0];
    expect(w.studyHours).toBe(10);
    // Total Q = 230, Total Correct = 178 => 77.39% accuracy
    expect(w.accuracy).toBeCloseTo(77.4, 1);
    expect(w.throughputQuesPerHour).toBe(23.0);
    expect(w.efficiencyIndex).toBeGreaterThan(0);
  });

  test('Computes rolling accuracy and cumulative hours trends', () => {
    const trend = pipeline.generateTrendAnalytics(7);
    expect(trend.length).toBe(4); // 4 unique dates: 10th, 11th, 12th, 13th

    const lastDay = trend[trend.length - 1];
    expect(lastDay.date).toBe('2026-10-13');
    expect(lastDay.cumulativeHours).toBe(10);
    // Accuracy on 13th: 45/50 = 90%
    expect(lastDay.accuracy).toBe(90);
  });

  test('Produces heatmaps with capped discrete intensities', () => {
    const heatmap = pipeline.generateSubjectHeatmap(30);
    const physicsDay1 = heatmap.find(h => h.date === '2026-10-10' && h.subject === 'Physics');

    expect(physicsDay1).toBeDefined();
    // 120 mins => intensity level 2 (> 60 and <= 120)
    expect(physicsDay1!.intensity).toBe(2);
    expect(physicsDay1!.minutesSpent).toBe(120);
    expect(physicsDay1!.accuracy).toBe(80);
  });
});