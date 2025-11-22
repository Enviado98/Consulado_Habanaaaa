// ----------------------------------------------------
// 🚨 CONFIGURACIÓN DE SUPABASE (BAAS) 🚨
// ----------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 

// ----------------------------------------------------
// 💰 CONFIGURACIÓN API ELTOQUE (Caché Inteligente)
// ----------------------------------------------------
const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

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
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
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
let currentStatus = {
    deficit_mw: 'Cargando...', 
    dollar_cup: '...', euro_cup: '...', mlc_cup: '...',
    deficit_edited_at: null, divisa_edited_at: null
}; 

// Identificador de usuario para likes (simple localStorage)
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
    dynamicTickerStyles: document.getElementById('dynamicTickerStyles'),
    statusPanel: document.getElementById('statusPanel'),
    statusDataContainer: document.getElementById('statusDataContainer')
};

function timeAgo(timestamp) {
    if (!timestamp) return { text: 'Sin fecha.', diff: -1, date: null };
    const then = new Date(timestamp).getTime();
    const now = Date.now();
    const diff = now - then;
    if (diff < 0) return { text: 'Ahora mismo', diff: 0, date: new Date(timestamp) }; 
    
    const SECONDS = Math.floor(diff / 1000);
    const MINUTES = Math.floor(SECONDS / 60);
    const HOURS = Math.floor(MINUTES / 60);
    const DAYS = Math.floor(HOURS / 24);
    
    let text;
    if (DAYS >= 30) text = `hace ${Math.floor(DAYS / 30)} meses`;
    else if (DAYS >= 7) text = `hace ${Math.floor(DAYS / 7)} sem.`;
    else if (DAYS >= 1) text = `hace ${DAYS} día${DAYS > 1 ? 's' : ''}`;
    else if (HOURS >= 1) text = `hace ${HOURS} h.`;
    else if (MINUTES >= 1) text = `hace ${MINUTES} min.`;
    else text = 'hace un momento';
    
    return { text, diff, date: new Date(timestamp) };
}

// ----------------------------------------------------
// 💰 LÓGICA API ELTOQUE
// ----------------------------------------------------
async function fetchElToqueRates() {
    try {
        const lastUpdate = new Date(currentStatus.divisa_edited_at || 0).getTime();
        const now = Date.now();
        if ((now - lastUpdate) < CACHE_DURATION) return; 

        const proxyUrl = "https://corsproxy.io/?"; 
        const targetUrl = encodeURIComponent(ELTOQUE_API_URL);

        const response = await fetch(proxyUrl + targetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}`, 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Error API: ${response.status}`);
        const data = await response.json();
        
        let usd = '---', eur = '---', mlc = '---';
        // Manejo de diferentes estructuras de respuesta de la API
        if (data.tasas) { usd = data.tasas.USD; eur = data.tasas.EUR || data.tasas.ECU; mlc = data.tasas.MLC; } 
        else if (data.USD) { usd = data.USD; eur = data.EUR || data.ECU; mlc = data.MLC; }

        if (usd && eur) {
            const newTime = new Date().toISOString();
            currentStatus.dollar_cup = parseFloat(usd).toFixed(0);
            currentStatus.euro_cup = parseFloat(eur).toFixed(0);
            currentStatus.mlc_cup = parseFloat(mlc).toFixed(0);
            currentStatus.divisa_edited_at = newTime;
            
            renderStatusPanel(currentStatus, admin);
            await supabase.from('status_data').update({ 
                dollar_cup: currentStatus.dollar_cup, 
                euro_cup: currentStatus.euro_cup, 
                mlc_cup: currentStatus.mlc_cup, 
                divisa_edited_at: newTime
            }).eq('id', 1);
        }
    } catch (error) { console.error("⚠️ Error API:", error.message); }
}

