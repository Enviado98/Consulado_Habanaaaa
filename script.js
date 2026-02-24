// ============================================================
// script.js — Página principal (Calendario Consular)
// ============================================================
import { supabase, neonColor, timeAgo, userWebId, linkify } from "./supabase.js";

// ─── Constantes ─────────────────────────────────────────────
const RECENT_MS          = 24 * 60 * 60 * 1000;   // 1 día
const CACHE_MS           = 10 * 60 * 1000;         // 10 min
const TICKER_SPEED       = 50;                     // px/s
const VISIT_KEY          = "lastPageView";
const RATE_RANGE         = { usd:[200,700], eur:[200,800], mlc:[150,700] };

// ─── Estado global ──────────────────────────────────────────
let isAdmin  = false;
let cards    = [];      // datos de tarjetas desde Supabase
let news     = [];      // noticias activas

let status = {
    deficit_mw: "---", dollar_cup: "---",
    euro_cup: "---",   mlc_cup: "---",
    deficit_edited_at: null, divisa_edited_at: null
};

// ─── Referencias DOM ────────────────────────────────────────
const $ = id => document.getElementById(id);
const DOM = {
    contenedor:        $("contenedor"),
    ticker:            $("newsTicker"),
    tickerContent:     $("newsTickerContent"),
    tickerStyles:      $("dynamicTickerStyles"),
    commentsContainer: $("commentsContainer"),
    commenterName:     $("commenterName"),
    commentText:       $("commentText"),
    publishCommentBtn: $("publishCommentBtn"),
    adminPanel:        $("adminControlsPanel"),
    statusMsg:         $("statusMessage"),
    toggleAdminBtn:    $("toggleAdminBtn"),
    saveBtn:           $("saveBtn"),
    addNewsBtn:        $("addNewsBtn"),
    deleteNewsBtn:     $("deleteNewsBtn"),
    statusPanel:       $("statusPanel"),
    statusData:        $("statusDataContainer"),
    viewCounter:       $("viewCounter"),
    fechaAct:          $("fecha-actualizacion"),
};

// ============================================================
// MODO ADMIN
// ============================================================
function setAdminMode(on) {
    isAdmin = on;
    document.body.classList.toggle("admin-mode", on);
    DOM.adminPanel.style.display   = on ? "flex" : "none";
    DOM.statusPanel.classList.toggle("admin-mode", on);
    DOM.toggleAdminBtn.textContent = on ? "🛑 SALIR MODO EDICIÓN" : "🛡️ ACTIVAR EL MODO EDICIÓN";
    DOM.toggleAdminBtn.className   = `btn ${on ? "btn-danger" : "btn-primary"}`;
    DOM.statusMsg.textContent      = on ? "¡🔴 EDITA CON RESPONSABILIDAD!" : "Activa modo edición y actualiza la información";
    DOM.statusMsg.style.color      = on ? "#ef233c" : "var(--color-texto-principal)";

    // Alternar formularios editables en tarjetas
    document.querySelectorAll(".card").forEach(card => {
        const idx  = +card.dataset.index;
        const item = cards[idx];
        if (!item) return;

        if (on) {
            card.classList.add("editing-active");
            card.removeEventListener("click", onCardClick);
            // Convertir contenido a inputs
            card.querySelector(".emoji").setAttribute("contenteditable", "true");
            card.querySelector(".card-title").setAttribute("contenteditable", "true");
            card.querySelector(".card-body").setAttribute("contenteditable", "true");
            card.querySelector(".card-time-panel").style.display = "none";
            const lbl = card.querySelector(".card-label");
            if (lbl) lbl.style.display = "none";
        } else {
            card.classList.remove("editing-active");
            // Leer valores editados y actualizar estado local
            item.emoji    = card.querySelector(".emoji").textContent.trim();
            item.titulo   = card.querySelector(".card-title").textContent.trim();
            item.contenido = card.querySelector(".card-body").textContent.trim();
            // Desactivar edición
            ["emoji","card-title","card-body"].forEach(cls => {
                card.querySelector(`.${cls}`).removeAttribute("contenteditable");
            });
            card.querySelector(".card-time-panel").style.display = "";
            const lbl = card.querySelector(".card-label");
            if (lbl) lbl.style.display = "";
            card.addEventListener("click", onCardClick);
        }
    });
}

