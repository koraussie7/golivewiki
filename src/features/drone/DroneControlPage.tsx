import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CameraCommand,
  CameraCommandType,
  DroneMission,
  MissionEvent,
  VehicleSummary,
} from "./types/drone";
import {
  connectMissionRealtime,
  createMissionVideoSession,
  getDroneRuntimeConfig,
  createMission,
  getMission,
  getMissionEvents,
  submitCameraCommand,
  type DroneLiveEvent,
  type DroneLiveState,
} from "./api/drone-api";

type ControlMode = "simulation" | "live";

const initialMission: DroneMission = {
  id: "GL-2408-019",
  title: "농경지 작황 확인",
  location: "경기도 파주시 탄현면 · 관심 구역 A-03",
  requester: "김민서 의뢰인",
  scheduledAt: "오늘 14:30",
  status: "active",
};

const simulatedVehicle: VehicleSummary = {
  vendor: "MAVLink",
  model: "SITL Camera Rig",
  capabilities: [
    "camera.capture_photo",
    "camera.start_video",
    "camera.stop_video",
    "camera.zoom",
  ],
  connection: "simulation",
};

const initialEvents: MissionEvent[] = [
  {
    id: "evt-1",
    time: "14:28:03",
    title: "현장 에이전트 연결됨",
    detail: "시뮬레이터 · SITL Camera Rig",
    kind: "system",
  },
  {
    id: "evt-2",
    time: "14:29:16",
    title: "영상 스트림 준비 완료",
    detail: "테스트 스트림 · 실제 기체 영상 아님",
    kind: "system",
  },
  {
    id: "evt-3",
    time: "14:29:42",
    title: "임무 수락됨",
    detail: "박현우 운영자",
    kind: "operator",
  },
];

const commandDetails: Record<
  CameraCommandType,
  { label: string; note: string; icon: string }
> = {
  "camera.capture_photo": {
    label: "사진 촬영",
    note: "정지 이미지 캡처",
    icon: "◉",
  },
  "camera.start_video": {
    label: "녹화 시작",
    note: "현장 카메라 녹화",
    icon: "●",
  },
  "camera.stop_video": {
    label: "녹화 종료",
    note: "진행 중인 녹화 종료",
    icon: "■",
  },
  "camera.zoom": { label: "줌 조정", note: "지원 기체의 광학 줌", icon: "⌕" },
};

