# Google Calendar URL Retriever

Google Calendar の予定詳細ポップアップから、日付とミーティングURL（Google Meet / Zoom / Teams など）をワンクリックでクリップボードにコピーする Chrome 拡張機能です。

## 対応サービス

- Google Meet
- Zoom
- Microsoft Teams
- Webex
- Amazon Chime

## インストール方法

1. このリポジトリをクローンまたはダウンロード
2. Chrome で `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. このリポジトリのルートディレクトリを選択

## 使い方

1. [Google Calendar](https://calendar.google.com) を開く
2. 任意の予定をクリックして詳細ポップアップを表示
3. ポップアップ内の「コピー」ボタンをクリック
4. クリップボードに以下の形式でコピーされます：

Output Format:
```
2月 25日 (水曜日) · 午後12:00～12:30
https://meet.google.com/abc-defg-hij
```

ミーティングURLが存在しない場合: コンソールでエラー表示

## ファイル構成

```
google-calendar-url-retriever/
├── manifest.json
├── src/
│   ├── selectors.js
│   ├── content.js
│   └── styles.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── context/prd.md
├── README.md
└── .gitignore
```

## セレクタの更新

Google Calendar は SPA であり、CSS クラス名が頻繁に変更されます。本拡張機能は ARIA 属性・data 属性・セマンティック HTML に依存していますが、DOM 構造が変更された場合は `src/selectors.js` のセレクタ定数を更新してください。

### `src/selectors.js` の構造

- `SELECTORS.EVENT_POPUP` — ポップアップ検出用セレクタ
- `SELECTORS.EVENT_DATE` — 日付抽出用セレクタ
- `SELECTORS.BUTTON_INJECTION_POINT` — ボタン挿入位置（優先）
- `SELECTORS.BUTTON_INJECTION_FALLBACK` — ボタン挿入位置（フォールバック）
- `MEETING_URL_PATTERNS` — ミーティングURL検出用正規表現

## 技術仕様

- Manifest V3 準拠
- ビルドツール不要（プレーン JavaScript）
- MutationObserver による DOM 監視
- `navigator.clipboard.writeText()` によるクリップボード書き込み
- 必要最小限の権限（`clipboardWrite` のみ）
