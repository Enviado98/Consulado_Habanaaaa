// ----------------------------------------------------
// 🚨 CONFIGURACIÓN DE SUPABASE 🚨
// ----------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------
// 💰 CONFIGURACIÓN API ELTOQUE (Caché Inteligente)
// ----------------------------------------------------
const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";
const CACHE_DURATION = 10 * 60 * 1000; // 10 Minutos

// VARIABLES GLOBALES
let admin = false; 
let currentData = [];
let itemsToDelete = new Set(); // Almacena IDs para borrar al guardar
let currentStatus = { deficit_mw: '...', dollar_cup: '...', euro_cup: '...', deficit_edited_at: null, divisa_edited_at: null }; 
let userWebId = localStorage.getItem('userWebId') || crypto.randomUUID();

if (!localStorage.getItem('userWebId')) localStorage.setItem('userWebId', userWebId);

// CONSTANTES TIEMPO
const ONE_DAY = 86400000;
const RECENT_THRESHOLD_MS = ONE_DAY; 
const OLD_THRESHOLD_MS = 7 * ONE_DAY;

// ELEMENTOS DOM (Cache)
const DOM = {
    body: document.body,
    contenedor: document.getElementById('contenedor'),
    newsTicker: document.getElementById('newsTicker'),
    newsTickerContent: document.getElementById('newsTickerContent'),
    commentsContainer: document.getElementById('commentsContainer'),
    adminPanel: document.getElementById('adminControlsPanel'),
    toggleAdminBtn: document.getElementById('toggleAdminBtn'), 
    statusDataContainer: document.getElementById('statusDataContainer'),
    lastEditedTime: document.getElementById('lastEditedTime'),
    commentName: document.getElementById('commenterName'),
    commentText: document.getElementById('commentText'),
    pubCommentBtn: document.getElementById('publishCommentBtn')
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

    let text = 'hace unos momentos';
    if (days >= 30) text = `hace ${Math.floor(days / 30)} meses`;
    else if (days >= 1) text = `hace ${days} día${days > 1 ? 's' : ''}`;
    else if (hours >= 1) text = `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    else if (minutes >= 1) text = `hace ${minutes} min.`;
    
    return { text, diff };
}

function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

function generateColorByName(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    return `hsl(${hash % 360}, 70%, 45%)`; 
}

// ----------------------------------------------------
// 🔄 LÓGICA DE DATOS Y TARJETAS
// ----------------------------------------------------

// 1. Generar HTML de Tarjeta (Modo Lectura)
function createCardHTML(item) {
    let cardClass = '', labelHTML = '', panelStyle = '', timeInfo = { text: 'Sin editar', diff: -1 };
    
    if (item.last_edited_timestamp) {
        timeInfo = timeAgo(item.last_edited_timestamp);
        if (timeInfo.diff >= 0 && timeInfo.diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent';
            labelHTML = '<div class="card-label" style="background-color: var(--acento-rojo); color: white; display: block;">!EDITADO RECIENTEMENTE¡</div>';
            panelStyle = `background: var(--tiempo-panel-rojo); color: var(--acento-rojo);`; 
        } else if (timeInfo.diff >= OLD_THRESHOLD_MS) {
            cardClass = 'card-old';
            labelHTML = '<div class="card-label" style="background-color: var(--acento-cian); color: var(--color-texto-principal); display: block;">Editado hace tiempo</div>';
            panelStyle = `background: var(--tiempo-panel-cian); color: var(--acento-cian);`;
        }
    }

    return `
    <div class="card ${cardClass}" data-id="${item.id}"> 
        ${labelHTML}
        <span class="emoji">${item.emoji}</span>
        <h3>${item.titulo}</h3>
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel" style="${panelStyle}">
            <strong>Actualizado</strong> (${timeInfo.text})
        </div>
    </div>`;
}

// 2. Generar HTML de Tarjeta (Modo Edición - REQ #1)
function createEditableCardHTML(item) {
    const emoji = item.emoji || '📝';
    const titulo = item.titulo || '';
    const contenido = item.contenido || '';
    
    return `
    <div class="card admin-mode" data-id="${item.id}" style="background: white; border: 1px solid #4f46e5; box-shadow: none;">
        <button class="delete-card-btn" data-action="delete-card" data-id="${item.id}">×</button>
        <input class="editable-emoji" value="${emoji}" maxlength="2">
        <input class="editable-title" value="${titulo}" placeholder="Título">
        <div class="card-content">
            <textarea class="editable-content" placeholder="Escribe aquí la información...">${contenido}</textarea>
        </div>
    </div>`;
}

async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data;
        renderCards();
    }
}

function renderCards() {
    DOM.contenedor.innerHTML = currentData.map(item => 
        admin ? createEditableCardHTML(item) : createCardHTML(item)
    ).join('');
}

// ----------------------------------------------------
// 🛡️ GESTIÓN MODO ADMIN
// ----------------------------------------------------

function toggleAdminMode() {
    if (!admin) {
        if(!confirm("⚠️ ¿Entrar en Modo Edición?")) return;
        admin = true;
        itemsToDelete.clear();
        
        document.body.classList.add('admin-mode');
        DOM.adminPanel.style.display = "flex";
        DOM.statusDataContainer.parentElement.classList.add('admin-mode');
        
        DOM.toggleAdminBtn.textContent = "🛑 SALIR SIN GUARDAR"; 
        DOM.toggleAdminBtn.style.backgroundColor = "var(--acento-rojo)";
        
        renderCards(); 
        renderStatusPanel(currentStatus, true);

    } else {
        if (confirm("⚠️ ¿Salir sin guardar los cambios?")) {
            admin = false;
            itemsToDelete.clear();
            document.body.classList.remove('admin-mode');
            DOM.adminPanel.style.display = "none";
            DOM.statusDataContainer.parentElement.classList.remove('admin-mode');
            
            DOM.toggleAdminBtn.textContent = "🛡️ ACTIVAR EL MODO EDICIÓN"; 
            DOM.toggleAdminBtn.style.backgroundColor = "#4f46e5";
            
            loadData(); 
            loadStatusData();
        }
    }
}

// REQ #3: Añadir Tarjeta Vacía
function addNewCard() {
    const tempId = 'new_' + Date.now(); 
    const newItem = { id: tempId, titulo: '', contenido: '', emoji: '📝' };
    currentData.push(newItem);
    
    const div = document.createElement('div');
    div.innerHTML = createEditableCardHTML(newItem);
    DOM.contenedor.appendChild(div.firstElementChild);
    div.firstElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// REQ #2: Lógica de Borrado
function markCardForDeletion(cardId, cardElement) {
    if (confirm("🗑️ ¿Eliminar esta tarjeta?\n(Se borrará definitivamente al Guardar Cambios)")) {
        if (!cardId.toString().startsWith('new_')) {
            itemsToDelete.add(cardId);
        } else {
            currentData = currentData.filter(i => i.id !== cardId);
        }
        cardElement.remove(); 
    }
}

async function saveChanges() {
    if (!admin) return;
    const btn = document.getElementById('saveBtn');
    btn.disabled = true; btn.textContent = "Guardando...";

    try {
        // 1. Borrados
        if (itemsToDelete.size > 0) {
            await supabase.from('items').delete().in('id', Array.from(itemsToDelete));
        }

        // 2. Updates / Inserts
        const cards = document.querySelectorAll('.card');
        const updates = [];
        const inserts = [];
        const now = new Date().toISOString();

        cards.forEach(card => {
            const id = card.dataset.id;
            const emoji = card.querySelector('.editable-emoji').value;
            const titulo = card.querySelector('.editable-title').value;
            const contenido = card.querySelector('.editable-content').value;

            if (id.startsWith('new_')) {
                inserts.push({ emoji, titulo, contenido, last_edited_timestamp: now });
            } else {
                const original = currentData.find(i => i.id == id);
                if (original && (original.emoji !== emoji || original.titulo !== titulo || original.contenido !== contenido)) {
                    updates.push(supabase.from('items').update({ emoji, titulo, contenido, last_edited_timestamp: now }).eq('id', id));
                }
            }
        });

        if (inserts.length > 0) await supabase.from('items').insert(inserts);
        if (updates.length > 0) await Promise.all(updates);

        // 3. Estado
        const newDeficit = document.getElementById('editDeficit').value;
        if (newDeficit !== currentStatus.deficit_mw) {
            await supabase.from('status_data').update({ deficit_mw: newDeficit, deficit_edited_at: now }).eq('id', 1);
        }

        alert("✅ Cambios guardados correctamente.");
        location.reload();

    } catch (e) {
        console.error(e);
        alert("❌ Error al guardar.");
        btn.disabled = false; btn.textContent = "💾 Guardar Cambios";
    }
}

// ----------------------------------------------------
// 💰 API ELTOQUE & STATUS
// ----------------------------------------------------
async function fetchElToqueRates() {
    const lastUpdate = new Date(currentStatus.divisa_edited_at || 0).getTime();
    if ((Date.now() - lastUpdate) < CACHE_DURATION) return; 

    try {
        const res = await fetch("https://corsproxy.io/?" + encodeURIComponent(ELTOQUE_API_URL), {
            headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}` }
        });
        const data = await res.json();
        
        let usd = data.tasas?.USD || data.USD || '---';
        let eur = data.tasas?.EUR || data.tasas?.ECU || data.EUR || '---';
        
        if (usd !== '---' && eur !== '---') {
            const newTime = new Date().toISOString();
            currentStatus.dollar_cup = parseFloat(usd).toFixed(0);
            currentStatus.euro_cup = parseFloat(eur).toFixed(0);
            currentStatus.divisa_edited_at = newTime;
            
            renderStatusPanel(currentStatus, admin);
            await supabase.from('status_data').update({ 
                dollar_cup: currentStatus.dollar_cup, 
                euro_cup: currentStatus.euro_cup, 
                divisa_edited_at: newTime 
            }).eq('id', 1);
        }
    } catch (e) { console.error("API Error:", e); }
}

