// ----------------------------------------------------
// 🚨 CONFIGURACIÓN DE SUPABASE (POSTGRESQL BAAS) 🚨
// ----------------------------------------------------
const SUPABASE_URL = "https://ekkaagqovdmcdexrjosh.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra2FhZ3FvdmRtY2RleHJqb3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjU2NTEsImV4cCI6MjA3NTQ0MTY1MX0.mmVl7C0Hkzrjoks7snvHWMYk-ksSXkUWzVexhtkozRA"; 

// ----------------------------------------------------
// 💰 CONFIGURACIÓN API ELTOQUE (MONEDA AUTOMÁTICA) 🚨
// ----------------------------------------------------
const ELTOQUE_API_URL = "https://api.eltoque.com/v1/trm?cur=CUP";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5MWUyNWI3ZTkyYmU3N2VhM2RlMjE0ZSIsIm5iZiI6MTc2MzU4NDg4MCwiZXhwIjoxNzk1MTIwODgwfQ.qpxiSsg8ptDTYsXZPnnxC694lUoWmT1qyAvzLUfl1-8";

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
// Inicializamos con valores por defecto para evitar "undefined" antes de cargar
let currentStatus = {
    deficit_mw: 'Cargando...', 
    dollar_cup: '...', 
    euro_cup: '...',
    deficit_edited_at: null
}; 
const timePanelTimeouts = new Map(); 

// 🔑 LÓGICA DE USUARIO WEB ÚNICO (Para persistir los Likes)
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
    if (DAYS >= 30) { text = `hace ${Math.floor(DAYS / 30)} meses`; } 
    else if (DAYS >= 7) { const weeks = Math.floor(DAYS / 7); text = `hace ${weeks} sem.`; } 
    else if (DAYS >= 2) { text = `hace ${DAYS} días`; } 
    else if (DAYS === 1) { text = 'hace 1 día'; } 
    else if (HOURS >= 2) { text = `hace ${HOURS} horas`; } 
    else if (HOURS === 1) { text = 'hace 1 hora'; } 
    else if (MINUTES >= 1) { text = `hace ${MINUTES} min.`; } 
    else { text = 'hace unos momentos'; }
    
    return { text, diff, date: new Date(timestamp) };
}

// ----------------------------------------------------
// 💰 LÓGICA API ELTOQUE (NUEVO)
// ----------------------------------------------------

async function fetchElToqueRates() {
    try {
        // Llamada a la API usando el token proporcionado
        const response = await fetch(ELTOQUE_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ELTOQUE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`Error API: ${response.status}`);

        const data = await response.json();
        
        // Procesar respuesta de elTOQUE (buscamos USD y EUR)
        // La estructura suele devolver un objeto "tasas" o "result" con las monedas.
        // Ajustamos según estructura estándar de elTOQUE:
        let usdPrice = '---';
        let eurPrice = '---';

        if (data && data.tasas) {
            if (data.tasas.USD) usdPrice = parseFloat(data.tasas.USD).toFixed(0); // Redondeado
            if (data.tasas.EUR) eurPrice = parseFloat(data.tasas.EUR).toFixed(0); // Redondeado
        } else if (data && data.USD && data.EUR) {
             // Caso alternativo de estructura simple
             usdPrice = parseFloat(data.USD).toFixed(0);
             eurPrice = parseFloat(data.EUR).toFixed(0);
        }

        // Actualizamos el estado global solo con las divisas (sin tocar el déficit que viene de Supabase)
        currentStatus.dollar_cup = usdPrice;
        currentStatus.euro_cup = eurPrice;

        // Re-renderizamos el panel con los nuevos datos
        renderStatusPanel(currentStatus, admin);

        // console.log("✅ Tasas actualizadas desde elTOQUE:", usdPrice, eurPrice);

    } catch (error) {
        console.error("⚠️ Error al obtener tasas de elTOQUE:", error);
        // No borramos los valores anteriores si falla la API, mantenemos los que había.
    }
}
// ----------------------------------------------------
// FUNCIONES DE CARGA Y RENDERIZADO DEL PANEL DE ESTADO (MODIFICADO)
// ----------------------------------------------------

