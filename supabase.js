// ============================================================
// supabase.js — Módulo compartido (importar en script.js y news_script.js)
// ============================================================

// ⚠️  USA LA CLAVE ANON (no service_role) + activa RLS en Supabase
export const SUPABASE_URL  = "https://mkvpjsvqjqeuniabjjwr.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rdnBqc3ZxanFldW5pYWJqandyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI0MzU0OCwiZXhwIjoyMDgwODE5NTQ4fQ.No4ZOo0sawF6KYJnIrSD2CVQd1lHzNlLSplQgfuHBcg";
// ↑ Reemplaza por tu anon key real cuando actives RLS

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ------------------------------------------------------------
// Paleta neón — compartida por ambas páginas
// ------------------------------------------------------------
const NEON = ["#00ffff","#ff00ff","#00ff00","#ffff00","#ff0099",
               "#9D00FF","#FF4D00","#00E5FF","#76ff03","#ff1744"];

export function neonColor(id) {
    let h = 0;
    for (const c of String(id)) h = c.charCodeAt(0) + ((h << 5) - h);
    return NEON[Math.abs(h) % NEON.length];
}

// ------------------------------------------------------------
// timeAgo — texto relativo a partir de un timestamp ISO
// ------------------------------------------------------------
export function timeAgo(ts) {
    if (!ts) return "Sin fecha";
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 0)          return "Ahora mismo";
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m  / 60);
    const d = Math.floor(h  / 24);
    if (d >= 30)  return `hace ${Math.floor(d / 30)} meses`;
    if (d >= 7)   return `hace ${Math.floor(d / 7)} sem.`;
    if (d >= 2)   return `hace ${d} días`;
    if (d === 1)  return "hace 1 día";
    if (h >= 2)   return `hace ${h} h.`;
    if (h === 1)  return "hace 1 hora";
    if (m >= 1)   return `hace ${m} min.`;
    return "hace unos momentos";
}

// ------------------------------------------------------------
// userWebId — ID anónimo persistente por navegador
// ------------------------------------------------------------
let _uid = localStorage.getItem("userWebId");
if (!_uid) { _uid = crypto.randomUUID(); localStorage.setItem("userWebId", _uid); }
export const userWebId = _uid;

// ------------------------------------------------------------
// linkify — convierte URLs en <a>
// ------------------------------------------------------------
export function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,
        url => `<a href="${url.startsWith("http") ? url : "http://" + url}" target="_blank">${url}</a>`);
}
