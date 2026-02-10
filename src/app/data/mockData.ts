import { Unit, Category, Question, User } from '../types';

export const mockUsers: User[] = [
  {
    id: 'user1',
    email: 'admin@example.com',
    role: 'admin',
    verified: true,
    isActive: true,
    createdAt: '2024-01-15T10:30:00Z',
    username: '管理者 太郎',
    // ADMINは常に全単元（allowedUnitIdsは不要）
  },
  {
    id: 'user2',
    email: 'user1@example.com',
    role: 'user',
    verified: true,
    isActive: true,
    createdAt: '2024-02-01T14:20:00Z',
    username: '山田 太郎',
    allowedUnitIds: ['u1', 'u2'], // プログラミング基礎、Web開発
  },
  {
    id: 'user3',
    email: 'user2@example.com',
    role: 'user',
    verified: true,
    isActive: true,
    createdAt: '2024-02-10T09:15:00Z',
    username: '佐藤 花子',
    allowedUnitIds: ['u1', 'u2', 'u3'], // 全単元
  },
  {
    id: 'user4',
    email: 'user3@example.com',
    role: 'user',
    verified: false,
    isActive: true,
    createdAt: '2024-03-05T16:45:00Z',
    username: '鈴木 一郎',
    allowedUnitIds: [], // 許可単元0件（新規ユーザー例）
  },
  {
    id: 'user5',
    email: 'deleted@example.com',
    role: 'user',
    verified: true,
    isActive: false, // 削除済み
    createdAt: '2024-01-20T11:00:00Z',
    username: '削除済みユーザー',
    allowedUnitIds: ['u1'],
  },
  {
    id: 'user6',
    email: 'admin2@example.com',
    role: 'admin',
    verified: true,
    isActive: true,
    createdAt: '2024-02-20T13:30:00Z',
    // username未設定のADMIN例
    // ADMINは常に全単元
  },
];

export const mockUnits: Unit[] = [
  {
    id: 'u1',
    name: 'プログラミング基礎',
    description: 'プログラミングの基本的な概念と原則',
  },
  {
    id: 'u2',
    name: 'Web開発',
    description: 'HTML、CSS、JavaScriptを使用したWeb開発',
  },
  {
    id: 'u3',
    name: 'データベース',
    description: 'データベースの設計と操作',
  },
];

export const mockCategories: Category[] = [
  {
    id: 'c1',
    name: '変数とデータ型',
    description: '変数の宣言とデータ型について',
    unitId: 'u1',
  },
  {
    id: 'c2',
    name: '制御構文',
    description: '条件分岐とループ処理',
    unitId: 'u1',
  },
  {
    id: 'c3',
    name: 'HTML基礎',
    description: 'HTMLの基本構造とタグ',
    unitId: 'u2',
  },
  {
    id: 'c4',
    name: 'CSS基礎',
    description: 'CSSのセレクタとプロパティ',
    unitId: 'u2',
  },
  {
    id: 'c5',
    name: 'SQL基礎',
    description: 'SQLの基本クエリ',
    unitId: 'u3',
  },
];

export const mockQuestions: Question[] = [
  {
    id: 'q1',
    text: 'JavaScriptで変数を宣言する際、再代入可能な変数を定義するキーワードはどれですか？',
    optionA: 'const',
    optionB: 'let',
    optionC: 'var',
    optionD: 'define',
    correctAnswer: 'B',
    answerMethod: 'checkbox',
    explanation: 'letは再代入可能な変数を定義するキーワードです。constは再代入不可、varは古い書き方です。',
    categoryId: 'c1',
    isActive: true,
    isAssignment: true, // 課題問題
  },
  {
    id: 'q2',
    text: 'JavaScriptのデータ型として正しくないものはどれですか？',
    optionA: 'String',
    optionB: 'Number',
    optionC: 'Integer',
    optionD: 'Boolean',
    correctAnswer: 'C',
    answerMethod: 'checkbox',
    explanation: 'JavaScriptにはIntegerという型はありません。数値はすべてNumber型です。',
    categoryId: 'c1',
    isActive: true,
    isAssignment: true, // 課題問題
  },
  {
    id: 'q3',
    text: 'if文の条件式として適切でないものはどれですか？',
    optionA: 'if (true)',
    optionB: 'if (x > 0)',
    optionC: 'if x > 0',
    optionD: 'if (x === 0)',
    correctAnswer: 'C',
    answerMethod: 'checkbox',
    explanation: 'if文の条件式は必ず括弧()で囲む必要があります。',
    categoryId: 'c2',
    isActive: true,
    isAssignment: false,
  },
  {
    id: 'q4',
    text: 'HTMLで段落を表すタグはどれですか？',
    optionA: '<paragraph>',
    optionB: '<p>',
    optionC: '<para>',
    optionD: '<text>',
    correctAnswer: 'B',
    answerMethod: 'checkbox',
    explanation: '<p>タグが段落を表すHTMLの標準タグです。',
    categoryId: 'c3',
    isActive: true,
    isAssignment: true, // 課題問題
  },
  {
    id: 'q5',
    text: 'CSSで要素の背景色を設定するプロパティはどれですか？',
    optionA: 'color',
    optionB: 'bg-color',
    optionC: 'background-color',
    optionD: 'background',
    correctAnswer: 'C',
    answerMethod: 'checkbox',
    explanation: 'background-colorが背景色を指定する正式なプロパティです。backgroundでも可能ですが、より包括的なプロパティです。',
    categoryId: 'c4',
    isActive: true,
    isAssignment: false,
  },
  {
    id: 'q6',
    text: 'SQLでデータを取得する際に使用するコマンドはどれですか？',
    optionA: 'GET',
    optionB: 'SELECT',
    optionC: 'FETCH',
    optionD: 'RETRIEVE',
    correctAnswer: 'B',
    answerMethod: 'checkbox',
    explanation: 'SELECTがデータを取得するための標準SQLコマンドです。',
    categoryId: 'c5',
    isActive: true,
    isAssignment: true, // 課題問題
  },
  {
    id: 'q7',
    text: 'JavaScriptで配列の要素数を取得するプロパティはどれですか？',
    optionA: 'size',
    optionB: 'count',
    optionC: 'length',
    optionD: 'total',
    correctAnswer: 'C',
    answerMethod: 'checkbox',
    explanation: 'lengthプロパティが配列やstrのようなオブジェクトの要素数を返します。',
    categoryId: 'c1',
    isActive: true,
    isAssignment: false,
  },
  {
    id: 'q8',
    text: 'for文の基本構文として正しいものはどれですか？',
    optionA: 'for i in range(10)',
    optionB: 'for (let i = 0; i < 10; i++)',
    optionC: 'for i = 0 to 10',
    optionD: 'foreach (i in 10)',
    correctAnswer: 'B',
    answerMethod: 'checkbox',
    explanation: 'JavaScriptのfor文は「for (初期化; 条件; 増減)」の形式です。',
    categoryId: 'c2',
    isActive: true,
    isAssignment: true, // 課題問題
  },
];
