// news_script.js - VERSIÓN ULTRA OPTIMIZADA
// ----------------------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----------------------------------------------------------------
// ⚡ ESTADO Y UTILIDADES
// ----------------------------------------------------------------
let isAdmin = false;
let newsData = [];

const DOM = {
    container: document.getElementById('newsBannersContainer'),
    adminPanel: document.getElementById('newsAdminPanel'),
    toggleBtn: document.getElementById('toggleNewsAdminBtn'),
    formSection: document.getElementById('bannerCreationSection'),
    titleInput: document.getElementById('bannerTitle'),
    contentInput: document.getElementById('bannerContent'),
    exitBtn: document.getElementById('exitAdminBtn')
};

const COLORS = ['#2ecc71', '#3498db', '#9b59b6', '#34495e', '#f1c40f', '#e67e22', '#e74c3c', '#1abc9c', '#f39c12', '#95a5a6'];
const URL_REGEX = /(\b(https?:\/\/[^\s]+|www\.[^\s]+)\b)/g;

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const linkify = (text) => text.replace(URL_REGEX, url => `<a href="${url.startsWith('http') ? url : 'http://' + url}" target="_blank" rel="noopener">${url}</a>`).replace(/\n/g, '<br>');
const formatDate = (date) => new Date(date).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

// ----------------------------------------------------------------
// 🎨 RENDERIZADO
// ----------------------------------------------------------------
function createCommentHtml(c, bannerId) {
    const isLiked = localStorage.getItem(`like_${c.id}`) === 'true';
    return `
        <div class="comment-item" data-id="${c.id}">
            <strong>${c.commenter_name}</strong> <small>(${new Date(c.created_at).toLocaleDateString()})</small>: ${c.comment_text}
            <div style="text-align: right; margin-top: 3px;">
                <button class="like-btn ${isLiked ? 'liked' : ''}" data-cid="${c.id}" data-bid="${bannerId}">❤️ ${c.likes || 0}</button>
            </div>
        </div>`;
}

function createBannerHtml(b) {
    const comments = b.comments ? b.comments.sort((x, y) => new Date(x.created_at) - new Date(y.created_at)) : [];
    const allCommentsHtml = comments.map(c => createCommentHtml(c, b.id)).join('');
    const firstComment = comments.length > 0 ? createCommentHtml(comments[0], b.id) : '';
    
    let btnText = comments.length > 1 ? `Ver ${comments.length - 1} comentarios más...` : (comments.length === 1 ? '1 comentario' : 'Sé el primero en comentar');
    if (comments.length > 1) btnText = `<button class="view-comments-btn" data-bid="${b.id}" data- expanded="false">${btnText}</button>`;

    const deleteBtn = `<button class="delete-banner-btn" style="display:${isAdmin ? 'block' : 'none'};" data-id="${b.id}">×</button>`;

    return `
        <article class="news-banner" style="background-color: ${b.color}" data-id="${b.id}">
            ${deleteBtn}
            <h2 class="banner-title">${b.title}</h2>
            <p class="banner-date">Publicado: ${formatDate(b.created_at)}</p>
            <div class="banner-text">${linkify(b.content)}</div>
            <div class="banner-footer">
                <div class="comment-controls">${btnText}</div>
                <div id="list-${b.id}" class="comments-list">${allCommentsHtml}</div>
                <div class="first-comment-wrap">${firstComment}</div>
                <div class="comment-form">
                    <input type="text" placeholder="Tu Nombre" class="c-name" maxlength="30">
                    <textarea placeholder="Comentario..." class="c-text" maxlength="250"></textarea>
                    <button class="pub-btn" data-bid="${b.id}">Comentar</button>
                </div>
            </div>
        </article>`;
}

