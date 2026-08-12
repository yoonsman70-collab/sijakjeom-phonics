// ==============================
// 시작점 파닉스 - 메인 앱 로직
// ==============================

const LEVEL_INFO = {
  1: { name: 'Level 1 · 알파벳 소리', desc: '낱글자 소리 배우기', className: 'level-1', emoji: '🟤' },
  2: { name: 'Level 2 · 단모음', desc: 'CVC 짧은 모음 단어', className: 'level-2', emoji: '🟢' },
  3: { name: 'Level 3 · 장모음', desc: 'e로 만드는 긴 모음 단어', className: 'level-3', emoji: '🔵' },
  4: { name: 'Level 4 · 자음 블렌드', desc: '겹자음으로 시작하는 단어', className: 'level-4', emoji: '🟣' }
};

let currentUser = null;
let currentMode = null;       // 'word' | 'story'
let currentLevel = null;
let currentUnit = null;       // 선택된 유닛 객체
let unitWords = [];           // 현재 유닛의 단어 목록
let currentWordIndex = 0;

let reviewQueue = [];         // 복습에 쓸 단어 목록
let currentReviewIndex = 0;
let reviewResults = [];       // {word, pass}

let storyList = [];
let currentStory = null;
let storyPages = [];
let currentPageIndex = 0;

let navStack = [];            // 뒤로가기용 화면 기록
let currentStep = 0;

// ==============================
// 인앱 브라우저 감지 (기존 앱과 동일)
// ==============================
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|NAVER\(inapp\)|NAVERAPP|Line\/|FBAN|FBAV|Instagram|; wv\)/i.test(ua);
}
window.addEventListener('load', () => {
  if (isInAppBrowser()) {
    const banner = document.getElementById('inapp-banner');
    if (banner) banner.style.display = 'block';
  }
});

// ==============================
// 화면 전환 (뒤로가기 스택 포함)
// ==============================
function showStep(step, opts = {}) {
  document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  if (!opts.noPush && currentStep !== 0) {
    navStack.push(currentStep);
  }
  currentStep = step;

  const backBtn = document.getElementById('back-btn');
  const title = document.getElementById('header-title');
  const titles = {
    1: '시작점 AI 영어 파닉스', 2: currentMode === 'story' ? '스토리 - 레벨선택' : '단어학습 - 레벨선택',
    3: '유닛 선택', 4: '단어 학습', 5: '유닛 복습', 6: '복습 결과',
    7: '스토리 선택', 8: currentStory ? currentStory.title_kr : '스토리 읽기'
  };
  title.innerText = titles[step] || '시작점 파닉스';
  backBtn.classList.toggle('hidden', step === 0 || step === 1);

  document.getElementById('main-content').scrollTop = 0;
}

function goBack() {
  window.speechSynthesis.cancel();
  cleanupReviewMic();
  const prev = navStack.pop();
  if (prev === undefined) {
    showStep(1, { noPush: true });
  } else {
    showStep(prev, { noPush: true });
  }
}

function goHome() {
  window.speechSynthesis.cancel();
  cleanupReviewMic();
  navStack = [];
  document.body.className = 'level-1';
  showStep(1, { noPush: true });
}

// ==============================
// 로그인 / 로그아웃
// ==============================
async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errorEl.innerText = '';

  if (!username || !password) {
    errorEl.innerText = '아이디와 비밀번호를 입력해주세요!';
    return;
  }
  btn.disabled = true;
  btn.innerText = '확인 중...';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.ok) {
      currentUser = data.user;
      document.getElementById('login-password').value = '';
      const nameEl = document.getElementById('welcome-username');
      if (nameEl) nameEl.innerText = `${currentUser.display_name}님 · `;
      showStep(1, { noPush: true });
    } else {
      errorEl.innerText = data.error || '로그인에 실패했어요.';
    }
  } catch (e) {
    errorEl.innerText = '연결에 문제가 있어요. 잠시 후 다시 시도해주세요.';
  } finally {
    btn.disabled = false;
    btn.innerText = '로그인';
  }
}

