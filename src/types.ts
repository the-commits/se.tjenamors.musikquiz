export interface Question {
  id: string | number;
  artist: string;
  title: string;
  youtube_link?: string;
  preview_url?: string;
  cover_url?: string; // YouTube video ID, e.g. "unfzfe8f9NI"
  start_time: number; // Seconds to start
  options: string[]; // exactly 4 options
  correct_index: number; // 0-3
}

export interface Player {
  id: string;
  name: string;
  score: number;
  hasAnswered: boolean;
  lastAnswerCorrect: boolean | null;
  lastAnswerPoints: number;
  color: string; // Visual tag color
}

export type RoomStatus = 'lobby' | 'buffering' | 'countdown' | 'question' | 'slow_reveal' | 'scoreboard' | 'ended';

export interface PresetInfo {
  id: string;
  name: string;
  description: string;
  songCount: number;
  playCount: number;
  isDefault?: boolean;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  players: Player[];
  presets?: PresetInfo[];
  questions: Question[];
  currentQuestionIndex: number;
  questionTimer: number; // Seconds remaining
  questionDuration: number; // Default total
  answersCount: number;
  countdown: number; // 5..0 before question starts
}

export type SocketMessage =
  | { type: 'room_state'; state: RoomState }
  | { type: 'join_success'; playerId: string; roomCode: string }
  | { type: 'host_created'; roomCode: string; questions: Question[] }
  | { type: 'error'; message: string }
  | { type: 'answer_result'; isCorrect: boolean; points: number; correctIndex: number }
  | { type: 'game_over'; players: Player[] };
