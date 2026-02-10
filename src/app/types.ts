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
export type Choice = 'A' | 'B' | 'C' | 'D';
// correctAnswer / userAnswer are stored as comma-separated values like "A,B" for checkbox answers.
export type MultiChoiceAnswer = string;

export interface Question {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: MultiChoiceAnswer;
  answerMethod: AnswerMethod;
  explanation: string;
  categoryId: string;
  isActive: boolean;
  isAssignment?: boolean; // 課題フラグ
}

export interface QuizAnswer {
  questionId: string;
  userAnswer: MultiChoiceAnswer | 'unknown';
}

export interface QuizResult {
  questionId: string;
  questionText: string;
  userAnswer: MultiChoiceAnswer | 'unknown';
  correctAnswer: MultiChoiceAnswer;
  isCorrect: boolean;
  explanation: string;
}

export type QuizMode = 'unit' | 'category' | 'multiple';
export type CourseType = 'free' | 'assignment'; // コースタイプ追加
