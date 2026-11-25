# 進捗の記録

Claude Duet や Claude Code から頼んだ作業の、今の状態と次にやることを新しい順に残します。
Claude Code で続きを始めるときは、まずこのファイルと `docs/decisions.md`・`docs/roadmap.md` を読んでください。

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
