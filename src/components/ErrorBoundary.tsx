import React from 'react';
import { AlertTriangle, RefreshCw, BookOpen } from 'lucide-react';

export interface ErrorBoundaryProps {
  children?: any;
  fallback?: any;
  key?: any;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// React.Component base constructor with proper state and props typings
const BaseComponent: new <P, S>(props: P) => {
  props: P;
  state: S;
  setState(state: Partial<S> | ((prevState: Readonly<S>) => Partial<S>), callback?: () => void): void;
} = (React as any).Component;

export class ErrorBoundary extends BaseComponent<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoToCourses = () => {
    this.setState({ hasError: false, error: null });
    if (window.location.pathname !== '/learn') {
      window.history.pushState({}, '', '/learn');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          id="error-boundary-recovery"
          className="min-h-[55vh] flex items-center justify-center px-4 py-20 bg-[#F8FAFC]"
        >
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-lg text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
                Something went wrong
              </h2>
              <p className="text-sm text-slate-600 font-interface leading-relaxed">
                An unexpected interface error occurred while rendering this view. You can reload this section or return to the course directory.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoToCourses}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Go to Courses</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
