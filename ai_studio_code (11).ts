export class HabitStreakService {
  /**
   * Normalizes a date or date-string to UTC 'YYYY-MM-DD'
   */
  public static toDateString(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  /**
   * Deterministically calculates current streak and longest streak from an array of logged dates.
   * Handles today vs yesterday seamlessly without timezone drift.
   *
   * @param completionDates Array of completed Date objects or ISO strings
   * @param referenceDate The "anchor" day to calculate against (defaults to today)
   */
  public static computeStreaks(
    completionDates: (Date | string)[],
    referenceDate: Date = new Date()
  ): { currentStreak: number; longestStreak: number } {
    if (!completionDates || completionDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Set of unique sorted ISO date strings (descending)
    const uniqueSortedDays = Array.from(
      new Set(completionDates.map((d) => this.toDateString(d)))
    ).sort((a, b) => b.localeCompare(a));

    if (uniqueSortedDays.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Determine current streak
    const refDayStr = this.toDateString(referenceDate);
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.toDateString(yesterday);

    let currentStreak = 0;
    const latestLoggedDay = uniqueSortedDays[0];

    // Current streak is valid only if latest log was today or yesterday
    if (latestLoggedDay === refDayStr || latestLoggedDay === yesterdayStr) {
      let expectedDate = new Date(latestLoggedDay);

      for (const logDay of uniqueSortedDays) {
        const expectedDateStr = this.toDateString(expectedDate);
        if (logDay === expectedDateStr) {
          currentStreak++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Determine all-time longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let cursorDate: Date | null = null;

    // Iterate through dates in chronological order (ascending)
    const ascendingDays = [...uniqueSortedDays].reverse();

    for (const logDay of ascendingDays) {
      const currentDay = new Date(logDay);

      if (!cursorDate) {
        tempStreak = 1;
      } else {
        const nextExpected = new Date(cursorDate);
        nextExpected.setDate(nextExpected.getDate() + 1);

        if (this.toDateString(nextExpected) === logDay) {
          tempStreak++;
        } else {
          tempStreak = 1; // broken streak
        }
      }

      cursorDate = currentDay;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
    };
  }
}