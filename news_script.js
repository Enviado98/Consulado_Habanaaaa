// news_script.js - LÓGICA ANTIGUA (COMPATIBLE) CON DISEÑO NUEVO (NEÓN)
// ----------------------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----------------------------------------------------
// 🎨 PALETA DE COLORES NEÓN (Para el diseño nuevo)
// ----------------------------------------------------
const NEON_PALETTE = [
    '#00ffff', '#ff00ff', '#00ff00', '#ffff00', '#ff0099', 
    '#9D00FF', '#FF4D00', '#00E5FF', '#76ff03', '#ff1744'
];

function getBannerColor(id) {
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    return NEON_PALETTE[Math.abs(hash) % NEON_PALETTE.length];
}

// ----------------------------------------------------------------
// ⚡ ESTADO Y DOM
// ----------------------------------------------------------------
let isAdmin = false;
const DOM = {
    container: document.getElementById('newsBannersContainer'),
    adminPanel: document.getElementById('newsAdminPanel'),
    toggleBtn: document.getElementById('toggleNewsAdminBtn'),
    formSection: document.getElementById('bannerCreationSection'),
    titleInput: document.getElementById('bannerTitle'),
    contentInput: document.getElementById('bannerContent'),
    exitBtn: document.getElementById('exitAdminBtn')
};

// Formato de fecha usando 'created_at' (tu columna real)
function formatTimestamp(timestamp) {
    if (!timestamp) return "Fecha desconocida";
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('es-ES', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit'
    }).format(date) + ' h';
}

function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

// ----------------------------------------------------------------
// ⚙️ RENDERIZADO (Adaptado a 'banner_comments' y 'created_at')
// ----------------------------------------------------------------

function createBannerHTML(banner) {
    const neonColor = getBannerColor(banner.id);
    const isAdminDisplay = isAdmin ? '' : 'style="display:none;"';
    
    // IMPORTANTE: Usamos 'comments' porque así lo pedimos en la query (ver loadBanners)
    const commentsList = banner.comments || []; 
    const commentsCount = commentsList.length;
    const commentsHTML = createCommentsListHTML(commentsList);

    // Mapeo de datos: banner.created_at (Antiguo) -> Diseño Nuevo
    return `
    <div class="news-banner" data-id="${banner.id}">
        <div class="banner-header">
            <h3 class="banner-title" style="color: ${neonColor}; text-shadow: 0 0 10px ${neonColor}70">${banner.title}</h3>
            <p class="banner-date">Publicado: ${formatTimestamp(banner.created_at)}</p>
            <button class="delete-banner-btn" data-id="${banner.id}" ${isAdminDisplay}>X</button>
        </div>
        <div class="banner-text">${linkify(banner.content)}</div>
        
        <div class="banner-footer">
            <div class="comment-controls">
                <button class="toggle-comments-btn" data-id="${banner.id}" data-expanded="false">
                    💬 Ver ${commentsCount} Comentarios
                </button>
            </div>
            
            <div class="comments-list" id="comments-list-${banner.id}">
                ${commentsHTML}
            </div>

            <div class="comment-form">
                <input type="text" placeholder="Tu Nombre" class="commenter-name" data-id="${banner.id}" maxlength="30">
                <textarea placeholder="Escribe tu comentario..." class="comment-content" data-id="${banner.id}" maxlength="250"></textarea>
                <button class="pub-btn" data-id="${banner.id}">Publicar</button>
            </div>
        </div>
    </div>`;
}

function createCommentsListHTML(comments) {
    if (!comments || comments.length === 0) {
        return `<p style="text-align: center; opacity: 0.8; margin: 10px;">Sé el primero en comentar.</p>`;
    }
    
    // Ordenar: El más nuevo arriba
    const sorted = comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return sorted.map((c, index) => {
        const isLiked = localStorage.getItem(`like_${c.id}`) === 'true';
        const likeClass = isLiked ? 'liked' : '';
        
        // IMPORTANTE: Usamos tus columnas antiguas: commenter_name, comment_text, created_at
        return `
            <div class="comment-item" style="display: ${index === 0 ? 'block' : 'none'};">
                <small>${formatTimestamp(c.created_at)}</small>
                <strong>${c.commenter_name}</strong>
                <p>${c.comment_text}</p>
                <button class="like-btn ${likeClass}" data-comment-id="${c.id}">
                    <span class="heart">♥</span> <span class="like-count">${c.likes || 0}</span>
                </button>
            </div>`;
    }).join('');
}

// ----------------------------------------------------------------
// ⚡ LÓGICA DE BASE DE DATOS (RESTUARADA A LA VERSIÓN ANTIGUA)
// ----------------------------------------------------------------

async function loadBanners() {
    // CONSULTA EXACTA DE LA VERSIÓN ANTIGUA
    // Pedimos 'news_banners' y unimos con 'banner_comments' usando el alias 'comments'
    const { data, error } = await supabase
        .from('news_banners')
        .select(`
            *,
            comments:banner_comments(*)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error cargando noticias:", error);
        DOM.container.innerHTML = `<p style="text-align: center; color: #ef473a; margin: 30px;">❌ Error de conexión: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        DOM.container.innerHTML = `<p style="text-align: center; color: white; margin: 30px;">No hay noticias publicadas.</p>`;
        return;
    }

    DOM.container.innerHTML = data.map(createBannerHTML).join('');
}

