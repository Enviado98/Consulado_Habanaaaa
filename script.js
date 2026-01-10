import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ----------------------------------------------------
// ⚙️ CONFIGURACIÓN Y LLAVES (No compartir)
// ----------------------------------------------------
const SUPABASE_URL = "https://mkvpjsvqjqeuniabjjwr.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rdnBqc3ZxanFldW5pYWJqandyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI0MzU0OCwiZXhwIjoyMDgwODE5NTQ4fQ.No4ZOo0sawF6KYJnIrSD2CVQd1lHzNlLSplQgfuHBcg"; 

const ELTOQUE_API_URL = "https://tasas.eltoque.com/v1/trmi";
// Nota: Este token expira en el futuro. Si deja de funcionar, necesitarás uno nuevo.
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";

// Inicializamos Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------------
// 🎨 PALETA DE COLORES NEÓN (Para los títulos)
// ----------------------------------------------------
const NEON_PALETTE = [
    '#fb7185', // Rojo Rosado
    '#34d399', // Verde Esmeralda
    '#818cf8', // Indigo
    '#22d3ee', // Cian
    '#c084fc', // Violeta
    '#f472b6', // Rosa
    '#facc15'  // Amarillo
];

function getCardColor(id) {
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    const index = Math.abs(hash) % NEON_PALETTE.length;
    return NEON_PALETTE[index];
}

// ----------------------------------------------------
// 📦 VARIABLES GLOBALES Y ESTADO
// ----------------------------------------------------
let admin = false; // Estado local de admin (INSEGURO - Mejoraremos esto en el paso 4)
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos
const RECENT_THRESHOLD_MS = 24 * 3600000; // 24 horas para considerar algo "Nuevo"
const OLD_THRESHOLD_MS = 7 * 24 * 3600000; // 7 días para "Antiguo"

// Datos en memoria
let currentData = [];
let currentNews = []; 
let currentStatus = {
    deficit_mw: '...', dollar_cup: '...', euro_cup: '...', mlc_cup: '...',
    deficit_edited_at: null, divisa_edited_at: null
}; 

// Identificador de usuario para Likes (LocalStorage)
let userWebId = localStorage.getItem('userWebId');
if (!userWebId) {
    userWebId = crypto.randomUUID(); 
    localStorage.setItem('userWebId', userWebId);
}

// Referencias al DOM
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
// 🕒 UTILIDADES DE TIEMPO
// ----------------------------------------------------
function timeAgo(timestamp) {
    if (!timestamp) return { text: 'Sin fecha', diff: -1 };
    const diff = Date.now() - new Date(timestamp).getTime();
    
    const SECONDS = Math.floor(diff / 1000);
    const MINUTES = Math.floor(SECONDS / 60);
    const HOURS = Math.floor(MINUTES / 60);
    const DAYS = Math.floor(HOURS / 24);

    let text;
    if (diff < 60000) text = 'Hace un momento';
    else if (MINUTES < 60) text = `Hace ${MINUTES} min`;
    else if (HOURS < 24) text = `Hace ${HOURS} h`;
    else if (DAYS === 1) text = 'Ayer';
    else text = `Hace ${DAYS} días`;

    return { text, diff };
}

