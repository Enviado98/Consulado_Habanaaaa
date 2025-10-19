// ----------------------------------------------------
// 🚨 CONFIGURACIÓN DE SUPABASE (POSTGRESQL BAAS) 🚨
// ----------------------------------------------------
// !!! NO IMPORTA QUE ESTÉ EN EL CÓDIGO DIRECTAMENTE (WEB DE PRUEBA) !!!
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 
// ----------------------------------------------------

// 🚨 CREDENCIALES DE ADMINISTRADOR 🚨
// ELIMINADAS: const ADMIN_USER = "Admin"; 
// ELIMINADAS: const ADMIN_PASS = "54321"; 
// ----------------------------------------------------

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let admin = false; // Estado global para el modo de edición

// Variables y constantes de tiempo
const ONE_HOUR = 3600000;
const ONE_DAY = 24 * ONE_HOUR;
const RECENT_THRESHOLD_MS = ONE_DAY; 
const OLD_THRESHOLD_MS = 7 * ONE_DAY;
const NEWS_SCROLL_SPEED_PX_PER_SEC = 50; 
const TIME_PANEL_AUTOHIDE_MS = 2000; 

let currentData = [];
let currentNews = []; 
let currentStatus = {}; 
const timePanelTimeouts = new Map(); 

// 🔑 LÓGICA DE USUARIO WEB ÚNICO (Para persistir los Likes)
let userWebId = localStorage.getItem('userWebId');
if (!userWebId) {
    userWebId = crypto.randomUUID(); 
    localStorage.setItem('userWebId', userWebId);
}

// Elementos del DOM (Simplificado)
const DOMElements = {
    body: document.body,
    contenedor: document.getElementById('contenedor'),
    newsTicker: document.getElementById('newsTicker'),
    newsTickerContent: document.getElementById('newsTickerContent'),
    fixedLabel: document.querySelector('.news-ticker-fixed-label'),
    commentsContainer: document.getElementById('commentsContainer'),
    commenterName: document.getElementById('commenterName'),
    commentText: document.getElementById('commentText'),
    publishCommentBtn: document.getElementById('publishCommentBtn'),
    adminControlsPanel: document.getElementById('adminControlsPanel'),
    // MODIFICADO: loginForm, user, pass ELIMINADOS
    statusMessage: document.getElementById('statusMessage'),
    // MODIFICADO: loginBtn, logoutBtn ELIMINADOS
    toggleAdminBtn: document.getElementById('toggleAdminBtn'), // NUEVO BOTÓN
    saveBtn: document.getElementById('saveBtn'),
    addNewsBtn: document.getElementById('addNewsBtn'),
    deleteNewsBtn: document.getElementById('deleteNewsBtn'),
    dynamicTickerStyles: document.getElementById('dynamicTickerStyles'),
    // ⭐ NUEVOS ELEMENTOS DEL PANEL DE ESTADO UNIFICADO ⭐
    statusPanel: document.getElementById('statusPanel'),
    statusDataContainer: document.getElementById('statusDataContainer'),
    lastEditedTime: document.getElementById('lastEditedTime')
};


// ----------------------------------------------------
// FUNCIÓN DE FORMATO DE TIEMPO
// ----------------------------------------------------

function timeAgo(timestamp) {
    if (!timestamp) return { text: 'Sin fecha de edición.', diff: -1, date: null };
    
    const then = new Date(timestamp).getTime();
    const now = Date.now();
    const diff = now - then;

    if (diff < 0) return { text: 'Ahora mismo', diff: 0, date: new Date(timestamp) }; 

    const SECONDS = Math.floor(diff / 1000);
    const MINUTES = Math.floor(SECONDS / 60);
    const HOURS = Math.floor(MINUTES / 60);
    const DAYS = Math.floor(HOURS / 24);

    let text;
    if (DAYS >= 30) {
        text = `hace ${Math.floor(DAYS / 30)} meses`;
    } else if (DAYS >= 7) {
        const weeks = Math.floor(DAYS / 7);
        text = `hace ${weeks} sem.`;
    } else if (DAYS >= 2) {
        text = `hace ${DAYS} días`;
    } else if (DAYS === 1) {
        text = 'hace 1 día';
    } else if (HOURS >= 2) {
        text = `hace ${HOURS} horas`;
    } else if (HOURS === 1) {
        text = 'hace 1 hora';
    } else if (MINUTES >= 1) {
        text = `hace ${MINUTES} min.`;
    } else {
        text = 'hace unos momentos';
    }
    
    return { text, diff, date: new Date(timestamp) };
}


// ----------------------------------------------------
// FUNCIONES DE UI Y LOGIN (MODIFICADAS)
// ----------------------------------------------------

