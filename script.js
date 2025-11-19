// ----------------------------------------------------
// 🚨 CONFIGURACIÓN DE SUPABASE (POSTGRESQL BAAS) 🚨
// ----------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 

// ----------------------------------------------------
// 💵 CONFIGURACIÓN API EL TOQUE 💵
// ----------------------------------------------------
const ELTOQUE_API_URL = "https://app.eltoque.com/api/v1/tasa";
// ¡ATENCIÓN! Asegúrate de que este token es válido. Si da error 401/403, debes renovarlo.
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lKdWmT1qyAvzLUfl1-8";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let admin = false; 

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

// 🔑 LÓGICA DE USUARIO WEB ÚNICO
let userWebId = localStorage.getItem('userWebId');
if (!userWebId) {
    userWebId = crypto.randomUUID(); 
    localStorage.setItem('userWebId', userWebId);
}

// Elementos del DOM
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
    statusMessage: document.getElementById('statusMessage'),
    toggleAdminBtn: document.getElementById('toggleAdminBtn'),
    saveBtn: document.getElementById('saveBtn'),
    addNewsBtn: document.getElementById('addNewsBtn'),
    deleteNewsBtn: document.getElementById('deleteNewsBtn'),
    dynamicTickerStyles: document.getElementById('dynamicTickerStyles'),
    statusPanel: document.getElementById('statusPanel'),
    statusDataContainer: document.getElementById('statusDataContainer'),
    lastEditedTime: document.getElementById('lastEditedTime')
};

// ----------------------------------------------------
// FUNCIÓN DE FORMATO DE TIEMPO
// ----------------------------------------------------
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
    if (DAYS >= 1) text = `hace ${DAYS} d`;
    else if (HOURS >= 1) text = `hace ${HOURS} h`;
    else if (MINUTES >= 1) text = `hace ${MINUTES} m`;
    else text = 'hace instantes';
    
    return { text, diff, date: new Date(timestamp) };
}

// ----------------------------------------------------
// 📡 CONSULTA API EL TOQUE (CON DEBUG EN EL DOM)
// ----------------------------------------------------
async function fetchElToqueRates() {
    // Si no es modo admin, no mostramos el mensaje de debug tan intrusivo
    if (admin) DOMElements.statusMessage.textContent = "Verificando API El Toque..."; 

    try {
        const response = await fetch(ELTOQUE_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ELTOQUE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorStatus = response.status;
            const errorText = `❌ ERROR API: Código ${errorStatus}. Token/URL inválido.`;
            if (admin) {
                DOMElements.statusMessage.textContent = errorText; 
                DOMElements.statusMessage.style.color = "var(--acento-rojo)"; 
            }
            console.error(errorText);
            return null;
        }

        const data = await response.json();
        if (admin) {
            DOMElements.statusMessage.textContent = "✅ API El Toque OK. Actualizando precios...";
            DOMElements.statusMessage.style.color = "var(--acento-verde)"; 
        }

        // Extracción de valores
        let usdVal = '---';
        let eurVal = '---';
        
        if (data.tasas) { 
            usdVal = data.tasas.USD || data.tasas.USDT || '---';
            eurVal = data.tasas.EUR || '---';
        } else if (data.USD && data.EUR) { 
            usdVal = data.USD;
            eurVal = data.EUR;
        }

        // Devolvemos los valores enteros
        return { 
            usd: Math.floor(Number(usdVal) || 0), 
            eur: Math.floor(Number(eurVal) || 0) 
        };

    } catch (error) {
        const failText = "❌ Error de CONEXIÓN a la API (Red).";
        if (admin) {
            DOMElements.statusMessage.textContent = failText; 
            DOMElements.statusMessage.style.color = "var(--acento-rojo)"; 
        }
        console.error("Error al conectar o procesar El Toque:", error);
        return null;
    }
}

