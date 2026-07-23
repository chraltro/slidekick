import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Rendered instead of the children after a crash. */
  fallback?: (error: Error) => ReactNode;
  /** When this changes, a crashed boundary resets and tries the children again. */
  resetKey?: string | number;
}

interface State {
  error: Error | null;
}

/**
 * Slides render arbitrary user markdown/HTML through layout components; a
 * single bad slide must not white-screen the whole app (least of all the
 * audience window mid-presentation). Used per-slide with resetKey=slide.hash
 * so fixing the markdown immediately recovers, and once at the app root.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('[render] component crashed', error);
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback ? this.props.fallback(this.state.error) : null;
    }
    return this.props.children;
  }
}