function renderStatusPanel(status, isAdminMode) {
    if (!status || !DOMElements.statusDataContainer) {
        DOMElements.statusDataContainer.innerHTML = "No se pudieron cargar los datos de estado.";
        return;
    }

    // Determinar el TIMESTAMP más reciente para el panel header
    // Nota: Si la API actualiza el status, usamos la fecha actual si no hay 'edited_at' reciente de DB
    const deficitTime = new Date(status.deficit_edited_at || 0).getTime();
    const divisaTime = new Date(status.divisa_edited_at || 0).getTime();
    const latestTime = Math.max(deficitTime, divisaTime);
    
    // Si la API acaba de actualizar, el status.dollar_cup tiene valor, pero quizás no hay timestamp de DB.
    // Podemos mostrar "Live API" o mantener la lógica de tiempo.
    // Para mantener "el resto 100% igual", dejamos la lógica de tiempo original.
    
    const { text: latestTimeText } = timeAgo(latestTime);
    DOMElements.lastEditedTime.innerHTML = `Última edición:<br> ${latestTimeText}`;
    
    if (isAdminMode) {
        // ⭐ MODO ADMIN: Inputs de Divisa BLOQUEADOS (disabled) ⭐
        DOMElements.statusDataContainer.innerHTML = `
            <div class="status-item">
                <span class="label">Deficit Eléctrico (MW):</span>
                <input type="text" id="editDeficit" value="${status.deficit_mw || ''}" placeholder="Ej: 1800 MW">
            </div>
            <div class="status-item">
                <span class="label">Dollar (API):</span>
                <input type="number" id="editDollar" value="${status.dollar_cup || ''}" disabled title="Gestionado automáticamente por elTOQUE">
            </div>
            <div class="status-item">
                <span class="label">Euro (API):</span>
                <input type="number" id="editEuro" value="${status.euro_cup || ''}" disabled title="Gestionado automáticamente por elTOQUE">
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
        // 1. Cargar datos guardados en Supabase (Déficit principalmente)
        const { data, error } = await supabase
            .from('status_data')
            .select('deficit_mw, dollar_cup, euro_cup, deficit_edited_at, divisa_edited_at')
            .eq('id', 1) 
            .single(); 

        if (error) {
            console.error("Error al cargar datos de estado:", error);
            // Mantenemos valores por defecto, pero la API intentará llenarlos luego
        } else {
            // Fusionamos: usamos datos de DB, pero si la API ya corrió, respetamos la API
            currentStatus = { ...currentStatus, ...data };
        }

        renderStatusPanel(currentStatus, admin);

        // 2. Llamar inmediatamente a la API para actualizar las divisas
        fetchElToqueRates();

    } catch (error) {
        console.error("Error de red al cargar datos de estado:", error);
    }
}

// ----------------------------------------------------
// FUNCIONES CLAVE DE PERSISTENCIA
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
    
    // --- LÓGICA PARA GUARDAR CARDS ---
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
    
    // ⭐ LÓGICA DE GUARDADO DE ESTADO (MODIFICADO) ⭐
    // Solo guardamos el Déficit manualmente. Las divisas se ignoran porque son automáticas.
    const editDeficit = document.getElementById('editDeficit');
    
    if (editDeficit) {
        const newDeficit = editDeficit.value.trim();
        
        // Si hay cambios en el DÉFICIT
        if (newDeficit !== (currentStatus.deficit_mw || '')) {
            hasChanges = true;
            updatePromises.push(
                supabase.from('status_data').update({
                    deficit_mw: newDeficit,
                    deficit_edited_at: nuevoTimestamp
                }).eq('id', 1)
            );
            // Actualizamos estado local
            currentStatus.deficit_mw = newDeficit;
            currentStatus.deficit_edited_at = nuevoTimestamp;
        }
    }

    if (!hasChanges) {
        alert("No se detectaron cambios manuales para guardar.");
        return;
    }

    try {
        const results = await Promise.all(updatePromises);
        const failedUpdates = results.filter(r => r.error);
        
        if (failedUpdates.length > 0) {
            throw failedUpdates[0].error;
        }

        updateHeaderTime();
        alert("✅ Cambios guardados.");

    } catch (error) {
        console.error("Error al guardar:", error);
        alert(`❌ Error al guardar. Detalle: ${error.message}`);
    }

    // Recargamos para refrescar vistas, la API seguirá corriendo
    renderStatusPanel(currentStatus, admin);
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
    loadStatusData(); // Esto iniciará la primera llamada a la API
    
    // ⭐ INTERVALO AUTOMÁTICO: Actualizar precio cada 10 segundos (10000 ms) ⭐
    setInterval(fetchElToqueRates, 10000);

    window.addEventListener('resize', () => {
        if (window.resizeTimer) clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(loadNews, 150);
    });
});
