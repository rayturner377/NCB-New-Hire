-- Remembers which editor mode (WYSIWYG "text" vs raw-HTML "code") a template was last saved
-- with, so re-opening it defaults back to the same mode rather than always defaulting to the
-- WYSIWYG editor — that editor re-parses HTML through TipTap's own node model on load, which
-- would silently mangle hand-written HTML/embedded CSS from Code mode.

ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS body_mode VARCHAR(10) NOT NULL DEFAULT 'text';
