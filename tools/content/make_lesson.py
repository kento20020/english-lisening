#!/usr/bin/env python3
"""英文のレッスンファイルから、Speak Back で読み込める聞き取り教材を作る。

    python make_lesson.py lessons/everyday.txt

出力（--out のフォルダ。既定は tools/content/out/<レッスン名>/）:
    <name>.wav              お手本の音声（WAV、いつも作る）
    <name>.mp3              同じ音声の MP3（ffmpeg があるときだけ）
    <name>.timing.json      文ごと・単語ごとの時刻
    <name>.speakback.json   Speak Back の「⬆ プロジェクトファイルを読み込む」でそのまま開けるファイル

声は Piper（https://github.com/rhasspy/piper）の音声モデルで合成する。ネットにつなぐのは
--download で声のモデルを取ってくるときだけ。

レッスンファイルの書き方は README.md を見てください。

このファイルの読み込み・時刻の計算・JSON 作りは標準ライブラリだけで動く。
piper-tts は実際に声を作るとき（PiperBackend）にだけ読み込む。
"""
from __future__ import annotations

import argparse
import base64
import datetime as _dt
import json
import re
import shutil
import subprocess
import sys
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, Sequence

HERE = Path(__file__).resolve().parent
DEFAULT_VOICE = 'en_US-ljspeech-medium'
DEFAULT_VOICE_DIR = HERE / 'voices'
DEFAULT_OUT_DIR = HERE / 'out'

# Piper の音素のうち、声ではなく区切りや間（ま）を表すもの
PUNCT_PHONEMES = set(',.;:!?¡¿—–-…"\'«»“”()[] ')
SPECIAL_PHONEMES = {'^', '$', '_'}  # BOS, EOS, PAD


# ---------------------------------------------------------------------------
# レッスンファイル
# ---------------------------------------------------------------------------

@dataclass
class Sentence:
    text: str
    translation: Optional[str] = None


@dataclass
class Lesson:
    title: str
    sentences: list[Sentence]


class LessonError(ValueError):
    pass


def parse_lesson_text(src: str) -> Lesson:
    """テキスト形式のレッスンを読む。

    - 最初の（空行でもコメントでもない）行がタイトル。先頭の「title:」は付けても付けなくてもよい。
    - そのあと 1 行に 1 文。「 | 」のあとに日本語訳を書いてもよい。
    - 「#」で始まる行はコメント。空行は無視する。
    """
    title: Optional[str] = None
    sentences: list[Sentence] = []
    for lineno, raw in enumerate(src.splitlines(), 1):
        line = raw.strip().lstrip('﻿')
        if not line or line.startswith('#'):
            continue
        if title is None:
            title = re.sub(r'^title\s*:\s*', '', line, flags=re.I).strip()
            if not title:
                raise LessonError(f'{lineno} 行目: タイトルが空です')
            continue
        text, sep, tr = line.partition('|')
        text = ' '.join(text.split())
        tr = ' '.join(tr.split()) or None
        if not text:
            raise LessonError(f'{lineno} 行目: 英文が空です')
        if not re.search(r'[A-Za-z0-9]', text):
            raise LessonError(f'{lineno} 行目: 英文に文字がありません: {text!r}')
        sentences.append(Sentence(text, tr))
    if title is None:
        raise LessonError('タイトルの行がありません')
    if not sentences:
        raise LessonError('英文が 1 つもありません')
    return Lesson(title, sentences)


def parse_lesson_json(src: str) -> Lesson:
    """JSON 形式: {"title": "...", "sentences": ["...", {"text": "...", "ja": "..."}]}"""
    try:
        j = json.loads(src)
    except json.JSONDecodeError as e:
        raise LessonError(f'JSON として読めません: {e}') from None
    if not isinstance(j, dict) or not isinstance(j.get('title'), str) or not j['title'].strip():
        raise LessonError('"title" がありません')
    items = j.get('sentences')
    if not isinstance(items, list) or not items:
        raise LessonError('"sentences" が空です')
    out: list[Sentence] = []
    for i, it in enumerate(items, 1):
        if isinstance(it, str):
            text, tr = it, None
        elif isinstance(it, dict) and isinstance(it.get('text'), str):
            text = it['text']
            tr = it.get('translation', it.get('ja'))
        else:
            raise LessonError(f'sentences の {i} 番目が読めません')
        text = ' '.join(text.split())
        if not re.search(r'[A-Za-z0-9]', text):
            raise LessonError(f'sentences の {i} 番目に英文がありません')
        out.append(Sentence(text, (' '.join(str(tr).split()) or None) if tr else None))
    return Lesson(j['title'].strip(), out)


