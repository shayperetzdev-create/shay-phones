-- Auth Hook Function: Add custom claims to JWT
-- This function adds user_role and user_active to the JWT token
-- to avoid database queries on every request

-- Create the function that will be called by the auth hook
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_active boolean;
BEGIN
  -- Initialize claims from event
  claims := event->'claims';

  -- Fetch role and active status from users table
  SELECT role::text, is_active
  INTO user_role, user_active
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  -- Only add claims if user was found and values exist
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  IF user_active IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_active}', to_jsonb(user_active));
  END IF;

  -- Update the 'claims' object in the event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, just return the event unchanged
    -- This ensures the auth flow doesn't break
    RAISE WARNING 'Error in custom_access_token_hook: %', SQLERRM;
    RETURN event;
END;
$$;

-- Grant execute permission to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke execute from authenticated and anon roles for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Note: After running this SQL, you need to configure the hook in Supabase Dashboard:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to Authentication > Hooks
-- 3. Create a new hook with:
--    - Hook Type: "Custom Access Token"
--    - Hook Method: "postgres_function"
--    - Function Name: "public.custom_access_token_hook"
-- 4. Enable the hook
