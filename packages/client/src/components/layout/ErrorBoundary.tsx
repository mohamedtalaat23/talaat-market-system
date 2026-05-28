import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AlertOctagon } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error details internally for local-first diagnostics
    console.error("Uncaught React lifecycle error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[500px] w-full flex-col items-center justify-center rounded-lg border border-border bg-neutral-950 p-8 text-center text-foreground">
          <div className="flex max-w-md flex-col items-center">
            <div className="rounded-full bg-destructive/15 p-4 text-destructive">
              <AlertOctagon className="h-10 w-10" />
            </div>
            
            <h2 className="mt-4 text-xl font-semibold tracking-tight">Interface Error</h2>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
              This panel encountered a runtime exception. You can attempt to reload the component or refresh the screen.
            </p>
            
            {this.state.error && (
              <div className="mt-4 w-full max-h-40 overflow-auto rounded border border-neutral-800 bg-neutral-900/60 p-3 text-left font-mono text-xs text-destructive select-text">
                {this.state.error.message}
              </div>
            )}
            
            <Button
              className="mt-6 font-medium"
              onClick={this.handleReload}
              variant="outline"
            >
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