def load_lesson(path: Path) -> Lesson:
    src = path.read_text(encoding='utf-8')
    if path.suffix.lower() == '.json':
        return parse_lesson_json(src)
    return parse_lesson_text(src)


def slugify(name: str) -> str:
    s = re.sub(r'[^A-Za-z0-9._-]+', '-', name).strip('-._')
    return s or 'lesson'


# ---------------------------------------------------------------------------
# 単語と時刻
# ---------------------------------------------------------------------------

def split_words(text: str) -> list[str]:
    """英文を単語に分ける。前後の句読点は落とし、文字のない記号（ - など）は単語にしない。"""
    words = []
    for tok in text.split():
        w = tok.strip('.,;:!?"“”‘’()[]{}…—–-«»')
        if '.' in w and tok.rstrip(',;:!?"”’)]}').endswith('.'):
            w += '.'   # p.m. や U.K. は最後の点も残す
        if re.search(r'[A-Za-z0-9]', w):
            words.append(w)
    return words


def word_weight(word: str) -> int:
    """推定で使う重み。数字は読むと長いので、1 桁を 3 文字ぶんとして数える。"""
    letters = sum(c.isalpha() for c in word)
    digits = sum(c.isdigit() for c in word)
    return max(1, letters + 3 * digits)


def estimate_word_spans(words: Sequence[str], start: float, end: float) -> list[tuple[float, float]]:
    """start〜end（秒）を、単語の文字数に比例して分ける（推定）。"""
    if not words:
        return []
    weights = [word_weight(w) for w in words]
    total = sum(weights)
    spans = []
    acc = 0
    for wgt in weights:
        a = start + (end - start) * acc / total
        acc += wgt
        b = start + (end - start) * acc / total
        spans.append((a, b))
    return spans


@dataclass
class Group:
    """音素の並びのうち、空白で区切られた 1 かたまり（だいたい 1 単語）。"""
    start: float   # サンプル位置
    end: float
    phonemes: str


STRESS = 'ˈˌ'


def clean_phonemes(phs) -> str:
    """比べるときに使う音素の文字列（強勢の記号・句読点・特別な記号を落とす）。"""
    return ''.join(p for p in phs if p not in SPECIAL_PHONEMES and p not in PUNCT_PHONEMES and p not in STRESS)


def phoneme_groups(alignments: Sequence[tuple[str, float]]) -> tuple[list[Group], float, float]:
    """Piper の音素ごとのサンプル数の並びから、単語にあたる区間（サンプル位置）を取り出す。

    alignments: (音素, サンプル数) の並び。空白 ' ' が単語の切れ目。BOS/EOS/句読点は声に含めない。
    戻り値: (区間のリスト, 声の始まり, 声の終わり)
    """
    groups: list[Group] = []
    pos = 0.0
    cur: Optional[list] = None   # [start, end, phonemes]
    for ph, n in alignments:
        if ph == ' ':
            if cur is not None:
                groups.append(Group(*cur))
                cur = None
        elif ph in SPECIAL_PHONEMES or ph in PUNCT_PHONEMES:
            pass
        else:
            if cur is None:
                cur = [pos, pos, '']
            cur[1] = pos + n
            cur[2] += ph
        pos += n
    if cur is not None:
        groups.append(Group(*cur))
    groups = [g for g in groups if clean_phonemes(g.phonemes)]
    if groups:
        return groups, groups[0].start, groups[-1].end
    return groups, 0.0, pos


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def align_words(word_phs: Sequence[str], group_phs: Sequence[str], max_join: int = 3,
                max_cost: float = 0.5) -> Optional[list[tuple[range, range]]]:
    """英文の単語（1 語ずつ音素にしたもの）と、文の中の音素のかたまりを対応させる。

    espeak は「of the」→「ʌvðə」のように短い語をくっつけたり、「25」→「twenty five」のように
    1 語を分けたりするので、1 対 1 のほかに 多対1・1 対多 も許す（動的計画法）。
    戻り値: (単語の範囲, かたまりの範囲) のリスト。うまく合わないときは None。
    """
    n, m = len(word_phs), len(group_phs)
    if n == 0 or m == 0:
        return None
    wp = [clean_phonemes(w) for w in word_phs]
    gp = [clean_phonemes(g) for g in group_phs]
    INF = float('inf')
    best = [[INF] * (m + 1) for _ in range(n + 1)]
    back: list[list[Optional[tuple[int, int]]]] = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if best[i][j] == INF:
                continue
            for di in range(1, max_join + 1):
                for dj in range(1, max_join + 1):
                    if di > 1 and dj > 1:
                        continue
                    ni, nj = i + di, j + dj
                    if ni > n or nj > m:
                        continue
                    a = ''.join(wp[i:ni])
                    b = ''.join(gp[j:nj])
                    cost = levenshtein(a, b) / max(len(a), len(b), 1)
                    if di > 1 or dj > 1:
                        cost += 0.05   # 1 対 1 を少しだけ優先する
                    c = best[i][j] + cost * di
                    if c < best[ni][nj]:
                        best[ni][nj] = c
                        back[ni][nj] = (i, j)
    if best[n][m] == INF or best[n][m] / n > max_cost:
        return None
    blocks = []
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj = back[i][j]
        blocks.append((range(pi, i), range(pj, j)))
        i, j = pi, pj
    blocks.reverse()
    return blocks


