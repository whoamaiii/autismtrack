import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import i18n from 'i18next';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    isChunkLoadError: boolean;
}

// Detect chunk load failures (lazy import errors)
const isChunkLoadError = (error: Error): boolean => {
    const message = error.message.toLowerCase();
    return (
        message.includes('failed to fetch dynamically imported module') ||
        message.includes('loading chunk') ||
        message.includes('loading css chunk') ||
        message.includes('dynamically imported module')
    );
};

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, isChunkLoadError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            isChunkLoadError: isChunkLoadError(error)
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        if (import.meta.env.DEV) {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null, isChunkLoadError: false });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // For chunk load errors, show a more helpful message and prioritize reload
            const isChunk = this.state.isChunkLoadError;

            return (
                <div className="min-h-screen flex items-center justify-center bg-background-dark p-4">
                    <div className="liquid-glass-card p-8 rounded-3xl max-w-md w-full text-center">
                        <div className="bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="text-red-400" size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            {isChunk
                                ? i18n.t('errorBoundary.updateRequired', 'Update Required')
                                : i18n.t('errorBoundary.title')}
                        </h2>
                        <p className="text-slate-400 text-sm mb-6">
                            {isChunk
                                ? i18n.t('errorBoundary.chunkLoadError', 'The app has been updated. Please reload to get the latest version.')
                                : i18n.t('errorBoundary.description')}
                        </p>
                        {import.meta.env.DEV && this.state.error && (
                            <pre className="text-left text-xs text-red-400 bg-black/20 p-3 rounded-lg mb-4 overflow-auto max-h-32">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex gap-3 justify-center">
                            {!isChunk && (
                                <button
                                    onClick={this.handleReset}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
                                >
                                    {i18n.t('errorBoundary.tryAgain')}
                                </button>
                            )}
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                <RefreshCw size={16} />
                                {i18n.t('errorBoundary.reload')}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
