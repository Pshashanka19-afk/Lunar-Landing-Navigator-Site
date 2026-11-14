import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-[#08090C] border border-red-500/40 font-mono text-xs text-white flex flex-col gap-3">
          <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider">
            <AlertOctagon size={16} />
            <span>{this.props.fallbackTitle || 'Component Render Anomaly Detected'}</span>
          </div>
          <p className="text-white/60 text-[11px] leading-relaxed">
            {this.state.error?.message || 'A runtime telemetry evaluation error occurred while rendering this module.'}
          </p>
          <div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer uppercase transition-colors"
            >
              <RotateCcw size={12} />
              Reset Module
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
