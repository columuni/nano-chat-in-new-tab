// =======================================
// 時計・日付
// =======================================
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}`;

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const d = now.getDate();
  const day = days[now.getDay()];
  document.getElementById('date').textContent = `${y}年${mo}月${d}日（${day}）`;
}
updateClock();
setInterval(updateClock, 10000);

// =======================================
// 状態管理
// =======================================
let aiSession = null;      // 会話用
let judgeSession = null;   // 検索判断用
let querySession = null;   // 検索クエリ生成用
let isReady = false;

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const sendBtn = document.getElementById('sendBtn');
const searchInput = document.getElementById('searchInput');
const conversation = document.getElementById('conversation');

function setStatus(state, text) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = text;
}

// =======================================
// Gemini Nano 初期化
// =======================================
async function initAI()
 {
  // Chrome 148以降のAPIチェック
  if (!('LanguageModel' in self)) {
    setStatus('error', 'Gemini Nano が利用できません（Chrome 148以降が必要です）');
    return;
  }

  try {
    const availability = await LanguageModel.availability();

    if (availability === 'unavailable') {
      setStatus('error', 'このデバイスでは Gemini Nano を使用できません');
      return;
    }

    if (availability === 'downloadable' || availability === 'downloading') {
      setStatus('loading', 'Gemini Nano のダウンロードが必要です');
      showDownloadPrompt();
    return;
}

    // セッション作成
    aiSession = await LanguageModel.create({
      systemPrompt: `あなたは親切で賢いAIアシスタントです。日本語で会話します。
    以下のルールに従ってください：
    - 会話の文脈を踏まえて自然に回答してください
    - Google検索結果が提供された場合はその内容を参考に回答してください
    - 箇条書きや段落を適切に使い、読みやすく整理してください
    - 情報源が不明確な場合はその旨を伝えてください
    - 余計な前置きは省いて、直接回答してください`,
    });

    isReady = true;
    setStatus('ready', 'Gemini Nano 準備完了');
    sendBtn.disabled = false;
    searchInput.focus();

    // 判断用セッションを別途作成
    judgeSession = await LanguageModel.create({
      systemPrompt: `You are a classifier. Answer only "yes" or "no".`,
    });
	
	querySession = await LanguageModel.create({
      systemPrompt: `
    あなたは検索クエリ最適化器です。

    ルール:
    - 出力は検索クエリのみ
    - 説明禁止
    - 引用符禁止
    - 会話しない
    - Google検索向けに簡潔化
    - 日本語を維持
    `,
});

  } catch (err) {
    setStatus('error', `初期化エラー: ${err.message}`);
    console.error(err);
  }
}

function showDownloadPrompt() {
  const bar = document.querySelector('.status-bar');
  const btn = document.createElement('button');
  btn.textContent = 'Gemini Nano を起動';
  btn.style.cssText = `
    margin-left: 12px;
    padding: 4px 12px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
  `;
  btn.addEventListener('click', async () => {
    btn.remove();
    setStatus('loading', '起動中...');
    try {
      aiSession = await LanguageModel.create({
        systemPrompt: `あなたは親切で賢いAIアシスタントです。日本語で会話します。
      以下のルールに従ってください：
      - 会話の文脈を踏まえて自然に回答してください
      - Google検索結果が提供された場合はその内容を参考に回答してください
      - 箇条書きや段落を適切に使い、読みやすく整理してください
      - 情報源が不明確な場合はその旨を伝えてください
      - 余計な前置きは省いて、直接回答してください`,
      });
      isReady = true;
      setStatus('ready', 'Gemini Nano 準備完了');
      sendBtn.disabled = false;
      searchInput.focus();
      judgeSession = await LanguageModel.create({
        systemPrompt: `You are a classifier. Answer only "yes" or "no".`,
      });

      querySession = await LanguageModel.create({
        systemPrompt: `
      あなたは検索クエリ最適化器です。

      ルール:
      - 出力は検索クエリのみ
      - 説明禁止
      - 引用符禁止
      - 会話禁止
      - Google検索向けに簡潔化
      - 日本語を維持
      `,
      });
    } catch (err) {
      setStatus('error', `初期化エラー: ${err.message}`);
    }
  });
  bar.appendChild(btn);
}

// =======================================
// テキストエリア自動リサイズ
// =======================================
searchInput.addEventListener('input', () => {
  searchInput.style.height = 'auto';
  searchInput.style.height = Math.min(searchInput.scrollHeight, 180) + 'px';
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSubmit();
  }
});

sendBtn.addEventListener('click', handleSubmit);

// =======================================
// Google検索の実行
// =======================================
async function fetchGoogleSearch(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ja&num=8`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      }
    });
    const html = await response.text();
    return parseGoogleResults(html, query);
  } catch (err) {
    console.error('検索エラー:', err);
    return { results: [], snippets: '' };
  }
}