function renderStatusPanel(st, isAdmin) {
    const timeText = timeAgo(st.deficit_edited_at).text;
    DOM.lastEditedTime.innerHTML = `Última edición:<br> ${timeText}`;

    if (isAdmin) {
        DOM.statusDataContainer.innerHTML = `
            <div class="status-item"><span class="label">Deficit (MW):</span><input type="text" id="editDeficit" value="${st.deficit_mw || ''}"></div>
            <div class="status-item"><span class="label">Dollar:</span><input type="text" value="${st.dollar_cup}" disabled></div>
            <div class="status-item"><span class="label">Euro:</span><input type="text" value="${st.euro_cup}" disabled></div>
        `;
    } else {
        DOM.statusDataContainer.innerHTML = `
            <div class="status-item deficit"><span class="label">🔌 Déficit:</span><span class="value">${st.deficit_mw || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💵 USD:</span><span class="value">${st.dollar_cup || '---'}</span></div>
            <div class="status-item divisa"><span class="label">💶 EUR:</span><span class="value">${st.euro_cup || '---'}</span></div>
        `;
    }
}

async function loadStatusData() {
    const { data } = await supabase.from('status_data').select('*').single();
    if (data) {
        currentStatus = { ...currentStatus, ...data };
        renderStatusPanel(currentStatus, admin);
        fetchElToqueRates();
    }
}

