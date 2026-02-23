// news_script.js - VERSIÓN FINAL Y PULIDA CON CORRECCIÓN DE COMENTARIOS

// ---------------------------------------------------------------------------------------------
// --- CONFIGURACIÓN DE SUPABASE (POSTGRESQL BAAS) ---
// POR FAVOR, REEMPLAZA ESTAS CLAVES CON LAS TUYAS REALES DE SUPABASE
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 
// ----------------------------------------------------

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ---------------------------------------------------------------------------------------------


// --- VARIABLES GLOBALES y DOM ELEMENTS ---
let isAdminMode = false;
let newsData = []; 

const newsBannersContainer = document.getElementById('newsBannersContainer');
const toggleNewsAdminBtn = document.getElementById('toggleNewsAdminBtn');
const newsAdminPanel = document.getElementById('newsAdminPanel');
const bannerCreationSection = document.getElementById('bannerCreationSection');
const addBannerBtn = document.getElementById('addBannerBtn');
const publishBannerBtn = document.getElementById('publishBannerBtn');
const cancelBannerBtn = document.getElementById('cancelBannerBtn');
// Nuevo botón
const exitAdminBtn = document.getElementById('exitAdminBtn'); 


// ---------------------------------------------------------------------------------------------
// --- FUNCIONES AUXILIARES ---

/**
 * Genera un color de fondo aleatorio bonito.
 */