// Google検索結果のHTMLをパース
function parseGoogleResults(html, query) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const results = [];
  const snippetTexts = [];

  // 検索結果ブロックを取得（複数のセレクタを試みる）
  const selectors = ['div.g', 'div[data-sokoban-container]', 'div.tF2Cxc'];

  let blocks = [];
  for (const sel of selectors) {
    blocks = doc.querySelectorAll(sel);
    if (blocks.length > 0) break;
  }

  // タイトルとスニペットを抽出
  let count = 0;
  blocks.forEach((block) => {
    if (count >= 6) return;

    // タイトル
    const titleEl = block.querySelector('h3');
    const title = titleEl ? titleEl.textContent.trim() : '';

    // URL
    const linkEl = block.querySelector('a[href^="http"]');
    const url = linkEl ? linkEl.href : '';

    // スニペット（検索結果の説明文）
    const snippetSelectors = ['div.VwiC3b', 'span.aCOpRe', 'div.s', 'div[data-snf]'];
    let snippet = '';
    for (const sEl of snippetSelectors) {
      const el = block.querySelector(sEl);
      if (el) {
        snippet = el.textContent.trim();
        break;
      }
    }

    if (title && url) {
      results.push({ title, url, snippet });
      if (snippet) snippetTexts.push(`[${count + 1}] ${title}\n${snippet}`);
      count++;
    }
  });

  // スニペットが取れなかった場合はbodyテキストから抜粋
  if (snippetTexts.length === 0) {
    const bodyText = doc.body?.innerText || '';
    // 不要な部分を除去して最初の2000文字
    const cleaned = bodyText.replace(/\n{3,}/g, '\n\n').slice(0, 2000);
    snippetTexts.push(cleaned);
  }

  return {
    results,
    snippets: snippetTexts.join('\n\n'),
    query,
  };
}

// =======================================
// 会話履歴
// =======================================
let chatHistory = [];

// =======================================
// Google検索が必要か判断
// =======================================
async function needsSearch(userInput) {
  if (!judgeSession) return false;

  try {
    const result = await judgeSession.prompt(
      `Does the following question require a Google search to answer accurately? Answer only "yes" or "no".

Requires search: latest news, current prices, weather, real-time info, recent events.
Does not require search: general knowledge, math, writing help, casual conversation.

Question: ${userInput}`
    );
    return result.trim().toLowerCase().startsWith('yes');
  } catch {
    return false;
  }
}

// =======================================
// クエリの最適化（専用セッション使用）
// =======================================
async function optimizeQuery(userInput) {
  if (!querySession) return userInput;

  try {
    const result = await querySession.prompt(
    `以下をGoogle検索向け検索語に変換してください。

    条件:
    - キーワードのみ
    - 説明禁止
    - 30文字以内

    入力:
    ${userInput}`
    );

    return result.trim() || userInput;

  } catch (err) {
    console.error('クエリ最適化失敗:', err);
    return userInput;
  }
}

// =======================================
// UI：メッセージ追加
// =======================================
function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  conversation.appendChild(div);
  return div;
}

function addAIMessage() {
  const div = document.createElement('div');
  div.className = 'message ai';
  div.innerHTML = `
    <div class="ai-header">
      <span class="ai-label">Gemini Nano</span>
      <div class="ai-divider"></div>
    </div>
    <div class="ai-body"></div>
  `;
  conversation.appendChild(div);
  return div.querySelector('.ai-body');
}

function addSearchingIndicator(body, text) {
  const div = document.createElement('div');
  div.className = 'searching-indicator';
  div.innerHTML = `
    <div class="searching-dots">
      <span></span><span></span><span></span>
    </div>
    <span>${text}</span>
  `;
  body.appendChild(div);
  return div;
}

