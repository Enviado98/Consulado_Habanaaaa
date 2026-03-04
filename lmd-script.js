/* ================================================================
   REVISIÓN LMD — script.js
   Una acción por pantalla. Diseño para todos.
   ================================================================ */

const SUPABASE_URL   = 'https://fgxhubohavfvhadqzwbe.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZneGh1Ym9oYXZmdmhhZHF6d2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjU2NzQsImV4cCI6MjA4ODE0MTY3NH0.Pu_rV5UU2Do2dcsT71Gi1aBhmlmD5JQUkB3ZYQyZplo';
const ADMIN_ID       = 'bb94ddcc-758a-4c63-83da-f06e4880ff29';
const PRICE_PER_FILE = 250;

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

let currentUser     = null;
let currentCaso     = null;
let currentArchivos = [];
let pendingFiles    = [];
let obStep          = 0;
let todosCasos      = [];
let casosParaBorrar = new Set();
let cropFile        = null;
let cropState       = null;
let _adminCasos     = [];
let _cropImg        = null;
let _cropCanvas     = null;
let _uploadAborted  = false;   // señal de cancelación
let _activeXHR      = null;    // XHR activo para poder abortarlo

const RECOVERY_KEY = 'lmd_pending_upload'; // localStorage key para recuperación

const SL = {
  subiendo_archivos: 'Subiendo archivos',
  pago_pendiente:    'Pendiente de pago',
  pago_enviado:      'Pago enviado',
  pago_aprobado:     'Pago aprobado',
  en_proceso:        'En revisión',
  respondido:        'Revisión lista',
  cerrado:           'Cerrado'
};

