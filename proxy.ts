import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // Public routes — no auth required
  if (
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/audit-form') ||
    pathname.startsWith('/api/audit-form')
  ) {
    return
  }
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
