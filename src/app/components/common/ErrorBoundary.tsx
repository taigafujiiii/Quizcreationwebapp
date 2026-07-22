import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * トップレベル ErrorBoundary。
 * Suspense の遅延ロード失敗や描画時例外での白画面クラッシュを、
 * フォールバック UI に緩和する安全網。
 * router 非依存のクラスコンポーネントとし、Router 内外どちらでも安全に動作する。
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 開発時の切り分け用にログ出力（外部監視サービス連携は本チケット範囲外）
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <div className="text-gray-700">
              予期しないエラーが発生しました。
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
