// ----------------------------------------------------
// 🚨 CONFIGURACIÓN DE SUPABASE (POSTGRESQL BAAS) 🚨
// ----------------------------------------------------
// !!! NO IMPORTA QUE ESTÉ EN EL CÓDIGO DIRECTAMENTE (WEB DE PRUEBA) !!!
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 
// ----------------------------------------------------

// ⭐ AÑADIDO: CREDENCIALES DE ADMINISTRADOR ⭐
const ADMIN_USER = "Admin"; 
const ADMIN_PASS = "54321"; 
// ----------------------------------------------------

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let admin = false; // Estado global para el modo de edición

// Variables y constantes de tiempo
const ONE_HOUR = 3600000;
const STATUS_PANEL_KEY = "status_panel";
const COMMENTS_LIMIT = 50; 
let currentStatus = { title: "", content: "", edited_at: "" };


// ----------------------------------------------------\
// CONTROL DE ELEMENTOS DEL DOM
// ----------------------------------------------------\
const DOMElements = {
    // Contenedores Principales
    contenedor: document.getElementById('contenedor'),
    body: document.body,
    statusPanel: document.getElementById('statusPanel'),
    
    // Contenedor de Comentarios
    commentsContainer: document.getElementById('commentsContainer'),
    commenterName: document.getElementById('commenterName'),
    commentText: document.getElementById('commentText'),
    publishCommentBtn: document.getElementById('publishCommentBtn'),
    
    // --- ELEMENTOS DE LOGIN Y CONTROL DE EDICIÓN (ACTUALIZADO) ---
    statusMessage: document.getElementById('statusMessage'),
    loginForm: document.getElementById('loginForm'),
    adminUser: document.getElementById('adminUser'),
    adminPass: document.getElementById('adminPass'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    // --- FIN ELEMENTOS DE LOGIN ---
    
    // Controles de Administrador
    adminControlsPanel: document.getElementById('adminControlsPanel'),
    saveBtn: document.getElementById('saveBtn'),
    addNewsBtn: document.getElementById('addNewsBtn'),
    deleteNewsBtn: document.getElementById('deleteNewsBtn'),
};


// ----------------------------------------------------\
// FUNCIONES DE SUPABASE (API)
// ----------------------------------------------------\

async function fetchData(table, select = '*') {
    try {
        const { data, error } = await supabase
            .from(table)
            .select(select)
            .order('orden', { ascending: true });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error al obtener datos de ${table}:`, error.message);
        return [];
    }
}

async function updateData(table, id, updates) {
    if (!admin) return;
    try {
        const { error } = await supabase
            .from(table)
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        console.log(`Datos en ${table} actualizados (ID: ${id})`);
    } catch (error) {
        console.error(`Error al actualizar datos en ${table} (ID: ${id}):`, error.message);
    }
}

async function updateNews(updates) {
    if (!admin) return;
    try {
        const { error } = await supabase
            .from('noticias_rodillo')
            .update(updates)
            .eq('id', updates.id); 

        if (error) throw error;
        console.log(`Noticia actualizada (ID: ${updates.id})`);
    } catch (error) {
        console.error(`Error al actualizar noticia (ID: ${updates.id}):`, error.message);
    }
}

// ----------------------------------------------------\
// RENDERIZADO Y LÓGICA DE LA WEB
// ----------------------------------------------------\

function renderCards(data) {
    DOMElements.contenedor.innerHTML = data.map(item => `
        <div class="card ${item.clase_css}" data-id="${item.id}">
            <div class="card-header">
                <h3 class="card-title editable" data-field="titulo">${item.titulo}</h3>
            </div>
            <div class="card-content">
                <p class="editable" data-field="contenido">${item.contenido}</p>
                <div class="card-note editable" data-field="nota">
                    <p>${item.nota}</p>
                </div>
            </div>
        </div>
    `).join('');
}


// --- LÓGICA DE EDICIÓN EN VIVO ---
function enableEditing() {
    const editables = document.querySelectorAll('.editable');
    editables.forEach(el => {
        el.contentEditable = 'true';
    });
    
    // Habilitar edición del panel de estado
    const statusContent = document.getElementById('statusContent');
    if (statusContent) {
        statusContent.contentEditable = 'true';
    }
}

function disableEditing() {
    const editables = document.querySelectorAll('.editable');
    editables.forEach(el => {
        el.contentEditable = 'false';
    });
    
    // Deshabilitar edición del panel de estado
    const statusContent = document.getElementById('statusContent');
    if (statusContent) {
        statusContent.contentEditable = 'false';
    }
}


// ----------------------------------------------------\
// CONTROL DEL MODO ADMIN (LÓGICA DE LOGIN Y LOGOUT)
// ----------------------------------------------------\

// ⭐ MODIFICADA: Actualiza la interfaz según el estado de administración
function updateAdminUI(isAdmin) {
    admin = isAdmin;
    if (isAdmin) {
        DOMElements.body.classList.add('admin-mode');
        // ⭐ NUEVO: Control de visibilidad para login y logout
        DOMElements.loginForm.style.display = "none"; 
        DOMElements.logoutButton.style.display = "block"; 
        
        DOMElements.adminControlsPanel.style.display = "flex";
        DOMElements.statusMessage.textContent = "✅ Modo de Edición Activado. ¡No olvides guardar!";
        DOMElements.statusMessage.style.color = "#0d9488"; 
        enableEditing(); 
    } else {
        DOMElements.body.classList.remove('admin-mode');
        // ⭐ NUEVO: Control de visibilidad para login y logout
        DOMElements.loginForm.style.display = "flex"; 
        DOMElements.logoutButton.style.display = "none"; 
        
        DOMElements.adminControlsPanel.style.display = "none";
        DOMElements.statusMessage.textContent = "Accede a modo edición para actualizar la información";
        DOMElements.statusMessage.style.color = "var(--color-texto-principal)"; 
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


// ⭐ NUEVA FUNCIÓN: Maneja el intento de inicio de sesión
function handleLogin(event) {
    event.preventDefault(); // Evita que el formulario se envíe
    
    const user = DOMElements.adminUser.value.trim();
    const pass = DOMElements.adminPass.value.trim();

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        updateAdminUI(true);
        DOMElements.adminUser.value = ''; // Limpiar campos
        DOMElements.adminPass.value = '';
        alert("✅ Modo de Edición Activado. ¡No olvides guardar!");
    } else {
        alert("❌ Credenciales incorrectas. Intenta de nuevo.");
        DOMElements.adminPass.value = ''; // Limpiar solo contraseña
    }
}

// ⭐ NUEVA FUNCIÓN: Maneja el cierre de sesión
function handleLogout() {
    if (!confirm("⚠️ ¿Estás seguro de que quieres salir del Modo Edición? Los cambios no guardados se perderán.")) {
        return;
    }
    updateAdminUI(false);
    loadData(); // Recargar datos para descartar cambios
    loadStatusData(); // Recargar datos de estado para descartar cambios
}


// --- MANEJO DE CAMBIOS Y GUARDADO ---

function saveChanges() {
    if (!admin) {
        alert("Acceso denegado: No estás en Modo Edición.");
        return;
    }
    
    if (!confirm("⚠️ ¿Estás seguro de que quieres guardar los cambios en la base de datos?")) {
        return;
    }

    const cards = DOMElements.contenedor.querySelectorAll('.card');
    const updatePromises = [];

    // 1. Guardar cambios en las tarjetas (citas)
    cards.forEach(card => {
        const id = card.dataset.id;
        const updates = {};
        let changed = false;

        card.querySelectorAll('.editable').forEach(el => {
            const field = el.dataset.field;
            let newValue = el.textContent.trim();
            
            // Si es la nota, extraemos el contenido del <p> interno
            if (field === 'nota') {
                newValue = el.querySelector('p').textContent.trim();
            }

            // Buscar el valor original en la estructura de datos (si estuviera cargada)
            // Por simplicidad, aquí solo asumimos que si contentEditable está activo, puede haber cambiado.
            updates[field] = newValue;
            changed = true;
        });

        if (changed && id) {
            updatePromises.push(updateData('citas', id, updates));
        }
    });

    // 2. Guardar cambios en el panel de estado
    const statusContentEl = document.getElementById('statusContent');
    const newStatusContent = statusContentEl ? statusContentEl.textContent.trim() : '';

    if (newStatusContent !== currentStatus.content) {
        const statusUpdates = {
            id: currentStatus.id,
            content: newStatusContent,
            edited_at: new Date().toISOString()
        };
        updatePromises.push(updateStatusPanelData(statusUpdates));
    }

    Promise.all(updatePromises)
        .then(() => {
            alert("✅ Todos los cambios han sido guardados exitosamente.");
            // Recargar datos para asegurar la consistencia y desactivar contentEditable
            loadData();
            loadStatusData();
        })
        .catch(err => {
            alert(`❌ Error al guardar algunos cambios. Revisa la consola.`);
            console.error("Error al guardar:", err);
        });
}


// ----------------------------------------------------\
// LÓGICA DE ESTADO (PANEL ECONÓMICO/ENERGÉTICO)
// ----------------------------------------------------\

async function loadStatusData() {
    try {
        const { data, error } = await supabase
            .from('estado_general')
            .select('*')
            .eq('clave', STATUS_PANEL_KEY)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignorar 'no rows found'
        
        if (data) {
            currentStatus = data; // Almacenar el estado actual
            renderStatusPanel(data, admin);
        } else {
            console.warn("No se encontró el panel de estado.");
        }

    } catch (error) {
        console.error("Error al cargar datos del panel de estado:", error.message);
    }
}

function renderStatusPanel(data, isAdmin) {
    const statusContentEl = document.getElementById('statusContent');
    const lastEditedTimeEl = document.getElementById('lastEditedTime');
    
    if (statusContentEl && data) {
        // Renderizar contenido
        let content = data.content || "Información no disponible.";
        if (!isAdmin) {
             // Reemplaza las líneas de "Admin:" si no está en modo admin
             content = content.replace(/Admin:[\s\S]*$/m, '').trim();
        }
        statusContentEl.textContent = content;

        // Renderizar tiempo de edición
        if (data.edited_at) {
            const date = new Date(data.edited_at);
            const options = {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            };
            const formattedDate = new Intl.DateTimeFormat('es-ES', options).format(date);
            lastEditedTimeEl.textContent = `Última edición: ${formattedDate}`;
        } else {
            lastEditedTimeEl.textContent = `Última edición: Desconocida`;
        }
    }
}


async function updateStatusPanelData(updates) {
    if (!admin) return;
    try {
        const { error } = await supabase
            .from('estado_general')
            .update(updates)
            .eq('clave', STATUS_PANEL_KEY);

        if (error) throw error;
        console.log(`Panel de estado actualizado.`);
        loadStatusData(); // Recargar para actualizar UI y currentStatus
    } catch (error) {
        console.error(`Error al actualizar el panel de estado:`, error.message);
        throw error; // Re-lanzar para que saveChanges sepa que falló
    }
}

// ----------------------------------------------------\
// LÓGICA DE NOTICIAS (RODILLO)
// ----------------------------------------------------\

async function loadNews() {
    try {
        const newsData = await fetchData('noticias_rodillo', 'id, contenido, clase_css');
        if (newsData.length > 0) {
            renderNewsTicker(newsData);
        } else {
            console.log("No hay noticias en el rodillo.");
            // Opcional: Mostrar un mensaje estático si no hay noticias
        }
    } catch (error) {
        console.error("Error al cargar las noticias:", error);
    }
}

function renderNewsTicker(data) {
    let styleEl = document.getElementById('dynamicTickerStyles');
    if (!styleEl) return; 

    // 1. Crear el contenido del ticker
    const tickerContent = data.map(item => 
        `<span class="ticker-item ${item.clase_css}">${item.contenido}</span>`
    ).join(' * '); 
    
    // Duplicar el contenido para asegurar el loop
    const fullContent = tickerContent + ' * ' + tickerContent;
    
    // Crear el elemento del ticker
    let tickerContainer = document.querySelector('.ticker-container');
    if (!tickerContainer) {
        tickerContainer = document.createElement('div');
        tickerContainer.className = 'ticker-container';
        document.querySelector('header').appendChild(tickerContainer);
    }
    
    let newsTicker = document.querySelector('.news-ticker');
    if (!newsTicker) {
        newsTicker = document.createElement('div');
        newsTicker.className = 'news-ticker';
        tickerContainer.appendChild(newsTicker);
    }
    newsTicker.innerHTML = fullContent;


    // 2. Calcular la duración de la animación
    // Usamos un div temporal para medir el ancho
    const tempDiv = document.createElement('div');
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.position = 'absolute';
    tempDiv.style.whiteSpace = 'nowrap';
    tempDiv.innerHTML = fullContent;
    document.body.appendChild(tempDiv);
    
    const contentWidth = tempDiv.offsetWidth / 2; // Ancho de una sola repetición
    document.body.removeChild(tempDiv);

    // Duración de la animación: 1 segundo por cada 100 píxeles de ancho
    const duration = contentWidth / 100; // Ajusta este factor para cambiar la velocidad

    // 3. Insertar los estilos dinámicos
    styleEl.textContent = `
        @keyframes tickerAnimation {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-${contentWidth}px, 0, 0); }
        }
        .news-ticker {
            animation-name: tickerAnimation;
            animation-duration: ${duration}s;
            animation-delay: 0s;
        }
    `;
}

async function addQuickNews() {
    if (!admin) return;

    const content = prompt("Escribe el contenido de la nueva noticia para el rodillo (máx. 100 caracteres):");
    if (content === null || content.trim() === "") return;
    if (content.length > 100) {
        alert("El contenido excede los 100 caracteres. Intenta de nuevo.");
        return;
    }

    const { data: maxOrder, error: maxOrderError } = await supabase
        .from('noticias_rodillo')
        .select('orden')
        .order('orden', { ascending: false })
        .limit(1)
        .single();
        
    const newOrder = maxOrder ? maxOrder.orden + 1 : 1;

    try {
        const { error } = await supabase
            .from('noticias_rodillo')
            .insert([{ 
                contenido: content.trim(), 
                clase_css: 'news-default', 
                orden: newOrder
            }]);

        if (error) throw error;
        alert("✅ Noticia añadida al rodillo.");
        loadNews(); // Recargar el rodillo para mostrar la nueva noticia
    } catch (error) {
        console.error("Error al añadir noticia:", error.message);
        alert("❌ No se pudo añadir la noticia.");
    }
}

async function deleteNews() {
    if (!admin) return;

    const newsData = await fetchData('noticias_rodillo', 'id, contenido, orden');
    if (newsData.length === 0) {
        alert("No hay noticias para eliminar.");
        return;
    }

    const newsList = newsData.map(n => `[${n.orden}] - ${n.contenido}`).join('\n');
    const orderToDelete = prompt(`Escribe el NÚMERO DE ORDEN de la noticia que deseas eliminar:\n\n${newsList}`);

    if (orderToDelete === null || orderToDelete.trim() === "") return;

    const targetNews = newsData.find(n => n.orden.toString() === orderToDelete.trim());

    if (!targetNews) {
        alert("Número de orden no encontrado.");
        return;
    }

    if (!confirm(`⚠️ ¿Estás seguro de eliminar la noticia: "${targetNews.contenido}"?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('noticias_rodillo')
            .delete()
            .eq('id', targetNews.id);

        if (error) throw error;
        alert("✅ Noticia eliminada y base de datos actualizada.");
        loadNews(); // Recargar el rodillo
    } catch (error) {
        console.error("Error al eliminar noticia:", error.message);
        alert("❌ No se pudo eliminar la noticia.");
    }
}

