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
let querySession = null;   // 検索クエリー生成用
let isReady = false;

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const sendBtn = document.getElementById('sendBtn');
const searchInput = document.getElementById('searchInput');
const conversation = document.getElementById('conversation');

const STATUS_MESSAGES = {
  NO_LANGUAGE_MODEL: 'Gemini Nanoが利用できません（Chrome 148以降が必要です）',
  UNAVAILABLE: 'このデバイスではGemini Nanoを使用できません',
  DOWNLOAD_REQUIRED: 'Gemini Nanoのダウンロードが必要です',
  STARTING: '起動中...',
  READY: 'Gemini Nano準備完了',
  PROCESSING: '処理中...',
  ERROR: 'エラーが発生しました',
};

const INDICATOR_MESSAGES = {
  THINKING: '考え中...',
  OPTIMIZING_QUERY: 'クエリーを最適化中...',
  SEARCHING: (query) => `「${query}」を検索中...`,
};

const ERROR_MESSAGES = {
  INIT: (message) => `初期化エラー: ${message}`,
  SUBMISSION: (message) => `エラーが発生しました: ${message}`,
};

const PROMPTS = {
  AI_ASSISTANT_READY: `あなたは親切で賢いAIアシスタントです。日本語で会話します。
    以下のルールに従ってください：
    - 会話の文脈を踏まえて自然に回答してください
    - Google検索結果が提供された場合はその内容を参考に回答してください
    - 箇条書きや段落を適切に使い、読みやすく整理してください
    - 情報源が不明確な場合はその旨を伝えてください
    - 余計な前置きは省いて、直接回答してください`,
  AI_ASSISTANT_DOWNLOAD: `あなたは親切で賢いAIアシスタントです。日本語で会話します。
      以下のルールに従ってください：
      - 会話の文脈を踏まえて自然に回答してください
      - Google検索結果が提供された場合はその内容を参考に回答してください
      - 箇条書きや段落を適切に使い、読みやすく整理してください
      - 情報源が不明確な場合はその旨を伝えてください
      - 余計な前置きは省いて、直接回答してください`,
  SEARCH_JUDGE: `You are a classifier. Answer only "yes" or "no".`,
  QUERY_READY: `
    あなたは検索クエリー最適化器です。

    ルール:
    - 出力は検索クエリーのみ
    - 説明禁止
    - 引用符禁止
    - 会話しない
    - Google検索向けに簡潔化
    - 日本語を維持
    `,
  QUERY_DOWNLOAD: `
      あなたは検索クエリー最適化器です。

      ルール:
      - 出力は検索クエリーのみ
      - 説明禁止
      - 引用符禁止
      - 会話禁止
      - Google検索向けに簡潔化
      - 日本語を維持
      `,
};

const GOOGLE_SEARCH_RESULT_COUNT = 8;
const MAX_PARSED_SEARCH_RESULTS = 6;
const MAX_DISPLAYED_SEARCH_RESULTS = 5;
const FALLBACK_SNIPPET_LENGTH = 2000;

const SEARCH_RESULT_SELECTORS = ['div.g', 'div[data-sokoban-container]', 'div.tF2Cxc'];
const SEARCH_SNIPPET_SELECTORS = ['div.VwiC3b', 'span.aCOpRe', 'div.s', 'div[data-snf]'];

function setStatus(state, text) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = text;
}

function markAIReady() {
  isReady = true;
  setStatus('ready', STATUS_MESSAGES.READY);
  sendBtn.disabled = false;
  searchInput.focus();
}

async function createAISessions({ assistantPrompt, queryPrompt, onPrimarySessionReady }) {
  aiSession = await LanguageModel.create({
    systemPrompt: assistantPrompt,
  });

  onPrimarySessionReady();

  judgeSession = await LanguageModel.create({
    systemPrompt: PROMPTS.SEARCH_JUDGE,
  });

  querySession = await LanguageModel.create({
    systemPrompt: queryPrompt,
  });
}

