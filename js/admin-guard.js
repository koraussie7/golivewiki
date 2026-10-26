/* Admin-only static page guard.
 * Frontend protection is UX only. Sensitive API routes must enforce role on server too.
 */
(() => {
  const SUPABASE_URL = 'https://acxrgrzbukrvvfivysip.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjeHJncnpidWtydnZmaXZ5c2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzY0MDAsImV4cCI6MjEwNzk1MjQwMH0.7xJLloYCQ19jshk3OsHDI0wb4EsYJDPyLn3Il3LmTAs';
  const root = document.documentElement;
  root.classList.add('admin-gate-pending');
  const authSdk = window.supabase;
  if (!window.goliveSupabase && authSdk?.createClient) {
    window.goliveSupabase = authSdk.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  const client = window.goliveSupabase;
  const loginUrl = `/login.html?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
  const deny = (message) => {
    root.classList.remove('admin-gate-pending');
    document.body.innerHTML = `<main style="font:16px system-ui;max-width:38rem;margin:12vh auto;padding:2rem;text-align:center"><h1>관리자 접근 제한</h1><p>${message}</p><a href="/login.html">로그인 페이지로 이동</a></main>`;
  };
  document.addEventListener('DOMContentLoaded', async () => {
    if (!client?.auth) { deny('인증 서비스를 사용할 수 없습니다.'); return; }
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const session = sessionData?.session;
      if (sessionError || !session) { location.replace(loginUrl); return; }
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) { location.replace(loginUrl); return; }
      const { data: isAdmin, error } = await client.rpc('is_current_user_admin');
      if (error || isAdmin !== true) {
        await client.auth.signOut();
        deny('이 계정에는 관리자 권한이 없습니다.');
        return;
      }
      root.classList.remove('admin-gate-pending');
    } catch (_) {
      deny('관리자 권한을 확인하지 못했습니다.');
    }
  }, { once: true });
})();
