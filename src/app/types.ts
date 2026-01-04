// 型定義
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  verified: boolean;
}

export interface Unit {
  id: string;
  name: string;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  unitId: string;
}

export interface Question {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  categoryId: string;
  isActive: boolean;
}

export interface QuizAnswer {
  questionId: string;
  userAnswer: 'A' | 'B' | 'C' | 'D' | 'unknown';
}

export interface QuizResult {
  questionId: string;
  questionText: string;
  userAnswer: 'A' | 'B' | 'C' | 'D' | 'unknown';
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  explanation: string;
}

export type QuizMode = 'unit' | 'category' | 'multiple';
