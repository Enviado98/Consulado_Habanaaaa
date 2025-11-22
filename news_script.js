// news_script.js - VERSIÓN HÍBRIDA: DISEÑO MODERNO + BASE DE DATOS ANTIGUA
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

// Estado Global
let isAdmin = false; 

// Referencias DOM
const DOM = {
    container: document.getElementById('newsBannersContainer'),
    toggleBtn: document.getElementById('toggleNewsAdminBtn'),
    exitBtn: document.getElementById('exitAdminBtn'),
    adminPanel: document.getElementById('newsAdminPanel'),
    formSection: document.getElementById('bannerCreationSection'),
    titleInput: document.getElementById('bannerTitle'),
    contentInput: document.getElementById('bannerContent'),
    publishBtn: document.getElementById('publishBannerBtn'),
    addBannerBtn: document.getElementById('addBannerBtn'),
    cancelBannerBtn: document.getElementById('cancelBannerBtn')
};

// ----------------------------------------------------------------
// 🛠️ UTILIDADES
// ----------------------------------------------------------------

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

// Adaptado para usar 'created_at' de la DB antigua
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

function generateColorByName(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${hash % 360}, 70%, 50%)`; 
}

function getInitials(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

// ----------------------------------------------------------------
// 🗣️ RENDERING DE COMENTARIOS (ADAPTADO A ESTRUCTURA ANTIGUA)
// ----------------------------------------------------------------

function createCommentHTML(comment, isLiked) {
    // Mapeo de columnas antiguas a variables nuevas
    const name = comment.commenter_name; //
    const text = comment.comment_text;   //
    const likes = comment.likes || 0;    //
    const dateStr = comment.created_at;  //

    const color = generateColorByName(name);
    const initial = getInitials(name);
    const likeClass = isLiked ? 'liked' : '';
    const dateText = timeAgo(dateStr).text;

    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            <div class="comment-avatar" style="--comment-color: ${color};">${initial}</div>
            
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${name}</span>
                    <span class="comment-date">${dateText}</span>
                </div>
                
                <div class="comment-text">${text}</div>
                
                <div class="comment-actions">
                    <button class="action-btn like-button ${likeClass}" data-id="${comment.id}">
                        <span class="icon">♥</span> <span class="like-count" data-counter-id="${comment.id}">${likes}</span>
                    </button>
                    </div>
            </div>
        </div>`;
}

// ----------------------------------------------------------------
// ⚙️ LÓGICA DE COMENTARIOS POR BANNERS
// ----------------------------------------------------------------

async function loadCommentsForBanner(bannerId) {
    const bannerContainer = document.querySelector(`.banner-item[data-id="${bannerId}"]`);
    const commentsListContainer = bannerContainer.querySelector(`.comments-list[data-banner-id="${bannerId}"]`);
    
    if (!commentsListContainer) return;

    // CONSULTA A LA TABLA ANTIGUA 'banner_comments'
    const { data, error } = await supabase
        .from('banner_comments')
        .select('*')
        .eq('banner_id', bannerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error comments:", error);
        return commentsListContainer.innerHTML = `<p style="text-align: center; color: #d90429;">❌ Error: ${error.message}</p>`;
    }
    
    const allComments = data || [];
    
    // Renderizado (Sin hilos, lista plana para compatibilidad)
    if (allComments.length === 0) {
        commentsListContainer.innerHTML = `<p style="text-align: center; color: #eee; font-size: 0.9rem; padding: 10px;">Sé el primero en comentar esta noticia.</p>`;
    } else {
        // Verificamos likes locales (localStorage simple)
        commentsListContainer.innerHTML = allComments.map(c => {
            const isLiked = localStorage.getItem(`like_${c.id}`) === 'true';
            return createCommentHTML(c, isLiked);
        }).join('');
    }
    
    // Actualizar contador
    const toggleBtn = bannerContainer.querySelector('.toggle-comments-btn');
    if(toggleBtn) toggleBtn.textContent = `🗣️ Ver Comentarios (${allComments.length})`;
}

function toggleComments(bannerId) {
    const wrap = document.querySelector(`.comments-container-wrap[data-id="${bannerId}"]`);
    if (wrap) {
        const isHidden = wrap.style.display === 'none' || wrap.style.display === '';
        wrap.style.display = isHidden ? 'block' : 'none';
    }
}

