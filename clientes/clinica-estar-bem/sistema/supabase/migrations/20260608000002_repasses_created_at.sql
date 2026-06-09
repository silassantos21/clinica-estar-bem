-- Adicionar created_at em repasses para ordenação cronológica
ALTER TABLE repasses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_repasses_created_at ON repasses (created_at);