// =======================================
// Gemini Nano初期化
// =======================================
async function initAI() {
  // Chrome 148以降のAPIチェック
  if (!('LanguageModel' in self)) {
    setStatus('error', STATUS_MESSAGES.NO_LANGUAGE_MODEL);
    return;
  }

  try {
    const availability = await LanguageModel.availability();

    if (availability === 'unavailable') {
      setStatus('error', STATUS_MESSAGES.UNAVAILABLE);
      return;
    }

    if (availability === 'downloadable' || availability === 'downloading') {
      setStatus('loading', STATUS_MESSAGES.DOWNLOAD_REQUIRED);
      showDownloadPrompt();
      return;
    }

    await createAISessions({
      assistantPrompt: PROMPTS.AI_ASSISTANT_READY,
      queryPrompt: PROMPTS.QUERY_READY,
      onPrimarySessionReady: markAIReady,
    });

  } catch (err) {
    setStatus('error', ERROR_MESSAGES.INIT(err.message));
    console.error(err);
  }
}

function showDownloadPrompt() {
  const bar = document.querySelector('.status-bar');
  const btn = document.createElement('button');
  btn.textContent = 'Gemini Nanoを起動';
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
    setStatus('loading', STATUS_MESSAGES.STARTING);
    try {
      await createAISessions({
        assistantPrompt: PROMPTS.AI_ASSISTANT_DOWNLOAD,
        queryPrompt: PROMPTS.QUERY_DOWNLOAD,
        onPrimarySessionReady: markAIReady,
      });
    } catch (err) {
      setStatus('error', ERROR_MESSAGES.INIT(err.message));
    }
  });
  bar.appendChild(btn);
}

// =======================================
// テキストエリア自動リサイズ
// =======================================
function adjustInputHeight() {
  searchInput.style.height = 'auto';
  // paddingやborderの分を考慮しつつ、入力内容に合わせて高さを設定（最大180px）
  searchInput.style.height = Math.min(searchInput.scrollHeight, 180) + 'px';
}

// 入力時にリアルタイムで高さを変更
searchInput.addEventListener('input', adjustInputHeight);

searchInput.addEventListener('keydown', (e) => {
  // Enterキー単体での送信時のみリサイズと送信を実行
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) {
      handleSubmit();
    }
  }
});

sendBtn.addEventListener('click', handleSubmit);

