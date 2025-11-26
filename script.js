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
// 🎨 PALETA DE COLORES MÁGICOS (NEÓN HECHIZADO)
// ----------------------------------------------------
const MAGIC_PALETTE = [
    '#41ffc9', // Cian Espectral
    '#bd34fe', // Púrpura Brujo
    '#ffd700', // Oro Antiguo
    '#ff2a6d', // Rosa Poción
    '#00e5ff', // Azul Hielo
    '#76ff03'  // Verde Veneno
];

function getCardColor(id) {
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    return MAGIC_PALETTE[Math.abs(hash) % MAGIC_PALETTE.length];
}

// ----------------------------------------------------
// ✨ SISTEMA DE PARTÍCULAS (LUCIÉRNAGAS)
// ----------------------------------------------------
function spawnFireflies() {
    const container = document.getElementById('fireflies-container');
    if (!container) return;
    
    // Limpiar por si acaso
    container.innerHTML = '';

    const fireflyCount = 25; 
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < fireflyCount; i++) {
        const firefly = document.createElement('div');
        firefly.classList.add('firefly');
        
        const xStart = Math.random() * 100 + 'vw';
        const yStart = Math.random() * 100 + 'vh';
        const xEnd = (Math.random() * 100 - 50) + 'vw'; 
        const yEnd = (Math.random() * 100 - 50) + 'vh';
        
        firefly.style.setProperty('--x-start', xStart);
        firefly.style.setProperty('--y-start', yStart);
        firefly.style.setProperty('--x-end', xEnd);
        firefly.style.setProperty('--y-end', yEnd);
        
        firefly.style.animationDuration = (15 + Math.random() * 20) + 's';
        firefly.style.animationDelay = (Math.random() * 10) + 's';

        fragment.appendChild(firefly);
    }
    container.appendChild(fragment);
}

// ----------------------------------------------------
// ⚙️ VARIABLES GLOBALES
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

// Elementos del DOM (Sincronizados con index.html)
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
// 🕰️ UTILIDADES DE TIEMPO
// ----------------------------------------------------
function timeAgo(timestamp) {
    if (!timestamp) return { text: 'Sin fecha', diff: -1, date: null };
    const then = new Date(timestamp).getTime();
    const now = Date.now();
    const diff = now - then;
    if (diff < 0) return { text: 'Ahora mismo', diff: 0, date: new Date(timestamp) }; 
    
    const SECONDS = Math.floor(diff / 1000);
    const MINUTES = Math.floor(SECONDS / 60);
    const HOURS = Math.floor(MINUTES / 60);
    const DAYS = Math.floor(HOURS / 24);
    
    let text;
    if (DAYS >= 30) { text = `hace ${Math.floor(DAYS / 30)} lunas`; } 
    else if (DAYS >= 7) { const weeks = Math.floor(DAYS / 7); text = `hace ${weeks} sem.`; } 
    else if (DAYS >= 2) { text = `hace ${DAYS} días`; } 
    else if (DAYS === 1) { text = 'hace 1 día'; } 
    else if (HOURS >= 2) { text = `hace ${HOURS} h.`; } 
    else if (HOURS === 1) { text = 'hace 1 hora'; } 
    else if (MINUTES >= 1) { text = `hace ${MINUTES} min.`; } 
    else { text = 'hace unos instantes'; }
    
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
            method: 'GET', headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}`, 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Error API: ${response.status}`);
        const data = await response.json();
        
        let usdPrice = '---', eurPrice = '---', mlcPrice = '---';
        if (data.tasas) {
            usdPrice = data.tasas.USD || '---'; eurPrice = data.tasas.EUR || data.tasas.ECU || '---'; mlcPrice = data.tasas.MLC || '---';
        } else if (data.USD) {
             usdPrice = data.USD; eurPrice = data.EUR || data.ECU; mlcPrice = data.MLC;
        }
        usdPrice = parseFloat(usdPrice).toFixed(0); eurPrice = parseFloat(eurPrice).toFixed(0); mlcPrice = parseFloat(mlcPrice).toFixed(0);

        if (usdPrice !== '---') {
            const newTime = new Date().toISOString();
            currentStatus.dollar_cup = usdPrice; currentStatus.euro_cup = eurPrice; currentStatus.mlc_cup = mlcPrice;
            currentStatus.divisa_edited_at = newTime;
            renderStatusPanel(currentStatus, admin);
            await supabase.from('status_data').update({ dollar_cup: usdPrice, euro_cup: eurPrice, mlc_cup: mlcPrice, divisa_edited_at: newTime }).eq('id', 1);
        }
    } catch (error) { console.error("⚠️ Error API:", error.message); }
}

