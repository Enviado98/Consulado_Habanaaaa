// script.js - VERSIÓN FINAL OPTIMIZADA (CON TARJETAS VACÍAS)
// ----------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA";

const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------
// ⚡ CONFIGURACIÓN Y ESTADO
// ----------------------------------------------------
const CACHE_DURATION = 600000; // 10 minutos
const RECENT_THRESHOLD = 86400000; // 24 horas
const OLD_THRESHOLD = 604800000; // 7 días
const SCROLL_SPEED = 50; 

let admin = false;
let currentData = [];
let currentNews = [];
let currentStatus = { deficit_mw: 'Cargando...', dollar_cup: '...', euro_cup: '...', deficit_edited_at: null, divisa_edited_at: null };

const userWebId = localStorage.getItem('userWebId') || (() => {
    const id = crypto.randomUUID();
    localStorage.setItem('userWebId', id);
    return id;
})();

const DOM = {
    body: document.body,
    container: document.getElementById('contenedor'),
    newsTicker: document.getElementById('newsTicker'),
    newsContent: document.getElementById('newsTickerContent'),
    commentsContainer: document.getElementById('commentsContainer'),
    adminPanel: document.getElementById('adminControlsPanel'),
    statusMsg: document.getElementById('statusMessage'),
    toggleAdminBtn: document.getElementById('toggleAdminBtn'),
    statusData: document.getElementById('statusDataContainer'),
    lastEdited: document.getElementById('lastEditedTime'),
    dynamicStyles: document.getElementById('dynamicTickerStyles'),
    inputs: { name: document.getElementById('commenterName'), text: document.getElementById('commentText') },
    btns: { save: document.getElementById('saveBtn'), addNews: document.getElementById('addNewsBtn'), delNews: document.getElementById('deleteNewsBtn'), publish: document.getElementById('publishCommentBtn') }
};

// ----------------------------------------------------
// 🛠️ UTILIDADES
// ----------------------------------------------------
function timeAgo(timestamp) {
    if (!timestamp) return { text: 'Sin fecha', diff: -1 };
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let text = 'hace momentos';
    if (days >= 30) text = `hace ${Math.floor(days / 30)} meses`;
    else if (days >= 7) text = `hace ${Math.floor(days / 7)} sem.`;
    else if (days > 1) text = `hace ${days} días`;
    else if (days === 1) text = 'hace 1 día';
    else if (hours > 0) text = `hace ${hours} h`;
    else if (minutes > 0) text = `hace ${minutes} min`;

    return { text, diff };
}

const linkify = (text) => text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, 
    (url) => `<a href="${url.startsWith('http') ? url : 'http://' + url}" target="_blank">${url}</a>`);