// ----------------------------------------------------
// 📊 PANEL DE ESTADO Y AUTO-GUARDADO (MODIFICADO)
// ----------------------------------------------------
async function loadStatusData() {
    try {
        // 1. Obtener estado actual de la BD
        const { data: dbData } = await supabase.from('status_data').select('*').eq('id', 1).single();
        
        // 2. Obtener tasas frescas de la API
        const apiData = await fetchElToqueRates();

        currentStatus = dbData || { deficit_mw: '---', dollar_cup: 0, euro_cup: 0 };
        
        // --- 🔑 LÓGICA DE AUTO-GUARDADO DE DIVISAS 🔑 ---
        let needsAutoSave = false;
        let autoUpdate = {};

        if (apiData) {
            
            // A. Verificar si el Dólar ha cambiado (Importante: comparamos enteros)
            if (apiData.usd !== currentStatus.dollar_cup) {
                autoUpdate.dollar_cup = apiData.usd;
                autoUpdate.divisa_edited_at = new Date().toISOString(); 
                needsAutoSave = true;
            }
            
            // B. Verificar si el Euro ha cambiado
            if (apiData.eur !== currentStatus.euro_cup) {
                autoUpdate.euro_cup = apiData.eur;
                autoUpdate.divisa_edited_at = new Date().toISOString(); 
                needsAutoSave = true;
            }

            // C. Si hay cambios en USD o EUR, guardar automáticamente
            if (needsAutoSave) {
                console.log("💰 Auto-Guardando nuevas tasas de cambio...");
                const { error } = await supabase.from('status_data')
                    .update(autoUpdate)
                    .eq('id', 1);
                
                if (error) {
                    console.error("Error al auto-guardar las divisas:", error);
                } else {
                     console.log("✅ Auto-Guardado de divisas completado.");
                     
                     // Actualizamos currentStatus en memoria con los nuevos valores guardados
                     currentStatus = { ...currentStatus, ...autoUpdate };
                }
            } else {
                 console.log("Precios de divisas sin cambios. No se requiere auto-guardado.");
            }
        }
        // --- FIN DE LÓGICA DE AUTO-GUARDADO ---

        // 3. Renderizar el panel con los datos más recientes (BD o API)
        renderStatusPanel(currentStatus, admin);

    } catch (error) {
        console.error("Error loadStatusData:", error);
    }
}

function renderStatusPanel(status, isAdminMode) {
    if (!status || !DOMElements.statusDataContainer) {
        DOMElements.statusDataContainer.innerHTML = "Cargando...";
        return;
    }

    const deficitTime = new Date(status.deficit_edited_at || 0).getTime();
    const { text: timeText } = timeAgo(deficitTime);
    DOMElements.lastEditedTime.innerHTML = `Actualizado:<br> ${timeText}`;
    
    // Estilo para evitar inputs gigantes en modo edición
    const inputStyle = "width: 65px; font-size: 0.9rem; padding: 2px; text-align: center; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;";
    const disabledStyle = "background: #eee; color: #555; cursor: not-allowed;";

    if (isAdminMode) {
        // MODO ADMIN: Inputs pequeños y controlados
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item">
                <span class="label">Deficit (MW):</span>
                <input type="text" id="editDeficit" value="${status.deficit_mw || ''}" style="${inputStyle}" placeholder="Ej: 1800">
            </div>
            <div class="status-item">
                <span class="label">USD (Auto):</span>
                <input type="number" id="editDollar" value="${status.dollar_cup || ''}" disabled style="${inputStyle} ${disabledStyle}" title="Se actualiza solo con El Toque">
            </div>
            <div class="status-item">
                <span class="label">EUR (Auto):</span>
                <input type="number" id="editEuro" value="${status.euro_cup || ''}" disabled style="${inputStyle} ${disabledStyle}" title="Se actualiza solo con El Toque">
            </div>
        `;
    } else {
        // MODO VISUALIZACIÓN
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item deficit">
                <span class="label">🔌 Déficit:</span>
                <span class="value">${status.deficit_mw || '---'}</span>
            </div>
            <div class="status-item divisa">
                <span class="label">💵 USD:</span>
                <span class="value">${status.dollar_cup || '---'}</span>
            </div>
            <div class="status-item divisa">
                <span class="label">💶 EUR:</span>
                <span class="value">${status.euro_cup || '---'}</span>
            </div>
        `;
    }
}