// ----------------------------------------------------
// UI & ADMIN (LÓGICA RESTAURADA)
// ----------------------------------------------------
function updateAdminUI(isAdmin) {
    admin = isAdmin;
    if (isAdmin) {
        DOMElements.body.classList.add('admin-mode');
        DOMElements.adminControlsPanel.style.display = "flex";
        DOMElements.statusMessage.textContent = "🔮 ESTÁS EN MODO HECHICERO (EDICIÓN)";
        DOMElements.statusMessage.style.color = "#ff2a6d"; 
        DOMElements.toggleAdminBtn.textContent = "🛑 CERRAR GRIMORIO"; 
        DOMElements.toggleAdminBtn.classList.remove('btn-primary');
        DOMElements.toggleAdminBtn.classList.add('btn-danger');
        enableEditing(); 
    } else {
        DOMElements.body.classList.remove('admin-mode');
        DOMElements.adminControlsPanel.style.display = "none";
        DOMElements.statusMessage.textContent = "Modo Observador Activo"; 
        DOMElements.statusMessage.style.color = "#b2dfdb"; 
        DOMElements.toggleAdminBtn.textContent = "🛡️ INVOCAR PODERES (ADMIN)"; 
        DOMElements.toggleAdminBtn.classList.remove('btn-danger');
        DOMElements.toggleAdminBtn.classList.add('btn-primary');
        disableEditing(); 
    }
    renderStatusPanel(currentStatus, isAdmin); 
}

function toggleAdminMode() {
    if (!admin) {
        updateAdminUI(true); alert("🔮 ¡Has invocado los poderes de edición!");
    } else {
        if (!confirm("✅️ ¿Sellar el grimorio y guardar silencio?")) return;
        updateAdminUI(false); loadData(); loadStatusData(); 
    }
}

// Transformar tarjetas en inputs
function enableEditing() { toggleEditing(true); }
// Restaurar tarjetas normales
function disableEditing() { toggleEditing(false); }

function toggleEditing(enable) {
    document.querySelectorAll(".card").forEach(card => {
        const item = currentData[card.getAttribute('data-index')];
        const contentDiv = card.querySelector('.card-content');
        
        if (enable) {
            // Entrar en modo edición: Limpiar y poner inputs
            card.classList.add('editing-active'); 
            card.removeEventListener('click', toggleTimePanel); 
            
            // Guardar estilo si lo tenía
            const neonColor = card.querySelector('h3') ? card.querySelector('h3').style.color : '#fff';
            
            // Limpiar HTML visual
            card.innerHTML = ''; 

            // Crear Inputs
            const editableTitle = document.createElement('input'); 
            editableTitle.className = 'editable-title'; 
            editableTitle.value = item.titulo;
            editableTitle.placeholder = "Título";

            const editableEmoji = document.createElement('input'); 
            editableEmoji.className = 'editable-emoji'; 
            editableEmoji.value = item.emoji; 
            editableEmoji.maxLength = 2;
            editableEmoji.placeholder = "Em";

            const editableContent = document.createElement('textarea'); 
            editableContent.className = 'editable-content'; 
            editableContent.value = item.contenido;

            card.appendChild(editableEmoji);
            card.appendChild(editableTitle);
            card.appendChild(editableContent);
            
        } else {
            // Salir de modo edición (se recarga data luego, pero por seguridad visual)
            card.classList.remove('editing-active');
            // La función loadData() se encarga de pintar de nuevo
        }
    });
}

function createCardHTML(item, index) {
    let cardClass = '', labelHTML = '', labelText = 'Estable', timeText = 'Sin registro';
    
    if (item.last_edited_timestamp) {
        const { text, diff } = timeAgo(item.last_edited_timestamp);
        timeText = text;
        if (diff >= 0 && diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent'; 
            labelHTML = '<div class="card-label">✨ NUEVO</div>'; 
            labelText = 'Reciente';
        } else if (diff >= OLD_THRESHOLD_MS) {
            cardClass = 'card-old'; 
            labelHTML = '<div class="card-label">ANTIGUO</div>';
            labelText = 'Antiguo';
        }
    }
    
    const magicColor = getCardColor(item.id);

    return `
    <div class="card ${cardClass}" data-index="${index}" data-id="${item.id}"> 
        ${labelHTML}
        <span class="emoji">${item.emoji}</span>
        <h3 style="--card-neon: ${magicColor}; color: ${magicColor};">${item.titulo}</h3>
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel">📝 Actualizado ${timeText}</div>
    </div>`;
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
        return `<a href="${fullUrl}" target="_blank" style="color:var(--magic-accent-gold); text-decoration:underline;">${url}</a>`;
    });
}

