import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ----------------------------------------------------
// ⚙️ CONFIGURACIÓN Y LLAVES
// ----------------------------------------------------
const SUPABASE_URL = "https://mkvpjsvqjqeuniabjjwr.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rdnBqc3ZxanFldW5pYWJqandyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI0MzU0OCwiZXhwIjoyMDgwODE5NTQ4fQ.No4ZOo0sawF6KYJnIrSD2CVQd1lHzNlLSplQgfuHBcg"; 

const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------
// ⏳ CONSTANTES DE TIEMPO (Configuración de Limpieza)
// ----------------------------------------------------
const ONE_HOUR_MS = 3600 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

// Umbrales para etiquetas visuales ("Nuevo", "Antiguo")
const RECENT_THRESHOLD_MS = ONE_DAY_MS; 
const OLD_THRESHOLD_MS = ONE_WEEK_MS;

// ----------------------------------------------------
// 🎨 PALETA DE COLORES NEÓN
// ----------------------------------------------------
const NEON_PALETTE = ['#fb7185', '#34d399', '#818cf8', '#22d3ee', '#c084fc', '#f472b6', '#facc15'];

function getCardColor(id) {
    let hash = 0; const str = String(id);
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    return NEON_PALETTE[Math.abs(hash) % NEON_PALETTE.length];
}

// ----------------------------------------------------
// 📦 ESTADO GLOBAL
// ----------------------------------------------------
let admin = false;
let currentData = [];
let currentNews = []; 
let currentStatus = {
    deficit_mw: '...', dollar_cup: '...', euro_cup: '...', mlc_cup: '...',
    deficit_edited_at: null, divisa_edited_at: null
}; 

let userWebId = localStorage.getItem('userWebId');
if (!userWebId) {
    userWebId = crypto.randomUUID(); 
    localStorage.setItem('userWebId', userWebId);
}

const DOM = {
    body: document.body,
    contenedor: document.getElementById('contenedor'),
    newsTicker: document.getElementById('newsTicker'),
    newsTickerContent: document.getElementById('newsTickerContent'),
    commentsContainer: document.getElementById('commentsContainer'),
    statusDataContainer: document.getElementById('statusDataContainer'),
    toggleAdminBtn: document.getElementById('toggleAdminBtn'),
    adminPanel: document.getElementById('adminControlsPanel'),
    statusMessage: document.getElementById('statusMessage'),
    dynamicStyles: document.getElementById('dynamicTickerStyles')
};

// ----------------------------------------------------
// 🧹 MANTENIMIENTO AUTOMÁTICO (Background Cleanup)
// ----------------------------------------------------
async function runBackgroundCleanup() {
    console.log("🧹 Ejecutando limpieza de base de datos...");
    
    // Fechas de corte exactas
    const cutoff24h = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const cutoff7d = new Date(Date.now() - ONE_WEEK_MS).toISOString();

    // Ejecutamos borrados en paralelo sin esperar a que terminen (Fire & Forget)
    Promise.all([
        // 1. Borrar noticias de más de 24h
        supabase.from('noticias').delete().lt('timestamp', cutoff24h),
        
        // 2. Borrar comentarios de más de 7 días
        supabase.from('comentarios').delete().lt('timestamp', cutoff7d),
        
        // 3. Borrar Vistas de página de más de 24h
        supabase.from('page_views').delete().lt('created_at', cutoff24h)
    ]).then(() => console.log("✨ Limpieza completada."))
      .catch(err => console.warn("⚠️ Error en limpieza (posible falta de permisos DELETE):", err));
}

// ----------------------------------------------------
// 🕒 UTILIDADES
// ----------------------------------------------------
function timeAgo(timestamp) {
    if (!timestamp) return { text: 'Sin fecha', diff: -1 };
    const diff = Date.now() - new Date(timestamp).getTime();
    const min = Math.floor(diff / 60000);
    const hours = Math.floor(min / 60);
    const days = Math.floor(hours / 24);

    let text;
    if (min < 1) text = 'Ahora mismo';
    else if (min < 60) text = `Hace ${min} min`;
    else if (hours < 24) text = `Hace ${hours} h`;
    else text = `Hace ${days} días`;

    return { text, diff };
}

