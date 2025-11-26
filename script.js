// ----------------------------------------------------
// 🔮 CONFIGURACIÓN DEL PORTAL (SUPABASE)
// ----------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 

// ----------------------------------------------------
// 💰 ORÁCULO DE DIVISAS (API ELTOQUE - CACHÉ)
// ----------------------------------------------------
const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";
const CACHE_DURATION = 10 * 60 * 1000; 

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------
// ✨ SISTEMA DE PARTÍCULAS (LUCIÉRNAGAS)
// ----------------------------------------------------
function spawnFireflies() {
    const container = document.getElementById('fireflies-container');
    if (!container) return;
    
    const fireflyCount = 30; // Cantidad de luciérnagas
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < fireflyCount; i++) {
        const firefly = document.createElement('div');
        firefly.classList.add('firefly');
        
        // Posiciones aleatorias para el vuelo
        const xStart = Math.random() * 100 + 'vw';
        const yStart = Math.random() * 100 + 'vh';
        const xEnd = (Math.random() * 100 - 50) + 'vw'; // Movimiento relativo
        const yEnd = (Math.random() * 100 - 50) + 'vh';
        
        firefly.style.setProperty('--x-start', xStart);
        firefly.style.setProperty('--y-start', yStart);
        firefly.style.setProperty('--x-end', xEnd);
        firefly.style.setProperty('--y-end', yEnd);
        
        // Duración y retraso aleatorio para que no se muevan igual
        firefly.style.animationDuration = (10 + Math.random() * 20) + 's';
        firefly.style.animationDelay = (Math.random() * 10) + 's';

        fragment.appendChild(firefly);
    }
    container.appendChild(fragment);
}

// ----------------------------------------------------
// 🎨 PALETA DE COLORES MÁGICOS
// ----------------------------------------------------
const MAGIC_PALETTE = [
    '#41ffc9', // Cian Espectral (Fuego fatuo)
    '#bd34fe', // Púrpura Brujo
    '#ffd700', // Oro Antiguo
    '#ff2a6d', // Rosa Poción
    '#00e5ff', // Azul Hielo
    '#76ff03'  // Verde Veneno
];

function getMagicColor(id) {
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    return MAGIC_PALETTE[Math.abs(hash) % MAGIC_PALETTE.length];
}

// ----------------------------------------------------
// ⚙️ VARIABLES GLOBALES Y ELEMENTOS
// ----------------------------------------------------
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
    deficit_mw: 'Consultando...', dollar_cup: '...', euro_cup: '...', mlc_cup: '...',
    deficit_edited_at: null, divisa_edited_at: null
}; 

let userWebId = localStorage.getItem('userWebId');
if (!userWebId) {
    userWebId = crypto.randomUUID(); 
    localStorage.setItem('userWebId', userWebId);
}

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

// ----------------------------------------------------
// 🕰️ LÓGICA DE TIEMPO (HACE X TIEMPO)
// ----------------------------------------------------
function timeAgo(timestamp) {
    if (!timestamp) return { text: 'Sin registro', diff: -1, date: null };
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 0) return { text: 'Ahora mismo', diff: 0 }; 
    
    const SECONDS = Math.floor(diff / 1000);
    const MINUTES = Math.floor(SECONDS / 60);
    const HOURS = Math.floor(MINUTES / 60);
    const DAYS = Math.floor(HOURS / 24);
    
    let text;
    if (DAYS >= 30) text = `hace ${Math.floor(DAYS / 30)} lunas`; 
    else if (DAYS >= 7) text = `hace ${Math.floor(DAYS / 7)} semanas`; 
    else if (DAYS >= 1) text = `hace ${DAYS} días`; 
    else if (HOURS >= 1) text = `hace ${HOURS} h`; 
    else if (MINUTES >= 1) text = `hace ${MINUTES} min`; 
    else text = 'hace unos instantes';
    
    return { text, diff };
}

