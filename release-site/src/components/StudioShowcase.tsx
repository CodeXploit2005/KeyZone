"use client";

import React, { useRef, useState } from "react";
import {
  Check,
  Clapperboard,
  Download,
  FileText,
  Film,
  Layers,
  SlidersHorizontal,
  Users,
  Video,
  Volume2,
} from "lucide-react";

interface SceneItem {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  image: string;
  camera: string;
  prompt: string;
  accent: string;
}

const SCENES: SceneItem[] = [
  {
    id: "scene-1",
    number: "01",
    title: "Mở đầu bình minh",
    subtitle: "Toàn cảnh đồi sương • Ánh sáng sớm",
    image: "./scene-01.jpg",
    camera: "CAM A • 24mm Wide",
    prompt:
      "Bình minh chiếu qua sương sớm, nhân vật chính bước lên đồi nhìn về phía chân trời…",
    accent: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  },
  {
    id: "scene-2",
    number: "02",
    title: "Nhịp sống phố thị",
    subtitle: "Trung cảnh chuyển động • Phố Việt",
    image: "./scene-02.jpg",
    camera: "CAM B • 50mm Prime",
    prompt:
      "Nắng sớm xuyên qua tán cây phố Việt, nhân vật giữ nguyên trang phục bước đi giữa dòng người…",
    accent: "text-violet-300 border-violet-400/40 bg-violet-400/10",
  },
  {
    id: "scene-3",
    number: "03",
    title: "Kết thúc lắng đọng",
    subtitle: "Cận cảnh điện ảnh • Chốt cảm xúc",
    image: "./scene-03.jpg",
    camera: "CAM C • 35mm Cinema",
    prompt:
      "Hoàng hôn buông nhẹ trên mặt biển tĩnh lặng, nhân vật dừng lại ngắm nhìn đường chân trời…",
    accent: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  },
];

export function StudioShowcase() {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const currentScene = SCENES[selectedIdx];

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el || window.innerWidth < 1024) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1200px) rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg) translate3d(0, 0, 0)`;
    });
  };

  const handlePointerLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    el.style.transform =
      "perspective(1200px) rotateY(-4deg) rotateX(2deg) translate3d(0, 0, 0)";
  };

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative mx-auto w-full max-w-[640px]"
    >
      {/* Soft static ambient border glow behind window */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-to-tr from-violet-600/20 via-fuchsia-500/10 to-emerald-400/20 opacity-85"
      />

      {/* Main 3D Tilt Studio Window */}
      <div
        ref={cardRef}
        style={{
          transform:
            "perspective(1200px) rotateY(-4deg) rotateX(2deg) translate3d(0, 0, 0)",
        }}
        aria-label="Minh họa quy trình tạo video trong KeyZone"
        className="relative overflow-hidden rounded-[22px] border border-white/15 bg-[#12131f] shadow-[0_28px_80px_-20px_rgba(0,0,0,0.9)] transition-transform duration-200 ease-out will-change-transform"
      >
        {/* Top Window Bar */}
        <div className="flex h-12 items-center justify-between border-b border-white/8 bg-[#141522] px-4 text-xs text-slate-300">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <span className="ml-1 truncate font-semibold text-white">
              KeyZone Video Studio
            </span>
            <span className="hidden items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-slate-300 sm:inline-flex">
              <FileText className="h-3 w-3 text-slate-400" />
              Mot-buoi-sang-moi.kzp
            </span>
          </div>

          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            MUSE READY
          </span>
        </div>

        {/* Studio Body */}
        <div className="flex">
          {/* Left Icon Dock */}
          <aside
            aria-hidden="true"
            className="flex w-14 flex-shrink-0 flex-col items-center gap-3.5 border-r border-white/8 bg-[#10111c] py-5"
          >
            <img
              src="./keyzone-icon.png"
              alt=""
              width={30}
              height={30}
              className="mb-1 rounded-lg shadow-sm"
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/45 bg-violet-500/15 text-violet-300">
              <Film className="h-4 w-4" />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
              <Volume2 className="h-4 w-4" />
            </div>
            <div className="mt-auto flex h-10 w-10 items-center justify-center rounded-xl text-slate-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
          </aside>

          {/* Main Workspace Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-between p-5 sm:p-6">
            {/* Project Header & Aspect Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="block font-mono text-[10px] font-bold tracking-[0.16em] text-violet-400 uppercase">
                  DỰ ÁN MẪU • 3 PHÂN CẢNH
                </span>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">
                  Một buổi sáng mới
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAspectRatio(prev => (prev === "9:16" ? "16:9" : "9:16"))
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-violet-400/65 hover:bg-violet-500/20"
                  title="Chuyển đổi tỷ lệ khung hình"
                >
                  <Layers className="h-3.5 w-3.5 text-emerald-300" />
                  <span>{aspectRatio === "9:16" ? "9:16 Shorts" : "16:9 Cinema"}</span>
                </button>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200">
                  <Video className="h-3.5 w-3.5 text-slate-400" />
                  <span>MP4</span>
                </span>
              </div>
            </div>

            {/* Workflow Stepper Pill */}
            <div className="my-4 flex items-center justify-between rounded-xl border border-white/10 bg-[#171929]/70 px-4 py-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                <Check className="h-3.5 w-3.5" /> Kịch bản
              </span>
              <span className="mx-3 h-px flex-1 bg-violet-400/35" />
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                <Check className="h-3.5 w-3.5" /> Nhân vật
              </span>
              <span className="mx-3 h-px flex-1 bg-violet-400/35" />
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                <Clapperboard className="h-3.5 w-3.5 text-violet-300" />
                <span>Dựng cảnh ({currentScene.number}/03)</span>
              </span>
            </div>

            {/* 3 Real Scene Photo Cards */}
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              role="tablist"
              aria-label="Chọn phân cảnh"
            >
              {SCENES.map((scene, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedIdx(idx)}
                    className={`group relative overflow-hidden rounded-2xl border text-left transition-transform duration-200 ${
                      isSelected
                        ? "border-violet-400/90 bg-[#191b2e] -translate-y-0.5 shadow-[0_0_24px_-6px_rgba(167,139,250,0.45)]"
                        : "border-white/10 bg-[#161827] hover:border-white/25 hover:-translate-y-0.5"
                    }`}
                  >
                    <div
                      className={`relative w-full overflow-hidden bg-[#0e101a] ${
                        aspectRatio === "9:16" ? "h-32 sm:h-32" : "h-24"
                      } transition-all duration-200`}
                    >
                      <img
                        src={scene.image}
                        alt={scene.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    <div className="p-3">
                      <div className="text-xs font-bold text-white">
                        {scene.number} {scene.title}
                      </div>
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {scene.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Scene Inspector Bar */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#161827]/90 p-3.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono font-bold text-violet-300">
                  {currentScene.camera}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${currentScene.accent}`}
                >
                  Đang chọn cảnh {currentScene.number}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-200">
                “{currentScene.prompt}”
              </p>
            </div>

            {/* Bottom Row with integrated "File video ở ngay máy bạn" card */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Từ ý tưởng đến video hoàn chỉnh
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/35 bg-[#151828] px-3.5 py-2.5 shadow-md">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <strong className="block text-xs font-bold text-white">
                    File video ở ngay máy bạn
                  </strong>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    Lưu trữ và chỉnh sửa bất cứ lúc nào.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