// ----------------------------------------------------
// UI ADMIN
// ----------------------------------------------------
function updateAdminUI(isAdmin) {
    admin = isAdmin;
    DOMElements.body.classList.toggle('admin-mode', isAdmin);
    DOMElements.statusPanel.classList.toggle('admin-mode', isAdmin);
    
    if (isAdmin) {
        DOMElements.adminControlsPanel.style.display = "flex";
        DOMElements.statusMessage.textContent = "¡🔴 MODO EDICIÓN ACTIVO!";
        DOMElements.statusMessage.style.color = "#ef233c"; 
        DOMElements.toggleAdminBtn.textContent = "🛑 SALIR"; 
        DOMElements.toggleAdminBtn.className = 'btn btn-danger';
        enableEditing(); 
    } else {
        DOMElements.adminControlsPanel.style.display = "none";
        DOMElements.statusMessage.textContent = "Modo lectura activo"; 
        DOMElements.statusMessage.style.color = "var(--color-texto-principal)"; 
        DOMElements.toggleAdminBtn.textContent = "🛡️ ACTIVAR EDICIÓN"; 
        DOMElements.toggleAdminBtn.className = 'btn btn-primary';
        disableEditing(); 
    }
    renderStatusPanel(currentStatus, isAdmin); 
}

function toggleAdminMode() {
    if (!admin) {
        updateAdminUI(true);
        alert("¡🔴 EDITA CON RESPONSABILIDAD!\nCualquier cambio será visible para todos.");
    } else {
        if (!confirm("✅️ ¿Terminar la edición?")) return;
        updateAdminUI(false);
        loadData(); loadStatusData(); 
    }
}

// ----------------------------------------------------
// CARDS & EDITING (TARJETAS PRINCIPALES)
// ----------------------------------------------------
function createCardHTML(item, index) {
    let cardClass = '', labelHTML = '', labelText = 'Actualizado', timeText = 'Sin editar';
    
    if (item.last_edited_timestamp) {
        const { text, diff } = timeAgo(item.last_edited_timestamp);
        timeText = text;
        if (diff >= 0 && diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent'; labelHTML = '<div class="card-label">!NUEVO!</div>'; labelText = 'Reciente';
        } else if (diff >= OLD_THRESHOLD_MS) {
            cardClass = 'card-old'; labelHTML = '<div class="card-label">Antiguo</div>'; labelText = 'Antiguo';
        }
    }
    const neonColor = getCardColor(item.id);

    return `
    <div class="card ${cardClass}" data-index="${index}" data-id="${item.id}"> 
        ${labelHTML}
        <span class="emoji">${item.emoji}</span>
        <h3 style="--card-neon: ${neonColor}">${item.titulo}</h3>
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel" data-id="${item.id}">
            <strong>${labelText}</strong> (${timeText})
        </div>
    </div>`;
}

function enableEditing() { toggleEditing(true); }
function disableEditing() { toggleEditing(false); }

function toggleEditing(enable) {
    document.querySelectorAll(".card").forEach(card => {
        const index = card.getAttribute('data-index');
        const item = currentData[index];
        
        if (enable) {
            card.classList.add('editing-active');
            card.removeEventListener('click', toggleTimePanel); 
            
            // Reemplazar contenido visual por inputs de edición
            // Mantenemos data-id en el padre, así que no hay problema
            card.innerHTML = `
                <input class="editable-emoji" value="${item.emoji}" maxlength="2">
                <input class="editable-title" value="${item.titulo}">
                <div class="card-content"><textarea class="editable-content">${item.contenido}</textarea></div>
            `;
        } else {
            // No hace falta hacer nada aquí, porque al salir del modo admin
            // se llama a loadData() que reconstruye el HTML desde 0.
        }
    });
}

function toggleTimePanel(event) {
    if (admin) return;
    const clickedCard = event.currentTarget;
    const isShowing = clickedCard.classList.toggle('show-time-panel');
    if (isShowing) setTimeout(() => clickedCard.classList.remove('show-time-panel'), TIME_PANEL_AUTOHIDE_MS);
}

// ----------------------------------------------------
// NEWS TICKER (CINTA DE NOTICIAS RÁPIDAS)
// ----------------------------------------------------
function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

