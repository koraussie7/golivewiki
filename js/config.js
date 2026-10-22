// Robust env access: works in Vite (import.meta.env), Node, and plain script
function getEnv(key, fallback) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
}

// Supabase 환경 설정
// .env 또는 vite 환경 변수에서 주입받으며, 미설정 시 플레이스홀더 사용
export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL','https://acxrgrzbukrvvfivysip.supabase.co') ?? 'https://acxrgrzbukrvvfivysip.supabase.co';
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjeHJncnpidWtydnZmaXZ5c2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzY0MDAsImV4cCI6MjEwNzk1MjQwMH0.7xJLloYCQ19jshk3OsHDI0wb4EsYJDPyLn3Il3LmTAs') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjeHJncnpidWtydnZmaXZ5c2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzY0MDAsImV4cCI6MjEwNzk1MjQwMH0.7xJLloYCQ19jshk3OsHDI0wb4EsYJDPyLn3Il3LmTAs';
export const SUPABASE_SERVICE_ROLE_KEY = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY','') ?? '';