// ----------------------------------------------------
// ⚙️ FUNCIONES DE UI Y LOGIN
// ----------------------------------------------------

function updateAdminUI(isAdmin) {
    admin = isAdmin;
    if (isAdmin) {
        DOMElements.body.classList.add('admin-mode');
        DOMElements.adminControlsPanel.style.display = "flex";
        DOMElements.statusMessage.textContent = "¡🔴 EDITA CON RESPONSABILIDAD!";
        DOMElements.statusMessage.style.color = "#0d9488"; 
        DOMElements.toggleAdminBtn.textContent = "🛑 SALIR DEL MODO EDICIÓN"; 
        DOMElements.toggleAdminBtn.style.backgroundColor = "var(--acento-rojo)";
        enableEditing(); 
    } else {
        DOMElements.body.classList.remove('admin-mode');
        DOMElements.adminControlsPanel.style.display = "none";
        DOMElements.statusMessage.textContent = "Accede a modo edición para actualizar"; 
        DOMElements.statusMessage.style.color = "var(--color-texto-principal)"; 
        DOMElements.toggleAdminBtn.textContent = "🛡️ ACTIVAR EL MODO EDICIÓN"; 
        DOMElements.toggleAdminBtn.style.backgroundColor = "#4f46e5"; 
        disableEditing(); 
    }
    
    renderStatusPanel(currentStatus, isAdmin);
}

function toggleAdminMode() {
    if (!admin) {
        updateAdminUI(true);
        loadStatusData(); 
    } else {
        if (!confirm("✅️ ¿Terminar la edición?")) return;
        updateAdminUI(false);
        loadData(); 
        loadStatusData(); 
    }
}

function enableEditing() { toggleEditing(true); }
function disableEditing() { toggleEditing(false); }

// ----------------------------------------------------
// 💾 GUARDADO DE DATOS (AHORA SOLO GUARDA DÉFICIT Y CARDS)
// ----------------------------------------------------

async function saveChanges(){
    if (!admin) { alert("Acceso denegado."); return; }
  
    const cardElements = document.querySelectorAll(".card");
    let updatePromises = [];
    let hasChanges = false;
    const nuevoTimestamp = new Date().toISOString(); 
    
    // 1. GUARDAR CARDS (Lógica original)
    for (const card of cardElements) {
        const dbId = card.getAttribute('data-id'); 
        
        const editableEmoji = card.querySelector('.editable-emoji');
        const editableTitle = card.querySelector('.editable-title');
        const editableContent = card.querySelector('.editable-content');

        if (editableEmoji && editableTitle && editableContent) {
            const newEmoji = editableEmoji.value;
            const newTitle = editableTitle.value;
            const newContent = editableContent.value;
            
            if (newEmoji !== editableEmoji.defaultValue || 
                newTitle !== editableTitle.defaultValue || 
                newContent !== editableContent.defaultValue) {
                
                hasChanges = true;
                updatePromises.push(
                    supabase.from('items').update({ 
                        emoji: newEmoji,
                        titulo: newTitle,
                        contenido: newContent, 
                        last_edited_timestamp: nuevoTimestamp 
                    }).eq('id', dbId)
                );
            }
        }
    }
    
    // 2. GUARDAR ESTADO (SOLO DÉFICIT MANUAL)
    const editDeficit = document.getElementById('editDeficit');

    if (editDeficit) {
        const newDeficit = editDeficit.value.trim();
        let statusUpdate = {};
        let needsStatusUpdate = false;

        // Verificar cambio en DÉFICIT (Manual)
        if (newDeficit !== (currentStatus.deficit_mw || '')) {
            statusUpdate.deficit_mw = newDeficit;
            statusUpdate.deficit_edited_at = nuevoTimestamp; 
            needsStatusUpdate = true;
        }

        // NO TOCAMOS DOLLAR_CUP Y EURO_CUP aquí, porque se auto-guardan.
        // Solo guardamos si hay un cambio manual en el déficit.
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
            throw failedUpdates[0].error;
        }

        updateHeaderTime();
        alert("✅ Cambios manuales guardados (Déficit + Tarjetas).");

    } catch (error) {
        console.error("Error al guardar:", error);
        alert(`❌ Error al guardar: ${error.message}`);
    }

    await loadData(); 
    await loadStatusData(); 
    if (admin) setTimeout(enableEditing, 500); 
}