async function checkExistingSession() {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        currentUser = data.user;
        const nameEl = document.getElementById('welcome-username');
        if (nameEl) nameEl.innerText = `${currentUser.display_name}님 · `;
        showStep(1, { noPush: true });
      }
    }
  } catch (e) { /* 로그인 화면 유지 */ }
}
window.addEventListener('DOMContentLoaded', checkExistingSession);

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (e) {}
  currentUser = null;
  navStack = [];
  document.body.className = 'level-1';
  showStep(0, { noPush: true });
}

// ==============================
// 레벨 선택 (단어학습/스토리 공용)
// ==============================
function goToWordLevelSelect() {
  currentMode = 'word';
  document.getElementById('level-select-title').innerText = '단어 학습 - 레벨 선택';
  document.getElementById('level-select-sub').innerText = '어떤 레벨을 공부할까?';
  renderLevelList();
  showStep(2);
}

function goToStoryLevelSelect() {
  currentMode = 'story';
  document.getElementById('level-select-title').innerText = '스토리 읽기 - 레벨 선택';
  document.getElementById('level-select-sub').innerText = '어떤 레벨의 스토리를 읽을까?';
  renderLevelList();
  showStep(2);
}

function renderLevelList() {
  const container = document.getElementById('level-list');
  container.innerHTML = '';
  [1, 2, 3, 4].forEach(lv => {
    const info = LEVEL_INFO[lv];
    const btn = document.createElement('button');
    btn.className = 'clay-card level-badge flex-col items-start transition-transform active:scale-95 text-left';
    btn.onclick = () => selectLevel(lv);
    btn.innerHTML = `
      <div class="flex items-center w-full">
        <span class="text-3xl mr-3">${info.emoji}</span>
        <div class="flex-1">
          <div class="text-2xl font-bold" style="font-family:'Nunito',sans-serif;">${info.name}</div>
          <div class="text-base opacity-70 mt-1">${info.desc}</div>
        </div>
      </div>`;
    container.appendChild(btn);
  });
}

function selectLevel(level) {
  currentLevel = level;
  document.body.className = LEVEL_INFO[level].className;
  if (currentMode === 'word') {
    loadUnitList(level);
  } else {
    loadStoryListForLevel(level);
  }
}

// ==============================
// 유닛 목록 (단어학습)
// ==============================
async function loadUnitList(level) {
  const container = document.getElementById('unit-list');
  container.innerHTML = `<div class="text-center py-10 opacity-60 font-bold">불러오는 중...</div>`;
  document.getElementById('unit-select-title').innerText = `${LEVEL_INFO[level].name} - 유닛 선택`;
  showStep(3);
  try {
    const res = await fetch(`/api/phonics-units?level=${level}`, { credentials: 'same-origin' });
    const data = await res.json();
    if (!data.ok) {
      container.innerHTML = `<div class="text-center py-10 opacity-60 font-bold">유닛을 불러오지 못했어요.</div>`;
      return;
    }
    renderUnitList(data.units);
  } catch (e) {
    container.innerHTML = `<div class="text-center py-10 opacity-60 font-bold">연결에 문제가 있어요.</div>`;
  }
}

function renderUnitList(units) {
  const container = document.getElementById('unit-list');
  container.innerHTML = '';
  if (units.length === 0) {
    container.innerHTML = `<div class="text-center py-10 opacity-60 font-bold">아직 등록된 유닛이 없어요.</div>`;
    return;
  }
  units.forEach(unit => {
    const btn = document.createElement('button');
    btn.className = 'w-full py-4 px-5 clay-card flex items-center justify-between transition-transform active:scale-95';
    btn.onclick = () => selectUnit(unit);
    btn.innerHTML = `
      <span class="text-xl font-bold">Unit ${unit.unit_number}</span>
      <span class="text-base opacity-70">${unit.pattern_label || ''}</span>`;
    container.appendChild(btn);
  });
}

