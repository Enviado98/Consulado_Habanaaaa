// news_script.js - DISEÑO NEÓN CONECTADO A TU BASE DE DATOS ACTUAL
// ----------------------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----------------------------------------------------
// 🎨 PALETA DE COLORES NEÓN
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
// ⚡ ESTADO
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

// Función de formato adaptada a tu columna "created_at"
function formatTimestamp(timestamp) {
    if (!timestamp) return "Fecha desconocida";
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('es-ES', { 
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date) + ' h';
}

function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

// ----------------------------------------------------------------
// ⚙️ RENDERIZADO (Adaptado a tus tablas)
// ----------------------------------------------------------------

function createBannerHTML(banner) {
    const neonColor = getBannerColor(banner.id);
    const isAdminDisplay = isAdmin ? '' : 'style="display:none;"';
    
    // TU DB: usa 'banner_comments' en lugar de 'news_comments'
    // Y 'created_at' en lugar de 'timestamp'
    const comments = banner.banner_comments || []; 
    const commentsCount = comments.length;
    const commentsListHTML = createCommentsListHTML(comments, banner.id);

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
                ${commentsListHTML}
            </div>

            <div class="comment-form">
                <input type="text" placeholder="Tu Nombre" class="commenter-name" data-id="${banner.id}" maxlength="30">
                <textarea placeholder="Escribe tu comentario..." class="comment-content" data-id="${banner.id}" maxlength="250"></textarea>
                <button class="pub-btn" data-id="${banner.id}">Publicar</button>
            </div>
        </div>
    </div>`;
}

function createCommentsListHTML(comments, bannerId) {
    if (!comments || comments.length === 0) {
        return `<p style="text-align: center; opacity: 0.8; margin: 10px;">Sé el primero en comentar.</p>`;
    }
    
    // Ordenar por fecha (created_at)
    const sortedComments = comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return sortedComments.map((comment, index) => {
        const isLiked = localStorage.getItem(`like_${comment.id}`) === 'true';
        const likeClass = isLiked ? 'liked' : '';
        
        // TU DB: usa 'commenter_name' y 'comment_text'
        return `
            <div class="comment-item" style="display: ${index === 0 ? 'block' : 'none'};">
                <small>${formatTimestamp(comment.created_at)}</small>
                <strong>${comment.commenter_name}</strong>
                <p>${comment.comment_text}</p>
                <button class="like-btn ${likeClass}" data-comment-id="${comment.id}">
                    <span class="heart">♥</span> <span class="like-count">${comment.likes || 0}</span>
                </button>
            </div>`;
    }).join('');
}

// ----------------------------------------------------------------
// ⚡ LÓGICA (CRUD)
// ----------------------------------------------------------------

async function loadBanners() {
    // AQUÍ ESTABA EL ERROR: Ahora llamamos a 'banner_comments' y 'created_at'
    const { data, error } = await supabase
        .from('news_banners')
        .select(`
            *,
            banner_comments (*) 
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error Supabase:", error);
        DOM.container.innerHTML = `<p style="text-align: center; color: #ef473a; margin: 30px;">❌ Error cargando noticias.</p>`;
        return;
    }

    newsData = data;
    DOM.container.innerHTML = data.map(createBannerHTML).join('');
}

async function handlePublish() {
    const title = DOM.titleInput.value.trim();
    const content = DOM.contentInput.value.trim();

    if (!title || !content) return alert("Rellena todos los campos.");
    if (!isAdmin) return alert("Sin permisos.");

    const btn = document.getElementById('publishBannerBtn');
    btn.disabled = true;

    // TU DB: Insertamos título, contenido y un color aleatorio (si tu tabla lo requiere)
    const { error } = await supabase.from('news_banners').insert([{ 
        title, 
        content, 
        color: NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)] 
    }]);
    
    btn.disabled = false;
    if (error) {
        console.error(error);
        alert("❌ Error al publicar.");
    } else {
        DOM.titleInput.value = ''; DOM.contentInput.value = '';
        DOM.formSection.style.display = 'none';
        loadBanners();
    }
}

