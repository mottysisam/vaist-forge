/**
 * Root Page - Landing/Redirect
 *
 * Redirects users based on authentication state:
 * - Authenticated: Go to dashboard
 * - Not authenticated: Go to login
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('better-auth.session_token');

  if (sessionCookie) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
