// 型定義
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  verified: boolean;
  isActive?: boolean; // 削除済みフラグ（false = 削除済み）
  createdAt?: string; // 登録日時
  updatedAt?: string; // 更新日時（同時編集の競合検知に使用）
  username?: string; // ユーザー名
  allowedUnitIds?: string[]; // 学習可能な単元ID（USERのみ、ADMINは常に全単元）
  companyId?: string; // 所属会社ID
  companyName?: string; // 所属会社名
}

export interface Company {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Unit {
  id: string;
  name: string;
  description: string;
  updatedAt?: string; // 更新日時（同時編集の競合検知に使用）
}

export interface Category {
  id: string;
  name: string;
  description: string;
  unitId: string;
  updatedAt?: string; // 更新日時（同時編集の競合検知に使用）
}

export type AnswerMethod = 'radio' | 'checkbox';
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
  updatedAt?: string; // 更新日時（同時編集の競合検知に使用）
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
