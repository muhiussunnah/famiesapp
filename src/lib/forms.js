/**
 * Browser helper for the public forms. Posts to /api/forms/<form> and
 * resolves to { error } (null on success), like the old database insert.
 */
export async function submitForm(form, data) {
  try {
    const res = await fetch(`/api/forms/${form}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) return { error: null };
    const json = await res.json().catch(() => ({}));
    return { error: { message: json.error || `Request failed (${res.status})` } };
  } catch (err) {
    return { error: { message: err?.message || 'Network error' } };
  }
}
