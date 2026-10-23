import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GoLiveClient } from "@golive/bridge/client";
import type { GoLiveTask, TaskCategory, VideoSession } from "@golive/bridge/types";
import "./golive.css";

type Props = {
  getAccessToken: () => Promise<string | null>;
  apiBaseUrl?: string;
  /** 인증된 워커 ID. 서버가 수락·시작·완료의 주체를 이 값으로 검증합니다. */
  workerId: string;
};

const categories: { value: TaskCategory | ""; label: string }[] = [
  { value: "", label: "모든 작업" },
  { value: "translation", label: "읽기·번역" },
  { value: "inspection", label: "현장 확인" },
  { value: "shopping", label: "상품 확인" },
  { value: "delivery", label: "전달·배달" },
  { value: "other", label: "기타" }
];

export default function GoLiveTaskInbox({ getAccessToken, apiBaseUrl = import.meta.env.VITE_GOLIVE_API_BASE, workerId }: Props) {
  const client = useMemo(() => new GoLiveClient({ baseUrl: apiBaseUrl, getAccessToken }), [apiBaseUrl, getAccessToken]);
  const [tasks, setTasks] = useState<GoLiveTask[]>([]);
  const [selected, setSelected] = useState<GoLiveTask | null>(null);
  const [category, setCategory] = useState<TaskCategory | "">("");
  const [sharingConsent, setSharingConsent] = useState(false);
  const [videoSession, setVideoSession] = useState<VideoSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await client.listOpenTasks(category || undefined);
      setTasks(data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "작업 목록을 불러오지 못했습니다.");
    }
  }, [client, category]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice("");
    try { await action(); setNotice(success); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "요청에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function accept(task: GoLiveTask) {
    await run(async () => { const updated = await client.acceptTask(task.id, workerId); setSelected(updated); }, "의뢰를 수락했습니다.");
  }
  async function start() {
    if (!selected) return;
    await run(async () => { const updated = await client.startTask(selected.id, workerId); setSelected(updated); }, "작업을 시작했습니다.");
  }
  async function sendNote() {
    if (!selected || !note.trim()) return;
    await run(async () => {
      await client.addEvent(selected.id, { type: "worker_note", message: note.trim() });
      setNote("");
    }, "의뢰인에게 작업 업데이트를 보냈습니다.");
  }
  async function consentAndConnect() {
    if (!selected) return;
    if (!sharingConsent) {
      setNotice("실시간 공유에 동의한 뒤 시작할 수 있습니다.");
      return;
    }
    await run(async () => {
      await client.setSharingConsent(selected.id, true, workerId);
      const session = await client.createVideoSession(selected.id, workerId);
      setVideoSession(session);
    }, "공유 세션을 만들었습니다. 지원되는 글라스 앱/SDK의 영상 출력을 연결하세요.");
  }
  async function stopSharing() {
    if (!selected) return;
    await run(async () => {
      await client.setSharingConsent(selected.id, false, workerId);
      setVideoSession(null);
    }, "공유 중지 요청을 전송했습니다.");
  }
  async function complete() {
    if (!selected) return;
    await run(async () => {
      if (sharingConsent) await client.setSharingConsent(selected.id, false, workerId);
      const updated = await client.completeTask(selected.id, workerId);
      setSelected(updated); setSharingConsent(false); setVideoSession(null);
    }, "작업을 완료했습니다.");
  }

  return <section className="golive-glass">
    <header className="gg-header">
      <div><p className="gg-eyebrow">DADABOT × GOLIVE</p><h1>현장 작업함</h1><p>스마트글라스 사용자가 작업을 수락하고 원격 의뢰인과 협업합니다.</p></div>
      <button className="gg-secondary" onClick={() => void load()} disabled={busy}>새로고침</button>
    </header>
    {notice && <div className="gg-notice" role="status">{notice}</div>}
    <div className="gg-grid">
      <aside className="gg-panel">
        <div className="gg-panel-title"><h2>작업 찾기</h2><span>{tasks.length}건</span></div>
        <label className="gg-label">작업 유형
          <select value={category} onChange={e => setCategory(e.target.value as TaskCategory | "")}>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <div className="gg-task-list">
          {tasks.map(task => <button className={`gg-task ${selected?.id === task.id ? "is-selected" : ""}`} key={task.id} onClick={() => { setSelected(task); setVideoSession(null); setSharingConsent(false); }}>
            <strong>{task.title}</strong><span>{task.locationLabel || "위치 미지정"} · {task.category}</span>
            <p>{task.description}</p><small>{task.budget ?? 0} {task.currency}</small>
            <span className="gg-link">작업 상세 보기 →</span>
          </button>)}
          {tasks.length === 0 && <p className="gg-muted">현재 공개된 의뢰가 없습니다.</p>}
        </div>
      </aside>
      <main className="gg-panel">
        {!selected ? <div className="gg-empty"><span>⌕</span><h2>작업을 선택하세요</h2><p>의뢰 내용을 확인한 뒤 수락할 수 있습니다.</p></div> :
        <>
          <div className="gg-task-heading"><div><p className="gg-eyebrow">TASK DETAIL</p><h2>{selected.title}</h2><p>{selected.locationLabel || "위치 미지정"} · {selected.budget ?? 0} {selected.currency}</p></div><span className={`gg-status ${selected.status}`}>{selected.status}</span></div>
          <p className="gg-description">{selected.description}</p>
          {selected.status === "open" && <button disabled={busy} onClick={() => void accept(selected)}>이 작업 수락</button>}
          {selected.status === "accepted" && <button disabled={busy} onClick={() => void start()}>작업 시작</button>}
          {selected.status === "in_progress" && <>
            <div className="gg-video"><div className="gg-video-icon">◉</div><strong>{videoSession ? "영상 세션 생성됨" : "실시간 영상 공유"}</strong><p>{videoSession ? "기기 SDK/앱의 영상 송출을 이 세션에 연결해야 합니다." : "공유를 시작하기 전 의뢰인과 현장 사용자의 동의를 확인하세요."}</p>{videoSession && <code>{videoSession.playbackUrl}</code>}</div>
            <label className="gg-consent"><input type="checkbox" checked={sharingConsent} onChange={e => setSharingConsent(e.target.checked)}/><span>의뢰인에게 카메라 영상을 실시간 공유하는 데 동의합니다. 촬영 표시를 유지하고 언제든 공유를 중지할 수 있습니다.</span></label>
            <div className="gg-actions"><button disabled={busy || !sharingConsent} onClick={() => void consentAndConnect()}>공유 시작</button><button className="gg-danger" disabled={busy || !videoSession} onClick={() => void stopSharing()}>공유 중지</button></div>
            <h3>의뢰인에게 진행 상황 전달</h3><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="예: 간판 글자를 확인하고 번역 중입니다."/><button className="gg-secondary" disabled={busy || !note.trim()} onClick={() => void sendNote()}>업데이트 전송</button>
            <div className="gg-actions"><button className="gg-secondary" disabled={busy} onClick={() => void complete()}>작업 완료</button></div>
          </>}
        </>}
      </main>
    </div>
    <p className="gg-footer">영상은 이 UI에서 자동으로 시작되지 않습니다. 실제 영상에는 GoLive의 권한 검사와 지원되는 글라스 앱/SDK 연결이 필요합니다.</p>
  </section>;
}
