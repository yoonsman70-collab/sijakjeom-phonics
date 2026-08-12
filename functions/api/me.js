import { getUserFromRequest, jsonResponse } from '../_utils/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const user = await getUserFromRequest(request, db);

  if (!user) {
    return jsonResponse({ ok: false }, 401);
  }

  return jsonResponse({ ok: true, user });
}
