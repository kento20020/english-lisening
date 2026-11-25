# 進捗の記録

Claude Duet や Claude Code から頼んだ作業の、今の状態と次にやることを新しい順に残します。
Claude Code で続きを始めるときは、まずこのファイルと `docs/decisions.md`・`docs/roadmap.md` を読んでください。

## 2026-11-26　リスニング教材づくりの仕組みを追加（ブランチ `claude/listening-content`）

英文を書いたファイルから、お手本の音声と時刻のデータと、Speak Back で読み込めるプロジェクトファイルを作る仕組みを、新しいフォルダ `tools/content/` に作った。既存のファイルは変えていない。既定ブランチにはまだ入れていない。

- **使い方：** `tools/content/README.md`。例のレッスンは `tools/content/lessons/everyday.txt`（12文、日本語訳つき）。
- **声：** Piper の `en_US-ljspeech-medium`（パブリックドメインの LJSpeech から作った声。今のサンプルと同じ系統）。お金も API キーもいらない。
- **できるもの：** WAV、MP3（ffmpeg があれば）、文ごと・単語ごとの時刻の JSON、Speak Back のプロジェクトファイル（文ごとに印つき。「⬆ プロジェクトファイルを読み込む」で開ける）。
- **速さ：** `--speed 0.85` などでゆっくりにできる。
- **単語の時刻：** Piper が返す音の長さから出している。Piper が 2 語を 1 つにまとめた所だけ推定（`"estimated": true`）。
- **テスト：** `cd tools/content && python3 -m unittest`（23 件、声のモデルなしで動く）。

### まだ確かめていないこと

- **本物の声での合成：** Claude の作業環境からは Hugging Face（声のモデルの置き場）につながらなかったので、声だけ差し替えて動きを確かめた。Ken の PC で一度 `--download` 付きで動かし、音と単語の時刻を確かめる必要がある。
- MP3 は WAV より約 0.05 秒長い（MP3 の作り方の都合）。ずれが気になるときは `--speakback-audio wav`。

### 次にやること

1. Ken の PC で、例のレッスンを本物の声で作って Speak Back に読み込んでみる
2. よければ既定ブランチに入れる（Ken の OK のあと）
3. レッスンを増やす（場面別、速さ別）。聞き取りの問題を足すかは相方と相談

## 2026-11-26　分担を整理（Claude Duet から）

Ken に確かめて、**Nyankohihi さんが一緒に作っている相方**だと分かった。コードは変えていない。

### だれが、どのファイルを触ってきたか（git の記録から）

| ファイル | 触ってきた人 |
|---|---|
| `english-practice2.html`（Speak Back） | Nyankohihi さんだけ（11/23 の4コミット） |
| `mimic/`、`app/`、`docs/`、Kodama（`index.html`・`app.js`） | Claude Code（Ken の依頼） |

### 分担（案）

- **Nyankohihi さん：** 画面と使い勝手、Speak Back（`english-practice2.html`）。Ken 側からは、このファイルを相談なしに書き換えない。
- **Ken：** 見た目の裏側で、相方のファイルにさわらない作業。
  1. **リスニング教材づくり（おすすめの最初の作業）：** 英文から、お手本の音声と、英文・単語ごとの時刻のデータを作る仕組み。新しいフォルダ（例 `tools/content/`）に置くので、相方の作業とぶつからない。Speak Back にはそのまま音声ファイルとして読み込める。
  2. **公開先を Cloudflare に移す：** リポジトリを非公開にする前に必要（`decisions.md` 11/23）。本番に出すのは Ken の OK のあと。
  3. **iOS アプリの準備：** 動作の記録をコピーできる画面（`app/`）。1回目のビルドは Apple の登録が済んでから。
- **相談してから：** 録音が終わったらマイクを放す、長い音声の上限。どちらも Speak Back 本体の直しになるので、相方と決めてから入れる（Mimic 側には `sync_from_speakback.py` で入れてある）。

### まだ分からないこと

- 相方の UI/UX の作業がどこで進んでいるか（このリポジトリには、11/23 以降の画面の変更は上がっていない）
- 「リスニング」として、聞き取りの問題などを新しく足すのか
- `main` と既定ブランチのどちらに寄せるか

## 2026-11-26　今の状態の確認と、分担の案（Claude Duet から）

コードは変えていません。リポジトリを読んで、今の状態をまとめただけです。

### 今あるもの

| もの | 場所 | 中身 |
|---|---|---|
| Kodama | `index.html`, `app.js` | 話すとすぐ自分の声で聞き返せる発音練習。ブラウザだけで動く |
| Speak Back | `english-practice2.html` | 音声ファイルをプロジェクトにまとめて、聞く → まねる練習。波形の表示、波形をクリックしてその位置から再生（11/23） |
| Mimic（デザイン案） | `mimic/` | Speak Back の仕組みに3通りの見た目（Studio・Pocket・Phrase）を付けた試作 |
| Mimic の iOS アプリ | `app/`, `codemagic.yaml` | Pocket を Capacitor で包んだもの。ログインなしの月額課金（StoreKit 2）。まだ一度もビルドしていない |
| 決めたこと・計画 | `docs/decisions.md`, `docs/roadmap.md`, `docs/android.md` | iOS が本命、無料は1プロジェクト、月500円で無制限、Android も作る、公開前にリポジトリを非公開にする |

- ブランチ：既定は `claude/serene-gauss-cpqufn`（GitHub Pages もここから）。`main` は Speak Back の波形（11/23）の分だけ遅れている。`docs/decisions.md` には「`main` で管理する」とあるので、どちらに寄せるかは未定。
- コミットしている人：Claude（Claude Code）と Nyankohihi。Nyankohihi は Speak Back の機能（プロジェクト、つなげた再生、波形）を足している。

### 分担の案（未確定）

`docs/decisions.md` の決まり「新しい機能は Speak Back に、Kodama と Mimic は UI・UX を考える場所」に沿うと、こう分けられる。

- **相方：** 画面と使い勝手（`mimic/` の3案、`app/src/app.css` など見た目）
- **Ken：** 見た目の裏側
  1. 録音・再生の仕組み（Speak Back 本体）：録音が終わったらマイクを放す、長い音声の上限と警告、動作の記録をコピーできる画面。`roadmap.md` の「先にやっておくと楽になること」
  2. リスニング用の教材づくり：お手本の音声と英文・時刻のデータを作る仕組み（今はサンプル1本だけ。Piper と LJSpeech で作ったもの）
  3. 公開まわり：Pages から Cloudflare への引っ越し（非公開にする前に必要）、Codemagic でのビルド、課金のテスト

### 次にやることの案

1. 相方と分担を決める（どのファイルを誰が触るか）
2. 1の録音・再生の直しを Speak Back に入れ、`mimic/tools/sync_from_speakback.py` で Mimic に取り込む
3. 公開先を Cloudflare に移してから、リポジトリを非公開にする
4. Apple の登録が済んだら、Codemagic で1回目のビルド

### 確かめたいこと

- Nyankohihi が一緒に作っている人か
- 相方の UI/UX の作業がどこまで進んでいるか、どのファイルを触っているか
- タスク名は「リスニング」だが、今のアプリは「聞いてまねる」発音練習。リスニングの練習（聞き取りの問題など）を新しく足すのか
