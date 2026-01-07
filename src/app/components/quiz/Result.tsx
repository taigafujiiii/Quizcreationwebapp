import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Header } from '../layout/Header';
import { Question, QuizAnswer, QuizResult } from '../../types';
import { CheckCircle, XCircle, Home } from 'lucide-react';

export const Result: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { questions, answers } = location.state as {
    questions: Question[];
    answers: QuizAnswer[];
  };

  // 結果を計算
  const results: QuizResult[] = questions.map((question, index) => {
    const answer = answers[index];
    const isCorrect =
      answer.userAnswer !== 'unknown' &&
      answer.userAnswer === question.correctAnswer;

    return {
      questionId: question.id,
      questionText: question.text,
      userAnswer: answer.userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.explanation,
    };
  });

  const correctCount = results.filter((r) => r.isCorrect).length;
  const totalCount = results.length;
  const percentage = Math.round((correctCount / totalCount) * 100);

  const getAnswerLabel = (answer: string) => {
    if (answer === 'unknown') return 'わからない';
    return answer;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* サマリーカード */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">クイズ結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-6xl">
                {correctCount} / {totalCount}
              </div>
              <div className="text-2xl text-gray-600">
                正答率: {percentage}%
              </div>
              <div className="flex justify-center gap-4 pt-4">
                <Button onClick={() => navigate('/')} size="lg">
                  <Home className="h-4 w-4 mr-2" />
                  ホームに戻る
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 詳細結果 */}
        <div className="space-y-4">
          <h2 className="text-xl">詳細結果</h2>
          {results.map((result, index) => (
            <Card key={result.questionId}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">問題 {index + 1}</span>
                      <Badge variant={result.isCorrect ? 'default' : 'destructive'}>
                        {result.isCorrect ? '正解' : '不正解'}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">
                      {result.questionText}
                    </CardTitle>
                  </div>
                  {result.isCorrect ? (
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">あなたの回答: </span>
                    <span
                      className={
                        result.isCorrect
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {getAnswerLabel(result.userAnswer)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">正解: </span>
                    <span className="text-green-600">
                      {result.correctAnswer}
                    </span>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-gray-700">
                    <strong>解説:</strong> {result.explanation}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Button onClick={() => navigate('/')} variant="outline" size="lg">
            <Home className="h-4 w-4 mr-2" />
            ホームに戻る
          </Button>
        </div>
      </div>
    </div>
  );
};