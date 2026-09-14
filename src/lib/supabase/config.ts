// Valores padrão do projeto Supabase já provisionado para o PIER7
// (pier7-multiempresa, ref xdrjhiqkckjrqpxjpxwi). A anon key é segura para
// ficar no bundle do client — quem protege os dados é o RLS no banco, não
// o sigilo desta chave. Definir NEXT_PUBLIC_SUPABASE_URL /
// NEXT_PUBLIC_SUPABASE_ANON_KEY como env vars sobrescreve estes padrões,
// por exemplo se um dia migrar para outro projeto Supabase.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xdrjhiqkckjrqpxjpxwi.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcmpoaXFrY2tqcnFweGpweHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTkwNjIsImV4cCI6MjEwNDUzNTA2Mn0.V2gUW_9VC7LAjpYDP86WJGBEE7_RtJgPWDWAd_TntJE";
