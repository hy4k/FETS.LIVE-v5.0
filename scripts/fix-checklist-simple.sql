-- Simplified Migration for checklist_template_items table
-- Run this in Supabase SQL Editor

-- Add question_type column if it doesn't exist
ALTER TABLE checklist_template_items
ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'checkbox';

-- Add dropdown_options column if it doesn't exist
ALTER TABLE checklist_template_items
ADD COLUMN IF NOT EXISTS dropdown_options TEXT[];

-- Migrate data from answer_type to question_type (if answer_type exists)
UPDATE checklist_template_items
SET question_type = answer_type
WHERE question_type = 'checkbox'
AND answer_type IS NOT NULL;

-- Add check constraint for valid question types
ALTER TABLE checklist_template_items
DROP CONSTRAINT IF EXISTS valid_question_type;

ALTER TABLE checklist_template_items
ADD CONSTRAINT valid_question_type
CHECK (question_type IN ('checkbox', 'text', 'number', 'dropdown', 'date', 'time', 'textarea', 'radio'));

-- Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'checklist_template_items'
AND column_name IN ('question_type', 'dropdown_options')
ORDER BY column_name;
