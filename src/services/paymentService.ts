import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  PaymentRecord,
  CreateCourseOrderResult,
  VerifyCoursePaymentResult,
  CreateConsultationOrderResult,
  VerifyConsultationPaymentResult
} from '../types';

/**
 * Transforms a raw row from public.payments into a domain PaymentRecord object.
 */
export const mapDbRowToPaymentRecord = (row: any): PaymentRecord => ({
  id: row.id,
  userId: row.user_id,
  itemType: (row.item_type as 'course' | 'consultation' | 'subscription') || 'course',
  itemId: row.item_id || null,
  itemTitle: row.item_title || 'Digital Muid Educational Service',
  amount: typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || '0') || 0,
  currency: row.currency || 'INR',
  razorpayOrderId: row.razorpay_order_id || null,
  razorpayPaymentId: row.razorpay_payment_id || null,
  status: (row.status as 'pending' | 'captured' | 'failed' | 'refunded') || 'captured',
  invoiceUrl: row.invoice_url || null,
  createdAt: row.created_at
});

export const paymentService = {
  /**
   * Fetches payment records for the currently authenticated student.
   * Strictly enforces client-side authentication and queries public.payments
   * filtered by user_id under Supabase Row-Level Security.
   */
  async fetchMyPayments(): Promise<{ data: PaymentRecord[]; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        return { data: [], error: null };
      }

      // 1. Obtain current authenticated student session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: [], error: authError || new Error('User is not authenticated') };
      }

      // 2. Fetch payment transactions for this student only, ordered chronologically
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[PaymentService] Error querying payments from Supabase:', error);
        return { data: [], error };
      }

      if (!data || data.length === 0) {
        return { data: [], error: null };
      }

      const domainPayments = data.map(mapDbRowToPaymentRecord);
      return { data: domainPayments, error: null };
    } catch (err: any) {
      console.error('[PaymentService] Unexpected exception fetching payments:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Fetches all payments across the platform for authenticated CRM/Admin users.
   * Calls secure server API /api/payments/admin/all-payments with fallback to Supabase query.
   */
  async fetchAllPaymentsForAdmin(): Promise<{ data: PaymentRecord[]; error: any }> {
    try {
      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            const res = await fetch('/api/payments/admin/all-payments', {
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            });
            if (res.ok) {
              const json = await res.json();
              if (json.success && Array.isArray(json.payments)) {
                return { data: json.payments.map(mapDbRowToPaymentRecord), error: null };
              }
            }
          } catch (apiErr) {
            console.warn('[PaymentService] Server admin payments endpoint notice:', apiErr);
          }
        }

        // Direct fallback query under admin RLS
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return { data: data.map(mapDbRowToPaymentRecord), error: null };
        }
      }

      return { data: [], error: null };
    } catch (err: any) {
      console.error('[PaymentService] Error fetching all payments for admin:', err);
      return { data: [], error: err };
    }
  },
  async createCourseOrder(courseId: string): Promise<CreateCourseOrderResult> {
    try {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          error: 'Authentication service is not configured.'
        };
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        return {
          success: false,
          error: 'You must be signed in to enroll in this course.'
        };
      }

      const response = await fetch('/api/payments/create-course-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ courseId })
      });

      const result: CreateCourseOrderResult = await response.json();
      return result;
    } catch (err: any) {
      console.error('[PaymentService] Error invoking create-course-order API:', err);
      return {
        success: false,
        error: err?.message || 'Failed to connect to order creation service.'
      };
    }
  },

  /**
   * Cryptographically verifies a completed Razorpay Checkout transaction on the server.
   * Transmits ONLY order/payment identifiers, signature, and courseId with the student's JWT.
   * Server determines cryptographic authenticity using RAZORPAY_KEY_SECRET (Phase 2K-D).
   */
  async verifyCoursePayment(params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    courseId: string;
  }): Promise<VerifyCoursePaymentResult> {
    try {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          verified: false,
          error: 'Authentication service is not configured.'
        };
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        return {
          success: false,
          verified: false,
          error: 'You must be signed in to verify payment.'
        };
      }

      const response = await fetch('/api/payments/verify-course-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(params)
      });

      const result: VerifyCoursePaymentResult = await response.json();
      return result;
    } catch (err: any) {
      console.error('[PaymentService] Error verifying course payment:', err);
      return {
        success: false,
        verified: false,
        error: err?.message || 'Network error while verifying payment with server.'
      };
    }
  },

  /**
   * Requests server-side Razorpay order creation for a consultation booking.
   * Price is read strictly server-side from public.consultation_products.
   */
  async createConsultationOrder(bookingDetails: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    businessName: string;
    primaryChallenge: string;
    desiredOutcome: string;
    website?: string;
    linkedin?: string;
    date: string;
    time: string;
  }): Promise<CreateConsultationOrderResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      const response = await fetch('/api/payments/create-consultation-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({ bookingDetails })
      });

      const result: CreateConsultationOrderResult = await response.json();
      return result;
    } catch (err: any) {
      console.error('[PaymentService] Error creating consultation order:', err);
      return {
        success: false,
        error: err?.message || 'Failed to connect to consultation order service.'
      };
    }
  },

  /**
   * Cryptographically verifies a completed Razorpay payment for a consultation booking.
   * Fulfills booking in public.bookings and records payment in public.payments.
   */
  async verifyConsultationPayment(params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    bookingDetails: any;
  }): Promise<VerifyConsultationPaymentResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      const response = await fetch('/api/payments/verify-consultation-payment', {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      });

      const result: VerifyConsultationPaymentResult = await response.json();
      return result;
    } catch (err: any) {
      console.error('[PaymentService] Error verifying consultation payment:', err);
      return {
        success: false,
        verified: false,
        error: err?.message || 'Network error while verifying consultation payment with server.'
      };
    }
  }
};
