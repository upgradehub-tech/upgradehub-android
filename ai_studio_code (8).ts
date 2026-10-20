import { describe, it, expect } from 'vitest';
import { TaskMatrixService } from '../../src/modules/life-os/tasks/taskMatrix.service';
import { EisenhowerQuadrant, TaskItem, TaskStatus } from '../../src/modules/life-os/types';

describe('TaskMatrixService', () => {
  it('correctly maps all 4 combinations of urgent/important to quadrants', () => {
    expect(TaskMatrixService.resolveQuadrant(true, true)).toBe(EisenhowerQuadrant.Q1_DO_FIRST);
    expect(TaskMatrixService.resolveQuadrant(false, true)).toBe(EisenhowerQuadrant.Q2_SCHEDULE);
    expect(TaskMatrixService.resolveQuadrant(true, false)).toBe(EisenhowerQuadrant.Q3_DELEGATE);
    expect(TaskMatrixService.resolveQuadrant(false, false)).toBe(EisenhowerQuadrant.Q4_ELIMINATE);
  });

  it('correctly categorizes tasks into matrix buckets and calculates completion throughput', () => {
    const mockTasks: TaskItem[] = [
      {
        id: '1',
        userId: 'u1',
        title: 'Midterm Exam',
        isUrgent: true,
        isImportant: true,
        quadrant: EisenhowerQuadrant.Q1_DO_FIRST,
        status: TaskStatus.COMPLETED,
      },
      {
        id: '2',
        userId: 'u1',
        title: 'Weekly Workout',
        isUrgent: false,
        isImportant: true,
        quadrant: EisenhowerQuadrant.Q2_SCHEDULE,
        status: TaskStatus.PENDING,
      },
      {
        id: '3',
        userId: 'u1',
        title: 'Spam cleanup',
        isUrgent: false,
        isImportant: false,
        quadrant: EisenhowerQuadrant.Q4_ELIMINATE,
        status: TaskStatus.COMPLETED,
      },
    ];

    const result = TaskMatrixService.categorizeMatrix(mockTasks);

    expect(result.matrix[EisenhowerQuadrant.Q1_DO_FIRST].length).toBe(1);
    expect(result.matrix[EisenhowerQuadrant.Q2_SCHEDULE].length).toBe(1);
    expect(result.matrix[EisenhowerQuadrant.Q3_DELEGATE].length).toBe(0);
    expect(result.matrix[EisenhowerQuadrant.Q4_ELIMINATE].length).toBe(1);
    expect(result.metrics.totalTasks).toBe(3);
    expect(result.metrics.completedTasks).toBe(2);
    expect(result.metrics.completionRate).toBe(67);
  });

  it('updates completedAt timestamp accurately on status transitions', () => {
    const fixedNow = new Date('2026-10-20T10:00:00Z');
    const completed = TaskMatrixService.setCompletionStatus(
      TaskStatus.PENDING,
      TaskStatus.COMPLETED,
      fixedNow
    );
    expect(completed.status).toBe(TaskStatus.COMPLETED);
    expect(completed.completedAt).toEqual(fixedNow);

    const reopened = TaskMatrixService.setCompletionStatus(
      TaskStatus.COMPLETED,
      TaskStatus.IN_PROGRESS
    );
    expect(reopened.status).toBe(TaskStatus.IN_PROGRESS);
    expect(reopened.completedAt).toBeNull();
  });
});