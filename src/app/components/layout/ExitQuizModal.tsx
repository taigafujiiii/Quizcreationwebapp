import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertCircle } from 'lucide-react';

interface ExitQuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const ExitQuizModal: React.FC<ExitQuizModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-yellow-100 rounded-full p-2">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <DialogTitle>回答を中断しますか？</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            ホームに戻ると、現在の回答を中断します。
            <br />
            回答の進捗は保存されませんが、よろしいですか？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700"
          >
            中断してホームへ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};