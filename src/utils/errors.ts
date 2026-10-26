export type AppErrorCode =
  | 'location-not-found'
  | 'geocoding-failed'
  | 'route-unavailable'
  | 'routing-timeout'
  | 'routing-failed'
  | 'map-load-failed'
  | 'webcodecs-unsupported'
  | 'encoder-failed'
  | 'out-of-memory'
  | 'export-failed'
  | 'export-cancelled'
  | 'storage-failed'
  | 'invalid-project';

/** An error with a message that is safe and useful to show the user verbatim. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly detail?: string;

  constructor(code: AppErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

export function describeError(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message || 'Something went wrong.';
  return String(err);
}

/** fetch with a timeout and an optional caller signal, mapping failures to AppErrors. */
export async function fetchJson<T>(
  url: string,
  opts: { signal?: AbortSignal; timeoutMs: number; onTimeout: AppError; onNetwork: AppError },
): Promise<T> {
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, { signal, referrerPolicy: 'no-referrer' });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    if (timeout.aborted) throw opts.onTimeout;
    throw opts.onNetwork;
  }
  if (res.status === 429) {
    throw new AppError(opts.onNetwork.code, 'The free service is rate-limiting requests. Wait a few seconds and try again.');
  }
  try {
    return (await res.json()) as T;
  } catch {
    if (!res.ok) throw new AppError(opts.onNetwork.code, `${opts.onNetwork.message} (HTTP ${res.status})`);
    throw opts.onNetwork;
  }
}
