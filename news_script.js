// news_script.js - VERSIÓN ULTRA OPTIMIZADA Y NEÓN
// ----------------------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Función para obtener un color fijo basado en el ID (para consistencia)
function getBannerColor(id) {
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % NEON_PALETTE.length;
    return NEON_PALETTE[index];
}

// ----------------------------------------------------------------
// ⚡ ESTADO Y UTILIDADES
// ----------------------------------------------------------------
let isAdmin = false;
let newsData = [];
let userWebId = localStorage.getItem('userWebId') || crypto.randomUUID();
localStorage.setItem('userWebId', userWebId);

const DOM = {
    container: document.getElementById('newsBannersContainer'),
    adminPanel: document.getElementById('newsAdminPanel'),
    toggleBtn: document.getElementById('toggleNewsAdminBtn'),
    formSection: document.getElementById('bannerCreationSection'),
    titleInput: document.getElementById('bannerTitle'),
    contentInput: document.getElementById('bannerContent'),
    exitBtn: document.getElementById('exitAdminBtn')
};

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date) + ' h';
}

function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

// ----------------------------------------------------------------
// ⚙️ LÓGICA DE BANNERS
// ----------------------------------------------------------------

// Modificada para inyectar el color neón en el título
function createBannerHTML(banner) {
    const neonColor = getBannerColor(banner.id);
    const isAdminDisplay = isAdmin ? '' : 'style="display:none;"';
    const commentsListHTML = createCommentsListHTML(banner);

    return `
    <div class="news-banner" data-id="${banner.id}">
        <div class="banner-header">
            <h3 class="banner-title" style="color: ${neonColor}; text-shadow: 0 0 10px ${neonColor}70">${banner.title}</h3>
            <p class="banner-date">Publicado: ${formatTimestamp(banner.timestamp)}</p>
            <button class="delete-banner-btn" data-id="${banner.id}" ${isAdminDisplay}>X</button>
        </div>
        <div class="banner-text">${linkify(banner.content)}</div>
        
        <div class="banner-footer">
            <div class="comment-controls">
                <button class="toggle-comments-btn" data-id="${banner.id}" data-expanded="false">
                    💬 Ver ${banner.comments_count || 0} Comentarios
                </button>
            </div>
            
            <div class="comments-list" id="comments-list-${banner.id}" data-list-id="${banner.id}">
                ${commentsListHTML}
            </div>

            <div class="comment-form">
                <input type="text" placeholder="Tu Nombre" class="commenter-name" data-id="${banner.id}" maxlength="30">
                <textarea placeholder="Escribe tu comentario (máx. 250)" class="comment-content" data-id="${banner.id}" maxlength="250"></textarea>
                <button class="pub-btn" data-id="${banner.id}">Publicar Comentario</button>
            </div>
        </div>
    </div>`;
}

async function loadBanners() {
    const { data, error } = await supabase
        .from('news_banners')
        .select(`
            *,
            news_comments (
                *,
                likes:comment_likes (count)
            )
        `)
        .order('timestamp', { ascending: false });

    if (error) {
        DOM.container.innerHTML = `<p style="text-align: center; color: #ef473a; margin: 30px;">❌ Error al cargar las noticias.</p>`;
        return;
    }

    newsData = data;
    DOM.container.innerHTML = data.map(createBannerHTML).join('');

    // Actualizar contadores de likes
    updateAllLikes();
}

async function handlePublish() {
    const title = DOM.titleInput.value.trim();
    const content = DOM.contentInput.value.trim();

    if (!title || !content || title.length < 5 || content.length < 10) {
        return alert("El título y el contenido deben ser más largos.");
    }

    if (!isAdmin) return alert("❌ No tienes permisos de administrador.");

    const btn = document.getElementById('publishBannerBtn');
    btn.disabled = true;

    const { error } = await supabase.from('news_banners').insert([{ title, content, comments_count: 0 }]);
    
    btn.disabled = false;
    if (error) {
        console.error(error);
        alert("❌ Error al publicar.");
    } else {
        alert("✅ Pancarta publicada con éxito.");
        DOM.titleInput.value = '';
        DOM.contentInput.value = '';
        DOM.formSection.style.display = 'none';
        loadBanners(); // Recargar para ver el nuevo banner
    }
}