async function handlePublishComment(bannerId, formElement) {
    const nameVal = formElement.querySelector('.comment-name').value.trim();
    const textVal = formElement.querySelector('.comment-text').value.trim();
    const publishBtn = formElement.querySelector('.pub-btn');

    if (nameVal.length < 2 || textVal.length < 2) return alert("Escribe un nombre y mensaje válidos.");

    publishBtn.disabled = true;
    
    // INSERTAR EN TABLA ANTIGUA 'banner_comments'
    const { error } = await supabase.from('banner_comments').insert([{ 
        banner_id: bannerId, 
        commenter_name: nameVal, // Columna antigua
        comment_text: textVal,   // Columna antigua
        likes: 0 
    }]);
    
    if (!error) {
        formElement.querySelector('.comment-name').value = '';
        formElement.querySelector('.comment-text').value = '';
        await loadCommentsForBanner(bannerId);
    } else { 
        console.error(error);
        alert("❌ Error al publicar: " + error.message); 
    }
    publishBtn.disabled = false;
}

async function handleLikeToggle(event) {
    const btn = event.currentTarget;
    const id = btn.getAttribute('data-id');
    const counter = btn.querySelector('.like-count');
    
    // Lógica simple de Likes (Local + Update Integer) compatible con DB antigua
    const key = `like_${id}`;
    const isLiked = localStorage.getItem(key) === 'true';
    let currentCount = parseInt(counter.textContent) || 0;

    btn.disabled = true;

    if (isLiked) {
        currentCount = Math.max(0, currentCount - 1);
        btn.classList.remove('liked');
        localStorage.removeItem(key);
    } else {
        currentCount++;
        btn.classList.add('liked');
        localStorage.setItem(key, 'true');
    }
    counter.textContent = currentCount;

    // Actualizar columna 'likes' en tabla 'banner_comments'
    await supabase.from('banner_comments').update({ likes: currentCount }).eq('id', id);
    
    btn.disabled = false;
}

// ----------------------------------------------------------------
// 📰 LÓGICA DE PANCARTAS (BANNERS)
// ----------------------------------------------------------------

function createBannerHTML(banner) {
    const neonColor = getBannerColor(banner.id);
    const linkedContent = linkify(banner.content);
    // Usar created_at
    const isNew = (Date.now() - new Date(banner.created_at).getTime()) < (7 * 24 * 60 * 60 * 1000);
    const deleteBtnStyle = isAdmin ? 'display: flex;' : 'display: none;';

    return `
        <div class="banner-item" data-id="${banner.id}">
            <button class="delete-banner-btn btn-danger" data-id="${banner.id}" style="${deleteBtnStyle}">×</button>
            
            <h2 style="--card-neon: ${neonColor}">
                ${banner.title} 
                ${isNew ? '<span class="new-tag">¡NUEVO!</span>' : ''}
            </h2>
            
            <div class="banner-meta">
                <span>📅 Publicado: ${timeAgo(banner.created_at).text}</span>
            </div>
            
            <div class="banner-content">${linkedContent}</div>
            
            <div class="banner-actions">
                <button class="toggle-comments-btn btn btn-secondary btn-sm" data-id="${banner.id}">
                    🗣️ Cargar Comentarios
                </button>
            </div>

            <div class="comments-container-wrap" data-id="${banner.id}">
                <div class="comment-form-container">
                    <input type="text" class="comment-name" placeholder="Tu Nombre" required maxlength="30">
                    <textarea class="comment-text" placeholder="Tu Comentario Principal (máx. 250 caracteres)" required maxlength="250"></textarea>
                    <button class="pub-btn btn btn-success" data-id="${banner.id}">Publicar Comentario</button>
                </div>

                <div class="comments-list" data-banner-id="${banner.id}">
                    <p style="text-align: center; color: #eee; margin: 15px;">Cargando...</p>
                </div>
            </div>
        </div>
    `;
}