const formatClock = () =>
  new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    drone: (
      <>
        <path d="m8 10 4 2 4-2" />
        <path d="M12 12v5" />
        <path d="M8 10 5 7m11 3 3-3" />
        <path d="M5 7H3m16 0h2M12 17l-2 3m2-3 2 3" />
        <circle cx="5" cy="7" r="2" />
        <circle cx="19" cy="7" r="2" />
        <circle cx="12" cy="18" r="2" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15m6-12v15" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    signal: (
      <>
        <path d="M2 9a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0m-11 3a5 5 0 0 1 8 0" />
        <path d="M12 19h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    play: <path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none" />,
    expand: (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

export function DroneControlPage() {
  const runtime = useMemo(() => getDroneRuntimeConfig(), []);
  const [mode, setMode] = useState<ControlMode>("simulation");
  const [zoom, setZoom] = useState(2);
  const [commands, setCommands] = useState<CameraCommand[]>([]);
  const [events, setEvents] = useState(initialEvents);
  const [mission, setMission] = useState<DroneMission>(initialMission);
  const [toast, setToast] = useState("");
  const [requestText, setRequestText] = useState("");
  const [missionIdInput, setMissionIdInput] = useState(runtime.missionId);
  const [createTitle, setCreateTitle] = useState("");
  const [liveState, setLiveState] = useState<DroneLiveState>({ connected: false, lastEventAt: null, message: "시뮬레이션 모드" });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const vehicle = simulatedVehicle;
  const isSimulation = mode === "simulation";

  const videoLabel = useMemo(
    () => isSimulation ? "시뮬레이션 스트림" : videoUrl ? "MediaMTX WebRTC 연결" : "현장 스트림 연결 대기",
    [isSimulation, videoUrl],
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const addEvent = useCallback((title: string, detail: string, kind: MissionEvent["kind"] = "request") => {
    setEvents((current) => [{ id: crypto.randomUUID(), time: formatClock(), title, detail, kind }, ...current]);
  }, []);

  const addLiveEvent = useCallback((event: DroneLiveEvent) => {
    const detail = typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload);
    addEvent(event.event, detail.slice(0, 180), event.event.startsWith("camera.") ? "operator" : "system");
    setLiveState((current) => ({ ...current, lastEventAt: event.receivedAt }));
    if (event.event === "camera.command.completed") notify("현장 카메라 작업 결과가 도착했습니다.");
  }, [addEvent, notify]);

  useEffect(() => {
    if (mode !== "live") return;
    let disposed = false;
    let disconnect: (() => void) | undefined;
    setLoading(true);
    setErrorMessage("");
    setVideoUrl(null);
    void getMission(runtime).then(async (loadedMission) => {
      if (disposed) return;
      setMission(loadedMission);
      addEvent("실제 임무 API 연결", `${loadedMission.id} 임무를 불러왔습니다.`, "system");
      try {
        const history = await getMissionEvents(runtime, loadedMission.id);
        if (!disposed && history.length) setEvents(history);
      } catch (error) {
        if (!disposed) setErrorMessage(`임무 이벤트 조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      }
      if (disposed) return;
      void connectMissionRealtime(runtime, loadedMission.id, addLiveEvent, setLiveState).then((cleanup) => {
        if (disposed) cleanup();
        else disconnect = cleanup;
      });
      try {
        const session = await createMissionVideoSession(runtime, loadedMission.id);
        if (disposed) return;
        if (session.playbackUrl && /^https:\/\//i.test(session.playbackUrl)) setVideoUrl(session.playbackUrl);
        else setErrorMessage("임무별 HTTPS 인증 재생 URL이 없습니다. 공개 MediaMTX 경로를 대신 사용하지 않습니다.");
      } catch (error) {
        if (!disposed) setErrorMessage(`영상 세션 연결 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      }
    }).catch((error: unknown) => {
      if (!disposed) setErrorMessage(error instanceof Error ? error.message : "임무 API 요청 실패");
    }).finally(() => {
      if (!disposed) setLoading(false);
    });
    return () => {
      disposed = true;
      disconnect?.();
    };
  }, [mode, runtime, addEvent, addLiveEvent]);

  const requestCommand = async (type: CameraCommandType) => {
    if (mode === "live") {
      if (!mission.id) return notify("임무가 로드되지 않아 요청할 수 없습니다.");
      setLoading(true);
      try {
        const result = await submitCameraCommand(runtime, mission.id, type, type === "camera.zoom" ? { level: zoom } : {});
        addEvent(`${commandDetails[type].label} 요청 전송`, `서버 상태: ${result.status}`, "request");
        notify("카메라 작업 요청을 서버에 보냈습니다. 현장 승인 결과를 기다립니다.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "카메라 요청 전송 실패";
        setErrorMessage(message);
        notify(message);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!vehicle.capabilities.includes(type)) {
      notify("이 기체에서 지원하지 않는 카메라 기능입니다.");
      return;
    }
    const label = commandDetails[type].label;
    const command: CameraCommand = {
      id: crypto.randomUUID(), label, type, status: "pending_approval", requestedBy: "나 (의뢰인)",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    setCommands((current) => [command, ...current]);
    addEvent(`${label} 승인 요청`, "현장 운영자 승인 대기 · 시뮬레이션", "request");
    notify(`${label} 요청을 보냈습니다. 현장 승인을 기다립니다.`);
  };

  const decideCommand = (id: string, approved: boolean) => {
    if (mode === "live") {
      notify("실제 승인은 인증된 현장 운영자용 API가 구현된 뒤 사용할 수 있습니다.");
      return;
    }
    const current = commands.find((command) => command.id === id);
    if (!current) return;
    setCommands((items) =>
      items.map((command) =>
        command.id === id
          ? { ...command, status: approved ? "completed" : "rejected" }
          : command,
      ),
    );
    const result = approved
      ? "승인 후 시뮬레이터에서 완료됨"
      : "현장 운영자가 요청을 거절함";
    addEvent(
      `${current.label} ${approved ? "완료" : "거절"}`,
      result,
      "operator",
    );
    notify(
      approved
        ? "시뮬레이션 명령이 승인되어 완료됐습니다."
        : "요청을 거절했습니다.",
    );
  };

  const submitNaturalRequest = () => {
    const text = requestText.trim();
    if (!text) return;
    addEvent(
      "카메라 작업 요청 메모",
      `“${text}” · AI 또는 기체로 전송되지 않음`,
      "request",
    );
    setRequestText("");
    notify("요청 메모를 기록했습니다. 자동 실행되지 않습니다.");
  };

  return (
    <div className="drone-app">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="GoLive 홈">
          <span className="brand-mark">
            <Icon name="drone" size={21} />
          </span>
          <span>
            go<span className="brand-accent">live</span>
            <small>.wiki</small>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch">
          <span className="workspace-avatar">GL</span>
          <span>
            <b>GoLive 운영</b>
            <small>관제 워크스페이스</small>
          </span>
          <span className="workspace-caret">⌄</span>
        </div>
        <nav className="side-nav" aria-label="주 메뉴">
          <span className="nav-section-label">워크스페이스</span>
          <a href="/screens-04-dashboard.html" className="side-link">
            <Icon name="grid" />
            <span>대시보드</span>
            <span className="nav-count">3</span>
          </a>
          <a href="/drone.html" className="side-link active">
            <Icon name="drone" />
            <span>드론 관제</span>
            <span className="active-pip" />
          </a>
          <a href="#mission" className="side-link">
            <Icon name="map" />
            <span>임무 목록</span>
          </a>
          <a href="#activity" className="side-link">
            <Icon name="clock" />
            <span>활동 기록</span>
          </a>
          <span className="nav-section-label nav-section-spaced">시스템</span>
          <a href="#connection" className="side-link">
            <Icon name="signal" />
            <span>장치 연결</span>
          </a>
          <a href="#safety" className="side-link">
            <Icon name="shield" />
            <span>안전 및 권한</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <div>
              <b>안전 우선 MVP</b>
              <small>비행 제어는 비활성화되어 있습니다.</small>
            </div>
          </div>
          <button className="profile-button" type="button">
            <span className="profile-avatar">MH</span>
            <span>
              <b>민서 한</b>
              <small>의뢰인 계정</small>
            </span>
            <span className="profile-more">•••</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>워크스페이스</span>
            <Icon name="chevron" size={14} />
            <b>드론 관제</b>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">2026년 10월 23일</span>
            <button className="icon-button" aria-label="알림">
              <Icon name="bell" />
            </button>
            <span className="top-avatar">MH</span>
          </div>
        </header>
        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                FIELD OPERATIONS <span className="eyebrow-dot">/</span> MISSION
                CONTROL
              </div>
              <h1>드론 관제</h1>
              <p>현장과 연결하고, 안전하게 카메라 작업을 요청하세요.</p>
            </div>
            <div className="heading-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setMode("simulation");
                  setMission(initialMission);
                  setVideoUrl(null);
                  setErrorMessage("");
                  setLiveState({ connected: false, lastEventAt: null, message: "시뮬레이션 모드" });
                  notify("시뮬레이션 모드로 전환했습니다.");
                }}
              >
                <span className="button-spark">✳</span> 테스트 환경
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                ＋ 새 임무 요청
              </button>
            </div>
          </section>

          <div className={`simulation-banner ${isSimulation ? "" : "live-banner"}`}>
            <span className="banner-pulse" />
            <div>
              <b>{isSimulation ? "시뮬레이션 모드" : "실제 임무 API 연결 모드"}</b>
              <span>{isSimulation ? "테스트 데이터입니다. 실제 기체 연결이나 명령 실행이 발생하지 않습니다." : liveState.message}</span>
            </div>
            {isSimulation ? <form className="live-connect-form" onSubmit={(event) => {
              event.preventDefault();
              if (!runtime.supabaseUrl || !runtime.supabaseAnonKey || !runtime.getAccessToken()) {
                notify("Supabase 설정과 현재 GoLive 로그인 세션을 연결해야 합니다.");
                return;
              }
              if (!missionIdInput.trim()) {
                notify("연결할 드론 임무 ID를 입력하세요.");
                return;
              }
              runtime.missionId = missionIdInput.trim();
              setMode("live");
            }}>
              <input value={missionIdInput} onChange={(event) => setMissionIdInput(event.target.value)} placeholder="임무 ID" aria-label="연결할 임무 ID" />
              <button type="submit">임무 연결 <Icon name="chevron" size={14} /></button>
            </form> : <button type="button" onClick={() => {
              setMode("simulation");
              setMission(initialMission);
              setVideoUrl(null);
              setErrorMessage("");
              notify("시뮬레이션 모드로 전환했습니다.");
            }}>시뮬레이션으로 전환</button>}
          </div>

          <section className="stat-grid" aria-label="임무 현황">
            <article className="stat-card">
              <div className="stat-top">
                <span>진행 중인 임무</span>
                <span className="stat-icon mint">
                  <Icon name="map" size={17} />
                </span>
              </div>
              <div className="stat-value">
                01 <small>/ 04</small>
              </div>
              <div className="stat-foot">
                <span className="mini-dot mint-dot" />
                현재 임무 1건 진행 중
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>현장 에이전트</span>
                <span className="stat-icon blue">
                  <Icon name="signal" size={17} />
                </span>
              </div>
              <div className="stat-value stat-status">
                <i className="status-dot" />
                시뮬레이션
              </div>
              <div className="stat-foot">
                실제 장치 <b className="muted-strong">미연결</b>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>영상 연결</span>
                <span className="stat-icon purple">
                  <Icon name="play" size={16} />
                </span>
              </div>
              <div className="stat-value">테스트 피드</div>
              <div className="stat-foot">
                <span className="mini-dot mint-dot" />
                브라우저 미리보기
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>승인 대기</span>
                <span className="stat-icon amber">
                  <Icon name="clock" size={17} />
                </span>
              </div>
              <div className="stat-value">
                {commands
                  .filter((command) => command.status === "pending_approval")
                  .length.toString()
                  .padStart(2, "0")}
              </div>
              <div className="stat-foot">카메라 작업 승인 필요</div>
            </article>
          </section>

          <div className="content-grid">
            <div className="primary-column">
              <section className="panel video-panel" aria-label="현장 영상">
                <div className="panel-heading video-heading">
                  <div>
                    <div className="panel-kicker">LIVE FIELD VIEW</div>
                    <h2>현장 영상</h2>
                  </div>
                  <div className="video-heading-right">
                    <span className="video-state">
                      <i /> {loading ? "연결 확인 중" : liveState.connected && !isSimulation ? "실시간 연결됨" : videoLabel}
                    </span>
                    <button className="video-more" aria-label="영상 옵션">
                      •••
                    </button>
                  </div>
                </div>
                <div
                  className={`video-frame ${!isSimulation && !videoUrl ? "video-frame-idle" : ""}`}
                >
                  {videoUrl && !isSimulation ? <iframe className="mediamtx-player" src={videoUrl} title="임무 실시간 영상" allow="autoplay; fullscreen; picture-in-picture" /> : isSimulation ? (
                    <>
                      <div className="land-grid" />
                      <div className="terrain terrain-back" />
                      <div className="terrain terrain-front" />
                      <div className="field-lines">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                      <div className="video-top-tags">
                        <span>
                          <i /> SIMULATED FEED
                        </span>
                        <span>
                          1280 × 720 <b>·</b> 30 FPS
                        </span>
                      </div>
                      <div className="target-frame">
                        <i className="corner tl" />
                        <i className="corner tr" />
                        <i className="corner bl" />
                        <i className="corner br" />
                        <span>AOI A-03</span>
                      </div>
                      <div className="video-center">
                        <button
                          className="video-play"
                          onClick={() =>
                            notify(
                              "테스트 영상은 샘플 프레임으로 표시 중입니다.",
                            )
                          }
                          aria-label="테스트 영상 재생"
                        >
                          <Icon name="play" size={20} />
                        </button>
                        <span>테스트 영상 미리보기</span>
                        <small>실시간 스트림 미연결</small>
                      </div>
                      <div className="video-coordinates">
                        <span>37° 48′ 12.4″ N</span>
                        <span>126° 41′ 08.2″ E</span>
                      </div>
                      <div className="video-controls">
                        <span className="video-live-pill">
                          <i /> TEST
                        </span>
                        <span className="video-clock">14:30:16</span>
                        <div className="video-control-spacer" />
                        <span className="video-res">HD</span>
                        <button
                          aria-label="영상 확대"
                          onClick={() =>
                            notify("실제 스트림 연결 후 사용할 수 있습니다.")
                          }
                        >
                          <Icon name="expand" size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="video-disconnected">
                      <span className="disconnected-icon">
                        <Icon name="signal" size={24} />
                      </span>
                      <b>현장 에이전트 연결 대기</b>
                      <span>
                        인증된 에이전트가 연결되면 임무 영상을 표시합니다.
                      </span>
                    </div>
                  )}
                </div>
                <div className="video-caption">
                  <div className="vehicle-mini">
                    <span className="vehicle-mini-icon">
                      <Icon name="drone" size={17} />
                    </span>
                    <span>
                      <b>{isSimulation ? vehicle.model : "기체 상태 조회 대기"}</b>
                      <small>{isSimulation ? `${vehicle.vendor} 어댑터 · 시뮬레이터` : liveState.connected ? "임무 이벤트 채널" : "실제 기체 미확인"}</small>
                    </span>
                  </div>
                  <span className="caption-separator" />
                  <span className="caption-detail">
                    <Icon name="map" size={15} /> 관심 구역 A-03
                  </span>
                  <span className="caption-detail">
                    <Icon name="clock" size={15} /> 마지막 업데이트 14:30:16
                  </span>
                  <span className="caption-spacer" />
                  <button
                    className="text-button"
                    onClick={() =>
                      notify("임무별 스트림 권한이 발급되면 연결됩니다.")
                    }
                  >
                    스트림 설정 <Icon name="chevron" size={13} />
                  </button>
                </div>
              </section>

              {errorMessage && <div className="drone-error" role="alert"><b>연결 또는 API 오류</b><span>{errorMessage}</span><button onClick={() => { setErrorMessage(""); setMode("live"); }}>다시 시도</button></div>}

              <section className="panel mission-panel" id="mission">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">ACTIVE MISSION</div>
                    <h2>현재 임무</h2>
                  </div>
                  <span className="mission-id">{mission.id}</span>
                </div>
                <div className="mission-body">
                  <div className="mission-main">
                    <div className="mission-title-row">
                      <h3>{mission.title}</h3>
                      <span className="mission-status">
                        <i />
                        진행 중
                      </span>
                    </div>
                    <div className="mission-meta">
                      <span>
                        <Icon name="map" size={15} />
                        {mission.location}
                      </span>
                      <span>
                        <Icon name="clock" size={15} />
                        {mission.scheduledAt}
                      </span>
                      <span>
                        <span className="person-dot">김</span>
                        {mission.requester}
                      </span>
                    </div>
                    <div className="mission-progress">
                      <div className="progress-label">
                        <span>임무 진행 단계</span>
                        <b>
                          2 <small>/ 4</small>
                        </b>
                      </div>
                      <div className="progress-track">
                        <i />
                      </div>
                      <div className="progress-steps">
                        <span className="done">의뢰 접수</span>
                        <span className="current">현장 확인</span>
                        <span>카메라 작업</span>
                        <span>임무 완료</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="button button-outline"
                    onClick={() =>
                      notify("임무 상세 API 연결은 다음 통합 단계입니다.")
                    }
                  >
                    임무 상세 <Icon name="arrow" size={15} />
                  </button>
                </div>
              </section>

              <section className="panel camera-panel" id="camera-controls">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">CAMERA ACTIONS</div>
                    <h2>카메라 작업</h2>
                  </div>
                  <span className="approval-required">
                    <Icon name="shield" size={14} /> 현장 승인 필요
                  </span>
                </div>
                <p className="camera-description">
                  요청은 현장 운영자 승인 후 처리됩니다. 기체 기능이 확인된
                  작업만 사용할 수 있습니다.
                </p>
                <div className="camera-actions">
                  {(Object.keys(commandDetails) as CameraCommandType[]).map(
                    (type) => (
                      <button
                        className="camera-action"
                        key={type}
                        disabled={loading || (mode === "simulation" && !vehicle.capabilities.includes(type))}
                        onClick={() => requestCommand(type)}
                      >
                        <span
                          className={`camera-action-icon ${type === "camera.capture_photo" ? "mint" : type === "camera.zoom" ? "blue" : "neutral"}`}
                        >
                          {commandDetails[type].icon}
                        </span>
                        <span className="camera-action-copy">
                          <b>{commandDetails[type].label}</b>
                          <small>{commandDetails[type].note}</small>
                        </span>
                        <span className="camera-action-arrow">
                          <Icon name="arrow" size={15} />
                        </span>
                      </button>
                    ),
                  )}
                </div>
                <div className="zoom-control">
                  <div>
                    <b>줌 수준</b>
                    <small>기체별 지원 범위 내 추상 단계</small>
                  </div>
                  <div className="zoom-slider-wrap">
                    <button
                      disabled={zoom <= 1}
                      onClick={() => setZoom((value) => Math.max(1, value - 1))}
                      aria-label="줌 축소"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={zoom}
                      onChange={(event) => setZoom(Number(event.target.value))}
                      aria-label="줌 수준"
                    />
                    <button
                      disabled={zoom >= 5}
                      onClick={() => setZoom((value) => Math.min(5, value + 1))}
                      aria-label="줌 확대"
                    >
                      ＋
                    </button>
                    <span className="zoom-level">L{zoom}</span>
                  </div>
                  <button
                    className="zoom-request"
                    onClick={() => requestCommand("camera.zoom")}
                  >
                    줌 요청
                  </button>
                </div>
                {commands.length > 0 && (
                  <div className="pending-list">
                    <div className="pending-title">
                      최근 카메라 요청 <span>SIMULATION</span>
                    </div>
                    {commands.slice(0, 3).map((command) => (
                      <div className="pending-command" key={command.id}>
                        <span
                          className={`command-status-dot ${command.status}`}
                        />
                        <div>
                          <b>{command.label}</b>
                          <small>
                            {command.status === "pending_approval"
                              ? "현장 승인 대기"
                              : command.status === "completed"
                                ? "승인 후 시뮬레이션 완료"
                                : "요청 거절됨"}
                          </small>
                        </div>
                        {command.status === "pending_approval" ? (
                          <div className="approval-actions">
                            <button
                              onClick={() => decideCommand(command.id, false)}
                            >
                              거절
                            </button>
                            <button
                              onClick={() => decideCommand(command.id, true)}
                            >
                              승인
                            </button>
                          </div>
                        ) : (
                          <span className="completed-label">
                            {command.status === "completed" ? "완료" : "거절"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel request-panel" id="request-form">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">REQUEST NOTE</div>
                    <h2>현장 요청 메모</h2>
                  </div>
                  <span className="note-only-tag">실행되지 않음</span>
                </div>
                <p className="camera-description">
                  {isSimulation ? "자연어 메모를 기록할 수 있습니다. 이 MVP에서는 AI나 기체로 보내지 않으며, 카메라 명령은 위 승인 절차를 사용하세요." : "임무 요청은 서버 세션에 기록됩니다. 좌표 및 가격이 없는 임무는 생성할 수 없습니다."}
                </p>
                {isSimulation ? <form className="request-form" onSubmit={(event) => { event.preventDefault(); submitNaturalRequest(); }}>
                  <input value={requestText} onChange={(event) => setRequestText(event.target.value)} placeholder="예: 관심 구역 북쪽 가장자리 사진을 확인해 주세요" aria-label="현장 요청 메모" />
                  <button type="submit" disabled={!requestText.trim()}>메모 기록 <Icon name="arrow" size={15} /></button>
                </form> : <form className="request-form live-mission-form" onSubmit={async (event) => {
                  event.preventDefault();
                  const title = createTitle.trim();
                  if (title.length < 3) return notify("임무 제목을 3자 이상 입력하세요.");
                  setLoading(true);
                  setErrorMessage("");
                  try {
                    const created = await createMission(runtime, { title, description: requestText.trim(), address: "현장 주소 입력 필요", latitude: 0, longitude: 0, price: 0 });
                    setMission(created);
                    runtime.missionId = created.id;
                    setCreateTitle("");
                    addEvent("새 임무 생성", `${created.title} · ${created.id}`, "request");
                    notify("임무를 등록했습니다. 현장 소유자가 수락하기 전까지 활성화되지 않습니다.");
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "임무 생성에 실패했습니다.";
                    setErrorMessage(message);
                    notify(message);
                  } finally {
                    setLoading(false);
                  }
                }}>
                  <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="임무 제목" aria-label="임무 제목" required minLength={3} />
                  <input value={requestText} onChange={(event) => setRequestText(event.target.value)} placeholder="현장 요구사항 (선택)" aria-label="현장 요구사항" />
                  <button type="submit" disabled={loading || !createTitle.trim()}>임무 등록 <Icon name="arrow" size={15} /></button>
                </form>}
              </section>
            </div>

            <aside className="right-column">
              <section className="panel status-panel" id="connection">
                <div className="panel-heading compact-heading">
                  <div>
                    <div className="panel-kicker">FIELD STATUS</div>
                    <h2>현장 연결</h2>
                  </div>
                  <button className="panel-menu" aria-label="현장 상태 옵션">
                    •••
                  </button>
                </div>
                <div className="connection-card">
                  <div className="connection-orbit">
                    <span />
                    <Icon name="drone" size={25} />
                  </div>
                  <b>{isSimulation ? "시뮬레이션 에이전트" : "실제 에이전트 상태"}</b>
                  <span>{isSimulation ? "실제 에이전트 미연결" : liveState.connected ? "임무 실시간 채널 연결" : "기체 상태 조회는 서버 지원 필요"}</span>
                  <div className="connection-pill">
                    <i />
                    {isSimulation ? "테스트 환경 활성" : liveState.connected ? "실시간 이벤트 연결" : loading ? "서버 연결 확인 중" : "실제 연결 모드"}
                  </div>
                </div>
                <div className="status-rows">
                  <div>
                    <span>어댑터</span>
                    <b>
                      <i className="tiny-status" /> {isSimulation ? `${vehicle.vendor} (SITL)` : "에이전트 미연결"}
                    </b>
                  </div>
                  <div>
                    <span>카메라</span>
                    <b>{isSimulation ? "테스트 프로필" : "기능 조회 대기"}</b>
                  </div>
                  <div>
                    <span>에이전트 핑</span>
                    <b>{isSimulation ? "시뮬레이션" : liveState.connected ? "실시간 채널" : "미연결"}</b>
                  </div>
                  <div>
                    <span>마지막 연결</span>
                    <b>{isSimulation ? "14:28:03" : liveState.lastEventAt ? new Date(liveState.lastEventAt).toLocaleTimeString("ko-KR", { hour12: false }) : "없음"}</b>
                  </div>
                </div>
                <button
                  className="connection-button"
                  onClick={() => {
                    if (!runtime.supabaseUrl || !runtime.supabaseAnonKey || !runtime.getAccessToken() || !runtime.missionId) {
                      notify("실제 모드에는 API 주소, 로그인 세션, missionId가 필요합니다.");
                      return;
                    }
                    setMode("live");
                  }}
                >
                  실제 연결 대기 상태 보기 <Icon name="arrow" size={15} />
                </button>
              </section>

              <section className="panel activity-panel" id="activity">
                <div className="panel-heading compact-heading">
                  <div>
                    <div className="panel-kicker">MISSION TIMELINE</div>
                    <h2>임무 활동</h2>
                  </div>
                  <button className="panel-menu" aria-label="활동 옵션">
                    •••
                  </button>
                </div>
                <div className="timeline">
                  {events.slice(0, 6).map((event, index) => (
                    <div className="timeline-item" key={event.id}>
                      <div className={`timeline-marker ${event.kind}`}>
                        <span />
                      </div>
                      <div className="timeline-copy">
                        <div className="timeline-title">{event.title}</div>
                        <div className="timeline-detail">{event.detail}</div>
                        <time>
                          {event.time}
                          {index === 0 && (
                            <span className="just-now">방금</span>
                          )}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="all-activity"
                  onClick={() =>
                    notify("표시 중인 이벤트가 전체 시뮬레이션 기록입니다.")
                  }
                >
                  전체 활동 보기 <Icon name="arrow" size={14} />
                </button>
              </section>

              <section className="safety-card" id="safety">
                <div className="safety-heading">
                  <span>
                    <Icon name="shield" size={17} />
                  </span>
                  <b>안전 가드레일</b>
                  <i>ACTIVE</i>
                </div>
                <ul>
                  <li>
                    <span>✓</span> 비행 제어 명령 미지원
                  </li>
                  <li>
                    <span>✓</span> 카메라 작업은 현장 승인 후 처리
                  </li>
                  <li>
                    <span>✓</span> 기능 미지원 시 실행 차단
                  </li>
                  <li>
                    <span>✓</span> 만료·오프라인 시 fail-closed
                  </li>
                </ul>
                <div className="safety-footer">
                  실제 장치 연결 및 실행 <b>비활성</b>
                </div>
              </section>

              <div className="help-inline">
                <span>ⓘ</span>
                <p>
                  연결에 문제가 있나요?
                  <br />
                  <button
                    onClick={() =>
                      notify("현장 에이전트 통합 안내는 준비 중입니다.")
                    }
                  >
                    연결 가이드 보기 <Icon name="arrow" size={12} />
                  </button>
                </p>
              </div>
            </aside>
          </div>
          <footer className="page-footer">
            <span>
              GOLIVE FIELD OPERATIONS <b>·</b> MVP PREVIEW
            </span>
            <span>시뮬레이션 상태는 실제 장치 동작을 나타내지 않습니다.</span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
