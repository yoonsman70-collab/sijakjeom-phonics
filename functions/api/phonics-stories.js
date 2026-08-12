import { jsonResponse, getUserFromRequest } from '../_utils/auth.js';

// 예: /api/phonics-stories?level=1
// 특정 레벨의 스토리 목록(제목만)을 순서대로 반환합니다.
export async function onRequestGet(context) {
  const { request, env } = context;
  const mainDb = env.DB;
  const phonicsDb = env.PHONICS_DB;

  const user = await getUserFromRequest(request, mainDb);
  if (!user) {
    return jsonResponse({ ok: false, error: '로그인이 필요해요.' }, 401);
  }

  const url = new URL(request.url);
  const level = parseInt(url.searchParams.get('level') || '1', 10);

  const { results: stories } = await phonicsDb.prepare(
    'SELECT id, level, story_order, title_en, title_kr FROM phonics_stories WHERE level = ? ORDER BY story_order ASC'
  ).bind(level).all();

  return jsonResponse({ ok: true, level, stories });
}
