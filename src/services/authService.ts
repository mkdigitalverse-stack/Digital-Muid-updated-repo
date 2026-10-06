import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '../lib/supabase';
import { profileService } from './profileService';
import { UserProfile } from '../types';

export interface AuthResult {
  success: boolean;
  user?: User | null;
  session?: Session | null;
  profile?: UserProfile | null;
  isAdmin?: boolean;
  error?: string;
}

const AUTHORIZED_ADMIN_EMAILS = [
  'mkdigitalverse@gmail.com',
  'admin@digitalmuid.com'
];

export const authService = {
  /**
   * Verifies whether a given Supabase user has verified administrative rights.
   * Priority 1: Supabase RPC `is_admin()` which executes PostgreSQL security definer logic.
   * Priority 2: Rigorous verification against authorized admin emails and verified claims.
   * A normal user will NEVER be granted administrative access.
   */
  async checkIsAdmin(user: User | null): Promise<boolean> {
    if (!user || !user.email) return false;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.rpc('is_admin');
        if (!error && typeof data === 'boolean') {
          return data;
        }
      } catch {
        // Fallback to strict claims verification if RPC is unavailable
      }
    }

    const email = user.email.trim().toLowerCase();
    const isEmailAdmin = AUTHORIZED_ADMIN_EMAILS.includes(email);
    const hasAdminAppRole = user.app_metadata?.role === 'admin';
    const hasAdminUserRole = user.user_metadata?.role === 'admin';

    return isEmailAdmin || hasAdminAppRole || hasAdminUserRole;
  },

  /**
   * Register a new student account using Supabase Auth.
   * Automatically creates the corresponding `profiles` row.
   */
  async registerStudent(
    email: string,
    password: string,
    fullName: string
  ): Promise<AuthResult> {
    try {
      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.isConfigured) {
        return {
          success: false,
          error: configStatus.error || 'Authentication service is not configured.'
        };
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();

      if (!cleanEmail || !password) {
        return { success: false, error: 'Please provide both email address and password.' };
      }

      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName
          }
        }
      });

      if (error) {
        let friendly = error.message;
        if (error.message.toLowerCase().includes('already registered')) {
          friendly = 'An account with this email address already exists. Please sign in instead.';
        }
        return { success: false, error: friendly };
      }

      if (data.user) {
        // Ensure profile row exists in public.profiles table
        const profileRes = await profileService.ensureProfile(data.user.id, {
          fullName: cleanName
        });

        const isAdmin = await this.checkIsAdmin(data.user);

        return {
          success: true,
          user: data.user,
          session: data.session,
          profile: profileRes.data,
          isAdmin
        };
      }

      return {
        success: false,
        error: 'Unable to complete registration. Please try again.'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'An unexpected registration error occurred.'
      };
    }
  },

  /**
   * Log in an existing user (student or administrator) using Supabase Auth.
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.isConfigured) {
        return {
          success: false,
          error: configStatus.error || 'Authentication service is not configured.'
        };
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        return { success: false, error: 'Please enter both your email address and password.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        let friendly = error.message;
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          friendly = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          friendly = 'Your email address has not been confirmed yet. Please check your inbox.';
        }
        return { success: false, error: friendly };
      }

      if (data.user && data.session) {
        // Ensure profile exists
        const profileRes = await profileService.ensureProfile(data.user.id, {
          fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name
        });

        const isAdmin = await this.checkIsAdmin(data.user);

        return {
          success: true,
          user: data.user,
          session: data.session,
          profile: profileRes.data,
          isAdmin
        };
      }

      return {
        success: false,
        error: 'Login failed. Please verify your credentials.'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'An unexpected error occurred during login.'
      };
    }
  },

  /**
   * Signs out the current user session from Supabase.
   */
  async logout(): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('[AuthService] Sign out error:', err);
      }
    }
  },

  /**
   * Requests a password reset link from Supabase.
   */
  async requestPasswordReset(email: string, redirectPath = '/login'): Promise<{ success: boolean; error?: string }> {
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, error: 'Database not configured' };
      }
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        return { success: false, error: 'Please enter your email address.' };
      }

      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}${redirectPath}` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send password reset request.' };
    }
  },

  /**
   * Updates the password for the current authenticated user.
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, error: 'Database not configured' };
      }

      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session) {
        return { success: false, error: 'Active authenticated session required. Please sign in again.' };
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update password.' };
    }
  }
};
