// ----------------------------------------------------
// 🚨 CONFIGURACIÓN DE SUPABASE (BAAS) 🚨
// ----------------------------------------------------
const SUPABASE_URL = "https://mkvpjsvqjqeuniabjjwr.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rdnBqc3ZxanFldW5pYWJqandyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI0MzU0OCwiZXhwIjoyMDgwODE5NTQ4fQ.No4ZOo0sawF6KYJnIrSD2CVQd1lHzNlLSplQgfuHBcg"; 


import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------
// 🎨 PALETA DE COLORES NEÓN (PREMIUM)
// ----------------------------------------------------
const NEON_PALETTE = [
    '#00ffff', '#ff00ff', '#00ff00', '#ffff00', '#ff0099', 
    '#9D00FF', '#FF4D00', '#00E5FF', '#76ff03', '#ff1744'
];

function getCardColor(id) {
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    const index = Math.abs(hash) % NEON_PALETTE.length;
    return NEON_PALETTE[index];
}

// Variables Globales
let admin = false; 
const ONE_HOUR = 3600000;
const ONE_DAY = 24 * ONE_HOUR;
const RECENT_THRESHOLD_MS = ONE_DAY; 
const OLD_THRESHOLD_MS = 7 * ONE_DAY;
const NEWS_SCROLL_SPEED_PX_PER_SEC = 50; 
const TIME_PANEL_AUTOHIDE_MS = 3000; 

let currentData = [];
let currentNews = []; 


let userWebId = localStorage.getItem('userWebId');
if (!userWebId) {
    userWebId = crypto.randomUUID(); 
    localStorage.setItem('userWebId', userWebId);
}

// Elementos del DOM
const DOMElements = {
    body: document.body,
    contenedor: document.getElementById('contenedor'),
    newsTicker: document.getElementById('newsTicker'),
    newsTickerContent: document.getElementById('newsTickerContent'),
    commentsContainer: document.getElementById('commentsContainer'),
    commenterName: document.getElementById('commenterName'),
    commentText: document.getElementById('commentText'),
    publishCommentBtn: document.getElementById('publishCommentBtn'),
    adminControlsPanel: document.getElementById('adminControlsPanel'),
    statusMessage: document.getElementById('statusMessage'),
    toggleAdminBtn: document.getElementById('toggleAdminBtn'), 
    saveBtn: document.getElementById('saveBtn'),
    addNewsBtn: document.getElementById('addNewsBtn'),
    deleteNewsBtn: document.getElementById('deleteNewsBtn'),
    dynamicTickerStyles: document.getElementById('dynamicTickerStyles')
};

function timeAgo(timestamp) {
    if (!timestamp) return { text: 'Sin fecha de edición.', diff: -1, date: null };
    const then = new Date(timestamp).getTime();
    const now = Date.now();
    const diff = now - then;
    if (diff < 0) return { text: 'Ahora mismo', diff: 0, date: new Date(timestamp) }; 
    const SECONDS = Math.floor(diff / 1000);
    const MINUTES = Math.floor(SECONDS / 60);
    const HOURS = Math.floor(MINUTES / 60);
    const DAYS = Math.floor(HOURS / 24);
    let text;
    if (DAYS >= 30) { text = `hace ${Math.floor(DAYS / 30)} meses`; } 
    else if (DAYS >= 7) { const weeks = Math.floor(DAYS / 7); text = `hace ${weeks} sem.`; } 
    else if (DAYS >= 2) { text = `hace ${DAYS} días`; } 
    else if (DAYS === 1) { text = 'hace 1 día'; } 
    else if (HOURS >= 2) { text = `hace ${HOURS} h.`; } 
    else if (HOURS === 1) { text = 'hace 1 hora'; } 
    else if (MINUTES >= 1) { text = `hace ${MINUTES} min.`; } 
    else { text = 'hace unos momentos'; }
    return { text, diff, date: new Date(timestamp) };
}

