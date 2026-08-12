import { parseCookies, SESSION_COOKIE, clearCookieHeader, jsonResponse } from '../_utils/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];

  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
}
