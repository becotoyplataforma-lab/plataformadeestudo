-- ============================================================
-- ConcursoAI — Domínio: Administration — Seeds (dev/staging apenas)
-- ============================================================

-- Configurações padrão da plataforma.
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('platform.maintenance_mode', 'false'::jsonb, 'Modo de manutenção da plataforma (true/false).')
ON CONFLICT (key) DO NOTHING;