function addSearchResults(body, results) {
  if (!results || results.length === 0) return;

  const div = document.createElement('div');
  div.className = 'search-results';
  div.innerHTML = `<div class="search-results-label">検索結果</div>`;

  results.slice(0, 5).forEach((r, i) => {
    const item = document.createElement('a');
    item.className = 'result-item';
    item.href = r.url;
    item.target = '_blank';
    item.rel = 'noopener';
    const domain = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
    item.innerHTML = `
      <span class="result-num">${i + 1}</span>
      <div class="result-content">
        <div class="result-title">${escapeHtml(r.title)}</div>
        <div class="result-url">${escapeHtml(domain)}</div>
      </div>
    `;
    div.appendChild(item);
  });

  body.appendChild(div);
}

function addGoogleLink(body, query) {
  const a = document.createElement('a');
  a.className = 'google-link';
  a.href = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ja`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 13v10h-6v-6h-6v6h-6v-10h-3l12-12 12 12h-3zm-1-5.907v-5.093h-3v2.093l3 3z"/>
    </svg>
    Google で続きを検索
  `;
  body.appendChild(a);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =======================================
// メイン処理
// =======================================
async function handleSubmit() {
  const userInput = searchInput.value.trim();
  if (!userInput || !isReady) return;

  // 入力クリア
  searchInput.value = '';
  searchInput.style.height = 'auto';
  sendBtn.disabled = true;
  setStatus('loading', '処理中...');

  // ユーザーメッセージ表示
  addUserMessage(userInput);
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

  // AIメッセージエリアを作成
  const aiBody = addAIMessage();
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

  try {
    // Step 1: 検索が必要か判断
    const indicator1 = addSearchingIndicator(aiBody, '考え中...');
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    const shouldSearch = await needsSearch(userInput);
    indicator1.remove();

    let prompt;
    let optimizedQuery = null;

    if (shouldSearch) {
      // Step 2: クエリ最適化
      const indicator2 = addSearchingIndicator(aiBody, 'クエリを最適化中...');
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      optimizedQuery = await optimizeQuery(userInput);
      indicator2.remove();

      // Step 3: Google検索
      const indicator3 = addSearchingIndicator(aiBody, `「${optimizedQuery}」を検索中...`);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      const { results, snippets } = await fetchGoogleSearch(optimizedQuery);
      indicator3.remove();

      // 検索結果を表示
      addSearchResults(aiBody, results);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

      prompt = snippets
        ? `${buildHistoryText()}ユーザーの質問: ${userInput}\n\n以下はGoogle検索結果の抜粋です：\n\n${snippets}\n\n上記の検索結果をもとに、ユーザーの質問に対して日本語で分かりやすく回答してください。`
        : `${buildHistoryText()}ユーザーの質問: ${userInput}\n\n検索結果を取得できませんでした。あなたの知識の範囲内で回答してください。`;
    } else {
      // 検索不要：会話履歴を含めてそのまま回答
      prompt = `${buildHistoryText()}ユーザー: ${userInput}`;
    }

    // Step 4: Gemini Nanoで回答生成
    const answerDiv = document.createElement('div');
    answerDiv.className = 'ai-answer streaming';
    aiBody.appendChild(answerDiv);

    const stream = aiSession.promptStreaming(prompt);
    let fullText = '';

    for await (const chunk of stream) {
      fullText += chunk;
      answerDiv.textContent = fullText;

      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    answerDiv.classList.remove('streaming');

    // 会話履歴に追加
    chatHistory.push({ role: 'user', content: userInput });
    chatHistory.push({ role: 'assistant', content: fullText });

    // 検索した場合はGoogleリンクを表示
    if (optimizedQuery) {
      addGoogleLink(aiBody, optimizedQuery);
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    setStatus('ready', 'Gemini Nano 準備完了');

  } catch (err) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-msg';
    errorDiv.textContent = `エラーが発生しました: ${err.message}`;
    aiBody.appendChild(errorDiv);
    setStatus('error', 'エラーが発生しました');
    console.error(err);
  }

  sendBtn.disabled = false;
  searchInput.focus();
}

// 会話履歴をテキスト化（直近6ターンまで）
function buildHistoryText() {
  if (chatHistory.length === 0) return '';
  const recent = chatHistory.slice(-12); // 6ターン分
  return recent.map(m =>
    m.role === 'user' ? `ユーザー: ${m.content}` : `アシスタント: ${m.content}`
  ).join('\n') + '\n\n';
}

// =======================================
// 起動
// =======================================
initAI();