-- Create notifications table for user-specific notifications
-- This table stores all notifications for users in the FETS.LIVE platform

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- Type of notification (see enum below)
  title TEXT NOT NULL, -- Short notification title
  message TEXT NOT NULL, -- Notification message body
  link TEXT, -- Navigation target (e.g., 'incident-manager', 'fets-roster')
  priority TEXT NOT NULL DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  is_read BOOLEAN DEFAULT FALSE, -- Read status
  read_at TIMESTAMP WITH TIME ZONE, -- When notification was read
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- When notification was created
  metadata JSONB, -- Flexible data storage for notification-specific data
  branch_location TEXT, -- Branch context (calicut, cochin, global)

  -- Constraints
  CONSTRAINT valid_priority CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT valid_type CHECK (type IN (
    'critical_incident',
    'incident_assigned',
    'incident_resolved',
    'post_comment',
    'post_like',
    'post_mention',
    'leave_approved',
    'leave_rejected',
    'shift_changed',
    'shift_swap_request',
    'task_assigned',
    'task_deadline',
    'checklist_incomplete',
    'exam_today',
    'candidate_new',
    'system_news'
  ))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_branch
  ON notifications(branch_location, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_priority
  ON notifications(priority, created_at DESC)
  WHERE is_read = FALSE;

-- Enable RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY notifications_select_own
  ON notifications FOR SELECT
  USING (recipient_id IN (
    SELECT id FROM staff_profiles WHERE user_id = auth.uid()
  ));

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_own
  ON notifications FOR UPDATE
  USING (recipient_id IN (
    SELECT id FROM staff_profiles WHERE user_id = auth.uid()
  ));

-- Policy: Users can delete their own notifications
CREATE POLICY notifications_delete_own
  ON notifications FOR DELETE
  USING (recipient_id IN (
    SELECT id FROM staff_profiles WHERE user_id = auth.uid()
  ));

-- Policy: System/Service role can insert notifications for anyone
CREATE POLICY notifications_insert_system
  ON notifications FOR INSERT
  WITH CHECK (true); -- Service role bypasses this anyway

-- Add helpful comments
COMMENT ON TABLE notifications IS 'User-specific notifications for FETS.LIVE platform';
COMMENT ON COLUMN notifications.recipient_id IS 'User who receives this notification (staff_profiles.id)';
COMMENT ON COLUMN notifications.type IS 'Type of notification - determines icon and behavior';
COMMENT ON COLUMN notifications.priority IS 'Priority level - affects display order and visibility';
COMMENT ON COLUMN notifications.metadata IS 'JSON object with notification-specific data (e.g., post_id, incident_id)';
COMMENT ON COLUMN notifications.link IS 'Navigation target when notification is clicked';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

-- Create function to auto-cleanup old read notifications (optional - run monthly)
CREATE OR REPLACE FUNCTION cleanup_old_read_notifications()
RETURNS void AS $$
BEGIN
  -- Delete read notifications older than 90 days
  DELETE FROM notifications
  WHERE is_read = TRUE
    AND read_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_read_notifications IS 'Cleanup read notifications older than 90 days (run via cron)';
