// 비밀번호를 그대로 저장하지 않고, 안전하게 암호화(해시)해서 저장하기 위한 도구입니다.
// PBKDF2라는 방식을 사용합니다 (은행/로그인 시스템에서 널리 쓰이는 표준 방식).

function bufferToHex(buf) {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function deriveHash(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufferToHex(new Uint8Array(bits));
}

// 새 비밀번호를 저장 가능한 형태(솔트:해시)로 변환
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await deriveHash(password, salt);
  return `${bufferToHex(salt)}:${hashHex}`;
}

// 입력한 비밀번호가 저장된 해시와 일치하는지 확인
export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = hexToBuffer(saltHex);
  const computedHex = await deriveHash(password, salt);
  return timingSafeEqual(computedHex, hashHex);
}

// 로그인 세션용 랜덤 토큰 생성
export function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufferToHex(bytes);
}
