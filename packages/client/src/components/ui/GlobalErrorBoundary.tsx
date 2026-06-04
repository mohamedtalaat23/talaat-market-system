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
          <div className="bg-danger/10 border border-danger/20 rounded-full p-4 mb-4">
            <AlertTriangle size={32} className="text-danger" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
          <p className="text-secondary text-sm max-w-md mb-6">
            An unexpected error occurred in this section of the application. The issue has been
            logged. You can try reloading this view.
          </p>
          <div className="p-4 bg-background/40 rounded-lg text-left overflow-auto max-w-2xl w-full mb-6 border border-border">
            <pre className="text-danger text-xs font-mono whitespace-pre-wrap">
              {this.state.error?.message || 'Unknown render error'}
            </pre>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={this.handleReset}
              className="flex items-center space-x-2 px-5 py-2.5 bg-card-hover hover:bg-border text-foreground rounded-lg transition-colors text-sm font-medium border border-border"
            >
              <RefreshCw size={16} />
              <span>Try Again</span>
            </button>
            <Link
              to="/"
              onClick={this.handleReset}
              className="flex items-center space-x-2 px-5 py-2.5 bg-success hover:bg-success/90 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-success/10"
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
