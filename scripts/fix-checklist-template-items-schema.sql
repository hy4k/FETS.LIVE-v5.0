-- Migration to fix checklist_template_items table schema
-- This adds the missing columns that the frontend code expects
-- Run this in your Supabase SQL Editor

-- Step 1: Check if question_type column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'checklist_template_items' AND column_name = 'question_type'
    ) THEN
        ALTER TABLE checklist_template_items
        ADD COLUMN question_type TEXT DEFAULT 'checkbox';

        RAISE NOTICE 'Added question_type column';
    ELSE
        RAISE NOTICE 'question_type column already exists';
    END IF;
END $$;

-- Step 2: Check if dropdown_options column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'checklist_template_items' AND column_name = 'dropdown_options'
    ) THEN
        ALTER TABLE checklist_template_items
        ADD COLUMN dropdown_options TEXT[];

        RAISE NOTICE 'Added dropdown_options column';
    ELSE
        RAISE NOTICE 'dropdown_options column already exists';
    END IF;
END $$;

-- Step 3: Migrate data from old columns to new ones if they exist
DO $$
DECLARE
    rec RECORD;
    options_array TEXT[];
BEGIN
    -- Check if answer_type column exists (old column name)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'checklist_template_items' AND column_name = 'answer_type'
    ) THEN
        -- Copy data from answer_type to question_type
        UPDATE checklist_template_items
        SET question_type = answer_type
        WHERE question_type IS NULL AND answer_type IS NOT NULL;

        RAISE NOTICE 'Migrated data from answer_type to question_type';
    END IF;

    -- Check if options column exists (old column name)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'checklist_template_items' AND column_name = 'options'
    ) THEN
        -- Copy data from options to dropdown_options row by row
        FOR rec IN
            SELECT id, options
            FROM checklist_template_items
            WHERE dropdown_options IS NULL
            AND options IS NOT NULL
            AND jsonb_typeof(options) = 'array'
        LOOP
            -- Convert JSONB array to TEXT array
            SELECT ARRAY_AGG(value::text)
            INTO options_array
            FROM jsonb_array_elements_text(rec.options);

            -- Update the row
            UPDATE checklist_template_items
            SET dropdown_options = options_array
            WHERE id = rec.id;
        END LOOP;

        RAISE NOTICE 'Migrated data from options to dropdown_options';
    END IF;
END $$;

-- Step 4: Add check constraint to ensure valid question types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'checklist_template_items'
        AND constraint_name = 'valid_question_type'
    ) THEN
        ALTER TABLE checklist_template_items
        ADD CONSTRAINT valid_question_type
        CHECK (question_type IN ('checkbox', 'text', 'number', 'dropdown', 'date', 'time', 'textarea', 'radio'));

        RAISE NOTICE 'Added check constraint for valid question types';
    ELSE
        RAISE NOTICE 'Check constraint already exists';
    END IF;
END $$;

-- Step 5: Verify the schema changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'checklist_template_items'
AND column_name IN ('question_type', 'dropdown_options', 'answer_type', 'options')
ORDER BY column_name;

-- Display summary
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'The checklist_template_items table now has:';
    RAISE NOTICE '  - question_type: TEXT column for question types';
    RAISE NOTICE '  - dropdown_options: TEXT[] column for dropdown/radio options';
    RAISE NOTICE '  - Valid question types: checkbox, text, number, dropdown, date, time, textarea, radio';
END $$;