async function handleDelete(id) {
    if (!isAdmin) return;
    if (!confirm("⚠️ ¿Eliminar esta noticia?")) return;

    const { error } = await supabase.from('news_banners').delete().eq('id', id);
    if (!error) {
        loadBanners(); // Recargar
    } else {
        alert("Error al eliminar.");
    }
}

async function handleComment(btn) {
    const bannerId = btn.dataset.id;
    const nameInput = document.querySelector(`.commenter-name[data-id="${bannerId}"]`);
    const contentInput = document.querySelector(`.comment-content[data-id="${bannerId}"]`);
    
    const name = nameInput.value.trim();
    const text = contentInput.value.trim();

    if (name.length < 2 || text.length < 2) return alert("Escribe un nombre y mensaje válidos.");

    btn.disabled = true;

    // TU DB: Nombres de columnas antiguos
    const { error } = await supabase.from('banner_comments').insert([{ 
        banner_id: bannerId, 
        commenter_name: name, 
        comment_text: text,
        likes: 0
    }]);
    
    btn.disabled = false;

    if (error) {
        console.error(error);
        alert("❌ Error al comentar.");
    } else {
        nameInput.value = ''; contentInput.value = '';
        loadBanners();
    }
}

async function handleLike(btn) {
    const commentId = btn.dataset.commentId;
    const counter = btn.querySelector('.like-count');
    let currentLikes = parseInt(counter.textContent);
    
    const key = `like_${commentId}`;
    const isLiked = localStorage.getItem(key) === 'true';

    // UI Optimista (cambia al instante)
    if (isLiked) {
        currentLikes--;
        btn.classList.remove('liked');
        localStorage.removeItem(key);
    } else {
        currentLikes++;
        btn.classList.add('liked');
        localStorage.setItem(key, 'true');
    }
    counter.textContent = currentLikes;

    // Actualizar Base de Datos (Columna simple 'likes')
    await supabase.from('banner_comments')
        .update({ likes: currentLikes })
        .eq('id', commentId);
}

// ----------------------------------------------------------------
// 🛡️ UTILS
// ----------------------------------------------------------------
function toggleComments(btn) {
    const list = document.getElementById(`comments-list-${btn.dataset.id}`);
    const isExpanded = btn.dataset.expanded === 'true';
    const items = list.querySelectorAll('.comment-item');
    
    list.classList.toggle('expanded', !isExpanded);
    btn.dataset.expanded = !isExpanded;

    if (!isExpanded) {
        items.forEach(item => item.style.display = 'block'); // Mostrar todos
        btn.textContent = `▲ Ocultar Comentarios`;
    } else {
        items.forEach((item, index) => item.style.display = index === 0 ? 'block' : 'none'); // Solo el primero
        btn.textContent = `💬 Ver ${items.length} Comentarios`;
    }
}

function toggleAdmin(forceExit = false) {
    if (forceExit || isAdmin) {
        isAdmin = false;
        DOM.adminPanel.style.display = 'none';
        DOM.toggleBtn.style.display = 'block';
        DOM.formSection.style.display = 'none';
        document.querySelectorAll('.delete-banner-btn').forEach(btn => btn.style.display = 'none');
    } else {
        isAdmin = true;
        DOM.adminPanel.style.display = 'flex';
        DOM.toggleBtn.style.display = 'none';
        document.querySelectorAll('.delete-banner-btn').forEach(btn => btn.style.display = 'flex');
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadBanners();
    
    DOM.toggleBtn.onclick = () => toggleAdmin();
    if (DOM.exitBtn) DOM.exitBtn.onclick = () => toggleAdmin(true);
    document.getElementById('addBannerBtn').onclick = () => DOM.formSection.style.display = 'block';
    document.getElementById('cancelBannerBtn').onclick = () => DOM.formSection.style.display = 'none';
    document.getElementById('publishBannerBtn').onclick = handlePublish;

    DOM.container.onclick = (e) => {
        const t = e.target.closest('button'); // Detectar clicks en botones o iconos dentro
        if (!t) return;
        
        if (t.classList.contains('delete-banner-btn')) handleDelete(t.dataset.id);
        if (t.classList.contains('pub-btn')) handleComment(t);
        if (t.classList.contains('like-btn')) handleLike(t);
        if (t.classList.contains('toggle-comments-btn')) toggleComments(t);
    };
});
