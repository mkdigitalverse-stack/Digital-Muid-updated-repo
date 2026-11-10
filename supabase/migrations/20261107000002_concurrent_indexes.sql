-- ==============================================================================
-- DIGITALMUID UNIFIED STUDENT BILLING & GST TAX INVOICE SYSTEM
-- PHASE B: ZERO-DOWNTIME NON-TRANSACTIONAL CONCURRENT INDEX DEPLOYMENT
-- Migration: 20261107000002_concurrent_indexes.sql
--
-- Compliance & Architecture Guarantees (F-03 Audit Compliance):
-- 1. Non-Transactional Execution: In PostgreSQL, CREATE INDEX CONCURRENTLY cannot run
--    inside a transaction block (BEGIN...COMMIT). This script is designed for
--    standalone, sequential execution outside any transaction block.
-- 2. Zero-Downtime: Builds indexes by reading the tables without acquiring ShareLock
--    or AccessExclusiveLock, permitting uninterrupted concurrent writes (INSERT, UPDATE, DELETE).
-- 3. Idempotent & Resilient: Uses IF NOT EXISTS to prevent re-execution errors.
-- 4. Pre-index Duplicate Detection & Recovery Procedures documented below.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRE-INDEX DUPLICATE DETECTION AUDIT (Run before creating indexes)
-- If any query below returns rows, the duplicates must be reconciled before proceeding.
-- ------------------------------------------------------------------------------

-- Audit Profiles: Verify no duplicated student_id values exist
-- SELECT student_id, COUNT(*) AS duplicate_count
-- FROM public.profiles
-- WHERE student_id IS NOT NULL AND TRIM(student_id) != ''
-- GROUP BY student_id
-- HAVING COUNT(*) > 1;

-- Audit Course Enrollments: Verify no duplicated enrollment_id values exist
-- SELECT enrollment_id, COUNT(*) AS duplicate_count
-- FROM public.course_enrollments
-- WHERE enrollment_id IS NOT NULL AND TRIM(enrollment_id) != ''
-- GROUP BY enrollment_id
-- HAVING COUNT(*) > 1;

-- Audit Payments Invoice Numbers: Verify uniqueness
-- SELECT invoice_number, COUNT(*) AS duplicate_count
-- FROM public.payments
-- WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != ''
-- GROUP BY invoice_number
-- HAVING COUNT(*) > 1;

-- Audit Credit Notes: Verify credit_note_number and refund_id uniqueness
-- SELECT credit_note_number, COUNT(*) AS duplicate_count
-- FROM public.credit_notes
-- GROUP BY credit_note_number
-- HAVING COUNT(*) > 1;

-- SELECT refund_id, COUNT(*) AS duplicate_count
-- FROM public.credit_notes
-- WHERE refund_id IS NOT NULL AND TRIM(refund_id) != ''
-- GROUP BY refund_id
-- HAVING COUNT(*) > 1;

-- ------------------------------------------------------------------------------
-- 2. CONCURRENT UNIQUE INDEX CREATION
-- These statements execute one by one without acquiring exclusive locks on live tables.
-- ------------------------------------------------------------------------------

-- Credit Notes: Guaranteed sequential credit note serial number uniqueness
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_number 
  ON public.credit_notes (credit_note_number);

-- Credit Notes: Database-enforced idempotency for refund events (Section 34 CGST Act)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_refund_id 
  ON public.credit_notes (refund_id) 
  WHERE refund_id IS NOT NULL AND TRIM(refund_id) != '';

-- Credit Notes: Lookup index by payment_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_payment_id 
  ON public.credit_notes (payment_id);

-- Credit Notes: Lookup index by user_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_notes_user_id 
  ON public.credit_notes (user_id);

-- Profiles: Permanent Student ID unique partial index
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_student_id 
  ON public.profiles (student_id) 
  WHERE student_id IS NOT NULL AND TRIM(student_id) != '';

-- Course Enrollments: Permanent Enrollment ID unique partial index
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_course_enrollments_enrollment_id 
  ON public.course_enrollments (enrollment_id) 
  WHERE enrollment_id IS NOT NULL AND TRIM(enrollment_id) != '';

-- Payments: Permanent Invoice Number unique partial index (GST Rule 46)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_invoice_number 
  ON public.payments (invoice_number) 
  WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != '';

-- Payments: Primary Credit Note Number unique partial index
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_credit_note_number 
  ON public.payments (credit_note_number) 
  WHERE credit_note_number IS NOT NULL AND TRIM(credit_note_number) != '';

-- ------------------------------------------------------------------------------
-- 3. POST-DEPLOYMENT INDEX VALIDATION QUERY (SEC-06 Compliance)
-- Verifies that all 8 concurrent indexes completed successfully, are marked valid
-- (indisvalid = true) and ready for queries (indisready = true).
-- If any row has is_valid = false OR is_ready = false, follow Section 4 recovery.
-- ------------------------------------------------------------------------------
-- SELECT 
--   c.relname AS index_name,
--   t.relname AS table_name,
--   i.indisvalid AS is_valid,
--   i.indisready AS is_ready,
--   i.indisunique AS is_unique
-- FROM pg_index i
-- JOIN pg_class c ON c.oid = i.indexrelid
-- JOIN pg_class t ON t.oid = i.indrelid
-- WHERE c.relname IN (
--   'idx_credit_notes_number',
--   'idx_credit_notes_refund_id',
--   'idx_credit_notes_payment_id',
--   'idx_credit_notes_user_id',
--   'idx_profiles_student_id',
--   'idx_course_enrollments_enrollment_id',
--   'idx_payments_invoice_number',
--   'idx_payments_credit_note_number'
-- )
-- ORDER BY table_name, index_name;

-- ------------------------------------------------------------------------------
-- 4. INVALID INDEX DETECTION, RECOVERY & ROLLBACK PROCEDURES (SEC-06 Compliance)
-- If a concurrent index build is interrupted by a network timeout, cancellation,
-- or transient deadlock, PostgreSQL leaves an invalid index catalog entry marked
-- with indisvalid = false. Such indexes consume disk and write overhead but cannot
-- be used for queries.
--
-- STEP 1: DETECT INVALID INDEXES
-- Run this query to locate all invalid indexes across the public schema:
-- SELECT 
--   c.relname AS invalid_index_name,
--   t.relname AS table_name,
--   pg_size_pretty(pg_relation_size(c.oid)) AS index_size,
--   i.indisvalid,
--   i.indisready
-- FROM pg_index i
-- JOIN pg_class c ON c.oid = i.indexrelid
-- JOIN pg_class t ON t.oid = i.indrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND (i.indisvalid = false OR i.indisready = false);
--
-- STEP 2: DROP INVALID INDEXES CONCURRENTLY (Non-blocking cleanup)
-- Never run DROP INDEX without CONCURRENTLY on live production tables, as standard
-- DROP INDEX acquires an AccessExclusiveLock. Run the appropriate drop statement:
--
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_number;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_refund_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_payment_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_credit_notes_user_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_profiles_student_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_course_enrollments_enrollment_id;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_payments_invoice_number;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_payments_credit_note_number;
--
-- STEP 3: SAFELY RERUN PHASE B
-- Because Phase B statements use IF NOT EXISTS, once invalid indexes are dropped,
-- the entire Phase B script can be safely re-executed sequentially.
-- Any previously succeeded valid indexes will be skipped cleanly without error.
--
-- STEP 4: RE-VALIDATE (Both indisvalid = true AND indisready = true)
-- Re-run Section 3 query to confirm all 8 indexes report is_valid = true and is_ready = true.
-- ------------------------------------------------------------------------------
