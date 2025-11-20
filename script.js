// script.js - FUSIÓN: LÓGICA ORIGINAL + GESTIÓN DE TARJETAS (ADD/DELETE/RESIZE)
// ----------------------------------------------------

// 1. CONFIGURACIÓN
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA";

// API ELTOQUE (Original con caché)
const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de Estado
let admin = false;
let currentData = [];
let currentNews = [];
let currentStatus = {
    deficit_mw: 'Cargando...',
    dollar_cup: '...',
    euro_cup: '...',
    deficit_edited_at: null,
    divisa_edited_at: null
};

// Constantes de Tiempo
const ONE_HOUR = 3600000;
const RECENT_THRESHOLD_MS = 24 * ONE_HOUR;
const OLD_THRESHOLD_MS = 7 * 24 * ONE_HOUR;
const NEWS_SCROLL_SPEED = 50;

// Identificador de Usuario (para likes)
const userWebId = localStorage.getItem('userWebId') || (() => {
    const id = crypto.randomUUID();
    localStorage.setItem('userWebId', id);
    return id;
})();

// Referencias DOM
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
    inputs: { 
        name: document.getElementById('commenterName'), 
        text: document.getElementById('commentText') 
    },
    btns: { 
        save: document.getElementById('saveBtn'), 
        addNews: document.getElementById('addNewsBtn'), 
        delNews: document.getElementById('deleteNewsBtn'), 
        publish: document.getElementById('publishCommentBtn') 
    }
};

// ----------------------------------------------------
// 2. UTILIDADES (TimeAgo, Linkify, Resize)
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

// FUNCIÓN NUEVA: AUTO-RESIZE PARA TEXTAREAS
window.autoResize = function(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight + 5) + 'px';
}