// ----------------------------------------------------
// UI & ADMIN
// ----------------------------------------------------
function updateAdminUI(isAdmin) {
    admin = isAdmin;
    if (isAdmin) {
        DOMElements.body.classList.add('admin-mode');
        DOMElements.adminControlsPanel.style.display = "flex";
        DOMElements.statusMessage.textContent = "¡🔴 EDITA CON RESPONSABILIDAD!";
        DOMElements.statusMessage.style.color = "#ef233c"; 
        DOMElements.toggleAdminBtn.textContent = "🛑 SALIR MODO EDICIÓN"; 
        DOMElements.toggleAdminBtn.classList.remove('btn-primary');
        DOMElements.toggleAdminBtn.classList.add('btn-danger');
        enableEditing(); 
    } else {
        DOMElements.body.classList.remove('admin-mode');
        DOMElements.adminControlsPanel.style.display = "none";
        DOMElements.statusMessage.textContent = "Activa modo edición y actualiza la información"; 
        DOMElements.statusMessage.style.color = "var(--color-texto-principal)"; 
        DOMElements.toggleAdminBtn.textContent = "🛡️ ACTIVAR EL MODO EDICIÓN"; 
        DOMElements.toggleAdminBtn.classList.remove('btn-danger');
        DOMElements.toggleAdminBtn.classList.add('btn-primary');
        disableEditing(); 
    }
    renderData(currentData, isAdmin);
}

function toggleAdminMode() {
    if (!admin) {
        updateAdminUI(true); alert("¡🔴 EDITA CON RESPONSABILIDAD!");
    } else {
        if (!confirm("✅️ ¿Terminar la edición?")) return;
        updateAdminUI(false); loadData(); 
    }
}

function enableEditing() { toggleEditing(true); }
function disableEditing() { toggleEditing(false); }

function createCardHTML(item, index) {
    let cardClass = '', labelHTML = '', labelText = 'Sin fecha', timeText = 'Sin editar';
    if (item.last_edited_timestamp) {
        const { text, diff } = timeAgo(item.last_edited_timestamp);
        timeText = text;
        if (diff >= 0 && diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent'; labelHTML = '<div class="card-label">!RECIENTE!</div>'; labelText = 'Reciente';        
        } else { labelText = 'Actualizado'; }
    }
    const neonColor = getCardColor(item.id);
    return `
    <div class="card ${cardClass}" data-index="${index}" data-id="${item.id}"> 
        ${labelHTML} <span class="emoji">${item.emoji}</span>
        <h3 style="--card-neon: ${neonColor}">${item.titulo}</h3>
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel" data-id="${item.id}"><strong>${labelText}</strong> (${timeText})</div>
    </div>`;
}

function toggleEditing(enable) {
    document.querySelectorAll(".card").forEach(card => {
        const item = currentData[card.getAttribute('data-index')];
        const contentDiv = card.querySelector('.card-content');
        if (enable) {
            card.classList.add('editing-active'); card.removeEventListener('click', toggleTimePanel); 
            card.querySelector('.card-time-panel').style.display = 'none';
            if (card.querySelector('.card-label')) card.querySelector('.card-label').style.display = 'none';
            card.querySelector('.emoji').remove(); card.querySelector('h3').remove(); contentDiv.querySelector('p').remove();
            
            const editableEmoji = document.createElement('input'); editableEmoji.className = 'editable-emoji'; editableEmoji.value = item.emoji; editableEmoji.maxLength = 2;
            const editableTitle = document.createElement('input'); editableTitle.className = 'editable-title'; editableTitle.value = item.titulo;
            const editableContent = document.createElement('textarea'); editableContent.className = 'editable-content'; editableContent.value = item.contenido;
            
            card.insertBefore(editableTitle, card.firstChild); card.insertBefore(editableEmoji, card.firstChild); contentDiv.appendChild(editableContent);
        } else {
            card.classList.remove('editing-active');
            if (card.querySelector('.editable-emoji')) {
                card.querySelector('.editable-emoji').remove(); card.querySelector('.editable-title').remove(); card.querySelector('.editable-content').remove();
                const newEmoji = document.createElement('span'); newEmoji.className = 'emoji'; newEmoji.textContent = item.emoji;
                const newTitle = document.createElement('h3'); newTitle.textContent = item.titulo; newTitle.style.setProperty('--card-neon', getCardColor(item.id));
                const newP = document.createElement('p'); newP.textContent = item.contenido;
                
                card.insertBefore(newTitle, card.firstChild); card.insertBefore(newEmoji, card.firstChild); contentDiv.appendChild(newP);
                card.querySelector('.card-time-panel').style.display = '';
                if (card.querySelector('.card-label')) card.querySelector('.card-label').style.display = '';
                card.addEventListener('click', toggleTimePanel);
            }
        }
    });
}