// ----------------------------------------------------
// FUNCIONES AUXILIARES RESTANTES
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
            labelHTML = '<div class="card-label" style="background-color: var(--acento-rojo); color: white; display: block;">!NUEVO!</div>';
            panelStyle = `background: var(--tiempo-panel-rojo); color: var(--acento-rojo);`; 
        } else if (diff >= OLD_THRESHOLD_MS) {
            cardClass = 'card-old';
            panelStyle = `background: var(--tiempo-panel-cian); color: var(--acento-cian);`;
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
        <div class="card-content"><p>${item.contenido}</p></div>
        <div class="card-time-panel" data-id="${item.id}" style="${panelStyle}">
            <strong>${labelText}</strong> (${timeText})
        </div>
    </div>`;
}

function toggleEditing(enable) {
    const cards = document.querySelectorAll(".card");
    const inputStyle = "width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;";
    
    cards.forEach(card => {
        const item = currentData[card.getAttribute('data-index')];
        const contentDiv = card.querySelector('.card-content');
        
        if (enable) {
            card.classList.remove('card-recent', 'card-old');
            card.querySelector('.card-time-panel').style.display = 'none';
            
            const emoji = card.querySelector('.emoji');
            const title = card.querySelector('h3');
            const content = contentDiv.querySelector('p');
            
            if (emoji) {
                const input = document.createElement('input');
                input.className = 'editable-emoji';
                input.value = item.emoji;
                input.defaultValue = item.emoji; 
                input.style = inputStyle + "width: 40px; text-align: center;";
                card.insertBefore(input, emoji);
                emoji.remove();
            }
            if (title) {
                const input = document.createElement('input');
                input.className = 'editable-title';
                input.value = item.titulo;
                input.defaultValue = item.titulo;
                input.style = inputStyle;
                card.insertBefore(input, title);
                title.remove();
            }
            if (content) {
                const input = document.createElement('textarea');
                input.className = 'editable-content';
                input.value = item.contenido;
                input.defaultValue = item.contenido;
                input.style = inputStyle + "height: 100px; resize: vertical;";
                contentDiv.appendChild(input);
                content.remove();
            }
        }
    });
}

function toggleTimePanel(event) {
    if (admin) return;
    const clickedCard = event.currentTarget;
    const cardId = clickedCard.getAttribute('data-id'); 
    
    document.querySelectorAll('.card').forEach(c => {
        if (c.getAttribute('data-id') !== cardId) c.classList.remove('show-time-panel');
    });
    clickedCard.classList.toggle('show-time-panel');
}

function linkify(text) {
    return text.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1' target='_blank'>$1</a>");
}

// --- NOTICIAS ---
async function loadNews() {
    const { data: newsData } = await supabase.from('noticias').select('*').order('timestamp', { ascending: false });
    
    const validNews = newsData ? newsData.filter(n => (Date.now() - new Date(n.timestamp).getTime()) < RECENT_THRESHOLD_MS) : [];
    currentNews = validNews;

    if (validNews.length > 0) {
        const newsHtml = validNews.map(n => `<span class="news-item">${linkify(n.text)}</span>`).join('<span class="news-item"> | </span>');
        DOMElements.newsTickerContent.innerHTML = `${newsHtml}<span class="news-item"> | </span>${newsHtml}`; 
        
        const width = DOMElements.newsTickerContent.scrollWidth / 2;
        const duration = width / NEWS_SCROLL_SPEED_PX_PER_SEC;
        DOMElements.dynamicTickerStyles.innerHTML = `@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-${width}px); } }`;
        DOMElements.newsTickerContent.style.animation = `ticker ${duration}s linear infinite`;
        DOMElements.newsTicker.style.display = 'flex';
    } else {
        DOMElements.newsTicker.style.display = 'none';
    }
}

async function addQuickNews() {
    if (!admin) return;
    const text = prompt("Nueva noticia (24h):");
    if (text) {
        await supabase.from('noticias').insert([{ text }]);
        loadNews();
    }
}

async function deleteNews() {
    if (!admin || currentNews.length === 0) return;
    const ids = currentNews.map((n, i) => `${i+1}. ${n.text}`).join('\n');
    const sel = prompt(`Eliminar número:\n${ids}`);
    if (sel && currentNews[sel-1]) {
        await supabase.from('noticias').delete().eq('id', currentNews[sel-1].id);
        loadNews();
    }
}

// ----------------------------------------------------
// 🗣️ LÓGICA DE COMENTARIOS, HILOS Y LIKES
// ----------------------------------------------------

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
        supabase.from('comentarios').select('id, name, text, timestamp, parent_id, likes_count').order('timestamp', { ascending: false }),
        supabase.from('likes').select('comment_id').eq('user_web_id', userWebId)
    ]);
    
    if (commentsResponse.error) {
        DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: var(--acento-rojo);">❌ Error al cargar comentarios.</p>`;
        return;
    }
    
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
        DOMElements.commentsContainer.innerHTML = `<p style="text-align: center; color: #888; margin: 15px;">Aún no hay comentarios. ¡Sé el primero!</p>`;
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
            if (repliesContainer) drawReplies(repliesContainer, replies, userLikesMap);
        }
    });

    document.querySelectorAll('.reply-form-toggle').forEach(btn => btn.addEventListener('click', toggleReplyForm));
    document.querySelectorAll('.publish-reply-btn').forEach(btn => btn.addEventListener('click', handlePublishReply));
    document.querySelectorAll('.like-button').forEach(btn => btn.addEventListener('click', handleLikeToggle));
}

