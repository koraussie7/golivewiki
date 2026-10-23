import { useEffect, useState } from "react";

type Task = {
  id: string; requesterId: string; workerId?: string; title: string; description: string;
  category: "translation"|"inspection"|"shopping"|"delivery"|"other";
  locationLabel?: string; budget?: number; currency: string;
  status: "open"|"accepted"|"in_progress"|"completed"|"cancelled"; createdAt: string;
};
type Instruction = { id: string; taskId: string; senderId: string; text: string; kind: string; status: string; createdAt: string };
const API = "/api";
const demoRequester = "requester-demo";
const demoWorker = "glasses-wearer-demo";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Task|null>(null);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("표지판 읽기 및 번역");
  const [description, setDescription] = useState("앞에 있는 표지판의 글자를 읽고 한국어로 번역해 주세요.");
  const [category, setCategory] = useState<Task["category"]>("translation");
  const [locationLabel, setLocationLabel] = useState("다낭");
  const [budget, setBudget] = useState("5");
  const [instructionText, setInstructionText] = useState("표지판을 정면에서 조금 더 가까이 보여주세요.");

  async function refresh() {
    const r = await fetch(`${API}/tasks`);
    if (r.ok) setTasks(await r.json());
  }
  async function refreshInstructions(task: Task) {
    const r = await fetch(`${API}/tasks/${task.id}/instructions`);
    if (r.ok) setInstructions(await r.json());
  }
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 4000); return () => clearInterval(t); }, []);
  useEffect(() => { if (selected) void refreshInstructions(selected); }, [selected?.id]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault(); setNotice("");
    const r = await fetch(`${API}/tasks`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      requesterId: demoRequester, title, description, category, locationLabel,
      budget: budget ? Number(budget) : undefined, currency:"USD"
    })});
    const data = await r.json();
    if (!r.ok) return setNotice(`등록 실패: ${data.error ?? "오류"}`);
    setSelected(data); setNotice("의뢰가 등록되었습니다."); await refresh();
  }
  async function action(path: string, body: object, success: string) {
    if (!selected) return;
    const r = await fetch(`${API}${path}`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data = await r.json();
    if (!r.ok) { setNotice(`실패: ${data.error ?? "오류"}`); return; }
    setSelected(data.id && data.title ? data : selected);
    setNotice(success); await refresh(); if (selected) await refreshInstructions(selected);
  }
  async function sendInstruction(kind: "message"|"snapshot_request"|"pause_stream"|"stop_task") {
    if (!selected) return;
    const r = await fetch(`${API}/tasks/${selected.id}/instructions`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({senderId:demoRequester,text:instructionText,kind})});
    const data = await r.json();
    if (!r.ok) return setNotice(`지시 전송 실패: ${data.error ?? "오류"}`);
    setNotice("지시가 전달되었습니다. 현장 사용자의 확인을 기다립니다."); await refreshInstructions(selected);
  }
  return <main className="layout">
    <header><div><p className="eyebrow">GOLIVE · FIELD TASKS</p><h1>스마트글라스 작업 의뢰</h1><p className="muted">현장 사용자와 원격 의뢰인을 연결하는 MVP 데모</p></div><span className="pill">영상 연결 전 데모</span></header>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="columns">
      <section className="panel">
        <h2>새 작업 의뢰</h2>
        <form onSubmit={createTask}>
          <label>작업 제목<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3}/></label>
          <label>상세 요청<textarea value={description} onChange={e=>setDescription(e.target.value)} required rows={4}/></label>
          <label>작업 종류<select value={category} onChange={e=>setCategory(e.target.value as Task["category"])}><option value="translation">읽기 / 번역</option><option value="inspection">현장 확인</option><option value="shopping">상품 확인</option><option value="delivery">물건 전달</option><option value="other">기타</option></select></label>
          <label>지역<input value={locationLabel} onChange={e=>setLocationLabel(e.target.value)} placeholder="예: 다낭 미케비치"/></label>
          <label>예산 (USD)<input type="number" min="0" step="0.5" value={budget} onChange={e=>setBudget(e.target.value)}/></label>
          <button type="submit">의뢰 등록</button>
        </form>
        <p className="hint">실제 결제는 연결되어 있지 않습니다. 데모 사용자 ID를 사용합니다.</p>
      </section>
      <section className="panel">
        <h2>등록된 의뢰</h2>
        {tasks.length===0 && <p className="muted">아직 의뢰가 없습니다. 왼쪽에서 첫 의뢰를 등록하세요.</p>}
        <div className="taskList">{tasks.map(t=><button className={`task ${selected?.id===t.id?"active":""}`} key={t.id} onClick={()=>setSelected(t)}>
          <span className="taskTop"><strong>{t.title}</strong><span className={`status ${t.status}`}>{t.status}</span></span>
          <span className="muted">{t.locationLabel || "지역 미지정"} · {t.category}</span>
          <span>{t.description}</span>
        </button>)}</div>
      </section>
    </div>
    {selected && <section className="panel detail">
      <div className="detailHead"><div><p className="eyebrow">TASK DETAIL</p><h2>{selected.title}</h2><p className="muted">{selected.locationLabel} · 예산 {selected.budget ?? 0} {selected.currency}</p></div><span className={`status ${selected.status}`}>{selected.status}</span></div>
      <div className="videoPlaceholder"><div className="cameraIcon">◉</div><strong>스마트글라스 실시간 영상</strong><p>현장 사용자 앱과 WebRTC/MediaMTX 연결 후 영상이 표시됩니다.</p><small>현재는 실제 영상이 전송되지 않는 UI 자리표시자입니다.</small></div>
      <div className="actions">
        {selected.status==="open" && <button onClick={()=>void action(`/tasks/${selected.id}/accept`,{workerId:demoWorker},"데모 스마트글라스 사용자가 의뢰를 수락했습니다.")}>데모 작업자 수락</button>}
        {selected.status==="accepted" && <button onClick={()=>void action(`/tasks/${selected.id}/start`,{actorId:demoWorker},"작업이 시작되었습니다.")}>작업 시작</button>}
        {selected.status==="in_progress" && <button onClick={()=>void action(`/tasks/${selected.id}/complete`,{actorId:demoWorker},"작업 완료 처리했습니다.")}>작업 완료</button>}
      </div>
      <h3>실시간 지시 보내기</h3>
      <p className="hint">메시지는 현장 사용자에게 전달하는 요청입니다. 이 데모에서는 기기 카메라를 자동 제어하지 않습니다.</p>
      <textarea value={instructionText} onChange={e=>setInstructionText(e.target.value)} rows={2}/>
      <div className="actions wrap">
        <button className="secondary" disabled={!["accepted","in_progress"].includes(selected.status)} onClick={()=>void sendInstruction("message")}>지시 / 메시지</button>
        <button className="secondary" disabled={!["accepted","in_progress"].includes(selected.status)} onClick={()=>void sendInstruction("snapshot_request")}>사진 요청</button>
        <button className="secondary" disabled={!["accepted","in_progress"].includes(selected.status)} onClick={()=>void sendInstruction("pause_stream")}>영상 일시정지 요청</button>
      </div>
      <h3>지시 기록</h3>
      {instructions.length===0?<p className="muted">아직 지시가 없습니다.</p>:<ul className="instructionList">{instructions.map(i=><li key={i.id}><div><strong>{i.kind}</strong><span className="status">{i.status}</span></div><p>{i.text}</p><small>{new Date(i.createdAt).toLocaleString()}</small></li>)}</ul>}
    </section>}
    <footer>GoLive Smart Glass MVP · 테스트용 예제 · 운영 전 인증/권한/DB/영상 보안을 추가하세요.</footer>
  </main>;
}