// ----------------------------------------------------
// 💰 LÓGICA API ELTOQUE
// ----------------------------------------------------
async function fetchElToqueRates() {
    try {
        const lastUpdate = new Date(currentStatus.divisa_edited_at || 0).getTime();
        if ((Date.now() - lastUpdate) < CACHE_DURATION) return; 

        const proxyUrl = "https://corsproxy.io/?"; 
        const targetUrl = encodeURIComponent(ELTOQUE_API_URL);
        const response = await fetch(proxyUrl + targetUrl, {
            headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}` }
        });
        
        if (!response.ok) throw new Error("Error mágico en la API");
        const data = await response.json();
        
        let usd = '---', eur = '---', mlc = '---';
        const rates = data.tasas || data; // Adaptable a cambios de API
        if (rates) {
            usd = rates.USD || '---';
            eur = rates.EUR || rates.ECU || '---';
            mlc = rates.MLC || '---';
        }

        if (usd !== '---') {
            const newTime = new Date().toISOString();
            currentStatus = { ...currentStatus, dollar_cup: parseFloat(usd).toFixed(0), euro_cup: parseFloat(eur).toFixed(0), mlc_cup: parseFloat(mlc).toFixed(0), divisa_edited_at: newTime };
            renderStatusPanel(currentStatus, admin);
            await supabase.from('status_data').update(currentStatus).eq('id', 1);
        }
    } catch (e) { console.warn("🔮 La bola de cristal de divisas está nublada:", e); }
}

// ----------------------------------------------------
// 🛡️ GESTIÓN DE INTERFAZ Y ADMIN
// ----------------------------------------------------
function updateAdminUI(isAdmin) {
    admin = isAdmin;
    DOMElements.body.classList.toggle('admin-mode', isAdmin);
    DOMElements.adminControlsPanel.style.display = isAdmin ? "flex" : "none";
    
    if (isAdmin) {
        DOMElements.statusMessage.textContent = "🔮 ESTÁS EN MODO HECHICERO (EDICIÓN)";
        DOMElements.statusMessage.style.color = "#ff2a6d"; 
        DOMElements.toggleAdminBtn.textContent = "🛑 CERRAR GRIMORIO"; 
        DOMElements.toggleAdminBtn.classList.replace('btn-primary', 'btn-danger');
        enableEditing(); 
    } else {
        DOMElements.statusMessage.textContent = "Modo Observador Activo"; 
        DOMElements.statusMessage.style.color = "#b2dfdb"; 
        DOMElements.toggleAdminBtn.textContent = "🛡️ INVOCAR PODERES (ADMIN)"; 
        DOMElements.toggleAdminBtn.classList.replace('btn-danger', 'btn-primary');
        disableEditing(); 
    }
    renderStatusPanel(currentStatus, isAdmin); 
}

function toggleAdminMode() {
    if (!admin) updateAdminUI(true);
    else if (confirm("✅️ ¿Sellar el grimorio y salir?")) {
        updateAdminUI(false); loadData(); loadStatusData(); 
    }
}

// Generación de Tarjetas (Runas)
function createCardHTML(item, index) {
    let cardClass = '', labelHTML = '', labelText = 'Estable';
    if (item.last_edited_timestamp) {
        const { text, diff } = timeAgo(item.last_edited_timestamp);
        if (diff >= 0 && diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent'; labelHTML = '<div class="card-label">✨ NUEVO</div>'; labelText = 'Reciente';
        } else if (diff >= OLD_THRESHOLD_MS) {
            labelText = 'Antiguo';
        }
    }
    // Color mágico para el título
    const magicColor = getMagicColor(item.id);
    
    return `
    <div class="card ${cardClass}" data-index="${index}" data-id="${item.id}"> 
        ${labelHTML}
        <span class="emoji">${item.emoji}</span>
        <h3 style="color: ${magicColor}; text-shadow: 0 0 10px ${magicColor}60;">${item.titulo}</h3>
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel">📝 Actualizado ${timeAgo(item.last_edited_timestamp).text}</div>
    </div>`;
}

// Funciones de Edición (DOM Manipulation)
function enableEditing() {
    document.querySelectorAll(".card").forEach(card => {
        const idx = card.dataset.index;
        const item = currentData[idx];
        
        card.innerHTML = `
            <input class="editable-title" value="${item.titulo}" placeholder="Título">
            <input class="editable-emoji" value="${item.emoji}" maxlength="2" placeholder="Em">
            <textarea class="editable-content">${item.contenido}</textarea>
        `;
    });
}
function disableEditing() { /* Se maneja recargando datos en toggleAdminMode */ }

// ----------------------------------------------------
// 🗞️ NOTICIAS Y ESTADO
// ----------------------------------------------------
async function loadNews() {
    const { data } = await supabase.from('noticias').select('id, text, timestamp').order('timestamp', { ascending: false });
    if (!data) return;
    
    // Filtrar noticias de más de 24h
    currentNews = data.filter(n => (Date.now() - new Date(n.timestamp).getTime()) < RECENT_THRESHOLD_MS);
    
    // Si hay noticias viejas en DB, limpiarlas (opcional, buena práctica)
    // data.forEach(n => { if (!currentNews.includes(n)) supabase.from('noticias').delete().eq('id', n.id); });

    if (currentNews.length > 0) {
        const html = currentNews.map(n => `<span class="news-item">✨ ${linkify(n.text)}</span>`).join('<span class="news-item"> &nbsp;✦&nbsp; </span>');
        DOMElements.newsTickerContent.innerHTML = html + '<span class="news-item"> &nbsp;✦&nbsp; </span>' + html; // Duplicar para loop
        DOMElements.newsTicker.style.display = 'flex';
        
        // Calcular velocidad animación
        const width = DOMElements.newsTickerContent.scrollWidth / 2;
        const dur = width / NEWS_SCROLL_SPEED_PX_PER_SEC;
        DOMElements.dynamicTickerStyles.innerHTML = `@keyframes ticker-move-dynamic { 0% { transform: translateX(0); } 100% { transform: translateX(-${width}px); } }`;
        DOMElements.newsTickerContent.style.animation = `ticker-move-dynamic ${dur}s linear infinite`;
    } else {
        DOMElements.newsTicker.style.display = 'none';
    }
}

function linkify(text) {
    return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:var(--magic-accent-gold)">$1</a>');
}

// ----------------------------------------------------
// 🗣️ COMENTARIOS (ECOS DEL BOSQUE)
// ----------------------------------------------------
function createCommentHTML(c, isLiked) {
    // Generar avatar con color basado en nombre (hash simple)
    const hue = c.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
    const avatarColor = `hsl(${hue}, 60%, 40%)`; 
    const initial = c.name.charAt(0).toUpperCase();
    const likeClass = isLiked ? 'liked' : '';

    return `
        <div class="comment-item">
            <div style="display:flex; gap:10px;">
                <div class="comment-avatar" style="background:${avatarColor}; width:35px; height:35px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:white;">${initial}</div>
                <div class="comment-bubble" style="flex:1;">
                    <div style="display:flex; justify-content:space-between;">
                        <span class="comment-name">${c.name}</span>
                        <span class="comment-date" style="font-size:0.7em;">${timeAgo(c.timestamp).text}</span>
                    </div>
                    <div style="margin-top:5px; font-size:0.9em;">${c.text}</div>
                    <div style="text-align:right; margin-top:5px;">
                        <button class="like-button ${likeClass}" onclick="handleLike('${c.id}', this)" style="background:none; border:none; cursor:pointer;">
                            ♥ <span class="like-count">${c.likes_count || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
}

async function loadComments() {
    const { data } = await supabase.from('comentarios').select('*').order('timestamp', { ascending: false }).limit(20);
    if (data) {
        // Cargar likes del usuario local
        const { data: likes } = await supabase.from('likes').select('comment_id').eq('user_web_id', userWebId);
        const likedIds = new Set(likes?.map(l => l.comment_id));
        
        DOMElements.commentsContainer.innerHTML = data.map(c => createCommentHTML(c, likedIds.has(c.id))).join('');
    }
}

window.handleLike = async (id, btn) => {
    const isLiked = btn.classList.contains('liked');
    const counter = btn.querySelector('.like-count');
    btn.disabled = true;

    if (isLiked) {
        await supabase.from('likes').delete().eq('comment_id', id).eq('user_web_id', userWebId);
        await supabase.rpc('decrement_likes', { row_id: id });
        btn.classList.remove('liked');
        counter.textContent = Math.max(0, parseInt(counter.textContent) - 1);
    } else {
        const { error } = await supabase.from('likes').insert([{ comment_id: id, user_web_id: userWebId }]);
        if (!error) {
            await supabase.rpc('increment_likes', { row_id: id });
            btn.classList.add('liked');
            counter.textContent = parseInt(counter.textContent) + 1;
        }
    }
    btn.disabled = false;
};

// ----------------------------------------------------
// 🚀 INICIALIZACIÓN Y EVENTOS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    spawnFireflies(); // ✨ Activar magia
    loadData();
    loadNews();
    loadComments();
    loadStatusData();
    getAndDisplayViewCount();

    // Event Listeners
    DOMElements.toggleAdminBtn.onclick = toggleAdminMode;
    DOMElements.saveBtn.onclick = saveChanges;
    DOMElements.addNewsBtn.onclick = async () => {
        const t = prompt("✨ Escribe el nuevo presagio:");
        if(t) { await supabase.from('noticias').insert([{ text: t }]); loadNews(); }
    };
    DOMElements.deleteNewsBtn.onclick = async () => {
        if(!currentNews.length) return alert("Nada que borrar.");
        if(confirm("¿Borrar última noticia?")) { await supabase.from('noticias').delete().eq('id', currentNews[0].id); loadNews(); }
    };
    DOMElements.publishCommentBtn.onclick = async () => {
        const n = DOMElements.commenterName.value.trim();
        const t = DOMElements.commentText.value.trim();
        if(n && t) {
            DOMElements.publishCommentBtn.disabled = true;
            await supabase.from('comentarios').insert([{ name: n, text: t, likes_count: 0 }]);
            DOMElements.commenterName.value = ''; DOMElements.commentText.value = '';
            loadComments();
            DOMElements.publishCommentBtn.disabled = false;
        }
    };
});

async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data;
        DOMElements.contenedor.innerHTML = data.map(createCardHTML).join('');
    }
}