async function handleDelete(id) {
    if (!isAdmin) return alert("❌ No tienes permisos de administrador.");
    if (!confirm("⚠️ ¿Estás seguro de que deseas ELIMINAR esta pancarta y todos sus comentarios?")) return;

    // Supabase está configurado para eliminar en cascada (primero comentarios, luego banner)
    const { error } = await supabase.from('news_banners').delete().eq('id', id);
    
    if (error) {
        console.error(error);
        alert("❌ Error al eliminar.");
    } else {
        alert("✅ Pancarta eliminada.");
        loadBanners();
    }
}

// ----------------------------------------------------------------
// 💬 LÓGICA DE COMENTARIOS
// ----------------------------------------------------------------

function createCommentsListHTML(banner) {
    if (!banner.news_comments || banner.news_comments.length === 0) {
        return `<p style="text-align: center; opacity: 0.8; margin: 10px;">Sé el primero en comentar.</p>`;
    }
    
    // Ordenar de más nuevo a más antiguo
    const comments = banner.news_comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return comments.map((comment, index) => {
        const likesCount = comment.likes.length > 0 ? comment.likes[0].count : 0;
        const isFirst = index === 0;
        const displayStyle = isFirst ? 'block' : 'none';

        return `
            <div class="comment-item ${isFirst ? 'first-comment-wrap' : ''}" data-comment-id="${comment.id}" style="display: ${displayStyle};">
                <small>${formatTimestamp(comment.timestamp)}</small>
                <strong>${comment.name}</strong>
                <p>${comment.text}</p>
                <button class="like-btn" data-comment-id="${comment.id}">
                    <span class="heart">♥</span> <span class="like-count" data-count-id="${comment.id}">${likesCount}</span>
                </button>
            </div>`;
    }).join('');
}

function toggleComments(btn, bannerId) {
    const list = document.getElementById(`comments-list-${bannerId}`);
    const isExpanded = btn.dataset.expanded === 'true';

    // Obtener todos los comentarios (los que están ocultos también)
    const allComments = list.querySelectorAll('.comment-item');
    const total = allComments.length;

    list.classList.toggle('expanded', !isExpanded);
    btn.dataset.expanded = !isExpanded;

    if (!isExpanded) {
        // Expandir: Mostrar todos los comentarios
        allComments.forEach(comment => { comment.style.display = 'block'; });
        btn.textContent = `▲ Ocultar ${total} Comentarios`;
    } else {
        // Colapsar: Ocultar todo excepto el primero
        allComments.forEach((comment, index) => {
            comment.style.display = index === 0 ? 'block' : 'none';
        });
        const count = total > 0 ? total : 0;
        btn.textContent = `💬 Ver ${count} Comentarios`;
    }
}

async function handleComment(btn) {
    const bannerId = btn.dataset.id;
    const nameInput = document.querySelector(`.commenter-name[data-id="${bannerId}"]`);
    const contentInput = document.querySelector(`.comment-content[data-id="${bannerId}"]`);
    
    const name = nameInput.value.trim();
    const text = contentInput.value.trim();

    if (!name || !text || name.length < 2 || text.length < 5) {
        return alert("Por favor, introduce un nombre (min. 2) y un comentario (min. 5).");
    }

    btn.disabled = true;

    const { error } = await supabase.from('news_comments').insert([{ banner_id: bannerId, name, text, likes_count: 0 }]);
    
    btn.disabled = false;

    if (error) {
        console.error(error);
        alert("❌ Error al publicar el comentario.");
    } else {
        // Incrementar el contador de comentarios en el banner
        await supabase.rpc('increment_comments', { row_id: bannerId });
        
        nameInput.value = '';
        contentInput.value = '';
        alert("✅ Comentario publicado.");
        loadBanners(); // Recargar para mostrar el nuevo comentario
    }
}

// ----------------------------------------------------------------
// ❤️ LIKES
// ----------------------------------------------------------------

