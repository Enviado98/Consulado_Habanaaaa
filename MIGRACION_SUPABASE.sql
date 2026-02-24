-- ============================================================
-- MIGRACIÓN REQUERIDA EN SUPABASE
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabla para likes de comentarios de banners (news.html)
--    Misma mecánica que la tabla "likes" de comentarios del index
CREATE TABLE IF NOT EXISTS banner_likes (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id   bigint NOT NULL REFERENCES banner_comments(id) ON DELETE CASCADE,
    user_web_id  text NOT NULL,
    created_at   timestamptz DEFAULT now(),
    UNIQUE (comment_id, user_web_id)   -- evita doble voto a nivel de DB
);

-- 2. Índice para consultas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_banner_likes_user ON banner_likes(user_web_id);

-- ============================================================
-- RLS (Row Level Security) — RECOMENDADO cuando cambies a anon key
-- ============================================================
-- Descomentar estas líneas cuando estés listo para usar anon key:

-- ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE noticias        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE comentarios     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE likes           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE page_views      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE status_data     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE news_banners    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE banner_comments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE banner_likes    ENABLE ROW LEVEL SECURITY;

-- Política de acceso público (cualquiera puede leer y escribir — es una web comunitaria)
-- CREATE POLICY "public_all" ON items           FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_all" ON noticias        FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_all" ON comentarios     FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_all" ON likes           FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_all" ON page_views      FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_all" ON status_data     FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_all" ON news_banners    FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_all" ON banner_comments FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "public_all" ON banner_likes    FOR ALL USING (true) WITH CHECK (true);
