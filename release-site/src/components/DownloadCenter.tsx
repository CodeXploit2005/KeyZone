"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  FlaskConical,
  ShieldCheck,
  X,
} from "lucide-react";
import winManifestJson from "../../public/release-windows.json";
import androidManifestJson from "../../public/release-android.json";

interface ReleasePart {
  path: string;
  bytes: number;
  sha256: string;
}

interface ReleaseManifest {
  filename: string;
  version: string;
  bytes: number;
  sha256: string;
  parts: ReleasePart[];
}

interface PlatformState {
  release: ReleaseManifest;
  infoText: string;
  statusText: string;
  progress: number;
  isDownloading: boolean;
  copied: boolean;
}

const formatMb = (bytes: number) =>
  (bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");

const initialWinRelease = winManifestJson as ReleaseManifest;
const initialAndroidRelease = androidManifestJson as ReleaseManifest;

export function DownloadCenter() {
  const [winState, setWinState] = useState<PlatformState>({
    release: initialWinRelease,
    infoText: `${initialWinRelease.version}  •  ${formatMb(initialWinRelease.bytes)} MB  •  Windows 64-bit`,
    statusText: "",
    progress: 0,
    isDownloading: false,
    copied: false,
  });

  const [androidState, setAndroidState] = useState<PlatformState>({
    release: initialAndroidRelease,
    infoText: `${initialAndroidRelease.version}  •  ${formatMb(initialAndroidRelease.bytes)} MB  •  Android 10+`,
    statusText: "",
    progress: 0,
    isDownloading: false,
    copied: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function refreshManifest(
      key: "windows" | "android",
      ext: ".exe" | ".apk",
      label: string,
      setter: React.Dispatch<React.SetStateAction<PlatformState>>
    ) {
      try {
        const res = await fetch(`./release-${key}.json`, { cache: "no-store" });
        if (!res.ok) return;
        const data: ReleaseManifest = await res.json();
        if (
          !data.parts?.length ||
          !data.filename?.endsWith(ext) ||
          !Number.isSafeInteger(data.bytes) ||
          data.parts.reduce((sum, p) => sum + p.bytes, 0) !== data.bytes
        ) {
          return;
        }
        setter(prev => ({
          ...prev,
          release: data,
          infoText: `${data.version}  •  ${formatMb(data.bytes)} MB  •  ${label}`,
        }));
      } catch {
        // Keep preloaded manifest
      }
    }

    refreshManifest("windows", ".exe", "Windows 64-bit", setWinState);
    refreshManifest("android", ".apk", "Android 10+", setAndroidState);
  }, []);

  const handleDownload = async (
    key: "windows" | "android",
    ext: ".exe" | ".apk",
    label: string,
    state: PlatformState,
    setter: React.Dispatch<React.SetStateAction<PlatformState>>
  ) => {
    if (!state.release || abortRef.current) return;
    const release = state.release;
    const controller = new AbortController();
    abortRef.current = controller;

    setter(prev => ({
      ...prev,
      isDownloading: true,
      progress: 0,
      statusText: "Đang khởi tạo luồng tải an toàn…",
    }));

    let writable: any = null;
    try {
      const winAny = window as any;
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await winAny.showSaveFilePicker({
            suggestedName: release.filename,
            types: [
              {
                description: `Bộ cài KeyZone ${label}`,
                accept: { "application/octet-stream": [ext] },
              },
            ],
          });
          writable = await handle.createWritable();
        } catch (err: any) {
          if (err?.name === "AbortError") throw err;
        }
      }

      const chunks: ArrayBuffer[] = [];
      let received = 0;
      const validPath = new RegExp(`^downloads/${key}/part-\\d+\\.bin$`);

      for (const part of release.parts) {
        if (!validPath.test(part.path)) {
          throw new Error("Thông tin bộ cài không hợp lệ.");
        }
        const response = await fetch(`./${part.path}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Mất kết nối khi tải bộ cài. Vui lòng thử lại.");
        }
        const bytes = await response.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        if (bytes.byteLength !== part.bytes || toHex(digest) !== part.sha256) {
          throw new Error("File tải về chưa toàn vẹn. Vui lòng tải lại.");
        }
        if (writable) {
          await writable.write(bytes);
        } else {
          chunks.push(bytes);
        }
        received += bytes.byteLength;
        const pct = Math.round((received / release.bytes) * 100);
        setter(prev => ({
          ...prev,
          progress: pct,
          statusText: `Đang tải ${formatMb(received)} / ${formatMb(release.bytes)} MB (${pct}%)`,
        }));
      }

      if (writable) {
        await writable.close();
        writable = null;
      } else {
        const mime =
          key === "android"
            ? "application/vnd.android.package-archive"
            : "application/octet-stream";
        const url = URL.createObjectURL(new Blob(chunks, { type: mime }));
        const link = document.createElement("a");
        link.href = url;
        link.download = release.filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }

      setter(prev => ({
        ...prev,
        isDownloading: false,
        statusText: "✓ Đã tải xong. Mở file cài đặt để bắt đầu.",
      }));
    } catch (error: any) {
      if (writable) {
        try {
          await writable.abort();
        } catch {}
      }
      setter(prev => ({
        ...prev,
        isDownloading: false,
        statusText:
          error?.name === "AbortError"
            ? "Đã hủy tải xuống."
            : error?.message || "Chưa tải được bộ cài. Vui lòng thử lại.",
      }));
    } finally {
      abortRef.current = null;
    }
  };

  const copyChecksum = async (
    sha: string | undefined,
    setter: React.Dispatch<React.SetStateAction<PlatformState>>
  ) => {
    if (!sha) return;
    try {
      await navigator.clipboard.writeText(sha);
      setter(prev => ({ ...prev, copied: true }));
      setTimeout(() => setter(prev => ({ ...prev, copied: false })), 1800);
    } catch {}
  };

  const anyDownloading = winState.isDownloading || androidState.isDownloading;

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      {/* WINDOWS CARD */}
      <article className="card-lift flex flex-col justify-between rounded-2xl border border-white/12 bg-[#121124]/90 p-7 shadow-2xl">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/30 bg-[#231d45] text-violet-200">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 4.5 10.8 3.3v8H2zm10-1.4L22 1.7v9.6H12zM2 12.5h8.8v8L2 19.3zm10 0h10v9.6L12 20.7z" />
              </svg>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-950/60 px-3 py-1 text-xs font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Bản đầy đủ • Khuyên dùng
            </span>
          </div>

          <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-white">Windows</h3>
          <p id="release-info" className="mt-1.5 font-mono text-xs text-slate-300">
            {winState.infoText}
          </p>

          <div className="mt-5">
            <button
              id="download-button"
              type="button"
              disabled={anyDownloading}
              onClick={() =>
                handleDownload("windows", ".exe", "Windows 64-bit", winState, setWinState)
              }
              className="btn-sheen flex w-full cursor-pointer items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#5b3fd6] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
            >
              <Download className="h-4 w-4 flex-shrink-0" />
              <span>Tải bộ cài Windows (.exe)</span>
            </button>

            {winState.isDownloading && (
              <button
                id="cancel-download"
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                <X className="h-3.5 w-3.5" /> Hủy tải xuống
              </button>
            )}

            {winState.isDownloading && (
              <div id="download-progress" className="mt-3">
                <progress
                  id="progress"
                  value={winState.progress}
                  max={100}
                  aria-label="Tiến trình tải bản Windows"
                  className="h-2 w-full overflow-hidden rounded-full accent-violet-400"
                />
              </div>
            )}

            {winState.statusText && (
              <p
                id="download-status"
                role="status"
                aria-live="polite"
                className="mt-2.5 text-xs font-medium text-emerald-300"
              >
                {winState.statusText}
              </p>
            )}
          </div>

          <details className="mt-3.5 rounded-xl border border-white/10 bg-[#18172c] px-4 py-3 text-xs text-slate-300">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-200">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-violet-400" />
                Mã kiểm tra SHA-256
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-violet-300">
                Chi tiết <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </summary>
            <div className="mt-2.5 border-t border-white/10 pt-2.5">
              <code
                id="checksum"
                className="block break-all font-mono text-[11px] leading-relaxed text-slate-200"
              >
                {winState.release.sha256}
              </code>
              <button
                type="button"
                onClick={() => copyChecksum(winState.release.sha256, setWinState)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[11px] text-white hover:bg-white/15"
              >
                {winState.copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> Đã sao chép
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Sao chép mã
                  </>
                )}
              </button>
            </div>
          </details>
        </div>

        <div className="mt-6 border-t border-white/8 pt-5">
          <ul className="space-y-2.5 text-xs text-slate-200">
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" /> Windows 10 / 11 (64-bit)
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" /> Microsoft Edge hoặc Google Chrome
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" /> Đã kèm sẵn Node, Python, PostgreSQL & FFmpeg
            </li>
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Bộ cài hiện chưa có chữ ký số Windows.
          </p>
        </div>
      </article>

      {/* ANDROID CARD */}
      <article className="card-lift flex flex-col justify-between rounded-2xl border border-white/12 bg-[#121124]/90 p-7 shadow-2xl">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-[#122b27] text-emerald-400">
              <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.46 11.46 0 0 0-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C3.8 11.03 2.13 13.75 2 17h20c-.13-3.25-1.8-5.97-4.4-7.52zM7 14c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
              </svg>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-950/50 px-3 py-1 text-xs font-medium text-amber-300">
              <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
              Thử nghiệm • APK
            </span>
          </div>

          <h3 className="mt-5 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white">
            <span>Android</span>
            <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
              Beta
            </span>
          </h3>
          <p id="android-release-info" className="mt-1.5 font-mono text-xs text-slate-300">
            {androidState.infoText}
          </p>

          <div className="mt-5">
            <button
              id="android-download-button"
              type="button"
              disabled={anyDownloading}
              onClick={() =>
                handleDownload(
                  "android",
                  ".apk",
                  "Android 10+",
                  androidState,
                  setAndroidState
                )
              }
              className="btn-sheen flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-emerald-500/35 bg-gradient-to-r from-[#163832] to-[#122b38] px-5 py-3.5 text-sm font-bold text-white transition hover:border-emerald-400/60 hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
            >
              <Download className="h-4 w-4 flex-shrink-0 text-emerald-300" />
              <span>Tải APK Android (.apk)</span>
            </button>

            {androidState.isDownloading && (
              <button
                id="android-cancel-download"
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                <X className="h-3.5 w-3.5" /> Hủy tải xuống
              </button>
            )}

            {androidState.isDownloading && (
              <div id="android-download-progress" className="mt-3">
                <progress
                  id="android-progress"
                  value={androidState.progress}
                  max={100}
                  aria-label="Tiến trình tải bản Android"
                  className="h-2 w-full overflow-hidden rounded-full accent-emerald-400"
                />
              </div>
            )}

            {androidState.statusText && (
              <p
                id="android-download-status"
                role="status"
                aria-live="polite"
                className="mt-2.5 text-xs font-medium text-emerald-300"
              >
                {androidState.statusText}
              </p>
            )}
          </div>

          <details className="mt-3.5 rounded-xl border border-white/10 bg-[#18172c] px-4 py-3 text-xs text-slate-300">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-200">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Mã kiểm tra SHA-256
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400">
                Chi tiết <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </summary>
            <div className="mt-2.5 border-t border-white/10 pt-2.5">
              <code
                id="android-checksum"
                className="block break-all font-mono text-[11px] leading-relaxed text-slate-200"
              >
                {androidState.release.sha256}
              </code>
              <button
                type="button"
                onClick={() => copyChecksum(androidState.release.sha256, setAndroidState)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[11px] text-white hover:bg-white/15"
              >
                {androidState.copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> Đã sao chép
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Sao chép mã
                  </>
                )}
              </button>
            </div>
          </details>
        </div>

        <div className="mt-6 border-t border-white/8 pt-5">
          <ul className="space-y-2.5 text-xs text-slate-200">
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" /> Android 10+, 64-bit
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" /> Chạy độc lập, không cần máy Windows
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" /> Android System WebView được cập nhật
            </li>
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Bản thử nghiệm: chưa xác minh trọn luồng Muse trên điện thoại thật. Có mục kiểm tra bộ xuất video trong Cài đặt.
          </p>
        </div>
      </article>
    </div>
  );
}