function toggleReplyForm(event) {
    const commentId = event.target.getAttribute('data-id');
    const form = document.querySelector(`.reply-form[data-reply-to="${commentId}"]`);
    if (form) {
        document.querySelectorAll('.reply-form').forEach(f => { if (f !== form) f.style.display = 'none'; });
        form.style.display = form.style.display === 'block' ? 'none' : 'block';
        if (form.style.display === 'block') form.querySelector('.reply-name').focus();
    }
}

async function publishComment() {
    const name = DOMElements.commenterName.value.trim();
    const text = DOMElements.commentText.value.trim();
    
    if (name.length < 2 || text.length < 5) {
        alert("Ingresa un nombre (mín. 2) y comentario (mín. 5).");
        return;
    }
    
    DOMElements.publishCommentBtn.disabled = true;
    DOMElements.publishCommentBtn.textContent = "Publicando...";

    try {
        const { error } = await supabase.from('comentarios').insert([{ name, text, parent_id: null, likes_count: 0 }]);
        if (error) throw error;

        DOMElements.commenterName.value = '';
        DOMElements.commentText.value = '';
        await loadComments(); 
        alert("✅ Comentario publicado.");
    } catch (error) {
        console.error("Error comentarios:", error);
        alert("❌ Error al publicar.");
    } finally {
        DOMElements.publishCommentBtn.disabled = false;
        DOMElements.publishCommentBtn.textContent = "Publicar Comentario";
    }
}