// ----------------------------------------------------
// 💰 API EL TOQUE (CACHÉ)
// ----------------------------------------------------
async function fetchElToqueRates() {
    const lastUpdate = new Date(currentStatus.divisa_edited_at || 0).getTime();
    if (Date.now() - lastUpdate < CACHE_DURATION) return;

    try {
        const proxy = "https://corsproxy.io/?";
        const res = await fetch(proxy + encodeURIComponent(ELTOQUE_API_URL), {
            headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(res.status);
        
        const data = await res.json();
        const usd = parseFloat(data.tasas?.USD || data.USD || 0).toFixed(0);
        const eur = parseFloat(data.tasas?.EUR || data.tasas?.ECU || data.EUR || 0).toFixed(0);

        if (usd > 0 && eur > 0) {
            const newTime = new Date().toISOString();
            currentStatus = { ...currentStatus, dollar_cup: usd, euro_cup: eur, divisa_edited_at: newTime };
            renderStatusPanel();
            await supabase.from('status_data').update({ dollar_cup: usd, euro_cup: eur, divisa_edited_at: newTime }).eq('id', 1);
        }
    } catch (e) { console.error("⚠️ API Error:", e.message); }
}

// ----------------------------------------------------
// 🖥️ RENDERIZADO
// ----------------------------------------------------
function renderStatusPanel() {
    const { text: timeText } = timeAgo(currentStatus.deficit_edited_at);
    let timeHtml = `Última edición:<br> ${timeText}`;
    if (!admin && currentStatus.divisa_edited_at) timeHtml += `<br><small style="color:var(--color-texto-secundario)">Divisas: ${timeAgo(currentStatus.divisa_edited_at).text}</small>`;
    DOM.lastEdited.innerHTML = timeHtml;

    if (admin) {
        DOM.statusData.innerHTML = `
            <div class="status-item"><span class="label">Deficit (MW):</span><input type="text" id="editDeficit" value="${currentStatus.deficit_mw || ''}"></div>
            <div class="status-item"><span class="label">Dollar:</span><input type="text" value="${currentStatus.dollar_cup}" disabled></div>
            <div class="status-item"><span class="label">Euro:</span><input type="text" value="${currentStatus.euro_cup}" disabled></div>`;
    } else {
        DOM.statusData.innerHTML = `
            <div class="status-item deficit"><span class="label">🔌 Déficit:</span><span class="value">${currentStatus.deficit_mw || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💵 USD:</span><span class="value">${currentStatus.dollar_cup || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💶 EUR:</span><span class="value">${currentStatus.euro_cup || '---'}</span></div>`;
    }
}

function createCardHTML(item, index) {
    // Detectar si es tarjeta temporal (Placeholder)
    const isTemp = item.id.toString().startsWith('temp_');
    
    let label = '', panelStyle = 'background: white; color: var(--color-texto-principal);', dateText = 'Actualizado';
    let cardClass = '';

    if (isTemp) {
        panelStyle = 'background: #f0f0f0; color: #888;';
        dateText = 'Nueva Tarjeta';
    } else if (item.last_edited_timestamp) {
        const { text, diff } = timeAgo(item.last_edited_timestamp);
        dateText = text;
        if (diff < RECENT_THRESHOLD) {
            cardClass = 'card-recent';
            label = '<div class="card-label" style="background-color: var(--acento-rojo); color: white; display: block;">!EDITADO RECIENTEMENTE¡</div>';
            panelStyle = `background: var(--tiempo-panel-rojo); color: var(--acento-rojo);`;
        } else if (diff >= OLD_THRESHOLD) {
            cardClass = 'card-old';
            label = '<div class="card-label" style="background-color: var(--acento-cian); color: var(--color-texto-principal); display: block;">Editado hace tiempo</div>';
            panelStyle = `background: var(--tiempo-panel-cian); color: var(--acento-cian);`;
        }
    }

    return `
    <div class="card ${cardClass}" data-index="${index}" data-id="${item.id}" onclick="toggleTimePanel(this)">
        ${label}
        <span class="emoji">${item.emoji}</span>
        <h3>${item.titulo}</h3>
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel" style="${panelStyle}">
            <strong>${isTemp ? 'Espacio Disponible' : 'Actualizado'}</strong> (${dateText})
        </div>
    </div>`;
}

// ----------------------------------------------------
// ⚙️ LÓGICA ADMIN
// ----------------------------------------------------
function toggleAdminMode() {
    if (!admin) {
        admin = true;
        DOM.body.classList.add('admin-mode');
        DOM.adminPanel.style.display = "flex";
        DOM.statusMsg.textContent = "¡🔴 MODO EDICIÓN ACTIVADO!";
        DOM.statusMsg.style.color = "#0d9488";
        DOM.toggleAdminBtn.textContent = "🛑 SALIR DEL MODO EDICIÓN";
        DOM.toggleAdminBtn.style.backgroundColor = "var(--acento-rojo)";
        renderStatusPanel();
        renderAdminCards(true);
    } else {
        if (!confirm("✅️ ¿Guardar o salir? Los cambios no guardados se perderán.")) return;
        admin = false;
        DOM.body.classList.remove('admin-mode');
        DOM.adminPanel.style.display = "none";
        DOM.statusMsg.textContent = "Accede a modo edición para actualizar la información";
        DOM.statusMsg.style.color = "var(--color-texto-principal)";
        DOM.toggleAdminBtn.textContent = "🛡️ ACTIVAR EL MODO EDICIÓN";
        DOM.toggleAdminBtn.style.backgroundColor = "#4f46e5";
        loadData(); 
        loadStatusData();
    }
}

function renderAdminCards(enable) {
    document.querySelectorAll(".card").forEach(card => {
        const index = card.dataset.index;
        const item = currentData[index];
        
        if (enable) {
            card.removeAttribute('onclick');
            card.innerHTML = `
                <input class="editable-emoji" value="${item.emoji}" maxlength="2">
                <input class="editable-title" value="${item.titulo}" placeholder="Título">
                <div class="card-content"><textarea class="editable-content" placeholder="Contenido...">${item.contenido}</textarea></div>`;
        }
    });
}

async function saveChanges() {
    if (!admin) return;
    const editDeficit = document.getElementById('editDeficit');
    const newDeficit = editDeficit ? editDeficit.value : currentStatus.deficit_mw;
    const updates = [];
    const now = new Date().toISOString();

    document.querySelectorAll(".card").forEach(card => {
        const emoji = card.querySelector('.editable-emoji').value.trim();
        const titulo = card.querySelector('.editable-title').value.trim();
        const contenido = card.querySelector('.editable-content').value.trim();
        const id = card.dataset.id;
        const idx = card.dataset.index;
        const original = currentData[idx];

        // Detectar cambios
        if (contenido !== original.contenido || titulo !== original.titulo || emoji !== original.emoji) {
            
            // LÓGICA NUEVA: Si es tarjeta temporal, INSERTAR. Si es real, ACTUALIZAR.
            if (id.startsWith('temp_')) {
                // Solo insertar si no está vacía por defecto
                if (titulo !== 'Espacio Disponible' || contenido !== '...') {
                    updates.push(supabase.from('items').insert([{ emoji, titulo, contenido, last_edited_timestamp: now }]));
                }
            } else {
                updates.push(supabase.from('items').update({ emoji, titulo, contenido, last_edited_timestamp: now }).eq('id', id));
            }
        }
    });

    if (newDeficit !== currentStatus.deficit_mw) {
        updates.push(supabase.from('status_data').update({ deficit_mw: newDeficit, deficit_edited_at: now }).eq('id', 1));
    }

    if (updates.length > 0) {
        await Promise.all(updates);
        alert("✅ Cambios guardados exitosamente.");
        location.reload(); // Recargar para obtener los nuevos IDs reales
    } else {
        alert("No se detectaron cambios.");
    }
}

// ----------------------------------------------------
// 📰 NOTICIAS Y COMENTARIOS
// ----------------------------------------------------
async function loadNews() {
    const { data, error } = await supabase.from('noticias').select('*').order('timestamp', { ascending: false });
    if (error) return;

    const cutoff = Date.now() - RECENT_THRESHOLD;
    const validNews = data.filter(n => new Date(n.timestamp).getTime() > cutoff);
    data.forEach(n => { if (new Date(n.timestamp).getTime() <= cutoff) supabase.from('noticias').delete().eq('id', n.id); });

    currentNews = validNews;
    if (validNews.length > 0) {
        const html = validNews.map(n => `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`).join('<span class="news-item"> | </span>');
        DOM.newsContent.innerHTML = `${html}<span class="news-item"> | </span>${html}`;
        const width = DOM.newsContent.scrollWidth / 2;
        const duration = width / SCROLL_SPEED;
        DOM.dynamicStyles.innerHTML = `@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-${width}px); } }`;
        DOM.newsContent.style.animation = `ticker ${duration}s linear infinite`;
    } else {
        DOM.newsContent.innerHTML = `<span class="news-item">Sin Noticias recientes... || 🛡 Activa el modo edición para publicar</span>`.repeat(2);
        DOM.newsContent.style.animation = `ticker-move-static 15s linear infinite`;
    }
    DOM.newsTicker.style.display = 'flex';
}

async function newsActions(action) {
    if (!admin) return;
    if (action === 'add') {
        const text = prompt("✍️ Noticia:");
        if (text) { await supabase.from('noticias').insert([{ text: text.trim() }]); loadNews(); }
    } else {
        if (currentNews.length === 0) return alert("No hay noticias.");
        const idx = parseInt(prompt(`Eliminar Nº:\n${currentNews.map((n, i) => `${i+1}. ${n.text}`).join('\n')}`)) - 1;
        if (currentNews[idx]) { await supabase.from('noticias').delete().eq('id', currentNews[idx].id); loadNews(); }
    }
}

// ----------------------------------------------------
// 💬 COMENTARIOS
// ----------------------------------------------------
function generateColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${hash % 360}, 70%, 50%)`;
}

function createCommentDOM(c, isLiked) {
    const isReply = !!c.parent_id;
    return `
        <div class="comment-item ${isReply ? 'reply-style' : ''}" data-id="${c.id}" style="--comment-color: ${generateColor(c.name.toLowerCase())};">
            <strong class="comment-name">${c.name} dijo:</strong>
            <div class="comment-content">${c.text}</div>
            <div class="comment-actions">
                <button class="like-button ${isLiked ? 'liked' : ''}" onclick="toggleLike(this, '${c.id}')"><span class="heart">♥</span></button>
                <span class="like-count" id="like-${c.id}">${c.likes_count || 0}</span>
                ${!isReply ? `<span class="reply-form-toggle" onclick="toggleReplyForm('${c.id}')">Responder</span>` : ''}
                <span class="comment-date">${new Date(c.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}h</span>
            </div>
            ${!isReply ? `
                <div class="reply-form" id="reply-form-${c.id}" style="display:none">
                    <input type="text" class="reply-name" placeholder="Nombre">
                    <textarea class="reply-text" placeholder="Respuesta"></textarea>
                    <button onclick="postComment('${c.id}')">Publicar Respuesta</button>
                </div>
                <div class="replies-container" id="replies-${c.id}"></div>` : ''}
        </div>`;
}

async function loadComments() {
    const [resC, resL] = await Promise.all([
        supabase.from('comentarios').select('*').order('timestamp', { ascending: false }),
        supabase.from('likes').select('comment_id').eq('user_web_id', userWebId)
    ]);

    if (resC.error) return DOM.commentsContainer.innerHTML = `<p style="color:var(--acento-rojo)">Error cargando comentarios.</p>`;
    
    const likesMap = new Set(resL.data?.map(l => l.comment_id));
    const parents = resC.data.filter(c => !c.parent_id);
    const replies = resC.data.filter(c => c.parent_id);

    if (parents.length === 0) return DOM.commentsContainer.innerHTML = `<p style="text-align: center; color:#888">Sé el primero en comentar.</p>`;

    DOM.commentsContainer.innerHTML = parents.map(c => createCommentDOM(c, likesMap.has(c.id))).join('');

    replies.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach(r => {
        const container = document.getElementById(`replies-${r.parent_id}`);
        if (container) {
            const div = document.createElement('div');
            div.className = 'reply-item';
            div.innerHTML = createCommentDOM(r, likesMap.has(r.id));
            container.appendChild(div);
        }
    });
    
    parents.forEach(p => {
        const container = document.getElementById(`replies-${p.id}`);
        if (container && container.children.length > 1) {
            const btn = document.createElement('span');
            btn.className = 'reply-toggle';
            btn.textContent = `Ver ${container.children.length - 1} respuestas más...`;
            btn.onclick = (e) => { container.classList.add('expanded'); e.target.style.display='none'; };
            container.appendChild(btn);
        }
    });
}

window.postComment = async (parentId = null) => {
    const nameEl = parentId ? document.querySelector(`#reply-form-${parentId} .reply-name`) : DOM.inputs.name;
    const textEl = parentId ? document.querySelector(`#reply-form-${parentId} .reply-text`) : DOM.inputs.text;
    const name = nameEl.value.trim();
    const text = textEl.value.trim();

    if (name.length < 2 || text.length < 5) return alert("Nombre (2+) y texto (5+) requeridos.");

    const payload = { name, text, likes_count: 0 };
    if (parentId) payload.parent_id = parentId;

    const { error } = await supabase.from('comentarios').insert([payload]);
    if (!error) {
        nameEl.value = ''; textEl.value = '';
        if (parentId) document.getElementById(`reply-form-${parentId}`).style.display = 'none';
        loadComments();
    } else { alert("Error al publicar."); }
};

window.toggleLike = async (btn, id) => {
    if (btn.disabled) return;
    btn.disabled = true;
    const isLiked = btn.classList.contains('liked');
    const countEl = document.getElementById(`like-${id}`);
    
    try {
        if (isLiked) {
            await supabase.from('likes').delete().eq('comment_id', id).eq('user_web_id', userWebId);
            await supabase.rpc('decrement_likes', { row_id: id });
            btn.classList.remove('liked');
            countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
        } else {
            const { error } = await supabase.from('likes').insert([{ comment_id: id, user_web_id: userWebId }]);
            if (!error || error.code === '23505') {
                await supabase.rpc('increment_likes', { row_id: id });
                btn.classList.add('liked');
                countEl.textContent = parseInt(countEl.textContent) + 1;
            }
        }
    } catch (e) {}
    btn.disabled = false;
};

window.toggleReplyForm = (id) => {
    const form = document.getElementById(`reply-form-${id}`);
    document.querySelectorAll('.reply-form').forEach(f => f !== form && (f.style.display = 'none'));
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

window.toggleTimePanel = (card) => {
    if (admin) return;
    const id = card.dataset.id;
    document.querySelectorAll('.card').forEach(c => c.dataset.id !== id && c.classList.remove('show-time-panel'));
    if (card.classList.toggle('show-time-panel')) setTimeout(() => card.classList.remove('show-time-panel'), 2000);
};

// ----------------------------------------------------
// 🚀 CARGA DE DATOS (MODIFICADA)
// ----------------------------------------------------
async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data;
        
        // AGREGAR 2 TARJETAS VACÍAS (PLACEHOLDERS) AL FINAL
        currentData.push({ id: 'temp_1', emoji: '➕', titulo: 'Espacio Disponible', contenido: '...' });
        currentData.push({ id: 'temp_2', emoji: '➕', titulo: 'Espacio Disponible', contenido: '...' });

        DOM.container.innerHTML = currentData.map((item, i) => createCardHTML(item, i)).join('');
    }
}