// ----------------------------------------------------\
// LÓGICA DE COMENTARIOS
// ----------------------------------------------------\

async function loadComments() {
    try {
        const { data, error } = await supabase
            .from('comentarios')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(COMMENTS_LIMIT);

        if (error) throw error;
        renderComments(data);
    } catch (error) {
        console.error("Error al cargar comentarios:", error.message);
        DOMElements.commentsContainer.innerHTML = '<p style="text-align: center; color: var(--acento-rojo); margin: 15px;">❌ Error al cargar los comentarios.</p>';
    }
}

function renderComments(comments) {
    if (comments.length === 0) {
        DOMElements.commentsContainer.innerHTML = '<p style="text-align: center; color: var(--color-texto-secundario); margin: 15px;">Aún no hay comentarios. ¡Sé el primero en publicar!</p>';
        return;
    }

    DOMElements.commentsContainer.innerHTML = comments.map(comment => {
        const date = new Date(comment.created_at);
        const dateString = date.toLocaleDateString('es-ES', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
        
        const likesCount = comment.likes_count || 0;

        return `
            <div class="comment-item" data-id="${comment.id}">
                <div class="comment-item-header">
                    <span class="comment-name">${comment.name}</span>
                    <span class="comment-date">${dateString}</span>
                </div>
                <p class="comment-text">${comment.text}</p>
                <div class="comment-actions">
                    <button class="like-btn" data-comment-id="${comment.id}">👍 Me Gusta</button>
                    <span class="like-count ${likesCount > 0 ? 'active' : ''}">${likesCount}</span>
                    <button class="delete-comment-btn" data-comment-id="${comment.id}" style="${admin ? 'display: block;' : 'display: none;'}">🗑️ Eliminar</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Añadir listener para los botones de eliminar (ya que se renderizan dinámicamente)
    document.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', handleDeleteComment);
    });
    
    // Añadir listener para los botones de like (delegación sería mejor, pero esto funciona)
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', handleLikeComment);
    });
}

async function publishComment() {
    const name = DOMElements.commenterName.value.trim();
    const text = DOMElements.commentText.value.trim();

    if (name === "" || text === "") {
        alert("Por favor, rellena tu nombre y el comentario.");
        return;
    }
    
    if (name.length > 30) {
        alert("El nombre no puede exceder los 30 caracteres.");
        return;
    }
    if (text.length > 250) {
        alert("El comentario no puede exceder los 250 caracteres.");
        return;
    }
    
    DOMElements.publishCommentBtn.disabled = true;

    try {
        const { error } = await supabase
            .from('comentarios')
            .insert([{ name, text }]);

        if (error) throw error;
        
        alert("✅ Comentario publicado con éxito.");
        DOMElements.commenterName.value = '';
        DOMElements.commentText.value = '';
        loadComments(); // Recargar la lista para mostrar el nuevo comentario
        
    } catch (error) {
        console.error("Error al publicar comentario:", error.message);
        alert("❌ No se pudo publicar el comentario. Intenta de nuevo.");
    } finally {
        DOMElements.publishCommentBtn.disabled = false;
    }
}

async function handleLikeComment(e) {
    const btn = e.target;
    const commentId = btn.dataset.commentId;
    
    try {
        const { data, error } = await supabase.rpc('increment_comment_like', { comment_id: commentId });
        
        if (error) throw error;
        
        // Actualizar el contador en la UI
        const likeCountEl = btn.nextElementSibling; // El span del contador
        const newCount = data[0].likes_count;
        
        likeCountEl.textContent = newCount;
        likeCountEl.classList.toggle('active', newCount > 0);
        
    } catch (error) {
        console.error("Error al dar 'Me Gusta':", error.message);
    }
}


async function handleDeleteComment(e) {
    if (!admin) return;

    const commentId = e.target.dataset.commentId;
    if (!confirm("⚠️ ¿Estás seguro de que deseas eliminar este comentario?")) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('comentarios')
            .delete()
            .eq('id', commentId);

        if (error) throw error;
        
        alert("✅ Comentario eliminado.");
        loadComments(); // Recargar la lista
        
    } catch (error) {
        console.error("Error al eliminar comentario:", error.message);
        alert("❌ No se pudo eliminar el comentario.");
    }
}


// ----------------------------------------------------\
// LÓGICA DE CARGA INICIAL
// ----------------------------------------------------\

async function loadData() {
    const data = await fetchData('citas');
    if (data.length > 0) {
        renderCards(data);
    } else {
        DOMElements.contenedor.innerHTML = '<p style="text-align: center; margin-top: 50px; color: var(--color-texto-secundario);">No hay trámites disponibles para mostrar.</p>';
    }
    // Desactivar contentEditable después de la carga inicial
    setTimeout(disableEditing, 500); 
}

// Función auxiliar para actualizar la hora en el header (se mantiene)
function updateHeaderTime() {
    const options = {
        timeZone: 'America/Havana', 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    };
    const formattedDate = new Intl.DateTimeFormat('es-ES', options).format(new Date());

    document.getElementById('fecha-actualizacion').textContent = `${formattedDate} (CUBA)`;
}

// ----------------------------------------------------\
// CONTADOR DE VISTAS (Lógica agregada para tracking simple)
// ----------------------------------------------------\

async function registerPageView() {
    // Usamos el id de la tabla views_count que solo tiene un registro
    const VIEW_COUNT_ID = 1; 
    try {
        await supabase.rpc('increment_page_view', { row_id: VIEW_COUNT_ID });
        console.log('Vista registrada.');
    } catch (error) {
        console.error('Error al registrar la vista:', error.message);
    }
}

async function getAndDisplayViewCount() {
    try {
        const { data, error } = await supabase
            .from('views_count')
            .select('count')
            .eq('id', 1)
            .single();

        if (error) throw error;
        
        const count = data.count || 0;
        document.getElementById('viewCounter').textContent = `👁️ Vistas totales: ${count}`;
        
    } catch (error) {
        console.error('Error al obtener el contador de vistas:', error.message);
        document.getElementById('viewCounter').textContent = '👁️ Vistas: (Error)';
    }
}

// ----------------------------------------------------\
// MANEJO DE EVENTOS Y CARGA INICIAL
// ----------------------------------------------------\

document.addEventListener('DOMContentLoaded', () => {
    
    // ⭐ MODIFICADO: Sustitución de toggleAdminBtn por loginForm y logoutButton
    DOMElements.loginForm.addEventListener('submit', handleLogin);
    DOMElements.logoutButton.addEventListener('click', handleLogout);
    
    DOMElements.saveBtn.addEventListener('click', saveChanges);
    DOMElements.addNewsBtn.addEventListener('click', addQuickNews);
    DOMElements.deleteNewsBtn.addEventListener('click', deleteNews);
    DOMElements.publishCommentBtn.addEventListener('click', publishComment); 
    
    updateHeaderTime(); 
    
    // Funciones para el contador de vistas
    registerPageView();
    getAndDisplayViewCount();
    
    loadData();
    loadNews();
    loadComments(); 
    loadStatusData(); 
    
    window.addEventListener('resize', () => {
        if (window.resizeTimer) clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(loadNews, 200); // Recalcular animación en resize
    });
});