function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        const fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

// ----------------------------------------------------
// 💵 API ELTOQUE
// ----------------------------------------------------
async function fetchElToqueRates() {
    try {
        const lastUpdate = new Date(currentStatus.divisa_edited_at || 0).getTime();
        // Caché de 10 min
        if ((Date.now() - lastUpdate) < (10 * 60000)) return; 

        const response = await fetch("https://corsproxy.io/?" + encodeURIComponent(ELTOQUE_API_URL), {
            headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}` }
        });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        
        const tas = data.tasas || data;
        if (tas && tas.USD) {
            const now = new Date().toISOString();
            currentStatus.dollar_cup = parseFloat(tas.USD).toFixed(0);
            currentStatus.euro_cup = parseFloat(tas.EUR || tas.ECU).toFixed(0);
            currentStatus.mlc_cup = parseFloat(tas.MLC).toFixed(0);
            currentStatus.divisa_edited_at = now;
            renderStatusPanel();
            
            // Actualizamos DB
            supabase.from('status_data').update({ 
                dollar_cup: currentStatus.dollar_cup, 
                euro_cup: currentStatus.euro_cup, 
                mlc_cup: currentStatus.mlc_cup, 
                divisa_edited_at: now 
            }).eq('id', 1);
        }
    } catch (e) { console.warn("ElToque API Skip"); }
}

// ----------------------------------------------------
// 🖥️ UI & RENDER
// ----------------------------------------------------
function renderStatusPanel() {
    if (admin) {
        DOM.statusDataContainer.innerHTML = `
            <div class="status-item"><span class="label">Déficit MW</span><input type="text" id="editDeficit" value="${currentStatus.deficit_mw || ''}" style="width:60px; text-align:center"></div>
            <div class="status-item"><span class="label">USD</span><span class="value">${currentStatus.dollar_cup}</span></div>
            <div class="status-item"><span class="label">EUR</span><span class="value">${currentStatus.euro_cup}</span></div>
            <div class="status-item"><span class="label">MLC</span><span class="value">${currentStatus.mlc_cup}</span></div>
        `;
    } else {
        DOM.statusDataContainer.innerHTML = `
            <div class="status-item deficit"><span class="label">🔌 Déficit MW</span><span class="value">${currentStatus.deficit_mw || '0'}</span></div>
            <div class="status-item divisa"><span class="label">💵 USD</span><span class="value">${currentStatus.dollar_cup}</span></div>
            <div class="status-item divisa"><span class="label">💶 EUR</span><span class="value">${currentStatus.euro_cup}</span></div>
            <div class="status-item divisa"><span class="label">💳 MLC</span><span class="value">${currentStatus.mlc_cup}</span></div>
        `;
    }
}

function createCardHTML(item, index) {
    let label = '', time = timeAgo(item.last_edited_timestamp);
    let cls = '';
    
    if (item.last_edited_timestamp) {
        if (time.diff >= 0 && time.diff < RECENT_THRESHOLD_MS) {
            cls = 'card-recent'; label = '<div class="card-label">¡NUEVO!</div>';
        } else if (time.diff >= OLD_THRESHOLD_MS) {
            cls = 'card-old'; label = '<div class="card-label">ANTIGUO</div>';
        }
    }

    return `
    <div class="card ${cls}" data-index="${index}" data-id="${item.id}">
        ${label}
        <span class="emoji">${item.emoji}</span>
        <h3 style="--card-neon: ${getCardColor(item.id)}">${item.titulo}</h3>
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel">Actualizado: ${time.text}</div>
    </div>`;
}

function renderCards() {
    DOM.contenedor.innerHTML = currentData.map((item, i) => createCardHTML(item, i)).join('');
    document.querySelectorAll('.card').forEach(c => {
        if (!admin) c.addEventListener('click', () => c.classList.toggle('show-time-panel'));
    });
}

// ----------------------------------------------------
// 🛡️ ADMIN
// ----------------------------------------------------
function toggleAdminMode() {
    if (!admin) {
        if (!prompt("🔐 Contraseña:") === null) return;
        admin = true;
        DOM.body.classList.add('admin-mode');
        DOM.adminPanel.style.display = 'flex';
        DOM.toggleAdminBtn.textContent = '🛑 SALIR';
        DOM.toggleAdminBtn.classList.replace('btn-primary', 'btn-danger');
        DOM.statusMessage.textContent = '⚠️ MODO EDICIÓN';
        DOM.statusMessage.style.color = 'var(--acento-rojo)';
        enableCardEditing();
        renderStatusPanel();
    } else {
        if (!confirm("¿Salir?")) return;
        admin = false;
        DOM.body.classList.remove('admin-mode');
        DOM.adminPanel.style.display = 'none';
        DOM.toggleAdminBtn.textContent = '🛡️ ACTIVAR EDICIÓN';
        DOM.toggleAdminBtn.classList.replace('btn-danger', 'btn-primary');
        DOM.statusMessage.textContent = 'Activa modo edición';
        DOM.statusMessage.style.color = 'var(--color-texto-secundario)';
        renderCards();
        renderStatusPanel();
    }
}

function enableCardEditing() {
    document.querySelectorAll(".card").forEach(card => {
        const item = currentData[card.dataset.index];
        const contentDiv = card.querySelector('.card-content');
        card.querySelector('.card-time-panel').style.display = 'none';
        card.querySelector('h3').remove(); card.querySelector('.emoji').remove(); contentDiv.innerHTML = '';

        const emoji = document.createElement('input'); emoji.className = 'editable-emoji'; emoji.value = item.emoji;
        const title = document.createElement('input'); title.className = 'editable-title'; title.value = item.titulo;
        const text = document.createElement('textarea'); text.className = 'editable-content'; text.value = item.contenido;

        card.prepend(title); card.prepend(emoji); contentDiv.appendChild(text);
    });
}

async function saveAllChanges() {
    if (!admin) return;
    const updates = [];
    document.querySelectorAll(".card").forEach(card => {
        const id = card.dataset.id, idx = card.dataset.index;
        const e = card.querySelector('.editable-emoji').value, t = card.querySelector('.editable-title').value, c = card.querySelector('.editable-content').value;
        
        if (c !== currentData[idx].contenido || t !== currentData[idx].titulo || e !== currentData[idx].emoji) {
            updates.push(supabase.from('items').update({ emoji: e, titulo: t, contenido: c, last_edited_timestamp: new Date().toISOString() }).eq('id', id));
        }
    });

    const def = document.getElementById('editDeficit');
    if (def && def.value !== currentStatus.deficit_mw) {
        updates.push(supabase.from('status_data').update({ deficit_mw: def.value, deficit_edited_at: new Date().toISOString() }).eq('id', 1));
    }

    if (updates.length) {
        document.getElementById('saveBtn').textContent = 'Guardando...';
        await Promise.all(updates);
        alert("✅ Guardado"); location.reload();
    } else alert("Sin cambios");
}

// ----------------------------------------------------
// 🗞️ NOTICIAS (Últimas 24h)
// ----------------------------------------------------
async function loadNews() {
    // Calculamos corte de hace 24 horas
    const cutoffDate = new Date(Date.now() - ONE_DAY_MS).toISOString();

    // 1. SOLICITAR SOLO NOTICIAS RECIENTES (> hace 24h)
    const { data } = await supabase
        .from('noticias')
        .select('*')
        .gt('timestamp', cutoffDate) 
        .order('timestamp', { ascending: false });
    
    if (!data || data.length === 0) {
        DOM.newsTicker.style.display = 'none';
        return;
    }

    currentNews = data;
    const newsHTML = data.map(n => 
        `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`
    ).join('<span class="news-item"> | </span>');

    DOM.newsTickerContent.innerHTML = newsHTML + '<span class="news-item"> | </span>' + newsHTML;
    DOM.newsTicker.style.display = 'flex';

    // Animación corregida
    requestAnimationFrame(() => {
        const fullWidth = DOM.newsTickerContent.scrollWidth;
        const halfWidth = fullWidth / 2;
        const duration = halfWidth / 50; 
        DOM.dynamicStyles.innerHTML = `
            @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-${halfWidth}px); } }
            .news-ticker-content { animation: ticker ${duration}s linear infinite; padding-left: 0 !important; display: inline-block; }
        `;
    });
}

// ----------------------------------------------------
// 💬 COMENTARIOS (Últimos 7 días)
// ----------------------------------------------------
function createCommentDOM(comment, userLikesMap) {
    const isLiked = userLikesMap.has(comment.id);
    const initial = comment.name.charAt(0).toUpperCase();
    
    // Generador de color de avatar basado en el nombre
    let hash = 0; for (let i = 0; i < comment.name.length; i++) hash = comment.name.charCodeAt(i) + ((hash << 5) - hash);
    const color = `hsl(${Math.abs(hash) % 360}, 60%, 50%)`;

    return `
    <div class="comment-item ${comment.parent_id ? 'reply' : ''}" data-id="${comment.id}">
        <div class="comment-main-row">
            <div class="comment-avatar" style="background:${color}">${initial}</div>
            <div class="comment-bubble">
                <div class="comment-header">
                    <span class="comment-name">${comment.name}</span>
                    <span class="comment-date">${timeAgo(comment.timestamp).text}</span>
                </div>
                <div class="comment-content">${comment.text}</div>
                <div class="comment-actions">
                    <button class="like-button ${isLiked ? 'liked' : ''}" onclick="toggleLike('${comment.id}')">
                        <span>♥</span> <span id="likes-${comment.id}">${comment.likes_count || 0}</span>
                    </button>
                    ${!comment.parent_id ? `<span class="reply-form-toggle" onclick="showReplyForm('${comment.id}')">Responder</span>` : ''}
                </div>
            </div>
        </div>
        ${!comment.parent_id ? `<div id="reply-box-${comment.id}" class="replies-container"></div>
            <div id="reply-form-${comment.id}" class="reply-form" style="display:none; margin-top:10px;">
                <input type="text" id="reply-name-${comment.id}" placeholder="Nombre">
                <textarea id="reply-text-${comment.id}" placeholder="Respuesta..."></textarea>
                <button class="btn btn-sm btn-success" onclick="postReply('${comment.id}')">Enviar</button>
            </div>` : ''}
    </div>`;
}

async function loadComments() {
    // Corte de hace 7 días
    const cutoffDate = new Date(Date.now() - ONE_WEEK_MS).toISOString();

    // Pedir solo comentarios recientes
    const { data: comments } = await supabase
        .from('comentarios')
        .select('*')
        .gt('timestamp', cutoffDate)
        .order('timestamp', { ascending: false });

    const { data: likes } = await supabase.from('likes').select('comment_id').eq('user_web_id', userWebId);
    const userLikesMap = new Set(likes?.map(l => l.comment_id));
    
    if (comments) {
        DOM.commentsContainer.innerHTML = '';
        const parents = comments.filter(c => !c.parent_id);
        const replies = comments.filter(c => c.parent_id).reverse();

        if(parents.length === 0) DOM.commentsContainer.innerHTML = '<p style="text-align:center; opacity:0.5">Sé el primero en comentar esta semana.</p>';

        parents.forEach(p => {
            DOM.commentsContainer.innerHTML += createCommentDOM(p, userLikesMap);
            setTimeout(() => {
                const box = document.getElementById(`reply-box-${p.id}`);
                const pReplies = replies.filter(r => r.parent_id === p.id);
                if(box && pReplies.length) pReplies.forEach(r => box.innerHTML += createCommentDOM(r, userLikesMap));
            }, 0);
        });
    }
}

// Funciones Globales (Comentarios)
window.toggleLike = async (id) => {
    const btn = document.querySelector(`button[onclick="toggleLike('${id}')"]`);
    const counter = document.getElementById(`likes-${id}`);
    const isLiked = btn.classList.contains('liked');
    
    btn.classList.toggle('liked');
    counter.textContent = isLiked ? parseInt(counter.textContent) - 1 : parseInt(counter.textContent) + 1;

    if (isLiked) {
        await supabase.from('likes').delete().eq('comment_id', id).eq('user_web_id', userWebId);
        await supabase.rpc('decrement_likes', { row_id: id });
    } else {
        await supabase.from('likes').insert([{ comment_id: id, user_web_id: userWebId }]);
        await supabase.rpc('increment_likes', { row_id: id });
    }
};

window.showReplyForm = (id) => { const f = document.getElementById(`reply-form-${id}`); f.style.display = f.style.display === 'none' ? 'block' : 'none'; };
window.postReply = async (pId) => {
    const n = document.getElementById(`reply-name-${pId}`).value, t = document.getElementById(`reply-text-${pId}`).value;
    if(n && t) { await supabase.from('comentarios').insert([{ name: n, text: t, parent_id: pId }]); loadComments(); }
};

document.getElementById('publishCommentBtn').addEventListener('click', async () => {
    const n = document.getElementById('commenterName').value, t = document.getElementById('commentText').value;
    if(n && t) { await supabase.from('comentarios').insert([{ name: n, text: t }]); document.getElementById('commentText').value=''; loadComments(); }
});

// Admin News
document.getElementById('addNewsBtn').addEventListener('click', async () => {
    const t = prompt("Noticia:"); if(t) { await supabase.from('noticias').insert([{ text: t }]); loadNews(); }
});
document.getElementById('deleteNewsBtn').addEventListener('click', async () => {
    if(!currentNews.length) return alert("Nada que borrar");
    const idx = prompt(`Borrar #:\n${currentNews.map((n,i)=>`${i+1}. ${n.text}`).join('\n')}`);
    if(idx && currentNews[idx-1]) { await supabase.from('noticias').delete().eq('id', currentNews[idx-1].id); loadNews(); }
});