function toggleTimePanel(event) {
    if (admin) return;
    const clicked = event.currentTarget;
    document.querySelectorAll('.card').forEach(c => { if (c !== clicked) c.classList.remove('show-time-panel'); });
    if (clicked.classList.toggle('show-time-panel')) setTimeout(() => clicked.classList.remove('show-time-panel'), TIME_PANEL_AUTOHIDE_MS);
}

function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

async function loadNews() {
    const { data: newsData, error } = await supabase.from('noticias').select('id, text, timestamp').order('timestamp', { ascending: false });
    if (error) return;
    const validNews = []; const cutoff = Date.now() - RECENT_THRESHOLD_MS;
    newsData.forEach(n => { if (new Date(n.timestamp).getTime() > cutoff) validNews.push(n); else supabase.from('noticias').delete().eq('id', n.id); });
    currentNews = validNews;
    if (validNews.length > 0) {
        const html = validNews.map(n => `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`).join('<span class="news-item"> | </span>');
        DOMElements.newsTickerContent.innerHTML = `${html}<span class="news-item"> | </span>${html}`;
        DOMElements.newsTicker.style.display = 'flex';
        const width = DOMElements.newsTickerContent.scrollWidth / 2; const dur = width / NEWS_SCROLL_SPEED_PX_PER_SEC;
        DOMElements.dynamicTickerStyles.innerHTML = `@keyframes ticker-move-dynamic { 0% { transform: translateX(0); } 100% { transform: translateX(-${width}px); } }`;
        DOMElements.newsTickerContent.style.animation = `ticker-move-dynamic ${dur}s linear infinite`;
    } else {
        DOMElements.newsTicker.style.display = 'flex';
        DOMElements.newsTickerContent.innerHTML = `<span class="news-item">Sin Noticias recientes... || 🛡 Activa el modo edición para publicar</span>`.repeat(2);
        DOMElements.newsTickerContent.style.animation = `ticker-move-static 15s linear infinite`;
    }
}

async function addQuickNews() {
    if (!admin) return;
    const text = prompt("✍️ Escribe tu noticia:");
    if (text && confirm("¿Publicar?")) { await supabase.from('noticias').insert([{ text: text.trim() }]); loadNews(); }
}
async function deleteNews() {
    if (!admin || currentNews.length === 0) return alert("No hay noticias.");
    const list = currentNews.map((n, i) => `${i + 1}. ${n.text}`).join('\n');
    const idx = parseInt(prompt(`Eliminar número:\n${list}`)) - 1;
    if (currentNews[idx] && confirm("¿Eliminar?")) { await supabase.from('noticias').delete().eq('id', currentNews[idx].id); loadNews(); }
}

