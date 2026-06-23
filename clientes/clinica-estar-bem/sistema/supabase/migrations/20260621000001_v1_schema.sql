-- ============================================================
-- Núcleo Estar Bem — Schema v1 (agendamento sem pagamento)
-- Rodar no Supabase SQL Editor após apagar dados de teste
-- ============================================================

-- 1. Limpar schema anterior (ordem inversa das dependências)
DROP TABLE IF EXISTS repasses        CASCADE;
DROP TABLE IF EXISTS cancellations   CASCADE;
DROP TABLE IF EXISTS payments        CASCADE;
DROP TABLE IF EXISTS reservations    CASCADE;
DROP TABLE IF EXISTS patients        CASCADE;
DROP TABLE IF EXISTS psychologist_rooms CASCADE;
DROP TABLE IF EXISTS psychologists   CASCADE;
DROP TABLE IF EXISTS room_blocks     CASCADE;
DROP TABLE IF EXISTS professionals   CASCADE;
DROP TABLE IF EXISTS rooms           CASCADE;
DROP TABLE IF EXISTS users           CASCADE;
DROP TABLE IF EXISTS settings        CASCADE;

-- 2. Criar tabelas

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'professional')),
  phone      TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE professionals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rooms (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  name   TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id),
  room_id         UUID NOT NULL REFERENCES rooms(id),
  start_at        TEXT NOT NULL,
  end_at          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cancellations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    UUID NOT NULL UNIQUE REFERENCES reservations(id),
  cancelled_by      UUID REFERENCES users(id),
  cancelled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hours_before_start DECIMAL(6,2) NOT NULL
);

CREATE TABLE room_blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id),
  date       DATE NOT NULL,
  hour       INTEGER NOT NULL CHECK (hour >= 7 AND hour <= 21),
  blocked_by UUID NOT NULL REFERENCES users(id),
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, date, hour)
);

-- 3. RLS
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_blocks   ENABLE ROW LEVEL SECURITY;

-- Permite leitura do próprio perfil na tabela users (anon e authenticated)
CREATE POLICY "users: leitura própria"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- 4. Seed inicial
INSERT INTO settings (key, value) VALUES ('cancellation_tolerance_hours', '5');

INSERT INTO rooms (number, name) VALUES
  (1, 'Sala 1'),
  (2, 'Sala 2'),
  (3, 'Sala 3'),
  (4, 'Sala 4'),
  (5, 'Sala 5');
