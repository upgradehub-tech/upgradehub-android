export interface StudySessionLog {
  id: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  subject: string;
  questionsAttempted: number;
  questionsCorrect: number;
}

export interface WeeklyEfficiency {
  weekIdentifier: string; // e.g. "2026-W42"
  studyHours: number;
  accuracy: number;
  throughputQuesPerHour: number;
  efficiencyIndex: number; // Formula: (Accuracy/100) * (Throughput / 30) * BaseHoursFactor
}

export interface TrendDataPoint {
  date: string;
  studyMinutes: number;
  accuracy: number;
  rollingAvgAccuracy: number;
  cumulativeHours: number;
}

export interface SubjectHeatmapCell {
  date: string;
  subject: string;
  intensity: number; // 0 to 4 scale
  minutesSpent: number;
  accuracy: number;
}

export class AnalyticsPipeline {
  constructor(private sessions: StudySessionLog[]) {}

  /**
   * Aggregate total study hours by subject or overall
   */
  public aggregateStudyHours(subject?: string): number {
    return (
      this.sessions
        .filter(s => !subject || s.subject.toLowerCase() === subject.toLowerCase())
        .reduce((sum, s) => sum + s.durationMinutes, 0) / 60
    );
  }

  /**
   * Calculate Weekly Efficiency
   * Efficiency Index: Measures quality alongside volume.
   * Standard benchmark: 30 Q/hr at 80% accuracy = 1.0 index benchmark.
   */
  public calculateWeeklyEfficiency(): WeeklyEfficiency[] {
    const weeklyMap = new Map<string, StudySessionLog[]>();

    this.sessions.forEach(s => {
      const d = new Date(s.date);
      // ISO Week calculation
      const tempDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tempDate.getUTCDay() || 7;
      tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      const key = `${tempDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

      if (!weeklyMap.has(key)) weeklyMap.set(key, []);
      weeklyMap.get(key)!.push(s);
    });

    return Array.from(weeklyMap.entries()).map(([weekIdentifier, logs]) => {
      const totalMinutes = logs.reduce((acc, l) => acc + l.durationMinutes, 0);
      const totalHours = totalMinutes / 60;
      const totalQ = logs.reduce((acc, l) => acc + l.questionsAttempted, 0);
      const totalCorrect = logs.reduce((acc, l) => acc + l.questionsCorrect, 0);

      const accuracy = totalQ > 0 ? (totalCorrect / totalQ) * 100 : 0;
      const throughputQuesPerHour = totalHours > 0 ? totalQ / totalHours : 0;
      
      // Normalized benchmark
      const efficiencyIndex = Number(
        ((accuracy / 100) * (throughputQuesPerHour / 30) * Math.min(totalHours / 15, 1.2)).toFixed(2)
      );

      return {
        weekIdentifier,
        studyHours: Number(totalHours.toFixed(1)),
        accuracy: Number(accuracy.toFixed(1)),
        throughputQuesPerHour: Number(throughputQuesPerHour.toFixed(1)),
        efficiencyIndex
      };
    }).sort((a, b) => a.weekIdentifier.localeCompare(b.weekIdentifier));
  }

  /**
   * Generates Subject Heatmap (Date x Subject Matrix)
   */
  public generateSubjectHeatmap(daysBack: number = 30): SubjectHeatmapCell[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    const relevant = this.sessions.filter(s => new Date(s.date) >= cutoff);
    const map = new Map<string, { minutes: number; attempted: number; correct: number }>();

    for (const s of relevant) {
      const key = `${s.date}__${s.subject}`;
      const curr = map.get(key) || { minutes: 0, attempted: 0, correct: 0 };
      map.set(key, {
        minutes: curr.minutes + s.durationMinutes,
        attempted: curr.attempted + s.questionsAttempted,
        correct: curr.correct + s.questionsCorrect
      });
    }

    return Array.from(map.entries()).map(([key, data]) => {
      const [date, subject] = key.split('__');
      const accuracy = data.attempted > 0 ? (data.correct / data.attempted) * 100 : 0;

      // Scale 0-4 intensity based on minutes
      let intensity = 0;
      if (data.minutes > 180) intensity = 4;
      else if (data.minutes > 120) intensity = 3;
      else if (data.minutes > 60) intensity = 2;
      else if (data.minutes > 0) intensity = 1;

      return {
        date,
        subject,
        intensity,
        minutesSpent: data.minutes,
        accuracy: Number(accuracy.toFixed(1))
      };
    });
  }

  /**
   * Generates 7-Day or 60-Day Trend Aggregations with Rolling Moving Averages
   */
  public generateTrendAnalytics(daysWindow: 7 | 60): TrendDataPoint[] {
    const sorted = [...this.sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const groupedByDate = new Map<string, { minutes: number; attempted: number; correct: number }>();
    sorted.forEach(s => {
      const curr = groupedByDate.get(s.date) || { minutes: 0, attempted: 0, correct: 0 };
      groupedByDate.set(s.date, {
        minutes: curr.minutes + s.durationMinutes,
        attempted: curr.attempted + s.questionsAttempted,
        correct: curr.correct + s.questionsCorrect
      });
    });

    const dates = Array.from(groupedByDate.keys()).slice(-daysWindow);
    let cumulativeHours = 0;
    const points: TrendDataPoint[] = [];

    dates.forEach((date, index) => {
      const data = groupedByDate.get(date)!;
      cumulativeHours += data.minutes / 60;
      const dayAccuracy = data.attempted > 0 ? (data.correct / data.attempted) * 100 : 0;

      // 3-day trailing window for rolling average
      const windowStart = Math.max(0, index - 2);
      const subDates = dates.slice(windowStart, index + 1);
      let subAttempted = 0;
      let subCorrect = 0;
      subDates.forEach(d => {
        const item = groupedByDate.get(d)!;
        subAttempted += item.attempted;
        subCorrect += item.correct;
      });
      const rollingAvg = subAttempted > 0 ? (subCorrect / subAttempted) * 100 : dayAccuracy;

      points.push({
        date,
        studyMinutes: data.minutes,
        accuracy: Number(dayAccuracy.toFixed(1)),
        rollingAvgAccuracy: Number(rollingAvg.toFixed(1)),
        cumulativeHours: Number(cumulativeHours.toFixed(1))
      });
    });

    return points;
  }
}