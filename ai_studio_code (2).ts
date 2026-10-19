import { PrismaClient } from "@prisma/client";

export class NCERTCommandCenterService {
  constructor(private prisma: PrismaClient) {}

  public async getChapterDossier(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        ncertTables: true,
        ncertGraphs: true,
        ncertExceptions: true,
        ncertDrills: true,
        topics: {
          orderBy: { sequenceOrder: "asc" },
        },
      },
    });

    if (!chapter) {
      throw new Error(`Chapter not found for ID: ${chapterId}`);
    }

    return {
      chapterId: chapter.id,
      chapterCode: chapter.code,
      title: chapter.title,
      topics: chapter.topics,
      commandCenter: {
        tables: chapter.ncertTables,
        graphs: chapter.ncertGraphs,
        reactionExceptions: chapter.ncertExceptions,
        drillsCount: chapter.ncertDrills.length,
      },
    };
  }

  public async getActiveRecallCards(chapterId: string) {
    const [tables, graphs, exceptions] = await Promise.all([
      this.prisma.ncertTable.findMany({ where: { chapterId } }),
      this.prisma.ncertGraph.findMany({ where: { chapterId } }),
      this.prisma.ncertException.findMany({ where: { chapterId } }),
    ]);

    const flashcards = [
      ...tables.map((t) => ({
        id: t.id,
        sourceType: "TABLE" as const,
        identifier: t.tableNumber,
        prompt: t.activeRecallPrompt,
        referencePage: t.pageNumber,
        solution: t.keyTakeaways.join(" | "),
      })),
      ...graphs.map((g) => ({
        id: g.id,
        sourceType: "GRAPH" as const,
        identifier: g.figureNumber,
        prompt: g.activeRecallPrompt,
        referencePage: g.pageNumber,
        solution: `X: ${g.xAxisLabel}, Y: ${g.yAxisLabel}. Trend Note: ${g.inflectionPointNote}`,
      })),
      ...exceptions.map((e) => ({
        id: e.id,
        sourceType: "REACTION_EXCEPTION" as const,
        identifier: e.topicName,
        prompt: `Trend: ${e.standardTrend}. What is the exact exception and rationale?`,
        referencePage: e.ncertReference,
        solution: `Rule: ${e.exceptionRule}. Reason: ${e.reason}. Trap: ${e.frequentTrapNote}`,
      })),
    ];

    return flashcards;
  }

  public async evaluateLineByLineAnswer(drillQuestionId: string, studentAnswer: string) {
    const drill = await this.prisma.ncertDrillQuestion.findUnique({
      where: { id: drillQuestionId },
    });

    if (!drill) {
      throw new Error("Drill question does not exist");
    }

    const isCorrect =
      drill.correctAnswer.trim().toLowerCase() === studentAnswer.trim().toLowerCase();

    return {
      drillId: drill.id,
      isCorrect,
      expected: drill.correctAnswer,
      explanation: drill.explanation,
      lineReference: drill.lineReference,
      pageNumber: drill.ncertPageRef,
    };
  }
}