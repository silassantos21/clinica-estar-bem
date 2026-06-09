-- ============================================================
-- No-show automático via pg_cron (Supabase)
-- Roda a cada 15 minutos e processa reservas confirmed expiradas
-- ============================================================
-- COMO APLICAR:
--   1. Supabase Dashboard → SQL Editor
--   2. Cole este arquivo inteiro e clique em "Run"
--   3. Pronto — o job passa a rodar automaticamente
-- ============================================================

-- Habilitar a extensão (já vem no Supabase, só precisa ativar uma vez)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover job anterior se existir (permite reaplicar sem erro)
SELECT cron.unschedule('no-show-checker')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'no-show-checker'
  );

-- Criar o job: roda a cada 15 minutos
SELECT cron.schedule(
  'no-show-checker',   -- nome do job
  '*/15 * * * *',      -- a cada 15 min
  $$
    -- 1. Marcar pagamentos como retained
    UPDATE payments p
    SET status = 'retained'
    FROM reservations r
    WHERE r.id = p.reservation_id
      AND r.status = 'confirmed'
      AND r.end_at < NOW()
      AND p.status = 'paid';

    -- 2. Criar registros de cancellation (idempotente — só insere se não existe)
    INSERT INTO cancellations (
      reservation_id, cancelled_by, reason, cancelled_at,
      hours_before_start, penalty_applied, clinic_amount, psychologist_amount
    )
    SELECT
      r.id,
      NULL,
      'no_show',
      NOW(),
      0,
      TRUE,
      ROUND(r.total_amount * (1 - ps.penalty_split_rate), 2),
      ROUND(r.total_amount * ps.penalty_split_rate, 2)
    FROM reservations r
    JOIN psychologists ps ON ps.id = r.psychologist_id
    WHERE r.status = 'confirmed'
      AND r.end_at < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM cancellations c WHERE c.reservation_id = r.id
      );

    -- 3. Criar repasses pendentes para o psicólogo (idempotente)
    INSERT INTO repasses (reservation_id, psychologist_id, amount, status)
    SELECT
      r.id,
      r.psychologist_id,
      ROUND(r.total_amount * ps.penalty_split_rate, 2),
      'pending'
    FROM reservations r
    JOIN psychologists ps ON ps.id = r.psychologist_id
    WHERE r.status = 'confirmed'
      AND r.end_at < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM repasses rp WHERE rp.reservation_id = r.id
      );

    -- 4. Marcar reservas como no_show (por último, após inserir os registros)
    UPDATE reservations
    SET status = 'no_show'
    WHERE status = 'confirmed'
      AND end_at < NOW();
  $$
);