function updateAdminUI(isAdmin) {
    admin = isAdmin;
    if (isAdmin) {
        DOMElements.body.classList.add('admin-mode');
        // DOMElements.loginForm.style.display = "none"; // Eliminado
        DOMElements.adminControlsPanel.style.display = "flex";
        DOMElements.statusMessage.textContent = "¡🔴 POR FAVOR EDITA CON RESPONSABILIDAD!";
        DOMElements.statusMessage.style.color = "#0d9488"; 
        DOMElements.toggleAdminBtn.textContent = "🛑 SALIR DEL MODO EDICIÓN"; // Nuevo texto
        DOMElements.toggleAdminBtn.style.backgroundColor = "var(--acento-rojo)"; // Nuevo color
        enableEditing(); 
        // alert("Modo edición activado. ¡No olvides guardar!"); // Alerta movida a toggleAdminMode
    } else {
        DOMElements.body.classList.remove('admin-mode');
        // DOMElements.loginForm.style.display = "flex"; // Eliminado
        DOMElements.adminControlsPanel.style.display = "none";
        DOMElements.statusMessage.textContent = "Accede a modo edición para actualizar la información"; // Texto ajustado
        DOMElements.statusMessage.style.color = "var(--color-texto-principal)"; 
        DOMElements.toggleAdminBtn.textContent = "🛡️ ACTIVAR EL MODO EDICIÓN"; // Nuevo texto
        DOMElements.toggleAdminBtn.style.backgroundColor = "#4f46e5"; // Color original
        disableEditing(); 
    }
    
    // ⭐ ACTUALIZACIÓN DEL PANEL DE ESTADO EN MODO ADMIN ⭐
    if (isAdmin) {
        DOMElements.statusPanel.classList.add('admin-mode');
        renderStatusPanel(currentStatus, true); 
    } else {
        DOMElements.statusPanel.classList.remove('admin-mode');
        renderStatusPanel(currentStatus, false); 
    }
}

// Función de alternancia de modo de edición (Reemplaza login y logout)
function toggleAdminMode() {
    if (!admin) {
        updateAdminUI(true);
        alert("✅ Modo de Edición Activado. ¡🔴 POR FAVOR EDITA CON RESPONSABILIDAD!");
    } else {
        if (!confirm("⚠️ ¿Estás seguro de que quieres salir del Modo Edición?")) {
            return;
        }
        updateAdminUI(false);
        // alert("Sesión cerrada. Los cambios no guardados se perderán."); // Alerta movida al confirm
        loadData(); // Recargar datos para descartar cambios
        loadStatusData(); // Recargar datos de estado para descartar cambios
    }
}

function enableEditing() {
    toggleEditing(true);
}

function disableEditing() {
    toggleEditing(false);
}

// ----------------------------------------------------
// CREACIÓN DE CARD (Fusión y Edición Avanzada)
// ----------------------------------------------------

function createCardHTML(item, index) {
    let cardClass = '';
    let labelHTML = '';
    let panelStyle = ''; 
    let labelText = 'Sin fecha'; 
    let timeText = 'Sin editar';

    if (item.last_edited_timestamp) {
        const { text, diff } = timeAgo(item.last_edited_timestamp);
        timeText = text;
        
        if (diff >= 0 && diff < RECENT_THRESHOLD_MS) {
            cardClass = 'card-recent';
            labelHTML = '<div class="card-label" style="background-color: var(--acento-rojo); color: white; display: block;">!EDITADO RECIENTEMENTE¡</div>';
            panelStyle = `background: var(--tiempo-panel-rojo); color: var(--acento-rojo);`; 
            labelText = ''; 
        } else if (diff >= OLD_THRESHOLD_MS) {
            cardClass = 'card-old';
            labelHTML = '<div class="card-label" style="background-color: var(--acento-cian); color: var(--color-texto-principal); display: block;">Editado hace tiempo</div>';
            panelStyle = `background: var(--tiempo-panel-cian); color: var(--acento-cian);`;
            labelText = '';
        } else {
            panelStyle = `background: white; color: var(--color-texto-principal);`;
            labelText = 'Actualizado';
        }
    }
    
    return `
    <div class="card ${cardClass}" data-index="${index}" data-id="${item.id}"> 
        ${labelHTML}
        
        <span class="emoji">${item.emoji}</span>
        <h3>${item.titulo}</h3>
        <div class="card-content">
            <p>${item.contenido}</p>
        </div>
        <div class="card-time-panel" data-id="${item.id}" style="${panelStyle}">
            <strong>${labelText}</strong> (${timeText})
        </div>
    </div>
    `;
}