def spans_from_alignment(words: Sequence[str], word_phs: Sequence[str], groups: Sequence[Group]
                         ) -> Optional[tuple[list[tuple[float, float]], list[bool]]]:
    """対応づけから、単語ごとの (始まり, 終わり)（サンプル位置）と「推定かどうか」を出す。

    1 つのかたまりに何語か入っているときは、その中を音素の数で分ける（その単語は推定）。
    """
    blocks = align_words(word_phs, [g.phonemes for g in groups])
    if blocks is None:
        return None
    spans: list[tuple[float, float]] = []
    est: list[bool] = []
    for wr, gr in blocks:
        a, b = groups[gr.start].start, groups[gr.stop - 1].end
        if len(wr) == 1:
            spans.append((a, b))
            est.append(False)
        else:
            weights = [max(1, len(clean_phonemes(word_phs[k]))) for k in wr]
            total = sum(weights)
            acc = 0
            for wgt in weights:
                spans.append((a + (b - a) * acc / total, a + (b - a) * (acc + wgt) / total))
                acc += wgt
                est.append(True)
    return spans, est


# ---------------------------------------------------------------------------
# 合成（声を作る部分）
# ---------------------------------------------------------------------------

@dataclass
class SynthResult:
    """1 文ぶんの音声。"""
    pcm: bytes                    # 16bit・モノラルの PCM
    sample_rate: int
    words: list[tuple[float, float]]   # 単語ごとの (始まり, 終わり)。この文の頭からの秒
    words_estimated: list[bool]   # 単語ごとに、時刻が推定かどうか
    speech: tuple[float, float]   # 声が出ている区間（この文の頭からの秒）

    @property
    def n_samples(self) -> int:
        return len(self.pcm) // 2