async function updateAllLikes() {
    const { data: likesData } = await supabase.from('comment_likes').select('comment_id').eq('user_web_id', userWebId);
    const userLikesMap = new Map();
    if (likesData) likesData.forEach(like => userLikesMap.set(like.comment_id, true));

    document.querySelectorAll('.like-btn').forEach(btn => {
        const commentId = btn.dataset.commentId;
        if (userLikesMap.get(commentId)) {
            btn.classList.add('liked');
        } else {
            btn.classList.remove('liked');
        }
    });
}

async function handleLike(btn) {
    const commentId = btn.dataset.commentId;
    const isLiked = btn.classList.contains('liked');
    const counter = document.querySelector(`.like-count[data-count-id="${commentId}"]`);
    
    if (!counter) return; 

    btn.disabled = true;

    try {
        if (isLiked) {
            // Eliminar like
            await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_web_id', userWebId);
            await supabase.rpc('decrement_comment_likes', { row_id: commentId });
            
            btn.classList.remove('liked');
            counter.textContent = Math.max(0, parseInt(counter.textContent) - 1);
        } else {
            // Añadir like
            const { error } = await supabase.from('comment_likes').insert([{ comment_id: commentId, user_web_id: userWebId }]);
            
            // Si no hay error O el error es duplicado (23505), incrementamos el contador
            if (!error || error.code === '23505') { 
                if (!error) await supabase.rpc('increment_comment_likes', { row_id: commentId }); 
                btn.classList.add('liked'); 
                counter.textContent = parseInt(counter.textContent) + 1; 
            } else {
                console.error("Error al dar like:", error);
            }
        }
    } catch (e) {
        console.error("Error en la operación de like:", e);
    }
    btn.disabled = false;
}


// ----------------------------------------------------------------
// 🛡️ LÓGICA DE ADMINISTRADOR
// ----------------------------------------------------------------

function toggleAdmin(forceExit = false) {
    if (forceExit || isAdmin) {
        if (!forceExit && !confirm("¿Salir del modo edición?")) return;
        isAdmin = false;
        DOM.adminPanel.style.display = 'none';
        DOM.toggleBtn.textContent = '🛡️ ACTIVAR EDICIÓN';
        DOM.toggleBtn.classList.add('primary-admin-btn');
        DOM.toggleBtn.classList.remove('btn-danger'); // Clase antigua
        DOM.formSection.style.display = 'none'; // Ocultar formulario de creación
        // Ocultar botones de eliminar en todos los banners
        document.querySelectorAll('.delete-banner-btn').forEach(btn => btn.style.display = 'none');
    } else {
        isAdmin = true;
        DOM.adminPanel.style.display = 'flex';
        DOM.toggleBtn.textContent = '🛑 MODO EDICIÓN ACTIVO';
        DOM.toggleBtn.classList.remove('primary-admin-btn');
        DOM.toggleBtn.classList.add('btn-danger'); // Usamos una clase de color rojo
        // Mostrar botones de eliminar en todos los banners
        document.querySelectorAll('.delete-banner-btn').forEach(btn => btn.style.display = 'flex');
    }
}

// ----------------------------------------------------------------
// 🚀 INICIALIZACIÓN
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadBanners();

    // Listeners Estáticos
    DOM.toggleBtn.onclick = () => toggleAdmin();
    if (DOM.exitBtn) DOM.exitBtn.onclick = () => toggleAdmin(true);
    document.getElementById('addBannerBtn').onclick = () => DOM.formSection.style.display = 'block';
    document.getElementById('cancelBannerBtn').onclick = () => DOM.formSection.style.display = 'none';
    document.getElementById('publishBannerBtn').onclick = handlePublish;

    // Listener Delegado (Un solo oído para todo el contenedor)
    DOM.container.onclick = (e) => {
        const t = e.target;
        if (t.classList.contains('delete-banner-btn')) handleDelete(t.dataset.id);
        if (t.classList.contains('pub-btn')) handleComment(t);
        if (t.classList.contains('like-btn')) handleLike(t);
        if (t.classList.contains('toggle-comments-btn')) toggleComments(t, t.dataset.id);
    };
});
