-- Migration: Prevent duplicate active bookings on the same date and time slot
-- Exact Database Index / Constraint Name: idx_unique_active_booking_slot
-- Purpose: Ensures PostgreSQL database-level guarantee that no two ACTIVE bookings
-- (status 'confirmed' or 'rescheduled') can occupy the same booking_date and booking_time.
-- Cancelled and completed bookings do NOT block the slot.

-- 1. Create partial unique index on bookings table
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_slot
ON bookings (booking_date, booking_time)
WHERE status IN ('confirmed', 'rescheduled');

-- 2. Optional Comment on Index for database documentation
COMMENT ON INDEX idx_unique_active_booking_slot IS
'Enforces slot uniqueness for active consultation bookings. Cancelled bookings do not conflict.';