async function loadBanners() {
    DOM.container.innerHTML = '<p style="text-align:center;margin:30px;color:#888">Cargando noticias...</p>';
    try {
        const { data, error } = await supabase.from('news_banners')
            .select('*, comments:banner_comments(*)').order('created_at', { ascending: false });
        
        if (error) throw error;
        newsData = data;
        DOM.container.innerHTML = data.length ? data.map(createBannerHtml).join('') : '<p style="text-align:center;margin:30px">No hay noticias aún.</p>';
    } catch (e) {
        console.error(e);
        DOM.container.innerHTML = '<p style="text-align:center;color:red">Error de conexión.</p>';
    }
}

// ----------------------------------------------------------------
// 🕹️ ACCIONES (ADMIN & USUARIO)
// ----------------------------------------------------------------
function toggleAdmin(forceExit = false) {
    isAdmin = forceExit ? false : !isAdmin;
    DOM.adminPanel.style.display = isAdmin ? 'flex' : 'none';
    DOM.toggleBtn.style.display = isAdmin ? 'none' : 'block';
    DOM.formSection.style.display = 'none'; // Reset form visibility
    
    // Actualizar visibilidad de botones de eliminar sin recargar todo
    document.querySelectorAll('.delete-banner-btn').forEach(b => b.style.display = isAdmin ? 'block' : 'none');
}

async function handlePublish() {
    const title = DOM.titleInput.value.trim();
    const content = DOM.contentInput.value.trim();
    if (title.length < 5 || content.length < 10) return alert('Título (5+) y contenido (10+) requeridos.');

    const { error } = await supabase.from('news_banners').insert([{ title, content, color: getRandomColor() }]);
    if (!error) {
        DOM.titleInput.value = ''; DOM.contentInput.value = '';
        DOM.formSection.style.display = 'none';
        loadBanners();
        alert('✅ Publicado.');
    } else alert('Error al publicar.');
}

async function handleDelete(id) {
    if (!isAdmin || !confirm('¿Eliminar noticia permanentemente?')) return;
    if (!(await supabase.from('news_banners').delete().eq('id', id)).error) {
        document.querySelector(`article[data-id="${id}"]`).remove();
    } else alert('Error al eliminar.');
}

async function handleComment(btn) {
    const container = btn.closest('.comment-form');
    const name = container.querySelector('.c-name').value.trim();
    const text = container.querySelector('.c-text').value.trim();
    const bannerId = btn.dataset.bid;

    if (name.length < 2 || text.length < 2) return alert('Escribe un nombre y comentario válido.');
    
    btn.disabled = true;
    const { error } = await supabase.from('banner_comments').insert([{ banner_id: bannerId, commenter_name: name, comment_text: text }]);
    if (!error) {
        await loadBanners(); // Recarga para ver el comentario ordenado
    } else alert('Error al comentar.');
    btn.disabled = false;
}

async function handleLike(btn) {
    const cid = btn.dataset.cid;
    const key = `like_${cid}`;
    const isLiked = localStorage.getItem(key) === 'true';
    const currentLikes = parseInt(btn.textContent.split(' ')[1]) || 0;
    
    // UI Optimista (actualiza antes de la BD)
    const newLikes = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    btn.innerHTML = `❤️ ${newLikes}`;
    btn.classList.toggle('liked');
    isLiked ? localStorage.removeItem(key) : localStorage.setItem(key, 'true');

    await supabase.from('banner_comments').update({ likes: newLikes }).eq('id', cid);
}

function toggleComments(btn) {
    const list = document.getElementById(`list-${btn.dataset.bid}`);
    const isExp = btn.dataset.expanded === 'true';
    list.classList.toggle('expanded', !isExp);
    list.nextElementSibling.style.display = isExp ? 'block' : 'none'; // Toggle first comment visibility
    
    const total = list.children.length; // Total real comments in list
    const count = total > 1 ? total - 1 : 0;
    
    btn.textContent = isExp ? `Ver ${count} comentarios más...` : 'Ocultar comentarios';
    btn.dataset.expanded = !isExp;
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
        if (t.classList.contains('view-comments-btn')) toggleComments(t);
    };
});
