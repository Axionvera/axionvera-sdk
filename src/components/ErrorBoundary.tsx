import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Internal logging only
    console.error("Dashboard ErrorBoundary:", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Future:
    // Sentry.captureException(error);
  }

  handleRetry = () => {
    // safest option for corrupted state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center max-w-md px-6">
            <h1 className="text-xl font-semibold mb-3">
              Oops! Something went wrong in the Vault.
            </h1>

            <p className="text-gray-500 mb-6">
              An unexpected error occurred. You can try reloading the page.
            </p>

            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;