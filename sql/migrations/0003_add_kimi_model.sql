-- Add Kimi/Moonshot as a selectable AI model without changing existing rows.
ALTER TYPE ai_model ADD VALUE IF NOT EXISTS 'kimi';