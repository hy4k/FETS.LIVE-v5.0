-- Database triggers to automatically create notifications
-- These triggers fire on specific events to notify users

-- ============================================================================
-- TRIGGER 1: Notify when someone comments on your post
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
  post_author_name TEXT;
  commenter_name TEXT;
  post_title TEXT;
BEGIN
  -- Get post author (from desktop_public_posts or wall_posts)
  SELECT author_id INTO post_author_id
  FROM desktop_public_posts
  WHERE id = NEW.post_id;

  -- If not found in desktop_public_posts, try wall_posts
  IF post_author_id IS NULL THEN
    SELECT user_id INTO post_author_id
    FROM wall_posts
    WHERE id = NEW.post_id;
  END IF;

  -- Don't notify if you comment on your own post
  IF post_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter name
  SELECT full_name INTO commenter_name
  FROM staff_profiles
  WHERE id = NEW.author_id;

  -- Get post author branch
  SELECT branch_assigned INTO post_title
  FROM staff_profiles
  WHERE id = post_author_id;

  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    priority,
    metadata,
    branch_location
  ) VALUES (
    post_author_id,
    'post_comment',
    'New Comment',
    commenter_name || ' commented on your post',
    'fets-connect',
    'medium',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'comment_id', NEW.id,
      'commenter_id', NEW.author_id
    ),
    post_title
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to desktop_post_comments table
DROP TRIGGER IF EXISTS trigger_notify_post_comment ON desktop_post_comments;
CREATE TRIGGER trigger_notify_post_comment
  AFTER INSERT ON desktop_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_comment();

-- ============================================================================
-- TRIGGER 2: Notify when someone likes your post
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
  liker_name TEXT;
  post_branch TEXT;
BEGIN
  -- Get post author
  SELECT author_id INTO post_author_id
  FROM desktop_public_posts
  WHERE id = NEW.post_id;

  -- If not found, try wall_posts
  IF post_author_id IS NULL THEN
    SELECT user_id INTO post_author_id
    FROM wall_posts
    WHERE id = NEW.post_id;
  END IF;

  -- Don't notify if you like your own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker name
  SELECT full_name INTO liker_name
  FROM staff_profiles
  WHERE id = NEW.user_id;

  -- Get branch
  SELECT branch_assigned INTO post_branch
  FROM staff_profiles
  WHERE id = post_author_id;

  -- Create notification (low priority - likes are not urgent)
  INSERT INTO notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    priority,
    metadata,
    branch_location
  ) VALUES (
    post_author_id,
    'post_like',
    'New Like',
    liker_name || ' liked your post',
    'fets-connect',
    'low',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'liker_id', NEW.user_id
    ),
    post_branch
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to desktop_post_likes table
DROP TRIGGER IF EXISTS trigger_notify_post_like ON desktop_post_likes;
CREATE TRIGGER trigger_notify_post_like
  AFTER INSERT ON desktop_post_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

-- Also attach to wall_likes if it exists
DROP TRIGGER IF EXISTS trigger_notify_wall_like ON wall_likes;
CREATE TRIGGER trigger_notify_wall_like
  AFTER INSERT ON wall_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

-- ============================================================================
-- TRIGGER 3: Notify when leave request is approved/rejected
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_leave_status()
RETURNS TRIGGER AS $$
DECLARE
  requester_name TEXT;
  approver_name TEXT;
  request_branch TEXT;
