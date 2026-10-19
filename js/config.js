// Supabase 환경 설정
// .env 또는 vite 환경 변수에서 주입받으며, 미설정 시 플레이스홀더 사용
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://acxrgrzbukrvvfivysip.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjeHJncnpidWtydnZmaXZ5c2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzY0MDAsImV4cCI6MjEwNzk1MjQwMH0.7xJLloYCQ19jshk3OsHDI0wb4EsYJDPyLn3Il3LmTAs';
export const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? '';