function toggleEditing(enable) {
    const cards = document.querySelectorAll(".card");
    cards.forEach(card => {
        const index = card.getAttribute('data-index');
        const item = currentData[index];
        const contentDiv = card.querySelector('.card-content');
        
        // Elementos de Vista
        const emojiSpan = card.querySelector('.emoji');
        const titleH3 = card.querySelector('h3');
        const contentP = contentDiv.querySelector('p');
        
        // Elementos de Edición
        let editableEmoji = card.querySelector('.editable-emoji');
        let editableTitle = card.querySelector('.editable-title');
        let editableContent = card.querySelector('.editable-content');

        if (enable) {
            // Entrar en modo Admin
            card.removeEventListener('click', toggleTimePanel); 
            card.classList.remove('card-recent', 'card-old');
            card.style.background = 'white'; 
            card.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.3)'; 
            card.style.border = '1px solid #4f46e5'; 
            card.querySelector('.card-time-panel').style.display = 'none';
            const label = card.querySelector('.card-label');
            if (label) label.style.display = 'none';


            if (emojiSpan && titleH3 && contentP) {
                // 1. Emoji
                emojiSpan.remove();
                editableEmoji = document.createElement('input');
                editableEmoji.className = 'editable-emoji';
                editableEmoji.value = item.emoji;
                editableEmoji.defaultValue = item.emoji;
                editableEmoji.maxLength = 2;
                editableEmoji.title = "Emoji";
                card.insertBefore(editableEmoji, card.firstChild);
                
                // 2. Título
                titleH3.remove();
                editableTitle = document.createElement('input');
                editableTitle.className = 'editable-title';
                editableTitle.value = item.titulo;
                editableTitle.defaultValue = item.titulo;
                editableTitle.title = "Título";
                card.insertBefore(editableTitle, editableEmoji.nextSibling);

                // 3. Contenido
                contentP.remove();
                editableContent = document.createElement('textarea');
                editableContent.className = 'editable-content';
                editableContent.value = item.contenido;
                editableContent.defaultValue = item.contenido;
                editableContent.title = "Contenido";
                contentDiv.appendChild(editableContent);
            }
        } else {
            // Salir del modo Admin
            if (editableEmoji && editableTitle && editableContent) {
                // 1. Emoji
                editableEmoji.remove();
                const newEmojiSpan = document.createElement('span');
                newEmojiSpan.className = 'emoji';
                newEmojiSpan.textContent = editableEmoji.value;
                card.insertBefore(newEmojiSpan, card.firstChild);
                
                // 2. Título
                editableTitle.remove();
                const newTitleH3 = document.createElement('h3');
                newTitleH3.textContent = editableTitle.value;
                card.insertBefore(newTitleH3, newEmojiSpan.nextSibling);

                // 3. Contenido
                editableContent.remove();
                const newP = document.createElement('p');
                newP.textContent = editableContent.value;
                contentDiv.appendChild(newP);
                
                // Restaurar estilos de tarjeta (LoadData se encarga de la mayoría)
                card.style.background = '';
                card.style.boxShadow = '';
                card.style.border = '';
                card.querySelector('.card-time-panel').style.display = 'block';
                const label = card.querySelector('.card-label');
                if (label) label.style.display = 'block';
            }
        }
    });
}

function toggleTimePanel(event) {
    if (admin) return;
    
    const clickedCard = event.currentTarget;
    const cardId = clickedCard.getAttribute('data-id'); 
    
    const allCards = document.querySelectorAll('.card');
    allCards.forEach(card => {
        const id = card.getAttribute('data-id');
        if (id !== cardId) {
            card.classList.remove('show-time-panel');
        }
        
        if (timePanelTimeouts.has(id)) {
            clearTimeout(timePanelTimeouts.get(id));
            timePanelTimeouts.delete(id);
        }
    });

    const isShowing = clickedCard.classList.toggle('show-time-panel');

    if (isShowing) {
        const timeout = setTimeout(() => {
            clickedCard.classList.remove('show-time-panel');
            timePanelTimeouts.delete(cardId); 
        }, TIME_PANEL_AUTOHIDE_MS);
        
        timePanelTimeouts.set(cardId, timeout); 
    }
}


// ----------------------------------------------------
// LÓGICA DE NOTICIAS 
// ----------------------------------------------------