// ═══════════════════════════════
//  UTILIDADES
// ═══════════════════════════════
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}
let _loadingCount = 0;
let _loadingSafety = null;
function showLoading(txt) {
  _loadingCount++;
  document.getElementById('loading-text').textContent = txt || 'Un momento...';
  document.getElementById('loading').classList.add('active');
  // Seguro: si en 15s no se ocultó, lo ocultamos forzado
  clearTimeout(_loadingSafety);
  _loadingSafety = setTimeout(() => {
    _loadingCount = 0;
    document.getElementById('loading').classList.remove('active');
  }, 15000);
}
function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) {
    clearTimeout(_loadingSafety);
    document.getElementById('loading').classList.remove('active');
  }
}
function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type} active`;
  el.textContent = msg;
  setTimeout(() => el.classList.remove('active'), 6000);
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}
function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function getFileIcon(name, colorClass) {
  const ext = (name || '').split('.').pop().toLowerCase();
  let type = 'file', col = colorClass || 'ico-blue';
  if (ext === 'pdf')                              { type = 'pdf';   col = colorClass || 'ico-red'; }
  else if (['zip','rar','7z'].includes(ext))      { type = 'zip';   col = colorClass || 'ico-gold'; }
  else if (['jpg','jpeg','png','gif','webp'].includes(ext)) { type = 'image'; col = colorClass || 'ico-violet'; }
  else if (['doc','docx'].includes(ext))          { type = 'doc';   col = colorClass || 'ico-blue'; }
  else                                            { type = 'clip';  col = colorClass || 'ico-muted'; }
  return `<span class="ico ico-${type} ico-md ${col}"></span>`;
}
function setHeader(sub) {
  document.getElementById('app-header').style.display = '';
  document.getElementById('header-sub').textContent = sub;
  document.getElementById('header-user').textContent = currentUser?.email || '';
}

// ═══════════════════════════════
//  INTRO / ONBOARDING
// ═══════════════════════════════
function nextStep() {
  obStep++;
  [0,1].forEach(i => {
    document.getElementById(`sb${i}`).classList.toggle('active', i === obStep);
    const dot = document.getElementById(`sd${i}`);
    dot.classList.remove('active','done');
    if (i < obStep) dot.classList.add('done');
    if (i === obStep) dot.classList.add('active');
  });
}
function showAuth(tab = 'register') {
  localStorage.setItem('lmd_seen', '1');  // ya vio el onboarding
  document.getElementById('app-header').style.display = 'none';
  showView('view-auth');
  switchTab(tab);
}
function switchTab(tab) {
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('tab-reg').classList.toggle('active', tab === 'register');
  document.getElementById('tab-log').classList.toggle('active', tab === 'login');
}
function goOnboarding() {
  document.getElementById('app-header').style.display = 'none';
  showView('view-onboarding');
}

// ═══════════════════════════════
//  AUTENTICACIÓN
// ═══════════════════════════════
async function register() {
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const rem   = document.getElementById('rem-reg').checked;
  if (!email || !pass) return showAlert('alert-auth','error','Completa los dos campos');
  if (pass.length < 6) return showAlert('alert-auth','error','La contraseña debe tener al menos 6 caracteres');
  showLoading('Creando tu cuenta...');
  const { data, error } = await sb.auth.signUp({ email, password: pass });
  hideLoading();
  if (error) return showAlert('alert-auth','error', error.message);
  // Solo guardamos el email, nunca la contraseña en texto plano
  if (rem) { localStorage.setItem('lmd_e', email); }
  currentUser  = data.user;
  pendingFiles = [];
  await initDashboard();
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const rem   = document.getElementById('rem-log').checked;
  if (!email || !pass) return showAlert('alert-auth','error','Completa los dos campos');
  showLoading('Entrando...');
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  hideLoading();
  if (error) return showAlert('alert-auth','error','Correo o contraseña incorrectos');
  // Solo guardamos el email, nunca la contraseña en texto plano
  if (rem) { localStorage.setItem('lmd_e', email); }
  currentUser = data.user;
  if (currentUser.id === ADMIN_ID) {
    setHeader('Panel de administrador');
    await loadAdmin();
    showView('view-admin');
  } else {
    pendingFiles = [];
    await initDashboard();
    // Contar mensajes no leídos del admin para el badge inicial
    const { data: nr } = await sb.from('mensajes_chat')
      .select('id', { count: 'exact' })
      .eq('user_id', currentUser.id)
      .eq('es_admin', true)
      .eq('leido', false);
    _chatUnread = nr?.length || 0;
    _updateChatBadge();
  }
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null; currentCaso = null; pendingFiles = []; obStep = 0;
  if (_chatSub) { _chatSub.unsubscribe(); _chatSub = null; }
  if (_adminChatSub) { _adminChatSub.unsubscribe(); _adminChatSub = null; }
  document.getElementById('chat-fab').style.display = 'none';
  document.getElementById('chat-panel').classList.remove('open');
  _chatOpen = false; _chatUnread = 0;
  document.getElementById('app-header').style.display = 'none';
  [0,1].forEach(i => {
    document.getElementById(`sb${i}`).classList.toggle('active', i === 0);
    const d = document.getElementById(`sd${i}`);
    d.classList.remove('active','done');
    if (i === 0) d.classList.add('active');
  });
  showView('view-onboarding');
}

// ═══════════════════════════════
//  DASHBOARD — CARGA DATOS
// ═══════════════════════════════
async function initDashboard() {
  setHeader('Portal del cliente');
  document.getElementById('chat-fab').style.display = '';
  showView('view-dashboard');
  await loadCaso();
  await _checkRecovery();  // detectar subidas interrumpidas
}

async function loadCaso() {
  // Carga TODOS los expedientes del usuario (no cerrados)
  const { data } = await sb
    .from('casos').select('*')
    .eq('user_id', currentUser.id)
    .neq('estado', 'cerrado')
    .order('created_at', { ascending: false });

  todosCasos = data || [];

  if (todosCasos.length === 0) {
    // No hay expedientes → pantalla de subir archivos
    currentCaso = null;
    currentArchivos = [];
    renderScreen();
  } else if (currentCaso) {
    // Si ya teníamos uno seleccionado, refrescarlo
    const actualizado = todosCasos.find(c => c.id === currentCaso.id);
    if (actualizado) {
      currentCaso = actualizado;
      const { data: arch } = await sb
        .from('archivos_caso').select('*')
        .eq('caso_id', currentCaso.id)
        .order('created_at', { ascending: true });
      currentArchivos = arch || [];
      renderScreen();
    } else {
      renderListaExpedientes();
    }
  } else if (todosCasos.length === 1) {
    // Solo un expediente → abrirlo directamente
    await seleccionarCaso(todosCasos[0].id);
  } else {
    // Varios expedientes → mostrar lista
    renderListaExpedientes();
  }
}

async function seleccionarCaso(casoId) {
  const caso = todosCasos.find(c => c.id === casoId);
  if (!caso) return;
  currentCaso = caso;
  const { data: arch } = await sb
    .from('archivos_caso').select('*')
    .eq('caso_id', currentCaso.id)
    .order('created_at', { ascending: true });
  currentArchivos = arch || [];
  renderScreen();
}

function renderListaExpedientes() {
  const cont = document.getElementById('dash-content');
  const ic = {
    subiendo_archivos: `<span class="ico ico-folder  ico-md ico-blue"></span>`,
    pago_pendiente:    `<span class="ico ico-money   ico-md ico-orange"></span>`,
    pago_enviado:      `<span class="ico ico-clock   ico-md ico-gold"></span>`,
    pago_aprobado:     `<span class="ico ico-check-circle ico-md ico-green"></span>`,
    en_proceso:        `<span class="ico ico-search  ico-md ico-blue"></span>`,
    respondido:        `<span class="ico ico-mail    ico-md ico-green"></span>`,
    cerrado:           `<span class="ico ico-flag    ico-md ico-muted"></span>`
  };

  const items = todosCasos.map(c => {
    const nombre = c.nombre_caso || 'Expediente sin nombre';
    return `
      <div class="exp-card" onclick="seleccionarCaso('${c.id}')">
        <div class="exp-card-icon">${ic[c.estado] || `<span class="ico ico-file ico-md ico-muted"></span>`}</div>
        <div class="exp-card-info">
          <div class="exp-card-nombre">${nombre}</div>
          <div class="exp-card-meta">${fmtDate(c.created_at)} · ${c.num_archivos || 0} archivo(s)</div>
        </div>
        <div class="exp-card-right">
          <span class="status-pill s-${c.estado}">${SL[c.estado] || c.estado}</span>
          <span class="exp-arrow"><span class="ico ico-arrow-right ico-md ico-muted"></span></span>
        </div>
      </div>
    `;
  }).join('');

  cont.innerHTML = `
    <div class="step-screen">
      <div class="step-icon-big step-icon-bg-blue"><span class="ico ico-folder ico-blue" style="font-size:36px"></span></div>
      <h2 class="step-title">Mis expedientes</h2>
      <p class="step-desc">Selecciona un expediente para ver su estado.</p>
    </div>
    <div class="exp-list">${items}</div>
    <div class="sep-label">¿Nuevo trámite?</div>
    <div class="new-case-banner" onclick="startNewCase()">
      <span class="ncb-icon"><span class="ico ico-plus ico-md ico-violet"></span></span>
      <div>
        <h3>Revisar otro expediente</h3>
        <p>Inicia un nuevo trámite independiente</p>
      </div>
      <span class="ncb-arrow"><span class="ico ico-arrow-right ico-md ico-muted"></span></span>
    </div>
  `;
}

// ═══════════════════════════════
//  RENDERIZADO — 1 ACCIÓN POR PANTALLA
// ═══════════════════════════════
function renderScreen() {
  const e = currentCaso?.estado || null;
  if (!e || e === 'subiendo_archivos') return screen_SubirArchivos();
  if (e === 'pago_pendiente')          return screen_Pago();
  if (e === 'pago_enviado')            return screen_EsperandoPago();
  if (e === 'pago_aprobado' || e === 'en_proceso') return screen_EnProceso();
  if (e === 'respondido')              return screen_Respondido();
}

// ─────────────────────────────────────────────────────
//  PASO 1 — Subir archivos
// ─────────────────────────────────────────────────────
function screen_SubirArchivos() {
  const cont = document.getElementById('dash-content');
  const tieneSubidos = currentArchivos.length > 0;
  const esNuevo = !currentCaso;

  const listaSubidos = tieneSubidos
    ? `<p class="files-label">Archivos añadidos (${currentArchivos.length}):</p>
       <div class="file-list">
         ${currentArchivos.map(a => `
           <div class="file-row">
             <div class="file-row-icon">${getFileIcon(a.nombre)}</div>
             <div class="file-row-info">
               <div class="file-row-name">${a.nombre}</div>
               <div class="file-row-size">${fmtSize(a.tamanio_bytes)}</div>
             </div>
           </div>`).join('')}
       </div>`
    : '';

  const nombreActual = currentCaso?.nombre_caso || '';
  const botonVolver = todosCasos.length >= 1
    ? `<button class="btn-volver" onclick="volverALista()">← Mis expedientes</button>`
    : '';

  cont.innerHTML = `
    ${botonVolver}
    <div class="step-screen">
      <div class="step-icon-big step-icon-bg-blue"><span class="ico ico-folder ico-blue" style="font-size:36px"></span></div>
      <h2 class="step-title">${tieneSubidos ? 'Sube otro archivo' : esNuevo ? 'Nuevo expediente' : 'Sube tu expediente'}</h2>
      <p class="step-desc">
        ${tieneSubidos
          ? 'Puedes añadir más archivos si lo necesitas.'
          : 'Selecciona el expediente que quieres que revisemos.'}
        <br>
        <strong>Cada expediente cuesta ${PRICE_PER_FILE} CUP.</strong>
      </p>
    </div>

    <div class="nombre-caso-block">
      <label class="form-label">Nombre del expediente <span style="color:var(--t3);font-weight:400">(para identificarlo fácilmente)</span></label>
      <input type="text" id="inp-nombre-caso" class="form-input"
        placeholder="Ej: Expediente de María, LMD..."
        value="${nombreActual}"
        oninput="guardarNombreCaso(this.value)">
    </div>

    ${listaSubidos}
    <div id="alert-dash" class="alert"></div>

    <div class="upload-zone" id="uz" onclick="document.getElementById('f-inp').click()">
      <input type="file" id="f-inp"
        accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
        multiple onchange="onFilesSelected()">
      <span class="upload-icon"><span class="ico ico-upload ico-2xl ico-blue"></span></span>
      <h3>${tieneSubidos ? 'Añadir otro archivo' : 'Tocar aquí para seleccionar el expediente'}</h3>
      <p>PDF, ZIP, Word o imágenes</p>
    </div>

    <div id="pending-list" class="file-list"></div>

    <div id="upload-progress-wrap" style="display:none;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="upload-progress-label" id="upload-progress-label">Subiendo...</div>
        <button id="btn-cancel-upload" onclick="cancelarSubida()"
          style="display:none;background:none;border:none;cursor:pointer;color:var(--red);font-size:.8rem;font-weight:700;padding:2px 6px">
          <span class="ico ico-close ico-sm ico-red" style="vertical-align:middle"></span> Cancelar
        </button>
      </div>
      <div class="upload-progress-track">
        <div class="upload-progress-fill" id="upload-progress-bar"></div>
      </div>
    </div>

    <button class="btn btn-primary btn-full" id="btn-continuar"
      style="${tieneSubidos ? '' : 'display:none'}">
      Continuar al pago <span class="ico ico-arrow-right ico-sm ico-white" style="vertical-align:middle"></span>
    </button>
    ${currentCaso ? `
    <button class="btn-eliminar-caso" onclick="confirmarEliminarCaso()">
      <span class="ico ico-close ico-sm" style="vertical-align:middle"></span> Eliminar este expediente
    </button>` : ''}
  `;

  document.getElementById('btn-continuar').onclick =
    tieneSubidos ? irAlPago : crearCasoYContinuar;

  setupDrag('uz');
  renderPendingFiles();
}

// ─────────────────────────────────────────────────────
//  PASO 2 — Pago
// ─────────────────────────────────────────────────────
function screen_Pago() {
  const n     = currentArchivos.length;
  const total = n * PRICE_PER_FILE;
  const cont  = document.getElementById('dash-content');
  const botonVolver = todosCasos.length >= 1
    ? `<button class="btn-volver" onclick="volverALista()"><span class="ico ico-arrow-left ico-sm ico-blue"></span> Mis expedientes</button>`
    : '';
  const nombreCaso = currentCaso?.nombre_caso
    ? `<div class="caso-nombre-tag"><span class="ico ico-folder ico-sm ico-violet"></span> ${currentCaso.nombre_caso}</div>` : '';

  cont.innerHTML = `
    ${botonVolver}
    ${nombreCaso}
    <div class="step-screen">
      <div class="step-icon-big step-icon-bg-violet"><span class="ico ico-card ico-violet" style="font-size:36px"></span></div>
      <h2 class="step-title">Realiza el pago</h2>
      <p class="step-desc">
        Total a pagar: <strong style="color:var(--violet);font-size:1.3rem">${total} CUP</strong>
      </p>
    </div>

    <div class="payment-card">
      <div class="lbl">Paga por Transfermóvil</div>
      <div class="copy-row">
        <div>
          <div class="copy-label">Número de tarjeta</div>
          <div class="copy-value">9204 1299 7485 4640</div>
        </div>
        <button class="copy-btn" onclick="copyText('9204129974854640', this)">Copiar</button>
      </div>
      <div class="copy-row" style="margin-top:12px">
        <div>
          <div class="copy-label">Móvil a confirmar</div>
          <div class="copy-value">50172941</div>
        </div>
        <button class="copy-btn" onclick="copyText('50172941', this)">Copiar</button>
      </div>
      <div class="payment-amount" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border2)">
        Monto exacto: <strong>${total} CUP</strong>
      </div>
    </div>

    <div id="alert-dash" class="alert"></div>

    <p style="font-size:.95rem;color:var(--t2);line-height:1.7;margin-bottom:16px;text-align:center">
      Una vez pagado, <strong>sube aquí la foto de confirmación:</strong>
    </p>

    <div class="upload-zone" id="uz-pago" onclick="document.getElementById('f-pago').click()">
      <input type="file" id="f-pago" accept="image/*" onchange="prevPago()">
      <span class="upload-icon"><span class="ico ico-camera ico-2xl ico-blue"></span></span>
      <h3>Subir y recortar captura</h3>
      <p>Selecciona la foto — podrás recortarla antes de enviar</p>
    </div>

    <div id="pago-progress-wrap" style="display:none;margin-top:14px">
      <div class="upload-progress-label" id="pago-progress-label">Subiendo comprobante...</div>
      <div class="upload-progress-track">
        <div class="upload-progress-fill" id="pago-progress-bar"></div>
      </div>
    </div>
    <button class="btn-eliminar-caso" onclick="confirmarEliminarCaso()">
      <span class="ico ico-close ico-sm" style="vertical-align:middle"></span> Eliminar este expediente
    </button>
  `;
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = '<span class="ico ico-check ico-sm ico-white"></span> Copiado';
    btn.style.background = 'var(--green)';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.textContent = 'Copiar';
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  });
}

// ─────────────────────────────────────────────────────
//  PASO 3 — Esperando verificación del pago
// ─────────────────────────────────────────────────────
function screen_EsperandoPago() {
  const cont = document.getElementById('dash-content');
  const botonVolver = todosCasos.length >= 1
    ? `<button class="btn-volver" onclick="volverALista()"><span class="ico ico-arrow-left ico-sm ico-blue"></span> Mis expedientes</button>`
    : '';
  const nombreCaso = currentCaso?.nombre_caso
    ? `<div class="caso-nombre-tag"><span class="ico ico-folder ico-sm ico-violet"></span> ${currentCaso.nombre_caso}</div>` : '';
  cont.innerHTML = `
    ${botonVolver}
    ${nombreCaso}
    <div class="step-screen">
      <div class="step-icon-big step-icon-bg-gold"><span class="ico ico-clock ico-gold" style="font-size:36px"></span></div>
      <h2 class="step-title">¡Comprobante recibido!</h2>
      <p class="step-desc">
        Hemos recibido tu comprobante de pago.<br>
        Lo estamos verificando. Cuando sea aprobado<br>
        comenzará la revisión de tu expediente.
      </p>
      <div class="status-card-simple">
        <span class="status-pill s-pago_enviado">
          <span class="status-dot"></span> Pago en revisión
        </span>
        <div class="status-date">Enviado el ${fmtDate(currentCaso.updated_at)}</div>
      </div>
      <p class="step-hint">Puedes cerrar esta página y volver más tarde.</p>
    </div>

    <div class="sep-label">¿Tienes otro expediente?</div>

    <div class="new-case-banner" onclick="startNewCase()">
      <span class="ncb-icon"><span class="ico ico-plus ico-md ico-violet"></span></span>
      <div>
        <h3>Revisar otro expediente</h3>
        <p>Inicia un nuevo trámite independiente</p>
      </div>
      <span class="ncb-arrow"><span class="ico ico-arrow-right ico-md ico-muted"></span></span>
    </div>
    <button class="btn-eliminar-caso" onclick="confirmarEliminarCaso()">
      <span class="ico ico-close ico-sm" style="vertical-align:middle"></span> Eliminar este expediente
    </button>
  `;
}

// ─────────────────────────────────────────────────────
//  PASO 4 — Expediente en proceso + opción nuevo
// ─────────────────────────────────────────────────────
function screen_EnProceso() {
  const cont = document.getElementById('dash-content');
  const n    = currentArchivos.length;
  const botonVolver = todosCasos.length >= 1
    ? `<button class="btn-volver" onclick="volverALista()"><span class="ico ico-arrow-left ico-sm ico-blue"></span> Mis expedientes</button>`
    : '';
  const nombreCaso = currentCaso?.nombre_caso
    ? `<div class="caso-nombre-tag"><span class="ico ico-folder ico-sm ico-violet"></span> ${currentCaso.nombre_caso}</div>` : '';

  cont.innerHTML = `
    ${botonVolver}
    ${nombreCaso}
    <div class="step-screen">
      <div class="step-icon-big step-icon-bg-blue"><span class="ico ico-search ico-blue" style="font-size:36px"></span></div>
      <h2 class="step-title">Expediente en revisión</h2>
      <p class="step-desc">
        Estamos analizando tu expediente.<br>
        Recibirás el informe aquí mismo cuando esté listo.
      </p>
      <div class="status-card-simple">
        <span class="status-pill s-en_proceso">
          <span class="status-dot"></span> En revisión
        </span>
        <div class="status-date">${n} archivo${n !== 1 ? 's' : ''} enviado${n !== 1 ? 's' : ''}</div>
      </div>
      <p class="step-hint">Puedes cerrar esta página y volver más tarde.</p>
    </div>

    <div class="sep-label">¿Tienes otro expediente?</div>

    <div class="new-case-banner" onclick="startNewCase()">
      <span class="ncb-icon"><span class="ico ico-plus ico-md ico-violet"></span></span>
      <div>
        <h3>Revisar otro expediente</h3>
        <p>Inicia un nuevo trámite independiente</p>
      </div>
      <span class="ncb-arrow"><span class="ico ico-arrow-right ico-md ico-muted"></span></span>
    </div>
    <button class="btn-eliminar-caso" onclick="confirmarEliminarCaso()">
      <span class="ico ico-close ico-sm" style="vertical-align:middle"></span> Eliminar este expediente
    </button>
  `;
}

// ─────────────────────────────────────────────────────
//  PASO 5 — Revisión lista + opción nuevo
// ─────────────────────────────────────────────────────
function screen_Respondido() {
  const cont   = document.getElementById('dash-content');
  const hasAdj = currentCaso.adjunto_admin_url;
  const botonVolver = todosCasos.length >= 1
    ? `<button class="btn-volver" onclick="volverALista()"><span class="ico ico-arrow-left ico-sm ico-blue"></span> Mis expedientes</button>`
    : '';
  const nombreCaso = currentCaso?.nombre_caso
    ? `<div class="caso-nombre-tag"><span class="ico ico-folder ico-sm ico-violet"></span> ${currentCaso.nombre_caso}</div>` : '';

  cont.innerHTML = `
    ${botonVolver}
    ${nombreCaso}
    <div class="step-screen">
      <div class="step-icon-big step-icon-bg-green"><span class="ico ico-check-circle ico-green" style="font-size:36px"></span></div>
      <h2 class="step-title">¡Tu revisión está lista!</h2>
      <p class="step-desc">
        Hemos analizado tu expediente.<br>
        Aquí tienes el informe completo:
      </p>
    </div>

    <div class="respuesta-card">
      <div class="resp-head">
        <div class="resp-avatar"><span class="ico ico-doc ico-md ico-green"></span></div>
        <div>
          <strong>Informe de Revisión LMD</strong>
          <span>${fmtDate(currentCaso.updated_at)}</span>
        </div>
      </div>
      <div class="resp-body">${currentCaso.respuesta_admin || ''}</div>
      ${hasAdj ? '<div id="adj-wrap" style="margin-top:4px">Cargando adjunto...</div>' : ''}
    </div>

    <div class="sep-label">¿Necesitas otra revisión?</div>

    <div class="new-case-banner" onclick="startNewCase()">
      <span class="ncb-icon"><span class="ico ico-plus ico-md ico-violet"></span></span>
      <div>
        <h3>Revisar otro expediente</h3>
        <p>Inicia un nuevo trámite cuando quieras</p>
      </div>
      <span class="ncb-arrow"><span class="ico ico-arrow-right ico-md ico-muted"></span></span>
    </div>
  `;

  if (hasAdj) loadAdjunto(currentCaso.adjunto_admin_url);
}

// ═══════════════════════════════
//  MANEJO DE ARCHIVOS
// ═══════════════════════════════
function onFilesSelected() {
  const input = document.getElementById('f-inp');
  Array.from(input.files).forEach(f => {
    if (!pendingFiles.find(p => p.name === f.name && p.size === f.size))
      pendingFiles.push(f);
  });
  input.value = '';
  renderPendingFiles();
}

function renderPendingFiles() {
  const list = document.getElementById('pending-list');
  const btn  = document.getElementById('btn-continuar');
  if (!list) return;

  if (!pendingFiles.length) {
    list.innerHTML = '';
    if (btn && !currentArchivos.length) btn.style.display = 'none';
    return;
  }

  list.innerHTML = pendingFiles.map((f, i) => `
    <div class="file-row">
      <div class="file-row-icon">${getFileIcon(f.name)}</div>
      <div class="file-row-info">
        <div class="file-row-name">${f.name}</div>
        <div class="file-row-size">${fmtSize(f.size)}</div>
      </div>
      <div class="file-row-del" onclick="removePending(${i})"><span class="ico ico-close ico-sm ico-red"></span></div>
    </div>
  `).join('');

  if (btn) btn.style.display = '';
}

function removePending(i) {
  pendingFiles.splice(i, 1);
  renderPendingFiles();
}

function setupDrag(zoneId) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(f => {
      if (!pendingFiles.find(p => p.name === f.name && p.size === f.size)) pendingFiles.push(f);
    });
    renderPendingFiles();
  });
}

// ═══════════════════════════════
//  ACCIONES DEL CLIENTE
// ═══════════════════════════════

// Primer uso: crea caso y sube archivos
async function crearCasoYContinuar() {
  if (!pendingFiles.length)
    return showAlert('alert-dash','error','Selecciona al menos un archivo primero');

  const nombreInput = document.getElementById('inp-nombre-caso');
  const nombre = nombreInput ? nombreInput.value.trim() : '';

  // Validar nombre ANTES de deshabilitar el botón
  if (!nombre)
    return showAlert('alert-dash','error','Escribe un nombre para identificar el expediente');

  const btnCont = document.getElementById('btn-continuar');
  if (btnCont) { btnCont.disabled = true; btnCont.textContent = 'Creando expediente...'; }

  try {
    const { data: caso, error: ce } = await sb.from('casos').insert({
      user_id:        currentUser.id,
      email_cliente:  currentUser.email,
      estado:         'subiendo_archivos',
      nombre_caso:    nombre || null,
      num_archivos:   0,
      total_cup:      0
    }).select().single();

    if (ce) throw new Error('Error al crear el expediente: ' + ce.message);

    currentCaso = caso;
    todosCasos = [caso, ...todosCasos];
    const ok = await _subirArchivos();
    if (!ok) showAlert('alert-dash','info','Algunos archivos no pudieron subirse. Puedes intentarlo de nuevo.');
    await irAlPago();
  } catch(err) {
    showAlert('alert-dash','error', err.message);
    if (btnCont) { btnCont.disabled = false; btnCont.innerHTML = 'Continuar al pago <span class="ico ico-arrow-right ico-sm ico-white" style="vertical-align:middle"></span>'; }
  }
}

// Guarda nombre del caso en tiempo real
let _nombreTimer = null;
async function guardarNombreCaso(nombre) {
  if (!currentCaso) return;
  clearTimeout(_nombreTimer);
  _nombreTimer = setTimeout(async () => {
    await sb.from('casos').update({ nombre_caso: nombre || null }).eq('id', currentCaso.id);
    currentCaso.nombre_caso = nombre || null;
    // Actualizar en todosCasos también
    const idx = todosCasos.findIndex(c => c.id === currentCaso.id);
    if (idx >= 0) todosCasos[idx].nombre_caso = nombre || null;
  }, 600);
}

function volverALista() {
  currentCaso = null;
  currentArchivos = [];
  pendingFiles = [];
  renderListaExpedientes();
}

// Caso ya existe: sube pendientes y va al pago
async function irAlPago() {
  if (!currentCaso) return;
  if (pendingFiles.length) {
    const ok = await _subirArchivos();
    if (!ok) showAlert('alert-dash','info','Algunos archivos no pudieron subirse. Revisa tu conexión.');
  }
  if (!currentArchivos.length)
    return showAlert('alert-dash','error','Añade al menos un archivo primero');

  // Solo loading breve para el cambio de estado (operación rápida de DB)
  showLoading('Preparando el pago...');
  try {
    await sb.from('casos').update({
      estado:      'pago_pendiente',
      updated_at:  new Date().toISOString()
    }).eq('id', currentCaso.id);
    await loadCaso();
  } finally {
    hideLoading();
  }
}

// Sube todos los archivos pendientes con barra de progreso, cancelación y recuperación
async function _subirArchivos() {
  _uploadAborted = false;
  let alguFallo  = false;
  const total    = pendingFiles.length;

  // Mostrar botón cancelar
  _showCancelBtn(true);

  for (let i = 0; i < total; i++) {
    if (_uploadAborted) { alguFallo = true; break; }

    const file = pendingFiles[i];
    _setUploadProgress(i, total, file.name, 0);

    // Guardar estado de recuperación en localStorage
    _saveRecovery({ casoId: currentCaso.id, fileIndex: i, fileName: file.name });

    const path = `${currentCaso.id}/${Date.now()}_${file.name}`;
    const { error } = await _uploadWithProgress(
      'expedientes', path, file,
      pct => {
        if (!_uploadAborted) _setUploadProgress(i, total, file.name, pct);
      }
    );

    if (_uploadAborted) { alguFallo = true; break; }

    if (error) {
      alguFallo = true;
      const msg = `Error en "${file.name}": ${error.message}`;
      console.error(msg);
      showAlert('alert-dash', 'error', msg);
      _setUploadProgress(i, total, `Error: ${file.name}`, 0);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    await sb.from('archivos_caso').insert({
      caso_id:       currentCaso.id,
      nombre:        file.name,
      storage_path:  path,
      tamanio_bytes: file.size
    });
  }

  _showCancelBtn(false);
  _clearRecovery();
  _hideUploadProgress();
  pendingFiles = [];

  // Limpiar archivos huérfanos: archivos en storage sin registro en DB
  await _limpiarHuerfanos();

  const { data: arch } = await sb.from('archivos_caso').select('*')
    .eq('caso_id', currentCaso.id).order('created_at', { ascending: true });
  currentArchivos = arch || [];
  await sb.from('casos').update({
    num_archivos: currentArchivos.length,
    total_cup:    currentArchivos.length * PRICE_PER_FILE,
    updated_at:   new Date().toISOString()
  }).eq('id', currentCaso.id);

  return !alguFallo;
}

// Limpia archivos que llegaron al storage pero no tienen registro en archivos_caso
// (pueden quedar si el usuario recargó justo después de subir pero antes del INSERT)
async function _limpiarHuerfanos() {
  try {
    const { data: enDB } = await sb.from('archivos_caso').select('storage_path')
      .eq('caso_id', currentCaso.id);
    const pathsEnDB = new Set((enDB || []).map(r => r.storage_path));

    const { data: enStorage } = await sb.storage.from('expedientes')
      .list(currentCaso.id, { limit: 200 });
    if (!enStorage?.length) return;

    const huerfanos = enStorage
      .map(f => `${currentCaso.id}/${f.name}`)
      .filter(p => !pathsEnDB.has(p));

    if (huerfanos.length) {
      await sb.storage.from('expedientes').remove(huerfanos);
      console.log(`Limpiados ${huerfanos.length} archivo(s) huérfano(s)`);
    }
  } catch(e) {
    console.warn('No se pudo limpiar huérfanos:', e.message);
  }
}

// Subida con XHR (progreso real) y soporte de cancelación
async function _uploadWithProgress(bucketName, path, file, onProgress) {
  // Obtener el token de sesión del usuario (no el anon key)
  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) return { error: { message: 'Sin sesión activa. Por favor recarga la página.' } };

  return new Promise(resolve => {
    const url = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${path}`;
    const xhr = new XMLHttpRequest();
    _activeXHR = xhr;
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      const ok = xhr.status === 200 || xhr.status === 201;
      if (!ok) {
        let msg = `HTTP ${xhr.status}`;
        try { const j = JSON.parse(xhr.responseText); msg += ': ' + (j.error || j.message || xhr.responseText); } catch {}
        console.error('Upload error:', msg, 'URL:', url);
        resolve({ error: { message: msg } });
      } else {
        resolve({ error: null });
      }
    };
    xhr.onerror = () => resolve({ error: { message: 'Error de red' } });
    xhr.onabort = () => resolve({ error: { message: 'Cancelado' } });
    // Enviar el archivo directamente, NO como FormData
    xhr.send(file);
  });
}

