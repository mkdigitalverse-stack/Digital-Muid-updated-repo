/**
 * Student Course Certificates Service (Student Phase 2I)
 * Handles certificate issuance, student certificate retrieval,
 * and public credential authenticity verification.
 *
 * Enforces strict single-certificate issuance per course/student pair.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Certificate } from '../types';

/**
 * Transforms a raw database record from public.certificates into a domain Certificate object.
 */
export const mapDbRowToCertificate = (row: any): Certificate => ({
  id: row.id,
  userId: row.user_id,
  courseId: row.course_id,
  certificateNumber: row.certificate_number,
  recipientName: row.recipient_name,
  courseTitle: row.course_title,
  issuedAt: row.issued_at || row.created_at,
  verificationHash: row.verification_hash,
  metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const CERT_STORAGE_PREFIX = 'dm_student_certificates_';

export const certificateService = {
  /**
   * Fetches all certificates earned by the currently authenticated student.
   */
  async fetchMyCertificates(): Promise<{ data: Certificate[]; error: any }> {
    try {
      if (!isSupabaseConfigured()) {
        const local = localStorage.getItem(`${CERT_STORAGE_PREFIX}anon`);
        return { data: local ? JSON.parse(local) : [], error: null };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: [], error: authError || 'User is not authenticated' };
      }

      const storageKey = `${CERT_STORAGE_PREFIX}${user.id}`;

      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false });

      if (error) {
        console.warn('[CertificateService] Notice querying certificates:', error.message);
        const cached = localStorage.getItem(storageKey);
        return { data: cached ? JSON.parse(cached) : [], error };
      }

      const domainList = (data || []).map(mapDbRowToCertificate);
      localStorage.setItem(storageKey, JSON.stringify(domainList));

      return { data: domainList, error: null };
    } catch (err: any) {
      console.error('[CertificateService] Unexpected error fetching certificates:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Fetches a certificate for the current student and a specific course.
   */
  async fetchCertificateForCourse(courseId: string): Promise<{ data: Certificate | null; error: any }> {
    try {
      if (!courseId) return { data: null, error: 'Course ID is required' };

      if (!isSupabaseConfigured()) {
        const local = localStorage.getItem(`${CERT_STORAGE_PREFIX}anon`);
        const list: Certificate[] = local ? JSON.parse(local) : [];
        const match = list.find((c) => c.courseId === courseId) || null;
        return { data: match, error: null };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: null, error: authError || 'User is not authenticated' };
      }

      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (error) {
        console.error('[CertificateService] Error fetching course certificate:', error);
        return { data: null, error };
      }

      return { data: data ? mapDbRowToCertificate(data) : null, error: null };
    } catch (err: any) {
      console.error('[CertificateService] Error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Public verification endpoint: looks up a certificate by verification hash, certificate number, or ID.
   * Can be invoked by any visitor or employer without requiring authentication.
   */
  async fetchCertificateByCode(code: string): Promise<{ data: Certificate | null; error: any }> {
    if (!code || typeof code !== 'string') {
      return { data: null, error: 'Certificate verification code is required.' };
    }

    const cleanCode = code.trim();

    try {
      if (!isSupabaseConfigured()) {
        // Search local cache for demo/offline verification
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(CERT_STORAGE_PREFIX)) {
            const list: Certificate[] = JSON.parse(localStorage.getItem(key) || '[]');
            const found = list.find(
              (c) =>
                c.verificationHash.toLowerCase() === cleanCode.toLowerCase() ||
                c.certificateNumber.toLowerCase() === cleanCode.toLowerCase() ||
                c.id === cleanCode
            );
            if (found) return { data: found, error: null };
          }
        }
        return { data: null, error: 'Certificate not found.' };
      }

      // Query Supabase public certificates policy
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .or(`verification_hash.ilike.${cleanCode},certificate_number.ilike.${cleanCode},id.eq.${cleanCode}`)
        .maybeSingle();

      if (error) {
        console.error('[CertificateService] Error verifying certificate code:', error);
        return { data: null, error: error.message };
      }

      return { data: data ? mapDbRowToCertificate(data) : null, error: null };
    } catch (err: any) {
      console.error('[CertificateService] Unexpected error verifying certificate:', err);
      return { data: null, error: err?.message || 'Verification failed.' };
    }
  },

  /**
   * Issues a certificate of completion for the authenticated student.
   * Uses the secure issue_student_certificate RPC to enforce active enrollment
   * and 100% curriculum completion on the database layer.
   *
   * Idempotent: If a certificate already exists for this (user, course), returns the existing certificate.
   */
  async issueCertificate(params: {
    courseId: string;
    courseTitle?: string;
    recipientName?: string;
    metadata?: Record<string, any>;
  }): Promise<{ data: Certificate | null; isNew: boolean; error: any }> {
    const { courseId, courseTitle = 'Masterclass', recipientName, metadata } = params;

    if (!courseId) {
      return { data: null, isNew: false, error: 'Course information is required.' };
    }

    try {
      if (isSupabaseConfigured()) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return { data: null, isNew: false, error: authError || 'User is not authenticated' };
        }

        // Call the secure issue_student_certificate RPC (Phase 2I Hardening)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('issue_student_certificate', {
          p_course_id: courseId
        });

        if (rpcError) {
          console.error('[CertificateService] issue_student_certificate RPC error:', rpcError);
          return { data: null, isNew: false, error: rpcError.message || 'Failed to issue certificate.' };
        }

        if (!rpcResult || rpcResult.success === false) {
          const errMsg = rpcResult?.error || 'Course completion criteria not satisfied.';
          console.warn('[CertificateService] Certificate issuance declined by security policy:', errMsg);
          return { data: null, isNew: false, error: errMsg };
        }

        const domainCert = mapDbRowToCertificate(rpcResult.certificate);
        const isNew = Boolean(rpcResult.is_new);

        // Update local storage cache
        const storageKey = `${CERT_STORAGE_PREFIX}${user.id}`;
        const local = localStorage.getItem(storageKey);
        const list: Certificate[] = local ? JSON.parse(local) : [];
        const filtered = list.filter((c) => c.id !== domainCert.id && c.courseId !== domainCert.courseId);
        filtered.unshift(domainCert);
        localStorage.setItem(storageKey, JSON.stringify(filtered));

        return { data: domainCert, isNew, error: null };
      }

      // Offline / Local Development Fallback
      const userId = 'anon';
      const cleanRecipient = (recipientName || 'Valued Student').trim();
      const year = new Date().getFullYear();
      const randNum = Math.floor(10000 + Math.random() * 90000);
      const certificateNumber = `DM-${year}-${randNum}`;
      const randHashPart1 = Math.random().toString(36).substring(2, 7).toUpperCase();
      const randHashPart2 = Math.random().toString(36).substring(2, 7).toUpperCase();
      const verificationHash = `DMV-${randHashPart1}${randHashPart2}`;
      const nowIso = new Date().toISOString();

      const newCertData: Certificate = {
        id: crypto.randomUUID ? crypto.randomUUID() : `cert-${Date.now()}`,
        userId,
        courseId,
        certificateNumber,
        recipientName: cleanRecipient,
        courseTitle,
        issuedAt: nowIso,
        verificationHash,
        metadata: {
          instructorName: 'Digital Muid',
          completionDate: nowIso,
          ...metadata
        },
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const storageKey = `${CERT_STORAGE_PREFIX}${userId}`;
      const local = localStorage.getItem(storageKey);
      const list: Certificate[] = local ? JSON.parse(local) : [];
      const match = list.find((c) => c.courseId === courseId);
      if (match) {
        return { data: match, isNew: false, error: null };
      }

      list.unshift(newCertData);
      localStorage.setItem(storageKey, JSON.stringify(list));
      return { data: newCertData, isNew: true, error: null };
    } catch (err: any) {
      console.error('[CertificateService] Unexpected error issuing certificate:', err);
      return { data: null, isNew: false, error: err?.message || 'Issuance failed.' };
    }
  }
};
