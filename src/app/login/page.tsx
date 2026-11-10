'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn } from 'lucide-react';

function dashboardFor(role: string | null | undefined) {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'ops':
    case 'marketing':
      return '/admin/inventory';
    case 'store':
      return '/store/dashboard';
    case 'lab':
      return '/lab/dashboard';
    default:
      return '/';
  }
}

function loginErrorMessage(error: { message?: string } | null) {
  const message = error?.message || '';
  if (/invalid login credentials/i.test(message)) {
    return 'האימייל או הסיסמה שגויים';
  }
  if (/email not confirmed/i.test(message)) {
    return 'החשבון עדיין לא אושר';
  }
  return 'שגיאה בהתחברות. נסו שוב.';
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get('email') || '').trim();
    const password = String(new FormData(form).get('password') || '');

    if (!email || !password) {
      setError('יש למלא אימייל וסיסמה');
      return;
    }
    if (!email.includes('@')) {
      setError('ההתחברות היא עם כתובת אימייל, לא עם שם משתמש');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(loginErrorMessage(authError));
        setIsLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setError('ההתחברות לא הושלמה');
        setIsLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        setError('החשבון נכנס, אבל לא נמצא תפקיד במערכת');
        setIsLoading(false);
        return;
      }

      if (!userData.is_active) {
        await supabase.auth.signOut();
        setError('החשבון אינו פעיל');
        setIsLoading(false);
        return;
      }

      window.location.assign(dashboardFor(userData.role));
    } catch {
      setError('שגיאה בהתחברות. נסו שוב.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="w-[90%] mx-auto mb-4 mt-2">
            <Image
              src="/logo.png"
              alt="לוגו אטלס"
              width={799}
              height={201}
              style={{
                width: '100%',
                height: '100%'
              }}
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            מערכת שירות ואחריות
          </CardTitle>
          <CardDescription className="text-center">
            התחברות למערכת
          </CardDescription>
        </CardHeader>
        <form method="post" action="/login" onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">כתובת אימייל</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="example@company.com"
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isLoading}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  מתחבר...
                </>
              ) : (
                <>
                  <LogIn className="ms-2 h-4 w-4" />
                  התחבר
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
