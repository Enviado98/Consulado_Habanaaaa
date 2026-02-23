// news_script.js - VERSION REPARADA USANDO LÓGICA DE EDICIÓN DIRECTA
// ----------------------------------------------------------------
const SUPABASE_URL = "https://mkvpjsvqjqeuniabjjwr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rdnBqc3ZxanFldW5pYWJqandyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI0MzU0OCwiZXhwIjoyMDgwODE5NTQ4fQ.No4ZOo0sawF6KYJnIrSD2CVQd1lHzNlLSplQgfuHBcg";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NEON_PALETTE = ['#00ffff', '#ff00ff', '#00ff00', '#ffff00', '#ff0099', '#9D00FF', '#FF4D00', '#00E5FF', '#76ff03', '#ff1744'];

function getBannerColor(id) {
    let hash = 0; const str = String(id);
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    return NEON_PALETTE[Math.abs(hash) % NEON_PALETTE.length];
}

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

// ----------------------------------------------------------------
// ⚡ FUNCIÓN DE LIKE CORREGIDA (Copiada de lógica de edición)
// ----------------------------------------------------------------
async function handleLike(btn) {
    const commentId = btn.dataset.commentId;
    
    // Si ya dio like en esta sesión, no hacer nada
    if (localStorage.getItem(`liked_comment_${commentId}`)) return;

    const counter = btn.querySelector('.like-count');
    let currentLikes = parseInt(counter.textContent) || 0;
    let newLikes = currentLikes + 1;

    // APLICAMOS LA MISMA LÓGICA QUE USAS PARA EDITAR TARJETAS:
    // 1. Actualización visual
    counter.textContent = newLikes;
    btn.classList.add('liked');
    btn.disabled = true;

    // 2. Guardar en DB usando .update() (Igual que en script.js con items)
    const { error } = await supabase
        .from('banner_comments')
        .update({ likes: newLikes })
        .eq('id', commentId);

    if (error) {
        console.error("Error al actualizar likes:", error);
        // Si falla, volvemos atrás
        counter.textContent = currentLikes;
        btn.disabled = false;
    } else {
        // Si funciona, bloqueamos para que no vote más de una vez
        localStorage.setItem(`liked_comment_${commentId}`, 'true');
    }
}

// ----------------------------------------------------------------
// ⚙️ RENDERIZADO Y CARGA (Mantenemos tu diseño)
// ----------------------------------------------------------------

function formatTimestamp(ts) {
    if (!ts) return "Reciente";
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function createBannerHTML(banner) {
    const color = getBannerColor(banner.id);
    const comments = banner.comments || [];
    return `
    <div class="news-banner">
        <div class="banner-header">
            <h3 style="color: ${color}">${banner.title}</h3>
            <button class="delete-banner-btn" data-id="${banner.id}" style="${isAdmin ? '' : 'display:none'}">X</button>
        </div>
        <div class="banner-text">${banner.content}</div>
        <div class="banner-footer">
            <button class="toggle-comments-btn" data-id="${banner.id}">💬 Comentarios (${comments.length})</button>
            <div class="comments-list" id="comments-list-${banner.id}">
                ${comments.map(c => `
                    <div class="comment-item">
                        <strong>${c.commenter_name}</strong>
                        <p>${c.comment_text}</p>
                        <button class="like-btn ${localStorage.getItem(`liked_comment_${c.id}`) ? 'liked' : ''}" 
                                data-comment-id="${c.id}">
                            ♥ <span class="like-count">${c.likes || 0}</span>
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="comment-form">
                <input type="text" placeholder="Nombre" class="commenter-name" data-id="${banner.id}">
                <textarea placeholder="Comentario..." class="comment-content" data-id="${banner.id}"></textarea>
                <button class="pub-btn" data-id="${banner.id}">Enviar</button>
            </div>
        </div>
    </div>`;
}

async function loadBanners() {
    const { data, error } = await supabase.from('news_banners').select('*, comments:banner_comments(*)').order('created_at', { ascending: false });
    if (data) DOM.container.innerHTML = data.map(createBannerHTML).join('');
}

async function handleComment(btn) {
    const id = btn.dataset.id;
    const name = document.querySelector(`.commenter-name[data-id="${id}"]`).value;
    const text = document.querySelector(`.comment-content[data-id="${id}"]`).value;
    if (!name || !text) return;
    await supabase.from('banner_comments').insert([{ banner_id: id, commenter_name: name, comment_text: text, likes: 0 }]);
    loadBanners();
}

async function handlePublish() {
    const title = DOM.titleInput.value;
    const content = DOM.contentInput.value;
    await supabase.from('news_banners').insert([{ title, content }]);
    loadBanners();
    DOM.formSection.style.display = 'none';
}

async function handleDelete(id) {
    if (confirm("¿Borrar?")) {
        await supabase.from('news_banners').delete().eq('id', id);
        loadBanners();
    }
}

function toggleAdmin(exit = false) {
    isAdmin = exit ? false : !isAdmin;
    DOM.adminPanel.style.display = isAdmin ? 'flex' : 'none';
    DOM.toggleBtn.style.display = isAdmin ? 'none' : 'block';
    loadBanners();
}

document.addEventListener('DOMContentLoaded', () => {
    loadBanners();
    DOM.toggleBtn.onclick = () => toggleAdmin();
    if (DOM.exitBtn) DOM.exitBtn.onclick = () => toggleAdmin(true);
    document.getElementById('publishBannerBtn').onclick = handlePublish;
    document.getElementById('addBannerBtn').onclick = () => DOM.formSection.style.display = 'block';

    DOM.container.onclick = (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.classList.contains('like-btn')) handleLike(t);
        if (t.classList.contains('pub-btn')) handleComment(t);
        if (t.classList.contains('delete-banner-btn')) handleDelete(t.dataset.id);
        if (t.classList.contains('toggle-comments-btn')) {
            const list = document.getElementById(`comments-list-${t.dataset.id}`);
            list.style.display = list.style.display === 'block' ? 'none' : 'block';
        }
    };
});
