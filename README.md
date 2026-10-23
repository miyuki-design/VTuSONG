# VTuSONG — AI作詞・作曲・編曲アプリ 🩵

iPhone（TestFlight）で、音楽ジャンル・希望楽器・テーマ・雰囲気・音域を選び、AIが16小節の**歌詞・歌メロ・コード進行・楽器構成**を生成。音源を試聴し、**ガイドメロディー入り／オフボーカルをWAVで書き出せる**初期実装です。歌声の録音・ピッチ補正・MIXは既存のVTuRECが担当します。

## 今回の実装範囲

✅ AI作詞・作曲（OpenAI API、サーバー側から呼び出し）
✅ 指定楽器に沿ったAI編曲指示（演奏そのものは内蔵の簡易シンセが合成）
✅ 日本語歌詞16小節、メロディー、和音、BPM、6種の楽器
✅ 編曲トラックの音量調整とミュート、歌詞・タイトル・BPM・メロディー音程編集
✅ AI部分再生成（歌詞／メロディー／編曲／後半8小節のサビ）
✅ 2種類の**44.1kHz/16bitステレオWAV**を別々にレンダリング
✅ iPhone共有シートへWAVを書き出す（Capacitor Filesystem + Share）
✅ 端末内への直近の楽曲の自動保存、サンプル曲での動作確認
✅ Capacitor iOS・GitHub Actions→TestFlightのビルド構成

⏳ 未実装：歌詞音節と音符の厳密な割付、各楽器の詳細なピアノロール編集、高品質サンプル音源、曲全体の長尺制作、複数曲ライブラリ、AI生成結果の実機品質検証。

**重要：AIが作成するのは音符・コード・歌詞・楽器ごとの演奏スタイルです。完成済みの人声ボーカルやスタジオ品質のPCM音源をAIが直接生成する方式ではありません。音質は内蔵Web Audioシンセに依存します。**

## 1. ローカル起動（Windows）

Node.js 22 を用意し、このフォルダで：

```powershell
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を表示。**「まずサンプル音源を試す」**ならAPI無しで試聴・WAV出力をテストできます。サンプルは固定データであり、AI生成ではありません。

## 2. AI生成を有効化（Cloudflare Workers）

既存のCloudflareアカウントを利用可能。OpenAI APIキーは**Workerにだけ**保存し、React / GitHub の公開ソースやiPhoneアプリに記載しないでください。

```powershell
npx wrangler login
npx wrangler secret put OPENAI_API_KEY --config worker/wrangler.toml
npm run worker:deploy
```

Worker URL例: `https://vtusong-ai.***.workers.dev`

プロジェクト直下に `.env.local` を作成：

```dotenv
VITE_API_BASE_URL=https://vtusong-ai.***.workers.dev
```

`npm run dev` を再起動。ブラウザで「AIで楽曲を生成」を押すとAPIが実行されます。モデルは `worker/wrangler.toml` の `OPENAI_MODEL`（初期値 `gpt-4.1-mini`）で変更できます。**OpenAI API利用料金が別途発生**し、プランや残高により使えない場合があります。

公開Worker URLからのAI API呼び出しにはコストリスクがあるため、配布範囲を限定し、Cloudflare側でレート制限・費用上限等を設定してください。`Access-Control-Allow-Origin` は認証の代わりにはなりません。個人用β版の段階では、配布先とAPI費用の監視を強く推奨します。

## 3. TestFlight準備

このプロジェクトを **GitHubの新規リポジトリ** `VTuSONG` にコミットします。まだリポジトリは作成していません。

Apple Developer / App Store Connect に新しいiOS App IDとApp Store配布プロファイルが必要：

* アプリ名：`VTuSONG`
* Bundle ID：`com.miyukidesign.vtusong` （変更する場合 `capacitor.config.ts`, workflow, export script も揃えて変更）
* プロファイル名：`AppStore com.miyukidesign.vtusong`

GitHub Repository → Settings → Secrets and variables → Actions に登録：

**Variables**（公開可）

* `APPSTORE_ISSUER_ID` — App Store Connect Issuer ID
* `APPSTORE_API_KEY_ID` — App Store Connect API Key ID
* `APPSTORE_TEAM_ID` — Apple Developer Team ID
* `VTUSONG_AI_URL` — デプロイ済みCloudflare Worker のURL

**Secrets**（非公開）

* `APPSTORE_API_PRIVATE_KEY` — p8ファイル全体の内容（改行保持）
* `APPSTORE_CERTIFICATES_FILE_BASE64` — iOS配布証明書p12のBase64
* `APPSTORE_CERTIFICATES_PASSWORD` — そのp12のパスワード

これまでのiOS配布証明書を同じApple Teamで使える場合は流用できます。新しいBundle ID用のApp Storeプロファイルは別途必要です。プロファイルはApp Store Connect APIキーがアクセスできるApple Developer Teamに作成してください。

Actions → **VTuSONG iOS to TestFlight → Run workflow** でMacランナー上でビルド・署名・アップロードします。

> ⚠️ 作成済みのGitHubやApple接続情報がこのプロジェクトには引き継がれません。リポジトリ作成・Apple側App IDと新規App登録・証明書／変数設定が完了するまではTestFlightにアップロードできません。

## 4. VTuRECへ取り込む

VTuSONG の「制作した曲」→「オフボーカルWAV」→ iPhoneの共有シートで「ファイルに保存」→ VTuRECの伴奏取り込みで読み込みます（VTuREC側にWAV取り込み機能が必要です）。

## 構成

- `src/App.tsx` UI／AI生成・ローカル保存
- `src/audio.ts` Web Audioで楽器合成・再生・16bit WAV化
- `src/types.ts` 音符・コード・楽曲の型と検証
- `worker/index.js` AI生成用Cloudflare Workers。Structured Outputsで歌詞／和音／メロディー／編曲を一括生成
- `.github/workflows/testflight.yml` iOSネイティブ化＋TestFlight配布

## テスト

```powershell
npm test
npm run build
```

TestFlight実機では必ず、AI生成・16小節の再生・保存したWAVの試聴・オフボーカルとガイド付きの差・VTuRECへの読み込みを確認してください。生成した歌詞とメロディーの音節数は、現バージョンでは完全には保証できません。

## 注意

AI生成曲の独創性・既存曲との非類似性・音楽的完成度は自動保証できません。公開・販売時は内容確認と利用規約チェックを実施してください。
