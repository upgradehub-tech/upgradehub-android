import { BudgetVarianceReport, LedgerSummary, TransactionType } from '../types';

export interface RawTransaction {
  amount: number | string;
  type: TransactionType;
  categoryId: string;
}

export interface RawCategory {
  id: string;
  name: string;
  type: TransactionType;
  monthlyBudgetCap: number | string | null;
}

export class FinanceLedgerService {
  /**
   * Pure calculation: Aggregates ledger balance and compares monthly expense actuals
   * against designated category caps without float rounding inaccuracies.
   */
  public static calculateLedgerSummary(
    categories: RawCategory[],
    transactions: RawTransaction[]
  ): LedgerSummary {
    let totalIncomeCents = 0;
    let totalExpenseCents = 0;

    // Track actual spending by category in integer cents
    const spendingMap = new Map<string, number>();

    for (const tx of transactions) {
      const amountCents = Math.round(Number(tx.amount) * 100);

      if (tx.type === TransactionType.INCOME) {
        totalIncomeCents += amountCents;
      } else if (tx.type === TransactionType.EXPENSE) {
        totalExpenseCents += amountCents;
        const currentSpent = spendingMap.get(tx.categoryId) ?? 0;
        spendingMap.set(tx.categoryId, currentSpent + amountCents);
      }
    }

    const netSavingsCents = totalIncomeCents - totalExpenseCents;
    const savingsRate =
      totalIncomeCents > 0
        ? Math.max(0, Math.round((netSavingsCents / totalIncomeCents) * 100))
        : 0;

    const categoryReports: BudgetVarianceReport[] = categories
      .filter((cat) => cat.type === TransactionType.EXPENSE)
      .map((cat) => {
        const spentCents = spendingMap.get(cat.id) ?? 0;
        const capCents = cat.monthlyBudgetCap
          ? Math.round(Number(cat.monthlyBudgetCap) * 100)
          : 0;
        const remainingCents = capCents - spentCents;

        const percent =
          capCents > 0 ? Math.round((spentCents / capCents) * 100) : 0;

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          budgetCap: capCents / 100,
          actualSpent: spentCents / 100,
          remainingBalance: remainingCents / 100,
          percentUtilized: percent,
          isOverBudget: capCents > 0 && spentCents > capCents,
        };
      });

    return {
      totalIncome: totalIncomeCents / 100,
      totalExpense: totalExpenseCents / 100,
      netSavings: netSavingsCents / 100,
      savingsRatePercentage: savingsRate,
      categoryReports,
    };
  }
}