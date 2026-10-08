import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/**
 * Keeps the admin's Supabase session cookie fresh. Only runs on the
 * routes that need a session (admin panel, admin API, login), so public
 * pages are never slowed down by an auth round-trip.
 */
export async function middleware(request) {
  let response = NextResponse.next({ request })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session so the admin stays signed in.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/login', '/auth/:path*'],
}