// Cancelar subida en curso
function cancelarSubida() {
  _uploadAborted = true;
  if (_activeXHR) { _activeXHR.abort(); _activeXHR = null; }
  _showCancelBtn(false);
  _hideUploadProgress();
  pendingFiles = [];
  _clearRecovery();
  showAlert('alert-dash', 'info', 'Subida cancelada. Los archivos ya enviados se conservan.');
  renderPendingFiles();
}

function _showCancelBtn(show) {
  const btn = document.getElementById('btn-cancel-upload');
  if (btn) btn.style.display = show ? '' : 'none';
}

// ── Recuperación ante corte de conexión ──────────────────
function _saveRecovery(data) {
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(data));
}
function _clearRecovery() {
  localStorage.removeItem(RECOVERY_KEY);
}
async function _checkRecovery() {
  const raw = localStorage.getItem(RECOVERY_KEY);
  if (!raw) return;
  let rec;
  try { rec = JSON.parse(raw); } catch { _clearRecovery(); return; }
  if (!rec?.casoId || !currentUser) { _clearRecovery(); return; }

  // Verificar que el caso pertenece al usuario actual
  const { data: caso } = await sb.from('casos').select('*').eq('id', rec.casoId)
    .eq('user_id', currentUser.id).single();
  if (!caso) { _clearRecovery(); return; }

  // Hay una subida incompleta — limpiar huérfanos y notificar
  currentCaso = caso;
  const { data: arch } = await sb.from('archivos_caso').select('*')
    .eq('caso_id', caso.id).order('created_at', { ascending: true });
  currentArchivos = arch || [];
  _clearRecovery();

  // Limpiar huérfanos que quedaron del corte anterior
  await _limpiarHuerfanos();

  showAlert('alert-dash', 'info',
    `Detectamos una subida interrumpida del expediente "${caso.nombre_caso || rec.fileName}". Puedes continuar añadiendo archivos.`);
}

