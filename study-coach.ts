export type AICoachMode =
  | 'DOUBT_SOLVER'
  | 'SYLLABUS_FAST_TRACK'
  | 'INSTANT_QUESTION_GEN'
  | 'FORMULA_DECODER'
  | 'PYQ_PATTERN_PREDICTOR'
  | 'MOTIVATION_COACH'
  | 'DAILY_TIME_BLOCK_OPTIMIZER'
  | 'MISTAKE_LOG_DIAGNOSTICS';

// Strict whitelist: Only approved academic context is allowed to reach the server AI
export interface ApprovedUserContext {
  targetExam: string;                 // e.g., "JEE Advanced", "NEET", "GATE CS"
  currentSubject: string;             // e.g., "Physics"
  currentTopic: string;               // e.g., "Rotational Dynamics"
  daysRemainingToExam?: number;       // e.g., 45
  availableStudyHoursDaily?: number;  // e.g., 6
  mistakeTags?: string[];             // e.g., ["Calculation Error", "Concept Gap"]
  confidenceLevel?: 'low' | 'medium' | 'high';
}

export interface AICoachRequest {
  mode: AICoachMode;
  userPrompt: string;
  context: ApprovedUserContext;
}

export interface AICoachResponse {
  mode: AICoachMode;
  headline: string;
  content: string;
  actionItems: string[];
  followUpSuggestions: string[];
}