// ----------------------------------------------------
// 📰 NOTICIAS
// ----------------------------------------------------
async function loadNews() {
    const cutoff = Date.now() - RECENT_THRESHOLD_MS;
    const { data } = await supabase.from('noticias').select('*').order('timestamp', {ascending: false});
    
    let validNews = [];
    if(data) {
        data.forEach(n => {
            if (new Date(n.timestamp).getTime() > cutoff) validNews.push(n);
            else supabase.from('noticias').delete().eq('id', n.id);
        });
    }

    if (validNews.length > 0) {
        const html = validNews.map(n => `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`).join('<span class="news-item"> | </span>');
        DOM.newsTickerContent.innerHTML = `${html} <span class="news-item"> | </span> ${html}`;
        DOM.newsTicker.style.display = 'flex';
        
        const width = DOM.newsTickerContent.scrollWidth / 2;
        document.getElementById('dynamicTickerStyles').innerHTML = `@keyframes tick { 0% {transform:translateX(0);} 100% {transform:translateX(-${width}px);} }`;
        DOM.newsTickerContent.style.animation = `tick ${width / 50}s linear infinite`;
    } else {
        DOM.newsTicker.style.display = 'none';
    }
}

async function addQuickNews() {
    const text = prompt("✍️ Texto de la noticia para el cintillo:");
    if (text) {
        await supabase.from('noticias').insert([{ text: text.trim() }]);
        loadNews();
    }
}
async function deleteQuickNews() {
    const { data } = await supabase.from('noticias').select('*').limit(5).order('timestamp', {ascending:false});
    if(!data || !data.length) return alert("No hay noticias");
    const msg = data.map((n,i) => `${i+1}. ${n.text}`).join('\n');
    const idx = prompt(`Número a borrar:\n${msg}`) - 1;
    if(data[idx]) {
        await supabase.from('noticias').delete().eq('id', data[idx].id);
        loadNews();
    }
}