function _setUploadProgress(idx, total, name, pct = 0) {
  const bar = document.getElementById('upload-progress-bar');
  const lbl = document.getElementById('upload-progress-label');
  const cnt = document.getElementById('upload-progress-wrap');
  if (!cnt) return;
  cnt.style.display = '';
  const overall = Math.round((idx / total + (pct / 100) / total) * 100);
  bar.style.width = overall + '%';
  lbl.textContent = `Subiendo ${idx+1} de ${total}: ${name} (${pct}%)`;
}
function _hideUploadProgress() {
  const cnt = document.getElementById('upload-progress-wrap');
  if (cnt) cnt.style.display = 'none';
}

// ─────────────────────────────────────────────────────
//  ELIMINAR EXPEDIENTE (cliente)
// ─────────────────────────────────────────────────────
function confirmarEliminarCaso() {
  const nombre = currentCaso?.nombre_caso || 'este expediente';
  if (!confirm(`¿Eliminar "${nombre}" permanentemente?\n\nSe borrarán todos los archivos. Esta acción no se puede deshacer.`)) return;
  _borrarCasoCliente();
}

async function _borrarCasoCliente() {
  if (!currentCaso) return;
  showLoading('Eliminando expediente...');
  try {
    const id = currentCaso.id;

    _uploadAborted = true;
    if (_activeXHR) { _activeXHR.abort(); _activeXHR = null; }
    _clearRecovery();

    // Borrar archivos del storage
    const { data: archs } = await sb.from('archivos_caso').select('storage_path').eq('caso_id', id);
    if (archs?.length) {
      const { error: se } = await sb.storage.from('expedientes').remove(archs.map(a => a.storage_path));
      if (se) console.warn('Storage expedientes:', se.message);
    }

    // Borrar captura de pago si existe
    const { data: casoData } = await sb.from('casos').select('captura_pago_url').eq('id', id).single();
    if (casoData?.captura_pago_url) {
      const { error: pe } = await sb.storage.from('pagos').remove([casoData.captura_pago_url]);
      if (pe) console.warn('Storage pagos:', pe.message);
    }

    // Borrar registros en DB
    const { error: ae } = await sb.from('archivos_caso').delete().eq('caso_id', id);
    if (ae) throw new Error('Error borrando archivos: ' + ae.message);

    const { error: ce } = await sb.from('casos').delete().eq('id', id);
    if (ce) throw new Error('Error borrando expediente: ' + ce.message);

    todosCasos      = todosCasos.filter(c => c.id !== id);
    currentCaso     = null;
    currentArchivos = [];
    pendingFiles    = [];

    if (todosCasos.length > 0) {
      renderListaExpedientes();
    } else {
      renderScreen();
    }
  } catch(err) {
    showAlert('alert-dash', 'error', err.message);
  } finally {
    hideLoading();
  }
}

