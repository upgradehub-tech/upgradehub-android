export interface StudyRoom {
  id: string;
  name: string;
  topic: string;
  activeParticipants: number;
  pomodoroState: 'focus' | 'break';
  timerSecondsRemaining: number;
}

export interface DiscussionThread {
  id: string;
  subject: string;
  title: string;
  query: string;
  upvotes: number;
  hasVerifiedAnswer: boolean;
  replyCount: number;
}

export interface WeeklyContest {
  id: string;
  title: string;
  subject: string;
  scheduledTime: string;
  questionCount: number;
  durationMinutes: number;
  rewardPoints: number;
  registeredCount: number;
}

export interface QuestionOfTheDay {
  id: string;
  subject: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  pointsEarned: number;
}

export interface AcademicMeme {
  id: string;
  templateName: string;
  topText: string;
  bottomText: string;
  upvotes: number;
  subjectTag: string;
}

export interface LeaderboardEntry {
  rank: number;
  callsign: string;
  points: number;
  studyMinutes: number;
  qotdStreak: number;
  tier: 'Diamond' | 'Platinum' | 'Gold' | 'Silver';
}

export interface ClaimableReward {
  id: string;
  title: string;
  requiredPoints: number;
  category: 'streak_freeze' | 'campus_badge' | 'custom_flair' | 'mock_exam_unlock';
  claimed: boolean;
}
