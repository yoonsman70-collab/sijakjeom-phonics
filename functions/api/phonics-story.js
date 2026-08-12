import { jsonResponse, getUserFromRequest } from '../_utils/auth.js';

// 예: /api/phonics-story?id=3
// 특정 스토리의 제목 정보와 모든 페이지(영어/한글 문장, 이미지)를 반환합니다.
export async function onRequestGet(context) {
  const { request, env } = context;
  const mainDb = env.DB;
  const phonicsDb = env.PHONICS_DB;

  const user = await getUserFromRequest(request, mainDb);
  if (!user) {
    return jsonResponse({ ok: false, error: '로그인이 필요해요.' }, 401);
  }

  const url = new URL(request.url);
  const storyId = parseInt(url.searchParams.get('id') || '0', 10);

  if (!storyId) {
    return jsonResponse({ ok: false, error: 'id가 필요해요.' }, 400);
  }

  const story = await phonicsDb.prepare(
    'SELECT id, level, story_order, title_en, title_kr FROM phonics_stories WHERE id = ?'
  ).bind(storyId).first();

  if (!story) {
    return jsonResponse({ ok: false, error: '존재하지 않는 스토리예요.' }, 404);
  }

  const { results: pages } = await phonicsDb.prepare(
    'SELECT id, page_number, sentence_en, sentence_kr, image_path FROM phonics_story_pages WHERE story_id = ? ORDER BY page_number ASC'
  ).bind(storyId).all();

  return jsonResponse({ ok: true, story, pages });
}
