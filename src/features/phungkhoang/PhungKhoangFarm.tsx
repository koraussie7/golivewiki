import React, { useCallback, useState } from "react";
import { DEPLOY_STEPS, FARM_INFO } from "./steps";
import "./styles.css";

export function PhungKhoangFarm() {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const handleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const formatCmd = (cmd: string): string[] => {
    return cmd.split("\n").filter((line) => line.trim().length > 0);
  };

  return (
    <div className="farm-bg min-h-screen text-white font-['Syne'] selection:bg-[#ffbd2e] selection:text-black">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black font-bold text-lg">
              PK
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{FARM_INFO.name}</h1>
              <p className="mt-1 text-[13px] leading-snug text-zinc-300 farm-text-muted">
                {FARM_INFO.specs}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 rounded-md border border-white/10 bg-white/[0.04] text-[10px] font-mono text-zinc-300">
              {FARM_INFO.badge}
            </span>
            <button
              onClick={handleMenu}
              aria-label="메뉴 열기"
              aria-expanded={menuOpen}
              className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 font-mono text-xs text-white hover:bg-white/[0.08] transition"
            >
              메뉴
              <span className="farm-menu-icon" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </header>
      <section className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="farm-card rounded-[16px] p-6 farm-border mb-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black font-bold text-2xl">
                PK
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight">
                  {FARM_INFO.name}
                  <span className="ml-2 text-[11px] text-[#ffbd2e] font-mono">
                    {FARM_INFO.badge}
                  </span>
                </h2>
                <p className="mt-1 text-[13px] leading-snug text-zinc-300 farm-text-muted">
                  {FARM_INFO.specs}
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-zinc-500 farm-text-muted">
                  API: <span className="text-zinc-300">api.phungkhoang.ai</span>
                </p>
                <p className="text-[10px] text-zinc-500 farm-text-muted mt-1">
                  Live since 2024.11 (시뮬레이션)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {DEPLOY_STEPS.map((step) => (
              <div
                key={step.step}
                className="farm-card rounded-[12px] p-6 group farm-card-hover farm-border"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-bold text-[#8b5cf6]">
                    {step.step}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                    {step.time}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-white">
                  {step.title}
                </h3>
                <pre
                  className="mt-4 rounded-[10px] bg-black/60 p-3 font-mono text-[11px] leading-[1.6] text-zinc-400 overflow-x-auto border border-white/[0.04] farm-scrollbar"
                >
                  {formatCmd(step.cmd).map((line, idx) => (
                    <React.Fragment key={idx}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </pre>
                <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-zinc-500 group-hover:text-[#00ff88] transition">
                  <span>→</span>
                  <span>실행 완료시 초록불 (시뮬)</span>
                  <div className="ml-auto h-2 w-2 rounded-full bg-zinc-700 group-hover:bg-[#00ff88] transition" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="px-6 py-12 border-t border-white/5 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6 rounded-[16px] border border-white/10 bg-[#080808] p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black font-bold text-xl">
              PK
            </div>
            <div>
              <div className="font-['Syne'] text-lg font-bold text-white">
                {FARM_INFO.name}
                <span className="ml-2 text-[11px] text-[#ffbd2e] font-mono">
                  {FARM_INFO.badge}
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-zinc-500 farm-text-muted">
                {FARM_INFO.specs} • {FARM_INFO.sourceNote}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              aria-label="맨 위로 이동"
              className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 font-mono text-xs text-white hover:bg-white/[0.08] transition"
            >
              맨 위로 ↑
            </button>
            <button
              onClick={handleMenu}
              aria-label="메뉴 열기"
              aria-expanded={menuOpen}
              className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 font-mono text-xs text-white hover:bg-white/[0.08] transition"
            >
              메뉴
              <span className="farm-menu-icon" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </footer>

      {menuOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/90 backdrop-blur-sm"
          onClick={handleMenu}
          aria-hidden="true"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-white mb-4">
                Phùng Khoang Farm
              </p>
              <p className="text-xs text-zinc-400">
                시뮬레이션 환경 · 20x MI50 GPU 팜
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
