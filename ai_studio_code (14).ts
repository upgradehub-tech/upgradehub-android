export enum EisenhowerQuadrant {
  Q1_DO_FIRST = 'Q1_DO_FIRST',       // Urgent & Important
  Q2_SCHEDULE = 'Q2_SCHEDULE',       // Not Urgent & Important
  Q3_DELEGATE = 'Q3_DELEGATE',       // Urgent & Not Important
  Q4_ELIMINATE = 'Q4_ELIMINATE',     // Not Urgent & Not Important
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  isUrgent: boolean;
  isImportant: boolean;
  quadrant: EisenhowerQuadrant;
  status: TaskStatus;
  completedAt?: Date | null;
}

export interface BudgetVarianceReport {
  categoryId: string;
  categoryName: string;
  budgetCap: number;
  actualSpent: number;
  remainingBalance: number;
  percentUtilized: number;
  isOverBudget: boolean;
}

export interface LedgerSummary {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRatePercentage: number;
  categoryReports: BudgetVarianceReport[];
}

export interface DailyWellnessAggregate {
  date: string;
  hydration: {
    consumedMl: number;
    targetMl: number;
    completionPercentage: number;
    targetMet: boolean;
  };
  sleep: {
    durationMinutes: number;
    durationHours: number;
    averageQualityScore: number;
    hygieneMet: boolean; // >= 7 hours (420 mins)
  };
  screenBreaks: {
    totalBreaks: number;
    totalMinutes: number;
    targetMet: boolean; // e.g. at least 3 active breaks recorded
  };
  overallScore: number; // 0 - 100 aggregated wellness indicator
}