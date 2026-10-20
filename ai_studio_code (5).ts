import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { HabitStreakService } from '../../src/modules/life-os/habits/habitStreak.service';
import { FinanceLedgerService } from '../../src/modules/life-os/finance/financeLedger.service';
import { TaskMatrixService } from '../../src/modules/life-os/tasks/taskMatrix.service';
import { WellnessService } from '../../src/modules/life-os/wellness/wellness.service';

const prisma = new PrismaClient();

describe('Life OS Module Integration Test', () => {
  let testUserId: string;

  beforeAll(async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `test.student.${Date.now()}@uni.edu`,
        name: 'Test Student',
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('verifies Eisenhower task workflow from creation to completion', async () => {
    const quadrant = TaskMatrixService.resolveQuadrant(true, true);
    const task = await prisma.task.create({
      data: {
        userId: testUserId,
        title: 'Physics Lab Report',
        isUrgent: true,
        isImportant: true,
        quadrant,
      },
    });

    expect(task.quadrant).toBe('Q1_DO_FIRST');
    expect(task.status).toBe('PENDING');

    const statusTransition = TaskMatrixService.setCompletionStatus(task.status as any, 'COMPLETED' as any);
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: statusTransition.status,
        completedAt: statusTransition.completedAt,
      },
    });

    expect(updated.status).toBe('COMPLETED');
    expect(updated.completedAt).not.toBeNull();
  });

  it('records expenses and calculates budget health with real database records', async () => {
    const category = await prisma.financialCategory.create({
      data: {
        userId: testUserId,
        name: 'Campus Dining',
        type: 'EXPENSE',
        monthlyBudgetCap: 100.0,
      },
    });

    await prisma.financialTransaction.create({
      data: {
        userId: testUserId,
        categoryId: category.id,
        type: 'EXPENSE',
        amount: 85.5,
        description: 'Meal plan top up',
        transactionDate: new Date(),
      },
    });

    const categories = await prisma.financialCategory.findMany({ where: { userId: testUserId } });
    const transactions = await prisma.financialTransaction.findMany({ where: { userId: testUserId } });

    const summary = FinanceLedgerService.calculateLedgerSummary(
      categories.map((c) => ({ ...c, monthlyBudgetCap: c.monthlyBudgetCap ? Number(c.monthlyBudgetCap) : null })),
      transactions.map((t) => ({ ...t, amount: Number(t.amount) }))
    );

    expect(summary.totalExpense).toBe(85.5);
    expect(summary.categoryReports[0].remainingBalance).toBe(14.5);
    expect(summary.categoryReports[0].isOverBudget).toBe(false);
  });

  it('records habit completions and updates streaks in persistent storage', async () => {
    const habit = await prisma.habit.create({
      data: {
        userId: testUserId,
        name: 'Daily 20m Reading',
      },
    });

    const d1 = new Date();
    const d2 = new Date();
    d2.setDate(d2.getDate() - 1);

    await prisma.habitLog.create({
      data: { userId: testUserId, habitId: habit.id, completedDate: new Date(HabitStreakService.toDateString(d2)) },
    });
    await prisma.habitLog.create({
      data: { userId: testUserId, habitId: habit.id, completedDate: new Date(HabitStreakService.toDateString(d1)) },
    });

    const logs = await prisma.habitLog.findMany({ where: { habitId: habit.id } });
    const { currentStreak, longestStreak } = HabitStreakService.computeStreaks(
      logs.map((l) => l.completedDate),
      d1
    );

    const updatedHabit = await prisma.habit.update({
      where: { id: habit.id },
      data: { currentStreak, longestStreak },
    });

    expect(updatedHabit.currentStreak).toBe(2);
    expect(updatedHabit.longestStreak).toBe(2);
  });

  it('records wellness logs and generates composite score', async () => {
    const today = new Date();
    const todayStr = HabitStreakService.toDateString(today);

    await prisma.hydrationLog.create({
      data: { userId: testUserId, logDate: new Date(todayStr), amountMl: 2600, targetMl: 2500 },
    });

    await prisma.sleepLog.create({
      data: {
        userId: testUserId,
        bedtime: new Date(Date.now() - 1000 * 60 * 500),
        wakeTime: today,
        durationMinutes: 480,
        qualityScore: 5,
      },
    });

    await prisma.screenBreakLog.create({
      data: {
        userId: testUserId,
        breakStartedAt: today,
        durationMinutes: 20,
        activityNote: 'Full body mobility routine',
      },
    });

    const hydrations = await prisma.hydrationLog.findMany({ where: { userId: testUserId } });
    const sleeps = await prisma.sleepLog.findMany({ where: { userId: testUserId } });
    const breaks = await prisma.screenBreakLog.findMany({ where: { userId: testUserId } });

    const wellnessAggregate = WellnessService.calculateDailyAggregate(
      todayStr,
      hydrations,
      sleeps,
      breaks
    );

    expect(wellnessAggregate.hydration.targetMet).toBe(true);
    expect(wellnessAggregate.sleep.hygieneMet).toBe(true);
    expect(wellnessAggregate.overallScore).toBeGreaterThanOrEqual(80);
  });
});