async function volverASubir() {
  showLoading('Volviendo...');
  try {
    await sb.from('casos').update({
      estado:     'subiendo_archivos',
      updated_at: new Date().toISOString()
    }).eq('id', currentCaso.id);
    await loadCaso();
  } finally {
    hideLoading();
  }
}

// ── CROP DE CAPTURA DE PAGO ──────────────────────────
function prevPago() {
  const file = document.getElementById('f-pago').files[0];
  if (!file) return;
  cropFile = file;
  openCropModal(file);
}

function openCropModal(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => initCrop(img);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  document.getElementById('modal-crop').classList.add('active');
}

function closeCropModal() {
  document.getElementById('modal-crop').classList.remove('active');
  // Limpiar el input para que pueda volver a seleccionar
  const inp = document.getElementById('f-pago');
  if (inp) inp.value = '';
  cropFile = null;
}

function initCrop(img) {
  _cropImg = img;
  const wrap = document.querySelector('.crop-canvas-inner');
  const maxW = Math.min(wrap.clientWidth || 340, 340);
  const scale = maxW / img.width;
  const cW = maxW, cH = Math.round(img.height * scale);

  const canvas = document.getElementById('crop-canvas');
  canvas.width = cW; canvas.height = cH;
  canvas.getContext('2d').drawImage(img, 0, 0, cW, cH);
  _cropCanvas = canvas;

  const box = document.getElementById('crop-box');
  const bW = Math.round(cW * 0.85), bH = Math.round(cH * 0.85);
  const bX = Math.round((cW - bW) / 2), bY = Math.round((cH - bH) / 2);
  _cropBox = { l: bX, t: bY, w: bW, h: bH };
  _applyCropBox(box);

  setupCropDrag(box, canvas);
}

// Estado del crop como objeto para evitar parseInt() en cada frame
let _cropBox = { l: 0, t: 0, w: 0, h: 0 };
let _rafPending = false;

function _applyCropBox(box) {
  const { l, t, w, h } = _cropBox;
  box.style.left   = l + 'px';
  box.style.top    = t + 'px';
  box.style.width  = w + 'px';
  box.style.height = h + 'px';
}

function setupCropDrag(box, canvas) {
  // Limpiar listeners anteriores clonando el nodo
  const newBox = box.cloneNode(true);
  box.parentNode.replaceChild(newBox, box);
  box = newBox;

  let drag = null;

  const onStart = (ex, ey, handle) => {
    const r = canvas.getBoundingClientRect();
    drag = {
      handle,
      startX: ex - r.left, startY: ey - r.top,
      orig: { ..._cropBox }
    };
    box.setPointerCapture && box.setPointerCapture(drag.pointerId);
  };

  const onMove = (ex, ey) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const dx = (ex - r.left) - drag.startX;
    const dy = (ey - r.top)  - drag.startY;
    const cW = _cropCanvas.width, cH = _cropCanvas.height;
    let { l, t, w, h } = drag.orig;

    if (drag.handle === 'move') {
      l = Math.max(0, Math.min(l + dx, cW - w));
      t = Math.max(0, Math.min(t + dy, cH - h));
    } else {
      const d = drag.handle;
      if (d.includes('e')) w = Math.max(60, Math.min(l + w + dx, cW) - l);
      if (d.includes('s')) h = Math.max(60, Math.min(t + h + dy, cH) - t);
      if (d.includes('w')) { const nl = Math.max(0, Math.min(l+dx, l+w-60)); w += l-nl; l = nl; }
      if (d.includes('n')) { const nt = Math.max(0, Math.min(t+dy, t+h-60)); h += t-nt; t = nt; }
    }
    _cropBox = { l, t, w, h };

    // Throttle DOM updates con rAF — solo 1 repaint por frame
    if (!_rafPending) {
      _rafPending = true;
      requestAnimationFrame(() => {
        _applyCropBox(box);
        _rafPending = false;
      });
    }
  };

  const onEnd = () => { drag = null; };

  // Pointer Events — única API para mouse, touch y stylus
  box.addEventListener('pointerdown', e => {
    e.stopPropagation();
    drag = null;
    onStart(e.clientX, e.clientY, 'move');
    drag.pointerId = e.pointerId;
    box.setPointerCapture(e.pointerId);
  });

  box.querySelectorAll('.crop-handle').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.stopPropagation();
      onStart(e.clientX, e.clientY, h.dataset.dir);
      if (drag) { drag.pointerId = e.pointerId; h.setPointerCapture(e.pointerId); }
    });
    h.addEventListener('pointermove', e => onMove(e.clientX, e.clientY));
    h.addEventListener('pointerup',   onEnd);
  });

  box.addEventListener('pointermove', e => onMove(e.clientX, e.clientY));
  box.addEventListener('pointerup',   onEnd);
}

function updateCropPreview() { /* eliminada — usamos _cropBox directamente */ }

async function confirmCrop() {
  if (!_cropImg || !_cropCanvas) return;
  const { l, t, w, h } = _cropBox;
  const scaleX = _cropImg.width  / _cropCanvas.width;
  const scaleY = _cropImg.height / _cropCanvas.height;

  const out = document.createElement('canvas');
  out.width  = Math.round(w * scaleX);
  out.height = Math.round(h * scaleY);
  out.getContext('2d').drawImage(
    _cropImg,
    Math.round(l * scaleX), Math.round(t * scaleY),
    out.width, out.height,
    0, 0, out.width, out.height
  );

  document.getElementById('modal-crop').classList.remove('active');
  out.toBlob(async blob => {
    if (!blob) return showAlert('alert-dash','error','Error al procesar la imagen');
    await _subirCapturaPago(blob);
  }, 'image/jpeg', 0.92);
}