// ----------------------------------------------------
// 3. API EL TOQUE (Lógica Original Preservada)
// ----------------------------------------------------
async function fetchElToqueRates() {
    const lastUpdate = new Date(currentStatus.divisa_edited_at || 0).getTime();
    // Si el dato es fresco (menos de 10 min), no llamar a la API
    if (Date.now() - lastUpdate < CACHE_DURATION) return;

    try {
        const proxy = "https://corsproxy.io/?";
        const res = await fetch(proxy + encodeURIComponent(ELTOQUE_API_URL), {
            headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(res.status);
        
        const data = await res.json();
        let usd = '---', eur = '---';

        if (data.tasas) {
            usd = data.tasas.USD; eur = data.tasas.EUR || data.tasas.ECU;
        } else if (data.USD) {
            usd = data.USD; eur = data.EUR;
        }

        // Guardar en BD solo si tenemos datos válidos
        if (parseFloat(usd) > 0) {
            const now = new Date().toISOString();
            usd = parseFloat(usd).toFixed(0);
            eur = parseFloat(eur).toFixed(0);
            
            currentStatus = { ...currentStatus, dollar_cup: usd, euro_cup: eur, divisa_edited_at: now };
            renderStatusPanel(); // Actualizar UI inmediatamente

            await supabase.from('status_data').update({ 
                dollar_cup: usd, 
                euro_cup: eur, 
                divisa_edited_at: now 
            }).eq('id', 1);
        }
    } catch (e) { console.error("⚠️ API Error:", e.message); }
}

// ----------------------------------------------------
// 4. RENDERIZADO DE UI
// ----------------------------------------------------

// Panel de Estado (Original Logic)
function renderStatusPanel() {
    const { text: timeText } = timeAgo(currentStatus.deficit_edited_at);
    let timeHtml = `Última edición:<br> ${timeText}`;
    
    if (!admin && currentStatus.divisa_edited_at) {
        timeHtml += `<br><small style="color:var(--color-texto-secundario)">Divisas: ${timeAgo(currentStatus.divisa_edited_at).text}</small>`;
    }
    DOM.lastEdited.innerHTML = timeHtml;

    if (admin) {
        // Modo Admin: Inputs editables
        DOM.statusData.innerHTML = `
            <div class="status-item"><span class="label">Deficit (MW):</span><input type="text" id="editDeficit" value="${currentStatus.deficit_mw || ''}"></div>
            <div class="status-item"><span class="label">Dollar (Auto):</span><input type="text" value="${currentStatus.dollar_cup}" disabled style="background:#e9ecef; color:#666;"></div>
            <div class="status-item"><span class="label">Euro (Auto):</span><input type="text" value="${currentStatus.euro_cup}" disabled style="background:#e9ecef; color:#666;"></div>
        `;
    } else {
        // Modo Público: Texto estático
        DOM.statusData.innerHTML = `
            <div class="status-item deficit"><span class="label">🔌 Déficit:</span><span class="value">${currentStatus.deficit_mw || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💵 USD:</span><span class="value">${currentStatus.dollar_cup || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💶 EUR:</span><span class="value">${currentStatus.euro_cup || '---'}</span></div>`;
    }
}

// Tarjetas (Nueva Lógica Híbrida)
function renderCards() {
    DOM.container.innerHTML = currentData.map((item, index) => {
        // Si estamos en admin, renderizar campos editables
        if (admin) return createAdminCardHTML(item, index);
        // Si no, renderizar tarjeta normal (ocultando la tarjeta temporal)
        if (item.id.toString().startsWith('temp_')) return ''; 
        return createPublicCardHTML(item, index);
    }).join('');
    
    // Inicializar los auto-resize si estamos en admin
    if (admin) {
        document.querySelectorAll('.editable-content').forEach(tx => window.autoResize(tx));
    }
}

function createPublicCardHTML(item, index) {
    let cardClass = '';
    let panelStyle = 'background: white; color: var(--color-texto-principal);';
    let dateText = 'Actualizado';
    let label = '';

    if (item.last_edited_timestamp) {
        const { text, diff } = timeAgo(item.last_edited_timestamp);
        dateText = text;
        if (diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent';
            label = '<div class="card-label" style="background-color: var(--acento-rojo); color: white; display: block;">!EDITADO RECIENTEMENTE¡</div>';
            panelStyle = `background: var(--tiempo-panel-rojo); color: var(--acento-rojo);`;
        } else if (diff >= OLD_THRESHOLD_MS) {
            cardClass = 'card-old';
            panelStyle = `background: var(--tiempo-panel-cian); color: var(--acento-cian);`;
        }
    }

    return `
    <div class="card ${cardClass}" data-id="${item.id}" onclick="toggleTimePanel(this)">
        ${label}
        <span class="emoji">${item.emoji}</span>
        <h3>${item.titulo}</h3>
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel" style="${panelStyle}">
            <strong>Actualizado</strong> (${dateText})
        </div>
    </div>`;
}

function createAdminCardHTML(item, index) {
    const isTemp = item.id.toString().startsWith('temp_');
    // Botón de eliminar (solo si no es la tarjeta temporal "Espacio Disponible")
    const deleteBtn = isTemp ? '' : `<button class="delete-card-btn" onclick="deleteCard('${item.id}')">×</button>`;
    
    // Estilo diferente para la tarjeta temporal
    const cardStyle = isTemp ? 'opacity: 0.7; border: 2px dashed #ccc;' : '';

    return `
    <div class="card" style="${cardStyle}" data-index="${index}" data-id="${item.id}">
        ${deleteBtn}
        <input class="editable-emoji" value="${item.emoji}" maxlength="2" placeholder="Emoji">
        <input class="editable-title" value="${item.titulo}" placeholder="Título">
        <div class="card-content">
            <textarea class="editable-content" oninput="autoResize(this)" placeholder="Escribe aquí el contenido...">${item.contenido}</textarea>
        </div>
        ${isTemp ? '<small style="display:block; margin-top:5px; color:#666; font-size:0.7rem">(Escribe para crear nueva tarjeta)</small>' : ''}
    </div>`;
}

// ----------------------------------------------------
// 5. LÓGICA DE ADMINISTRACIÓN Y GUARDADO
// ----------------------------------------------------
function toggleAdminMode() {
    if (!admin) {
        // Entrar a Admin
        admin = true;
        DOM.body.classList.add('admin-mode');
        DOM.adminPanel.style.display = "flex";
        DOM.statusMsg.textContent = "¡🔴 MODO EDICIÓN ACTIVADO!";
        DOM.statusMsg.style.color = "#0d9488";
        DOM.toggleAdminBtn.textContent = "🛑 SALIR DEL MODO EDICIÓN";
        DOM.toggleAdminBtn.style.backgroundColor = "var(--acento-rojo)";
    } else {
        // Salir de Admin
        if (!confirm("✅️ ¿Guardar o descartar? (Los cambios no guardados se perderán)")) return;
        admin = false;
        DOM.body.classList.remove('admin-mode');
        DOM.adminPanel.style.display = "none";
        DOM.statusMsg.textContent = "Accede a modo edición para actualizar la información";
        DOM.statusMsg.style.color = "var(--color-texto-principal)";
        DOM.toggleAdminBtn.textContent = "🛡️ ACTIVAR EL MODO EDICIÓN";
        DOM.toggleAdminBtn.style.backgroundColor = "#4f46e5";
        loadData(); // Recargar datos originales para descartar cambios no guardados
    }
    renderStatusPanel();
    renderCards();
}

// FUNCIÓN GLOBAL ELIMINAR
window.deleteCard = async (id) => {
    if (!confirm("⛔ ¿Estás seguro de ELIMINAR esta tarjeta permanentemente?")) return;
    try {
        const { error } = await supabase.from('items').delete().eq('id', id);
        if (error) throw error;
        // Eliminar visualmente del array local y re-renderizar
        currentData = currentData.filter(item => item.id != id);
        renderCards();
    } catch (e) { alert("Error al eliminar: " + e.message); }
};

// FUNCIÓN GUARDAR CAMBIOS (Insertar nuevos o actualizar)
async function saveChanges() {
    if (!admin) return;
    
    const updates = [];
    const now = new Date().toISOString();

    // 1. Guardar Estado (Deficit)
    const newDeficit = document.getElementById('editDeficit').value;
    if (newDeficit !== currentStatus.deficit_mw) {
        updates.push(supabase.from('status_data').update({ deficit_mw: newDeficit, deficit_edited_at: now }).eq('id', 1));
    }

    // 2. Guardar Tarjetas
    const cards = document.querySelectorAll(".card");
    cards.forEach(card => {
        const id = card.dataset.id;
        const idx = card.dataset.index;
        
        // Obtener valores nuevos
        const emoji = card.querySelector('.editable-emoji').value.trim();
        const titulo = card.querySelector('.editable-title').value.trim();
        const contenido = card.querySelector('.editable-content').value.trim();
        const original = currentData[idx];

        // Detectar si hubo cambios
        if (emoji !== original.emoji || titulo !== original.titulo || contenido !== original.contenido) {
            
            if (id.startsWith('temp_')) {
                // ES NUEVA: Insertar (solo si se escribió algo)
                if (titulo !== 'Espacio Disponible' || contenido !== '...') {
                    updates.push(supabase.from('items').insert([{ emoji, titulo, contenido, last_edited_timestamp: now }]));
                }
            } else {
                // ES EXISTENTE: Actualizar
                updates.push(supabase.from('items').update({ emoji, titulo, contenido, last_edited_timestamp: now }).eq('id', id));
            }
        }
    });

    if (updates.length > 0) {
        await Promise.all(updates);
        alert("✅ Todos los cambios han sido guardados.");
        location.reload(); // Recargar para limpiar IDs temporales y actualizar todo
    } else {
        alert("No se detectaron cambios para guardar.");
    }
}

// ----------------------------------------------------
// 6. NOTICIAS Y COMENTARIOS
// ----------------------------------------------------
async function loadNews() {
    const { data, error } = await supabase.from('noticias').select('*').order('timestamp', { ascending: false });
    if (error) return;

    const cutoff = Date.now() - RECENT_THRESHOLD_MS;
    const validNews = data.filter(n => new Date(n.timestamp).getTime() > cutoff);
    
    // Limpieza de noticias viejas
    data.forEach(n => { if (new Date(n.timestamp).getTime() <= cutoff) supabase.from('noticias').delete().eq('id', n.id); });

    currentNews = validNews;
    if (validNews.length > 0) {
        const html = validNews.map(n => `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`).join('<span class="news-item"> | </span>');
        DOM.newsContent.innerHTML = `${html}<span class="news-item"> | </span>${html}`; // Duplicado para scroll infinito
        
        const width = DOM.newsContent.scrollWidth / 2;
        const duration = width / NEWS_SCROLL_SPEED;
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
        const text = prompt("✍️ Nueva Noticia:");
        if (text) { await supabase.from('noticias').insert([{ text: text.trim() }]); loadNews(); }
    } else {
        if (currentNews.length === 0) return alert("No hay noticias.");
        const idx = parseInt(prompt(`Eliminar Nº:\n${currentNews.map((n, i) => `${i+1}. ${n.text}`).join('\n')}`)) - 1;
        if (currentNews[idx]) { await supabase.from('noticias').delete().eq('id', currentNews[idx].id); loadNews(); }
    }
}

// ----------------------------------------------------
// 7. COMENTARIOS (Simplificado para el ejemplo)
// ----------------------------------------------------
function generateColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${hash % 360}, 70%, 50%)`;
}

function createCommentDOM(c, isLiked) {
    const isReply = !!c.parent_id;
    return `
        <div class="comment-item ${isReply ? 'reply-style' : ''}" style="--comment-color: ${generateColor(c.name.toLowerCase())};">
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

    // Render Replies
    replies.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach(r => {
        const container = document.getElementById(`replies-${r.parent_id}`);
        if (container) {
            const div = document.createElement('div');
            div.className = 'reply-item';
            div.innerHTML = createCommentDOM(r, likesMap.has(r.id));
            container.appendChild(div);
        }
    });
    
    // "Ver más" toggles
    parents.forEach(p => {
        const container = document.getElementById(`replies-${p.id}`);
        if (container && container.children.length > 0) { // Mostrar toggle si hay al menos 1 respuesta
            // Lógica de expandir simplificada: mostrar por defecto o botón
            if(container.children.length > 1) {
                 // Ocultar todos menos el primero y poner boton (Lógica visual extra opcional)
            }
            container.classList.add('expanded'); // Por defecto expandido en esta versión simple
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
    if (admin) return; // No abrir panel en modo edición
    const id = card.dataset.id;
    // Cerrar otros
    document.querySelectorAll('.card').forEach(c => {
        if (c.dataset.id !== id) c.classList.remove('show-time-panel');
    });
    // Toggle actual
    if (card.classList.toggle('show-time-panel')) {
        setTimeout(() => card.classList.remove('show-time-panel'), 2000);
    }
};

// ----------------------------------------------------
// 8. CARGA INICIAL DE DATOS
// ----------------------------------------------------
async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data;
        // AÑADIR TARJETA TEMPORAL PARA CREACIÓN (Solo visible en Admin)
        currentData.push({ 
            id: 'temp_new', 
            emoji: '➕', 
            titulo: 'Espacio Disponible', 
            contenido: '...' 
        });
        renderCards();
    }
}

async function loadStatusData() {
    const { data } = await supabase.from('status_data').select('*').eq('id', 1).single();
    if (data) currentStatus = { ...currentStatus, ...data };
    renderStatusPanel();
    fetchElToqueRates(); // Iniciar chequeo de caché/API
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
    Promise.all([loadData(), loadNews(), loadComments(), loadStatusData()]);
    
    // Contador visual (opcional)
    supabase.from('page_views').select('*', { count: 'exact', head: true })
        .gt('created_at', new Date(Date.now() - 86400000).toISOString())
        .then(({ count }) => {
            const el = document.getElementById('viewCounter');
            if(el) el.textContent = `👀 ${count || 0} (24h)`;
        });
});