async function loadNews() {
    // Carga noticias de la tabla 'noticias' (distinta de 'banners')
    const { data: newsData, error } = await supabase.from('noticias').select('id, text, timestamp').order('timestamp', { ascending: false });
    if (error) return;
    
    const validNews = [];
    const cutoff = Date.now() - RECENT_THRESHOLD_MS; // Filtra noticias muy viejas automáticamente
    
    // Borrado automático de noticias viejas de la cinta
    newsData.forEach(n => {
        if (new Date(n.timestamp).getTime() > cutoff) validNews.push(n);
        else supabase.from('noticias').delete().eq('id', n.id); // Limpieza automática
    });
    currentNews = validNews;
    
    if (validNews.length > 0) {
        const newsHtml = validNews.map(n => `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`).join('<span class="news-item"> | </span>');
        // Duplicamos el contenido para efecto infinito sin saltos
        DOMElements.newsTickerContent.innerHTML = `${newsHtml}<span class="news-item"> | </span>${newsHtml}`;
        DOMElements.newsTicker.style.display = 'flex';
        
        // Calculamos la velocidad de animación basada en la longitud del texto
        const width = DOMElements.newsTickerContent.scrollWidth / 2;
        const duration = width / NEWS_SCROLL_SPEED_PX_PER_SEC;
        DOMElements.dynamicTickerStyles.innerHTML = `@keyframes ticker-move-dynamic { 0% { transform: translateX(0); } 100% { transform: translateX(-${width}px); } }`;
        DOMElements.newsTickerContent.style.animation = `ticker-move-dynamic ${duration}s linear infinite`;
    } else {
        DOMElements.newsTickerContent.innerHTML = `<span class="news-item">Sin Noticias recientes... || 🛡 Activa el modo edición para publicar</span>`.repeat(2);
        DOMElements.newsTickerContent.style.animation = `ticker-move-static 15s linear infinite`;
    }
}

async function addQuickNews() {
    if (!admin) return;
    const text = prompt("✍️ Escribe tu noticia (ej: 'Citas de visado abiertas'):");
    if (text && confirm("¿Publicar en la cinta roja?")) {
        await supabase.from('noticias').insert([{ text: text.trim() }]);
        loadNews();
    }
}

async function deleteNews() {
    if (!admin || currentNews.length === 0) return alert("No hay noticias activas.");
    const list = currentNews.map((n, i) => `${i + 1}. ${n.text}`).join('\n');
    const idx = parseInt(prompt(`Escribe el número de la noticia a eliminar:\n${list}`)) - 1;
    if (currentNews[idx] && confirm("¿Eliminar esta noticia?")) {
        await supabase.from('noticias').delete().eq('id', currentNews[idx].id);
        loadNews();
    }
}

// ----------------------------------------------------
// 🗣️ SISTEMA DE COMENTARIOS (PÁGINA PRINCIPAL)
// ----------------------------------------------------
function generateColorByName(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${hash % 360}, 70%, 50%)`; 
}

function getInitials(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

function createCommentHTML(comment, isLiked) {
    const color = generateColorByName(comment.name);
    const initial = getInitials(comment.name);
    const likeClass = isLiked ? 'liked' : '';
    const dateText = timeAgo(comment.timestamp).text;

    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            <div class="comment-avatar" style="--comment-color: ${color};">${initial}</div>
            
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${comment.name}</span>
                    <span class="comment-date">${dateText}</span>
                </div>
                
                <div class="comment-text">${comment.text}</div>
                
                <div class="comment-actions">
                    <button class="action-btn like-button ${likeClass}" data-id="${comment.id}">
                        <span class="icon">♥</span> <span class="like-count" data-counter-id="${comment.id}">${comment.likes_count || 0}</span>
                    </button>
                    ${!comment.parent_id ? `<button class="action-btn reply-form-toggle" data-id="${comment.id}">Responder</button>` : ''}
                </div>

                ${!comment.parent_id ? `
                    <div class="reply-form" data-reply-to="${comment.id}">
                        <input type="text" class="reply-name" placeholder="Tu Nombre" maxlength="30">
                        <textarea class="reply-text" placeholder="Escribe tu respuesta..." maxlength="250"></textarea>
                        <button class="btn btn-sm btn-success publish-reply-btn" data-parent-id="${comment.id}">Publicar Respuesta</button>
                    </div>
                    <div class="replies-container" data-parent-of="${comment.id}"></div>
                ` : ''}
            </div>
        </div>`;
}

function drawReplies(container, replies, userLikesMap) {
    container.innerHTML = ''; 
    // Ordenar respuestas: cronológico (antiguas primero)
    replies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); 
    
    replies.forEach((reply) => {
        const isLiked = userLikesMap.get(reply.id) || false;
        container.insertAdjacentHTML('beforeend', createCommentHTML(reply, isLiked));
    });
}