// ----------------------------------------------------
// 💵 API ELTOQUE (Economía)
// ----------------------------------------------------
async function fetchElToqueRates() {
    try {
        // Evitar llamadas excesivas (Caché simple)
        const lastUpdate = new Date(currentStatus.divisa_edited_at || 0).getTime();
        if ((Date.now() - lastUpdate) < CACHE_DURATION) return; 

        const proxyUrl = "https://corsproxy.io/?"; 
        const targetUrl = encodeURIComponent(ELTOQUE_API_URL);

        const response = await fetch(proxyUrl + targetUrl, {
            method: 'GET', 
            headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}`, 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Error API ElToque');
        
        const data = await response.json();
        
        // Lógica flexible para leer la respuesta de la API
        let usd = '---', eur = '---', mlc = '---';
        const tas = data.tasas || data; // A veces la estructura cambia
        
        if (tas) {
            usd = tas.USD || tas.usd || '---';
            eur = tas.EUR || tas.eur || tas.ECU || '---';
            mlc = tas.MLC || tas.mlc || '---';
        }

        // Actualizamos si hay datos válidos
        if (usd !== '---') {
            const now = new Date().toISOString();
            currentStatus.dollar_cup = parseFloat(usd).toFixed(0);
            currentStatus.euro_cup = parseFloat(eur).toFixed(0);
            currentStatus.mlc_cup = parseFloat(mlc).toFixed(0);
            currentStatus.divisa_edited_at = now;
            
            renderStatusPanel();
            // Guardamos en Supabase para que otros usuarios vean el dato rápido sin llamar a la API
            await supabase.from('status_data').update({ 
                dollar_cup: currentStatus.dollar_cup, 
                euro_cup: currentStatus.euro_cup, 
                mlc_cup: currentStatus.mlc_cup, 
                divisa_edited_at: now 
            }).eq('id', 1);
        }
    } catch (error) { 
        console.warn("⚠️ No se pudo actualizar ElToque:", error); 
    }
}

// ----------------------------------------------------
// 🖥️ RENDERIZADO (UI)
// ----------------------------------------------------

// 1. Panel de Estado (Déficit y Divisas)
function renderStatusPanel() {
    if (admin) {
        DOM.statusDataContainer.innerHTML = `
            <div class="status-item"><span class="label">Déficit (MW)</span><input type="text" id="editDeficit" value="${currentStatus.deficit_mw || ''}" style="width:80px"></div>
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

// 2. Tarjetas Principales
function createCardHTML(item, index) {
    let labelHTML = '';
    let timeInfo = { text: 'Sin actualizar', diff: -1 };
    let cardClass = '';

    if (item.last_edited_timestamp) {
        timeInfo = timeAgo(item.last_edited_timestamp);
        if (timeInfo.diff >= 0 && timeInfo.diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent';
            labelHTML = '<div class="card-label">¡NUEVO!</div>';
        } else if (timeInfo.diff >= OLD_THRESHOLD_MS) {
            cardClass = 'card-old';
            labelHTML = '<div class="card-label">ANTIGUO</div>';
        }
    }

    const neonColor = getCardColor(item.id);

    return `
    <div class="card ${cardClass}" data-index="${index}" data-id="${item.id}">
        ${labelHTML}
        <span class="emoji">${item.emoji}</span>
        <h3 style="--card-neon: ${neonColor}">${item.titulo}</h3>
        
        <div class="card-content">
            <p>${item.contenido}</p>
        </div>

        <div class="card-time-panel">
            <strong>Actualizado:</strong> ${timeInfo.text}
        </div>
    </div>`;
}

// 3. Renderizado de Tarjetas
function renderCards() {
    DOM.contenedor.innerHTML = currentData.map((item, i) => createCardHTML(item, i)).join('');
    
    // Añadimos eventos a las nuevas tarjetas
    document.querySelectorAll('.card').forEach(card => {
        if (!admin) {
            card.addEventListener('click', (e) => {
                // Toggle para ver la fecha en móvil
                const current = e.currentTarget;
                document.querySelectorAll('.card').forEach(c => { if(c !== current) c.classList.remove('show-time-panel'); });
                current.classList.toggle('show-time-panel');
            });
        }
    });
}

// ----------------------------------------------------
// 🛡️ ADMINISTRACIÓN (Frontend)
// ----------------------------------------------------
function toggleAdminMode() {
    if (!admin) {
        const password = prompt("🔐 Contraseña de Admin (Temporal):");
        // NOTA: Esto es inseguro. En el paso 4 lo cambiaremos por login real.
        // Por ahora, cualquiera puede entrar si sabe que no hay contraseña real o si pones una simple.
        if (password === null) return; // Cancelado
        
        admin = true;
        DOM.body.classList.add('admin-mode');
        DOM.adminPanel.style.display = 'flex';
        DOM.toggleAdminBtn.textContent = '🛑 SALIR DE EDICIÓN';
        DOM.toggleAdminBtn.classList.replace('btn-primary', 'btn-danger');
        DOM.statusMessage.textContent = '⚠️ MODO EDICIÓN ACTIVO - Ten cuidado';
        DOM.statusMessage.style.color = 'var(--acento-rojo)';
        
        enableCardEditing();
        renderStatusPanel();
    } else {
        if (!confirm("¿Salir sin guardar cambios pendientes?")) return;
        
        admin = false;
        DOM.body.classList.remove('admin-mode');
        DOM.adminPanel.style.display = 'none';
        DOM.toggleAdminBtn.textContent = '🛡️ ACTIVAR MODO EDICIÓN';
        DOM.toggleAdminBtn.classList.replace('btn-danger', 'btn-primary');
        DOM.statusMessage.textContent = 'Activa modo edición para actualizar';
        DOM.statusMessage.style.color = 'var(--color-texto-secundario)';
        
        renderCards(); // Re-render para quitar inputs
        renderStatusPanel();
    }
}

function enableCardEditing() {
    document.querySelectorAll(".card").forEach(card => {
        const idx = card.getAttribute('data-index');
        const item = currentData[idx];
        const contentDiv = card.querySelector('.card-content');

        // Limpiamos visualización normal
        card.querySelector('.card-time-panel').style.display = 'none';
        card.querySelector('h3').remove();
        card.querySelector('.emoji').remove();
        contentDiv.innerHTML = '';

        // Inyectamos inputs
        const editEmoji = document.createElement('input'); 
        editEmoji.className = 'editable-emoji'; 
        editEmoji.value = item.emoji;
        
        const editTitle = document.createElement('input'); 
        editTitle.className = 'editable-title'; 
        editTitle.value = item.titulo;

        const editContent = document.createElement('textarea'); 
        editContent.className = 'editable-content'; 
        editContent.value = item.contenido;

        card.prepend(editTitle);
        card.prepend(editEmoji);
        contentDiv.appendChild(editContent);
    });
}

async function saveAllChanges() {
    if (!admin) return;
    
    // 1. Guardar tarjetas
    const updates = [];
    document.querySelectorAll(".card").forEach(card => {
        const id = card.dataset.id;
        const idx = card.dataset.index;
        
        const newEmoji = card.querySelector('.editable-emoji').value;
        const newTitle = card.querySelector('.editable-title').value;
        const newContent = card.querySelector('.editable-content').value;

        // Comparamos si hubo cambios
        if (newContent !== currentData[idx].contenido || 
            newTitle !== currentData[idx].titulo || 
            newEmoji !== currentData[idx].emoji) {
            
            updates.push(supabase.from('items').update({
                emoji: newEmoji,
                titulo: newTitle,
                contenido: newContent,
                last_edited_timestamp: new Date().toISOString()
            }).eq('id', id));
        }
    });

    // 2. Guardar Déficit
    const deficitInput = document.getElementById('editDeficit');
    if (deficitInput && deficitInput.value !== currentStatus.deficit_mw) {
        updates.push(supabase.from('status_data').update({
            deficit_mw: deficitInput.value,
            deficit_edited_at: new Date().toISOString()
        }).eq('id', 1));
    }

    if (updates.length > 0) {
        const btn = document.getElementById('saveBtn');
        btn.textContent = '⏳ Guardando...';
        await Promise.all(updates);
        alert("✅ Cambios guardados correctamente");
        location.reload();
    } else {
        alert("No detecté cambios.");
    }
}

// ----------------------------------------------------
// 🗞️ NOTICIAS (Ticker)
// ----------------------------------------------------
function linkify(text) {
    // Convierte URLs en enlaces clickeables de forma segura
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        const fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

async function loadNews() {
    const { data } = await supabase.from('noticias').select('*').order('timestamp', { ascending: false });
    
    if (data && data.length > 0) {
        // Filtramos noticias muy viejas (opcional, aquí las dejamos todas por ahora)
        currentNews = data;
        
        const newsHTML = data.map(n => 
            `<span class="news-item">${linkify(n.text)} <small>(${timeAgo(n.timestamp).text})</small></span>`
        ).join('<span class="news-item"> | </span>');

        // Duplicamos el contenido para el efecto infinito
        DOM.newsTickerContent.innerHTML = newsHTML + '<span class="news-item"> | </span>' + newsHTML;
        DOM.newsTicker.style.display = 'flex';

        // Calculamos velocidad de animación
        const width = DOM.newsTickerContent.scrollWidth / 2;
        const duration = width / 50; // 50px por segundo
        DOM.dynamicStyles.innerHTML = `
            @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-${width}px); } }
            .news-ticker-content { animation: ticker ${duration}s linear infinite; }
        `;
    }
}

// Operaciones de Noticias (Admin)
async function addNews() {
    const text = prompt("Escribe la noticia:");
    if (text) {
        await supabase.from('noticias').insert([{ text }]);
        loadNews();
    }
}

async function deleteNews() {
    if (currentNews.length === 0) return alert("No hay noticias.");
    const list = currentNews.map((n, i) => `${i+1}. ${n.text}`).join('\n');
    const idx = prompt(`Elige el número a borrar:\n${list}`);
    if (idx && currentNews[idx-1]) {
        if(confirm("¿Seguro?")) {
            await supabase.from('noticias').delete().eq('id', currentNews[idx-1].id);
            loadNews();
        }
    }
}

// ----------------------------------------------------
// 💬 COMENTARIOS
// ----------------------------------------------------
function generateAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 50%)`;
}

function createCommentDOM(comment, userLikesMap) {
    const isLiked = userLikesMap.has(comment.id);
    const initial = comment.name.charAt(0).toUpperCase();
    const color = generateAvatarColor(comment.name);
    
    // HTML del comentario
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
        
        ${!comment.parent_id ? `
            <div id="reply-box-${comment.id}" class="replies-container">
                <!-- Respuestas aquí -->
            </div>
            <div id="reply-form-${comment.id}" class="reply-form" style="display:none; margin-top:10px;">
                <input type="text" id="reply-name-${comment.id}" placeholder="Tu Nombre">
                <textarea id="reply-text-${comment.id}" placeholder="Respuesta..."></textarea>
                <button class="btn btn-sm btn-success" onclick="postReply('${comment.id}')">Enviar</button>
            </div>
        ` : ''}
    </div>`;
}

async function loadComments() {
    const { data: comments } = await supabase.from('comentarios').select('*').order('timestamp', { ascending: false });
    const { data: likes } = await supabase.from('likes').select('comment_id').eq('user_web_id', userWebId);
    
    const userLikesMap = new Set(likes?.map(l => l.comment_id));
    
    if (comments) {
        DOM.commentsContainer.innerHTML = '';
        const parents = comments.filter(c => !c.parent_id);
        const replies = comments.filter(c => c.parent_id).reverse(); // Ordenar respuestas cronológicamente

        if(parents.length === 0) DOM.commentsContainer.innerHTML = '<p style="text-align:center; opacity:0.5">Sé el primero en comentar.</p>';

        parents.forEach(p => {
            DOM.commentsContainer.innerHTML += createCommentDOM(p, userLikesMap);
            // Insertar respuestas
            const pReplies = replies.filter(r => r.parent_id === p.id);
            setTimeout(() => {
                const replyBox = document.getElementById(`reply-box-${p.id}`);
                if(replyBox) {
                    pReplies.forEach(r => replyBox.innerHTML += createCommentDOM(r, userLikesMap));
                }
            }, 0);
        });
    }
}

// Funciones globales para HTML (window binding)
window.toggleLike = async (id) => {
    const btn = document.querySelector(`button[onclick="toggleLike('${id}')"]`);
    const counter = document.getElementById(`likes-${id}`);
    const isLiked = btn.classList.contains('liked');
    
    // Optimistic UI update
    btn.classList.toggle('liked');
    const current = parseInt(counter.textContent);
    counter.textContent = isLiked ? current - 1 : current + 1;

    if (isLiked) {
        await supabase.from('likes').delete().eq('comment_id', id).eq('user_web_id', userWebId);
        await supabase.rpc('decrement_likes', { row_id: id });
    } else {
        await supabase.from('likes').insert([{ comment_id: id, user_web_id: userWebId }]);
        await supabase.rpc('increment_likes', { row_id: id });
    }
};

window.showReplyForm = (id) => {
    const form = document.getElementById(`reply-form-${id}`);
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

window.postReply = async (parentId) => {
    const name = document.getElementById(`reply-name-${parentId}`).value;
    const text = document.getElementById(`reply-text-${parentId}`).value;
    if(name && text) {
        await supabase.from('comentarios').insert([{ name, text, parent_id: parentId }]);
        loadComments();
    }
};

// Publicar Comentario Principal
document.getElementById('publishCommentBtn').addEventListener('click', async () => {
    const name = document.getElementById('commenterName').value;
    const text = document.getElementById('commentText').value;
    if(name && text) {
        await supabase.from('comentarios').insert([{ name, text }]);
        document.getElementById('commentText').value = '';
        loadComments();
    }
});

// ----------------------------------------------------
// 🚀 INICIALIZACIÓN
// ----------------------------------------------------
async function init() {
    // 1. Cargar datos básicos
    const { data: items } = await supabase.from('items').select('*').order('id');
    if (items) {
        currentData = items;
        renderCards();
    }

    // 2. Cargar estado (Deficit/Divisas)
    const { data: status } = await supabase.from('status_data').select('*').eq('id', 1).single();
    if (status) {
        currentStatus = { ...currentStatus, ...status };
        renderStatusPanel();
        fetchElToqueRates(); // Intenta actualizar si es viejo
    }

    // 3. Cargar dinámicos
    loadNews();
    loadComments();

    // 4. Contador de Visitas
    const todayKey = 'visit_' + new Date().toDateString();
    if (!localStorage.getItem(todayKey)) {
        await supabase.from('page_views').insert({});
        localStorage.setItem(todayKey, 'true');
    }
    const { count } = await supabase.from('page_views').select('*', { count: 'exact', head: true });
    document.getElementById('viewCounter').textContent = `👀 ${count ? count.toLocaleString() : '...'}`;
    document.getElementById('fecha-actualizacion').textContent = new Date().toLocaleDateString();

    // Event Listeners Admin
    DOM.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    document.getElementById('saveBtn').addEventListener('click', saveAllChanges);
    document.getElementById('addNewsBtn').addEventListener('click', addNews);
    document.getElementById('deleteNewsBtn').addEventListener('click', deleteNews);
}

// Arrancar motor
init();
