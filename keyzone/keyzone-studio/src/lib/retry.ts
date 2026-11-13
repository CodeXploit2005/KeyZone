import { MuseError, MuseRefusedError } from "./providers/muse2api";

/** Retry malformed model output, but never blindly resend an uncertain transport failure. */
export async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (err instanceof MuseRefusedError || (err instanceof MuseError && !err.retryable)) throw err;
      lastErr = err;
      console.warn(`[${label}] attempt ${i}/${attempts} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw lastErr;
}
