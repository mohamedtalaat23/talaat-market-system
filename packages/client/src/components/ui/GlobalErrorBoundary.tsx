import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React boundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] p-6 text-center animate-fade-in">
          <div className="bg-rose-950/20 border border-rose-900/30 rounded-full p-4 mb-4">
            <AlertTriangle size={32} className="text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-neutral-400 text-sm max-w-md mb-6">
            An unexpected error occurred in this section of the application. The issue has been
            logged. You can try reloading this view.
          </p>
          <div className="p-4 bg-black/40 rounded-lg text-left overflow-auto max-w-2xl w-full mb-6 border border-neutral-800">
            <pre className="text-rose-400 text-xs font-mono whitespace-pre-wrap">
              {this.state.error?.message || 'Unknown render error'}
            </pre>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={this.handleReset}
              className="flex items-center space-x-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-neutral-700"
            >
              <RefreshCw size={16} />
              <span>Try Again</span>
            </button>
            <Link
              to="/"
              onClick={this.handleReset}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-emerald-900/20"
            >
              <Home size={16} />
              <span>Go Home</span>
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
