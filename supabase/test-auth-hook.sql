-- Test Script for Auth Hook Function
-- Run this AFTER creating the function to verify it works

-- 1. Check if the function exists
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'custom_access_token_hook';

-- Expected result: One row showing the function exists

-- 2. Test the function with a sample user
-- Replace 'YOUR_USER_ID_HERE' with an actual user ID from your users table
DO $$
DECLARE
  test_event jsonb;
  result_event jsonb;
  test_user_id uuid;
BEGIN
  -- Get a real user ID from the users table
  SELECT id INTO test_user_id FROM public.users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No users found in users table. Create a user first.';
    RETURN;
  END IF;

  -- Create a mock event (similar to what Supabase sends)
  test_event := jsonb_build_object(
    'user_id', test_user_id::text,
    'claims', jsonb_build_object(
      'sub', test_user_id::text,
      'email', 'test@example.com'
    )
  );

  RAISE NOTICE 'Testing with user_id: %', test_user_id;
  RAISE NOTICE 'Input event: %', test_event;

  -- Call the function
  result_event := public.custom_access_token_hook(test_event);

  RAISE NOTICE 'Output event: %', result_event;
  RAISE NOTICE 'user_role in claims: %', result_event->'claims'->'user_role';
  RAISE NOTICE 'user_active in claims: %', result_event->'claims'->'user_active';

  -- Verify the claims were added
  IF result_event->'claims'->'user_role' IS NOT NULL THEN
    RAISE NOTICE '✓ SUCCESS: user_role was added to claims';
  ELSE
    RAISE WARNING '✗ FAILED: user_role was NOT added to claims';
  END IF;

  IF result_event->'claims'->'user_active' IS NOT NULL THEN
    RAISE NOTICE '✓ SUCCESS: user_active was added to claims';
  ELSE
    RAISE WARNING '✗ FAILED: user_active was NOT added to claims';
  END IF;
END $$;

-- 3. Test with a non-existent user (should not crash)
DO $$
DECLARE
  test_event jsonb;
  result_event jsonb;
  fake_user_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Testing with non-existent user...';

  test_event := jsonb_build_object(
    'user_id', fake_user_id::text,
    'claims', jsonb_build_object(
      'sub', fake_user_id::text,
      'email', 'nonexistent@example.com'
    )
  );

  -- This should NOT crash
  result_event := public.custom_access_token_hook(test_event);

  IF result_event IS NOT NULL THEN
    RAISE NOTICE '✓ SUCCESS: Function handled non-existent user gracefully';
  ELSE
    RAISE WARNING '✗ FAILED: Function returned NULL';
  END IF;
END $$;

RAISE NOTICE '';
RAISE NOTICE '================================================';
RAISE NOTICE 'Test completed. Check the messages above.';
RAISE NOTICE '================================================';
