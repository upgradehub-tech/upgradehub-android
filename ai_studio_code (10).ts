import { DailyWellnessAggregate } from '../types';

export interface RawHydration {
  amountMl: number;
  targetMl: number;
}

export interface RawSleep {
  durationMinutes: number;
  qualityScore: number;
}

export interface RawScreenBreak {
  durationMinutes: number;
}

export class WellnessService {
  /**
   * Evaluates wellness telemetry for a given day and computes a composite index (0-100)
   */
  public static calculateDailyAggregate(
    dateStr: string,
    hydrationLogs: RawHydration[],
    sleepLogs: RawSleep[],
    screenBreaks: RawScreenBreak[]
  ): DailyWellnessAggregate {
    // 1. Hydration
    const totalMl = hydrationLogs.reduce((acc, cur) => acc + cur.amountMl, 0);
    const targetMl = hydrationLogs.length > 0 ? hydrationLogs[0].targetMl : 2500;
    const hydrationPct = Math.min(100, Math.round((totalMl / targetMl) * 100));
    const hydrationMet = totalMl >= targetMl;

    // 2. Sleep
    const totalSleepMins = sleepLogs.reduce((acc, cur) => acc + cur.durationMinutes, 0);
    const totalQuality = sleepLogs.reduce((acc, cur) => acc + cur.qualityScore, 0);
    const avgQuality = sleepLogs.length > 0 ? Number((totalQuality / sleepLogs.length).toFixed(1)) : 0;
    const sleepHygieneMet = totalSleepMins >= 420; // 7 Hours minimum

    // 3. Screen Breaks
    const totalBreaks = screenBreaks.length;
    const totalBreakMinutes = screenBreaks.reduce((acc, cur) => acc + cur.durationMinutes, 0);
    const breaksMet = totalBreaks >= 3 && totalBreakMinutes >= 15;

    // 4. Composite Score Calculation (Weight: Hydration 30%, Sleep 50%, Breaks 20%)
    let score = 0;

    // Hydration contribution: up to 30 pts
    score += Math.round((hydrationPct / 100) * 30);

    // Sleep contribution: up to 50 pts
    const sleepDurationPct = Math.min(1, totalSleepMins / 480); // 8h is optimal
    const sleepQualityPct = avgQuality / 5;
    const sleepCombined = sleepDurationPct * 0.7 + sleepQualityPct * 0.3;
    score += Math.round(sleepCombined * 50);

    // Screen Break contribution: up to 20 pts
    const breakScore = Math.min(20, totalBreaks * 6.6);
    score += Math.round(breakScore);

    return {
      date: dateStr,
      hydration: {
        consumedMl: totalMl,
        targetMl,
        completionPercentage: hydrationPct,
        targetMet: hydrationMet,
      },
      sleep: {
        durationMinutes: totalSleepMins,
        durationHours: Number((totalSleepMins / 60).toFixed(1)),
        averageQualityScore: avgQuality,
        hygieneMet: sleepHygieneMet,
      },
      screenBreaks: {
        totalBreaks,
        totalMinutes: totalBreakMinutes,
        targetMet: breaksMet,
      },
      overallScore: Math.min(100, Math.max(0, score)),
    };
  }
}