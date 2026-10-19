export interface AcademicChapterFixture {
  code: string;
  title: string;
  subject: "PHYSICS" | "CHEMISTRY" | "BIOLOGY" | "MATHEMATICS";
  classGrade: number;
  syllabusWeight: number;
  expectedLectures: Array<{
    lectureIndex: number;
    title: string;
    durationMinutes: number;
    externalRefCode: string;
  }>;
  topics: Array<{
    sequenceOrder: number;
    title: string;
    ncertPageStart: number;
    ncertPageEnd: number;
  }>;
  ncertCommandCenter: {
    approvedTables: Array<{
      tableNumber: string;
      title: string;
      pageNumber: number;
      keyTakeaways: string[];
      activeRecallPrompt: string;
    }>;
    approvedGraphs: Array<{
      figureNumber: string;
      title: string;
      pageNumber: number;
      xAxisLabel: string;
      yAxisLabel: string;
      inflectionPointNote: string;
      activeRecallPrompt: string;
    }>;
    reactionExceptions: Array<{
      topicName: string;
      standardTrend: string;
      exceptionRule: string;
      ncertReference: string;
      reason: string;
      frequentTrapNote: string;
    }>;
    lineByLineQuestions: Array<{
      ncertPageRef: number;
      lineReference: string;
      drillType: "FILL_IN_BLANK" | "ASSERTION_REASON" | "STATEMENT_CHECK";
      questionText: string;
      correctAnswer: string;
      explanation: string;
    }>;
  };
}

export const ALDEHYDES_KETONES_FIXTURE: AcademicChapterFixture = {
  code: "CHEM-12-08",
  title: "Aldehydes, Ketones and Carboxylic Acids",
  subject: "CHEMISTRY",
  classGrade: 12,
  syllabusWeight: 1.35,
  expectedLectures: [
    { lectureIndex: 1, title: "Nomenclature & Structure of Carbonyl Group", durationMinutes: 55, externalRefCode: "LEC-AKC-01" },
    { lectureIndex: 2, title: "Preparation of Aldehydes & Ketones (Rosenmund, Stephen, Etard)", durationMinutes: 62, externalRefCode: "LEC-AKC-02" },
    { lectureIndex: 3, title: "Nucleophilic Addition & Condensation Reactions", durationMinutes: 70, externalRefCode: "LEC-AKC-03" },
    { lectureIndex: 4, title: "Oxidation, Reduction, Aldol & Cannizzaro Reactions", durationMinutes: 75, externalRefCode: "LEC-AKC-04" },
    { lectureIndex: 5, title: "Carboxylic Acids: Acid Strength & HVZ Reaction", durationMinutes: 65, externalRefCode: "LEC-AKC-05" }
  ],
  topics: [
    { sequenceOrder: 1, title: "Structure and Physical Properties of Carbonyls", ncertPageStart: 358, ncertPageEnd: 363 },
    { sequenceOrder: 2, title: "Chemical Reactions of Aldehydes and Ketones", ncertPageStart: 364, ncertPageEnd: 377 },
    { sequenceOrder: 3, title: "Carboxylic Acids: Synthesis and Reactivity", ncertPageStart: 378, ncertPageEnd: 389 }
  ],
  ncertCommandCenter: {
    approvedTables: [
      {
        tableNumber: "Table 12.1",
        title: "B.P. Comparison of Carbonyls vs Alcohols and Ethers of Comparable Molecular Mass",
        pageNumber: 362,
        keyTakeaways: [
          "B.P. follows order: Alcohols > Aldehydes/Ketones > Ethers > Hydrocarbons",
          "Carbonyls possess dipole-dipole interactions, lower than intermolecular H-bonding of alcohols."
        ],
        activeRecallPrompt: "Why does n-butane boil lower than methoxyethane, which boils lower than propanal, despite similar molar masses?"
      },
      {
        tableNumber: "Table 12.3",
        title: "Relative Acid Strength Values (pKa values of substituted Carboxylic Acids)",
        pageNumber: 382,
        keyTakeaways: [
          "Trifluoroacetic acid (pKa 0.23) is significantly stronger than acetic acid (pKa 4.76)",
          "Electron-withdrawing groups stabilize carboxylate ion via inductive (-I) and resonance effect."
        ],
        activeRecallPrompt: "List FCH2COOH, ClCH2COOH, BrCH2COOH, and NO2CH2COOH in increasing pKa order."
      }
    ],
    approvedGraphs: [
      {
        figureNumber: "Fig. 12.2",
        title: "Nucleophilic Addition Reactivity Vector on Planar Carbonyl Carbon",
        pageNumber: 366,
        xAxisLabel: "Reaction Coordinate",
        yAxisLabel: "Potential Energy",
        inflectionPointNote: "Transition state converts sp2 planar carbon into sp3 tetrahedral intermediate; steric crowding creates energy barrier in ketones.",
        activeRecallPrompt: "Explain why benzaldehyde is less reactive towards nucleophiles than ethanal."
      }
    ],
    reactionExceptions: [
      {
        topicName: "Cannizzaro Reaction vs Aldol Condensation",
        standardTrend: "Aldehydes with alpha-hydrogens undergo aldol condensation; aldehydes without alpha-hydrogens undergo Cannizzaro.",
        exceptionRule: "2,2-dimethylpropanal (pivalaldehyde) has no alpha-H and undergoes Cannizzaro despite bulky tert-butyl hindrance. Formaldehyde + Benzaldehyde gives selective oxidation of formaldehyde (crossed Cannizzaro).",
        ncertReference: "Page 373, Section 12.4.4",
        reason: "Hydride ion transfers rapidly from the nucleophilic formal-adduct to the less electron-rich benzaldehyde center.",
        frequentTrapNote: "In crossed Cannizzaro with HCHO, HCHO is ALWAYS oxidized to formate salt, aromatic aldehyde is reduced to alcohol."
      },
      {
        topicName: "Fehling's Test with Benzaldehyde",
        standardTrend: "All aldehydes reduce Tollens' and Fehling's reagent.",
        exceptionRule: "Benzaldehyde reduces Tollens' reagent but FAILS to reduce Fehling's solution.",
        ncertReference: "Page 371, Section 12.4.3",
        reason: "Fehling's solution is a weaker oxidizing agent than Tollens' reagent; resonance stabilization of -CHO with benzene ring decreases electrophilicity.",
        frequentTrapNote: "Never mark Fehling's positive for aromatic aldehydes in exam assertions."
      }
    ],
    lineByLineQuestions: [
      {
        ncertPageRef: 360,
        lineReference: "Lines 14-19",
        drillType: "STATEMENT_CHECK",
        questionText: "Statement 1: Rosenmund reduction uses Pd-BaSO4 poisoned with sulfur or quinoline. Statement 2: The poison prevents reduction of acyl chloride into alcohol.",
        correctAnswer: "Both Statement 1 and Statement 2 are TRUE.",
        explanation: "Poisoned Pd prevents secondary reduction of benzaldehyde/alcanal to primary alcohol."
      },
      {
        ncertPageRef: 374,
        lineReference: "Lines 8-12",
        drillType: "FILL_IN_BLANK",
        questionText: "Treatment of ketones with hydrazine followed by heating with KOH in high-boiling solvent such as ethylene glycol gives hydrocarbons. This reaction is named ______.",
        correctAnswer: "Wolff-Kishner reduction",
        explanation: "Wolff-Kishner reduction removes carbonyl oxygen and yields alkanes under basic conditions."
      }
    ]
  }
};