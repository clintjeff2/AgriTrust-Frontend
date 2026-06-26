export type VerificationTaskStatus = "pending" | "running" | "verified" | "failed" | "cancelled" | "timeout";

export interface VerificationTask {
  id: string;
  certificateId: string;
  payload?: unknown;
  status?: VerificationTaskStatus;
}

export interface VerificationResult {
  taskId: string;
  certificateId: string;
  verified: boolean;
  status: VerificationTaskStatus;
  reason?: string;
  durationMs: number;
}

export interface ScopeOptions {
  parallelism?: number;
  timeoutMs?: number;
  parent?: CancellationScope;
  signal?: AbortSignal;
  scopeId?: string;
}

export interface ScopeResult<T> {
  ok: boolean;
  value?: T;
  error?: ScopeError;
  durationMs: number;
}

export interface ScopeError extends Error {
  name: "ScopeError";
  code: "cancelled" | "timeout" | "task_failed";
  scopeId: string;
  taskId?: string;
  cause?: unknown;
}

export type ScopedTask<T> = (signal: AbortSignal) => Promise<T> | T;

export interface CancellationScope {
  readonly scopeId: string;
  readonly signal: AbortSignal;
  run<T>(task: ScopedTask<T>, taskId?: string): Promise<ScopeResult<T>>;
  cancel(reason?: unknown): void;
  onCancel(listener: (reason?: unknown) => void): () => void;
  createChild(options?: Omit<ScopeOptions, "parent" | "signal">): CancellationScope;
}
