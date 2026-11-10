const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = 'admin@shay-phones.local';
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!password) throw new Error('missing password');

  const { data: existing, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  const found = existing.users.find((user) => user.email === email);

  let userId = found?.id;
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'admin' },
      user_metadata: { full_name: 'מנהל מערכת' },
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: { role: 'admin' },
    });
    if (error) throw error;
  }

  const { error: profileError } = await supabase.from('users').upsert({
    id: userId,
    email,
    full_name: 'מנהל מערכת',
    role: 'admin',
    is_active: true,
  });
  if (profileError) throw profileError;
  console.log('admin-ready', email);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
