import { verifyPassword } from '../_utils/crypto.js';
import { createSession, sessionCookieHeader, jsonResponse } from '../_utils/auth.js';

const MAX_FAILED_ATTEMPTS = 5;

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: '잘못된 요청이에요.' }, 400);
  }

  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!username || !password) {
    return jsonResponse({ ok: false, error: '아이디와 비밀번호를 입력해주세요.' }, 400);
  }

  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();

  if (!user) {
    return jsonResponse({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않아요.' }, 401);
  }

  if (user.is_locked) {
    return jsonResponse({ ok: false, error: '계정이 잠겼어요. 선생님(관리자)에게 문의해주세요.', locked: true }, 403);
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    const newFailCount = (user.failed_attempts || 0) + 1;
    const shouldLock = newFailCount >= MAX_FAILED_ATTEMPTS;

    await db.prepare(
      'UPDATE users SET failed_attempts = ?, is_locked = ?, locked_at = ? WHERE id = ?'
    ).bind(
      newFailCount,
      shouldLock ? 1 : 0,
      shouldLock ? new Date().toISOString() : null,
      user.id
    ).run();

    if (shouldLock) {
      return jsonResponse({
        ok: false,
        error: '비밀번호를 5번 틀려서 계정이 잠겼어요. 선생님에게 문의해주세요.',
        locked: true
      }, 403);
    }

    return jsonResponse({
      ok: false,
      error: `아이디 또는 비밀번호가 올바르지 않아요. (${newFailCount}/${MAX_FAILED_ATTEMPTS}회 실패)`
    }, 401);
  }

  // 로그인 성공: 실패 횟수 초기화 + 세션 발급
  await db.prepare('UPDATE users SET failed_attempts = 0, last_login_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), user.id).run();

  const { token, expires } = await createSession(db, user.id);

  return jsonResponse(
    {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        class_name: user.class_name
      }
    },
    200,
    { 'Set-Cookie': sessionCookieHeader(token, expires) }
  );
}