class PiperBackend:
    """Piper で 1 文ずつ合成する。単語の時刻は Piper の音素の長さ（alignment）から取る。"""

    def __init__(self, model_path: Optional[Path] = None, speed: float = 1.0,
                 inner_pause: float = 0.2, voice=None):
        try:
            from piper import PiperVoice, SynthesisConfig
        except ImportError:
            sys.exit('piper-tts が入っていません。README の「準備」を見てください（pip install -r requirements.txt）')
        if voice is None:
            voice = PiperVoice.load(str(model_path), include_alignments=True)
        self.voice = voice
        self.sample_rate = voice.config.sample_rate
        self.length_scale = voice.config.length_scale / speed
        self.syn_config = SynthesisConfig(length_scale=self.length_scale)
        self.inner_pause = inner_pause
        self.alignment_missing = 0   # Piper が音素の長さを返さなかった文の数

    def _word_phonemes(self, word: str) -> str:
        try:
            return ' '.join(''.join(s) for s in self.voice.phonemize(word))
        except Exception:
            return word.lower()

    def __call__(self, text: str) -> SynthResult:
        sr = self.sample_rate
        pause = b'\x00\x00' * int(round(self.inner_pause * sr))
        pcm = bytearray()
        aligned: list[tuple[str, float]] = []
        alignment_ok = True
        chunks = list(self.voice.synthesize(text, syn_config=self.syn_config, include_alignments=True))
        if not chunks:
            raise RuntimeError(f'音声を作れませんでした: {text!r}')
        for k, ch in enumerate(chunks):   # espeak が 1 行を 2 文以上に分けたときは、短い間をはさむ
            if ch.sample_rate != sr:
                raise RuntimeError('サンプリング周波数が途中で変わりました')
            if k:
                pcm += pause
                aligned.append((' ', len(pause) // 2))
            data = ch.audio_int16_bytes
            n = len(data) // 2
            al = ch.phoneme_alignments
            if al:
                total = sum(a.num_samples for a in al) or 1
                # 音素の長さの合計と、実際の音声の長さをそろえる
                aligned.extend((a.phoneme, a.num_samples * n / total) for a in al)
            else:
                alignment_ok = False
                aligned.append(('?', n))
            pcm += data
        n_total = len(pcm) // 2
        words = split_words(text)
        result = None
        if alignment_ok:
            groups, sp0, sp1 = phoneme_groups(aligned)
            speech = (sp0 / sr, sp1 / sr)
            result = spans_from_alignment(words, [self._word_phonemes(w) for w in words], groups)
        else:
            self.alignment_missing += 1
            speech = (0.0, n_total / sr)
        if result is not None:
            spans, est = result
            return SynthResult(bytes(pcm), sr, [(a / sr, b / sr) for a, b in spans], est, speech)
        return SynthResult(bytes(pcm), sr, estimate_word_spans(words, *speech), [True] * len(words), speech)


# ---------------------------------------------------------------------------
# つなげる・書き出す
# ---------------------------------------------------------------------------

@dataclass
class Built:
    pcm: bytes
    sample_rate: int
    timing: dict


def r3(x: float) -> float:
    return round(x + 0.0, 3)


def _mode(n_est: int, n: int) -> str:
    """単語の時刻がどこから来たか。piper-alignment = すべて Piper の音素の長さから、estimated = すべて推定。"""
    if n_est == 0:
        return 'piper-alignment'
    return 'estimated' if n_est == n else 'partly-estimated'


def build_lesson(lesson: Lesson, synth: Callable[[str], SynthResult], *,
                 gap: float = 1.0, lead_in: float = 0.3, tail: float = 0.5,
                 meta: Optional[dict] = None, log=lambda s: None) -> Built:
    """文を 1 つずつ合成し、決まった長さの無音をはさんでつなげる。時刻はサンプル数から計算するので正確。"""
    pcm = bytearray()
    sentences = []
    sr: Optional[int] = None
    n_words = n_est = 0
    for i, s in enumerate(lesson.sentences):
        log(f'  [{i + 1}/{len(lesson.sentences)}] {s.text}')
        res = synth(s.text)
        if sr is None:
            sr = res.sample_rate
            pcm += b'\x00\x00' * int(round(lead_in * sr))
        elif res.sample_rate != sr:
            raise RuntimeError('文によってサンプリング周波数が違います')
        if i:
            pcm += b'\x00\x00' * int(round(gap * sr))
        start_n = len(pcm) // 2
        pcm += res.pcm
        end_n = len(pcm) // 2
        start = start_n / sr
        words = split_words(s.text)
        if len(res.words) != len(words) or len(res.words_estimated) != len(words):
            raise RuntimeError(f'単語の時刻の数が英文と合いません: {s.text!r}')
        est = sum(res.words_estimated)
        n_words += len(words)
        n_est += est
        sentences.append({
            'index': i,
            'text': s.text,
            'translation': s.translation,
            'start': r3(start),
            'end': r3(end_n / sr),
            'speech_start': r3(start + res.speech[0]),
            'speech_end': r3(start + res.speech[1]),
            'word_timing': _mode(est, len(words)),
            'words': [{'word': w, 'start': r3(start + a), 'end': r3(start + b), 'estimated': bool(e)}
                      for w, (a, b), e in zip(words, res.words, res.words_estimated)],
        })
    assert sr is not None
    pcm += b'\x00\x00' * int(round(tail * sr))
    n = len(pcm) // 2
    timing = {
        'format': 'speakback-lesson-timing',
        'version': 1,
        'title': lesson.title,
        **(meta or {}),
        'sample_rate': sr,
        'duration': r3(n / sr),
        'gap': gap,
        'lead_in': lead_in,
        'word_timing': _mode(n_est, n_words),
        'words_estimated': n_est,
        'words_total': n_words,
        'sentences': sentences,
    }
    return Built(bytes(pcm), sr, timing)


def write_wav(path: Path, pcm: bytes, sample_rate: int) -> None:
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)


def find_ffmpeg() -> Optional[str]:
    return shutil.which('ffmpeg')


def write_mp3(wav_path: Path, mp3_path: Path, ffmpeg: str, bitrate: str = '64k') -> None:
    subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav_path),
                    '-codec:a', 'libmp3lame', '-b:a', bitrate, '-ac', '1', str(mp3_path)], check=True)