function renderStatusPanel(s, editing) {
    if (editing) {
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item"><span class="label">Déficit (MW)</span><input id="editDeficit" value="${s.deficit_mw}" style="width:60px;"></div>
            <div class="status-item"><span class="label">USD</span><input value="${s.dollar_cup}" disabled style="width:40px;"></div>
        `;
    } else {
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item deficit"><span class="label">⚡ Déficit</span><span class="value">${s.deficit_mw}</span></div>
            <div class="status-item divisa"><span class="label">💵 USD</span><span class="value">${s.dollar_cup}</span></div>
            <div class="status-item divisa"><span class="label">💶 EUR</span><span class="value">${s.euro_cup}</span></div>
            <div class="status-item divisa"><span class="label">💳 MLC</span><span class="value">${s.mlc_cup}</span></div>
        `;
    }
}

async function loadStatusData() {
    const { data } = await supabase.from('status_data').select('*').single();
    if (data) { currentStatus = data; renderStatusPanel(data, admin); fetchElToqueRates(); }
}

async function saveChanges() {
    if (!admin) return;
    const updates = [];
    document.querySelectorAll(".card").forEach(card => {
        const id = card.dataset.id;
        const titulo = card.querySelector('.editable-title').value;
        const emoji = card.querySelector('.editable-emoji').value;
        const contenido = card.querySelector('.editable-content').value;
        // Solo actualizar si hay cambios (comparación básica)
        updates.push(supabase.from('items').update({ titulo, emoji, contenido, last_edited_timestamp: new Date() }).eq('id', id));
    });
    
    const def = document.getElementById('editDeficit').value;
    if(def !== currentStatus.deficit_mw) updates.push(supabase.from('status_data').update({ deficit_mw: def }).eq('id', 1));

    await Promise.all(updates);
    alert("✨ Cambios sellados en el grimorio.");
    location.reload();
}

async function getAndDisplayViewCount() {
    // Registro simple de vistas (misma lógica original)
    const VISIT_KEY = 'lastPageView';
    const last = localStorage.getItem(VISIT_KEY);
    if (!last || (Date.now() - parseInt(last)) > ONE_DAY) {
        await supabase.from('page_views').insert({});
        localStorage.setItem(VISIT_KEY, Date.now());
    }
    const { count } = await supabase.from('page_views').select('*', { count: 'exact', head: true });
    document.getElementById('viewCounter').textContent = `👁️ ${count || 0} Observadores`;
}
