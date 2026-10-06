import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AvailabilityRules } from '../types';

export const PRODUCTION_AVAILABILITY_RULES_ID = '233d74ce-6146-4c40-b1ac-716fb0d1489d';

/**
 * Transforms a Supabase database row into an application AvailabilityRules object.
 */
export const mapDbRowToAvailabilityRules = (row: any): AvailabilityRules => {
  return {
    id: row.id || PRODUCTION_AVAILABILITY_RULES_ID,
    workingDays: Array.isArray(row.working_days || row.workingDays)
      ? (row.working_days || row.workingDays)
      : [1, 2, 3, 4, 5],
    startTime: row.start_time || row.startTime || '11:00',
    endTime: row.end_time || row.endTime || '20:00',
    slotDurationMinutes: Number(row.slot_duration_minutes ?? row.slotDurationMinutes ?? 30),
    bufferMinutes: Number(row.buffer_minutes ?? row.bufferMinutes ?? 15),
    breakPeriods: Array.isArray(row.break_periods || row.breakPeriods)
      ? (row.break_periods || row.breakPeriods)
      : [{ start: '14:00', end: '15:00', name: 'Strategic Break' }],
    blockedDates: Array.isArray(row.blocked_dates || row.blockedDates)
      ? (row.blocked_dates || row.blockedDates)
      : [],
    blockedSlots: Array.isArray(row.blocked_slots || row.blockedSlots)
      ? (row.blocked_slots || row.blockedSlots)
      : [],
    minNoticeHours: Number(row.min_notice_hours ?? row.minNoticeHours ?? 4),
    maxAdvanceDays: Number(row.max_advance_days ?? row.maxAdvanceDays ?? 30)
  };
};

/**
 * Transforms an application AvailabilityRules object into a Supabase database payload.
 */
export const mapAvailabilityRulesToDbPayload = (r: AvailabilityRules): Record<string, any> => {
  return {
    working_days: r.workingDays,
    start_time: r.startTime,
    end_time: r.endTime,
    slot_duration_minutes: r.slotDurationMinutes,
    buffer_minutes: r.bufferMinutes,
    break_periods: r.breakPeriods,
    blocked_dates: r.blockedDates,
    blocked_slots: r.blockedSlots,
    min_notice_hours: r.minNoticeHours,
    max_advance_days: r.maxAdvanceDays,
    updated_at: new Date().toISOString()
  };
};

/**
 * Availability Service: Modular API for Consultation Scheduling Rules in Supabase
 */
export const availabilityService = {
  /**
   * Fetches availability configuration
   */
  async fetchAvailabilityRules(): Promise<{ data: AvailabilityRules | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const { data, error } = await supabase
        .from('availability_rules')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[availabilityService] Error fetching availability rules:', error);
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: null };
      }

      return { data: mapDbRowToAvailabilityRules(data), error: null };
    } catch (err) {
      console.error('[availabilityService] Unexpected error fetching availability rules:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Updates availability calendar rules via explicit UPDATE targeting the existing row UUID.
   * Does NOT attempt to INSERT or UPSERT, preventing 22P02 invalid UUID errors.
   */
  async updateAvailabilityRules(
    rules: AvailabilityRules
  ): Promise<{ data: AvailabilityRules | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }

    try {
      const targetId =
        rules.id && rules.id.length === 36
          ? rules.id
          : PRODUCTION_AVAILABILITY_RULES_ID;

      const payload = mapAvailabilityRulesToDbPayload(rules);

      const { data, error } = await supabase
        .from('availability_rules')
        .update(payload)
        .eq('id', targetId)
        .select()
        .single();

      if (error) {
        console.error('[availabilityService] Error updating availability rules:', error);
        return { data: null, error };
      }

      return { data: data ? mapDbRowToAvailabilityRules(data) : rules, error: null };
    } catch (err) {
      console.error('[availabilityService] Unexpected error updating availability rules:', err);
      return { data: null, error: err };
    }
  }
};
