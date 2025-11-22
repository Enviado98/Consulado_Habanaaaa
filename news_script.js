// news_script.js - LÓGICA UNIFICADA DE COMENTARIOS
// ----------------------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----------------------------------------------------
// 🎨 PALETA DE COLORES NEÓN & COMENTARIOS UNIFICADOS
// ----------------------------------------------------
const NEON_PALETTE = [
    '#00ffff', '#ff00ff', '#00ff00', '#ffff00', '#ff0099', 
    '#9D00FF', '#FF4D00', '#00E5FF', '#76ff03', '#ff1744'
];

let isAdmin = false; 
let userWebId = localStorage.getItem('userWebId');
if (!userWebId) {
    userWebId = crypto.randomUUID(); 
    localStorage.setItem('userWebId', userWebId);
}

const DOM = {
    container: document.getElementById('newsBannersContainer'),
    toggleBtn: document.getElementById('toggleNewsAdminBtn'),
    exitBtn: document.getElementById('exitAdminBtn'),
    adminPanel: document.getElementById('newsAdminPanel'),
    formSection: document.getElementById('bannerCreationSection'),
    titleInput: document.getElementById('bannerTitle'),
    contentInput: document.getElementById('bannerContent'),
    publishBtn: document.getElementById('publishBannerBtn')
};

function getBannerColor(id) {
    let hash = 0;
    const str = String(id);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % NEON_PALETTE.length;
    return NEON_PALETTE[index];
}

function linkify(text) {
    return text.replace(/(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

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

// ----------------------------------------------------------------
// 🗣️ FUNCIONES DE COMENTARIO UNIFICADAS (Iguales a script.js)
// ----------------------------------------------------------------

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

    // Nota: Usamos 'comment-item' que está definido en styles.css
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
                        <button class="btn btn-sm btn-success publish-reply-btn" data-parent-id="${comment.id}" data-banner-id="${comment.banner_id}">Publicar Respuesta</button>
                    </div>
                    <div class="replies-container" data-parent-of="${comment.id}"></div>
                ` : ''}
            </div>
        </div>`;
}

function drawReplies(container, replies, userLikesMap) {
    container.innerHTML = ''; 
    replies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); 
    
    replies.forEach((reply) => {
        const isLiked = userLikesMap.get(reply.id) || false;
        container.insertAdjacentHTML('beforeend', createCommentHTML(reply, isLiked));
    });
}

function toggleReplyForm(event) {
    const id = event.target.getAttribute('data-id');
    const form = document.querySelector(`.reply-form[data-reply-to="${id}"]`);
    if (form) {
        document.querySelectorAll('.reply-form').forEach(f => { if(f !== form) f.style.display = 'none'; });
        
        const isVisible = form.style.display === 'block';
        form.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) form.querySelector('.reply-name').focus();
    }
}

async function handlePublishReply(event) {
    const parentId = event.target.getAttribute('data-parent-id');
    const bannerId = event.target.getAttribute('data-banner-id');
    const form = event.target.closest('.reply-form');
    const name = form.querySelector('.reply-name').value.trim();
    const text = form.querySelector('.reply-text').value.trim();
    
    if (name.length < 2 || text.length < 2) return alert("Escribe un nombre y mensaje válidos.");
    
    event.target.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, parent_id: parentId, banner_id: bannerId, likes_count: 0 }]);
    
    if (!error) {
        form.style.display = 'none';
        form.querySelector('.reply-name').value = '';
        form.querySelector('.reply-text').value = '';
        await loadCommentsForBanner(bannerId); // Recarga solo los comentarios de esta pancarta
    } else { alert("❌ Error al responder."); }
    event.target.disabled = false;
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
            if (!error || error.code === '23505') { 
                if (!error) await supabase.rpc('increment_likes', { row_id: id });
                btn.classList.add('liked');
                counter.textContent = parseInt(counter.textContent) + 1;
            }
        }
    } catch (e) { console.error(e); }
    btn.disabled = false;
}

function attachCommentListeners(containerElement) {
    containerElement.querySelectorAll('.reply-form-toggle').forEach(btn => {
        btn.onclick = (e) => toggleReplyForm(e);
    });
    containerElement.querySelectorAll('.publish-reply-btn').forEach(btn => {
        btn.onclick = (e) => handlePublishReply(e);
    });
    containerElement.querySelectorAll('.like-button').forEach(btn => {
        btn.onclick = (e) => handleLikeToggle(e);
    });
}