function getRandomColor() {
    const colors = [
        '#2ecc71', '#3498db', '#9b59b6', '#34495e', '#f1c40f',
        '#e67e22', '#e74c3c', '#1abc9c', '#f39c12', '#95a5a6'
    ];
    // Usamos el color verde del proyecto para las noticias, pero permitimos variación
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Convierte el texto simple en HTML, detectando URLs y creando enlaces clickeables.
 */
function linkify(text) {
    const urlRegex = /(\b(https?:\/\/[^\s]+|www\.[^\s]+)\b)/g;
    let linkedText = text.replace(urlRegex, function(url) {
        let fullURL = url;
        if (!url.match(/^https?:\/\//i)) {
            fullURL = 'http://' + url;
        }
        // Usamos target="_blank" para abrir en una nueva pestaña
        return `<a href="${fullURL}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    return linkedText.replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------------------------------------
// --- RENDERIZADO DE ELEMENTOS ---

/**
 * Crea el HTML para un comentario específico.
 */
function createCommentHtml(comment, bannerId) {
    const likeKey = `like_${comment.id}`; 
    const isLiked = localStorage.getItem(likeKey) === 'true';
    const likeClass = isLiked ? 'liked' : '';
    const date = new Date(comment.created_at).toLocaleDateString('es-ES'); 

    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            <strong>${comment.commenter_name}</strong> (${date}): ${comment.comment_text}
            <div style="text-align: right; margin-top: 3px;">
                <button class="like-btn ${likeClass}" data-comment-id="${comment.id}" data-banner-id="${bannerId}">
                    ❤️ ${comment.likes || 0}
                </button>
            </div>
        </div>
    `;
}

/**
 * Crea el HTML completo para una pancarta de noticias.
 * ⭐ LÓGICA DE COMENTARIOS CORREGIDA AQUÍ ⭐
 */
function createBannerHtml(banner) {
    const date = new Date(banner.created_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
    const formattedContent = linkify(banner.content);
    const comments = banner.comments || [];
    
    // Generamos el HTML para TODOS los comentarios.
    const allCommentsHtml = comments.map(comment => createCommentHtml(comment, banner.id)).join('');

    // El primer comentario se muestra fuera de la lista de despliegue.
    const firstCommentHtml = comments.length > 0 ? createCommentHtml(comments[0], banner.id) : '';
    
    // Calculamos cuántos comentarios "más" se mostrarían al hacer clic (todos menos el primero)
    const commentsToExpandCount = comments.length > 1 ? comments.length - 1 : 0;
    
    // El botón de ver más solo aparece si hay más de 1 comentario.
    let viewMoreButton;
    if (commentsToExpandCount > 0) {
        viewMoreButton = `<button class="view-comments-btn" data-banner-id="${banner.id}" data-expanded="false">Ver ${commentsToExpandCount} comentarios más... </button>`;
    } else if (comments.length === 1) {
        viewMoreButton = `1 comentario.`;
    } else {
        viewMoreButton = `Sé el primero en comentar.`;
    }


    const bannerElement = document.createElement('article');
    bannerElement.className = 'news-banner';
    bannerElement.dataset.id = banner.id;
    bannerElement.style.backgroundColor = banner.color;

    bannerElement.innerHTML = `
        <button class="delete-banner-btn" style="display:${isAdminMode ? 'block' : 'none'};" data-id="${banner.id}">×</button>
        <div class="banner-overlay"></div>
        <div class="banner-content-wrap">
            <h2 class="banner-title">${banner.title}</h2>
            <p class="banner-date">Publicado el: ${date}</p>
            <div class="banner-text">${formattedContent}</div>

            <div class="banner-footer">
                <div class="comment-controls">
                    ${viewMoreButton}
                </div>

                <div id="comments-list-${banner.id}" class="comments-list">
                    ${allCommentsHtml} 
                </div>
                
                ${firstCommentHtml} 

                <div class="comment-form">
                    <input type="text" placeholder="Tu Nombre" required maxlength="30" class="commenter-name-input" data-banner-id="${banner.id}">
                    <textarea placeholder="Comentario (máx. 250)" required maxlength="250" class="comment-text-input" data-banner-id="${banner.id}"></textarea>
                    <button class="publish-comment-btn" data-banner-id="${banner.id}">Comentar</button>
                </div>
            </div>
        </div>
    `;

    newsBannersContainer.appendChild(bannerElement);
}

/**
 * Carga todas las pancartas y sus comentarios desde Supabase.
 */
async function loadBannersAndComments() {
    try {
        newsBannersContainer.innerHTML = '<p style="text-align: center; color: var(--color-texto-secundario); margin: 30px;">Cargando noticias destacadas...</p>';

        let { data, error } = await supabase
            .from('news_banners')
            .select(`
                id,
                title,
                content,
                color,
                created_at,
                comments:banner_comments (
                    id,
                    commenter_name,
                    comment_text,
                    likes,
                    created_at
                )
            `)
            .order('created_at', { ascending: false }); 

        if (error) throw error;
        
        // Ordenar los comentarios dentro de cada banner por su fecha de creación (ascendente)
        newsData = data.map(banner => {
            if (banner.comments) {
                banner.comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
            return banner;
        });

        renderAllBanners();

    } catch (e) {
        console.error('Error al cargar datos desde Supabase:', e);
        newsBannersContainer.innerHTML = '<p style="text-align: center; color: red; margin: 30px;">Error al conectar con la base de datos.</p>';
    }
}

/**
 * Renderiza todas las pancartas cargadas en newsData.
 */
function renderAllBanners() {
    newsBannersContainer.innerHTML = ''; 
    
    if (newsData.length === 0) {
        newsBannersContainer.innerHTML = '<p style="text-align: center; color: #777; margin: 30px;">Aún no hay noticias destacadas.</p>';
        return;
    }
    
    newsData.forEach(createBannerHtml);
}

// ---------------------------------------------------------------------------------------------
// --- HANDLERS DE EVENTOS (PERSISTENCIA CON SUPABASE) ---

/**
 * Alterna el modo edición de la página.
 * ⭐ LÓGICA DE BOTONES DE EDICIÓN MEJORADA AQUÍ ⭐
 * @param {boolean} forceExit Si es true, fuerza la salida del modo admin.
 */
function toggleAdminMode(forceExit = false) {
    if (forceExit) {
        isAdminMode = false;
    } else {
        isAdminMode = !isAdminMode;
    }
    
    // 1. Mostrar/Ocultar el panel de administración
    newsAdminPanel.style.display = isAdminMode ? 'flex' : 'none';
    
    // 2. Controlar la visibilidad del botón de entrada
    if (!isAdminMode) {
        // Modo NO ACTIVO (muestra el botón de entrada)
        toggleNewsAdminBtn.style.display = 'block';
        toggleNewsAdminBtn.textContent = '🛡️ ACTIVAR EDICIÓN';
        toggleNewsAdminBtn.classList.remove('active');
    } else {
        // Modo ACTIVO (oculta el botón de entrada, la salida está en el panel)
        toggleNewsAdminBtn.style.display = 'none';
        toggleNewsAdminBtn.classList.add('active');
    }

    // 3. Mostrar/Ocultar los botones de eliminar en las pancartas
    document.querySelectorAll('.delete-banner-btn').forEach(btn => {
        btn.style.display = isAdminMode ? 'block' : 'none';
    });
    
    // 4. Ocultar el formulario de creación si el modo se desactiva
    if (!isAdminMode) {
        bannerCreationSection.style.display = 'none';
    }
}

/**
 * Publica una nueva pancarta de noticias en Supabase.
 */
async function publishNewBanner() {
    const title = document.getElementById('bannerTitle').value.trim();
    const content = document.getElementById('bannerContent').value.trim();

    if (title.length < 5 || content.length < 10) {
        alert('El título debe tener al menos 5 caracteres y el contenido al menos 10.');
        return;
    }

    const newBanner = {
        title: title,
        content: content,
        color: getRandomColor(),
    };

    const { error } = await supabase
        .from('news_banners')
        .insert([newBanner]);

    if (error) {
        console.error('Error al insertar pancarta:', error);
        alert('Error al publicar la pancarta. Revisa la consola.');
        return;
    }

    alert('Pancarta publicada con éxito!');
    document.getElementById('bannerTitle').value = '';
    document.getElementById('bannerContent').value = '';
    bannerCreationSection.style.display = 'none';
    
    await loadBannersAndComments(); 
}

/**
 * Elimina una pancarta de noticias de Supabase.
 */
async function deleteBanner(bannerId) {
    if (!isAdminMode || !confirm('¿Estás seguro de que deseas eliminar esta pancarta de forma permanente? Esto eliminará todos los comentarios asociados.')) {
        return;
    }

    const { error } = await supabase
        .from('news_banners')
        .delete()
        .eq('id', bannerId); 

    if (error) {
        console.error('Error al eliminar pancarta:', error);
        alert('Error al eliminar. Revisa la consola.');
        return;
    }

    alert('Pancarta eliminada.');
    await loadBannersAndComments(); 
}

/**
 * Maneja la publicación de un nuevo comentario en Supabase.
 */
async function publishComment(bannerId, name, text, nameInput, textInput) {
    if (name.length < 2 || text.length < 5) {
        alert('Por favor, ingresa tu nombre y un comentario de al menos 5 caracteres.');
        return;
    }

    const newComment = {
        banner_id: bannerId,
        commenter_name: name,
        comment_text: text,
    };

    const { error } = await supabase
        .from('banner_comments')
        .insert([newComment]);

    if (error) {
        console.error('Error al insertar comentario:', error);
        alert('Error al comentar. Revisa la consola.');
        return;
    }

    alert('Comentario publicado.');
    nameInput.value = '';
    textInput.value = '';
    
    await loadBannersAndComments(); 
}

/**
 * Maneja el evento de Like en un comentario (actualiza Supabase y localStorage).
 */
async function toggleCommentLike(commentId, btn) {
    const likeKey = `like_${commentId}`;
    const isLiked = localStorage.getItem(likeKey) === 'true';

    const currentLikesText = btn.textContent.split(' ')[1];
    const currentLikes = parseInt(currentLikesText) || 0;
    let newLikes = currentLikes;

    if (isLiked) {
        newLikes = Math.max(0, currentLikes - 1);
        localStorage.removeItem(likeKey);
    } else {
        newLikes = currentLikes + 1;
        localStorage.setItem(likeKey, 'true');
    }

    const { error } = await supabase
        .from('banner_comments')
        .update({ likes: newLikes })
        .eq('id', commentId);

    if (error) {
        if (isLiked) {
             localStorage.setItem(likeKey, 'true');
        } else {
             localStorage.removeItem(likeKey);
        }
        console.error('Error al actualizar like:', error);
        alert('Error al dar/quitar like. Intenta de nuevo.');
        return;
    }
    
    btn.classList.toggle('liked', !isLiked);
    btn.innerHTML = `❤️ ${newLikes}`;
}

/**
 * Alterna la visibilidad de todos los comentarios de un banner.
 */
function toggleCommentsList(bannerId, btn) {
    const list = document.getElementById(`comments-list-${bannerId}`);
    const isExpanded = btn.dataset.expanded === 'true';
    
    const banner = newsData.find(b => b.id === bannerId);
    const totalComments = banner.comments ? banner.comments.length : 0;
    const commentsToExpandCount = totalComments > 1 ? totalComments - 1 : 0;

    if (isExpanded) {
        list.classList.remove('expanded');
        btn.dataset.expanded = 'false';
        if (commentsToExpandCount > 0) {
            btn.textContent = `Ver ${commentsToExpandCount} comentarios más... `;
        }
    } else {
        list.classList.add('expanded');
        btn.dataset.expanded = 'true';
        btn.textContent = 'Ocultar comentarios';
    }
}


// ---------------------------------------------------------------------------------------------
// --- INICIALIZACIÓN Y LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Cargar los datos desde Supabase
    loadBannersAndComments();
    
    // 2. Listeners para el Modo Edición y Creación
    toggleNewsAdminBtn.addEventListener('click', () => toggleAdminMode());
    
    // ⭐ NUEVO: Listener para el botón de salida del modo admin ⭐
    if (exitAdminBtn) {
        exitAdminBtn.addEventListener('click', () => toggleAdminMode(true));
    }

    addBannerBtn.addEventListener('click', () => {
        document.getElementById('bannerTitle').value = '';
        document.getElementById('bannerContent').value = '';
        bannerCreationSection.style.display = 'block';
    });
    cancelBannerBtn.addEventListener('click', () => {
        bannerCreationSection.style.display = 'none';
    });
    publishBannerBtn.addEventListener('click', publishNewBanner);
    
    // 3. Listener General para interacciones dentro de las pancartas (delegación de eventos)
    newsBannersContainer.addEventListener('click', (e) => {
        
        // A. ELIMINAR PANCARTA
        if (e.target.classList.contains('delete-banner-btn')) {
            const bannerId = e.target.dataset.id;
            deleteBanner(bannerId);
        }
        
        // B. PUBLICAR COMENTARIO
        if (e.target.classList.contains('publish-comment-btn')) {
            const bannerId = e.target.dataset.bannerId;
            const container = e.target.closest('.comment-form');
            const nameInput = container.querySelector('.commenter-name-input');
            const textInput = container.querySelector('.comment-text-input');
            
            publishComment(bannerId, nameInput.value.trim(), textInput.value.trim(), nameInput, textInput);
        }
        
        // C. LIKE EN COMENTARIO
        if (e.target.classList.contains('like-btn')) {
            const commentId = e.target.dataset.commentId;
            toggleCommentLike(commentId, e.target);
        }
        
        // D. VER MÁS COMENTARIOS
        if (e.target.classList.contains('view-comments-btn')) {
            const bannerId = e.target.dataset.bannerId;
            toggleCommentsList(bannerId, e.target);
        }
    });

});