async function loadComments() {
    const [commentsResponse, likesResponse] = await Promise.all([
        // Cargar comentarios donde banner_id sea NULL (comentarios generales de la home)
        supabase.from('comentarios').select('*').is('banner_id', null).order('timestamp', { ascending: false }),
        supabase.from('likes').select('comment_id').eq('user_web_id', userWebId)
    ]);

    if (commentsResponse.error) return DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: #d90429;">❌ Error al cargar comentarios.</p>`;
    
    const allComments = commentsResponse.data;
    const userLikesMap = new Map();
    if (likesResponse.data) likesResponse.data.forEach(like => userLikesMap.set(like.comment_id, true));
    
    // Separar principales y respuestas
    const principalComments = allComments.filter(c => c.parent_id === null);
    const repliesMap = allComments.reduce((map, comment) => {
        if (comment.parent_id !== null) {
            if (!map.has(comment.parent_id)) map.set(comment.parent_id, []);
            map.get(comment.parent_id).push(comment);
        }
        return map;
    }, new Map());
    
    if (principalComments.length === 0) return DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: #eee;">Sé el primero en comentar.</p>`;
    
    // Renderizar principales
    DOMElements.commentsContainer.innerHTML = principalComments.map(c => createCommentHTML(c, userLikesMap.get(c.id))).join('');

    // Renderizar respuestas dentro de los principales
    principalComments.forEach(comment => {
        const replies = repliesMap.get(comment.id);
        if (replies) {
            const container = document.querySelector(`.replies-container[data-parent-of="${comment.id}"]`);
            if (container) drawReplies(container, replies, userLikesMap);
        }
    });

    // Event Listeners (Delegación o re-attach)
    attachCommentListeners();
}

function attachCommentListeners() {
    // Quitamos listeners previos para evitar duplicados si se llama varias veces
    document.querySelectorAll('.reply-form-toggle').forEach(btn => btn.onclick = toggleReplyForm);
    document.querySelectorAll('.publish-reply-btn').forEach(btn => btn.onclick = handlePublishReply);
    document.querySelectorAll('.like-button').forEach(btn => btn.onclick = handleLikeToggle);
}

function toggleReplyForm(event) {
    const id = event.currentTarget.getAttribute('data-id');
    const form = document.querySelector(`.reply-form[data-reply-to="${id}"]`);
    if (form) {
        // Cerrar otros
        document.querySelectorAll('.reply-form').forEach(f => { if(f !== form) f.style.display = 'none'; });
        
        const isVisible = form.style.display === 'block';
        form.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) form.querySelector('.reply-name').focus();
    }
}

async function publishComment() {
    const name = DOMElements.commenterName.value.trim();
    const text = DOMElements.commentText.value.trim();
    if (name.length < 2 || text.length < 2) return alert("Escribe un nombre y mensaje válidos.");
    
    DOMElements.publishCommentBtn.disabled = true;
    // banner_id es NULL para comentarios de la página principal
    const { error } = await supabase.from('comentarios').insert([{ name, text, likes_count: 0, banner_id: null }]);
    
    if (!error) {
        DOMElements.commenterName.value = '';
        DOMElements.commentText.value = '';
        await loadComments();
    } else { alert("❌ Error al publicar."); }
    DOMElements.publishCommentBtn.disabled = false;
}

async function handlePublishReply(event) {
    const btn = event.currentTarget;
    const parentId = btn.getAttribute('data-parent-id');
    const form = btn.closest('.reply-form');
    const name = form.querySelector('.reply-name').value.trim();
    const text = form.querySelector('.reply-text').value.trim();
    
    if (name.length < 2 || text.length < 2) return alert("Escribe un nombre y mensaje válidos.");
    
    btn.disabled = true;
    // Las respuestas heredan el contexto (banner_id null) implícitamente o explícitamente
    const { error } = await supabase.from('comentarios').insert([{ name, text, parent_id: parentId, likes_count: 0, banner_id: null }]);
    
    if (!error) {
        form.style.display = 'none';
        await loadComments();
    } else { alert("❌ Error al responder."); }
    btn.disabled = false;
}