// =======================================
// Google検索の実行
// =======================================
async function fetchGoogleSearch(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ja&num=${GOOGLE_SEARCH_RESULT_COUNT}`;

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
  const blocks = findSearchResultBlocks(doc);

  // タイトルとスニペットを抽出
  let count = 0;
  blocks.forEach((block) => {
    if (count >= MAX_PARSED_SEARCH_RESULTS) return;

    const result = extractSearchResult(block);
    if (!result) return;

    results.push(result);
    if (result.snippet) snippetTexts.push(`[${count + 1}] ${result.title}\n${result.snippet}`);
    count++;
  });

  // スニペットが取れなかった場合はbodyテキストから抜粋
  if (snippetTexts.length === 0) {
    snippetTexts.push(buildFallbackSnippet(doc));
  }

  return {
    results,
    snippets: snippetTexts.join('\n\n'),
    query,
  };
}

function findSearchResultBlocks(doc) {
  // 検索結果ブロックを取得（複数のセレクターを試みる）
  let blocks = [];
  for (const sel of SEARCH_RESULT_SELECTORS) {
    blocks = doc.querySelectorAll(sel);
    if (blocks.length > 0) break;
  }
  return blocks;
}

function extractSearchResult(block) {
  // タイトル
  const titleEl = block.querySelector('h3');
  const title = titleEl ? titleEl.textContent.trim() : '';

  // URL
  const linkEl = block.querySelector('a[href^="http"]');
  const url = linkEl ? linkEl.href : '';

  if (!title || !url) return null;

  return {
    title,
    url,
    snippet: extractSearchSnippet(block),
  };
}

function extractSearchSnippet(block) {
  // スニペット（検索結果の説明文）
  for (const sEl of SEARCH_SNIPPET_SELECTORS) {
    const el = block.querySelector(sEl);
    if (el) {
      return el.textContent.trim();
    }
  }
  return '';
}

function buildFallbackSnippet(doc) {
  const bodyText = doc.body?.innerText || '';
  // 不要な部分を除去して最初の2000文字
  return bodyText.replace(/\n{3,}/g, '\n\n').slice(0, FALLBACK_SNIPPET_LENGTH);
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
    const result = await judgeSession.prompt(buildNeedsSearchPrompt(userInput));
    return result.trim().toLowerCase().startsWith('yes');
  } catch {
    return false;
  }
}

function buildNeedsSearchPrompt(userInput) {
  return `Does the following question require a Google search to answer accurately? Answer only "yes" or "no".

      Requires search: latest news, current prices, weather, real-time info, recent events.
      Does not require search: general knowledge, math, writing help, casual conversation.

      Question: ${userInput}`;
}

// =======================================
// クエリーの最適化（専用セッション使用）
// =======================================
async function optimizeQuery(userInput) {
  if (!querySession) return userInput;

  try {
    const result = await querySession.prompt(buildOptimizeQueryPrompt(userInput));

    return result.trim() || userInput;

  } catch (err) {
    console.error('クエリー最適化失敗:', err);
    return userInput;
  }
}

function buildOptimizeQueryPrompt(userInput) {
  return `以下をGoogle検索向け検索語に変換してください。

    条件:
    - キーワードのみ
    - 説明禁止
    - 30文字以内

    入力:
    ${userInput}`;
}

// =======================================
// UI：メッセージ追加
// =======================================
function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'message user';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  div.appendChild(bubble);
  conversation.appendChild(div);
  return div;
}

function addAIMessage() {
  const div = document.createElement('div');
  div.className = 'message ai';

  const header = document.createElement('div');
  header.className = 'ai-header';

  const label = document.createElement('span');
  label.className = 'ai-label';
  label.textContent = 'Gemini Nano';

  const divider = document.createElement('div');
  divider.className = 'ai-divider';

  const aiBody = document.createElement('div');
  aiBody.className = 'ai-body';

  header.appendChild(label);
  header.appendChild(divider);
  div.appendChild(header);
  div.appendChild(aiBody);
  conversation.appendChild(div);
  return aiBody;
}

function addSearchingIndicator(body, text) {
  const div = document.createElement('div');
  div.className = 'searching-indicator';

  const dots = document.createElement('div');
  dots.className = 'searching-dots';
  dots.appendChild(document.createElement('span'));
  dots.appendChild(document.createElement('span'));
  dots.appendChild(document.createElement('span'));

  const label = document.createElement('span');
  label.textContent = text;

  div.appendChild(dots);
  div.appendChild(label);
  body.appendChild(div);
  return div;
}

function addSearchResults(body, results) {
  if (!results || results.length === 0) return;

  const div = document.createElement('div');
  div.className = 'search-results';

  const label = document.createElement('div');
  label.className = 'search-results-label';
  label.textContent = '検索結果';
  div.appendChild(label);

  results.slice(0, MAX_DISPLAYED_SEARCH_RESULTS).forEach((r, i) => {
    const item = document.createElement('a');
    item.className = 'result-item';
    item.href = r.url;
    item.target = '_blank';
    item.rel = 'noopener';
    const domain = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();

    const num = document.createElement('span');
    num.className = 'result-num';
    num.textContent = i + 1;

    const content = document.createElement('div');
    content.className = 'result-content';

    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = r.title;

    const url = document.createElement('div');
    url.className = 'result-url';
    url.textContent = domain;

    content.appendChild(title);
    content.appendChild(url);
    item.appendChild(num);
    item.appendChild(content);
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

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M21 13v10h-6v-6h-6v6h-6v-10h-3l12-12 12 12h-3zm-1-5.907v-5.093h-3v2.093l3 3z');

  const text = document.createTextNode('Googleで続きを検索');

  svg.appendChild(path);
  a.appendChild(svg);
  a.appendChild(text);
  body.appendChild(a);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(text) {
  return escapeHtml(text)
    // 見出し h3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // 見出し h2
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // 見出し h1
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // リンク
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // 太字
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 箇条書き
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // li をまとめて ul で囲む
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // 見出しタグ前後の余分な改行を除去
    .replace(/\n?(<\/?h[123]>)\n?/g, '$1')
    // ulタグ前後の余分な改行を除去
    .replace(/\n?(<\/?ul>)\n?/g, '$1')
    // liタグ前後の余分な改行を除去
    .replace(/\n?(<\/?li>)\n?/g, '$1')
    // 連続する改行を1つに圧縮
    .replace(/\n{2,}/g, '\n')
    // ul の後の余分な br を除去
    .replace(/<\/ul><br>/g, '</ul>')
    // 残りの改行を br に
    .replace(/\n/g, '<br>');
}

function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function prepareUserTurn(userInput) {
  // 入力クリアと高さの自動リセット
  searchInput.value = '';
  adjustInputHeight();
  sendBtn.disabled = true;
  setStatus('loading', STATUS_MESSAGES.PROCESSING);

  // ユーザーメッセージ表示
  addUserMessage(userInput);
  scrollToBottom();

  // AIメッセージエリアを作成
  const aiBody = addAIMessage();
  scrollToBottom();

  return aiBody;
}

async function buildAnswerPrompt(aiBody, userInput) {
  // Step 1: 検索が必要か判断
  const indicator1 = addSearchingIndicator(aiBody, INDICATOR_MESSAGES.THINKING);
  scrollToBottom();
  const shouldSearch = await needsSearch(userInput);
  indicator1.remove();

  if (shouldSearch) {
    return buildPromptWithSearch(aiBody, userInput);
  }

  // 検索不要：会話履歴を含めてそのまま回答
  return {
    prompt: `${buildHistoryText()}ユーザー: ${userInput}`,
    optimizedQuery: null,
  };
}

async function buildPromptWithSearch(aiBody, userInput) {
  // Step 2: クエリー最適化
  const indicator2 = addSearchingIndicator(aiBody, INDICATOR_MESSAGES.OPTIMIZING_QUERY);
  scrollToBottom();
  const optimizedQuery = await optimizeQuery(userInput);
  indicator2.remove();

  // Step 3: Google検索
  const indicator3 = addSearchingIndicator(aiBody, INDICATOR_MESSAGES.SEARCHING(optimizedQuery));
  scrollToBottom();
  const { results, snippets } = await fetchGoogleSearch(optimizedQuery);
  indicator3.remove();

  // 検索結果を表示
  addSearchResults(aiBody, results);
  scrollToBottom();

  return {
    prompt: buildSearchAnswerPrompt(userInput, snippets),
    optimizedQuery,
  };
}

function buildSearchAnswerPrompt(userInput, snippets) {
  return snippets
    ? `${buildHistoryText()}ユーザーの質問: ${userInput}\n\n以下はGoogle検索結果の抜粋です：\n\n${snippets}\n\n上記の検索結果をもとに、ユーザーの質問に対して日本語で分かりやすく回答してください。`
    : `${buildHistoryText()}ユーザーの質問: ${userInput}\n\n検索結果を取得できませんでした。あなたの知識の範囲内で回答してください。`;
}

function addAnswerContainer(aiBody) {
  const answerDiv = document.createElement('div');
  answerDiv.className = 'ai-answer';
  aiBody.appendChild(answerDiv);
  return answerDiv;
}

function injectStreamingCursor(html) {
  const cursorHtml = '<span class="streaming-cursor"></span>';

  if (/<\/li>$/.test(html)) {
    return html.replace(/(<\/li>)$/, `${cursorHtml}$1`);
  }

  if (/<\/ul>$/.test(html)) {
    return html.replace(/(<\/li>)(<\/ul>)$/, `${cursorHtml}$1$2`);
  }

  return html + cursorHtml;
}

async function streamAnswer(prompt, answerDiv) {
  const stream = aiSession.promptStreaming(prompt);
  let fullText = '';

  for await (const chunk of stream) {
    fullText += chunk;
    answerDiv.innerHTML = injectStreamingCursor(markdownToHtml(fullText));

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  // カーソルを除去して最終テキストを確定
  answerDiv.innerHTML = markdownToHtml(fullText);

  return fullText;
}

function saveTurnToHistory(userInput, fullText) {
  chatHistory.push({ role: 'user', content: userInput });
  chatHistory.push({ role: 'assistant', content: fullText });
}

function showSubmissionError(aiBody, err) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-msg';
  errorDiv.textContent = ERROR_MESSAGES.SUBMISSION(err.message);
  aiBody.appendChild(errorDiv);
  setStatus('error', STATUS_MESSAGES.ERROR);
  console.error(err);
}

// =======================================
// メイン処理
// =======================================
async function handleSubmit() {
  // 送信前に入力値を取得
  const userInput = searchInput.value.trim();
  if (!userInput || !isReady) return;

  const aiBody = prepareUserTurn(userInput);

  try {
    const { prompt, optimizedQuery } = await buildAnswerPrompt(aiBody, userInput);

    // Step 4: Gemini Nanoで回答生成
    const answerDiv = addAnswerContainer(aiBody);
    const fullText = await streamAnswer(prompt, answerDiv);

    // 会話履歴に追加
    saveTurnToHistory(userInput, fullText);

    // 検索した場合はGoogleリンクを表示
    if (optimizedQuery) {
      addGoogleLink(aiBody, optimizedQuery);
    }

    scrollToBottom();
    setStatus('ready', STATUS_MESSAGES.READY);

  } catch (err) {
    showSubmissionError(aiBody, err);
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