function toggleAdminMode() {
    if (!isAdmin) {
        setAdminMode(true);
        alert("¡🔴 EDITA CON RESPONSABILIDAD!");
    } else {
        if (!confirm("✅ ¿Terminar la edición?")) return;
        setAdminMode(false);
        loadCards();
        loadStatusData();
    }
}

// ============================================================
// TARJETAS
// ============================================================
function cardHTML(item, idx) {
    const { text: timeText, diff } = { text: timeAgo(item.last_edited_timestamp), diff: Date.now() - new Date(item.last_edited_timestamp||0).getTime() };
    const isRecent = item.last_edited_timestamp && diff < RECENT_MS;
    const color    = neonColor(item.id);
    return `
    <div class="card ${isRecent ? "card-recent" : ""}" data-index="${idx}" data-id="${item.id}">
        ${isRecent ? `<div class="card-label">!RECIENTE!</div>` : ""}
        <span class="emoji">${item.emoji}</span>
        <h3 class="card-title" style="--card-neon:${color}">${item.titulo}</h3>
        <div class="card-content"><p class="card-body">${item.contenido}</p></div>
        <div class="card-time-panel"><strong>${isRecent ? "Reciente" : "Actualizado"}</strong> (${timeText})</div>
    </div>`;
}

function onCardClick(e) {
    if (isAdmin) return;
    const card = e.currentTarget;
    document.querySelectorAll(".card.show-time-panel").forEach(c => { if (c !== card) c.classList.remove("show-time-panel"); });
    if (card.classList.toggle("show-time-panel"))
        setTimeout(() => card.classList.remove("show-time-panel"), 3000);
}

async function loadCards() {
    const { data, error } = await supabase.from("items").select("*").order("id");
    if (error || !data) return;
    cards = data;
    DOM.contenedor.innerHTML = data.map((item, i) => cardHTML(item, i)).join("");
    DOM.contenedor.querySelectorAll(".card").forEach(c => c.addEventListener("click", onCardClick));
}

async function saveChanges() {
    if (!isAdmin) return;
    const updates = [];
    document.querySelectorAll(".card").forEach(card => {
        const idx  = +card.dataset.index;
        const orig = cards[idx];
        if (!orig) return;
        const emoji    = card.querySelector(".emoji").textContent.trim();
        const titulo   = card.querySelector(".card-title").textContent.trim();
        const contenido = card.querySelector(".card-body").textContent.trim();
        if (emoji !== orig.emoji || titulo !== orig.titulo || contenido !== orig.contenido) {
            updates.push(supabase.from("items").update({
                emoji, titulo, contenido,
                last_edited_timestamp: new Date().toISOString()
            }).eq("id", orig.id));
        }
    });
    if (!updates.length) return alert("No hay cambios que guardar.");
    await Promise.all(updates);
    alert("✅ Guardado correctamente.");
    location.reload();
}