// ----------------------------------------------------
// LÓGICA DE COMENTARIOS (CORREGIDA: Layout Bloque)
// ----------------------------------------------------
function generateColorByName(str) {
    let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 75%, 55%)`; 
}
function formatCommentDate(timestamp) {
    const date = new Date(timestamp), now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Hoy, ' + date.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
    return date.toLocaleDateString('es-ES', {day:'2-digit', month:'short'}) + ' ' + date.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
}

function createCommentHTML(comment, isLiked) {
    const color = generateColorByName(comment.name.toLowerCase());
    const likeClass = isLiked ? 'liked' : '';
    const itemClass = comment.parent_id ? 'comment-item reply-style' : 'comment-item';
    const initial = comment.name ? comment.name.charAt(0).toUpperCase() : '?';

    // ESTRUCTURA CORREGIDA: Row Visual + Contenedor Hijos
    return `
        <div class="${itemClass}" data-comment-id="${comment.id}">
            <div class="comment-main-row">
                <div class="comment-avatar" style="background-color: ${color};" title="${comment.name}">
                    ${initial}
                </div>

                <div class="comment-bubble">
                    <div class="comment-header">
                        <span class="comment-name">${comment.name}</span>
                        <span class="comment-date">${formatCommentDate(comment.timestamp)}</span>
                    </div>
                    
                    <div class="comment-content">${comment.text}</div>
                    
                    <div class="comment-actions">
                        <button class="like-button ${likeClass}" data-id="${comment.id}" title="Me gusta">
                            <span class="heart">♥</span>
                            <span class="like-count" data-counter-id="${comment.id}">${comment.likes_count || 0}</span>
                        </button>
                        ${!comment.parent_id ? `<span class="reply-form-toggle" data-id="${comment.id}">Responder</span>` : ''}
                    </div>
                </div>
            </div>

            ${!comment.parent_id ? `
                <div class="reply-form" data-reply-to="${comment.id}">
                    <input type="text" class="reply-name" placeholder="Tu Nombre" required maxlength="30">
                    <textarea class="reply-text" placeholder="Responder..." required maxlength="250"></textarea>
                    <div style="text-align: right;">
                        <button class="btn btn-sm btn-success publish-reply-btn" data-parent-id="${comment.id}">Enviar</button>
                    </div>
                </div>
                <div class="replies-container" data-parent-of="${comment.id}"></div>
            ` : ''}
        </div>`;
}

function drawReplies(container, replies, userLikesMap) {
    container.innerHTML = ''; 
    replies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); 
    replies.forEach((reply) => {
        const isLiked = userLikesMap.get(reply.id) || false;
        container.insertAdjacentHTML('beforeend', createCommentHTML(reply, isLiked));
    });
}

async function loadComments() {
    const [commentsResponse, likesResponse] = await Promise.all([
        supabase.from('comentarios').select('*').order('timestamp', { ascending: false }),
        supabase.from('likes').select('comment_id').eq('user_web_id', userWebId)
    ]);

    if (commentsResponse.error) return DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: #d90429;">❌ Error al cargar comentarios.</p>`;
    
    const allComments = commentsResponse.data;
    const userLikesMap = new Map();
    if (likesResponse.data) likesResponse.data.forEach(like => userLikesMap.set(like.comment_id, true));
    
    const principalComments = allComments.filter(c => c.parent_id === null);
    const repliesMap = allComments.reduce((map, comment) => {
        if (comment.parent_id !== null) { 
            if (!map.has(comment.parent_id)) map.set(comment.parent_id, []); 
            map.get(comment.parent_id).push(comment); 
        }
        return map;
    }, new Map());
    
    if (principalComments.length === 0) return DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: #fff; opacity: 0.8;">Sé el primero en comentar 👇</p>`;
    
    DOMElements.commentsContainer.innerHTML = principalComments.map(c => createCommentHTML(c, userLikesMap.get(c.id))).join('');

    principalComments.forEach(comment => {
        const replies = repliesMap.get(comment.id);
        if (replies) { 
            // Ahora buscamos dentro del nuevo layout
            const cardElement = document.querySelector(`.comment-item[data-comment-id="${comment.id}"]`);
            if (cardElement) {
                const container = cardElement.querySelector(`.replies-container`);
                if (container) drawReplies(container, replies, userLikesMap); 
            }
        }
    });

    document.querySelectorAll('.reply-form-toggle').forEach(btn => btn.addEventListener('click', toggleReplyForm));
    document.querySelectorAll('.publish-reply-btn').forEach(btn => btn.addEventListener('click', handlePublishReply));
    document.querySelectorAll('.like-button').forEach(btn => btn.addEventListener('click', handleLikeToggle));
}

function toggleReplyForm(event) {
    const commentId = event.target.getAttribute('data-id');
    const item = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
    const form = item.querySelector(`.reply-form`);
    if (form) {
        document.querySelectorAll('.reply-form').forEach(f => { if (f !== form) f.style.display = 'none'; });
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        if (form.style.display === 'block') form.querySelector('.reply-name').focus();
    }
}

