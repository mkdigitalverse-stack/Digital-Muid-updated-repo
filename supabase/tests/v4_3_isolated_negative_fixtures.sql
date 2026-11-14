-- ==============================================================================
-- DIGITALMUID V4.3 — ISOLATED NEGATIVE & CORRUPTION FIXTURES (PRE-MIGRATION HALTS)
-- File: supabase/tests/v4_3_isolated_negative_fixtures.sql
-- ==============================================================================
-- PURPOSE:
-- Non-destructive isolated negative scenarios verifying that Phase A and Phase B
-- FAIL CLOSED on corrupted historical data, unapproved status constraints, and
-- misconfigured pre-existing indexes.
--
-- HOW TO USE:
-- Apply one scenario at a time before executing Phase A or Phase B against a
-- disposable copy of `digitalmuid_v43_legacy_test` (initialized ONLY with
-- v4_3_isolated_legacy_fixture.sql — NEVER apply both fresh and legacy fixtures
-- to the same database). Each block can be uncommented or run inside a
-- disposable copy of `digitalmuid_v43_legacy_test`.
--
-- SAFETY:
-- - NEVER execute against production or any hosted Supabase DB.
-- - NOT EXECUTED automatically.
-- ==============================================================================

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_migrations')
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    RAISE EXCEPTION 'SAFETY HALT: Hosted Supabase environment detected.';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- CASE N1: Invalid / NULL / NaN / >2-decimal historical credit_notes rows
-- Expected Phase A Result: Migration HALTS in Section 6 fail-closed audit.
-- ------------------------------------------------------------------------------
-- BEGIN;
-- INSERT INTO public.credit_notes (id, credit_note_number, original_invoice_number, payment_id, refund_id, amount, base_amount, tax_amount, currency)
-- VALUES
--   ('41000000-0000-4000-8000-000000000001', 'CN/26-27/0091', 'DM/26-27/0003', '   ', 'rfnd_bad_blank_pid', 100.00, 84.75, 15.25, 'INR'),
--   ('41000000-0000-4000-8000-000000000002', 'CN/26-27/0092', 'DM/26-27/0003', 'pay_leg_101', 'rfnd_bad_nan', 'NaN'::NUMERIC, 84.75, 15.25, 'INR'),
--   ('41000000-0000-4000-8000-000000000003', 'CN/26-27/0093', 'DM/26-27/0003', 'pay_leg_101', 'rfnd_bad_3dec', 10.125, 8.58, 1.55, 'INR');
-- COMMIT;

-- ------------------------------------------------------------------------------
-- CASE N2: Orphaned & Ambiguously Linked Historical credit_notes Rows
-- Expected Phase A Result: Migration HALTS with orphan/ambiguous count > 0.
-- ------------------------------------------------------------------------------
-- BEGIN;
-- -- Orphan: payment_id does not exist in public.payments
-- INSERT INTO public.credit_notes (id, credit_note_number, original_invoice_number, payment_id, refund_id, amount, base_amount, tax_amount, currency)
-- VALUES ('42000000-0000-4000-8000-000000000001', 'CN/26-27/0094', 'DM/26-27/0003', 'pay_orphan_missing', 'rfnd_orphan_1', 100.00, 84.75, 15.25, 'INR');
--
-- -- Ambiguous: payment B stores payment A's UUID string inside razorpay_payment_id
-- INSERT INTO public.payments (id, user_id, item_type, item_id, item_title, amount, currency, razorpay_order_id, razorpay_payment_id, status)
-- VALUES ('30000000-0000-4000-8000-000000000199', '10000000-0000-4000-8000-000000000001', 'course', '90000000-0000-4000-8000-000000000001', 'Ambiguous Collision Row', 500.00, 'INR', 'order_ambig', '30000000-0000-4000-8000-000000000101', 'captured');
-- INSERT INTO public.credit_notes (id, credit_note_number, original_invoice_number, payment_id, refund_id, amount, base_amount, tax_amount, currency)
-- VALUES ('42000000-0000-4000-8000-000000000002', 'CN/26-27/0095', 'DM/26-27/0003', '30000000-0000-4000-8000-000000000101', 'rfnd_ambig_1', 100.00, 84.75, 15.25, 'INR');
-- COMMIT;

-- ------------------------------------------------------------------------------
-- CASE N3: Over-Refunded Payment & Currency-Mismatched Historical Credit Notes
-- Expected Phase A Result: Migration HALTS in historical total/currency check.
-- ------------------------------------------------------------------------------
-- BEGIN;
-- -- Cumulative credit notes on pay_leg_101 become 400 + 700 = 1100 > 1000.00
-- INSERT INTO public.credit_notes (id, credit_note_number, original_invoice_number, payment_id, refund_id, amount, base_amount, tax_amount, currency)
-- VALUES ('43000000-0000-4000-8000-000000000001', 'CN/26-27/0096', 'DM/26-27/0003', 'pay_leg_101', 'rfnd_over_1', 700.00, 593.22, 106.78, 'INR');
--
-- -- Currency mismatch (USD credit note against INR payment pay_leg_102)
-- INSERT INTO public.credit_notes (id, credit_note_number, original_invoice_number, payment_id, refund_id, amount, base_amount, tax_amount, currency)
-- VALUES ('43000000-0000-4000-8000-000000000002', 'CN/26-27/0097', 'DM/26-27/0004', 'pay_leg_102', 'rfnd_curr_mismatch', 100.00, 84.75, 15.25, 'USD');
-- COMMIT;

-- ------------------------------------------------------------------------------
-- CASE N4: Unapproved Multi-Column Status CHECK & Unrecognized Status Value
-- Expected Phase A Result: Migration HALTS cleanly without broad constraint drop.
-- ------------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE public.payments
--   ADD CONSTRAINT chk_unapproved_status_amount CHECK (status <> 'captured' OR amount > 0);
-- -- OR unrecognized status:
-- -- ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
-- -- UPDATE public.payments SET status = 'chargeback_manual' WHERE id = '30000000-0000-4000-8000-000000000104';
-- COMMIT;

-- ------------------------------------------------------------------------------
-- CASE N5: Incorrect Pre-Existing Indexes (For Phase B Preflight & Gate Audit)
-- Expected Phase B Preflight AND Phase A Gate Result: Both HALT on mismatched
-- table, column, uniqueness, or missing/wrong partial BTRIM predicate.
-- ------------------------------------------------------------------------------
-- -- Wrong table: idx_credit_notes_refund_id placed on public.payments instead of public.credit_notes
-- CREATE UNIQUE INDEX idx_credit_notes_refund_id ON public.payments (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
--
-- -- Wrong column: idx_credit_notes_number built on (user_id) instead of (credit_note_number)
-- CREATE UNIQUE INDEX idx_credit_notes_number ON public.credit_notes (user_id) WHERE user_id IS NOT NULL;
--
-- -- Non-unique index where unique is required:
-- -- CREATE INDEX idx_credit_notes_refund_id ON public.credit_notes (refund_id);
--
-- -- Non-partial unique index missing partial predicate:
-- -- CREATE UNIQUE INDEX idx_credit_notes_refund_id ON public.credit_notes (refund_id);
--
-- -- Wrong partial predicate (IS NOT NULL only, missing AND BTRIM(..., E' \t\n\r\f\v') != ''):
-- -- CREATE UNIQUE INDEX idx_credit_notes_refund_id ON public.credit_notes (refund_id) WHERE refund_id IS NOT NULL;
