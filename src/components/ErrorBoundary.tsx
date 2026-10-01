import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/** Last line of defence: a render crash shows a recovery screen, never a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="login">
        <div role="alert" className="card login-card">
          <h1>Something went wrong</h1>
          <p className="muted">
            The page hit an unexpected problem. Reloading usually fixes it, and your
            session is kept.
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
        </div>
      </main>
    );
  }
}
