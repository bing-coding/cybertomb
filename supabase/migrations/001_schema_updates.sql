-- ============================================================
--  归处 / The Return  —  Schema Migration 001
--  Run this in your Supabase SQL editor BEFORE deploying.
--
--  IMPORTANT: In Supabase dashboard → Authentication → Settings,
--  disable "Enable email confirmations" so users can log in
--  immediately after registration with the internal UUID email.
-- ============================================================

-- 1. Make birth_date / death_date nullable on tombstones
ALTER TABLE public.tombstones
  ALTER COLUMN birth_date DROP NOT NULL;

ALTER TABLE public.tombstones
  ALTER COLUMN death_date DROP NOT NULL;

-- 2. Add shape_config JSONB column (stores free-form editor output)
ALTER TABLE public.tombstones
  ADD COLUMN IF NOT EXISTS shape_config JSONB DEFAULT NULL;

-- ============================================================
--  Profiles table  — maps user-facing username ↔ internal email
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            TEXT        NOT NULL,
  username_normalized TEXT        NOT NULL,
  internal_email      TEXT        NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT profiles_username_normalized_key UNIQUE (username_normalized),
  CONSTRAINT profiles_internal_email_key      UNIQUE (internal_email)
);

-- Row-level security: each user can only see / insert their own row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
--  RPC: get_internal_email(p_username)
--  Returns the internal auth email for a given username.
--  Called BEFORE the user is authenticated (login flow).
--  SECURITY DEFINER bypasses RLS so anon key can call it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_internal_email(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT internal_email INTO v_email
  FROM public.profiles
  WHERE username_normalized = lower(trim(p_username));
  RETURN v_email;  -- NULL when not found
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_internal_email TO anon;
GRANT EXECUTE ON FUNCTION public.get_internal_email TO authenticated;

-- ============================================================
--  RPC: check_username_available(p_username)
--  Returns TRUE when the username is not yet taken.
--  Called during registration (before auth user is created).
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE username_normalized = lower(trim(p_username))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available TO authenticated;