def speakback_project(name: str, track_name: str, audio: bytes, mime: str, markers: list[dict],
                      now_ms: Optional[int] = None) -> dict:
    """english-practice2.html の exportProject と同じ形（importProject がそのまま読める）。"""
    if now_ms is None:
        now_ms = int(time.time() * 1000)
    exported = _dt.datetime.fromtimestamp(now_ms / 1000, _dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + \
        f'{now_ms % 1000:03d}Z'
    return {
        'format': 'speakback-project',
        'version': 2,
        'exported': exported,
        'project': {
            'name': name,
            'created': now_ms,
            'rate': 1,
            'vol': 100,
            'curTrack': 0,
            'tracks': [{
                'name': track_name,
                'type': mime,
                'markers': [{'t': m['t'], 'name': m['name']} for m in markers],
                'data': base64.b64encode(audio).decode('ascii'),
            }],
        },
        'recordings': [],
    }


def markers_from_timing(timing: dict) -> list[dict]:
    # mimic/sample.js と同じく、印 1 つ = 1 文。t は文の始まり、name は英文
    return [{'t': s['start'], 'name': s['text']} for s in timing['sentences']]


# ---------------------------------------------------------------------------
# 声のモデル
# ---------------------------------------------------------------------------

def resolve_model(args) -> Path:
    if args.model:
        p = Path(args.model)
        if not p.is_file():
            sys.exit(f'声のモデルが見つかりません: {p}')
        return p
    voice_dir = Path(args.voice_dir)
    p = voice_dir / f'{args.voice}.onnx'
    if not (p.is_file() and Path(str(p) + '.json').is_file()):
        if not args.download:
            sys.exit(f'声のモデルがありません: {p}\n'
                     f'  --download を付けると取ってきます（Hugging Face の rhasspy/piper-voices から）')
        try:
            from piper.download_voices import download_voice
        except ImportError:
            sys.exit('piper-tts が入っていません。README の「準備」を見てください')
        voice_dir.mkdir(parents=True, exist_ok=True)
        print(f'声のモデル {args.voice} を取ってきます…', file=sys.stderr)
        new_files = [q for q in (p, Path(str(p) + '.json')) if not q.exists()]
        try:
            download_voice(args.voice, voice_dir)
        except Exception as e:   # ネットにつながらない、名前が違う、など
            for q in new_files:
                q.unlink(missing_ok=True)   # 途中までのファイルを残さない
            sys.exit(f'声のモデルを取ってこられませんでした: {e}')
    return p


# ---------------------------------------------------------------------------
# コマンド
# ---------------------------------------------------------------------------

def make_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description='英文のレッスンファイルから、Speak Back 用の聞き取り教材を作る')
    ap.add_argument('lesson', type=Path, help='レッスンファイル（.txt か .json）')
    ap.add_argument('--out', type=Path, help='出力フォルダ（既定: tools/content/out/<名前>/）')
    ap.add_argument('--name', help='出力ファイルの名前（既定: レッスンファイルの名前）')
    ap.add_argument('--voice', default=DEFAULT_VOICE, help=f'Piper の声の名前（既定: {DEFAULT_VOICE}）')
    ap.add_argument('--voice-dir', default=str(DEFAULT_VOICE_DIR), help='声のモデルを置くフォルダ')
    ap.add_argument('--model', help='声のモデル（.onnx）を直接指定する。隣に .onnx.json が必要')
    ap.add_argument('--download', action='store_true', help='声のモデルがなければ取ってくる（ネットを使う）')
    ap.add_argument('--speed', type=float, default=1.0, help='話す速さ。0.85 なら 85%% の速さ（ゆっくり）。既定 1.0')
    ap.add_argument('--gap', type=float, default=1.0, help='文と文のあいだの無音（秒）。既定 1.0')
    ap.add_argument('--lead-in', type=float, default=0.3, help='最初の文の前の無音（秒）。既定 0.3')
    ap.add_argument('--speakback-audio', choices=['auto', 'mp3', 'wav'], default='auto',
                    help='.speakback.json に入れる音声。auto は ffmpeg があれば MP3（小さい）、なければ WAV')
    ap.add_argument('--no-mp3', action='store_true', help='MP3 を作らない')
    return ap