async function handlePublish() {
    const title = DOM.titleInput.value.trim();
    const content = DOM.contentInput.value.trim();

    if (!title || !content) return alert("Rellena título y contenido.");
    if (!isAdmin) return alert("Necesitas activar el modo edición.");

    const btn = document.getElementById('publishBannerBtn');
    btn.disabled = true;

    // INSERTAR EN 'news_banners' (Tu tabla antigua)
    // Agregamos 'color' para compatibilidad aunque usemos neón dinámico
    const { error } = await supabase.from('news_banners').insert([{ 
        title: title, 
        content: content,
        color: '#000000' // Valor dummy, el color lo pone el JS
    }]);
    
    btn.disabled = false;
    
    if (error) {
        console.error(error);
        alert("❌ Error al publicar.");
    } else {
        DOM.titleInput.value = '';
        DOM.contentInput.value = '';
        DOM.formSection.style.display = 'none';
        loadBanners();
        alert("✅ Noticia publicada.");
    }
}

async function handleDelete(id) {
    if (!isAdmin) return;
    if (!confirm("⚠️ ¿Eliminar esta noticia y sus comentarios?")) return;

    const { error } = await supabase.from('news_banners').delete().eq('id', id);
    
    if (error) {
        console.error(error);
        alert("❌ Error al eliminar.");
    } else {
        loadBanners();
    }
}

async function handleComment(btn) {
    const bannerId = btn.dataset.id;
    // Selectores ajustados al HTML nuevo
    const nameInput = document.querySelector(`.commenter-name[data-id="${bannerId}"]`);
    const contentInput = document.querySelector(`.comment-content[data-id="${bannerId}"]`);
    
    const name = nameInput.value.trim();
    const text = contentInput.value.trim();

    if (name.length < 2 || text.length < 2) return alert("Nombre o comentario muy cortos.");

    btn.disabled = true;
    btn.textContent = "...";

    // INSERTAR EN 'banner_comments' (Tu tabla antigua)
    // Usamos las columnas antiguas: commenter_name, comment_text
    const { error } = await supabase.from('banner_comments').insert([{ 
        banner_id: bannerId, 
        commenter_name: name, 
        comment_text: text,
        likes: 0
    }]);
    
    btn.disabled = false;
    btn.textContent = "Publicar";

    if (error) {
        console.error(error);
        alert("❌ Error al comentar.");
    } else {
        nameInput.value = '';
        contentInput.value = '';
        loadBanners();
    }
}

async function handleLike(btn) {
    const commentId = btn.dataset.commentId;
    const counter = btn.querySelector('.like-count');
    let currentLikes = parseInt(counter.textContent) || 0;
    
    const key = `like_${commentId}`;
    const isLiked = localStorage.getItem(key) === 'true';

    // Lógica simple de likes (Local + Integer Update) - Igual que versión antigua
    if (isLiked) {
        currentLikes = Math.max(0, currentLikes - 1);
        btn.classList.remove('liked');
        localStorage.removeItem(key);
    } else {
        currentLikes++;
        btn.classList.add('liked');
        localStorage.setItem(key, 'true');
    }
    counter.textContent = currentLikes;

    // Actualizar columna 'likes' en tabla 'banner_comments'
    await supabase.from('banner_comments')
        .update({ likes: currentLikes })
        .eq('id', commentId);
}

// ----------------------------------------------------------------
// 🛡️ INTERFAZ (VISIBILIDAD)
// ----------------------------------------------------------------

function toggleComments(btn) {
    const list = document.getElementById(`comments-list-${btn.dataset.id}`);
    const isExpanded = btn.dataset.expanded === 'true';
    const items = list.querySelectorAll('.comment-item');
    
    list.classList.toggle('expanded', !isExpanded);
    btn.dataset.expanded = !isExpanded;

    if (!isExpanded) {
        items.forEach(item => item.style.display = 'block');
        btn.textContent = `▲ Ocultar Comentarios`;
    } else {
        items.forEach((item, index) => item.style.display = index === 0 ? 'block' : 'none');
        btn.textContent = `💬 Ver ${items.length} Comentarios`;
    }
}

function toggleAdmin(forceExit = false) {
    if (forceExit || isAdmin) {
        isAdmin = false;
        DOM.adminPanel.style.display = 'none';
        DOM.toggleBtn.style.display = 'block';
        DOM.formSection.style.display = 'none';
        // Ocultar botones de borrar
        document.querySelectorAll('.delete-banner-btn').forEach(b => b.style.display = 'none');
    } else {
        isAdmin = true;
        DOM.adminPanel.style.display = 'flex';
        DOM.toggleBtn.style.display = 'none';
        // Mostrar botones de borrar
        document.querySelectorAll('.delete-banner-btn').forEach(b => b.style.display = 'flex');
    }
}

// ----------------------------------------------------------------
// 🚀 INICIALIZACIÓN
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadBanners();

    // Listeners de Admin
    DOM.toggleBtn.onclick = () => toggleAdmin();
    if (DOM.exitBtn) DOM.exitBtn.onclick = () => toggleAdmin(true);
    document.getElementById('addBannerBtn').onclick = () => DOM.formSection.style.display = 'block';
    document.getElementById('cancelBannerBtn').onclick = () => DOM.formSection.style.display = 'none';
    document.getElementById('publishBannerBtn').onclick = handlePublish;

    // Listener Global para elementos dinámicos (Banners y Comentarios)
    DOM.container.onclick = (e) => {
        // Busca el botón más cercano (por si el usuario hace click en el icono del corazón o texto)
        const t = e.target.closest('button'); 
        if (!t) return;
        
        if (t.classList.contains('delete-banner-btn')) handleDelete(t.dataset.id);
        if (t.classList.contains('pub-btn')) handleComment(t);
        if (t.classList.contains('like-btn')) handleLike(t);
        if (t.classList.contains('toggle-comments-btn')) toggleComments(t);
    };
});
