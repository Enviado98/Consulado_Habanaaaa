// ----------------------------------------------------
// 🚨 CONFIGURACIÓN DE SUPABASE (BAAS) 🚨
// ----------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 

// ----------------------------------------------------
// 💰 CONFIGURACIÓN API ELTOQUE (Caché Inteligente) 🚨
// ----------------------------------------------------
const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";

const CACHE_DURATION = 10 * 60 * 1000; 

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------
// 🎨 PALETA DE COLORES NEÓN (PREMIUM)
// ----------------------------------------------------
const NEON_PALETTE = [
    '#00ffff', // Cian Eléctrico
    '#ff00ff', // Magenta Neón
    '#00ff00', // Lima Matrix
    '#ffff00', // Amarillo Cyber
    '#ff0099', // Rosa Fuerte
    '#9D00FF', // Violeta Ultra
    '#FF4D00', // Naranja Neón
    '#00E5FF', // Azul Láser
    '#76ff03', // Verde Alien
    '#ff1744'  // Rojo Brillante
];

// Función para obtener un color fijo basado en el ID (para que no cambie al recargar)
function getCardColor(id) {
    // Convertimos el ID (texto o número) a un número entero
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Usamos el módulo para elegir un color de la paleta
    const index = Math.abs(hash) % NEON_PALETTE.length;
    return NEON_PALETTE[index];
}

// Variables y constantes globales
let admin = false; 
const ONE_HOUR = 3600000;
const ONE_DAY = 24 * ONE_HOUR;
const RECENT_THRESHOLD_MS = ONE_DAY; 
const OLD_THRESHOLD_MS = 7 * ONE_DAY;
const NEWS_SCROLL_SPEED_PX_PER_SEC = 50; 
const TIME_PANEL_AUTOHIDE_MS = 3000; // Un poco más de tiempo para leer

let currentData = [];
let currentNews = []; 
let currentStatus = {
    deficit_mw: 'Cargando...', 
    dollar_cup: '...', 
    euro_cup: '...',
    mlc_cup: '...',
    deficit_edited_at: null,
    divisa_edited_at: null
}; 

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
        
        let usdPrice = '---', eurPrice = '---', mlcPrice = '---';
        if (data.tasas) {
            usdPrice = data.tasas.USD || '---'; eurPrice = data.tasas.EUR || data.tasas.ECU || '---'; mlcPrice = data.tasas.MLC || '---';
        } else if (data.USD) {
             usdPrice = data.USD; eurPrice = data.EUR || data.ECU; mlcPrice = data.MLC;
        }

        usdPrice = parseFloat(usdPrice).toFixed(0);
        eurPrice = parseFloat(eurPrice).toFixed(0);
        mlcPrice = parseFloat(mlcPrice).toFixed(0);

        if (usdPrice !== '---' && eurPrice !== '---') {
            const newTime = new Date().toISOString();
            currentStatus.dollar_cup = usdPrice;
            currentStatus.euro_cup = eurPrice;
            currentStatus.mlc_cup = mlcPrice;
            currentStatus.divisa_edited_at = newTime;
            
            renderStatusPanel(currentStatus, admin);

            await supabase.from('status_data').update({ 
                    dollar_cup: usdPrice, euro_cup: eurPrice, mlc_cup: mlcPrice, divisa_edited_at: newTime
            }).eq('id', 1);
        }
    } catch (error) { console.error("⚠️ Error API:", error.message); }
}

// ----------------------------------------------------
// FUNCIONES DE UI Y LOGIN (MEJORADAS)
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
        
        DOMElements.statusMessage.textContent = "Modo lectura activo"; 
        DOMElements.statusMessage.style.color = "var(--color-texto-principal)"; 
        
        DOMElements.toggleAdminBtn.textContent = "🛡️ ACTIVAR EDICIÓN"; 
        DOMElements.toggleAdminBtn.classList.remove('btn-danger');
        DOMElements.toggleAdminBtn.classList.add('btn-primary');
        
        disableEditing(); 
    }
    
    DOMElements.statusPanel.classList.toggle('admin-mode', isAdmin);
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

function enableEditing() { toggleEditing(true); }
function disableEditing() { toggleEditing(false); }

