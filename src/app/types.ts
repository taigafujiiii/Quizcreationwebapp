// 型定義
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  verified: boolean;
  isActive?: boolean; // 削除済みフラグ（false = 削除済み）
  createdAt?: string; // 登録日時
  username?: string; // ユーザー名
  allowedUnitIds?: string[]; // 学習可能な単元ID（USERのみ、ADMINは常に全単元）
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

export type AnswerMethod = 'dropdown' | 'checkbox';

export interface Question {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  answerMethod: AnswerMethod;
  explanation: string;
  categoryId: string;
  isActive: boolean;
  isAssignment?: boolean; // 課題フラグ
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
export type CourseType = 'free' | 'assignment'; // コースタイプ追加
