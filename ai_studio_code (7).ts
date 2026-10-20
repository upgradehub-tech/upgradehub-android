import { describe, it, expect } from 'vitest';
import { FinanceLedgerService } from '../../src/modules/life-os/finance/financeLedger.service';
import { TransactionType } from '../../src/modules/life-os/types';

describe('FinanceLedgerService', () => {
  it('calculates net balance and prevents floating point rounding drift', () => {
    const categories = [
      { id: 'cat-groceries', name: 'Groceries', type: TransactionType.EXPENSE, monthlyBudgetCap: 200.0 },
      { id: 'cat-entertainment', name: 'Games', type: TransactionType.EXPENSE, monthlyBudgetCap: 50.0 },
    ];

    const transactions = [
      { amount: 1000.05, type: TransactionType.INCOME, categoryId: 'inc' },
      { amount: 70.1, type: TransactionType.EXPENSE, categoryId: 'cat-groceries' },
      { amount: 129.95, type: TransactionType.EXPENSE, categoryId: 'cat-groceries' },
      { amount: 60.0, type: TransactionType.EXPENSE, categoryId: 'cat-entertainment' },
    ];

    const summary = FinanceLedgerService.calculateLedgerSummary(categories, transactions);

    expect(summary.totalIncome).toBe(1000.05);
    expect(summary.totalExpense).toBe(260.05);
    expect(summary.netSavings).toBe(740.0);
    expect(summary.savingsRatePercentage).toBe(74);

    const groceryReport = summary.categoryReports.find((c) => c.categoryId === 'cat-groceries')!;
    expect(groceryReport.actualSpent).toBe(200.05);
    expect(groceryReport.remainingBalance).toBe(-0.05);
    expect(groceryReport.isOverBudget).toBe(true);

    const gamesReport = summary.categoryReports.find((c) => c.categoryId === 'cat-entertainment')!;
    expect(gamesReport.actualSpent).toBe(60.0);
    expect(gamesReport.isOverBudget).toBe(true);
  });
});