// ----------------------------------------------------
// 🗞️ NOTICIAS (LÓGICA SCROLL REPARADA)
// ----------------------------------------------------
async function loadNews() {
    const { data: newsData, error } = await supabase.from('noticias').select('id, text, timestamp').order('timestamp', { ascending: false });
    if (error) return;
    
    // Filtrar noticias viejas (> 24h)
    const validNews = []; 
    const cutoff = Date.now() - RECENT_THRESHOLD_MS;
    
    newsData.forEach(n => { 
        if (new Date(n.timestamp).getTime() > cutoff) validNews.push(n); 
        // Opcional: else supabase.from('noticias').delete().eq('id', n.id); 
    });
    
    currentNews = validNews;
    
    if (validNews.length > 0) {
        const html = validNews.map(n => `<span class="news-item">✨ ${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`).join('<span class="news-item"> &nbsp;✦&nbsp; </span>');
        
        // Duplicar contenido para efecto infinito
        DOMElements.newsTickerContent.innerHTML = `${html}<span class="news-item"> &nbsp;✦&nbsp; </span>${html}`;
        DOMElements.newsTicker.style.display = 'flex';
        
        // Calcular animación precisa
        const width = DOMElements.newsTickerContent.scrollWidth / 2; 
        const dur = width / NEWS_SCROLL_SPEED_PX_PER_SEC;
        
        DOMElements.dynamicTickerStyles.innerHTML = `@keyframes ticker-move-dynamic { 0% { transform: translateX(0); } 100% { transform: translateX(-${width}px); } }`;
        DOMElements.newsTickerContent.style.animation = `ticker-move-dynamic ${dur}s linear infinite`;
    } else {
        // Estado sin noticias: Ocultar o mostrar mensaje fijo
        DOMElements.newsTicker.style.display = 'none';
    }
}

async function addQuickNews() {
    if (!admin) return;
    const text = prompt("✨ Conjura tu noticia:");
    if (text && confirm("¿Publicar presagio?")) { 
        await supabase.from('noticias').insert([{ text: text.trim() }]); 
        loadNews(); 
    }
}

async function deleteNews() {
    if (!admin || currentNews.length === 0) return alert("El viento no trae noticias para borrar.");
    // Borrar la más reciente por defecto o preguntar
    if (confirm(`¿Disipar la noticia más reciente?\n"${currentNews[0].text}"`)) { 
        await supabase.from('noticias').delete().eq('id', currentNews[0].id); 
        loadNews(); 
    }
}