async function selectUnit(unit) {
  currentUnit = unit;
  document.getElementById('unit-badge').innerText = `Unit ${unit.unit_number}`;
  try {
    const res = await fetch(`/api/phonics-words?unit_id=${unit.id}`, { credentials: 'same-origin' });
    const data = await res.json();
    if (!data.ok || !data.words || data.words.length === 0) {
      alert('이 유닛에는 아직 단어가 없어요.');
      return;
    }
    unitWords = data.words;
    currentWordIndex = 0;
    updateWordUI();
    showStep(4);
  } catch (e) {
    alert('단어를 불러오는 중 문제가 발생했어요.');
  }
}

// ==============================
// 단어 학습 화면 (듣기 전용, 마이크 없음)
// ==============================
function updateWordUI() {
  const word = unitWords[currentWordIndex];
  document.getElementById('word-eng').innerText = word.word;
  document.getElementById('word-kor').innerText = word.meaning_kr;
  document.getElementById('word-counter').innerText = `단어 ${currentWordIndex + 1} / ${unitWords.length}`;

  const img = document.getElementById('word-image');
  img.style.display = '';
  img.src = word.image_path || '';

  const nextBtn = document.getElementById('word-next-btn');
  if (currentWordIndex === unitWords.length - 1) {
    nextBtn.innerHTML = '복습하기 🎯';
  } else {
    nextBtn.innerHTML = '다음 ▶';
  }

  // ===== 이미지-소리 싱크 수정 =====
  // 예전에는 항상 300ms 뒤에 소리를 재생해서, 이미지 로딩이 늦어지면
  // "소리가 먼저 나고 그림이 나중에 뜨는" 어색한 상황이 생겼습니다.
  // 이제는 이미지가 실제로 화면에 그려진 직후에 소리를 재생하고,
  // 중복 재생을 막기 위해 한 번만 재생되도록 안전장치를 둡니다.
  playOnceWhenImageReady(img, () => playWordTTS());
}

// 이미지가 로드된 직후(또는 실패해도) 콜백을 딱 한 번만 실행합니다.
// onload가 여러 이유로 안 불릴 수 있어 최대 600ms 안전장치를 함께 둡니다.
function playOnceWhenImageReady(imgEl, callback) {
  let done = false;
  const run = () => { if (done) return; done = true; callback(); };
  imgEl.onload = run;
  imgEl.onerror = run;
  // 캐시된 이미지는 onload가 안 불릴 수 있어 즉시 완료 여부를 확인
  if (imgEl.complete && imgEl.naturalWidth > 0) run();
  setTimeout(run, 600);
}

