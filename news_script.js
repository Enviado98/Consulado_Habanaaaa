// news_script.js - Lógica optimizada para el módulo de noticias
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configuración (Se mantiene igual por compatibilidad con tu backend actual)
const SUPABASE_URL = "https://ebihagvhgakvuoeoukbc.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaWhhZ3ZoZ2FrdnVvZW91a2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTM2MTEsImV4cCI6MjA4MDY4OTYxMX0.T3UNdA8bTSpDzLdNb19lTzifqLwfQPAp5fSyIVBECI8"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Paleta para títulos dinámicos
const TITLE_COLORS = ['#00ffff', '#ff00ff', '#00ff00', '#ffff00', '#ff0099', '#00E5FF'];

// Estado
let isAdminMode = false;

const DOM = {
    container: document.getElementById('newsBannersContainer'),
    adminTools: document.getElementById('newsAdminTools'),
    toggleBtn: document.getElementById('toggleNewsAdminBtn'),
    creationModal: document.getElementById('bannerCreationSection'),
    titleInput: document.getElementById('bannerTitle'),
    contentInput: document.getElementById('bannerContent'),
    exitBtn: document.getElementById('exitAdminBtn'),
    cancelBtn: document.getElementById('cancelBannerBtn')
};

// --- UTILIDADES ---
function getColorById(id) {
    const hash = String(id).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return TITLE_COLORS[hash % TITLE_COLORS.length];
}

// --- RENDERIZADO ---
function createBannerHTML(banner) {
    const comments = banner.comments || [];
    const color = getColorById(banner.id);
    const deleteBtn = isAdminMode 
        ? `<button class="delete-btn" data-id="${banner.id}" title="Borrar">X</button>` 
        : '';

    return `
    <article class="news-card">
        ${deleteBtn}
        <header class="card-header">
            <h3 style="color: ${color}">${banner.title}</h3>
        </header>
        
        <div class="card-content">${banner.content}</div>
        
        <footer class="card-footer">
            <button class="btn btn-sm btn-secondary toggle-comments" data-id="${banner.id}">
                💬 Ver Comentarios (${comments.length})
            </button>
            
            <div class="comments-feed" id="feed-${banner.id}" style="display:none;">
                ${comments.map(c => `
                    <div class="mini-comment">
                        <strong>${c.commenter_name}:</strong> ${c.comment_text}
                        <div style="text-align:right; font-size:0.7em;">
                            ❤️ ${c.likes || 0}
                        </div>
                    </div>
                `).join('')}
                
                <div class="card-input-row">
                    <input type="text" class="form-input name-input" data-id="${banner.id}" placeholder="Tu Nombre">
                    <textarea class="form-input text-input" data-id="${banner.id}" placeholder="Comenta..."></textarea>
                    <button class="btn btn-sm btn-success send-comment-btn" data-id="${banner.id}">Enviar</button>
                </div>
            </div>
        </footer>
    </article>`;
}

// --- LÓGICA DE DATOS ---
async function loadBanners() {
    DOM.container.innerHTML = '<div class="loader-text">Actualizando noticias...</div>';
    
    const { data, error } = await supabase
        .from('news_banners')
        .select('*, comments:banner_comments(*)')
        .order('created_at', { ascending: false });

    if (error) {
        DOM.container.innerHTML = '<div class="error-text">Error al cargar noticias.</div>';
        return;
    }

    if (!data || data.length === 0) {
        DOM.container.innerHTML = '<div class="loader-text">No hay noticias recientes.</div>';
        return;
    }

    DOM.container.innerHTML = data.map(createBannerHTML).join('');
}

async function publishBanner() {
    const title = DOM.titleInput.value.trim();
    const content = DOM.contentInput.value.trim();
    
    if (!title || !content) return alert("Faltan datos");

    const { error } = await supabase.from('news_banners').insert([{ title, content }]);
    
    if (!error) {
        DOM.titleInput.value = '';
        DOM.contentInput.value = '';
        DOM.creationModal.style.display = 'none';
        loadBanners();
    } else {
        alert("Error al publicar");
    }
}

async function sendComment(btn) {
    const id = btn.dataset.id;
    const nameInput = document.querySelector(`.name-input[data-id="${id}"]`);
    const textInput = document.querySelector(`.text-input[data-id="${id}"]`);
    
    if (!nameInput.value || !textInput.value) return;

    btn.disabled = true;
    btn.textContent = "...";

    await supabase.from('banner_comments').insert([{ 
        banner_id: id, 
        commenter_name: nameInput.value, 
        comment_text: textInput.value 
    }]);

    await loadBanners();
    
    // Restaurar vista de comentarios abiertos
    setTimeout(() => {
        const feed = document.getElementById(`feed-${id}`);
        if(feed) feed.style.display = 'block';
    }, 100);
}

async function deleteBanner(id) {
    if(confirm("¿Seguro que deseas eliminar esta noticia permanentemente?")) {
        await supabase.from('news_banners').delete().eq('id', id);
        loadBanners();
    }
}

// --- EVENTOS ---
function toggleAdmin(active) {
    isAdminMode = active;
    DOM.adminTools.style.display = active ? 'flex' : 'none';
    DOM.toggleBtn.style.display = active ? 'none' : 'block';
    loadBanners(); // Recargar para mostrar botones de borrar
}

// Delegación de eventos para elementos dinámicos
DOM.container.addEventListener('click', (e) => {
    const target = e.target;
    
    if (target.classList.contains('toggle-comments')) {
        const feed = document.getElementById(`feed-${target.dataset.id}`);
        feed.style.display = feed.style.display === 'none' ? 'block' : 'none';
    }
    
    if (target.classList.contains('send-comment-btn')) sendComment(target);
    if (target.classList.contains('delete-btn')) deleteBanner(target.dataset.id);
});

// Eventos estáticos
DOM.toggleBtn.addEventListener('click', () => toggleAdmin(true));
DOM.exitBtn.addEventListener('click', () => toggleAdmin(false));
document.getElementById('addBannerBtn').addEventListener('click', () => DOM.creationModal.style.display = 'block');
DOM.cancelBtn.addEventListener('click', () => DOM.creationModal.style.display = 'none');
document.getElementById('publishBannerBtn').addEventListener('click', publishBanner);

// Inicio
document.addEventListener('DOMContentLoaded', loadBanners);
