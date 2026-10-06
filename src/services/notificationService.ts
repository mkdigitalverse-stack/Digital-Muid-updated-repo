/**
 * Student Notifications Service (Phase 2F)
 * Provides persistent notification retrieval and read status synchronization
 * bound strictly to the authenticated student's session.
 *
 * RLS ensures auth.uid() = user_id for all operations.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserNotification } from '../types';

/**
 * Transforms a raw database record from public.notifications into a domain UserNotification object.
 */
export const mapDbRowToNotification = (row: any): UserNotification => ({
  id: row.id,
  userId: row.user_id,
  title: row.title || 'Notification',
  message: row.message || '',
  type: (['info', 'success', 'warning', 'alert', 'system'].includes(row.type)
    ? row.type
    : 'info') as UserNotification['type'],
  isRead: Boolean(row.is_read),
  link: row.link_url || row.link || null,
  linkUrl: row.link_url || row.link || null,
  createdAt: row.created_at || new Date().toISOString()
});

export const notificationService = {
  /**
   * Fetches up to 20 recent notifications for the authenticated student,
   * sorted from newest to oldest.
   */
  async getStudentNotifications(userId: string): Promise<UserNotification[]> {
    if (!userId) return [];
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[notificationService] Failed to fetch student notifications:', error.message);
        return [];
      }

      return (data || []).map(mapDbRowToNotification);
    } catch (err: any) {
      console.error('[notificationService] Unexpected error fetching student notifications:', err);
      return [];
    }
  },

  /**
   * Marks a single notification as read for the authenticated student.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    if (!notificationId || !userId) return;
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('[notificationService] Failed to mark notification as read:', error.message);
        throw error;
      }
    } catch (err: any) {
      console.error('[notificationService] Error marking notification as read:', err);
      throw err;
    }
  },

  /**
   * Marks all unread notifications as read for the authenticated student.
   */
  async markAllAsRead(userId: string): Promise<void> {
    if (!userId) return;
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('[notificationService] Failed to mark all notifications as read:', error.message);
        throw error;
      }
    } catch (err: any) {
      console.error('[notificationService] Error marking all notifications as read:', err);
      throw err;
    }
  }
};

// Export individual functions matching prompt requirements
export const getStudentNotifications = notificationService.getStudentNotifications;
export const markAsRead = notificationService.markAsRead;
export const markAllAsRead = notificationService.markAllAsRead;