async function publishComment() {
    const name = DOMElements.commenterName.value.trim(); const text = DOMElements.commentText.value.trim();
    if (name.length < 2 || text.length < 2) return alert("Datos insuficientes.");
    DOMElements.publishCommentBtn.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, likes_count: 0 }]);
    if (!error) { DOMElements.commenterName.value = ''; DOMElements.commentText.value = ''; await loadComments(); } else { alert("❌ Error."); }
    DOMElements.publishCommentBtn.disabled = false;
}

async function handlePublishReply(event) {
    const parentId = event.target.getAttribute('data-parent-id'); const form = event.target.closest('.reply-form');
    const name = form.querySelector('.reply-name').value.trim(); const text = form.querySelector('.reply-text').value.trim();
    if (name.length < 2 || text.length < 2) return alert("Datos insuficientes.");
    event.target.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, parent_id: parentId, likes_count: 0 }]);
    if (!error) { form.style.display = 'none'; await loadComments(); } else { alert("❌ Error."); }
    event.target.disabled = false;
}

async function handleLikeToggle(event) {
    const btn = event.currentTarget; const id = btn.getAttribute('data-id'); const isLiked = btn.classList.contains('liked'); const counter = btn.querySelector('.like-count');
    btn.disabled = true;
    try {
        if (isLiked) {
            await supabase.from('likes').delete().eq('comment_id', id).eq('user_web_id', userWebId); await supabase.rpc('decrement_likes', { row_id: id });
            btn.classList.remove('liked'); counter.textContent = Math.max(0, parseInt(counter.textContent) - 1);
        } else {
            const { error } = await supabase.from('likes').insert([{ comment_id: id, user_web_id: userWebId }]);
            if (!error || error.code === '23505') { if (!error) await supabase.rpc('increment_likes', { row_id: id }); btn.classList.add('liked'); counter.textContent = parseInt(counter.textContent) + 1; }
        }
    } catch (e) { console.error(e); }
    btn.disabled = false;
}

// ----------------------------------------------------
// VISTAS & ESTADO
// ----------------------------------------------------
const VISIT_KEY = 'lastPageView';
async function registerPageView() {
    const last = localStorage.getItem(VISIT_KEY);
    if (last && (Date.now() - parseInt(last)) < 24 * 60 * 60 * 1000) return;
    const { error } = await supabase.from('page_views').insert({});
    if (!error) localStorage.setItem(VISIT_KEY, Date.now());
}
async function getAndDisplayViewCount() {
    const el = document.getElementById('viewCounter'); if (!el) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const { count } = await supabase.from('page_views').select('*', { count: 'exact', head: true }).gt('created_at', yesterday.toISOString());
    el.textContent = `👀 ${count ? count.toLocaleString('es-ES') : '0'} `;
}
async function saveChanges() {
    if (!admin) return;
    const updates = [];
    document.querySelectorAll(".card").forEach(card => {
        const emoji = card.querySelector('.editable-emoji').value;
        const titulo = card.querySelector('.editable-title').value;
        const contenido = card.querySelector('.editable-content').value;
        const id = card.dataset.id; const idx = card.dataset.index;
        if (contenido !== currentData[idx].contenido || titulo !== currentData[idx].titulo || emoji !== currentData[idx].emoji) {
             updates.push(supabase.from('items').update({ emoji, titulo, contenido, last_edited_timestamp: new Date().toISOString() }).eq('id', id));
        }
    });
    if (updates.length > 0) { await Promise.all(updates); alert("✅ Guardado."); location.reload(); } else { alert("No hay cambios."); }
}
document.addEventListener('DOMContentLoaded', () => {
    DOMElements.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    DOMElements.saveBtn.addEventListener('click', saveChanges);
    DOMElements.addNewsBtn.addEventListener('click', addQuickNews);
    DOMElements.deleteNewsBtn.addEventListener('click', deleteNews);
    DOMElements.publishCommentBtn.addEventListener('click', publishComment);
    document.getElementById('fecha-actualizacion').textContent = new Date().toLocaleDateString();
    registerPageView(); getAndDisplayViewCount(); loadData(); loadNews(); loadComments();
});
async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data; DOMElements.contenedor.innerHTML = data.map((item, i) => createCardHTML(item, i)).join('');
        document.querySelectorAll('.card').forEach(c => c.addEventListener('click', toggleTimePanel));
    }
        }
