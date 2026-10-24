import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSmartglassConfig,
  getTask,
  listEvents,
  openVideoSession,
  SmartglassApiError,
  submitGlassCommand,
} from "./api/smartglass-api";
import { GLASS_COMMANDS, type SmartglassTask, type TaskEvent } from "./types/smartglass";
import "./styles/smartglass.css";

/**
 * Smartglass control page.
 *
 * Structured like DroneControlPage on purpose: the same four-step progress derived
 * from the task status, the same simulation/offline/connected distinction, and the
 * same rule that nothing is shown as live unless it actually is.
 *
 * What this screen must never do
 *   - claim a task on a worker's behalf (that belongs to the worker's own client)
 *   - show video before the wearer consented (the server returns 403 until then)
 *   - mark a command completed because a button was pressed
 */
export function SmartglassPage() {
  const config = useMemo(() => getSmartglassConfig(), []);
  const [task, setTask] = useState<SmartglassTask | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [video, setVideo] = useState<{ url: string; expiresAt?: string } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSimulation = !config.taskId;

  // A demo task so the layout is visible without an API. It is labelled as simulation
  // everywhere; the badge, the progress caption and the video panel all read this flag.
  const demoTask: SmartglassTask = {
    id: "simulation",
    title: "현장 표지판 확인 및 안내문 번역",
    location: "서울 강남구 역삼동",
    requester: "의뢰인 (시뮬레이션)",
    scheduledAt: new Date().toISOString(),
    status: "accepted",
  };

  const shown = task ?? (isSimulation ? demoTask : null);

  const load = useCallback(async () => {
    if (!config.taskId) return;
    try {
      const [loaded, loadedEvents] = await Promise.all([
        getTask(config),
        listEvents(config, config.taskId).catch(() => [] as TaskEvent[]),
      ]);
      setTask(loaded);
      setEvents(loadedEvents);
    } catch (error) {
      setNotice(
        error instanceof SmartglassApiError
          ? `작업을 불러오지 못했습니다: ${error.message}`
          : "작업을 불러오는 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }, [config]);

  useEffect(() => {
    void load();
  }, [load]);

  const startVideo = useCallback(async () => {
    if (isSimulation) {
      setVideoError("시뮬레이션 모드에서는 실제 영상 세션을 열 수 없습니다.");
      return;
    }
    setBusy(true);
    setVideoError(null);
    try {
      const session = await openVideoSession(config, config.taskId);
      setVideo({ url: session.playbackUrl, expiresAt: session.expiresAt });
    } catch (error) {
      if (error instanceof SmartglassApiError && error.code === "consent_required") {
        // The wearer has not agreed. This is the expected answer, not a failure of the
        // screen, so the message names the missing consent instead of a generic error.
        setVideoError("작업자가 아직 영상 공유에 동의하지 않았습니다. 동의 후 다시 시도해 주세요.");
      } else {
        setVideoError(
          error instanceof SmartglassApiError ? error.message : "영상 세션을 열 수 없습니다.",
        );
      }
    } finally {
      setBusy(false);
    }
  }, [config, isSimulation]);

  const requestCommand = useCallback(
    async (type: (typeof GLASS_COMMANDS)[number]["type"], label: string) => {
      if (isSimulation) {
        setNotice("시뮬레이션 모드입니다. 명령은 전송되지 않습니다.");
        return;
      }
      setBusy(true);
      try {
        const command = await submitGlassCommand(config, config.taskId, type);
        // The server decides the first status; this screen reports what came back
        // rather than assuming the command executed.
        setNotice(`${label} 요청을 보냈습니다 (상태: ${command.status})`);
      } catch (error) {
        setNotice(
          error instanceof SmartglassApiError ? `요청 실패: ${error.message}` : "요청에 실패했습니다.",
        );
      } finally {
        setBusy(false);
      }
    },
    [config, isSimulation],
  );

  // Progress is derived from the task status. Hard-coding it (as the drone screen did
  // before) meant a completed task still displayed step 2.
  const steps = ["접수", "작업자 수락", "현장 진행", "완료"];
  const statusOrder: SmartglassTask["status"][] = ["requested", "accepted", "active", "completed"];
  const currentIndex = shown ? Math.max(0, statusOrder.indexOf(shown.status)) : 0;
  const progressPct = ((currentIndex + 1) / steps.length) * 100;

  const capabilities = shown?.capabilities ?? [];
  const availableCommands = isSimulation
    ? GLASS_COMMANDS
    : GLASS_COMMANDS.filter((c) => capabilities.includes(c.type));

  return (
    <div className="glass-bg min-h-screen text-white">
      <header className="glass-header sticky top-0 z-50">
        <div className="glass-wrap flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glass-logo">SG</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">스마트글라스 의뢰</h1>
              <p className="glass-muted text-[13px]">
                현장 작업자와 실시간으로 연결됩니다 · {isSimulation ? "시뮬레이션" : "실제 작업"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={isSimulation ? "glass-badge glass-badge--sim" : "glass-badge"}>
              {isSimulation ? "시뮬레이션" : shown?.status ?? "—"}
            </span>
            <a href="./" className="glass-btn glass-btn--ghost">
              홈
            </a>
          </div>
        </div>
      </header>

      <main className="glass-wrap py-8">
        {!shown ? (
          <div className="glass-card p-6">
            <p className="glass-muted">작업을 불러오는 중입니다…</p>
          </div>
        ) : (
          <>
            <section className="glass-card p-6 mb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{shown.title}</h2>
                  <p className="glass-muted mt-1 text-[13px]">
                    {shown.location} · {shown.requester}
                  </p>
                </div>
                <div className="glass-progress">
                  <div className="glass-progress__label">
                    <span>진행 단계</span>
                    <b>
                      {currentIndex + 1} <small>/ {steps.length}</small>
                    </b>
                  </div>
                  <div
                    className="glass-progress__track"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={steps.length}
                    aria-valuenow={currentIndex + 1}
                    aria-label={`진행 단계 ${currentIndex + 1} / ${steps.length}`}
                  >
                    <i style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="glass-progress__steps">
                    {steps.map((label, index) => (
                      <span
                        key={label}
                        className={
                          index < currentIndex ? "done" : index === currentIndex ? "current" : undefined
                        }
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
              <section className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold">현장 영상</h3>
                  <span className="glass-muted text-[12px]">작업자 동의 후에만 전송됩니다</span>
                </div>

                <div className="glass-video">
                  {video ? (
                    <iframe
                      title="현장 영상"
                      src={video.url}
                      allow="autoplay; fullscreen"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="glass-video__empty">
                      <p>영상이 연결되지 않았습니다.</p>
                      <button
                        type="button"
                        className="glass-btn"
                        onClick={startVideo}
                        disabled={busy}
                      >
                        영상 세션 열기
                      </button>
                    </div>
                  )}
                </div>

                {videoError && (
                  <p className="glass-error" role="alert">
                    {videoError}
                  </p>
                )}
                {video?.expiresAt && (
                  <p className="glass-muted text-[12px] mt-2">
                    시청 권한 만료: {new Date(video.expiresAt).toLocaleTimeString("ko-KR", { hour12: false })}
                  </p>
                )}
              </section>

              <section className="glass-card p-6">
                <h3 className="text-base font-bold mb-1">작업 지시</h3>
                <p className="glass-muted text-[12px] mb-4">
                  현장 작업자에게 요청할 작업입니다. 실행 전 작업자 확인을 거칩니다.
                </p>

                <div className="flex flex-col gap-2">
                  {availableCommands.map((command) => (
                    <button
                      key={command.type}
                      type="button"
                      className="glass-btn glass-btn--outline"
                      disabled={busy}
                      title={command.hint}
                      onClick={() => requestCommand(command.type, command.label)}
                    >
                      {command.label}
                    </button>
                  ))}
                </div>

                {availableCommands.length === 0 && (
                  <p className="glass-muted text-[12px]">
                    이 작업자가 지원한다고 등록한 기능이 없습니다. 기기 정보가 확인되면 표시됩니다.
                  </p>
                )}

                {notice && (
                  <p className="glass-muted text-[12px] mt-4" role="status">
                    {notice}
                  </p>
                )}
              </section>
            </div>

            <section className="glass-card p-6 mt-6">
              <h3 className="text-base font-bold mb-3">작업 기록</h3>
              {events.length === 0 ? (
                <p className="glass-muted text-[12px]">아직 기록이 없습니다.</p>
              ) : (
                <ul className="glass-log">
                  {events.map((event) => (
                    <li key={event.id}>
                      <span className="glass-log__time">
                        {event.time
                          ? new Date(event.time).toLocaleTimeString("ko-KR", { hour12: false })
                          : "--:--:--"}
                      </span>
                      <span className="glass-log__title">{event.title}</span>
                      <span className="glass-muted text-[12px]">{event.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
