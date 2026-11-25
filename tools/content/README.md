# リスニング教材づくり（make_lesson.py）

英文を書いたファイルから、お手本の音声と時刻のデータを作ります。
できたファイルは、Speak Back（`english-practice2.html`）にそのまま読み込めます。

- 声は [Piper](https://github.com/rhasspy/piper) で合成します。お金も API キーもいりません。
- ネットを使うのは、最初に声のモデルを取ってくるときだけです。あとは手元だけで動きます。

## できるもの

レッスン 1 つにつき、`out/<名前>/` に次のファイルができます。

| ファイル | 中身 |
|---|---|
| `<名前>.wav` | お手本の音声（いつも作る） |
| `<名前>.mp3` | 同じ音声の MP3（ffmpeg があるときだけ。64kbps・モノラル） |
| `<名前>.timing.json` | 文ごと・単語ごとの時刻 |
| `<名前>.speakback.json` | Speak Back のプロジェクトファイル（音声と、文ごとの印が入っている） |

## 準備（最初の 1 回）

Python 3.9 以上で、リポジトリのいちばん上から：

```sh
python3 -m venv ~/venv-content
~/venv-content/bin/pip install -r tools/content/requirements.txt
```

MP3 も作りたいときは ffmpeg を入れておきます（なくても WAV は作れます）。

声のモデル（約 60MB）は、はじめて使うときに `--download` を付けると取ってきます。
`tools/content/voices/` に入ります（git には入れません）。

## 使い方

```sh
# はじめて（声のモデルも取ってくる）
~/venv-content/bin/python tools/content/make_lesson.py tools/content/lessons/everyday.txt --download

# ゆっくり（85% の速さ）、文のあいだを 1.5 秒あける
~/venv-content/bin/python tools/content/make_lesson.py tools/content/lessons/everyday.txt --speed 0.85 --gap 1.5
```

おもな指定：

| 指定 | 意味 | 既定 |
|---|---|---|
| `--speed` | 話す速さ。`0.85` なら 85% の速さ（ゆっくり） | `1.0` |
| `--gap` | 文と文のあいだの無音（秒） | `1.0` |
| `--lead-in` | 最初の文の前の無音（秒） | `0.3` |
| `--voice` | Piper の声の名前（例 `en_US-lessac-medium`） | `en_US-ljspeech-medium` |
| `--model` | 声のモデル（`.onnx`）を直接指定する。隣に `.onnx.json` が必要 | なし |
| `--out` | 出力フォルダ | `tools/content/out/<名前>/` |
| `--speakback-audio` | `.speakback.json` に入れる音声。`auto` は MP3 があれば MP3 | `auto` |
| `--no-mp3` | MP3 を作らない | なし |

## レッスンファイルの書き方

`lessons/everyday.txt` を見本にしてください。

```text
# 「#」で始まる行はメモ。空行は無視する
Everyday English
Hi, how are you doing today? | 今日の調子はどう？
Could you say that again, please?
```

- 最初の行（メモと空行を除く）がタイトルです。
- そのあと、1 行に 1 文書きます。
- 「 | 」のあとに日本語訳を書けます。なくてもかまいません。

JSON でも書けます（拡張子を `.json` にする）：

```json
{"title": "Everyday English",
 "sentences": ["Hi, how are you doing today?", {"text": "Thank you.", "ja": "ありがとう。"}]}
```

## Speak Back に読み込む

1. `english-practice2.html` を開く
2. 「⬆ プロジェクトファイルを読み込む」を押す
3. `out/<名前>/<名前>.speakback.json` を選ぶ

文ごとに印がついたプロジェクトとして開きます（印の名前は英文）。

## timing.json の形

数字は例です。

```json
{
  "format": "speakback-lesson-timing", "version": 1,
  "title": "Everyday English", "voice": "en_US-ljspeech-medium", "speed": 0.85,
  "sample_rate": 22050, "duration": 31.2, "gap": 1.0, "lead_in": 0.3,
  "word_timing": "partly-estimated", "words_estimated": 6, "words_total": 76,
  "audio": {"wav": "everyday.wav", "mp3": "everyday.mp3", "speakback": "everyday.mp3"},
  "sentences": [
    {"index": 0, "text": "Hi, how are you doing today?", "translation": "今日の調子はどう？",
     "start": 0.3, "end": 2.1, "speech_start": 0.35, "speech_end": 1.98,
     "word_timing": "piper-alignment",
     "words": [{"word": "Hi", "start": 0.35, "end": 0.6, "estimated": false}, "..."]}
  ]
}
```

- 時刻はすべて秒（音声の頭から）。
- `start` / `end` は、その文の音声の始まりと終わり。文を 1 つずつ合成して、決まった長さの無音でつなげているので、正確です。
- `speech_start` / `speech_end` は、その中で声が出ている区間。
- `words` は単語ごとの時刻。`estimated` が `true` の単語は推定です（下の「わかっている限界」）。
- `word_timing`：`piper-alignment`（すべて Piper から）・`partly-estimated`（一部推定）・`estimated`（すべて推定）。

## 単語の時刻の取り方

Piper（piper-tts 1.8）は、音素ごとの長さを出せます（`include_alignments`）。これを使っています。

1. Piper が文を音素にして、音素ごとの長さを返す
2. 音素の並びを、空白のところで「単語のかたまり」に分ける
3. 英文の単語を 1 語ずつ音素にして、かたまりと突き合わせる（「25」→ twenty five のように 2 つに分かれても、合わせられる）

## わかっている限界

- espeak（Piper が中で使う読み方の辞書）は、短い語をくっつけることがあります（例：「of the」→ 1 つのかたまり）。そのときは、かたまりの中を音素の数で分けるので、その単語は `estimated: true` になります。
- Piper が音素の長さを返せなかったとき（`onnx` が入っていないなど）は、文の中を文字数で分けた推定になります（`estimated: true`）。
- MP3 は、作るときに頭に少し（約 0.05 秒）無音が足されます。たいていのブラウザはこれを飛ばしますが、飛ばさないブラウザだと、印や単語の時刻が 0.05 秒ほどずれます。ぴったり合わせたいときは `--speakback-audio wav` にしてください（ファイルは大きくなります）。
- 1 行に 2 文以上書くと、Piper が文に分けて、あいだに 0.2 秒の間を入れます。印は行ごとに 1 つです。

## 声のライセンス

- 既定の声 `en_US-ljspeech-medium` は、[LJ Speech データセット](https://keithito.com/LJ-Speech-Dataset/)（パブリックドメイン）から作られた声です。[rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) で配られています。`mimic/sample/everyday-english.mp3` も同じ声です。
- `--voice` でほかの声を使うときは、その声のライセンスを、piper-voices の各フォルダにある `MODEL_CARD` で確かめてください。声によっては商用に使えないものがあります。
- Piper 本体（piper-tts）のライセンスは GPL-3.0-or-later です。このツールは手元で動かすだけで、アプリには組み込んでいません。

## テスト

声のモデルがなくても動きます（合成はにせものを使う）。

```sh
cd tools/content && python3 -m unittest -v
```
