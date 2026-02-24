// ============================================================
// news_script.js — Página de Noticias/Banners
// ============================================================
import { supabase, neonColor, timeAgo, userWebId, linkify } from "./supabase.js";

// ─── Estado ─────────────────────────────────────────────────
let isAdmin = false;

// ─── DOM ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const DOM = {
    container:   $("newsBannersContainer"),
    adminPanel:  $("newsAdminPanel"),
    toggleBtn:   $("toggleNewsAdminBtn"),
    exitBtn:     $("exitAdminBtn"),
    addBtn:      $("addBannerBtn"),
    formSection: $("bannerCreationSection"),
    titleInput:  $("bannerTitle"),
    contentInput:$("bannerContent"),
    publishBtn:  $("publishBannerBtn"),
    cancelBtn:   $("cancelBannerBtn"),
};

// ============================================================
// MODO ADMIN
// ============================================================
function setAdminMode(on) {
    isAdmin = on;
    DOM.adminPanel.style.display = on ? "flex" : "none";
    DOM.toggleBtn.style.display  = on ? "none" : "block";
    if (!on) DOM.formSection.style.display = "none";
    loadBanners(); // refrescar para mostrar/ocultar botones de borrado
}

// ============================================================
// BANNERS
// ============================================================
function bannerHTML(banner, likedIds) {
    const color    = neonColor(banner.id);
    const comments = (banner.comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const commentItems = comments.map(c => commentHTML(c, likedIds)).join("");

    return `
    <div class="news-banner" data-id="${banner.id}">
        <div class="banner-header">
            <h3 style="color:${color}">${banner.title}</h3>
            ${isAdmin ? `<button class="delete-banner-btn btn btn-sm btn-danger" data-id="${banner.id}">✕ Borrar</button>` : ""}
        </div>
        <div class="banner-text">${linkify(banner.content)}</div>
        <div class="banner-footer">
            <span class="banner-meta">Publicado: ${timeAgo(banner.created_at)}</span>
            <button class="toggle-comments-btn" data-id="${banner.id}">
                💬 Comentarios (${comments.length})
            </button>
            <div class="comments-list" id="comments-list-${banner.id}" style="display:none">
                ${commentItems || `<p class="no-comments">Sin comentarios aún.</p>`}
                <div class="comment-form">
                    <input  class="commenter-name" placeholder="Tu nombre" maxlength="30" data-id="${banner.id}">
                    <textarea class="comment-content" placeholder="Comentario..." maxlength="250" data-id="${banner.id}"></textarea>
                    <button class="pub-btn btn btn-sm btn-success" data-id="${banner.id}">Enviar</button>
                </div>
            </div>
        </div>
    </div>`;
}

// Comentario individual — igual sistema de likes que index.html (tabla `likes`)
function commentHTML(c, likedIds) {
    const liked = likedIds.has(c.id);
    return `
    <div class="comment-item" data-comment-id="${c.id}">
        <div class="comment-main-row">
            <div class="comment-avatar" style="background:${avatarColor(c.commenter_name)}">${(c.commenter_name||"?")[0].toUpperCase()}</div>
            <div class="comment-bubble">
                <div class="comment-header">
                    <span class="comment-name">${c.commenter_name}</span>
                    <span class="comment-date">${timeAgo(c.created_at)}</span>
                </div>
                <div class="comment-content">${c.comment_text}</div>
                <div class="comment-actions">
                    <button class="like-button banner-like ${liked ? "liked" : ""}" data-id="${c.id}">
                        <span>♥</span>
                        <span class="like-count">${c.likes || 0}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

function avatarColor(name = "?") {
    let h = 0;
    for (const c of name.toLowerCase()) h = c.charCodeAt(0) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360},75%,55%)`;
}

async function loadBanners() {
    // Cargar banners + sus comentarios + los likes del usuario actual
    const [bRes, lRes] = await Promise.all([
        supabase.from("news_banners")
            .select("*, comments:banner_comments(*)")
            .order("created_at", { ascending: false }),
        supabase.from("banner_likes")
            .select("comment_id")
            .eq("user_web_id", userWebId)
    ]);

    if (bRes.error) {
        DOM.container.innerHTML = `<p style="text-align:center;color:#d90429">❌ Error al cargar noticias.</p>`;
        return;
    }

    const likedIds = new Set((lRes.data || []).map(l => l.comment_id));
    DOM.container.innerHTML = (bRes.data || []).map(b => bannerHTML(b, likedIds)).join("") ||
        `<p style="text-align:center;color:white;margin:30px">No hay noticias aún.</p>`;

    DOM.container.addEventListener("click", onContainerClick, { once: true });
}

// Delegación de eventos
function onContainerClick(e) {
    const t = e.target.closest("button, .toggle-comments-btn");
    if (t) {
        if (t.classList.contains("like-button"))       handleLike(t);
        else if (t.classList.contains("pub-btn"))      handleComment(t);
        else if (t.classList.contains("delete-banner-btn")) handleDelete(t.dataset.id);
        else if (t.classList.contains("toggle-comments-btn")) {
            const list = $(`comments-list-${t.dataset.id}`);
            if (list) list.style.display = list.style.display === "block" ? "none" : "block";
        }
    }
    DOM.container.addEventListener("click", onContainerClick, { once: true });
}

// ─── Like — usa tabla `banner_likes` (misma mecánica que comentarios de index) ──
async function handleLike(btn) {
    if (btn.disabled) return;
    btn.disabled  = true;
    const id      = btn.dataset.id;
    const isLiked = btn.classList.contains("liked");
    const counter = btn.querySelector(".like-count");
    const count   = parseInt(counter.textContent) || 0;

    if (isLiked) {
        await supabase.from("banner_likes").delete().eq("comment_id", id).eq("user_web_id", userWebId);
        const n = Math.max(0, count - 1);
        await supabase.from("banner_comments").update({ likes: n }).eq("id", id);
        btn.classList.remove("liked");
        counter.textContent = n;
    } else {
        const { error } = await supabase.from("banner_likes").insert([{ comment_id: id, user_web_id: userWebId }]);
        if (!error) {
            const n = count + 1;
            await supabase.from("banner_comments").update({ likes: n }).eq("id", id);
            btn.classList.add("liked");
            counter.textContent = n;
        }
    }
    btn.disabled = false;
}

// ─── Comentar ────────────────────────────────────────────────
async function handleComment(btn) {
    const id   = btn.dataset.id;
    const name = document.querySelector(`.commenter-name[data-id="${id}"]`)?.value.trim();
    const text = document.querySelector(`.comment-content[data-id="${id}"]`)?.value.trim();
    if (!name || !text) return alert("Completa nombre y comentario.");
    btn.disabled = true;
    const { error } = await supabase.from("banner_comments").insert([{
        banner_id: id, commenter_name: name, comment_text: text, likes: 0
    }]);
    if (!error) loadBanners();
    else alert("❌ Error al publicar.");
    btn.disabled = false;
}

// ─── Publicar banner ────────────────────────────────────────
async function handlePublish() {
    const title   = DOM.titleInput.value.trim();
    const content = DOM.contentInput.value.trim();
    if (!title || !content) return alert("Rellena título y contenido.");
    const { error } = await supabase.from("news_banners").insert([{ title, content }]);
    if (!error) {
        DOM.titleInput.value   = "";
        DOM.contentInput.value = "";
        DOM.formSection.style.display = "none";
        loadBanners();
    } else alert("❌ Error al publicar.");
}

// ─── Borrar banner ───────────────────────────────────────────
async function handleDelete(id) {
    if (!confirm("¿Borrar esta pancarta y todos sus comentarios?")) return;
    // Borrar comentarios + likes de esos comentarios
    const { data: comments } = await supabase.from("banner_comments").select("id").eq("banner_id", id);
    if (comments?.length) {
        const ids = comments.map(c => c.id);
        await supabase.from("banner_likes").delete().in("comment_id", ids);
        await supabase.from("banner_comments").delete().in("id", ids);
    }
    await supabase.from("news_banners").delete().eq("id", id);
    loadBanners();
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    loadBanners();

    DOM.toggleBtn?.addEventListener("click", () => setAdminMode(true));
    DOM.exitBtn?.addEventListener("click",   () => setAdminMode(false));
    DOM.addBtn?.addEventListener("click",    () => { DOM.formSection.style.display = "block"; });
    DOM.publishBtn?.addEventListener("click", handlePublish);
    DOM.cancelBtn?.addEventListener("click",  () => { DOM.formSection.style.display = "none"; });
});
