# 🚀 Instrucciones de Despliegue — Versión Optimizada

## Archivos del proyecto

```
supabase.js        ← NUEVO: módulo compartido (importado por los dos scripts)
script.js          ← Reescrito (página principal)
news_script.js     ← Reescrito (página de noticias)
index.html         ← Sin cambios relevantes
news.html          ← Limpiado (eliminado import duplicado de Supabase)
styles.css         ← Sin cambios
news_styles.css    ← Sin cambios
MIGRACION_SUPABASE.sql ← Ejecutar en Supabase antes de subir
```

---

## Paso 1 — Migración en Supabase

1. Abre **Supabase Dashboard → SQL Editor**
2. Ejecuta el contenido de `MIGRACION_SUPABASE.sql`
   - Crea la tabla `banner_likes` (necesaria para likes en noticias)

---

## Paso 2 — Subir archivos

Sube **todos los archivos** a tu hosting (GitHub Pages, Netlify, etc.).  
El orden no importa, pero `supabase.js` debe estar en la **misma carpeta** que `script.js` y `news_script.js`.

---

## Paso 3 (opcional pero recomendado) — Cambiar a clave anon

En `supabase.js`, la constante `SUPABASE_ANON` actualmente contiene la clave `service_role`.  
Para mayor seguridad, reemplázala por la **anon key** y activa RLS:

1. En Supabase: **Settings → API → anon public** → copia esa clave
2. En `supabase.js`: pega la anon key en `SUPABASE_ANON`
3. En Supabase SQL Editor: descomenta las líneas RLS de `MIGRACION_SUPABASE.sql`

Esto no afecta la funcionalidad — la web seguirá siendo 100% editable por la comunidad.

---

## Qué cambió (resumen técnico)

| Aspecto | Antes | Ahora |
|---|---|---|
| Código duplicado | URL/key en 2 archivos | Un solo `supabase.js` |
| Edición de tarjetas | DOM manipulation frágil | `contenteditable` nativo |
| Likes en noticias | `localStorage` + UPDATE directo | Tabla `banner_likes` en DB |
| Imports de Supabase | 2 imports independientes | 1 módulo compartido |
| Delegación de eventos | `forEach` + listeners múltiples | Event delegation (1 listener) |
| Borrado de banner | Solo borraba el banner | Borra banner + comentarios + likes |
