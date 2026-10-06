import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Booking } from '../types';

/**
 * Transforms a Supabase database row into an application Booking object.
 */
export const mapDbRowToBooking = (row: any): Booking => {
  const rawDate = row.booking_date || row.date || '';
  const formattedDate = typeof rawDate === 'string' && rawDate.includes('T')
    ? rawDate.split('T')[0]
    : String(rawDate || '');

  return {
    id: String(row.id || `bk-${Date.now()}`),
    bookingCode: String(row.booking_code || row.bookingCode || ''),
    customerName: String(row.customer_name || row.customerName || ''),
    customerEmail: String(row.customer_email || row.customerEmail || ''),
    customerPhone: String(row.customer_phone || row.customerPhone || ''),
    businessName: String(row.business_name || row.businessName || ''),
    primaryChallenge: String(row.primary_challenge || row.primaryChallenge || ''),
    desiredOutcome: String(row.desired_outcome || row.desiredOutcome || ''),
    website: row.website ? String(row.website) : undefined,
    linkedin: row.linkedin ? String(row.linkedin) : undefined,
    instagram: row.instagram ? String(row.instagram) : undefined,
    date: formattedDate,
    time: String(row.booking_time || row.time || ''),
    durationMinutes: Number(row.duration_minutes ?? row.durationMinutes ?? 30),
    baseAmount: Number(row.base_amount ?? row.baseAmount ?? 499),
    gstRate: Number(row.gst_rate ?? row.gstRate ?? 0.18),
    gstAmount: Number(row.gst_amount ?? row.gstAmount ?? 89.82),
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 588.82),
    currency: String(row.currency || 'INR'),
    paymentId: String(row.payment_id || row.paymentId || ''),
    razorpayOrderId: String(row.razorpay_order_id || row.razorpayOrderId || ''),
    paymentStatus: (row.payment_status || row.paymentStatus || 'paid') as any,
    calendarEventId: String(row.calendar_event_id || row.calendarEventId || ''),
    meetUrl: String(row.meet_url || row.meetUrl || ''),
    status: (row.status || 'confirmed') as any,
    userId: row.user_id ? String(row.user_id) : (row.userId ? String(row.userId) : undefined),
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    notes: row.notes ? String(row.notes) : undefined
  };
};

/**
 * Transforms an application Booking object into a Supabase database payload.
 */
export const mapBookingToDbPayload = (b: Booking): Record<string, any> => {
  return {
    id: b.id,
    booking_code: b.bookingCode,
    customer_name: b.customerName,
    customer_email: b.customerEmail,
    customer_phone: b.customerPhone,
    business_name: b.businessName,
    primary_challenge: b.primaryChallenge,
    desired_outcome: b.desiredOutcome,
    website: b.website || null,
    linkedin: b.linkedin || null,
    instagram: b.instagram || null,
    booking_date: b.date,
    booking_time: b.time,
    duration_minutes: b.durationMinutes,
    base_amount: b.baseAmount,
    gst_rate: b.gstRate,
    gst_amount: b.gstAmount,
    total_amount: b.totalAmount,
    currency: b.currency,
    payment_id: b.paymentId,
    razorpay_order_id: b.razorpayOrderId,
    payment_status: b.paymentStatus,
    calendar_event_id: b.calendarEventId,
    meet_url: b.meetUrl,
    status: b.status,
    user_id: b.userId || null,
    notes: b.notes || null,
    created_at: b.createdAt
  };
};

/**
 * Booking Service: Modular API for Consultation Bookings in Supabase
 */