def run(argv: Optional[Sequence[str]] = None, backend_factory=None) -> dict:
    args = make_parser().parse_args(argv)
    if not (0.3 <= args.speed <= 3.0):
        sys.exit('--speed は 0.3〜3.0 の間で指定してください')
    if args.gap < 0 or args.lead_in < 0:
        sys.exit('--gap と --lead-in は 0 以上にしてください')
    try:
        lesson = load_lesson(args.lesson)
    except (OSError, LessonError) as e:
        sys.exit(f'レッスンファイルを読めません: {e}')
    name = slugify(args.name or args.lesson.stem)
    out_dir = args.out or (DEFAULT_OUT_DIR / name)
    out_dir.mkdir(parents=True, exist_ok=True)

    if backend_factory is None:
        model = resolve_model(args)
        backend = PiperBackend(model, speed=args.speed)
        voice_label = args.model and Path(args.model).name.removesuffix('.onnx') or args.voice
    else:
        backend = backend_factory(args)
        voice_label = getattr(backend, 'label', 'custom')

    print(f'「{lesson.title}」（{len(lesson.sentences)} 文）を作ります', file=sys.stderr)
    built = build_lesson(lesson, backend, gap=args.gap, lead_in=args.lead_in, meta={
        'voice': voice_label,
        'speed': args.speed,
        'length_scale': r3(getattr(backend, 'length_scale', 1.0 / args.speed)),
    }, log=lambda s: print(s, file=sys.stderr))

    wav_path = out_dir / f'{name}.wav'
    write_wav(wav_path, built.pcm, built.sample_rate)
    built.timing['audio'] = {'wav': wav_path.name}

    ffmpeg = None if args.no_mp3 else find_ffmpeg()
    mp3_path = None
    if ffmpeg:
        mp3_path = out_dir / f'{name}.mp3'
        try:
            write_mp3(wav_path, mp3_path, ffmpeg)
            built.timing['audio']['mp3'] = mp3_path.name
        except (subprocess.CalledProcessError, OSError) as e:
            print(f'MP3 を作れませんでした（WAV だけにします）: {e}', file=sys.stderr)
            mp3_path = None

    want = args.speakback_audio
    if want == 'mp3' and not mp3_path:
        sys.exit('MP3 を作れなかったので、--speakback-audio mp3 にできません')
    if want == 'mp3' or (want == 'auto' and mp3_path):
        sb_audio, sb_mime = mp3_path.read_bytes(), 'audio/mpeg'
        built.timing['audio']['speakback'] = mp3_path.name
    else:
        sb_audio, sb_mime = wav_path.read_bytes(), 'audio/wav'
        built.timing['audio']['speakback'] = wav_path.name

    timing_path = out_dir / f'{name}.timing.json'
    timing_path.write_text(json.dumps(built.timing, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    proj = speakback_project(lesson.title, lesson.title, sb_audio, sb_mime, markers_from_timing(built.timing))
    sb_path = out_dir / f'{name}.speakback.json'
    sb_path.write_text(json.dumps(proj, ensure_ascii=False), encoding='utf-8')

    print(f'できました（{built.timing["duration"]:.2f} 秒、単語の時刻: {built.timing["word_timing"]}）', file=sys.stderr)
    for p in [wav_path, mp3_path, timing_path, sb_path]:
        if p:
            print(f'  {p}  ({p.stat().st_size:,} バイト)', file=sys.stderr)
    return {'out_dir': out_dir, 'wav': wav_path, 'mp3': mp3_path, 'timing': timing_path, 'speakback': sb_path}


def main() -> None:
    run()


if __name__ == '__main__':
    main()
