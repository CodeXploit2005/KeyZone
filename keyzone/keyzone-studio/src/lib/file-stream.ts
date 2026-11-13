import { open } from "node:fs/promises";

/** A backpressured file body whose read/abort/cancel paths share one terminal state. */
export function fileStream(filename: string, start: number, end: number, signal?: AbortSignal) {
  let position = start;
  let terminal = false;
  let opening: ReturnType<typeof open> | undefined;
  let closing: Promise<void> | undefined;
  let abort: (() => void) | undefined;

  function closeFile() {
    if (abort) signal?.removeEventListener("abort", abort);
    // Cancellation can arrive while open() or read() is still pending.
    return closing ??= opening ? opening.then(handle => handle.close()).catch(() => {}) : Promise.resolve();
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      abort = () => {
        if (terminal) return;
        terminal = true;
        controller.close();
        void closeFile();
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
    },
    async pull(controller) {
      if (terminal) return;
      try {
        const remaining = end - position + 1;
        if (remaining <= 0) {
          terminal = true;
          controller.close();
          await closeFile();
          return;
        }
        const handle = await (opening ??= open(filename, "r"));
        if (terminal) return;
        const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
        if (terminal) return;
        if (bytesRead) {
          position += bytesRead;
          controller.enqueue(buffer.subarray(0, bytesRead));
        }
        if (!bytesRead || position > end) {
          terminal = true;
          controller.close();
          await closeFile();
        }
      } catch (error) {
        if (!terminal) {
          terminal = true;
          controller.error(error);
        }
        await closeFile();
      }
    },
    cancel() {
      terminal = true;
      return closeFile();
    },
  });
}
