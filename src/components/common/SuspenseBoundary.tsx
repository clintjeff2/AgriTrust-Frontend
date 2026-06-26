"use client";

import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallback } from "./ErrorFallback";

const DEFAULT_TIMEOUT_MS = 30_000;

interface TimeoutFallbackProps {
  timeoutMs: number;
  children: ReactNode;
}

interface TimeoutFallbackState {
  error: Error | null;
}

class TimeoutFallback extends Component<TimeoutFallbackProps, TimeoutFallbackState> {
  state: TimeoutFallbackState = { error: null };
  private timer: ReturnType<typeof setTimeout> | null = null;

  componentDidMount() {
    this.timer = setTimeout(() => {
      this.setState({
        error: new Error(`Wallet operation timed out after ${this.props.timeoutMs}ms`),
      });
    }, this.props.timeoutMs);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  render() {
    if (this.state.error) throw this.state.error;
    return this.props.children;
  }
}

interface ErrorBoundaryProps {
  fallback?: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === "development") console.error(error, errorInfo);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback ? this.props.fallback(this.state.error, this.reset) : <ErrorFallback error={this.state.error} resetErrorBoundary={this.reset} />;
    }

    return this.props.children;
  }
}

export interface SuspenseBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  timeoutMs?: number;
  errorFallback?: (error: Error, reset: () => void) => ReactNode;
}

export function SuspenseBoundary({ children, fallback, timeoutMs = DEFAULT_TIMEOUT_MS, errorFallback }: SuspenseBoundaryProps) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={<TimeoutFallback timeoutMs={timeoutMs}>{fallback ?? <DefaultSuspenseFallback />}</TimeoutFallback>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function DefaultSuspenseFallback() {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
      <span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
      Preparing wallet state…
    </div>
  );
}
