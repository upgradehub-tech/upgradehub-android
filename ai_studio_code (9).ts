import { PrismaClient } from '@prisma/client';
import { TaskMatrixService } from '../modules/life-os/tasks/taskMatrix.service';
import { HabitStreakService } from '../modules/life-os/habits/habitStreak.service';

const prisma = new PrismaClient();

export async function seedLifeOS() {
  console.log('🌱 Starting Life OS Data Seeding...');

  // 1. Find or create demo student user
  const demoUser = await prisma.user.upsert({
    where: { email: 'alex.chen@university.edu' },
    update: {},
    create: {
      email: 'alex.chen@university.edu',
      name: 'Alex Chen',
    },
  });

  const userId = demoUser.id;
  console.log(`👤 Using user: ${demoUser.name} (${userId})`);

  // Clean existing Life OS records for this user to ensure idempotency
  await prisma.screenBreakLog.deleteMany({ where: { userId } });
  await prisma.sleepLog.deleteMany({ where: { userId } });
  await prisma.hydrationLog.deleteMany({ where: { userId } });
  await prisma.habitLog.deleteMany({ where: { userId } });
  await prisma.habit.deleteMany({ where: { userId } });
  await prisma.financialTransaction.deleteMany({ where: { userId } });
  await prisma.financialCategory.deleteMany({ where: { userId } });
  await prisma.task.deleteMany({ where: { userId } });

  // -------------------------------------------------------------------
  // 2. Seed Tasks with Eisenhower Matrix
  // -------------------------------------------------------------------
  const taskSeeds = [
    {
      title: 'Submit CS401 Distributed Systems Term Paper',
      description: 'Upload PDF and run final plagiarism/compilation checks.',
      isUrgent: true,
      isImportant: true,
      status: 'IN_PROGRESS' as const,
      estimatedMinutes: 180,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24), // tomorrow
    },
    {
      title: 'Prepare Mock Interviews for Summer Tech Internship',
      description: 'Review system design concepts and dynamic programming patterns.',
      isUrgent: false,
      isImportant: true,
      status: 'PENDING' as const,
      estimatedMinutes: 120,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
    {
      title: 'Reply to Student Council Dinner Doodle Poll',
      description: 'Submit availability for Friday dinner venue choice.',
      isUrgent: true,
      isImportant: false,
      status: 'COMPLETED' as const,
      estimatedMinutes: 5,
      completedAt: new Date(),
    },
    {
      title: 'Sort and browse Reddit thread on mechanical keyboards',
      description: 'Casual reading.',
      isUrgent: false,
      isImportant: false,
      status: 'CANCELLED' as const,
      estimatedMinutes: 45,
    },
  ];

  for (const t of taskSeeds) {
    const quadrant = TaskMatrixService.resolveQuadrant(t.isUrgent, t.isImportant);
    await prisma.task.create({
      data: {
        userId,
        title: t.title,
        description: t.description,
        isUrgent: t.isUrgent,
        isImportant: t.isImportant,
        quadrant,
        status: t.status,
        estimatedMinutes: t.estimatedMinutes,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
      },
    });
  }
  console.log('✅ Tasks seeded');

  // -------------------------------------------------------------------
  // 3. Seed Student Finance Ledger (No external gateways/banks)
  // -------------------------------------------------------------------
  const incomeCat = await prisma.financialCategory.create({
    data: {
      userId,
      name: 'Teaching Assistant Stipend',
      type: 'INCOME',
    },
  });

  const catRent = await prisma.financialCategory.create({
    data: {
      userId,
      name: 'Off-Campus Rent & Utilities',
      type: 'EXPENSE',
      monthlyBudgetCap: 650.0,
      colorHex: '#EF4444',
    },
  });

  const catGroceries = await prisma.financialCategory.create({
    data: {
      userId,
      name: 'Groceries & Meal Prep',
      type: 'EXPENSE',
      monthlyBudgetCap: 250.0,
      colorHex: '#10B981',
    },
  });

  const catCafes = await prisma.financialCategory.create({
    data: {
      userId,
      name: 'Coffee & Campus Snacks',
      type: 'EXPENSE',
      monthlyBudgetCap: 60.0,
      colorHex: '#F59E0B',
    },
  });

  // Transactions
  await prisma.financialTransaction.createMany({
    data: [
      {
        userId,
        categoryId: incomeCat.id,
        type: 'INCOME',
        amount: 1100.0,
        description: 'Bi-weekly TA Payroll',
        transactionDate: new Date('2026-10-01'),
      },
      {
        userId,
        categoryId: catRent.id,
        type: 'EXPENSE',
        amount: 600.0,
        description: 'October Room Share + Fiber Internet',
        transactionDate: new Date('2026-10-02'),
      },
      {
        userId,
        categoryId: catGroceries.id,
        type: 'EXPENSE',
        amount: 142.5,
        description: 'Trader Joes bulk groceries',
        transactionDate: new Date('2026-10-05'),
      },
      {
        userId,
        categoryId: catCafes.id,
        type: 'EXPENSE',
        amount: 38.75,
        description: 'Library cold brew & pastry bundle',
        transactionDate: new Date('2026-10-10'),
      },
    ],
  });
  console.log('✅ Financial ledger seeded');

  // -------------------------------------------------------------------
  // 4. Seed Atomic Habits & Streak History
  // -------------------------------------------------------------------
  const habitLeetCode = await prisma.habit.create({
    data: {
      userId,
      name: 'Solve 1 Hard/Medium LeetCode',
      description: 'Keep algorithmic instincts sharp for technical screens.',
      frequency: 'DAILY',
    },
  });

  // Create 6 consecutive days of completions ending yesterday
  const now = new Date();
  const loggedDates: string[] = [];

  for (let i = 6; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = HabitStreakService.toDateString(d);
    loggedDates.push(dateStr);

    await prisma.habitLog.create({
      data: {
        userId,
        habitId: habitLeetCode.id,
        completedDate: new Date(dateStr),
        notes: `Day ${7 - i} completed on campus`,
      },
    });
  }

  // Recalculate and update streaks
  const { currentStreak, longestStreak } = HabitStreakService.computeStreaks(loggedDates, now);
  await prisma.habit.update({
    where: { id: habitLeetCode.id },
    data: { currentStreak, longestStreak },
  });
  console.log(`✅ Habit seeded: ${habitLeetCode.name} (Current streak: ${currentStreak}, Longest: ${longestStreak})`);

  // -------------------------------------------------------------------
  // 5. Seed Wellness Logs
  // -------------------------------------------------------------------
  const todayStr = HabitStreakService.toDateString(now);

  // Hydration entries
  await prisma.hydrationLog.createMany({
    data: [
      { userId, logDate: new Date(todayStr), amountMl: 750, targetMl: 2500 },
      { userId, logDate: new Date(todayStr), amountMl: 1000, targetMl: 2500 },
      { userId, logDate: new Date(todayStr), amountMl: 500, targetMl: 2500 },
    ],
  });

  // Sleep Entry
  const yesterdayBedtime = new Date(now);
  yesterdayBedtime.setDate(yesterdayBedtime.getDate() - 1);
  yesterdayBedtime.setHours(23, 30, 0, 0);

  const todayWakeTime = new Date(now);
  todayWakeTime.setHours(7, 15, 0, 0);

  await prisma.sleepLog.create({
    data: {
      userId,
      bedtime: yesterdayBedtime,
      wakeTime: todayWakeTime,
      durationMinutes: 465, // 7 hours 45 mins
      qualityScore: 4,
      notes: 'Woke up naturally before alarm, felt rested.',
    },
  });

  // Screen break logs (Pomodoro detox pauses)
  await prisma.screenBreakLog.createMany({
    data: [
      {
        userId,
        breakStartedAt: new Date(Date.now() - 1000 * 60 * 180),
        durationMinutes: 10,
        activityNote: 'Walked outside and did 20-20-20 eye rest rule',
      },
      {
        userId,
        breakStartedAt: new Date(Date.now() - 1000 * 60 * 90),
        durationMinutes: 15,
        activityNote: 'Hamstring stretching and water refill',
      },
      {
        userId,
        breakStartedAt: new Date(Date.now() - 1000 * 60 * 20),
        durationMinutes: 5,
        activityNote: 'Quick breathing exercise',
      },
    ],
  });

  console.log('✅ Wellness data seeded');
  console.log('🎉 Life OS Module seeded successfully!');
}

if (require.main === module) {
  seedLifeOS()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}