BEGIN
  -- Only notify on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only notify for approved or rejected
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Get names
  SELECT full_name INTO requester_name
  FROM staff_profiles
  WHERE id = NEW.user_id;

  SELECT full_name INTO approver_name
  FROM staff_profiles
  WHERE id = NEW.approved_by;

  -- Get branch
  SELECT branch_assigned INTO request_branch
  FROM staff_profiles
  WHERE id = NEW.user_id;

  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    priority,
    metadata,
    branch_location
  ) VALUES (
    NEW.user_id,
    CASE
      WHEN NEW.status = 'approved' THEN 'leave_approved'
      ELSE 'leave_rejected'
    END,
    CASE
      WHEN NEW.status = 'approved' THEN 'Leave Request Approved'
      ELSE 'Leave Request Rejected'
    END,
    'Your ' || NEW.request_type || ' request has been ' || NEW.status ||
    CASE WHEN approver_name IS NOT NULL THEN ' by ' || approver_name ELSE '' END,
    'fets-roster',
    'high',
    jsonb_build_object(
      'request_id', NEW.id,
      'request_type', NEW.request_type,
      'status', NEW.status,
      'approved_by', NEW.approved_by
    ),
    request_branch
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to leave_requests table
DROP TRIGGER IF EXISTS trigger_notify_leave_status ON leave_requests;
CREATE TRIGGER trigger_notify_leave_status
  AFTER UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_status();

-- ============================================================================
-- TRIGGER 4: Notify when roster shift is changed
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_shift_change()
RETURNS TRIGGER AS $$
DECLARE
  staff_name TEXT;
  staff_branch TEXT;
  old_shift TEXT;
  new_shift TEXT;
BEGIN
  -- Only notify on shift_code change
  IF OLD.shift_code = NEW.shift_code THEN
    RETURN NEW;
  END IF;

  -- Get staff info
  SELECT full_name, branch_assigned INTO staff_name, staff_branch
  FROM staff_profiles
  WHERE id = NEW.profile_id;

  old_shift := COALESCE(OLD.shift_code, 'None');
  new_shift := COALESCE(NEW.shift_code, 'None');

  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    priority,
    metadata,
    branch_location
  ) VALUES (
    NEW.profile_id,
    'shift_changed',
    'Shift Changed',
    'Your shift on ' || TO_CHAR(NEW.date, 'DD Mon YYYY') || ' changed from ' || old_shift || ' to ' || new_shift,
    'fets-roster',
    'high',
    jsonb_build_object(
      'schedule_id', NEW.id,
      'date', NEW.date,
      'old_shift', old_shift,
      'new_shift', new_shift
    ),
    staff_branch
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to roster_schedules table
DROP TRIGGER IF EXISTS trigger_notify_shift_change ON roster_schedules;
CREATE TRIGGER trigger_notify_shift_change
  AFTER UPDATE ON roster_schedules
  FOR EACH ROW
  EXECUTE FUNCTION notify_shift_change();

-- ============================================================================
-- TRIGGER 5: Notify when incident is assigned to you
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_incident_assignment()
RETURNS TRIGGER AS $$
DECLARE
  assignee_name TEXT;
  assignee_branch TEXT;
BEGIN
  -- Only notify when assigned_to changes
  IF OLD.assigned_to = NEW.assigned_to OR NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get assignee info
  SELECT full_name, branch_assigned INTO assignee_name, assignee_branch
  FROM staff_profiles
  WHERE id = NEW.assigned_to;

  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    priority,
    metadata,
    branch_location
  ) VALUES (
    NEW.assigned_to,
    'incident_assigned',
    'Incident Assigned',
    'Incident #' || NEW.id || ' (' || NEW.severity || ') has been assigned to you',
    'incident-manager',
    CASE
      WHEN NEW.severity IN ('critical', 'high') THEN 'high'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'incident_id', NEW.id,
      'severity', NEW.severity,
      'title', NEW.title
    ),
    assignee_branch
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to incidents table
DROP TRIGGER IF EXISTS trigger_notify_incident_assignment ON incidents;
CREATE TRIGGER trigger_notify_incident_assignment
  AFTER UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION notify_incident_assignment();

-- ============================================================================
-- TRIGGER 6: Notify when incident is resolved (notify reporter)
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_incident_resolved()
RETURNS TRIGGER AS $$
DECLARE
  reporter_branch TEXT;
BEGIN
  -- Only notify when status changes to resolved
  IF OLD.status = NEW.status OR NEW.status != 'resolved' THEN
    RETURN NEW;
  END IF;

  -- Get reporter branch
  SELECT branch_assigned INTO reporter_branch
  FROM staff_profiles
  WHERE id = NEW.reported_by;

  -- Create notification for the person who reported it
  INSERT INTO notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    priority,
    metadata,
    branch_location
  ) VALUES (
    NEW.reported_by,
    'incident_resolved',
    'Incident Resolved',
    'Incident #' || NEW.id || ' that you reported has been resolved',
    'incident-manager',
    'medium',
    jsonb_build_object(
      'incident_id', NEW.id,
      'title', NEW.title
    ),
    reporter_branch
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to incidents table
DROP TRIGGER IF EXISTS trigger_notify_incident_resolved ON incidents;
CREATE TRIGGER trigger_notify_incident_resolved
  AFTER UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION notify_incident_resolved();

-- ============================================================================
-- Add comments for documentation
-- ============================================================================

COMMENT ON FUNCTION notify_post_comment IS 'Creates notification when someone comments on a post';
COMMENT ON FUNCTION notify_post_like IS 'Creates notification when someone likes a post';
COMMENT ON FUNCTION notify_leave_status IS 'Creates notification when leave request is approved/rejected';
COMMENT ON FUNCTION notify_shift_change IS 'Creates notification when roster shift is changed';
COMMENT ON FUNCTION notify_incident_assignment IS 'Creates notification when incident is assigned to user';
COMMENT ON FUNCTION notify_incident_resolved IS 'Creates notification when reported incident is resolved';

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Notification triggers created successfully!';
  RAISE NOTICE 'The following triggers are now active:';
  RAISE NOTICE '  - Post comments (desktop_post_comments)';
  RAISE NOTICE '  - Post likes (desktop_post_likes, wall_likes)';
  RAISE NOTICE '  - Leave requests (leave_requests)';
  RAISE NOTICE '  - Shift changes (roster_schedules)';
  RAISE NOTICE '  - Incident assignments (incidents)';
  RAISE NOTICE '  - Incident resolutions (incidents)';
END $$;
