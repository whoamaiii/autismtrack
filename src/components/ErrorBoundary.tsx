import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        if (import.meta.env.DEV) {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-background-dark p-4">
                    <div className="liquid-glass-card p-8 rounded-3xl max-w-md w-full text-center">
                        <div className="bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="text-red-400" size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Noe gikk galt
                        </h2>
                        <p className="text-slate-400 text-sm mb-6">
                            En uventet feil oppstod. Prøv å laste siden på nytt.
                        </p>
                        {import.meta.env.DEV && this.state.error && (
                            <pre className="text-left text-xs text-red-400 bg-black/20 p-3 rounded-lg mb-4 overflow-auto max-h-32">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
                            >
                                Prøv igjen
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Last på nytt
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
