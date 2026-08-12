import { generateToken } from './crypto.js';

export const SESSION_COOKIE = 'bibby_session';
const SESSION_DAYS = 30;

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const cookies = {};
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

export async function createSession(db, userId) {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
    .bind(userId, token, expires).run();
  return { token, expires };
}

export function sessionCookieHeader(token, expiresIso) {
  const expires = new Date(expiresIso).toUTCString();
  return `${SESSION_COOKIE}=${token}; Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`;
}

// 요청에 담긴 쿠키를 보고, 현재 로그인된 사용자가 누구인지 알아냅니다.
export async function getUserFromRequest(request, db) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = await db.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  const user = await db.prepare(
    'SELECT id, username, display_name, class_name, role, is_locked FROM users WHERE id = ?'
  ).bind(session.user_id).first();

  return user || null;
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}
