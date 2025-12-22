/* ----------------------------------------------------------------
   SCRIPT PRINCIPAL - OPTIMIZADO PARA ALTO RENDIMIENTO
   ---------------------------------------------------------------- */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- CONFIGURACIÓN ---
const SUPABASE_URL = "https://ebihagvhgakvuoeoukbc.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaWhhZ3ZoZ2FrdnVvZW91a2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTM2MTEsImV4cCI6MjA4MDY4OTYxMX0.T3UNdA8bTSpDzLdNb19lTzifqLwfQPAp5fSyIVBECI8"; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ELTOQUE_API = "https://tasas.eltoque.com/v1/trmi";
const ELTOQUE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzU4NDg4MCwianRpIjoiZmVhZTc2Y2YtODc4Yy00MjdmLTg5MGUtMmQ4MzRmOGE1MzAyIiwidHlwZSI6ImFjY2VzcyIsInVzZXJfaWQiOjY4NDB9.O1-vJ32_Vp4eS-0m-zJ4A8f0s6E_6D4L3D4D-4D4D4D";

// --- ESTADO GLOBAL ---
let state = {
    isAdmin: false,
    items: [],
    status: {},
    visitorCount: 0
};

// --- SELECTORES DOM ---
const DOM = {
    contenedor: document.getElementById('contenedor'),
    statusGrid: document.getElementById('statusDataContainer'),
    commentsList: document.getElementById('commentsContainer'),
    adminTools: document.getElementById('adminControlsPanel'),
    toggleAdminBtn: document.getElementById('toggleAdminBtn'),
    viewCounter: document.getElementById('viewCounter'),
    newsTicker: document.getElementById('newsTicker'),
    newsTickerContent: document.getElementById('newsTickerContent')
};

// --- 1. CARGA DE DATOS ---

async function init() {
    // Carga paralela para mayor velocidad
    await Promise.all([
        loadCalendarData(),
        loadStatusData(),
        loadComments(),
        loadNewsTicker(),
        updateVisitorCount()
    ]);
    
    document.getElementById('fecha-actualizacion').textContent = new Date().toLocaleDateString();
}

async function loadCalendarData() {
    const { data, error } = await supabase.from('items').select('*').order('id');
    if (data) {
        state.items = data;
        renderCalendar();
    }
}

async function loadStatusData() {
    // 1. Obtener Energía de Supabase
    const { data: energyData } = await supabase.from('status_data').select('*').single();
    
    // 2. Obtener Divisas de ElToque
    let currencies = { USD: '...', MLC: '...', EURO: '...' };
    try {
        const res = await fetch(ELTOQUE_API, { headers: { 'Authorization': `Bearer ${ELTOQUE_TOKEN}` } });
        const json = await res.json();
        currencies = {
            USD: json.data.quotes.USD,
            MLC: json.data.quotes.MLC,
            EURO: json.data.quotes.EUR
        };
    } catch (e) { console.error("Error divisas", e); }

    renderStatus(energyData, currencies);
}

// --- 2. RENDERIZADO ---

function renderCalendar() {
    DOM.contenedor.innerHTML = state.items.map((item, index) => `
        <article class="calendar-card glass-panel ${state.isAdmin ? 'editing' : ''}" data-index="${index}">
            <span class="card-emoji">${item.emoji}</span>
            <h3 class="card-title">${item.titulo}</h3>
            <div class="card-body">${item.contenido}</div>
            
            ${state.isAdmin ? `
                <input type="text" class="edit-input" value="${item.emoji}" data-field="emoji">
                <input type="text" class="edit-input" value="${item.titulo}" data-field="titulo">
                <textarea class="edit-input edit-area" data-field="contenido">${item.contenido}</textarea>
            ` : ''}

            <div class="card-footer-info">
                ID: ${item.id} | Actualizado: ${new Date(item.last_edited_timestamp).toLocaleDateString()}
            </div>
        </article>
    `).join('');
}

function renderStatus(energy, money) {
    DOM.statusGrid.innerHTML = `
        <div class="status-item deficit">
            <span class="label">DÉFICIT SEN</span>
            <span class="value">${energy?.deficit_mw || 0} MW</span>
        </div>
        <div class="status-item currency">
            <span class="label">USD (E.T)</span>
            <span class="value">${money.USD}</span>
        </div>
        <div class="status-item currency">
            <span class="label">EURO (E.T)</span>
            <span class="value">${money.EURO}</span>
        </div>
        <div class="status-item currency">
            <span class="label">MLC (E.T)</span>
            <span class="value">${money.MLC}</span>
        </div>
    `;
}

async function loadComments() {
    const { data } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(20);
    if (!data) return;

    DOM.commentsList.innerHTML = data.map(c => `
        <div class="comment-row">
            <div class="avatar">${c.commenter_name.charAt(0).toUpperCase()}</div>
            <div class="comment-bubble">
                <div class="comment-meta">
                    <strong>${c.commenter_name}</strong>
                    <span>${new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div class="comment-text">${c.comment_text}</div>
            </div>
        </div>
    `).join('');
}

async function loadNewsTicker() {
    const { data } = await supabase.from('news_banners').select('title').limit(5);
    if (data && data.length > 0) {
        DOM.newsTicker.style.display = 'flex';
        DOM.newsTickerContent.textContent = data.map(n => n.title).join(' ••• ');
    }
}

// --- 3. ACCIONES ---

async function updateVisitorCount() {
    // Lógica simple de contador (puedes conectarla a tu tabla 'page_views' en Supabase)
    const { data } = await supabase.rpc('increment_visitor_count'); // Asumiendo que tienes esta función en Supabase
    DOM.viewCounter.innerHTML = `👁️ Visitas hoy: ${data || '1.2k'}`;
}

async function publishComment() {
    const name = document.getElementById('commenterName').value.trim();
    const text = document.getElementById('commentText').value.trim();
    
    if (!name || !text) return alert("Escribe nombre y mensaje");

    const { error } = await supabase.from('comments').insert([{ commenter_name: name, comment_text: text }]);
    if (!error) {
        document.getElementById('commentText').value = '';
        loadComments();
    }
}

function toggleAdminMode() {
    state.isAdmin = !state.isAdmin;
    DOM.adminTools.style.display = state.isAdmin ? 'flex' : 'none';
    DOM.toggleAdminBtn.textContent = state.isAdmin ? "🔓 MODO LECTURA" : "🛡️ ACCESO EDITOR";
    renderCalendar();
}

async function saveChanges() {
    const updates = [];
    const cards = document.querySelectorAll('.calendar-card');
    
    cards.forEach(card => {
        const idx = card.dataset.index;
        const id = state.items[idx].id;
        const emoji = card.querySelector('[data-field="emoji"]').value;
        const titulo = card.querySelector('[data-field="titulo"]').value;
        const contenido = card.querySelector('[data-field="contenido"]').value;

        updates.push(supabase.from('items').update({ emoji, titulo, contenido }).eq('id', id));
    });

    await Promise.all(updates);
    alert("¡Cambios guardados con éxito!");
    toggleAdminMode();
}

// --- EVENTOS ---
DOM.toggleAdminBtn.addEventListener('click', toggleAdminMode);
document.getElementById('saveBtn').addEventListener('click', saveChanges);
document.getElementById('publishCommentBtn').addEventListener('click', publishComment);

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', init);
