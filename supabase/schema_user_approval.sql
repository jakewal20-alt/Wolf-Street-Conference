-- User Approval System
-- Run this in Supabase SQL Editor

-- Add approval and admin columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Mark the FIRST user (earliest created_at) as admin + approved
UPDATE profiles
SET is_approved = true, is_admin = true
WHERE created_at = (SELECT MIN(created_at) FROM profiles);

-- Also approve any existing users (if you want all current users approved)
-- Comment this out if you only want the first user approved:
-- UPDATE profiles SET is_approved = true;

-- Update the handle_new_user trigger: new signups start unapproved
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;

  IF user_count = 0 THEN
    -- First user becomes admin and is auto-approved
    INSERT INTO profiles (id, email, full_name, is_admin, is_approved)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      true,
      true
    );
  ELSE
    -- All other users start unapproved
    INSERT INTO profiles (id, email, full_name, is_admin, is_approved)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      false,
      false
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow admins to view and update all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
