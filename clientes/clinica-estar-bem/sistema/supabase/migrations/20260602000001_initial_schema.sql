-- ============================================================
-- Clínica Estar Bem — Schema inicial
-- ============================================================

-- settings: parâmetros configuráveis pelo admin sem deploy
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION settings_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION settings_set_updated_at();

INSERT INTO settings (key, value) VALUES ('cancellation_tolerance_hours', '9');

-- users: estende auth.users com perfil e role
CREATE TABLE users (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  role       TEXT        NOT NULL CHECK (role IN ('admin', 'psychologist')),
  phone      TEXT,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- psychologists: dados contratuais do psicólogo
CREATE TABLE psychologists (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  crp                TEXT,
  -- percentual do valor retido que vai pro psicólogo (ex: 0.30 = 30%)
  penalty_split_rate DECIMAL(3,2) NOT NULL DEFAULT 0.30
    CHECK (penalty_split_rate >= 0 AND penalty_split_rate <= 1)
);

-- rooms: salas disponíveis para locação
CREATE TABLE rooms (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT         NOT NULL,
  floor       TEXT,
  hourly_rate DECIMAL(10,2) NOT NULL,
  active      BOOLEAN      NOT NULL DEFAULT TRUE
);

-- psychologist_rooms: tarifa customizada por contrato (nullable = usa rooms.hourly_rate)
CREATE TABLE psychologist_rooms (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID          NOT NULL REFERENCES psychologists(id) ON DELETE CASCADE,
  room_id          UUID          NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  custom_rate      DECIMAL(10,2),
  UNIQUE (psychologist_id, room_id)
);

-- patients: pacientes pertencentes ao psicólogo (sem login)
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id UUID NOT NULL REFERENCES psychologists(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT
);

-- reservations: reserva de sala (blocos fixos de 1h)
CREATE TABLE reservations (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id UUID          NOT NULL REFERENCES psychologists(id),
  room_id         UUID          NOT NULL REFERENCES rooms(id),
  patient_id      UUID          REFERENCES patients(id),
  start_at        TIMESTAMPTZ   NOT NULL,
  end_at          TIMESTAMPTZ   NOT NULL, -- sempre start_at + 1h, calculado na API
  total_amount    DECIMAL(10,2) NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- impede double-booking: mesma sala, mesmo horário, status ativo
CREATE UNIQUE INDEX idx_reservations_no_overlap
  ON reservations (room_id, start_at)
  WHERE status NOT IN ('cancelled');

CREATE INDEX idx_reservations_psychologist ON reservations (psychologist_id);
CREATE INDEX idx_reservations_status       ON reservations (status);
CREATE INDEX idx_reservations_start_at     ON reservations (start_at);

-- payments: pagamento vinculado 1:1 à reserva
CREATE TABLE payments (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id   UUID          NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  amount           DECIMAL(10,2) NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'retained')),
  mp_preference_id TEXT,
  mp_payment_id    TEXT,
  payment_link_url TEXT,
  paid_at          TIMESTAMPTZ,
  refunded_at      TIMESTAMPTZ
);

-- cancellations: registro de cancelamento (inclui no-show gerado pelo cron)
CREATE TABLE cancellations (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id      UUID          NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  cancelled_by        UUID          REFERENCES users(id), -- NULL quando gerado pelo sistema (no-show)
  reason              TEXT          NOT NULL
    CHECK (reason IN ('patient_request', 'psychologist_decision', 'clinic_decision', 'no_show')),
  cancelled_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  hours_before_start  DECIMAL(6,2),
  penalty_applied     BOOLEAN       NOT NULL DEFAULT FALSE,
  clinic_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  psychologist_amount DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- repasses: valores a pagar ao psicólogo (penalidade ou sessão realizada)
CREATE TABLE repasses (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID          NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  psychologist_id UUID          NOT NULL REFERENCES psychologists(id),
  amount          DECIMAL(10,2) NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid')),
  paid_at         TIMESTAMPTZ,
  paid_by         UUID          REFERENCES users(id),
  notes           TEXT
);

CREATE INDEX idx_repasses_psychologist ON repasses (psychologist_id);
CREATE INDEX idx_repasses_status       ON repasses (status);

-- ============================================================
-- Row Level Security
-- A API usa a service_role key (bypassa RLS).
-- O frontend usa anon key + JWT — só lê o próprio perfil.
-- ============================================================

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychologists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychologist_rooms  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE repasses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado lê o próprio perfil
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

-- Demais tabelas: bloqueadas pro anon/user — acesso só via service_role (API)
-- (sem policy = deny por default com RLS ativo)