// ----------------------------------------------------
// 🗣️ COMENTARIOS
// ----------------------------------------------------
function createCommentHTML(c, isLiked) {
    // Generar color avatar basado en nombre
    let hash = 0; for (let i = 0; i < c.name.length; i++) hash = c.name.charCodeAt(i) + ((hash << 5) - hash);
    const color = `hsl(${Math.abs(hash) % 360}, 60%, 50%)`; 
    const initial = c.name.charAt(0).toUpperCase();
    const likeClass = isLiked ? 'liked' : '';

    return `
        <div class="comment-item">
            <div class="comment-main-row">
                <div class="comment-avatar" style="background:${color};">${initial}</div>
                <div class="comment-bubble">
                    <div style="display:flex; justify-content:space-between;">
                        <span class="comment-name">${c.name}</span>
                        <span class="comment-date">${timeAgo(c.timestamp).text}</span>
                    </div>
                    <div class="comment-content">${c.text}</div>
                    <div style="text-align:right; margin-top:5px;">
                        <button class="like-button ${likeClass}" onclick="handleLike('${c.id}', this)" style="background:none; border:none; cursor:pointer; color:#ccc;">
                            ♥ <span class="like-count">${c.likes_count || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
}

async function loadComments() {
    const { data } = await supabase.from('comentarios').select('*').order('timestamp', { ascending: false }).limit(30);
    if (data) {
        // Cargar likes locales
        const { data: likes } = await supabase.from('likes').select('comment_id').eq('user_web_id', userWebId);
        const likedIds = new Set(likes?.map(l => l.comment_id));
        
        DOMElements.commentsContainer.innerHTML = data.map(c => createCommentHTML(c, likedIds.has(c.id))).join('');
    } else {
        DOMElements.commentsContainer.innerHTML = '<p style="text-align:center; color:#aaa;">Silencio en el bosque...</p>';
    }
}

// Hacer global para onclick en HTML generado
window.handleLike = async (id, btn) => {
    const isLiked = btn.classList.contains('liked');
    const counter = btn.querySelector('.like-count');
    btn.disabled = true;

    if (isLiked) {
        await supabase.from('likes').delete().eq('comment_id', id).eq('user_web_id', userWebId);
        await supabase.rpc('decrement_likes', { row_id: id });
        btn.classList.remove('liked');
        btn.style.color = '#ccc';
        counter.textContent = Math.max(0, parseInt(counter.textContent) - 1);
    } else {
        const { error } = await supabase.from('likes').insert([{ comment_id: id, user_web_id: userWebId }]);
        if (!error) {
            await supabase.rpc('increment_likes', { row_id: id });
            btn.classList.add('liked');
            btn.style.color = '#ff2a6d';
            counter.textContent = parseInt(counter.textContent) + 1;
        }
    }
    btn.disabled = false;
};

async function publishComment() {
    const name = DOMElements.commenterName.value.trim();
    const text = DOMElements.commentText.value.trim();
    if (name.length < 2 || text.length < 2) return alert("El hechizo requiere más palabras.");
    
    DOMElements.publishCommentBtn.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, likes_count: 0 }]);
    
    if (!error) { 
        DOMElements.commenterName.value = ''; 
        DOMElements.commentText.value = ''; 
        loadComments(); 
    } else { 
        alert("❌ Error mágico al enviar."); 
    }
    DOMElements.publishCommentBtn.disabled = false;
}

// ----------------------------------------------------
// PANELES Y ESTADO
// ----------------------------------------------------
function renderStatusPanel(status, isAdminMode) {
    if (isAdminMode) {
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item"><span class="label">Déficit (MW):</span><input type="text" id="editDeficit" value="${status.deficit_mw || ''}" style="width:100%; text-align:center;"></div>
            <div class="status-item"><span class="label">USD (Auto):</span><input type="text" value="${status.dollar_cup}" disabled style="width:100%; text-align:center; opacity:0.7;"></div>
        `;
    } else {
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item deficit"><span class="label">⚡ Déficit:</span><span class="value">${status.deficit_mw || '---'}</span></div>
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
    
    // Guardar cambios en tarjetas
    document.querySelectorAll(".card").forEach(card => {
        const emoji = card.querySelector('.editable-emoji').value;
        const titulo = card.querySelector('.editable-title').value;
        const contenido = card.querySelector('.editable-content').value;
        const id = card.dataset.id; 
        const idx = card.dataset.index;
        
        // Verificar si hubo cambios para no saturar
        if (contenido !== currentData[idx].contenido || titulo !== currentData[idx].titulo || emoji !== currentData[idx].emoji) {
             updates.push(supabase.from('items').update({ emoji, titulo, contenido, last_edited_timestamp: new Date().toISOString() }).eq('id', id));
        }
    });
    
    // Guardar déficit
    if (newDeficit !== currentStatus.deficit_mw) {
        updates.push(supabase.from('status_data').update({ deficit_mw: newDeficit, deficit_edited_at: new Date().toISOString() }).eq('id', 1));
    }
    
    if (updates.length > 0) { 
        await Promise.all(updates); 
        alert("✨ Cambios sellados en el grimorio."); 
        location.reload(); 
    } else { 
        alert("No hay cambios en el éter."); 
    }
}

async function getAndDisplayViewCount() {
    const VISIT_KEY = 'lastPageView';
    const last = localStorage.getItem(VISIT_KEY);
    if (!last || (Date.now() - parseInt(last)) > ONE_DAY) {
        await supabase.from('page_views').insert({});
        localStorage.setItem(VISIT_KEY, Date.now());
    }
    const { count } = await supabase.from('page_views').select('*', { count: 'exact', head: true });
    document.getElementById('viewCounter').textContent = `👁️ ${count ? count.toLocaleString('es-ES') : '0'} Observadores`;
}

async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data; 
        DOMElements.contenedor.innerHTML = data.map((item, i) => createCardHTML(item, i)).join('');
        document.querySelectorAll('.card').forEach(c => c.addEventListener('click', toggleTimePanel));
    }
}

// ----------------------------------------------------
// 🚀 INICIALIZACIÓN
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    spawnFireflies(); // Iniciar partículas
    document.getElementById('fecha-actualizacion').textContent = new Date().toLocaleDateString();
    
    // Listeners
    DOMElements.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    DOMElements.saveBtn.addEventListener('click', saveChanges);
    DOMElements.addNewsBtn.addEventListener('click', addQuickNews);
    DOMElements.deleteNewsBtn.addEventListener('click', deleteNews);
    DOMElements.publishCommentBtn.addEventListener('click', publishComment);

    // Carga inicial
    getAndDisplayViewCount(); 
    loadData(); 
    loadNews(); 
    loadComments(); 
    loadStatusData(); 
});