function linkify(text) {
    const urlPattern = /(\b(https?:\/\/|www\.)[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    
    return text.replace(urlPattern, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
}

async function loadNews() {
    
    const { data: newsData, error } = await supabase
        .from('noticias')
        .select('id, text, timestamp')
        .order('timestamp', { ascending: false });

    if (error) {
        console.error("Error al cargar noticias de Supabase:", error);
        return;
    }

    const twentyFourHoursAgoTimestamp = Date.now() - RECENT_THRESHOLD_MS;
    const validNews = [];
    const deletePromises = [];

    newsData.forEach(n => {
        if (new Date(n.timestamp).getTime() < twentyFourHoursAgoTimestamp) {
            deletePromises.push(supabase.from('noticias').delete().eq('id', n.id));
        } else {
            validNews.push(n);
        }
    });
    if (deletePromises.length > 0) {
        Promise.all(deletePromises).catch(err => console.error("Error al limpiar noticias antiguas:", err));
    }


    currentNews = validNews;
    
    if (validNews.length > 0) {
        const newsHtml = validNews.map(n => {
            const { text: timeInfo } = timeAgo(n.timestamp);
            return `<span class="news-item">${linkify(n.text)} <small>(${timeInfo})</small></span>`;
        }).join('<span class="news-item"> | </span>');
        
        const contentToMeasure = `${newsHtml}<span class="news-item"> | </span>`;
        const repeatedContent = `${contentToMeasure}${newsHtml}`; 
        
        DOMElements.newsTicker.style.display = 'flex'; 
        DOMElements.fixedLabel.textContent = 'NOTICIAS'; 
        
        DOMElements.newsTickerContent.style.animation = 'none'; 
        DOMElements.newsTickerContent.style.transform = 'none';
        
        DOMElements.newsTickerContent.innerHTML = repeatedContent;

        DOMElements.newsTickerContent.offsetHeight; 

        window.requestAnimationFrame(() => {
            
            const totalContentWidth = DOMElements.newsTickerContent.scrollWidth; 
            const uniqueContentWidth = totalContentWidth / 2;
            
            if (uniqueContentWidth <= 0) return;

            const durationSeconds = uniqueContentWidth / NEWS_SCROLL_SPEED_PX_PER_SEC;

            DOMElements.dynamicTickerStyles.innerHTML = ''; 

            const keyframesRule = `@keyframes ticker-move-dynamic { 
                0% { transform: translateX(0); }
                100% { transform: translateX(-${uniqueContentWidth}px); } 
            }`;
            
            DOMElements.dynamicTickerStyles.innerHTML = keyframesRule;

            DOMElements.newsTickerContent.style.animationDuration = `${durationSeconds}s`;
            DOMElements.newsTickerContent.style.animationName = 'ticker-move-dynamic';
            DOMElements.newsTickerContent.style.animationPlayState = 'running';
            DOMElements.newsTickerContent.style.animationIterationCount = 'infinite';
            DOMElements.newsTickerContent.style.animationTimingFunction = 'linear';
        });

    
    } else {
        const avisoText = 'Sin Noticias en estos momentos.... ||  🛡 Activa el modo edición para publicar una Noticia aquí';
        const repeatedAviso = `<span class="news-item">${avisoText}</span><span class="news-item"> | </span><span class="news-item">${avisoText}</span>`;
        
        DOMElements.newsTicker.style.display = 'flex'; 
        DOMElements.fixedLabel.textContent = 'AVISO'; 
        DOMElements.newsTickerContent.style.animation = 'none'; 
        DOMElements.newsTickerContent.style.transform = 'none';
        
        DOMElements.newsTickerContent.innerHTML = repeatedAviso;

        DOMElements.newsTickerContent.style.animationDuration = `15s`; 
        DOMElements.newsTickerContent.style.animationName = 'ticker-move-static';
        DOMElements.newsTickerContent.style.animationPlayState = 'running';
        DOMElements.newsTickerContent.style.animationIterationCount = 'infinite';
        DOMElements.newsTickerContent.style.animationTimingFunction = 'linear';
    }
}

async function addQuickNews() {
    if (!admin) { alert("Acceso denegado."); return; }
    const newsText = window.prompt("✍️ Escribe tu noticia aqui para agregarla al rodillo...");
    if (newsText === null || newsText.trim() === "") return;
    
    const confirmSave = confirm(`¿Confirmas que deseas publicar: \n\n"${newsText.trim()}"\n\n(Se borrará automáticamente en 24 horas)`);

    if (confirmSave) {
        try {
            const { error } = await supabase.from('noticias').insert([{ text: newsText.trim() }]);
            if (error) throw error;
            alert(`✅ Noticia publicada.`);
            loadNews(); 
        } catch (error) {
            console.error("Error al guardar la noticia:", error);
            alert("❌ Error al guardar la noticia. Revisa RLS.");
        }
    }
}

async function deleteNews() {
    if (!admin) { alert("Acceso denegado."); return; }
    if (currentNews.length === 0) {
        alert("No hay noticias activas para eliminar.");
        return;
    }

    const newsList = currentNews.map((n, index) => `${index + 1}. ${n.text}`).join('\n');
    const choice = window.prompt(`Selecciona el número de la noticia que deseas eliminar:\n\n${newsList}`);

    const indexToDelete = parseInt(choice) - 1;

    if (isNaN(indexToDelete) || indexToDelete < 0 || indexToDelete >= currentNews.length) {
        if (choice !== null) alert("Selección inválida.");
        return;
    }

    const newsItem = currentNews[indexToDelete];
    const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar esta noticia?\n\n"${newsItem.text}"`);

    if (confirmDelete) {
        try {
            const { error } = await supabase.from('noticias').delete().eq('id', newsItem.id); 
            if (error) throw error;
            alert(`✅ Noticia eliminada.`);
            loadNews();
        } catch (error) {
            console.error("Error al eliminar la noticia:", error);
            alert("❌ Error al eliminar la noticia. Revisa RLS.");
        }
    }
}


// ----------------------------------------------------
// LÓGICA DE COMENTARIOS, HILOS Y LIKES 
// ----------------------------------------------------
// (Se omite el detalle de las funciones de comentarios, ya que se asume que funcionan)

function generateColorByName(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 70%, 50%)`; 
}

function formatCommentDate(timestamp) {
    const date = new Date(timestamp); 
    const options = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    return new Intl.DateTimeFormat('es-ES', options).format(date) + ' h';
}

function createCommentHTML(comment, isLiked) {
    const color = generateColorByName(comment.name.toLowerCase());
    const likeClass = isLiked ? 'liked' : '';
    
    const itemClass = comment.parent_id ? 'comment-item reply-style' : 'comment-item'; 
    
    return `
        <div class="${itemClass}" data-comment-id="${comment.id}" style="--comment-color: ${color};">
            <strong class="comment-name">${comment.name} dijo:</strong>
            <div class="comment-content">${comment.text}</div>
            
            <div class="comment-actions">
                <button class="like-button ${likeClass}" data-id="${comment.id}">
                    <span class="heart">♥</span>
                </button>
                <span class="like-count" data-counter-id="${comment.id}">${comment.likes_count || 0}</span>
                ${!comment.parent_id ? 
                    `<span class="reply-form-toggle" data-id="${comment.id}">Responder</span>` : 
                    ''}
                <span class="comment-date">Publicado: ${formatCommentDate(comment.timestamp)}</span>
            </div>
            
            ${!comment.parent_id ? `
                <div class="reply-form" data-reply-to="${comment.id}">
                    <input type="text" class="reply-name" placeholder="Tu Nombre" required maxlength="30">
                    <textarea class="reply-text" placeholder="Tu Respuesta (máx. 250)" required maxlength="250"></textarea>
                    <button class="publish-reply-btn" data-parent-id="${comment.id}">Publicar Respuesta</button>
                </div>
                <div class="replies-container" data-parent-of="${comment.id}"></div>
            ` : ''}
        </div>
    `;
}

function drawReplies(container, replies, userLikesMap) {
    container.innerHTML = ''; 
    
    replies.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); 

    replies.forEach((reply) => {
        const isLiked = userLikesMap.get(reply.id) || false;
        
        const replyWrapper = document.createElement('div');
        replyWrapper.className = 'reply-item';
        replyWrapper.innerHTML = createCommentHTML(reply, isLiked);
        
        container.appendChild(replyWrapper);
    });
    
    if (replies.length > 1) {
        const remainingCount = replies.length - 1;
        const toggle = document.createElement('span');
        toggle.className = 'reply-toggle';
        toggle.textContent = `Ver las ${remainingCount} respuestas más...`;
        toggle.addEventListener('click', (e) => {
            const parentContainer = e.target.closest('.replies-container');
            parentContainer.classList.add('expanded');
            e.target.style.display = 'none'; 
        });
        container.appendChild(toggle);
    }
}


async function loadComments() {
    
    const [commentsResponse, likesResponse] = await Promise.all([
        supabase.from('comentarios')
            .select('id, name, text, timestamp, parent_id, likes_count')
            .order('timestamp', { ascending: false }),
        
        supabase.from('likes')
            .select('comment_id')
            .eq('user_web_id', userWebId)
    ]);
    
    if (commentsResponse.error) {
        DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: var(--acento-rojo); margin: 15px;">❌ Error de conexión al cargar comentarios. (Ver consola)</p>`;
        console.error("Error al cargar comentarios:", commentsResponse.error);
        return;
    }
    
    const allComments = commentsResponse.data;
    const userLikesMap = new Map();
    if (likesResponse.data) {
        likesResponse.data.forEach(like => userLikesMap.set(like.comment_id, true));
    }
    
    const principalComments = allComments.filter(c => c.parent_id === null);
    const repliesMap = allComments.reduce((map, comment) => {
        if (comment.parent_id !== null) {
            if (!map.has(comment.parent_id)) {
                map.set(comment.parent_id, []);
            }
            map.get(comment.parent_id).push(comment);
        }
        return map;
    }, new Map());
    
    if (principalComments.length === 0) {
        DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: var(--color-texto-secundario); margin: 15px;">Aún no hay comentarios activos. ¡Sé el primero!</p>`;
        return; 
    }
    
    DOMElements.commentsContainer.innerHTML = principalComments.map(comment => {
        const isLiked = userLikesMap.get(comment.id) || false;
        return createCommentHTML(comment, isLiked);
    }).join('');

    principalComments.forEach(comment => {
        const replies = repliesMap.get(comment.id);
        if (replies) {
            const repliesContainer = document.querySelector(`.replies-container[data-parent-of="${comment.id}"]`);
            if (repliesContainer) {
                drawReplies(repliesContainer, replies, userLikesMap);
            }
        }
    });

    document.querySelectorAll('.reply-form-toggle').forEach(btn => {
        btn.addEventListener('click', toggleReplyForm);
    });
    document.querySelectorAll('.publish-reply-btn').forEach(btn => {
        btn.addEventListener('click', handlePublishReply);
    });
    document.querySelectorAll('.like-button').forEach(btn => {
        btn.removeEventListener('click', handleLikeToggle);
        btn.addEventListener('click', handleLikeToggle);
    });
}

function toggleReplyForm(event) {
    const commentId = event.target.getAttribute('data-id');
    const form = document.querySelector(`.reply-form[data-reply-to="${commentId}"]`);
    if (form) {
        document.querySelectorAll('.reply-form').forEach(f => {
            if (f !== form) f.style.display = 'none';
        });
        
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        if (form.style.display === 'block') {
            form.querySelector('.reply-name').focus();
        }
    }
}

async function publishComment() {
    const name = DOMElements.commenterName.value.trim();
    const text = DOMElements.commentText.value.trim();
    
    if (name.length < 2 || text.length < 5) {
        alert("Por favor, ingresa un nombre válido (mín. 2) y un comentario (mín. 5).");
        return;
    }
    
    DOMElements.publishCommentBtn.disabled = true;
    DOMElements.publishCommentBtn.textContent = "Publicando...";

    try {
        const { error } = await supabase.from('comentarios').insert([{ name: name, text: text, parent_id: null, likes_count: 0 }]);
        
        if (error) throw error;

        DOMElements.commenterName.value = '';
        DOMElements.commentText.value = '';
        await loadComments(); 
        
        const commentsWrap = document.querySelector('.comments-display-wrap');
        if (commentsWrap) commentsWrap.scrollTop = 0;

        alert("✅ Comentario publicado. Estará activo por 3 días.");

    } catch (error) {
        console.error("Error al publicar el comentario:", error);
        alert("❌ Error al publicar en Supabase. Revisa RLS de INSERT.");
    } finally {
        DOMElements.publishCommentBtn.disabled = false;
        DOMElements.publishCommentBtn.textContent = "Publicar Comentario";
    }
}

async function handlePublishReply(event) {
    const parentId = event.target.getAttribute('data-parent-id');
    const form = event.target.closest('.reply-form');
    const nameInput = form.querySelector('.reply-name');
    const textInput = form.querySelector('.reply-text');
    
    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (name.length < 2 || text.length < 5) {
        alert("Por favor, ingresa un nombre válido (mín. 2) y una respuesta (mín. 5).");
        return;
    }
    
    event.target.disabled = true;
    event.target.textContent = "Enviando...";

    try {
        const { error } = await supabase.from('comentarios').insert([{ name: name, text: text, parent_id: parentId, likes_count: 0 }]);
        
        if (error) throw error;

        nameInput.value = '';
        textInput.value = '';
        form.style.display = 'none';
        await loadComments(); 
        
        alert("✅ Respuesta publicada.");

    } catch (error) {
        console.error("Error al publicar la respuesta:", error);
        alert("❌ Error al publicar la respuesta. Revisa RLS de INSERT.");
    } finally {
        event.target.disabled = false;
        event.target.textContent = "Publicar Respuesta";
    }
}

async function handleLikeToggle(event) {
    const button = event.currentTarget;
    const commentId = button.getAttribute('data-id');
    const isLiked = button.classList.contains('liked');
    const counterElement = document.querySelector(`.like-count[data-counter-id="${commentId}"]`);
    
    button.disabled = true;
    
    let currentCount = parseInt(counterElement.textContent);

    try {
        if (isLiked) {
            const { error: deleteError } = await supabase
                .from('likes')
                .delete()
                .eq('comment_id', commentId)
                .eq('user_web_id', userWebId);

            if (deleteError) throw deleteError;

            const newCount = Math.max(0, currentCount - 1); 
            const { error: updateError } = await supabase
                .rpc('decrement_likes', { row_id: commentId }); 

            if (updateError) throw updateError;
            
            button.classList.remove('liked');
            counterElement.textContent = newCount;

        } else {
            const { error: insertError } = await supabase
                .from('likes')
                .insert([{ comment_id: commentId, user_web_id: userWebId }]);

            if (insertError) {
                if (insertError.code !== '23505') throw insertError; 
                alert("Ya habías dado like a este comentario. El voto no se duplicó.");
                return; 
            }

            const newCount = currentCount + 1;
            const { error: updateError } = await supabase
                .rpc('increment_likes', { row_id: commentId }); 

            if (updateError) throw updateError;

            button.classList.add('liked');
            counterElement.textContent = newCount;
        }

    } catch (error) {
        console.error("Error en la operación de like/unlike:", error);
        alert("❌ Error al procesar el voto. (Ver consola)");
    } finally {
        button.disabled = false;
    }
}

// ----------------------------------------------------
// --- NUEVAS FUNCIONES PARA CONTADOR DE VISTAS ---
// ----------------------------------------------------

// Tiempo en milisegundos para considerar una visita "única" (24 horas)
const UNIQUE_VISIT_DURATION = 24 * 60 * 60 * 1000; 
const VISIT_KEY = 'lastPageView';

// 1. Registra una nueva vista en la base de datos SOLO si no la registró en las últimas 24h
async function registerPageView() {
    
    // Paso 1: Comprobar localStorage
    const lastVisitTimestamp = localStorage.getItem(VISIT_KEY);
    const now = Date.now();

    // Si existe un timestamp y es más reciente que el tiempo límite, salimos (no contamos).
    if (lastVisitTimestamp && (now - parseInt(lastVisitTimestamp)) < UNIQUE_VISIT_DURATION) {
        // console.log("Vista ya registrada recientemente. No se cuenta.");
        return; 
    }

    // Paso 2: Si es una visita nueva, registramos en Supabase.
    try {
        const { error } = await supabase
            .from('page_views')
            .insert({}) 
            .select(); 

        if (error) {
            console.error("Error al registrar la vista (Supabase):", error.message);
        } else {
            // Paso 3: Guardamos el timestamp de la visita en localStorage
            localStorage.setItem(VISIT_KEY, now.toString());
            // console.log("Nueva vista única registrada.");
        }
    } catch (e) {
        console.error("Excepción al registrar la vista:", e);
    }
}

// 2. Obtiene el conteo de vistas de los últimos 7 días y lo muestra
async function getAndDisplayViewCount() {
    const viewCounterElement = document.getElementById('viewCounter');
    
    // Si el elemento no existe (p. ej. en otra página), salimos.
    if (!viewCounterElement) return;

    try {
        // Calcula la fecha de hace 1 día
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 1);
        const sevenDaysAgoISO = sevenDaysAgo.toISOString();

        // Consulta Supabase: cuenta los registros 'page_views' después de la fecha
        const { count, error } = await supabase
            .from('page_views')
            .select('*', { count: 'exact', head: true }) 
            .gt('created_at', sevenDaysAgoISO); 

        if (error) {
            console.error("Error al obtener el conteo de vistas:", error.message);
            viewCounterElement.textContent = '( 👁 - Error )';
            return;
        }

        const formattedCount = count ? count.toLocaleString('es-ES') : '0';
        
        // Formato solicitado: ( 👁 - 12 vistas )
        viewCounterElement.textContent = `👀 - ${formattedCount} vistas en (24h)`;

    } catch (e) {
        console.error("Excepción al obtener/mostrar el conteo:", e);
        viewCounterElement.textContent = '( 👁 - Error )';
    }
}

// ----------------------------------------------------
// FUNCIONES DE CARGA Y RENDERIZADO DEL PANEL DE ESTADO ⭐ MODIFICADO ⭐
// ----------------------------------------------------

function renderStatusPanel(status, isAdminMode) {
    if (!status || !DOMElements.statusDataContainer) {
        DOMElements.statusDataContainer.innerHTML = "No se pudieron cargar los datos de estado.";
        return;
    }

    // ⭐ Determinar el TIMESTAMP más reciente para el panel header ⭐
    const deficitTime = new Date(status.deficit_edited_at || 0).getTime();
    const divisaTime = new Date(status.divisa_edited_at || 0).getTime();
    const latestTime = Math.max(deficitTime, divisaTime);
    
    const { text: latestTimeText } = timeAgo(latestTime);
    // ⭐ CAMBIO APLICADO: Usar innerHTML e insertar <br> para el salto de línea ⭐
    DOMElements.lastEditedTime.innerHTML = `Última edición:<br> ${latestTimeText}`;
    
    if (isAdminMode) {
        // Modo Admin: Campos de Input
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item">
                <span class="label">Deficit Eléctrico (MW):</span>
                <input type="text" id="editDeficit" value="${status.deficit_mw || ''}" placeholder="Ej: 1800 MW">
            </div>
            <div class="status-item">
                <span class="label">Dollar (CUP):</span>
                <input type="number" id="editDollar" value="${status.dollar_cup || ''}" placeholder="Ej: 420">
            </div>
            <div class="status-item">
                <span class="label">Euro (CUP):</span>
                <input type="number" id="editEuro" value="${status.euro_cup || ''}" placeholder="Ej: 440">
            </div>
        `;
    } else {
        // Modo Público: Vista Estilizada
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item deficit">
                <span class="label">🔌 Déficit Estimado:</span>
                <span class="value">${status.deficit_mw || '---'}</span>
            </div>
            <div class="status-item divisa">
                <span class="label">💵 Dólar (CUP):</span>
                <span class="value">${status.dollar_cup || '---'}</span>
            </div>
            <div class="status-item divisa">
                <span class="label">💶 Euro (CUP):</span>
                <span class="value">${status.euro_cup || '---'}</span>
            </div>
        `;
    }
}

async function loadStatusData() {
    try {
        const { data, error } = await supabase
            .from('status_data')
            .select('deficit_mw, dollar_cup, euro_cup, deficit_edited_at, divisa_edited_at')
            .eq('id', 1) 
            .single(); 

        if (error) {
            console.error("Error al cargar datos de estado:", error);
            currentStatus = {
                deficit_mw: 'Error', dollar_cup: '---', euro_cup: '---', 
                deficit_edited_at: null, divisa_edited_at: null
            };
        } else {
            currentStatus = data || {};
        }

        renderStatusPanel(currentStatus, admin);

    } catch (error) {
        console.error("Error de red al cargar datos de estado:", error);
    }
}

// ----------------------------------------------------
// FUNCIONES CLAVE DE PERSISTENCIA (Modificada para Edición Completa y Status)
// ----------------------------------------------------

async function loadData() {
    try {
        const { data, error } = await supabase
            .from('items')
            .select('id, emoji, titulo, contenido, last_edited_timestamp')
            .order('id', { ascending: true }); 

        if (error) throw error;

        if (data && data.length > 0) {
            currentData = data; 
            DOMElements.contenedor.innerHTML = data.map((item, index) => createCardHTML(item, index)).join('');
            
            document.querySelectorAll('.card').forEach(card => {
                card.removeEventListener('click', toggleTimePanel); 
                card.addEventListener('click', toggleTimePanel);
            });

        } else {
            DOMElements.contenedor.innerHTML = "<p style='grid-column: 1 / -1; text-align: center; color: var(--acento-rojo);'>⚠️ Error al cargar los datos.</p>";
        }
    } catch (error) {
        DOMElements.contenedor.innerHTML = "<p style='grid-column: 1 / -1; text-align: center; color: var(--acento-rojo);'>❌ Error de conexión a la base de datos.</p>";
    }
}

async function saveChanges(){
    if (!admin) { alert("Acceso denegado."); return; }
  
    const cardElements = document.querySelectorAll(".card");
    let updatePromises = [];
    let hasChanges = false;
    const nuevoTimestamp = new Date().toISOString(); 
    
    // --- LÓGICA PARA GUARDAR CARDS (ORIGINAL) ---
    for (const card of cardElements) {
        const dbId = card.getAttribute('data-id'); 
        const index = parseInt(card.getAttribute('data-index')); 
        
        const editableEmoji = card.querySelector('.editable-emoji');
        const editableTitle = card.querySelector('.editable-title');
        const editableContent = card.querySelector('.editable-content');

        const oldEmoji = editableEmoji ? editableEmoji.defaultValue : '';
        const newEmoji = editableEmoji ? editableEmoji.value : '';
        const oldTitle = editableTitle ? editableTitle.defaultValue : '';
        const newTitle = editableTitle ? editableTitle.value : '';
        const oldContent = editableContent ? editableContent.defaultValue : '';
        const newContent = editableContent ? editableContent.value : '';
        
        if (newEmoji !== oldEmoji || newTitle !== oldTitle || newContent !== oldContent) {
            hasChanges = true;
            
            const cardUpdateObject = { 
                emoji: newEmoji,
                titulo: newTitle,
                contenido: newContent, 
                last_edited_timestamp: nuevoTimestamp 
            };
            
            updatePromises.push(
                supabase.from('items').update(cardUpdateObject).eq('id', dbId)
            );
            
            if (editableEmoji) editableEmoji.defaultValue = newEmoji;
            if (editableTitle) editableTitle.defaultValue = newTitle;
            if (editableContent) editableContent.defaultValue = newContent;
            currentData[index].emoji = newEmoji;
            currentData[index].titulo = newTitle;
            currentData[index].contenido = newContent;
            currentData[index].last_edited_timestamp = nuevoTimestamp;
        }
    }
    
    // ⭐ LÓGICA DE GUARDADO PARA EL PANEL DE ESTADO (MODIFICADO) ⭐
    const editDeficit = document.getElementById('editDeficit');
    const editDollar = document.getElementById('editDollar');
    const editEuro = document.getElementById('editEuro');
    
    if (editDeficit && editDollar && editEuro) {
        
        const newDeficit = editDeficit.value.trim();
        const newDollar = parseInt(editDollar.value);
        const newEuro = parseInt(editEuro.value);

        let statusUpdate = {};
        let needsStatusUpdate = false;

        // 1. Verificar y preparar el update del DÉFICIT
        if (newDeficit !== (currentStatus.deficit_mw || '')) {
            statusUpdate.deficit_mw = newDeficit;
            statusUpdate.deficit_edited_at = nuevoTimestamp; // Actualizar solo el tiempo de déficit
            needsStatusUpdate = true;
        }

        // 2. Verificar y preparar el update de las DIVISAS
        if (newDollar !== currentStatus.dollar_cup || newEuro !== currentStatus.euro_cup) {
            statusUpdate.dollar_cup = newDollar;
            statusUpdate.euro_cup = newEuro;
            statusUpdate.divisa_edited_at = nuevoTimestamp; // Actualizar solo el tiempo de divisas
            needsStatusUpdate = true;
        }
        
        // 3. Crear una única promesa de actualización si hay cambios
        if (needsStatusUpdate) {
            hasChanges = true;
            updatePromises.push(
                supabase.from('status_data').update(statusUpdate).eq('id', 1)
            );
        }
    }

    if (!hasChanges) {
        alert("No se detectaron cambios para guardar.");
        return;
    }

    try {
        const results = await Promise.all(updatePromises);
        const failedUpdates = results.filter(r => r.error);
        
        if (failedUpdates.length > 0) {
            const error = failedUpdates[0].error;
            const errorMessage = error.message || (error.error ? error.error.message : "Error desconocido en la base de datos.");
            console.error("Error al guardar en Supabase:", errorMessage, error);
            alert(`❌ Error al guardar. Verifica RLS de UPDATE. Detalle: ${errorMessage}`);
            return;
        }

        updateHeaderTime();
        alert("✅ Cambios guardados permanentemente.");

    } catch (error) {
        const errorMessage = error.message || "Error de red o desconocido al guardar.";
        console.error("Error al guardar en Supabase:", errorMessage, error);
        alert(`❌ Error al guardar. Detalle: ${errorMessage}`);
    }

    await loadData(); 
    await loadStatusData(); 
    if (admin) {
        setTimeout(enableEditing, 500); 
    }
}

function updateHeaderTime() {
    const options = {
        timeZone: 'America/Havana', 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    };
    const formattedDate = new Intl.DateTimeFormat('es-ES', options).format(new Date());

    document.getElementById('fecha-actualizacion').textContent = `${formattedDate} (CUBA)`;
}


// ----------------------------------------------------
// MANEJO DE EVENTOS Y CARGA INICIAL
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    
    // MODIFICADO: Sustitución de loginBtn/logoutBtn por toggleAdminBtn
    DOMElements.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    
    DOMElements.saveBtn.addEventListener('click', saveChanges);
    DOMElements.addNewsBtn.addEventListener('click', addQuickNews);
    DOMElements.deleteNewsBtn.addEventListener('click', deleteNews);
    DOMElements.publishCommentBtn.addEventListener('click', publishComment); 
    
    updateHeaderTime(); 
    
    // NUEVO: Funciones para el contador de vistas
    registerPageView();
    getAndDisplayViewCount();
    
    loadData();
    loadNews();
    loadComments(); 
    loadStatusData(); 
    
    window.addEventListener('resize', () => {
        if (window.resizeTimer) clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(loadNews, 150);
    });
});