async function loadStatusData() {
    const { data } = await supabase.from('status_data').select('*').eq('id', 1).single();
    if (data) currentStatus = { ...currentStatus, ...data };
    renderStatusPanel();
    fetchElToqueRates();
}

async function registerView() {
    const key = 'lastPageView';
    if ((Date.now() - (localStorage.getItem(key) || 0)) < 86400000) return;
    if (!(await supabase.from('page_views').insert({})).error) localStorage.setItem(key, Date.now());
}

document.addEventListener('DOMContentLoaded', () => {
    DOM.toggleAdminBtn.onclick = toggleAdminMode;
    DOM.btns.save.onclick = saveChanges;
    DOM.btns.addNews.onclick = () => newsActions('add');
    DOM.btns.delNews.onclick = () => newsActions('del');
    DOM.btns.publish.onclick = () => window.postComment();
    document.getElementById('fecha-actualizacion').textContent = new Date().toLocaleDateString();
    
    registerView();
    
    // Carga paralela
    Promise.all([loadData(), loadNews(), loadComments(), loadStatusData()]);
    
    supabase.from('page_views').select('*', { count: 'exact', head: true })
        .gt('created_at', new Date(Date.now() - 86400000).toISOString())
        .then(({ count }) => document.getElementById('viewCounter').textContent = `👀 ${count || 0} (24h)`);
});