async function handlePublishComment(bannerId, formElement) {
    const name = formElement.querySelector('.comment-name').value.trim();
    const text = formElement.querySelector('.comment-text').value.trim();
    const publishBtn = formElement.querySelector('.pub-btn');

    if (name.length < 2 || text.length < 2) return alert("Escribe un nombre y mensaje válidos.");

    publishBtn.disabled = true;
    const { error } = await supabase.from('comentarios').insert([{ name, text, banner_id: bannerId, likes_count: 0 }]);
    
    if (!error) {
        formElement.querySelector('.comment-name').value = '';
        formElement.querySelector('.comment-text').value = '';
        await loadCommentsForBanner(bannerId);
    } else { alert("❌ Error al publicar."); }
    publishBtn.disabled = false;
}

async function loadCommentsForBanner(bannerId) {
    const bannerContainer = document.querySelector(`.banner-item[data-id="${bannerId}"]`);
    const commentsListContainer = bannerContainer.querySelector(`.comments-list[data-banner-id="${bannerId}"]`);
    
    if (!commentsListContainer) return;

    const [commentsResponse, likesResponse] = await Promise.all([
        supabase.from('comentarios').select('*').eq('banner_id', bannerId).order('timestamp', { ascending: false }),
        supabase.from('likes').select('comment_id').eq('user_web_id', userWebId)
    ]);

    if (commentsResponse.error) return commentsListContainer.innerHTML = `<p style="text-align: center; color: #d90429;">❌ Error al cargar comentarios.</p>`;
    
    const allComments = commentsResponse.data;
    const userLikesMap = new Map();
    if (likesResponse.data) likesResponse.data.forEach(like => userLikesMap.set(like.comment_id, true));
    
    const principalComments = allComments.filter(c => c.parent_id === null);
    const repliesMap = allComments.reduce((map, comment) => {
        if (comment.parent_id !== null) {
            if (!map.has(comment.parent_id)) map.set(comment.parent_id, []);
            map.get(comment.parent_id).push(comment);
        }
        return map;
    }, new Map());
    
    if (principalComments.length === 0) {
        commentsListContainer.innerHTML = `<p style="text-align: center; color: #999; font-size: 0.9rem; padding: 10px;">Sé el primero en comentar esta noticia.</p>`;
    } else {
        commentsListContainer.innerHTML = principalComments.map(c => createCommentHTML(c, userLikesMap.get(c.id))).join('');
        
        principalComments.forEach(comment => {
            const replies = repliesMap.get(comment.id);
            if (replies) {
                const container = document.querySelector(`.replies-container[data-parent-of="${comment.id}"]`);
                if (container) drawReplies(container, replies, userLikesMap);
            }
        });
    }

    // Volver a adjuntar listeners después de renderizar
    attachCommentListeners(commentsListContainer.closest('.banner-item'));
}

// ----------------------------------------------------------------
// 📢 LÓGICA DE BANNERS (Noticias)
// ----------------------------------------------------------------

function createBannerHTML(banner) {
    const neonColor = getBannerColor(banner.id);
    const linkedContent = linkify(banner.content);
    const commentsCount = banner.comments_count || 0;
    const isNew = (Date.now() - new Date(banner.timestamp).getTime()) < (7 * 24 * 60 * 60 * 1000); // Es nueva si tiene menos de 7 días

    return `
        <div class="banner-item" data-id="${banner.id}">
            <h2 style="--card-neon: ${neonColor}">${banner.title} ${isNew ? '<span class="new-tag">¡NUEVO!</span>' : ''}</h2>
            <div class="banner-meta">
                <span>📅 ${timeAgo(banner.timestamp).text}</span>
                ${isAdmin ? `<button class="delete-banner-btn btn-danger btn-sm" data-id="${banner.id}" style="display: flex;">❌ Borrar</button>` : ''}
            </div>
            
            <div class="banner-content">${linkedContent}</div>
            
            <div class="banner-actions">
                <button class="toggle-comments-btn btn btn-secondary btn-sm" data-id="${banner.id}">
                    🗣️ Ver Comentarios (${commentsCount})
                </button>
            </div>

            <div class="comments-container-wrap" data-id="${banner.id}" style="display: none;">
                <div class="comments-list" data-banner-id="${banner.id}">
                    <p style="text-align: center; color: #eee; margin: 15px;">Cargando comentarios...</p>
                </div>

                <div class="comment-form-container">
                    <input type="text" class="comment-name" placeholder="Tu Nombre" required maxlength="30">
                    <textarea class="comment-text" placeholder="Tu Comentario Principal (máx. 250 caracteres)" required maxlength="250"></textarea>
                    <button class="pub-btn btn btn-success" data-id="${banner.id}">Publicar Comentario</button>
                </div>
            </div>
        </div>
    `;
}

