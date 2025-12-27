/**
 * Next.js Proxy - Route Protection
 *
 * Handles authentication-based redirects:
 * - Protected routes redirect to /login if not authenticated
 * - Auth routes redirect to /dashboard if already authenticated
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/forge',
  '/projects',
  '/settings',
];

// Routes only for unauthenticated users
const authRoutes = ['/login'];

// Public routes (no auth check needed)
const publicRoutes = ['/', '/privacy', '/docs'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for BetterAuth session cookie
  // BetterAuth uses this cookie name by default
  const sessionCookie = request.cookies.get('better-auth.session_token');
  const isAuthenticated = !!sessionCookie;

  // Check if current path matches protected routes
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if current path matches auth routes
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Store the intended destination for post-login redirect
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && isAuthenticated) {
    // Check if there's a redirect param
    const redirectTo = request.nextUrl.searchParams.get('redirect');
    const destination = redirectTo || '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Allow request to proceed
  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and API routes
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - api routes (handled by backend)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