async function loadBanners() {
    // CONSULTA A LA TABLA ANTIGUA 'news_banners'
    const { data, error } = await supabase
        .from('news_banners')
        .select('*')
        .order('created_at', { ascending: false }); // columna created_at

    if (error) {
        DOM.container.innerHTML = `<p style="text-align: center; color: #d90429;">❌ Error: ${error.message}</p>`;
        return;
    }
    if (!data || data.length === 0) {
        DOM.container.innerHTML = `<p style="text-align: center; color: white;">No hay noticias publicadas aún.</p>`;
        return;
    }

    DOM.container.innerHTML = data.map(createBannerHTML).join('');
    data.forEach(banner => loadCommentsForBanner(banner.id));
}

// ----------------------------------------------------------------
// 🛡️ ADMIN & EVENTOS
// ----------------------------------------------------------------

async function handlePublishBanner() {
    if (!isAdmin) return;
    const title = DOM.titleInput.value.trim();
    const content = DOM.contentInput.value.trim();
    
    if (title.length < 5 || content.length < 10) return alert("Título (min 5) y contenido (min 10) requeridos.");
    
    DOM.publishBtn.disabled = true;
    // INSERTAR EN TABLA ANTIGUA 'news_banners'
    // Nota: La DB antigua a veces pide 'color', enviamos dummy si es necesario, o dejamos que postgres ponga default
    const { error } = await supabase.from('news_banners').insert([{ 
        title, 
        content,
        color: '#ffffff' // Compatibilidad legacy
    }]);
    
    if (!error) {
        DOM.titleInput.value = '';
        DOM.contentInput.value = '';
        DOM.formSection.style.display = 'none';
        await loadBanners();
    } else {
        console.error(error);
        alert("Error al publicar: " + error.message);
    }
    DOM.publishBtn.disabled = false;
}

async function handleDeleteBanner(id) {
    if (!isAdmin || !confirm("¿Confirmar borrado de la pancarta?\n⚠️ ¡Esto también borra todos los comentarios asociados!")) return;
    
    // Borrar comentarios en 'banner_comments'
    await supabase.from('banner_comments').delete().eq('banner_id', id); 
    // Borrar noticia en 'news_banners'
    const { error } = await supabase.from('news_banners').delete().eq('id', id);
    
    if (!error) await loadBanners();
    else alert("Error al borrar.");
}

function toggleAdmin(forceExit = false) {
    if (forceExit && isAdmin) {
        if (!confirm("✅️ ¿Terminar la edición?")) return;
        isAdmin = false;
    } else if (!isAdmin) {
        isAdmin = true;
        alert("¡🔴 MODO EDICIÓN ACTIVO!");
    } else {
        return; 
    }
    
    if (isAdmin) {
        DOM.adminPanel.style.display = 'flex';
        DOM.toggleBtn.style.display = 'none';
        document.querySelectorAll('.delete-banner-btn').forEach(b => b.style.display = 'flex');
    } else {
        DOM.adminPanel.style.display = 'none';
        DOM.toggleBtn.style.display = 'block';
        DOM.formSection.style.display = 'none';
        document.querySelectorAll('.delete-banner-btn').forEach(b => b.style.display = 'none');
    }
}

// ----------------------------------------------------------------
// 🚀 INICIALIZACIÓN
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadBanners();

    DOM.toggleBtn.onclick = () => toggleAdmin();
    if (DOM.exitBtn) DOM.exitBtn.onclick = () => toggleAdmin(true);
    DOM.addBannerBtn.onclick = () => DOM.formSection.style.display = 'block';
    DOM.cancelBannerBtn.onclick = () => DOM.formSection.style.display = 'none';
    DOM.publishBtn.onclick = handlePublishBanner;

    DOM.container.onclick = (e) => {
        const target = e.target;
        const btn = target.closest('button'); 
        
        if (!btn) return;
        if (btn.classList.contains('delete-banner-btn')) { handleDeleteBanner(btn.dataset.id); return; }
        if (btn.classList.contains('toggle-comments-btn')) { toggleComments(btn.dataset.id); return; }
        if (btn.classList.contains('pub-btn')) {
            const form = btn.closest('.comment-form-container');
            const bannerId = btn.dataset.id;
            if(form && bannerId) handlePublishComment(bannerId, form);
            return;
        }
        if (btn.classList.contains('like-button')) { handleLikeToggle(e); return; }
    };
});