// ----------------------------------------------------
// 💬 COMENTARIOS (RESTAURADO Y OPTIMIZADO)
// ----------------------------------------------------

// Crear HTML de un comentario
function createCommentHTML(comment, isLiked) {
    const color = generateColorByName(comment.name);
    const likeClass = isLiked ? 'liked' : '';
    const itemClass = comment.parent_id ? 'reply-item' : 'comment-item'; // Estilos distintos
    
    return `
        <div class="${itemClass}" data-id="${comment.id}" style="--comment-color: ${color};">
            <strong class="comment-name">${comment.name}</strong>
            <div class="comment-content">${comment.text}</div>
            
            <div class="comment-actions">
                <button class="like-button ${likeClass}" data-action="like" data-id="${comment.id}"><span class="heart">♥</span></button>
                <span class="like-count" data-id="${comment.id}">${comment.likes_count || 0}</span>
                <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                ${!comment.parent_id ? `<span class="reply-form-toggle" data-action="toggle-reply" data-id="${comment.id}">Responder</span>` : ''}
            </div>

            ${!comment.parent_id ? `
                <div class="reply-form" id="reply-form-${comment.id}">
                    <input type="text" class="reply-name" placeholder="Tu Nombre" maxlength="30">
                    <textarea class="reply-text" placeholder="Tu Respuesta (máx. 250)" maxlength="250"></textarea>
                    <button class="pub-reply-btn" data-action="pub-reply" data-id="${comment.id}">Enviar Respuesta</button>
                </div>
                <div class="replies-container" id="replies-${comment.id}"></div>
            ` : ''}
        </div>`;
}

async function loadComments() {
    // Carga paralela de comentarios y likes
    const [commentsRes, likesRes] = await Promise.all([
        supabase.from('comentarios').select('*').order('timestamp', { ascending: false }),
        supabase.from('likes').select('comment_id').eq('user_web_id', userWebId)
    ]);
    
    if (commentsRes.error) return DOM.commentsContainer.innerHTML = `<p style="text-align:center;color:red">Error cargando.</p>`;
    
    const allComments = commentsRes.data || [];
    const userLikes = new Set(likesRes.data ? likesRes.data.map(l => l.comment_id) : []);
    
    // Separar padres y respuestas
    const parents = allComments.filter(c => c.parent_id === null);
    const repliesMap = allComments.reduce((map, c) => {
        if (c.parent_id) {
            if (!map.has(c.parent_id)) map.set(c.parent_id, []);
            map.get(c.parent_id).push(c);
        }
        return map;
    }, new Map());

    if (parents.length === 0) {
        DOM.commentsContainer.innerHTML = `<p style="text-align:center;color:#999">Sé el primero en comentar.</p>`;
        return;
    }

    // Renderizar padres
    DOM.commentsContainer.innerHTML = parents.map(c => createCommentHTML(c, userLikes.has(c.id))).join('');

    // Insertar respuestas en sus padres (ordenadas por fecha antigua primero para leer en orden)
    parents.forEach(p => {
        const replies = repliesMap.get(p.id);
        if (replies) {
            const container = document.getElementById(`replies-${p.id}`);
            replies.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            container.innerHTML = replies.map(r => createCommentHTML(r, userLikes.has(r.id))).join('');
            
            if(replies.length > 0) {
                container.style.display = 'block'; 
                container.classList.add('expanded'); // Mostrar por defecto o usar lógica "Ver más"
            }
        }
    });
}

