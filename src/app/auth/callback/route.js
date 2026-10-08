import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Supabase email links (password reset, invite) land here; only
  // same-site relative paths are allowed as the destination.
  const nextParam = searchParams.get('next') ?? '/admin';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/admin';

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // সফল হলে হোমপেজে রিডাইরেক্ট (অথবা next প্যারামিটারে)
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // যদি কোনো এরর হয়, লগিন পেজে পাঠাবে
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}