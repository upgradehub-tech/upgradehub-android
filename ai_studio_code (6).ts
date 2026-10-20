import { describe, it, expect } from 'vitest';
import { HabitStreakService } from '../../src/modules/life-os/habits/habitStreak.service';

describe('HabitStreakService', () => {
  const refDate = new Date('2026-10-20T12:00:00Z');

  it('returns 0 streak when no completion logs exist', () => {
    const { currentStreak, longestStreak } = HabitStreakService.computeStreaks([], refDate);
    expect(currentStreak).toBe(0);
    expect(longestStreak).toBe(0);
  });

  it('calculates continuous streak completed up to today', () => {
    const logs = ['2026-10-20', '2026-10-19', '2026-10-18', '2026-10-17'];
    const { currentStreak, longestStreak } = HabitStreakService.computeStreaks(logs, refDate);
    expect(currentStreak).toBe(4);
    expect(longestStreak).toBe(4);
  });

  it('keeps current streak active if yesterday was logged but today is not logged yet', () => {
    const logs = ['2026-10-19', '2026-10-18', '2026-10-17'];
    const { currentStreak, longestStreak } = HabitStreakService.computeStreaks(logs, refDate);
    expect(currentStreak).toBe(3);
    expect(longestStreak).toBe(3);
  });

  it('resets current streak to 0 if missed yesterday and today', () => {
    const logs = ['2026-10-18', '2026-10-17', '2026-10-16'];
    const { currentStreak, longestStreak } = HabitStreakService.computeStreaks(logs, refDate);
    expect(currentStreak).toBe(0);
    expect(longestStreak).toBe(3);
  });

  it('preserves historical longest streak even after current streak resets', () => {
    const logs = [
      '2026-10-20', // current streak = 1
      // gap on 10-19
      '2026-10-15',
      '2026-10-14',
      '2026-10-13',
      '2026-10-12',
      '2026-10-11', // 5-day historical streak
    ];
    const { currentStreak, longestStreak } = HabitStreakService.computeStreaks(logs, refDate);
    expect(currentStreak).toBe(1);
    expect(longestStreak).toBe(5);
  });
});