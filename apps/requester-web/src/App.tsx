import { useCallback, useEffect, useMemo, useState } from "react";
import { GoLiveClient } from "@golive/bridge/client";
import type { GoLiveTask, TaskCategory, TaskEvent, VideoSession } from "@golive/bridge/types";

const API_BASE = import.meta.env.VITE_GOLIVE_API_BASE ?? "http://127.0.0.1:4100";
const TOKEN_KEY = "golive.dev.token";

/**
 * Dev-only credential entry. In production the bearer token comes from the GoLive
 * Supabase session; identity is always resolved server-side from that token.
 */
function useAccessToken() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const login = (value: string) => { sessionStorage.setItem(TOKEN_KEY, value); setToken(value); };
  const logout = () => { sessionStorage.removeItem(TOKEN_KEY); setToken(null); };
  return { token, login, logout };
}

const categories: { value: TaskCategory; label: string }[] = [
  { value: "translation", label: "읽기 / 번역" },
  { value: "inspection", label: "현장 확인" },
  { value: "shopping", label: "상품 확인" },
  { value: "delivery", label: "물건 전달" },
  { value: "other", label: "기타" },
];

const statusLabel: Record<string, string> = {
  open: "모집 중", accepted: "수락됨", in_progress: "진행 중", completed: "완료", cancelled: "취소",
};

export default function App() {
  const { token, login, logout } = useAccessToken();
  const client = useMemo(() => new GoLiveClient({ baseUrl: API_BASE, getAccessToken: async () => token }), [token]);

  const [tasks, setTasks] = useState<GoLiveTask[]>([]);
  const [selected, setSelected] = useState<GoLiveTask | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [session, setSession] = useState<VideoSession | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("표지판 읽기 및 번역");
  const [description, setDescription] = useState("앞에 있는 표지판의 글자를 읽고 한국어로 번역해 주세요.");
  const [category, setCategory] = useState<TaskCategory>("translation");
  const [budget, setBudget] = useState("5");

  const refresh = useCallback(async () => {
    if (!token) return;
    try { setTasks(await client.listTasks()); }
    catch (error) { setNotice(`목록을 불러오지 못했습니다: ${(error as Error).message}`); }
  }, [client, token]);

  const refreshDetail = useCallback(async (task: GoLiveTask) => {
    try {
      setSelected(await client.getTask(task.id));
      setEvents(await client.listEvents(task.id));
    } catch (error) { setNotice(`상세 조회 실패: ${(error as Error).message}`); }
  }, [client]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => { void refresh(); if (selected) void refreshDetail(selected); }, 5000);
    return () => clearInterval(timer);
  }, [refresh, refreshDetail, selected, token]);

  useEffect(() => {
    if (!selected) { setEvents([]); setSession(null); }
  }, [selected?.id]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setNotice("");
    try { await action(); setNotice(success); await refresh(); }
    catch (error) { setNotice(`실패: ${(error as Error).message}`); }
    finally { setBusy(false); }
  }

  if (!token) {
    return (
      <main className="layout">
        <header>
          <div>
            <p className="eyebrow">GOLIVE · FIELD TASKS</p>
            <h1>스마트글라스 작업 의뢰</h1>
            <p className="muted">현장 사용자와 원격 의뢰인을 연결하는 MVP</p>
          </div>
        </header>
        <section className="panel loginPanel">
          <h2>로그인</h2>
          <p className="hint">
            인증된 작업만 조회·등록할 수 있습니다. 아래에 GoLive 세션의 액세스 토큰(JWT)을 붙여넣으세요.
            사용자 신원은 서버가 토큰에서 읽으므로 입력할 필요가 없습니다.
          </p>
          <form onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("token");
            if (typeof value === "string" && value.trim()) login(value.trim());
          }}>
            <label>액세스 토큰<textarea name="token" rows={4} required placeholder="eyJhbGciOi..." /></label>
            <button type="submit">로그인</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="layout">
      <header>
        <div>
          <p className="eyebrow">GOLIVE · FIELD TASKS</p>
          <h1>스마트글라스 작업 의뢰</h1>
          <p className="muted">로그인 세션으로 인증된 의뢰 관리</p>
        </div>
        <button className="secondary" onClick={logout}>로그아웃</button>
      </header>

      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="columns">
        <section className="panel">
          <h2>새 작업 의뢰</h2>
          <form onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const created = await client.createTask({ title, description, category, budget: Number(budget) || 0, currency: "USD" });
              setSelected(created);
              setEvents(await client.listEvents(created.id));
            }, "의뢰가 등록되었습니다.");
          }}>
            <label>작업 제목<input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} /></label>
            <label>상세 요청<textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} /></label>
            <label>작업 종류<select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select></label>
            <label>예산 (USD)<input type="number" min="0" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
            <button type="submit" disabled={busy}>의뢰 등록</button>
          </form>
          <p className="hint">예산은 원화 없이 정수 단위로 저장됩니다. 실제 결제는 연결되어 있지 않습니다.</p>
        </section>

        <section className="panel">
          <h2>내 의뢰</h2>
          {tasks.length === 0 && <p className="muted">아직 의뢰가 없습니다. 왼쪽에서 첫 의뢰를 등록하세요.</p>}
          <div className="taskList">
            {tasks.map((task) => (
              <button className={`task ${selected?.id === task.id ? "active" : ""}`} key={task.id} onClick={() => void refreshDetail(task)}>
                <span className="taskTop">
                  <strong>{task.title}</strong>
                  <span className={`status ${task.status}`}>{statusLabel[task.status] ?? task.status}</span>
                </span>
                <span className="muted">{task.category} · {task.budget} {task.currency}</span>
                <span>{task.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {selected && (
        <section className="panel detail">
          <div className="detailHead">
            <div>
              <p className="eyebrow">TASK DETAIL</p>
              <h2>{selected.title}</h2>
              <p className="muted">{selected.category} · 예산 {selected.budget} {selected.currency}</p>
            </div>
            <span className={`status ${selected.status}`}>{statusLabel[selected.status] ?? selected.status}</span>
          </div>

          <div className="videoPlaceholder">
            <div className="cameraIcon">◉</div>
            <strong>스마트글라스 실시간 영상</strong>
            {session ? (
              <>
                <p>현장 사용자가 공유에 동의했습니다. 아래 링크는 임무 전용이며 자동 만료됩니다.</p>
                <small>{new Date(session.expiresAt).toLocaleTimeString()}까지 유효</small>
              </>
            ) : (
              <>
                <p>현장 사용자가 영상 공유에 동의하면 세션이 발급됩니다.</p>
                <small>동의 전에는 영상이 표시되지 않습니다.</small>
              </>
            )}
          </div>

          <p className="hint">
            수락·시작·완료는 현장 사용자(워커)만 수행할 수 있습니다. 의뢰인은 요청과 확인만 할 수 있습니다.
          </p>

          <div className="actions wrap">
            <button className="secondary" disabled={busy || selected.status !== "accepted"} onClick={() => void run(async () => {
              setSession(await client.createVideoSession(selected.id));
            }, "영상 세션을 확인했습니다.")}>영상 세션 상태 확인</button>
          </div>

          <h3>작업 기록</h3>
          {events.length === 0 ? <p className="muted">아직 기록이 없습니다.</p> : (
            <ul className="instructionList">
              {events.map((event) => (
                <li key={event.id}>
                  <div><strong>{event.type}</strong><span className="status">{event.actorId}</span></div>
                  <p>{event.detail}</p>
                  <small>{new Date(event.createdAt).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <footer>GoLive Smart Glass MVP · 인증된 API · 동의 기반 영상 공유</footer>
    </main>
  );
}