async function handlePublishReply(event) {
    const parentId = event.target.getAttribute('data-parent-id');
    const form = event.target.closest('.reply-form');
    const name = form.querySelector('.reply-name').value.trim();
    const text = form.querySelector('.reply-text').value.trim();

    if (name.length < 2 || text.length < 5) {
        alert("Ingresa nombre y respuesta válidos.");
        return;
    }
    
    event.target.disabled = true;
    event.target.textContent = "Enviando...";

    try {
        const { error } = await supabase.from('comentarios').insert([{ name, text, parent_id: parentId, likes_count: 0 }]);
        if (error) throw error;

        form.style.display = 'none';
        await loadComments(); 
        alert("✅ Respuesta publicada.");
    } catch (error) {
        console.error("Error respuesta:", error);
        alert("❌ Error al responder.");
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
            const { error: delErr } = await supabase.from('likes').delete().eq('comment_id', commentId).eq('user_web_id', userWebId);
            if (delErr) throw delErr;

            await supabase.rpc('decrement_likes', { row_id: commentId }); 
            button.classList.remove('liked');
            counterElement.textContent = Math.max(0, currentCount - 1);
        } else {
            const { error: insErr } = await supabase.from('likes').insert([{ comment_id: commentId, user_web_id: userWebId }]);
            if (insErr && insErr.code !== '23505') throw insErr; 

            if (!insErr) {
                await supabase.rpc('increment_likes', { row_id: commentId });
                button.classList.add('liked');
                counterElement.textContent = currentCount + 1;
            }
        }
    } catch (error) {
        console.error("Error like:", error);
    } finally {
        button.disabled = false;
    }
}

// ----------------------------------------------------
// VISTAS Y PERSISTENCIA GENERAL
// ----------------------------------------------------
async function registerPageView() {
    const key = 'lastView';
    const now = Date.now();
    if (!localStorage.getItem(key) || (now - localStorage.getItem(key) > ONE_DAY)) {
        await supabase.from('page_views').insert({});
        localStorage.setItem(key, now);
    }
}

async function getAndDisplayViewCount() {
    const yesterday = new Date(Date.now() - ONE_DAY).toISOString();
    const { count } = await supabase.from('page_views').select('*', { count: 'exact', head: true }).gt('created_at', yesterday);
    if (document.getElementById('viewCounter')) document.getElementById('viewCounter').textContent = `👀 ${count || 0} vistas (24h)`;
}

async function loadData() {
    const { data } = await supabase.from('items').select('*').order('id');
    if (data) {
        currentData = data;
        DOMElements.contenedor.innerHTML = data.map((item, i) => createCardHTML(item, i)).join('');
        document.querySelectorAll('.card').forEach(c => c.addEventListener('click', toggleTimePanel));
    }
}

function updateHeaderTime() {
    const date = new Date().toLocaleString('es-ES', { timeZone: 'America/Havana' });
    document.getElementById('fecha-actualizacion').textContent = `${date} (CUBA)`;
}

// ----------------------------------------------------
// 🚀 INICIALIZACIÓN
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    DOMElements.toggleAdminBtn.addEventListener('click', toggleAdminMode);
    DOMElements.saveBtn.addEventListener('click', saveChanges);
    DOMElements.addNewsBtn.addEventListener('click', addQuickNews);
    DOMElements.deleteNewsBtn.addEventListener('click', deleteNews);
    DOMElements.publishCommentBtn.addEventListener('click', publishComment);

    updateHeaderTime();
    registerPageView();
    getAndDisplayViewCount();
    
    loadData();
    loadNews();
    loadComments(); 
    loadStatusData(); 

    // Ciclo de actualización de 3 segundos
    setInterval(loadStatusData, 3000);
    
    window.addEventListener('resize', () => {
        if (window.resizeTimer) clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(loadNews, 150);
    });
});