// PUBLICAR COMENTARIO PRINCIPAL
async function publishComment() {
    const name = DOM.commentName.value.trim();
    const text = DOM.commentText.value.trim();
    if (name.length < 2 || text.length < 3) return alert("Escribe un nombre y mensaje válidos.");
    
    DOM.pubCommentBtn.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, likes_count: 0 }]);
    
    if(!error) {
        DOM.commentName.value = ''; DOM.commentText.value = '';
        loadComments();
    } else alert("Error al publicar");
    
    DOM.pubCommentBtn.disabled = false;
}

// PUBLICAR RESPUESTA (HILO)
async function publishReply(parentId, btn) {
    const form = document.getElementById(`reply-form-${parentId}`);
    const name = form.querySelector('.reply-name').value.trim();
    const text = form.querySelector('.reply-text').value.trim();
    
    if (name.length < 2 || text.length < 3) return alert("Datos incompletos.");
    
    btn.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, parent_id: parentId, likes_count: 0 }]);
    
    if(!error) {
        form.style.display = 'none'; // Ocultar formulario
        loadComments(); // Recargar para ver la respuesta
    } else alert("Error al responder");
    
    btn.disabled = false;
}

// LIKE TOGGLE
async function toggleLike(commentId, btn) {
    const isLiked = btn.classList.contains('liked');
    const counter = document.querySelector(`.like-count[data-id="${commentId}"]`);
    btn.disabled = true;

    if (isLiked) {
        // Quitar Like
        await supabase.from('likes').delete().eq('comment_id', commentId).eq('user_web_id', userWebId);
        await supabase.rpc('decrement_likes', { row_id: commentId });
        btn.classList.remove('liked');
        counter.textContent = Math.max(0, parseInt(counter.textContent) - 1);
    } else {
        // Dar Like
        const { error } = await supabase.from('likes').insert([{ comment_id: commentId, user_web_id: userWebId }]);
        if (!error || error.code === '23505') { // Ignorar duplicados
            if(!error) await supabase.rpc('increment_likes', { row_id: commentId });
            btn.classList.add('liked');
            counter.textContent = parseInt(counter.textContent) + 1;
        }
    }
    btn.disabled = false;
}

// ----------------------------------------------------
// 🚀 INICIALIZACIÓN & EVENTOS (Delegación Centralizada)
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadStatusData();
    loadNews();
    loadComments();
    document.getElementById('fecha-actualizacion').textContent = new Date().toLocaleDateString();

    // Botones Generales
    DOM.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    document.getElementById('saveBtn').addEventListener('click', saveChanges);
    document.getElementById('addNewsBtn').addEventListener('click', addQuickNews);
    document.getElementById('deleteNewsBtn').addEventListener('click', deleteQuickNews);
    document.getElementById('addCardBtn').addEventListener('click', addNewCard);
    DOM.pubCommentBtn.addEventListener('click', publishComment);

    // DELEGACIÓN DE EVENTOS (El "Cerebro" que maneja clicks dinámicos)
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        
        // 1. Manejo de Tarjetas (Borrar y Panel Tiempo)
        if (target.closest('.card')) {
            const card = target.closest('.card');
            if (target.classList.contains('delete-card-btn')) {
                e.stopPropagation();
                markCardForDeletion(card.dataset.id, card);
                return;
            }
            // Panel tiempo solo en modo lectura y si no es link
            if (!admin && !target.closest('a')) {
                document.querySelectorAll('.card.show-time-panel').forEach(c => {
                    if (c !== card) c.classList.remove('show-time-panel');
                });
                card.classList.toggle('show-time-panel');
                if (card.classList.contains('show-time-panel')) setTimeout(() => card.classList.remove('show-time-panel'), 3000);
            }
        }

        // 2. Manejo de Comentarios (Delegado)
        // A. Toggle Responder
        if (target.dataset.action === 'toggle-reply') {
            const form = document.getElementById(`reply-form-${target.dataset.id}`);
            // Cierra otros abiertos
            document.querySelectorAll('.reply-form').forEach(f => { if(f !== form) f.style.display = 'none'; });
            form.style.display = form.style.display === 'block' ? 'none' : 'block';
        }
        
        // B. Publicar Respuesta
        if (target.dataset.action === 'pub-reply') {
            publishReply(target.dataset.id, target);
        }

        // C. Like
        if (target.closest('.like-button')) {
            const btn = target.closest('.like-button');
            toggleLike(btn.dataset.id, btn);
        }
    });
});
