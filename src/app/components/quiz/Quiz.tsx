import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Header } from '../layout/Header';
import { ExitQuizModal } from '../layout/ExitQuizModal';
import { Question, QuizAnswer } from '../../types';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAssignmentCourse = courseType === 'assignment';

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      setError('');

      let query = supabase
        .from('questions')
        .select(
          'id, text, optionA:option_a, optionB:option_b, optionC:option_c, optionD:option_d, correctAnswer:correct_answer, answerMethod:answer_method, explanation, categoryId:category_id, isActive:is_active, isAssignment:is_assignment'
        )
        .eq('is_active', true);

      if (isAssignmentCourse) {
        if (!categoryId) {
          setError('カテゴリが選択されていません');
          setLoading(false);
          return;
        }
        query = query.eq('category_id', categoryId).eq('is_assignment', true);
      } else {
        if (mode === 'category') {
          query = query.eq('category_id', categoryId);
        } else if (mode === 'multiple') {
          if (Array.isArray(categoryIds) && categoryIds.length > 0) {
            query = query.in('category_id', categoryIds);
          }
        } else if (mode === 'unit') {
          if (unitId) {
            const { data: unitCategories } = await supabase
              .from('categories')
              .select('id')
              .eq('unit_id', unitId);
            const unitCategoryIds = (unitCategories || []).map((c) => c.id);
            if (unitCategoryIds.length > 0) {
              query = query.in('category_id', unitCategoryIds);
            } else {
              setQuestions([]);
              setLoading(false);
              return;
            }
          }
        }
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        setError('問題の取得に失敗しました');
        setLoading(false);
        return;
      }

      let filtered = (data as Question[]) || [];

      if (!isAssignmentCourse) {
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);
        const count = Number(questionCount) || 10;
        filtered = shuffled.slice(0, Math.min(count, shuffled.length));
      }

      setQuestions(filtered);
      setLoading(false);
    };

    void loadQuestions();
  }, [mode, unitId, categoryId, categoryIds, questionCount, courseType, isAssignmentCourse]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleNext = () => {
    if (!selectedAnswer || !currentQuestion) return;

    const newAnswer: QuizAnswer = {
      questionId: currentQuestion.id,
      userAnswer: selectedAnswer as QuizAnswer['userAnswer'],
    };
    setAnswers([...answers, newAnswer]);
    setSelectedAnswer('');

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
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
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center text-gray-500">読み込み中...</CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl mb-2">エラー</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/')}>戻る</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      <Header
        courseType={isAssignmentCourse ? 'assignment' : 'free'}
        isQuizAttempt={true}
        onHomeClick={handleHomeClick}
      />

      <ExitQuizModal
        open={showExitModal}
        onOpenChange={setShowExitModal}
        onConfirm={handleExitConfirm}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {isAssignmentCourse && (
          <div className="mb-4">
            <Badge className="bg-green-600">課題コース</Badge>
          </div>
        )}

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">
              問題 {currentIndex + 1} / {questions.length}
            </span>
            <span className="text-sm">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              問題 {currentIndex + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-lg">{currentQuestion.text}</div>

            {currentQuestion.answerMethod === 'dropdown' ? (
              <div className="space-y-2">
                <Label>回答</Label>
                <Select value={selectedAnswer || undefined} onValueChange={setSelectedAnswer}>
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A. {currentQuestion.optionA}</SelectItem>
                    <SelectItem value="B">B. {currentQuestion.optionB}</SelectItem>
                    <SelectItem value="C">C. {currentQuestion.optionC}</SelectItem>
                    <SelectItem value="D">D. {currentQuestion.optionD}</SelectItem>
                    <SelectItem value="unknown">わからない</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                {(
                  [
                    { value: 'A', label: `A. ${currentQuestion.optionA}` },
                    { value: 'B', label: `B. ${currentQuestion.optionB}` },
                    { value: 'C', label: `C. ${currentQuestion.optionC}` },
                    { value: 'D', label: `D. ${currentQuestion.optionD}` },
                    { value: 'unknown', label: 'わからない' },
                  ] as const
                ).map((opt) => {
                  const id = `answer-${currentQuestion.id}-${opt.value}`;
                  const checked = selectedAnswer === opt.value;
                  return (
                    <div
                      key={opt.value}
                      className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedAnswer(checked ? '' : opt.value)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedAnswer(checked ? '' : opt.value);
                        }
                      }}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(next) => setSelectedAnswer(next ? opt.value : '')}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Label htmlFor={id} className="cursor-pointer flex-1">
                        {opt.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}

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