async function handleLikeToggle(event) {
    const btn = event.currentTarget;
    const id = btn.getAttribute('data-id');
    const counter = document.querySelector(`.like-count[data-counter-id="${id}"]`);
    const isLiked = btn.classList.contains('liked');
    
    btn.disabled = true;
    try {
        if (isLiked) {
            await supabase.from('likes').delete().eq('comment_id', id).eq('user_web_id', userWebId);
            await supabase.rpc('decrement_likes', { row_id: id });
            btn.classList.remove('liked');
            counter.textContent = Math.max(0, parseInt(counter.textContent) - 1);
        } else {
            const { error } = await supabase.from('likes').insert([{ comment_id: id, user_web_id: userWebId }]);
            if (!error || error.code === '23505') { // 23505 = duplicado, ya le dio like
                if (!error) await supabase.rpc('increment_likes', { row_id: id });
                btn.classList.add('liked');
                counter.textContent = parseInt(counter.textContent) + 1;
            }
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
    // Registrar visita solo si ha pasado más de 24h
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

function renderStatusPanel(status, isAdminMode) {
    const html = isAdminMode ? `
        <div class="status-item"><span class="label">Deficit (MW):</span><input type="text" id="editDeficit" value="${status.deficit_mw || ''}"></div>
        <div class="status-item"><span class="label">USD (Auto):</span><input type="text" value="${status.dollar_cup}" disabled></div>
        <div class="status-item"><span class="label">EUR (Auto):</span><input type="text" value="${status.euro_cup}" disabled></div>
        <div class="status-item"><span class="label">MLC (Auto):</span><input type="text" value="${status.mlc_cup}" disabled></div>
    ` : `
        <div class="status-item deficit"><span class="label">🔌 Déficit:</span><span class="value">${status.deficit_mw || '---'}</span></div>
        <div class="status-item divisa"><span class="label">💵 USD:</span><span class="value">${status.dollar_cup || '---'}</span></div>
        <div class="status-item divisa"><span class="label">💶 EUR:</span><span class="value">${status.euro_cup || '---'}</span></div>
        <div class="status-item divisa"><span class="label">💳 MLC:</span><span class="value">${status.mlc_cup || '---'}</span></div>
    `;
    DOMElements.statusDataContainer.innerHTML = html;
}

async function loadStatusData() {
    const { data } = await supabase.from('status_data').select('*').eq('id', 1).single();
    if (data) currentStatus = { ...currentStatus, ...data };
    renderStatusPanel(currentStatus, admin); fetchElToqueRates(); 
}

async function saveChanges() {
    if (!admin) return;
    const editDeficit = document.getElementById('editDeficit');
    const newDeficit = editDeficit ? editDeficit.value : currentStatus.deficit_mw;
    const updates = [];
    
    document.querySelectorAll(".card").forEach(card => {
        if (!card.classList.contains('editing-active')) return;
        
        const emoji = card.querySelector('.editable-emoji').value;
        const titulo = card.querySelector('.editable-title').value;
        const contenido = card.querySelector('.editable-content').value;
        const id = card.dataset.id;
        
        // Actualización de tarjeta
        updates.push(supabase.from('items').update({ 
            emoji, titulo, contenido, 
            last_edited_timestamp: new Date().toISOString() 
        }).eq('id', id));
    });

    if (newDeficit !== currentStatus.deficit_mw) {
        // Actualización de déficit
        updates.push(supabase.from('status_data').update({ 
            deficit_mw: newDeficit, deficit_edited_at: new Date().toISOString() 
        }).eq('id', 1));
    }
    
    if (updates.length > 0) { await Promise.all(updates); alert("✅ Guardado."); location.reload(); }
    else { alert("No hay cambios."); }
}

async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data; 
        DOMElements.contenedor.innerHTML = data.map((item, i) => createCardHTML(item, i)).join('');
        document.querySelectorAll('.card').forEach(c => c.addEventListener('click', toggleTimePanel));
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    DOMElements.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    DOMElements.saveBtn.addEventListener('click', saveChanges);
    DOMElements.addNewsBtn.addEventListener('click', addQuickNews);
    DOMElements.deleteNewsBtn.addEventListener('click', deleteNews);
    DOMElements.publishCommentBtn.addEventListener('click', publishComment);
    
    const fechaSpan = document.getElementById('fecha-actualizacion');
    if(fechaSpan) fechaSpan.textContent = new Date().toLocaleDateString();
    
    registerPageView(); getAndDisplayViewCount(); loadData(); loadNews(); loadComments(); loadStatusData(); 
});
