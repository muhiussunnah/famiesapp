import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// No-op stand-in used when the Supabase env vars are missing (fresh clone,
// design preview), so importing this module never crashes a page. Every
// query resolves to { data: null, error } instead of throwing.
function createStub() {
  const result = Promise.resolve({ data: null, error: { message: 'Supabase is not configured' } });
  const chain = new Proxy(function () {}, {
    get: (_target, prop) => (prop === 'then' ? result.then.bind(result) : chain),
    apply: () => chain,
  });
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: () => result,
      resetPasswordForEmail: () => result,
      updateUser: () => result,
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => chain,
    rpc: () => result,
    storage: { from: () => chain },
  };
}

// createBrowserClient handles cookies + session automatically.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : createStub();
