import { jsonResponse, getUserFromRequest } from '../_utils/auth.js';

// 예: /api/phonics-words?unit_id=5
// 특정 유닛에 속한 단어 목록(단어, 뜻, 이미지 경로)을 순서대로 반환합니다.
export async function onRequestGet(context) {
  const { request, env } = context;
  const mainDb = env.DB;
  const phonicsDb = env.PHONICS_DB;

  const user = await getUserFromRequest(request, mainDb);
  if (!user) {
    return jsonResponse({ ok: false, error: '로그인이 필요해요.' }, 401);
  }

  const url = new URL(request.url);
  const unitId = parseInt(url.searchParams.get('unit_id') || '0', 10);

  if (!unitId) {
    return jsonResponse({ ok: false, error: 'unit_id가 필요해요.' }, 400);
  }

  const unit = await phonicsDb.prepare(
    'SELECT id, level, unit_number, pattern_label FROM phonics_units WHERE id = ?'
  ).bind(unitId).first();

  if (!unit) {
    return jsonResponse({ ok: false, error: '존재하지 않는 유닛이에요.' }, 404);
  }

  const { results: words } = await phonicsDb.prepare(
    'SELECT id, word, meaning_kr, image_path, display_order FROM phonics_words WHERE unit_id = ? ORDER BY display_order ASC'
  ).bind(unitId).all();

  return jsonResponse({ ok: true, unit, words });
}