export const bookingService = {
  /**
   * Fetches all bookings belonging to the currently authenticated student.
   * Scoped strictly to auth.uid() = user_id or customer_email matching authenticated user,
   * fully adhering to Supabase RLS and database indexes.
   */
  async fetchMyBookings(): Promise<{ data: Booking[]; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: [], error: null };
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: [], error: authError || 'User is not authenticated' };
      }

      let query = supabase
        .from('bookings')
        .select('*');

      if (user.email) {
        query = query.or(`user_id.eq.${user.id},customer_email.eq.${user.email}`);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query
        .order('booking_date', { ascending: false })
        .order('booking_time', { ascending: false });

      if (error) {
        console.error('[Supabase Booking] Error fetching student bookings:', error);
        return { data: [], error };
      }

      const mapped = (data || []).map(mapDbRowToBooking);
      return { data: mapped, error: null };
    } catch (err) {
      console.error('[Supabase Booking] Unexpected student fetch exception:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Fetches all bookings (for Admin view or availability synchronization)
   */
  async fetchBookings(): Promise<{ data: Booking[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase Booking] Fetch error from public.bookings:', error);
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToBooking);
      console.info(`[Supabase Booking] Successfully fetched ${mapped.length} booking(s) from public.bookings`);
      return { data: mapped, error: null };
    } catch (err) {
      console.error('[Supabase Booking] Unexpected fetch exception:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetches active (confirmed or rescheduled) bookings for a specific date
   * Used for real-time slot collision checks against Supabase.
   */
  async fetchBookingsByDate(date: string): Promise<{ data: Booking[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_date', date)
        .in('status', ['confirmed', 'rescheduled']);

      if (error) {
        return { data: null, error };
      }

      const mapped = (data || []).map(mapDbRowToBooking);
      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Inserts a newly confirmed booking into Supabase.
   * Catches database-level unique constraint violations (idx_unique_active_booking_slot)
   * and maps them to a user-friendly error.
   */
  async insertBooking(booking: Booking): Promise<{ data: Booking | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const payload = mapBookingToDbPayload(booking);
      // Execute direct insert without .select().single() so anonymous clients (with INSERT RLS permission)
      // successfully insert without failing on post-insert SELECT restrictions.
      const { error } = await supabase
        .from('bookings')
        .insert(payload);

      if (error) {
        console.error('[Supabase Booking] Insert error details:', error);
        // Check for PostgreSQL unique violation (code 23505 or constraint match)
        if (
          error.code === '23505' ||
          (error.message && (
            error.message.includes('idx_unique_active_booking_slot') ||
            error.message.includes('unique constraint') ||
            error.message.includes('duplicate key')
          ))
        ) {
          const friendlyError = new Error('This time slot is no longer available. Please select another slot.');
          (friendlyError as any).code = 'SLOT_ALREADY_BOOKED';
          (friendlyError as any).isConflict = true;
          return { data: null, error: friendlyError };
        }
        return { data: null, error };
      }

      return { data: booking, error: null };
    } catch (err: any) {
      console.error('[Supabase Booking] Unexpected insert error:', err);
      if (err?.code === '23505' || err?.message?.includes('duplicate key')) {
        const friendlyError = new Error('This time slot is no longer available. Please select another slot.');
        (friendlyError as any).code = 'SLOT_ALREADY_BOOKED';
        (friendlyError as any).isConflict = true;
        return { data: null, error: friendlyError };
      }
      return { data: null, error: err };
    }
  },

  /**
   * Updates an existing booking (status, reschedule date/time, notes)
   */
  async updateBooking(
    id: string,
    updates: Partial<Booking>
  ): Promise<{ data: Booking | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.date !== undefined) dbUpdates.booking_date = updates.date;
      if (updates.time !== undefined) dbUpdates.booking_time = updates.time;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.paymentStatus !== undefined) dbUpdates.payment_status = updates.paymentStatus;
      if (updates.paymentId !== undefined) dbUpdates.payment_id = updates.paymentId;

      const { data, error } = await supabase
        .from('bookings')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data ? mapDbRowToBooking(data) : null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Deletes a booking from Supabase
   */
  async deleteBooking(id: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase is not configured') };
    }

    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) {
        return { success: false, error };
      }
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err };
    }
  }
};
