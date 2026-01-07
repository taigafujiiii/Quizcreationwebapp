import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Header } from '../layout/Header';
import { ExitQuizModal } from '../layout/ExitQuizModal';
import { mockQuestions } from '../../data/mockData';
import { Question, QuizAnswer } from '../../types';
import { AlertCircle } from 'lucide-react';

export const Quiz: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, unitId, categoryId, categoryIds, questionCount, courseType } =
    location.state || {};

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showExitModal, setShowExitModal] = useState(false);

  const isAssignmentCourse = courseType === 'assignment';

  useEffect(() => {
    // クイズ問題を取得
    let filtered = mockQuestions.filter((q) => q.isActive);

    if (isAssignmentCourse) {
      // 課題コースの場合：該当カテゴリの課題問題のみ
      filtered = filtered.filter(
        (q) => q.categoryId === categoryId && q.isAssignment
      );
    } else {
      // 自由演習コースの場合：既存のロジック
      if (mode === 'category') {
        filtered = filtered.filter((q) => q.categoryId === categoryId);
      } else if (mode === 'multiple') {
        filtered = filtered.filter((q) => categoryIds.includes(q.categoryId));
      } else if (mode === 'unit') {
        const unitCategories = mockQuestions
          .map((q) => q.categoryId)
          .filter((catId) => {
            const cat = mockQuestions.find((q) => q.categoryId === catId);
            return cat !== undefined;
          });
        filtered = filtered.filter((q) => unitCategories.includes(q.categoryId));
      }

      // 自由演習の場合はシャッフルして指定数だけ取得
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      filtered = shuffled.slice(0, Math.min(questionCount, filtered.length));
    }

    setQuestions(filtered);
  }, [mode, unitId, categoryId, categoryIds, questionCount, courseType, isAssignmentCourse]);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleNext = () => {
    if (!selectedAnswer) return;

    // 回答を保存
    const newAnswer: QuizAnswer = {
      questionId: currentQuestion.id,
      userAnswer: selectedAnswer as QuizAnswer['userAnswer'],
    };
    setAnswers([...answers, newAnswer]);
    setSelectedAnswer('');

    // 次の問題へ or 結果画面へ
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // 結果画面へ遷移
      navigate('/result', {
        state: {
          questions,
          answers: [...answers, newAnswer],
        },
      });
    }
  };

  const handleHomeClick = () => {
    setShowExitModal(true);
  };

  const handleExitConfirm = () => {
    const homeRoute = '/';
    navigate(homeRoute);
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl mb-2">問題が見つかりません</h2>
              <p className="text-gray-600 mb-4">
                選択した条件に該当する問題がありません
              </p>
              <Button onClick={() => navigate('/')}>戻る</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <Header
        courseType={isAssignmentCourse ? 'assignment' : 'free'}
        isQuizAttempt={true}
        onHomeClick={handleHomeClick}
      />

      {/* 中断確認モーダル */}
      <ExitQuizModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        onConfirm={handleExitConfirm}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* コース表示バッジ */}
        {isAssignmentCourse && (
          <div className="mb-4">
            <Badge className="bg-green-600">課題コース</Badge>
          </div>
        )}

        {/* 進捗表示 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">
              問題 {currentIndex + 1} / {questions.length}
            </span>
            <span className="text-sm">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {/* 問題カード */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              問題 {currentIndex + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-lg">{currentQuestion.text}</div>

            <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="A" id="A" />
                  <Label htmlFor="A" className="cursor-pointer flex-1">
                    A. {currentQuestion.optionA}
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="B" id="B" />
                  <Label htmlFor="B" className="cursor-pointer flex-1">
                    B. {currentQuestion.optionB}
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="C" id="C" />
                  <Label htmlFor="C" className="cursor-pointer flex-1">
                    C. {currentQuestion.optionC}
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="D" id="D" />
                  <Label htmlFor="D" className="cursor-pointer flex-1">
                    D. {currentQuestion.optionD}
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="unknown" id="unknown" />
                  <Label htmlFor="unknown" className="cursor-pointer flex-1">
                    わからない
                  </Label>
                </div>
              </div>
            </RadioGroup>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handleNext}
                disabled={!selectedAnswer}
              >
                {currentIndex < questions.length - 1 ? '次へ' : '結果を見る'}
              </Button>
              <p className="text-sm text-center text-gray-500">
                ※ 前の問題には戻れません
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};