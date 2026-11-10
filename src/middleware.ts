export const runtime = 'nodejs';

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, validateSupabaseEnv } from '@/lib/env-validation';

export async function middleware(request: NextRequest) {
  // Check if environment variables are set using centralized validation
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase environment variables not configured properly');
    console.warn('Please update .env.local with your Supabase credentials');

    // Redirect to login when Supabase is not configured
    if (request.nextUrl.pathname === '/' ||
        request.nextUrl.pathname.startsWith('/admin') ||
        request.nextUrl.pathname.startsWith('/store') ||
        request.nextUrl.pathname.startsWith('/lab') ||
        request.nextUrl.pathname.startsWith('/register')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // Get validated environment variables (uses cache after first validation)
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = validateSupabaseEnv();

  // Initialize response
  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // אופטימיזציה: נסה לקרוא role ו-is_active מה-JWT claims תחילה
    // זה חוסך קריאת DB בכל request! (80-90% הפחתה בעומס)
    let userData = null;
    if (user) {
      try {
        // Get session to access JWT token
        // Note: We use getUser() first for security validation, then getSession() for JWT claims
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          // Decode JWT payload to read custom claims added by Auth Hook
          const tokenParts = session.access_token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(
              Buffer.from(tokenParts[1], 'base64').toString()
            );

            // Custom claims are at root level of JWT payload
            if (payload.user_role !== undefined && payload.user_active !== undefined) {
              userData = {
                role: payload.user_role,
                is_active: payload.user_active
              };
            }
          }
        }
      } catch (error) {
        // JWT decoding failed, will fall back to DB
        if (process.env.NODE_ENV === 'development') {
          console.error('Error decoding JWT:', error);
        }
      }

      // Fallback: אם לא הצלחנו לקרוא מה-JWT, שאל את מסד הנתונים
      if (!userData) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ JWT claims not found, falling back to database query.');
        }
        const { data: dbData } = await supabase
          .from('users')
          .select('role, is_active')
          .eq('id', user.id)
          .single();
        userData = dbData;
      }
    }

    const isAuthPage = request.nextUrl.pathname.startsWith('/login');
    const isRegisterPage = request.nextUrl.pathname.startsWith('/register');
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/admin') ||
                             request.nextUrl.pathname.startsWith('/store') ||
                             request.nextUrl.pathname.startsWith('/lab');
    const staffRoles = ['admin', 'ops', 'marketing'];
    const dashboardFor = (role: string) => {
      switch (role) {
        case 'admin': return '/admin/dashboard';
        case 'ops':
        case 'marketing': return '/admin/inventory';
        case 'store': return '/store/dashboard';
        case 'lab': return '/lab/dashboard';
        default: return '/login';
      }
    };

    // 1. Handle root path ('/') redirection
    if (request.nextUrl.pathname === '/') {
      if (user && userData?.is_active) {
        const url = request.nextUrl.clone();
        url.pathname = dashboardFor(userData.role);
        return NextResponse.redirect(url);
      }
      // If no user or not active, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 2. Block public registration
    if (isRegisterPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 3. Redirect unauthenticated users from protected routes
    if (!user && isProtectedRoute && !request.nextUrl.pathname.startsWith('/api')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // 4. Handle authenticated users trying to access auth pages
    if (user && isAuthPage) {
      if (userData?.is_active) {
        const url = request.nextUrl.clone();
        url.pathname = dashboardFor(userData.role);
        return NextResponse.redirect(url);
      } else {
        // If user is not active, log them out
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'inactive');
        return NextResponse.redirect(url);
      }
    }

    // 5. Role-based access control for protected routes
    if (user && isProtectedRoute && !request.nextUrl.pathname.startsWith('/api')) {
      if (!userData || !userData.is_active) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(url);
      }

      const pathname = request.nextUrl.pathname;
      const userRole = userData.role;

      const isAdminOnlyRoute = [
        '/admin/users',
        '/admin/payments',
        '/admin/settings',
      ].some(route => pathname.startsWith(route));

      if (isAdminOnlyRoute && userRole !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = dashboardFor(userRole);
        return NextResponse.redirect(url);
      }

      if (
        (pathname.startsWith('/admin') && !staffRoles.includes(userRole)) ||
        (pathname.startsWith('/store') && userRole !== 'store') ||
        (pathname.startsWith('/lab') && userRole !== 'lab')
      ) {
        const url = request.nextUrl.clone();
        url.pathname = dashboardFor(userRole);
        return NextResponse.redirect(url);
      }
    }

  } catch (error) {
    console.error('Middleware error:', error);
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - .well-known (for various services)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|.well-known).*)',
  ],
};