// ============================================================
// NOTICIAS (TICKER)
// ============================================================
async function loadNews() {
    const { data } = await supabase.from("noticias").select("id,text,timestamp").order("timestamp", { ascending: false });
    if (!data) return;

    const cutoff = Date.now() - RECENT_MS;
    const valid  = [];
    const stale  = [];
    data.forEach(n => (new Date(n.timestamp).getTime() > cutoff ? valid : stale).push(n));
    if (stale.length) await supabase.from("noticias").delete().in("id", stale.map(n => n.id));
    news = valid;

    DOM.ticker.style.display = "flex";
    if (valid.length) {
        const html = valid.map(n =>
            `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp)})</small></span>`
        ).join('<span class="news-item"> | </span>');
        DOM.tickerContent.innerHTML = `${html}<span class="news-item"> | </span>${html}`;

        // Calcular duración dinámica
        // Esperamos un frame para que el navegador calcule scrollWidth
        requestAnimationFrame(() => {
            const w   = DOM.tickerContent.scrollWidth / 2;
            const dur = w / TICKER_SPEED;
            DOM.tickerStyles.textContent = `@keyframes ticker-dyn{0%{transform:translateX(0)}100%{transform:translateX(-${w}px)}}`;
            DOM.tickerContent.style.animation = `ticker-dyn ${dur}s linear infinite`;
        });
    } else {
        DOM.tickerContent.innerHTML = `<span class="news-item">Sin noticias recientes... || 🛡 Activa el modo edición para publicar</span>`.repeat(2);
        DOM.tickerContent.style.animation = "ticker-move-static 15s linear infinite";
    }
}

async function addNews() {
    if (!isAdmin) return;
    const text = prompt("✍️ Escribe tu noticia:");
    if (text?.trim() && confirm("¿Publicar?")) {
        await supabase.from("noticias").insert([{ text: text.trim() }]);
        loadNews();
    }
}

async function deleteNews() {
    if (!isAdmin || !news.length) return alert("No hay noticias.");
    const list = news.map((n, i) => `${i + 1}. ${n.text}`).join("\n");
    const idx  = parseInt(prompt(`Eliminar número:\n${list}`)) - 1;
    if (news[idx] && confirm("¿Eliminar?")) {
        await supabase.from("noticias").delete().eq("id", news[idx].id);
        loadNews();
    }
}

