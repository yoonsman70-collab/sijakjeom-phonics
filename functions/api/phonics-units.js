import { jsonResponse } from '../_utils/auth.js';
import { getUserFromRequest } from '../_utils/auth.js';

// 예: /api/phonics-units?level=1
// 특정 레벨(1~4)에 속한 유닛 목록을 순서대로 반환합니다.
export async function onRequestGet(context) {
  const { request, env } = context;
  const mainDb = env.DB;           // 로그인 확인용 (기존 bibby-english-db)
  const phonicsDb = env.PHONICS_DB; // 파닉스 콘텐츠용 (새 phonics-db)

  // 로그인한 사용자인지 먼저 확인합니다.
  const user = await getUserFromRequest(request, mainDb);
  if (!user) {
    return jsonResponse({ ok: false, error: '로그인이 필요해요.' }, 401);
  }

  const url = new URL(request.url);
  const level = parseInt(url.searchParams.get('level') || '1', 10);

  const { results: units } = await phonicsDb.prepare(
    'SELECT id, level, unit_number, pattern_label FROM phonics_units WHERE level = ? ORDER BY unit_number ASC'
  ).bind(level).all();

  return jsonResponse({ ok: true, level, units });
}
