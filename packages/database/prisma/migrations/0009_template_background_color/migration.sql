-- Only meaningful for email_footer, the one shared email piece with no imposed background (the
-- header and body both keep a fixed white background per the NCB Email Design Style Guide, since
-- the logo must always sit on solid white) -- a #rrggbb value wraps the footer's own content in a
-- colored, padded band. Null means no wrapper, same rendering as before this column existed.

ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS background_color VARCHAR(20);