// ----------------------------------------------------
// CREACIÓN DE CARD (CON COLORES NEÓN)
// ----------------------------------------------------
function createCardHTML(item, index) {
    let cardClass = '', labelHTML = '', labelText = 'Sin fecha', timeText = 'Sin editar';
    
    if (item.last_edited_timestamp) {
        const { text, diff } = timeAgo(item.last_edited_timestamp);
        timeText = text;
        if (diff >= 0 && diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent';
            labelHTML = '<div class="card-label">!NUEVO!</div>';
            labelText = 'Reciente';
        } else if (diff >= OLD_THRESHOLD_MS) {
            cardClass = 'card-old';
            labelHTML = '<div class="card-label">Antiguo</div>';
            labelText = 'Antiguo';
        } else {
            labelText = 'Actualizado';
        }
    }

    // Obtener color neón único
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

function toggleEditing(enable) {
    const cards = document.querySelectorAll(".card");
    cards.forEach(card => {
        const index = card.getAttribute('data-index');
        const item = currentData[index];
        const contentDiv = card.querySelector('.card-content');
        const emojiSpan = card.querySelector('.emoji');
        const titleH3 = card.querySelector('h3');
        
        if (enable) {
            card.classList.add('editing-active');
            card.removeEventListener('click', toggleTimePanel); 
            card.querySelector('.card-time-panel').style.display = 'none';
            if (card.querySelector('.card-label')) card.querySelector('.card-label').style.display = 'none';

            if (emojiSpan && titleH3) {
                emojiSpan.remove(); titleH3.remove(); contentDiv.querySelector('p').remove();
                
                const editableEmoji = document.createElement('input');
                editableEmoji.className = 'editable-emoji'; editableEmoji.value = item.emoji; editableEmoji.maxLength = 2;
                card.insertBefore(editableEmoji, card.firstChild);
                
                const editableTitle = document.createElement('input');
                editableTitle.className = 'editable-title'; editableTitle.value = item.titulo;
                card.insertBefore(editableTitle, editableEmoji.nextSibling);

                const editableContent = document.createElement('textarea');
                editableContent.className = 'editable-content'; editableContent.value = item.contenido;
                contentDiv.appendChild(editableContent);
            }
        } else {
            card.classList.remove('editing-active');
            const editableEmoji = card.querySelector('.editable-emoji');
            if (editableEmoji) {
                const editableTitle = card.querySelector('.editable-title');
                const editableContent = card.querySelector('.editable-content');
                
                editableEmoji.remove(); editableTitle.remove(); editableContent.remove();
                
                // Restaurar elementos originales
                const newEmojiSpan = document.createElement('span');
                newEmojiSpan.className = 'emoji'; newEmojiSpan.textContent = item.emoji; 
                card.insertBefore(newEmojiSpan, card.firstChild);
                
                // Restaurar título con su color neón
                const neonColor = getCardColor(item.id);
                const newTitleH3 = document.createElement('h3');
                newTitleH3.textContent = item.titulo;
                newTitleH3.style.setProperty('--card-neon', neonColor); // IMPORTANTE: Restaurar color
                card.insertBefore(newTitleH3, newEmojiSpan.nextSibling);

                const newP = document.createElement('p');
                newP.textContent = item.contenido;
                contentDiv.appendChild(newP);
                
                card.querySelector('.card-time-panel').style.display = '';
                if (card.querySelector('.card-label')) card.querySelector('.card-label').style.display = '';
                card.addEventListener('click', toggleTimePanel);
            }
        }
    });
}

function toggleTimePanel(event) {
    if (admin) return;
    const clickedCard = event.currentTarget;
    const cardId = clickedCard.getAttribute('data-id'); 
    document.querySelectorAll('.card').forEach(card => {
        if (card.getAttribute('data-id') !== cardId) card.classList.remove('show-time-panel');
    });
    const isShowing = clickedCard.classList.toggle('show-time-panel');
    if (isShowing) setTimeout(() => clickedCard.classList.remove('show-time-panel'), TIME_PANEL_AUTOHIDE_MS);
}

// ----------------------------------------------------
// LÓGICA DE NOTICIAS 
// ----------------------------------------------------
function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

async function loadNews() {
    const { data: newsData, error } = await supabase.from('noticias').select('id, text, timestamp').order('timestamp', { ascending: false });
    if (error) return;
    const validNews = [];
    const cutoff = Date.now() - RECENT_THRESHOLD_MS;
    newsData.forEach(n => {
        if (new Date(n.timestamp).getTime() > cutoff) validNews.push(n);
        else supabase.from('noticias').delete().eq('id', n.id);
    });
    currentNews = validNews;
    if (validNews.length > 0) {
        const newsHtml = validNews.map(n => `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`).join('<span class="news-item"> | </span>');
        DOMElements.newsTickerContent.innerHTML = `${newsHtml}<span class="news-item"> | </span>${newsHtml}`;
        DOMElements.newsTicker.style.display = 'flex';
        
        DOMElements.newsTickerContent.style.animation = 'none'; DOMElements.newsTickerContent.offsetHeight; 
        const width = DOMElements.newsTickerContent.scrollWidth / 2;
        const duration = width / NEWS_SCROLL_SPEED_PX_PER_SEC;
        DOMElements.dynamicTickerStyles.innerHTML = `@keyframes ticker-move-dynamic { 0% { transform: translateX(0); } 100% { transform: translateX(-${width}px); } }`;
        DOMElements.newsTickerContent.style.animation = `ticker-move-dynamic ${duration}s linear infinite`;
    } else {
        DOMElements.newsTicker.style.display = 'flex';
        DOMElements.newsTickerContent.innerHTML = `<span class="news-item">Sin Noticias recientes... || 🛡 Activa el modo edición para publicar</span>`.repeat(2);
        DOMElements.newsTickerContent.style.animation = `ticker-move-static 15s linear infinite`;
    }
}

async function addQuickNews() {
    if (!admin) return;
    const text = prompt("✍️ Escribe tu noticia:");
    if (text && confirm("¿Publicar?")) {
        await supabase.from('noticias').insert([{ text: text.trim() }]);
        loadNews();
    }
}

async function deleteNews() {
    if (!admin || currentNews.length === 0) return alert("No hay noticias.");
    const list = currentNews.map((n, i) => `${i + 1}. ${n.text}`).join('\n');
    const idx = parseInt(prompt(`Eliminar número:\n${list}`)) - 1;
    if (currentNews[idx] && confirm("¿Eliminar?")) {
        await supabase.from('noticias').delete().eq('id', currentNews[idx].id);
        loadNews();
    }
}

// ----------------------------------------------------
// LÓGICA DE COMENTARIOS
// ----------------------------------------------------
function generateColorByName(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    return `hsl(${hash % 360}, 70%, 50%)`; 
}
function formatCommentDate(timestamp) {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp)) + ' h';
}
function createCommentHTML(comment, isLiked) {
    const color = generateColorByName(comment.name.toLowerCase());
    const likeClass = isLiked ? 'liked' : '';
    const itemClass = comment.parent_id ? 'comment-item reply-style' : 'comment-item'; 
    return `
        <div class="${itemClass}" data-comment-id="${comment.id}" style="--comment-color: ${color};">
            <strong class="comment-name">${comment.name} dijo:</strong>
            <div class="comment-content">${comment.text}</div>
            <div class="comment-actions">
                <button class="like-button ${likeClass}" data-id="${comment.id}"><span class="heart">♥</span></button>
                <span class="like-count" data-counter-id="${comment.id}">${comment.likes_count || 0}</span>
                ${!comment.parent_id ? `<span class="reply-form-toggle" data-id="${comment.id}">Responder</span>` : ''}
                <span class="comment-date">${formatCommentDate(comment.timestamp)}</span>
            </div>
            ${!comment.parent_id ? `
                <div class="reply-form" data-reply-to="${comment.id}">
                    <input type="text" class="reply-name" placeholder="Tu Nombre" required maxlength="30">
                    <textarea class="reply-text" placeholder="Tu Respuesta (máx. 250)" required maxlength="250"></textarea>
                    <button class="btn btn-sm btn-success publish-reply-btn" data-parent-id="${comment.id}">Publicar Respuesta</button>
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
        const wrapper = document.createElement('div'); wrapper.className = 'reply-item';
        wrapper.innerHTML = createCommentHTML(reply, isLiked); container.appendChild(wrapper);
    });
    if (replies.length > 1) {
        const remaining = replies.length - 1;
        const toggle = document.createElement('span'); toggle.className = 'reply-toggle';
        toggle.textContent = `Ver las ${remaining} respuestas más...`;
        toggle.addEventListener('click', (e) => { e.target.closest('.replies-container').classList.add('expanded'); e.target.style.display = 'none'; });
        container.appendChild(toggle);
    }
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
        if (comment.parent_id !== null) { if (!map.has(comment.parent_id)) map.set(comment.parent_id, []); map.get(comment.parent_id).push(comment); }
        return map;
    }, new Map());
    
    if (principalComments.length === 0) return DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: #333;">Sé el primero en comentar.</p>`;
    DOMElements.commentsContainer.innerHTML = principalComments.map(c => createCommentHTML(c, userLikesMap.get(c.id))).join('');

    principalComments.forEach(comment => {
        const replies = repliesMap.get(comment.id);
        if (replies) { const container = document.querySelector(`.replies-container[data-parent-of="${comment.id}"]`); if (container) drawReplies(container, replies, userLikesMap); }
    });

    document.querySelectorAll('.reply-form-toggle').forEach(btn => btn.addEventListener('click', toggleReplyForm));
    document.querySelectorAll('.publish-reply-btn').forEach(btn => btn.addEventListener('click', handlePublishReply));
    document.querySelectorAll('.like-button').forEach(btn => btn.addEventListener('click', handleLikeToggle));
}
function toggleReplyForm(event) {
    const form = document.querySelector(`.reply-form[data-reply-to="${event.target.getAttribute('data-id')}"]`);
    if (form) {
        document.querySelectorAll('.reply-form').forEach(f => { if (f !== form) f.style.display = 'none'; });
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        if (form.style.display === 'block') form.querySelector('.reply-name').focus();
    }
}
async function publishComment() {
    const name = DOMElements.commenterName.value.trim(); const text = DOMElements.commentText.value.trim();
    if (name.length < 2 || text.length < 5) return alert("Datos insuficientes.");
    DOMElements.publishCommentBtn.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, likes_count: 0 }]);
    if (!error) { DOMElements.commenterName.value = ''; DOMElements.commentText.value = ''; await loadComments(); alert("✅ Comentario publicado."); } else { alert("❌ Error al publicar."); }
    DOMElements.publishCommentBtn.disabled = false;
}
async function handlePublishReply(event) {
    const parentId = event.target.getAttribute('data-parent-id'); const form = event.target.closest('.reply-form');
    const name = form.querySelector('.reply-name').value.trim(); const text = form.querySelector('.reply-text').value.trim();
    if (name.length < 2 || text.length < 5) return alert("Datos insuficientes.");
    event.target.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, parent_id: parentId, likes_count: 0 }]);
    if (!error) { form.style.display = 'none'; await loadComments(); alert("✅ Respuesta publicada."); } else { alert("❌ Error al responder."); }
    event.target.disabled = false;
}
async function handleLikeToggle(event) {
    const btn = event.currentTarget; const id = btn.getAttribute('data-id'); const isLiked = btn.classList.contains('liked'); const counter = document.querySelector(`.like-count[data-counter-id="${id}"]`);
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
function renderStatusPanel(status, isAdminMode) {
    if (isAdminMode) {
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item"><span class="label">Deficit (MW):</span><input type="text" id="editDeficit" value="${status.deficit_mw || ''}"></div>
            <div class="status-item"><span class="label">USD (Auto):</span><input type="text" value="${status.dollar_cup}" disabled></div>
            <div class="status-item"><span class="label">EUR (Auto):</span><input type="text" value="${status.euro_cup}" disabled></div>
            <div class="status-item"><span class="label">MLC (Auto):</span><input type="text" value="${status.mlc_cup}" disabled></div>`;
    } else {
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item deficit"><span class="label">🔌 Déficit:</span><span class="value">${status.deficit_mw || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💵 USD:</span><span class="value">${status.dollar_cup || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💶 EUR:</span><span class="value">${status.euro_cup || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💳 MLC:</span><span class="value">${status.mlc_cup || '---'}</span></div>`;
    }
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
        const emoji = card.querySelector('.editable-emoji').value;
        const titulo = card.querySelector('.editable-title').value;
        const contenido = card.querySelector('.editable-content').value;
        const id = card.dataset.id; const idx = card.dataset.index;
        if (contenido !== currentData[idx].contenido || titulo !== currentData[idx].titulo || emoji !== currentData[idx].emoji) {
             updates.push(supabase.from('items').update({ emoji, titulo, contenido, last_edited_timestamp: new Date().toISOString() }).eq('id', id));
        }
    });
    if (newDeficit !== currentStatus.deficit_mw) {
        updates.push(supabase.from('status_data').update({ deficit_mw: newDeficit, deficit_edited_at: new Date().toISOString() }).eq('id', 1));
    }
    if (updates.length > 0) { await Promise.all(updates); alert("✅ Guardado."); location.reload(); } else { alert("No hay cambios."); }
}
document.addEventListener('DOMContentLoaded', () => {
    DOMElements.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    DOMElements.saveBtn.addEventListener('click', saveChanges);
    DOMElements.addNewsBtn.addEventListener('click', addQuickNews);
    DOMElements.deleteNewsBtn.addEventListener('click', deleteNews);
    DOMElements.publishCommentBtn.addEventListener('click', publishComment);
    document.getElementById('fecha-actualizacion').textContent = new Date().toLocaleDateString();
    registerPageView(); getAndDisplayViewCount(); loadData(); loadNews(); loadComments(); loadStatusData(); 
});
async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data; DOMElements.contenedor.innerHTML = data.map((item, i) => createCardHTML(item, i)).join('');
        document.querySelectorAll('.card').forEach(c => c.addEventListener('click', toggleTimePanel));
    }
}
