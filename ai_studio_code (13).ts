import { EisenhowerQuadrant, TaskItem, TaskStatus } from '../types';

export class TaskMatrixService {
  /**
   * Deterministically resolves which Eisenhower Quadrant a task belongs to.
   */
  public static resolveQuadrant(isUrgent: boolean, isImportant: boolean): EisenhowerQuadrant {
    if (isUrgent && isImportant) {
      return EisenhowerQuadrant.Q1_DO_FIRST;
    }
    if (!isUrgent && isImportant) {
      return EisenhowerQuadrant.Q2_SCHEDULE;
    }
    if (isUrgent && !isImportant) {
      return EisenhowerQuadrant.Q3_DELEGATE;
    }
    return EisenhowerQuadrant.Q4_ELIMINATE;
  }

  /**
   * Partitions tasks into quadrant buckets and calculates completion throughput.
   */
  public static categorizeMatrix(tasks: TaskItem[]) {
    const matrix = {
      [EisenhowerQuadrant.Q1_DO_FIRST]: [] as TaskItem[],
      [EisenhowerQuadrant.Q2_SCHEDULE]: [] as TaskItem[],
      [EisenhowerQuadrant.Q3_DELEGATE]: [] as TaskItem[],
      [EisenhowerQuadrant.Q4_ELIMINATE]: [] as TaskItem[],
    };

    let completedCount = 0;

    for (const task of tasks) {
      const q = this.resolveQuadrant(task.isUrgent, task.isImportant);
      matrix[q].push({ ...task, quadrant: q });
      if (task.status === TaskStatus.COMPLETED) {
        completedCount++;
      }
    }

    const total = tasks.length;
    const completionRate = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    return {
      matrix,
      metrics: {
        totalTasks: total,
        completedTasks: completedCount,
        pendingTasks: total - completedCount,
        completionRate,
      },
    };
  }

  /**
   * State machine validation for marking a task complete/reopening.
   */
  public static setCompletionStatus(
    currentStatus: TaskStatus,
    targetStatus: TaskStatus,
    now: Date = new Date()
  ): { status: TaskStatus; completedAt: Date | null } {
    if (targetStatus === TaskStatus.COMPLETED) {
      return { status: TaskStatus.COMPLETED, completedAt: now };
    }
    return { status: targetStatus, completedAt: null };
  }
}