async function _subirCapturaPago(blob) {
  const wrap = document.getElementById('pago-progress-wrap');
  const bar  = document.getElementById('pago-progress-bar');
  const lbl  = document.getElementById('pago-progress-label');
  if (wrap) { wrap.style.display = ''; bar.style.width = '0%'; lbl.textContent = 'Subiendo comprobante...'; }

  // Token de sesión del usuario (no el anon key)
  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    if (wrap) wrap.style.display = 'none';
    return showAlert('alert-dash', 'error', 'Sin sesión activa. Por favor recarga la página.');
  }

  const fname = cropFile ? cropFile.name.replace(/\.[^.]+$/, '') + '_recortado.jpg' : `pago_${Date.now()}.jpg`;
  const path  = `${currentUser.id}/pago_${Date.now()}_${fname}`;

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/pagos/${path}`);
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.setRequestHeader('Content-Type', 'image/jpeg');
  xhr.setRequestHeader('x-upsert', 'false');

  xhr.upload.onprogress = e => {
    if (e.lengthComputable && bar && lbl) {
      const pct = Math.round(e.loaded / e.total * 100);
      bar.style.width = pct + '%';
      lbl.textContent = `Subiendo comprobante... ${pct}%`;
    }
  };

  xhr.onload = async () => {
    if (wrap) wrap.style.display = 'none';
    if (xhr.status !== 200 && xhr.status !== 201) {
      let msg = `HTTP ${xhr.status}`;
      try { const j = JSON.parse(xhr.responseText); msg += ': ' + (j.error || j.message); } catch {}
      return showAlert('alert-dash', 'error', 'Error al subir comprobante: ' + msg);
    }
    await sb.from('casos').update({
      estado:           'pago_enviado',
      captura_pago_url: path,
      updated_at:       new Date().toISOString()
    }).eq('id', currentCaso.id);
    cropFile = null;
    await loadCaso();
  };
  xhr.onerror = () => {
    if (wrap) wrap.style.display = 'none';
    showAlert('alert-dash', 'error', 'Error de red al subir el comprobante');
  };

  // Enviar el blob directamente, NO como FormData
  xhr.send(blob);
}

async function enviarPago() {
  // Compatibilidad: si hay archivo seleccionado sin crop, usar crop directamente
  const file = document.getElementById('f-pago')?.files[0];
  if (file) { cropFile = file; openCropModal(file); }
  else showAlert('alert-dash','error','Selecciona primero la captura del pago');
}

async function startNewCase() {
  pendingFiles    = [];
  currentCaso     = null;
  currentArchivos = [];
  renderScreen();  // muestra la pantalla de subir archivos directamente
}

async function loadAdjunto(path) {
  const { data } = await sb.storage.from('respuestas').createSignedUrl(path, 3600);
  const w = document.getElementById('adj-wrap');
  if (!w) return;
  w.innerHTML = data
    ? `<a href="${data.signedUrl}" target="_blank" class="resp-attachment">
         <span class="resp-att-icon"><span class="ico ico-download ico-lg ico-blue"></span></span>
         <div class="resp-att-text">
           <strong>Documento adjunto</strong>
           <span>Toca para abrir o descargar</span>
         </div>
         <span class="ico ico-arrow-right ico-md ico-blue"></span>
       </a>`
    : '';
}

// ═══════════════════════════════
//  ADMIN
// ═══════════════════════════════
async function loadAdmin() {
  showLoading('Cargando expedientes...');
  try {
    const { data } = await sb.from('casos').select('*').order('created_at', { ascending: false });
    const casos = data || [];
    _adminCasos = casos;

    document.getElementById('s-total').textContent = casos.length;
    document.getElementById('s-pago').textContent  = casos.filter(c => ['pago_enviado','pago_pendiente'].includes(c.estado)).length;
    document.getElementById('s-proc').textContent  = casos.filter(c => ['pago_aprobado','en_proceso'].includes(c.estado)).length;
    document.getElementById('s-resp').textContent  = casos.filter(c => c.estado === 'respondido').length;

    const list = document.getElementById('casos-list');
    if (!casos.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon"><span class="ico ico-inbox ico-2xl ico-muted"></span></span><p>No hay expedientes aún</p></div>';
      return;
    }
    const ic = {
      subiendo_archivos: `<span class="ico ico-folder  ico-md ico-blue"></span>`,
      pago_pendiente:    `<span class="ico ico-money   ico-md ico-orange"></span>`,
      pago_enviado:      `<span class="ico ico-clock   ico-md ico-gold"></span>`,
      pago_aprobado:     `<span class="ico ico-check-circle ico-md ico-green"></span>`,
      en_proceso:        `<span class="ico ico-search  ico-md ico-blue"></span>`,
      respondido:        `<span class="ico ico-mail    ico-md ico-green"></span>`,
      cerrado:           `<span class="ico ico-flag    ico-md ico-muted"></span>`
    };
    list.innerHTML = casos.map(c => `
      <div class="caso-row" onclick="openCaso('${c.id}')">
        <div class="caso-emoji">${ic[c.estado] || `<span class="ico ico-file ico-md ico-muted"></span>`}</div>
        <div class="caso-info">
          <div class="caso-email">${c.nombre_caso ? `<strong>${c.nombre_caso}</strong> · ` : ''}${c.email_cliente || '—'}</div>
          <div class="caso-meta">${fmtDate(c.created_at)} · ${c.num_archivos||0} archivo(s) · ${c.total_cup||0} CUP</div>
        </div>
        <div class="status-pill s-${c.estado}" style="font-size:.7rem;flex-shrink:0">${SL[c.estado]||c.estado}</div>
        <div class="caso-arrow"><span class="ico ico-arrow-right ico-md ico-muted"></span></div>
      </div>
    `).join('');
  } finally {
    hideLoading();
  }
}

async function openCaso(id) {
  showLoading('Cargando expediente...');
  try {
    const { data }           = await sb.from('casos').select('*').eq('id', id).single();
    const { data: archivos } = await sb.from('archivos_caso').select('*').eq('caso_id', id).order('created_at', { ascending: true });
    if (!data) return;

  let archivosHTML = '';
  if (archivos?.length) {
    const links = await Promise.all(archivos.map(async a => {
      const { data: u } = await sb.storage.from('expedientes').createSignedUrl(a.storage_path, 3600);
      return `<div class="admin-file-item">
        <span>${getFileIcon(a.nombre)}</span>
        ${u ? `<a href="${u.signedUrl}" target="_blank">${a.nombre}</a>` : `<span style="color:var(--t3)">${a.nombre}</span>`}
        <span>${fmtSize(a.tamanio_bytes)}</span>
      </div>`;
    }));
    archivosHTML = `<div class="modal-field">
      <span class="modal-field-label">Archivos del cliente (${archivos.length})</span>
      <div class="admin-file-list">${links.join('')}</div>
    </div>`;
  }

  let pagoLink = '';
  if (data.captura_pago_url) {
    const { data: u } = await sb.storage.from('pagos').createSignedUrl(data.captura_pago_url, 3600);
    if (u) pagoLink = `<div class="modal-field">
      <span class="modal-field-label">Comprobante de pago</span>
      <div style="margin-top:6px"><a href="${u.signedUrl}" target="_blank" class="download-link"><span class="ico ico-camera ico-md ico-blue"></span> Ver comprobante</a></div>
    </div>`;
  }

  const estados = [
    ['pago_aprobado', `<span class="ico ico-check-circle ico-sm"></span> Aprobar pago`,   'eb-green'],
    ['en_proceso',    `<span class="ico ico-search ico-sm"></span> En proceso`,            'eb-blue'],
    ['respondido',    `<span class="ico ico-mail ico-sm"></span> Marcar respondido`,       'eb-green'],
    ['cerrado',       `<span class="ico ico-flag ico-sm"></span> Cerrar caso`,             'eb-gray'],
  ];
  const ebHTML = estados.map(([s, l, c]) =>
    `<button class="estado-btn ${data.estado === s ? c : ''}" onclick="cambiarEstado('${id}','${s}')">${l}</button>`
  ).join('');

  document.getElementById('modal-body').innerHTML = `
    <div class="modal-field">
      <span class="modal-field-label">Cliente</span>
      <div class="modal-field-value">${data.email_cliente || '—'}</div>
    </div>
    ${data.nombre_caso ? `<div class="modal-field">
      <span class="modal-field-label">Nombre del expediente</span>
      <div class="modal-field-value" style="font-weight:600;color:var(--violet)"><span class="ico ico-folder ico-sm ico-violet"></span> ${data.nombre_caso}</div>
    </div>` : ''}
    <div class="modal-field">
      <span class="modal-field-label">Estado · ${data.num_archivos||0} archivos · ${data.total_cup||0} CUP</span>
      <div style="margin-top:4px"><span class="status-pill s-${data.estado}">${SL[data.estado]||data.estado}</span></div>
    </div>
    <div class="modal-field">
      <span class="modal-field-label">Recibido</span>
      <div class="modal-field-value">${fmtDate(data.created_at)}</div>
    </div>
    ${archivosHTML}
    ${pagoLink}
    <div id="alert-admin" class="alert"></div>
    <div class="modal-field">
      <span class="modal-field-label">Cambiar estado</span>
      <div class="estado-btns">${ebHTML}</div>
    </div>
    <div class="modal-field">
      <span class="modal-field-label">Respuesta para el cliente</span>
      <textarea class="form-input" id="resp-text" placeholder="Escribe aquí el informe de revisión...">${data.respuesta_admin||''}</textarea>
    </div>
    <div class="modal-field">
      <span class="modal-field-label"><span class="ico ico-clip ico-sm ico-muted" style="vertical-align:middle"></span> Adjuntar archivo</span>
      <div class="file-attach-zone" onclick="document.getElementById('f-adj').click()">
        <input type="file" id="f-adj" accept=".pdf,.jpg,.jpeg,.png,.zip,.doc,.docx" onchange="prevAdj()">
        <strong>Seleccionar archivo</strong>
        <p>PDF, imagen, Word, ZIP</p>
      </div>
      <div class="attach-preview" id="ap">
        <span id="ap-name"></span>
        <button onclick="clearAdj()" style="background:none;border:none;color:var(--red);cursor:pointer;display:flex;align-items:center"><span class="ico ico-close ico-sm ico-red"></span></button>
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="enviarRespuesta('${id}')">
      <span class="ico ico-mail ico-sm ico-white"></span>&nbsp;Guardar y enviar respuesta
    </button>
  `;
    document.getElementById('modal-admin').classList.add('active');
  } finally {
    hideLoading();
  }
}

function prevAdj() {
  const f = document.getElementById('f-adj').files[0];
  if (!f) return;
  document.getElementById('ap').classList.add('active');
  document.getElementById('ap-name').innerHTML = '<span class="ico ico-clip ico-sm ico-blue"></span> ' + f.name;
}
function clearAdj() {
  document.getElementById('f-adj').value = '';
  document.getElementById('ap').classList.remove('active');
  document.getElementById('ap-name').textContent = '';
}
async function cambiarEstado(id, estado) {
  const { error } = await sb.from('casos').update({ estado, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return showAlert('alert-admin','error','Error al cambiar estado: ' + error.message);
  showAlert('alert-admin','success','Estado actualizado ✓');
  loadAdmin(); // refresca la lista de fondo sin bloquear
  await openCaso(id); // recarga el modal con el estado nuevo
}
async function enviarRespuesta(id) {
  const respuesta = document.getElementById('resp-text').value.trim();
  if (!respuesta) return showAlert('alert-admin','error','Escribe la respuesta antes de enviar');
  showLoading('Enviando respuesta...');
  let adj_path = null;
  const adjFile = document.getElementById('f-adj').files[0];
  try {
    if (adjFile) {
      const path = `resp_${id}_${Date.now()}_${adjFile.name}`;
      const { error: ue } = await sb.storage.from('respuestas').upload(path, adjFile);
      if (ue) throw new Error('Error subiendo adjunto: ' + ue.message);
      adj_path = path;
    }
    const upd = { respuesta_admin: respuesta, estado: 'respondido', updated_at: new Date().toISOString() };
    if (adj_path) upd.adjunto_admin_url = adj_path;
    const { error } = await sb.from('casos').update(upd).eq('id', id);
    if (error) throw new Error('Error: ' + error.message);
    closeModal();
    await loadAdmin();
    const rows = document.querySelectorAll('.caso-row');
    rows.forEach(r => {
      if (r.getAttribute('onclick')?.includes(id)) {
        r.style.outline = '2px solid var(--green)';
        setTimeout(() => r.style.outline = '', 2500);
      }
    });
  } catch(err) {
    showAlert('alert-admin','error', err.message);
  } finally {
    hideLoading();
  }
}
function closeModal() { document.getElementById('modal-admin').classList.remove('active'); }

// ═══════════════════════════════
//  INICIO
// ═══════════════════════════════
async function init() {
  showLoading('Iniciando...');
  try {
    const se = localStorage.getItem('lmd_e');
    if (se) {
      document.getElementById('login-email').value = se;
      document.getElementById('reg-email').value   = se;
    }
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      if (currentUser.id === ADMIN_ID) {
        setHeader('Panel de administrador');
        await loadAdmin();
        showView('view-admin');
      } else {
        pendingFiles = [];
        await initDashboard();
        // Badge inicial de no leídos
        const { data: nr } = await sb.from('mensajes_chat')
          .select('id', { count: 'exact' })
          .eq('user_id', currentUser.id)
          .eq('es_admin', true)
          .eq('leido', false);
        _chatUnread = nr?.length || 0;
        _updateChatBadge();
      }
    } else {
      if (localStorage.getItem('lmd_seen')) showAuth('login');
    }
  } finally {
    hideLoading();
  }
}

// ═══════════════════════════════
//  ADMIN — BORRAR CASOS
// ═══════════════════════════════
function openDeleteModal() {
  casosParaBorrar.clear();
  const ic = {
    subiendo_archivos: `<span class="ico ico-folder ico-md ico-blue"></span>`,
    pago_pendiente:    `<span class="ico ico-money ico-md ico-orange"></span>`,
    pago_enviado:      `<span class="ico ico-clock ico-md ico-gold"></span>`,
    pago_aprobado:     `<span class="ico ico-check-circle ico-md ico-green"></span>`,
    en_proceso:        `<span class="ico ico-search ico-md ico-blue"></span>`,
    respondido:        `<span class="ico ico-mail ico-md ico-green"></span>`,
    cerrado:           `<span class="ico ico-flag ico-md ico-muted"></span>`
  };

  // Recuperar casos del DOM actual
  const casoRows = document.querySelectorAll('.caso-row');
  const listEl = document.getElementById('delete-list');

  if (!casoRows.length) {
    listEl.innerHTML = '<div class="empty-state"><p>No hay expedientes para eliminar.</p></div>';
    document.getElementById('modal-delete').classList.add('active');
    return;
  }

  // Reconstruir la lista desde los datos de la última carga
  _adminCasos = _adminCasos || [];
  if (!_adminCasos.length) {
    listEl.innerHTML = '<div class="empty-state"><p>Recarga la lista primero.</p></div>';
    document.getElementById('modal-delete').classList.add('active');
    return;
  }

  listEl.innerHTML = _adminCasos.map(c => `
    <label class="delete-row" for="del-${c.id}">
      <input type="checkbox" id="del-${c.id}" value="${c.id}" onchange="toggleBorrar('${c.id}', this.checked)">
      <div class="caso-emoji">${ic[c.estado] || `<span class="ico ico-file ico-md ico-muted"></span>`}</div>
      <div class="caso-info">
        <div class="caso-email">${c.nombre_caso ? `<strong>${c.nombre_caso}</strong> · ` : ''}${c.email_cliente || '—'}</div>
        <div class="caso-meta">${fmtDate(c.created_at)} · ${SL[c.estado]||c.estado}</div>
      </div>
    </label>
  `).join('');

  document.getElementById('alert-delete').className = 'alert';
  document.getElementById('modal-delete').classList.add('active');
}

function toggleBorrar(id, checked) {
  if (checked) casosParaBorrar.add(id);
  else casosParaBorrar.delete(id);
  const btn = document.getElementById('btn-confirm-delete');
  btn.textContent = casosParaBorrar.size
    ? `Eliminar ${casosParaBorrar.size} expediente${casosParaBorrar.size > 1 ? 's' : ''}`
    : 'Eliminar seleccionados';
}

function closeDeleteModal() {
  document.getElementById('modal-delete').classList.remove('active');
  casosParaBorrar.clear();
}

async function confirmarBorrado() {
  if (!casosParaBorrar.size)
    return showAlert('alert-delete','error','Selecciona al menos un expediente');

  const ids = [...casosParaBorrar];
  const n   = ids.length;
  showLoading(`Eliminando ${n} expediente${n>1?'s':''}...`);
  let errores = 0;
  try {
    for (const id of ids) {
      const { data: archs } = await sb.from('archivos_caso').select('storage_path').eq('caso_id', id);
      const { data: caso }  = await sb.from('casos').select('captura_pago_url,adjunto_admin_url').eq('id', id).single();
      if (archs?.length) await sb.storage.from('expedientes').remove(archs.map(a => a.storage_path));
      if (caso?.captura_pago_url)  await sb.storage.from('pagos').remove([caso.captura_pago_url]);
      if (caso?.adjunto_admin_url) await sb.storage.from('respuestas').remove([caso.adjunto_admin_url]);
      await sb.from('archivos_caso').delete().eq('caso_id', id);
      const { error } = await sb.from('casos').delete().eq('id', id);
      if (error) errores++;
    }
  } finally {
    hideLoading();
  }
  closeDeleteModal();

  if (errores) {
    showAlert('alert-admin','error', `${errores} expediente(s) no se pudieron eliminar`);
  }
  await loadAdmin();
}

document.getElementById('modal-admin').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
document.getElementById('modal-delete').addEventListener('click', function(e) {
  if (e.target === this) closeDeleteModal();
});
document.getElementById('modal-crop').addEventListener('click', function(e) {
  if (e.target === this) closeCropModal();
});

init();

// ════════════════════════════════════════
//  ATENCIÓN AL CLIENTE — CHAT
//  Tabla en Supabase: mensajes_chat
//  Columnas: id, caso_id (nullable), user_id, email_cliente, mensaje,
//            es_admin (bool), leido (bool), created_at
// ════════════════════════════════════════

let _chatOpen        = false;
let _chatSub         = null;   // suscripción realtime cliente
let _chatUnread      = 0;
let _adminChatSub    = null;   // suscripción realtime admin
let _adminChatUserId = null;   // userId de la conversación abierta en admin
let _adminChatUnreadMap = {};  // userId -> nUnread

// ── Utilidades ──────────────────────────
function _chatTs(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function _chatScrollBottom(el) {
  if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
}

function _renderBubble(msg, isClient) {
  // isClient: true => vista del cliente (sent = yo, recv = admin)
  const mine = isClient ? !msg.es_admin : msg.es_admin;
  return `
    <div class="chat-bubble ${mine ? 'sent' : 'recv'}">
      ${msg.mensaje}
      <div class="chat-bubble-meta">${_chatTs(msg.created_at)}</div>
    </div>`;
}

// ── Cliente: abrir/cerrar chat ───────────────────────
function toggleChat() {
  _chatOpen = !_chatOpen;
  const panel = document.getElementById('chat-panel');
  panel.classList.toggle('open', _chatOpen);
  if (_chatOpen) {
    _chatUnread = 0;
    _updateChatBadge();
    loadClientChat();
  }
}

function _updateChatBadge() {
  const badge = document.getElementById('chat-badge');
  if (!badge) return;
  if (_chatUnread > 0) {
    badge.style.display = 'flex';
    badge.textContent = _chatUnread > 9 ? '9+' : _chatUnread;
  } else {
    badge.style.display = 'none';
  }
}

// Cargar mensajes del cliente y suscribirse a nuevos
async function loadClientChat() {
  if (!currentUser) return;
  const cont = document.getElementById('chat-messages');
  if (!cont) return;

  // Cargar historial
  const { data: msgs } = await sb
    .from('mensajes_chat')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (!msgs?.length) {
    cont.innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome-icon"><span class="ico ico-chat" style="font-size:28px;color:var(--violet)"></span></div>
        <p>¡Hola! Escríbenos tu consulta y te ayudaremos lo antes posible.</p>
      </div>`;
  } else {
    cont.innerHTML = msgs.map(m => _renderBubble(m, true)).join('');
    _chatScrollBottom(cont);
    // Marcar como leídos (los del admin)
    await sb.from('mensajes_chat')
      .update({ leido: true })
      .eq('user_id', currentUser.id)
      .eq('es_admin', true)
      .eq('leido', false);
  }

  // Suscripción realtime
  if (_chatSub) _chatSub.unsubscribe();
  _chatSub = sb.channel(`chat_user_${currentUser.id}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'mensajes_chat',
      filter: `user_id=eq.${currentUser.id}`
    }, payload => {
      const msg = payload.new;
      if (msg.es_admin) {
        const cont = document.getElementById('chat-messages');
        if (cont) {
          // Quitar welcome si existe
          const w = cont.querySelector('.chat-welcome');
          if (w) w.remove();
          cont.insertAdjacentHTML('beforeend', _renderBubble(msg, true));
          _chatScrollBottom(cont);
        }
        if (!_chatOpen) {
          _chatUnread++;
          _updateChatBadge();
        } else {
          // Marcar leído inmediatamente
          sb.from('mensajes_chat').update({ leido: true }).eq('id', msg.id);
        }
      }
    })
    .subscribe();
}

async function sendChatMsg() {
  const inp = document.getElementById('chat-input');
  const txt = inp?.value.trim();
  if (!txt || !currentUser) return;
  inp.value = '';

  const msg = {
    user_id:       currentUser.id,
    email_cliente: currentUser.email,
    mensaje:       txt,
    es_admin:      false,
    leido:         false
  };

  // Mostrar optimísticamente
  const cont = document.getElementById('chat-messages');
  if (cont) {
    const w = cont.querySelector('.chat-welcome');
    if (w) w.remove();
    const now = new Date().toISOString();
    cont.insertAdjacentHTML('beforeend', _renderBubble({ ...msg, created_at: now }, true));
    _chatScrollBottom(cont);
  }

  await sb.from('mensajes_chat').insert(msg);

  // Notificar al admin con badge
  _notifyAdminBadge();
}

// Actualizar badge de admin (comprueba sin leer)
async function _notifyAdminBadge() {
  // Lo actualiza loadAdminChats en el lado admin via realtime
}

// ── Admin: tabs ──────────────────────────
function switchAdminTab(tab) {
  document.getElementById('admin-tab-expedientes').style.display = tab === 'expedientes' ? '' : 'none';
  document.getElementById('admin-tab-chat').style.display        = tab === 'chat'        ? '' : 'none';
  document.getElementById('atab-exp').classList.toggle('active', tab === 'expedientes');
  document.getElementById('atab-chat').classList.toggle('active', tab === 'chat');
  if (tab === 'chat') loadAdminChats();
}

// ── Admin: listar conversaciones ─────────
async function loadAdminChats() {
  const list = document.getElementById('admin-chat-list');
  if (!list) return;

  // Obtener todos los mensajes, agrupados por user_id
  const { data: msgs } = await sb
    .from('mensajes_chat')
    .select('*')
    .order('created_at', { ascending: false });

  if (!msgs?.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon"><span class="ico ico-chat ico-2xl ico-muted"></span></span><p>No hay conversaciones aún</p></div>';
    return;
  }

  // Agrupar por user_id, obtener última mensaje y nUnread
  const convMap = {};
  msgs.forEach(m => {
    if (!convMap[m.user_id]) {
      convMap[m.user_id] = { email: m.email_cliente, lastMsg: m, unread: 0 };
    }
    if (!m.es_admin && !m.leido) convMap[m.user_id].unread++;
  });

  const convs = Object.entries(convMap)
    .sort((a, b) => new Date(b[1].lastMsg.created_at) - new Date(a[1].lastMsg.created_at));

  // Badge total
  const totalUnread = convs.reduce((s, [, c]) => s + c.unread, 0);
  const badge = document.getElementById('admin-chat-badge');
  if (badge) {
    badge.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
    badge.textContent = totalUnread > 9 ? '9+' : totalUnread;
  }

  list.innerHTML = convs.map(([uid, c]) => `
    <div class="admin-chat-row ${c.unread > 0 ? 'unread' : ''}" onclick="openAdminChat('${uid}', '${c.email}')">
      <div class="chat-avatar-sm"><span class="ico ico-user ico-sm ico-white" style="font-size:14px"></span></div>
      <div class="admin-chat-row-info">
        <div class="admin-chat-row-email">${c.email || uid}</div>
        <div class="admin-chat-row-preview">${c.lastMsg.es_admin ? '← ' : ''}${c.lastMsg.mensaje}</div>
      </div>
      ${c.unread > 0 ? `<div class="chat-fab-badge" style="position:static;animation:none">${c.unread}</div>` : ''}
      <div class="admin-chat-row-time">${_chatTs(c.lastMsg.created_at)}</div>
    </div>
  `).join('');

  // Suscripción para nuevos mensajes (actualizar lista)
  if (_adminChatSub) return; // ya suscrito
  _adminChatSub = sb.channel('admin_chat_watch')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'mensajes_chat'
    }, () => {
      loadAdminChats();
      // Si el modal del chat está abierto con ese user, refrescar
      if (_adminChatUserId) _refreshAdminChatModal(_adminChatUserId);
    })
    .subscribe();
}

// ── Admin: abrir conversación ─────────────
async function openAdminChat(userId, email) {
  _adminChatUserId = userId;
  document.getElementById('admin-chat-modal-title').textContent = email || 'Conversación';

  const cont = document.getElementById('admin-chat-messages');
  cont.innerHTML = '';

  const { data: msgs } = await sb
    .from('mensajes_chat')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (msgs?.length) {
    cont.innerHTML = msgs.map(m => _renderBubble(m, false)).join('');
    _chatScrollBottom(cont);
    // Marcar mensajes del cliente como leídos
    await sb.from('mensajes_chat')
      .update({ leido: true })
      .eq('user_id', userId)
      .eq('es_admin', false)
      .eq('leido', false);
    loadAdminChats(); // refrescar badges
  } else {
    cont.innerHTML = '<p style="text-align:center;color:var(--t3);font-size:.85rem;padding:20px 0">No hay mensajes aún</p>';
  }

  document.getElementById('modal-admin-chat').classList.add('active');
  document.getElementById('admin-chat-input').focus();
}

async function _refreshAdminChatModal(userId) {
  if (userId !== _adminChatUserId) return;
  const cont = document.getElementById('admin-chat-messages');
  if (!cont) return;
  const { data: msgs } = await sb
    .from('mensajes_chat').select('*')
    .eq('user_id', userId).order('created_at', { ascending: true });
  if (msgs?.length) {
    cont.innerHTML = msgs.map(m => _renderBubble(m, false)).join('');
    _chatScrollBottom(cont);
  }
}

async function sendAdminChatMsg() {
  const inp = document.getElementById('admin-chat-input');
  const txt = inp?.value.trim();
  if (!txt || !_adminChatUserId) return;
  inp.value = '';

  // Obtener email del usuario para el registro
  const { data: last } = await sb.from('mensajes_chat')
    .select('email_cliente').eq('user_id', _adminChatUserId).limit(1).single();

  await sb.from('mensajes_chat').insert({
    user_id:       _adminChatUserId,
    email_cliente: last?.email_cliente || '',
    mensaje:       txt,
    es_admin:      true,
    leido:         false
  });

  await _refreshAdminChatModal(_adminChatUserId);
}

function closeAdminChatModal() {
  document.getElementById('modal-admin-chat').classList.remove('active');
  _adminChatUserId = null;
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('modal-admin-chat');
  if (el) el.addEventListener('click', function(e) {
    if (e.target === this) closeAdminChatModal();
  });
});

// ── INDICADOR DE SCROLL ──────────────────────────────
(function() {
  const hint = document.getElementById('scroll-hint');
  if (!hint) return;

  // Mostrar solo cuando hay contenido suficiente para hacer scroll
  function checkScrollNeeded() {
    const scrollable = document.documentElement.scrollHeight > window.innerHeight + 40;
    hint.style.display = scrollable ? '' : 'none';
  }

  // Ocultar al hacer scroll
  let hideTimer;
  window.addEventListener('scroll', () => {
    hint.classList.add('hidden');
    clearTimeout(hideTimer);
    // Si vuelve arriba del todo, mostrar de nuevo
    hideTimer = setTimeout(() => {
      if (window.scrollY < 30) hint.classList.remove('hidden');
    }, 800);
  }, { passive: true });

  // Comprobar al cargar y al cambiar tamaño
  window.addEventListener('load', checkScrollNeeded);
  window.addEventListener('resize', checkScrollNeeded);
  checkScrollNeeded();
})();