// ----------------------------------------------------
// 🚀 INICIALIZACIÓN
// ----------------------------------------------------
async function init() {
    // 1. Cargar Tarjetas
    const { data } = await supabase.from('items').select('*').order('id');
    if(data) { currentData = data; renderCards(); }

    // 2. Cargar Status
    const { data: st } = await supabase.from('status_data').select('*').eq('id', 1).single();
    if(st) { currentStatus = {...currentStatus, ...st}; renderStatusPanel(); fetchElToqueRates(); }

    // 3. Cargar Dinámicos (Filtrados)
    loadNews();
    loadComments();

    // 4. Contador de Visitas (Solo últimas 24h)
    const todayKey = 'visit_' + new Date().toDateString();
    const cutoff24h = new Date(Date.now() - ONE_DAY_MS).toISOString();

    if (!localStorage.getItem(todayKey)) {
        await supabase.from('page_views').insert({});
        localStorage.setItem(todayKey, 'true');
    }
    
    // Contar solo las de las últimas 24h
    const { count } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', cutoff24h);
        
    document.getElementById('viewCounter').textContent = `👀 24h: ${count ? count.toLocaleString() : '...'}`;
    document.getElementById('fecha-actualizacion').textContent = new Date().toLocaleDateString();

    // Listeners
    DOM.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    document.getElementById('saveBtn').addEventListener('click', saveAllChanges);

    // 5. EJECUTAR LIMPIEZA SILENCIOSA
    // Esto intentará borrar los datos viejos en segundo plano
    runBackgroundCleanup();
}

init();
