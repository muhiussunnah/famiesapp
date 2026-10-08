/**
 * Shared Bearer-token check for the /api/writerfy/* endpoints.
 *
 * Constant-time compare so response timing leaks nothing about the token.
 * Returns false when WRITERFY_API_TOKEN is unset — the feature is off.
 */
export function checkWriterfyAuth(req) {
  const token = process.env.WRITERFY_API_TOKEN;
  if (!token) return false;

  const header = req.headers.get('authorization') || '';
  const supplied = header.replace(/^Bearer\s+/i, '').trim();
  if (supplied.length !== token.length) return false;

  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= supplied.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}