function playWordTTS() {
  const word = unitWords[currentWordIndex];
  if (!word) return;
  const utterance = new SpeechSynthesisUtterance(word.word);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function nextWord() {
  if (currentWordIndex < unitWords.length - 1) {
    currentWordIndex++;
    updateWordUI();
  } else {
    startUnitReview();
  }
}

function prevWord() {
  if (currentWordIndex > 0) {
    currentWordIndex--;
    updateWordUI();
  }
}

// ==============================
// 유닛 복습 (마이크 발음 체크)
// ------------------------------
// 단어 학습과 달리 여기서만 마이크(SpeechRecognition)를 사용합니다.
// 최대 8개 단어를 무작위로 뽑아 "그림을 보고 영어 단어 말하기"를 진행합니다.
// ==============================
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognitionSupported = !!SpeechRecognitionAPI;
let reviewRecognition = null;
let reviewBusy = false;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startUnitReview() {
  const MAX_REVIEW = 8;
  reviewQueue = shuffleArray(unitWords).slice(0, Math.min(MAX_REVIEW, unitWords.length));
  currentReviewIndex = 0;
  reviewResults = [];

  if (!recognitionSupported) {
    alert('이 브라우저는 발음 체크를 지원하지 않아요. 다른 브라우저(Chrome/Safari)로 시도해주세요.');
    goHome();
    return;
  }

  showStep(5);
  loadReviewQuestion();
}

function loadReviewQuestion() {
  reviewBusy = false;
  const word = reviewQueue[currentReviewIndex];
  document.getElementById('review-counter').innerText = `문제 ${currentReviewIndex + 1} / ${reviewQueue.length}`;
  document.getElementById('review-kor').innerText = word.meaning_kr;
  const img = document.getElementById('review-image');
  img.style.display = '';
  img.src = word.image_path || '';
  updateReviewStatus('마이크를 누르고 그림의 영어 단어를 말해봐!', 'var(--accent-dark)');
  resetReviewMicUI();
  document.getElementById('review-override-btn').classList.add('hidden');
}

function updateReviewStatus(text, color) {
  const el = document.getElementById('review-mic-status');
  const instr = document.getElementById('review-instruction');
  el.innerText = text;
  el.style.color = color;
  instr.innerText = text;
}

function resetReviewMicUI() {
  document.getElementById('review-mic-icon').innerText = '🎤';
  const btn = document.getElementById('review-mic-btn');
  btn.classList.remove('clay-btn-blue');
  btn.classList.add('clay-btn');
}

function playReviewTTS() {
  const word = reviewQueue[currentReviewIndex];
  if (!word) return;
  const utterance = new SpeechSynthesisUtterance(word.word);
  utterance.lang = 'en-US';
  utterance.rate = 0.8;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function handleReviewMicTap() {
  if (reviewBusy) return;
  reviewBusy = true;
  const icon = document.getElementById('review-mic-icon');
  const pulse = document.getElementById('review-mic-pulse');
  icon.innerText = '🎙️';
  pulse.classList.add('animate-[pulse-ring_1.5s_cubic-bezier(0.215,0.61,0.355,1)_infinite]');
  pulse.style.opacity = '1';
  updateReviewStatus('듣고 있어요... 쫑긋!', '#D35400');

  try {
    reviewRecognition = new SpeechRecognitionAPI();
    reviewRecognition.lang = 'en-US';
    reviewRecognition.interimResults = false;
    // ===== 발음 인식 정확도 개선 (1) =====
    // 예전에는 인식 결과를 1개만 받아서, 브라우저가 살짝 다르게 들은 단어 하나로
    // 바로 "틀렸다"고 판정했습니다. 이제 최대 5개의 후보 단어를 받아서,
    // 그 중 하나라도 정답과 맞으면 통과시킵니다 (사람도 여러 후보 중 고르듯이).
    reviewRecognition.maxAlternatives = 5;

    reviewRecognition.onresult = (event) => {
      const alternatives = [];
      for (let i = 0; i < event.results[0].length; i++) {
        alternatives.push(event.results[0][i].transcript);
      }
      stopReviewPulse();
      checkReviewAnswer(alternatives);
    };
    reviewRecognition.onerror = (event) => {
      stopReviewPulse();
      reviewBusy = false;
      if (event.error === 'no-speech') {
        updateReviewStatus('목소리가 안 들렸어요! 다시 눌러서 크게 말해볼까요?', '#E74C3C');
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        updateReviewStatus('마이크 권한이 없어요. 브라우저 설정에서 허용해주세요!', '#E74C3C');
      } else {
        updateReviewStatus(`잘 못 들었어요. 다시 눌러주세요. (${event.error})`, '#E74C3C');
      }
    };
    reviewRecognition.onend = () => {
      setTimeout(() => { reviewBusy = false; }, 300);
    };
    reviewRecognition.start();
  } catch (e) {
    reviewBusy = false;
    stopReviewPulse();
    updateReviewStatus('음성 인식을 시작할 수 없어요. 다시 시도해주세요.', '#E74C3C');
  }
}

function stopReviewPulse() {
  const pulse = document.getElementById('review-mic-pulse');
  pulse.classList.remove('animate-[pulse-ring_1.5s_cubic-bezier(0.215,0.61,0.355,1)_infinite]');
  pulse.style.opacity = '0';
  document.getElementById('review-mic-icon').innerText = '🎤';
}

function cleanupReviewMic() {
  try { if (reviewRecognition) reviewRecognition.abort(); } catch (e) {}
  reviewBusy = false;
}

// ===== 발음 인식 정확도 개선 (2): 편집거리(Levenshtein Distance) =====
// 두 단어가 철자 1글자 정도만 다르면 "거의 같은 소리"로 인식된 것일 가능성이 높습니다.
// (예: 브라우저가 "big"을 "bik"로 살짝 다르게 인식하는 경우 등)
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isCloseMatch(heard, target) {
  if (!heard) return false;
  if (heard === target) return true;
  const heardWords = heard.split(/\s+/).filter(Boolean);
  if (heardWords.includes(target)) return true;
  // 3글자 이상 단어는 철자 1개 차이까지는 같은 단어로 인정
  if (target.length >= 3 && levenshtein(heard, target) <= 1) return true;
  return heardWords.some(w => target.length >= 3 && levenshtein(w, target) <= 1);
}

function checkReviewAnswer(transcripts) {
  const word = reviewQueue[currentReviewIndex];
  const clean = s => s.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  const target = clean(word.word);

  // 인식된 여러 후보(alternatives) 중 하나라도 정답에 가까우면 통과
  const isPass = transcripts.some(t => isCloseMatch(clean(t), target));
  const heardDisplay = transcripts[0] || '';

  if (isPass) {
    reviewResults.push({ word: word.word, meaning: word.meaning_kr, pass: true, heard: heardDisplay });
    updateReviewStatus('참 잘했어요! 정답이에요 🎉', '#27AE60');
    document.getElementById('review-override-btn').classList.add('hidden');
    setTimeout(() => advanceReview(), 1500);
  } else {
    // ===== 신뢰도 보완장치 =====
    // 자동 판정이 틀렸다고 나와도, 곧바로 "틀렸다"고 기록하지 않고
    // 학생이 다시 시도하거나, 정말 정확히 말했다고 생각하면 직접 확인하고
    // 넘어갈 수 있는 버튼을 보여줍니다. (음성인식이 100% 완벽하지 않기 때문)
    updateReviewStatus(`"${heardDisplay}"라고 들렸어요. 다시 눌러서 또박또박 말해볼까요?`, '#E74C3C');
    document.getElementById('review-override-btn').classList.remove('hidden');
  }
}

function advanceReview() {
  currentReviewIndex++;
  if (currentReviewIndex < reviewQueue.length) {
    loadReviewQuestion();
  } else {
    finishReview();
  }
}

// 학생이 "그래도 정확히 말했어요" 버튼을 눌렀을 때 - 정답으로 인정하고 다음 문제로.
function reviewOverridePass() {
  const word = reviewQueue[currentReviewIndex];
  reviewResults.push({ word: word.word, meaning: word.meaning_kr, pass: true, heard: '(직접 확인)' });
  document.getElementById('review-override-btn').classList.add('hidden');
  updateReviewStatus('좋아요! 다음 문제로 넘어갈게요.', '#27AE60');
  setTimeout(() => advanceReview(), 800);
}

function finishReview() {
  const passCount = reviewResults.filter(r => r.pass).length;
  document.getElementById('review-score').innerText = `${reviewResults.length}문제 중 ${passCount}개 맞았어요!`;

  const listEl = document.getElementById('review-result-list');
  listEl.innerHTML = '';
  reviewResults.forEach(r => {
    const item = document.createElement('div');
    item.className = 'clay-card p-3 mb-2 w-full flex justify-between items-center';
    const badge = r.pass
      ? `<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold">정답</span>`
      : `<span class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-md font-bold">다시 연습</span>`;
    item.innerHTML = `
      <div>
        <p class="font-extrabold">${r.word}</p>
        <p class="text-sm opacity-70">${r.meaning}</p>
      </div>
      ${badge}`;
    listEl.appendChild(item);
  });

  showStep(6, { noPush: true });
}

// ==============================
// 스토리 목록 (레벨별)
// ==============================
async function loadStoryListForLevel(level) {
  document.getElementById('unit-select-title').innerText = `${LEVEL_INFO[level].name} - 스토리`;
  const container = document.getElementById('story-list');
  container.innerHTML = `<div class="text-center py-10 opacity-60 font-bold">불러오는 중...</div>`;
  showStep(7);
  try {
    const res = await fetch(`/api/phonics-stories?level=${level}`, { credentials: 'same-origin' });
    const data = await res.json();
    if (!data.ok) {
      container.innerHTML = `<div class="text-center py-10 opacity-60 font-bold">스토리를 불러오지 못했어요.</div>`;
      return;
    }
    storyList = data.stories;
    renderStoryList();
  } catch (e) {
    container.innerHTML = `<div class="text-center py-10 opacity-60 font-bold">연결에 문제가 있어요.</div>`;
  }
}

function renderStoryList() {
  const container = document.getElementById('story-list');
  container.innerHTML = '';
  if (storyList.length === 0) {
    container.innerHTML = `<div class="text-center py-10 opacity-60 font-bold">아직 등록된 스토리가 없어요.</div>`;
    return;
  }
  storyList.forEach(story => {
    const btn = document.createElement('button');
    btn.className = 'w-full py-4 px-5 clay-card flex flex-col items-start transition-transform active:scale-95 text-left';
    btn.onclick = () => selectStory(story);
    btn.innerHTML = `
      <span class="text-lg font-bold">${story.title_en}</span>
      <span class="text-sm opacity-70 mt-1">${story.title_kr}</span>`;
    container.appendChild(btn);
  });
}

async function selectStory(story) {
  currentStory = story;
  try {
    const res = await fetch(`/api/phonics-story?id=${story.id}`, { credentials: 'same-origin' });
    const data = await res.json();
    if (!data.ok || !data.pages || data.pages.length === 0) {
      alert('이 스토리에는 아직 내용이 없어요.');
      return;
    }
    storyPages = data.pages;
    currentPageIndex = 0;
    updateStoryUI();
    showStep(8);
  } catch (e) {
    alert('스토리를 불러오는 중 문제가 발생했어요.');
  }
}

function updateStoryUI() {
  const page = storyPages[currentPageIndex];
  document.getElementById('story-eng').innerText = page.sentence_en;
  document.getElementById('story-kor').innerText = page.sentence_kr;
  document.getElementById('story-page-counter').innerText = `${currentPageIndex + 1} / ${storyPages.length}`;

  const img = document.getElementById('story-image');
  img.style.display = '';
  img.src = page.image_path || '';

  const nextBtn = document.getElementById('story-next-btn');
  nextBtn.innerHTML = currentPageIndex === storyPages.length - 1 ? '완료 🎉' : '다음 ▶';

  // 단어 학습 화면과 동일하게, 이미지가 실제로 뜬 직후 소리를 재생합니다.
  playOnceWhenImageReady(img, () => playStoryTTS());
}

function playStoryTTS() {
  const page = storyPages[currentPageIndex];
  if (!page) return;
  const utterance = new SpeechSynthesisUtterance(page.sentence_en);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function nextStoryPage() {
  if (currentPageIndex < storyPages.length - 1) {
    currentPageIndex++;
    updateStoryUI();
  } else {
    window.speechSynthesis.cancel();
    goHome();
  }
}

function prevStoryPage() {
  if (currentPageIndex > 0) {
    currentPageIndex--;
    updateStoryUI();
  }
}
