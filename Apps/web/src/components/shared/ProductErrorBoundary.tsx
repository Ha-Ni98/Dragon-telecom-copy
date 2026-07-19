/**
 * ProductErrorBoundary Component
 * Comprehensive error boundary for product-related components
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/useTranslation';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

/**
 * Error boundary component for product-related errors
 */
export class ProductErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ProductErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service in production
    if (import.meta.env.PROD) {
      this.logErrorToService(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys && resetKeys.length > 0) {
        this.resetErrorBoundary();
      }
    }

    // Reset error boundary when props change (if enabled)
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, this would send the error to an external service
    // like Sentry, LogRocket, or a custom error tracking service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Simulate sending to error service
    console.log('Error logged to service:', errorData);
  };

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleGoBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return <ProductErrorFallback 
        error={this.state.error}
        errorId={this.state.errorId}
        onRetry={this.handleRetry}
        onGoHome={this.handleGoHome}
        onGoBack={this.handleGoBack}
      />;
    }

    return this.props.children;
  }
}

/**
 * Product Error Fallback Component
 */
interface ProductErrorFallbackProps {
  error: Error | null;
  errorId: string;
  onRetry: () => void;
  onGoHome: () => void;
  onGoBack: () => void;
}

function ProductErrorFallback({ error, errorId, onRetry, onGoHome, onGoBack }: ProductErrorFallbackProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isNetworkError = error?.message.includes('Network') || error?.message.includes('fetch');
  const isProductNotFound = error?.message.includes('not found') || error?.message.includes('404');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">
            {isProductNotFound ? t('product.notFound') : t('common.error')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isNetworkError 
                ? t('common.networkError')
                : isProductNotFound
                ? t('product.notFoundMessage')
                : t('common.unexpectedError')
              }
            </AlertDescription>
          </Alert>

          {import.meta.env.DEV && error && (
            <div className="p-3 bg-muted rounded-lg">
              <details className="text-sm">
                <summary className="cursor-pointer font-medium mb-2">
                  {t('errorBoundary.detailsDev')}
                </summary>
                <div className="space-y-2">
                  <div>
                    <strong>{t('errorBoundary.errorId')}:</strong> {errorId}
                  </div>
                  <div>
                    <strong>{t('errorBoundary.message')}:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>{t('errorBoundary.stack')}:</strong>
                      <pre className="text-xs mt-1 overflow-auto max-h-32">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('common.retry')}
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onGoBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('common.goBack')}
              </Button>
              <Button variant="outline" onClick={onGoHome} className="flex-1">
                <Home className="w-4 h-4 mr-2" />
                {t('common.goHome')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProductErrorBoundary;