// ============================================================
// COMENTARIOS
// ============================================================
function avatarColor(name) {
    let h = 0;
    for (const c of name.toLowerCase()) h = c.charCodeAt(0) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360},75%,55%)`;
}

function fmtDate(ts) {
    if (!ts) return "Reciente";
    const d   = new Date(ts);
    const now = new Date();
    const hm  = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === now.toDateString()
        ? `Hoy, ${hm}`
        : `${d.toLocaleDateString("es-ES",{day:"2-digit",month:"short"})} ${hm}`;
}

function commentHTML(c, liked) {
    const color = avatarColor(c.name);
    const init  = (c.name || "?")[0].toUpperCase();
    return `
    <div class="${c.parent_id ? "comment-item reply-style" : "comment-item"}" data-comment-id="${c.id}">
        <div class="comment-main-row">
            <div class="comment-avatar" style="background:${color}">${init}</div>
            <div class="comment-bubble">
                <div class="comment-header">
                    <span class="comment-name">${c.name}</span>
                    <span class="comment-date">${fmtDate(c.timestamp)}</span>
                </div>
                <div class="comment-content">${c.text}</div>
                <div class="comment-actions">
                    <button class="like-button ${liked ? "liked" : ""}" data-id="${c.id}">
                        <span>♥</span>
                        <span class="like-count">${c.likes_count || 0}</span>
                    </button>
                    ${!c.parent_id ? `<span class="reply-form-toggle" data-id="${c.id}">Responder</span>` : ""}
                </div>
            </div>
        </div>
        ${!c.parent_id ? `
            <div class="reply-form" data-reply-to="${c.id}">
                <input class="reply-name" placeholder="Tu Nombre" maxlength="30">
                <textarea class="reply-text" placeholder="Responder..." maxlength="250"></textarea>
                <div style="text-align:right">
                    <button class="btn btn-sm btn-success publish-reply-btn" data-parent-id="${c.id}">Enviar</button>
                </div>
            </div>
            <div class="replies-container" data-parent-of="${c.id}"></div>
        ` : ""}
    </div>`;
}

async function loadComments() {
    const [cr, lr] = await Promise.all([
        supabase.from("comentarios").select("*").order("timestamp", { ascending: false }),
        supabase.from("likes").select("comment_id").eq("user_web_id", userWebId)
    ]);
    if (cr.error) {
        DOM.commentsContainer.innerHTML = `<p style="text-align:center;color:#d90429">❌ Error al cargar comentarios.</p>`;
        return;
    }

    let all = cr.data || [];
    const liked = new Set((lr.data || []).map(l => l.comment_id));

    // Purgar comentarios con >30 días sin actividad (hilo completo)
    all = await purgeStale(all);

    const roots   = all.filter(c => c.parent_id === null);
    const replies = all.reduce((m, c) => {
        if (c.parent_id !== null) {
            if (!m.has(c.parent_id)) m.set(c.parent_id, []);
            m.get(c.parent_id).push(c);
        }
        return m;
    }, new Map());

    if (!roots.length) {
        DOM.commentsContainer.innerHTML = `<p style="text-align:center;opacity:.8">Sé el primero en comentar 👇</p>`;
        return;
    }

    DOM.commentsContainer.innerHTML = roots.map(c => commentHTML(c, liked.has(c.id))).join("");

    roots.forEach(root => {
        const thread = replies.get(root.id);
        if (!thread) return;
        const container = DOM.commentsContainer.querySelector(`.replies-container[data-parent-of="${root.id}"]`);
        if (container) {
            thread.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            container.innerHTML = thread.map(r => commentHTML(r, liked.has(r.id))).join("");
        }
    });

    // Eventos
    DOM.commentsContainer.addEventListener("click", onCommentClick, { once: true });
}

// Delegación de eventos única para toda la sección de comentarios
function onCommentClick(e) {
    const btn = e.target.closest("button, .reply-form-toggle");
    if (!btn) { DOM.commentsContainer.addEventListener("click", onCommentClick, { once: true }); return; }

    if (btn.classList.contains("like-button"))       handleLike(btn);
    else if (btn.classList.contains("publish-reply-btn")) handleReply(btn);
    else if (btn.classList.contains("reply-form-toggle")) toggleReplyForm(btn.dataset.id);

    DOM.commentsContainer.addEventListener("click", onCommentClick, { once: true });
}

function toggleReplyForm(id) {
    document.querySelectorAll(".reply-form").forEach(f => { if (f.dataset.replyTo !== id) f.style.display = "none"; });
    const form = document.querySelector(`.reply-form[data-reply-to="${id}"]`);
    if (!form) return;
    form.style.display = form.style.display === "block" ? "none" : "block";
    if (form.style.display === "block") form.querySelector(".reply-name").focus();
}

async function handleLike(btn) {
    if (btn.disabled) return;
    btn.disabled  = true;
    const id      = btn.dataset.id;
    const isLiked = btn.classList.contains("liked");
    const counter = btn.querySelector(".like-count");
    const count   = parseInt(counter.textContent) || 0;

    if (isLiked) {
        await supabase.from("likes").delete().eq("comment_id", id).eq("user_web_id", userWebId);
        const n = Math.max(0, count - 1);
        await supabase.from("comentarios").update({ likes_count: n }).eq("id", id);
        btn.classList.remove("liked");
        counter.textContent = n;
    } else {
        const { error } = await supabase.from("likes").insert([{ comment_id: id, user_web_id: userWebId }]);
        if (!error) {
            const n = count + 1;
            await supabase.from("comentarios").update({ likes_count: n }).eq("id", id);
            btn.classList.add("liked");
            counter.textContent = n;
        }
    }
    btn.disabled = false;
}

async function publishComment() {
    const name = DOM.commenterName.value.trim();
    const text = DOM.commentText.value.trim();
    if (name.length < 2 || text.length < 2) return alert("Datos insuficientes.");
    DOM.publishCommentBtn.disabled = true;
    const { error } = await supabase.from("comentarios").insert([{ name, text, likes_count: 0 }]);
    if (!error) { DOM.commenterName.value = ""; DOM.commentText.value = ""; await loadComments(); }
    else alert("❌ Error al publicar.");
    DOM.publishCommentBtn.disabled = false;
}

async function handleReply(btn) {
    const parentId = btn.dataset.parentId;
    const form = btn.closest(".reply-form");
    const name = form.querySelector(".reply-name").value.trim();
    const text = form.querySelector(".reply-text").value.trim();
    if (name.length < 2 || text.length < 2) return alert("Datos insuficientes.");
    btn.disabled = true;
    const { error } = await supabase.from("comentarios").insert([{ name, text, parent_id: parentId, likes_count: 0 }]);
    if (!error) { form.style.display = "none"; await loadComments(); }
    else alert("❌ Error al publicar.");
    btn.disabled = false;
}

// Purgar hilos con >30 días sin actividad
async function purgeStale(all) {
    const LIMIT   = 30 * 24 * 60 * 60 * 1000;
    const now     = Date.now();
    const replies = new Map();
    all.forEach(c => { if (c.parent_id) { if (!replies.has(c.parent_id)) replies.set(c.parent_id, []); replies.get(c.parent_id).push(c); } });

    const toDelete = [];
    all.filter(c => !c.parent_id).forEach(root => {
        const thread    = [root, ...(replies.get(root.id) || [])];
        const lastActive = Math.max(...thread.map(c => new Date(c.timestamp).getTime()));
        if (now - lastActive > LIMIT) toDelete.push(...thread.map(c => c.id));
    });

    if (toDelete.length) {
        await supabase.from("likes").delete().in("comment_id", toDelete);
        await supabase.from("comentarios").delete().in("id", toDelete);
        return all.filter(c => !toDelete.includes(c.id));
    }
    return all;
}

// ============================================================
// ESTADO ECONÓMICO (Status Panel)
// ============================================================
function renderStatus() {
    DOM.statusData.innerHTML = `
        <div class="status-item deficit"><span class="label">🔌 Déficit</span><span class="value">${status.deficit_mw}</span></div>
        <div class="status-item divisa"><span class="label">💵 USD</span><span class="value">${status.dollar_cup}</span></div>
        <div class="status-item divisa"><span class="label">💶 EUR</span><span class="value">${status.euro_cup}</span></div>
        <div class="status-item divisa"><span class="label">💳 MLC</span><span class="value">${status.mlc_cup}</span></div>`;
}

async function loadStatusData() {
    const { data } = await supabase.from("status_data").select("*").eq("id", 1).single();
    if (data) Object.assign(status, data);
    renderStatus();
    fetchRates();
    fetchDeficit();
}

// ─── Tasas de cambio ────────────────────────────────────────
function inRange(val, [min, max]) {
    const n = parseInt(val);
    return !isNaN(n) && n >= min && n <= max;
}

async function fetchViaProxy(url, ms = 12000) {
    const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    ];
    for (const proxy of proxies) {
        try {
            const res = await Promise.race([
                fetch(proxy),
                new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))
            ]);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (text.length < 500) throw new Error("respuesta corta");
            return text;
        } catch (e) { console.warn("Proxy falló:", e.message); }
    }
    throw new Error("Todos los proxies fallaron");
}

async function fetchRates() {
    if (Date.now() - new Date(status.divisa_edited_at || 0).getTime() < CACHE_MS) return;

    let usd = null, eur = null, mlc = null;

    // Fuente 1: El Toque (HTML scraping)
    try {
        const html  = await fetchViaProxy("https://eltoque.com/tasas-de-cambio-cuba");
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        const stats = JSON.parse(match[1])?.props?.pageProps?.trmiExchange?.data?.api?.statistics;
        if (stats) {
            usd = stats.USD?.median != null ? String(Math.round(stats.USD.median)) : null;
            eur = stats.ECU?.avg    != null ? String(Math.round(stats.ECU.avg))    : null;
            mlc = stats.MLC?.median != null ? String(Math.round(stats.MLC.median)) : null;
        }
    } catch {
        // Fuente 2: Yadio (API abierta)
        try {
            const res = await fetch("https://api.yadio.io/exrates/CUP");
            const j   = await res.json();
            usd = j.CUP?.USD ? String(Math.round(1 / j.CUP.USD)) : null;
            eur = j.CUP?.EUR ? String(Math.round(1 / j.CUP.EUR)) : null;
        } catch (e) { console.warn("Yadio también falló:", e.message); }
    }

    if (!inRange(usd, RATE_RANGE.usd)) return;
    const now = new Date().toISOString();
    status.dollar_cup       = usd;
    status.euro_cup         = inRange(eur, RATE_RANGE.eur) ? eur : status.euro_cup;
    status.mlc_cup          = inRange(mlc, RATE_RANGE.mlc) ? mlc : status.mlc_cup;
    status.divisa_edited_at = now;
    renderStatus();
    await supabase.from("status_data").update({
        dollar_cup: status.dollar_cup, euro_cup: status.euro_cup,
        mlc_cup: status.mlc_cup, divisa_edited_at: now
    }).eq("id", 1);
}

// ─── Déficit energético ─────────────────────────────────────
const UNE_KW = ["déficit","deficit","afectación","afectacion","unión eléctrica","une pronostica","une prevé"];

async function fetchDeficit() {
    if (Date.now() - new Date(status.deficit_edited_at || 0).getTime() < CACHE_MS) return;
    try {
        const xml    = await fetchViaProxy("http://www.cubadebate.cu/feed/");
        const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi)]
            .map(m => m[1].trim()).filter(t => t.length > 5).slice(1);

        for (const title of titles) {
            const t = title.toLowerCase();
            if (!UNE_KW.some(k => t.includes(k))) continue;
            const m = title.match(/(\d[\d\s.]{0,6}\d|\d{3,4})\s*mw/i);
            if (!m) continue;
            const mw = parseInt(m[1].replace(/[\s.]/g, ""));
            if (mw < 100 || mw > 5000) continue;

            const now = new Date().toISOString();
            status.deficit_mw       = `${mw} MW`;
            status.deficit_edited_at = now;
            renderStatus();
            await supabase.from("status_data").update({ deficit_mw: status.deficit_mw, deficit_edited_at: now }).eq("id", 1);
            break;
        }
    } catch (e) { console.warn("fetchDeficit:", e.message); }
}

// ============================================================
// VISITAS
// ============================================================
async function registerView() {
    const last = localStorage.getItem(VISIT_KEY);
    if (last && Date.now() - +last < 86400000) return;
    const { error } = await supabase.from("page_views").insert({});
    if (!error) localStorage.setItem(VISIT_KEY, Date.now());
}

async function showViewCount() {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase.from("page_views")
        .select("*", { count: "exact", head: true })
        .gt("created_at", yesterday);
    if (DOM.viewCounter) DOM.viewCounter.textContent = `👀 ${(count || 0).toLocaleString("es-ES")}`;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    DOM.fechaAct.textContent = new Date().toLocaleDateString("es-ES");

    DOM.toggleAdminBtn.addEventListener("click",    toggleAdminMode);
    DOM.saveBtn.addEventListener("click",           saveChanges);
    DOM.addNewsBtn.addEventListener("click",        addNews);
    DOM.deleteNewsBtn.addEventListener("click",     deleteNews);
    DOM.publishCommentBtn.addEventListener("click", publishComment);

    registerView();
    showViewCount();
    loadCards();
    loadNews();
    loadComments();
    loadStatusData();

    setInterval(fetchRates,   CACHE_MS);
    setInterval(fetchDeficit, CACHE_MS);
});