async function loadBanners() {
    const { data, error } = await supabase.from('banners').select('*').order('timestamp', { ascending: false });
    if (error) {
        DOM.container.innerHTML = `<p style="text-align: center; color: #d90429;">❌ Error al cargar noticias: ${error.message}</p>`;
        return;
    }
    DOM.container.innerHTML = data.map(createBannerHTML).join('');

    // Adjuntar los listeners de comentarios iniciales
    data.forEach(banner => {
        loadCommentsForBanner(banner.id); // Carga los datos de comentarios (pero el contenedor está oculto)
    });
}

function toggleComments(bannerId) {
    const wrap = document.querySelector(`.comments-container-wrap[data-id="${bannerId}"]`);
    if (wrap) {
        wrap.style.display = wrap.style.display === 'block' ? 'none' : 'block';
    }
}

async function handlePublish() {
    if (!isAdmin) return;
    const title = DOM.titleInput.value.trim();
    const content = DOM.contentInput.value.trim();
    if (title.length < 5 || content.length < 10) return alert("Título y contenido deben ser más largos.");
    
    DOM.publishBtn.disabled = true;
    const { error } = await supabase.from('banners').insert([{ title, content, comments_count: 0 }]);
    
    if (!error) {
        DOM.titleInput.value = '';
        DOM.contentInput.value = '';
        DOM.formSection.style.display = 'none';
        await loadBanners();
    } else {
        alert("Error al publicar la pancarta.");
    }
    DOM.publishBtn.disabled = false;
}

async function handleDelete(id) {
    if (!isAdmin || !confirm("¿Confirmar borrado de la pancarta? ¡Esto también borra todos los comentarios asociados!")) return;
    await supabase.from('comentarios').delete().eq('banner_id', id); // Borra comentarios asociados
    await supabase.from('banners').delete().eq('id', id);
    await loadBanners();
}

function toggleAdmin(forceExit = false) {
    if (forceExit && isAdmin) {
        if (!confirm("✅️ ¿Terminar la edición?")) return;
        isAdmin = false;
    } else if (!isAdmin) {
        isAdmin = true;
        alert("¡🔴 MODO EDICIÓN ACTIVO! Edita con responsabilidad.");
    } else { // Si ya está activo y no es forzar salida
        return;
    }
    
    if (isAdmin) {
        DOM.adminPanel.style.display = 'flex';
        DOM.toggleBtn.style.display = 'none';
        // Mostrar botones de borrar
        document.querySelectorAll('.delete-banner-btn').forEach(b => b.style.display = 'flex');
    } else {
        DOM.adminPanel.style.display = 'none';
        DOM.toggleBtn.style.display = 'block';
        DOM.formSection.style.display = 'none';
        // Ocultar botones de borrar
        document.querySelectorAll('.delete-banner-btn').forEach(b => b.style.display = 'none');
        loadBanners(); // Recargar para eliminar inputs de edición si los hubiese
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
    DOM.publishBtn.onclick = handlePublish;

    // Listener Global para elementos dinámicos (Banners y Comentarios)
    DOM.container.onclick = (e) => {
        const t = e.target.closest('button'); 
        if (!t) return;
        
        const bannerId = t.closest('.banner-item')?.dataset.id;
        if (!bannerId) return;

        if (t.classList.contains('delete-banner-btn')) handleDelete(t.dataset.id);
        
        // Manejo de comentarios por eventos delegados (para nuevos y respuestas)
        if (t.classList.contains('pub-btn')) {
            const form = t.closest('.comment-form-container');
            if(form) handlePublishComment(bannerId, form);
            return;
        }

        // Delegamos los likes y las respuestas al contenedor principal.
        if (t.classList.contains('like-button')) handleLikeToggle(e);
        if (t.classList.contains('reply-form-toggle')) toggleReplyForm(e);
        if (t.classList.contains('publish-reply-btn')) handlePublishReply(e);

        if (t.classList.contains('toggle-comments-btn')) toggleComments(bannerId);
    };
});
