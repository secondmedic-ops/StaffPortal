import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto ring-1 ring-rose-500/40">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-100">Application Error</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                An unexpected error occurred while rendering this view.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-left overflow-x-auto">
                <code className="text-xs text-rose-300 font-mono break-words">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors"
              >
                Dismiss & Retry
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-teal-900/30"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Portal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
