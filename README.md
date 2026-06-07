# Nano Chat in New Tab

Chromeの新しいタブページにGoogleがChromeに組み込んだオンデバイスAIである**Gemini Nano**を搭載したAIチャットインターフェイスを表示するChrome拡張機能です。

![スクリーンショット1](screenshot1.png)

![スクリーンショット2](screenshot2.png)

---

## 概要

新しいタブを開くと、Gemini Nanoを使ったAIチャット画面が起動します。質問の内容に応じて、Gemini Nanoが自律的にGoogle検索を行い、検索結果をもとに回答を生成します。推論処理はGemini Nanoによりデバイス上で実行されます。必要に応じてGoogle検索へアクセスし、取得した情報を回答生成に利用します。外部APIキーは不要です。

---

## 機能

- 💬 **AIチャット** — Gemini Nanoと自然な会話ができます
- 🔍 **自動Google検索** — 最新情報や時事ニュースが必要と判断した場合、自動的にGoogle検索を実行して回答に反映します
- 📖 **会話履歴の保持** — 直近6ターンの会話を記憶し、文脈を踏まえた回答が可能です
- ⚡ **ローカル処理** — Gemini Nanoはデバイス上で動作するため、APIキー不要でプライバシーも安心です
- 🕐 **時計・日付表示** — 新しいタブを開くたびに現在時刻と日付を表示します

---

## 仕様

| 項目 | 内容 |
|------|------|
| 対応ブラウザー | Chrome 148以降 |
| 使用モデル | Gemini Nano（Chrome内蔵） |
| 外部API | 不要 |
| Google検索 | 自動判断（最新情報・時事情報が必要な場合のみ実行） |
| 会話履歴 | 直近6ターン（12メッセージ）を保持 |
| 対応言語 | 日本語（メイン）、英語 |

---

## 制限事項

- Chrome 148以降が必要です。それ以前のバージョンではGemini NanoのAPI（`LanguageModel`）が利用できません。
- Gemini Nanoのダウンロードが必要な場合があります。初回起動時にモデルがデバイスにない場合、ダウンロードボタンが表示されます。
- 会話履歴はタブを閉じるとリセットされます。永続的な記憶機能はありません。
- Gemini Nanoはコンパクトなモデルです。複雑な推論や長文生成は、大規模モデルと比べて精度が劣る場合があります。
- Google検索結果のパースはGoogleのUI変更により動作しなくなる可能性があります。
- 検索結果取得方法は将来変更される可能性があります。Google検索の仕様変更により一部機能が利用できなくなる場合があります。

---

## プライバシー

- 会話内容は保存されません
- 会話内容は外部サーバーへ送信されません
- Google検索が必要な場合のみ外部通信します

---

## インストールと起動の方法

### 1. Gemini Nanoを有効にする

Chromeのアドレスバーに以下を入力し、それぞれ`Enabled`に設定してChromeを再起動します。

```
chrome://flags/#optimization-guide-on-device-model
→ Enabled BypassPerfRequirementに設定

chrome://flags/#prompt-api-for-gemini-nano
→ Enabledに設定
```

### 2. 拡張機能を読み込む

1. このリポジトリーをクローンまたはZIPでダウンロードして解凍します
```bash
git clone https://github.com/columuni/nano-chat-in-new-tab.git
```
2. Chromeのアドレスバーに`chrome://extensions`と入力して開きます
3. 右上の 「デベロッパーモード」をONにします
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、解凍したフォルダーを選択します

### 3. 動作確認

新しいタブを開き、チャット画面が表示されれば完了です。初回起動時にGemini Nanoのダウンロードが必要な場合は、表示されるボタンをクリックしてください。

---

## ファイル構成

```
nano-chat-in-new-tab/
├── icons/             # 各サイズのアイコン
├── manifest.json      # Chrome拡張機能の設定ファイル
├── nanochat.html      # 新しいタブのUI
├── nanochat.js        # メインロジック（Gemini Nano + Google検索）
├── README.md          # README
├── screenshot1.png    # スクリーンショット1
└── screenshot2.png    # スクリーンショット2
```

---

## TODO

- CSSを最新のネスト仕様に書き換え
- JavaScriptの効率化
- host_permissionsの最小化
- escapeHtmlの徹底
- 検索ロジック切り替え（GoogleとDuckDuckGoとか）
- カラースキームの切り替え
- 検索中のインジケーターをもう少し滑らかにする
- 会話履歴クリアボタン
- 検索ON/OFF切り替え
- 初回起動オンボーディング

---

## ライセンス

MIT License
