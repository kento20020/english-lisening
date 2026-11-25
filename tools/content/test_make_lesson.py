"""make_lesson.py のテスト。声のモデルも piper-tts も使わない（合成はにせもの）。

    cd tools/content && python3 -m unittest -v
"""
import base64
import json
import re
import shutil
import sys
import tempfile
import types
import unittest
import wave
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_lesson as ml  # noqa: E402

SR = 1000  # 計算を見やすくするため、テストでは 1 秒 = 1000 サンプル


def fake_synth(seconds_per_word=0.25, sr=SR):
    """単語の数に比例した長さの「音声」を返すにせものの合成。"""
    def synth(text):
        words = ml.split_words(text)
        n = int(len(words) * seconds_per_word * sr)
        pcm = b'\x01\x00' * n
        spans = ml.estimate_word_spans(words, 0.0, n / sr)
        return ml.SynthResult(pcm, sr, spans, [False] * len(words), (0.0, n / sr))
    synth.label = 'fake'
    return synth


class ParseTest(unittest.TestCase):
    def test_text_format(self):
        src = ('# comment\n\n'
               'title: My Lesson\n'
               'Hello there.  | こんにちは\n'
               '# another comment\n'
               '   How   are you?\n'
               'Fine. |\n')
        les = ml.parse_lesson_text(src)
        self.assertEqual(les.title, 'My Lesson')
        self.assertEqual([s.text for s in les.sentences], ['Hello there.', 'How are you?', 'Fine.'])
        self.assertEqual([s.translation for s in les.sentences], ['こんにちは', None, None])

    def test_title_without_prefix(self):
        les = ml.parse_lesson_text('Everyday English\nHi.\n')
        self.assertEqual(les.title, 'Everyday English')
        self.assertEqual(len(les.sentences), 1)

    def test_errors(self):
        for src in ['', '# only comments\n', 'Title only\n', 'T\n| 訳だけ\n', 'T\n...\n']:
            with self.subTest(src=src):
                with self.assertRaises(ml.LessonError):
                    ml.parse_lesson_text(src)

    def test_json_format(self):
        les = ml.parse_lesson_json(json.dumps({
            'title': 'J', 'sentences': ['One.', {'text': 'Two.', 'ja': '二'}, {'text': 'Three.', 'translation': '三'}]}))
        self.assertEqual(les.title, 'J')
        self.assertEqual([(s.text, s.translation) for s in les.sentences],
                         [('One.', None), ('Two.', '二'), ('Three.', '三')])
        with self.assertRaises(ml.LessonError):
            ml.parse_lesson_json('{"title": "x", "sentences": []}')

    def test_sample_lesson(self):
        les = ml.load_lesson(HERE / 'lessons' / 'everyday.txt')
        self.assertEqual(les.title, 'Everyday English')
        self.assertGreaterEqual(len(les.sentences), 6)
        self.assertTrue(all(s.translation for s in les.sentences))
        # mimic/sample.js の 6 文がそのまま入っている
        sample_js = HERE.parents[1] / 'mimic' / 'sample.js'
        if sample_js.exists():
            names = re.findall(r"name: (['\"])(.*?)\1 \}", sample_js.read_text(encoding='utf-8'))
            texts = [s.text for s in les.sentences]
            for _, n in names:
                self.assertIn(n, texts)

    def test_slugify(self):
        self.assertEqual(ml.slugify('everyday'), 'everyday')
        self.assertEqual(ml.slugify('My Lesson/1'), 'My-Lesson-1')
        self.assertEqual(ml.slugify('日本語'), 'lesson')


class WordTest(unittest.TestCase):
    def test_split_words(self):
        self.assertEqual(ml.split_words("Hi, how are you doing today?"), ['Hi', 'how', 'are', 'you', 'doing', 'today'])
        self.assertEqual(ml.split_words("I'd like - well - coffee."), ["I'd", 'like', 'well', 'coffee'])
        self.assertEqual(ml.split_words('At 3:30 p.m. in the U.K.'), ['At', '3:30', 'p.m.', 'in', 'the', 'U.K.'])

    def test_estimate_spans(self):
        spans = ml.estimate_word_spans(['a', 'bbb'], 1.0, 2.0)
        self.assertEqual(spans, [(1.0, 1.25), (1.25, 2.0)])
        self.assertEqual(ml.estimate_word_spans([], 0, 1), [])

    def test_phoneme_groups(self):
        al = [('^', 10), ('h', 5), ('ˈ', 0), ('aɪ', 10), (',', 20), (' ', 3), ('j', 4), ('uː', 6), ('?', 7), ('$', 9)]
        groups, s0, s1 = ml.phoneme_groups(al)
        self.assertEqual([(g.start, g.end, g.phonemes) for g in groups], [(10, 25, 'hˈaɪ'), (48, 58, 'juː')])
        self.assertEqual((s0, s1), (10, 58))

    def test_align_one_to_one(self):
        blocks = ml.align_words(['hˈaɪ', 'juː'], ['hˈaɪ', 'jʊ'])
        self.assertEqual([(list(w), list(g)) for w, g in blocks], [([0], [0]), ([1], [1])])

    def test_align_merged_and_split(self):
        # espeak: 「of the」が 1 つに、「25」が 2 つになる
        words = ['ʌv', 'ðə', 'twˈɛnti fˈaɪv', 'dˈɑːlɚz']
        groups = ['ʌvðə', 'twˈɛnti', 'fˈaɪv', 'dˈɑːlɚz']
        blocks = ml.align_words(words, groups)
        self.assertEqual([(list(w), list(g)) for w, g in blocks], [([0, 1], [0]), ([2], [1, 2]), ([3], [3])])

    def test_align_rejects_garbage(self):
        self.assertIsNone(ml.align_words(['kˈæt', 'dˈɔɡ'], ['zzzzzz', 'qqqqqq']))
        self.assertIsNone(ml.align_words([], ['a']))

    def test_spans_from_alignment(self):
        groups = [ml.Group(0, 100, 'ʌvðə'), ml.Group(110, 200, 'kˈæt')]
        spans, est = ml.spans_from_alignment(['of', 'the', 'cat'], ['ʌv', 'ðə', 'kˈæt'], groups)
        self.assertEqual(spans, [(0, 50), (50, 100), (110, 200)])
        self.assertEqual(est, [True, True, False])


class BuildTest(unittest.TestCase):
    def lesson(self):
        return ml.Lesson('T', [ml.Sentence('One two.', '一二'), ml.Sentence('Three four five six.'),
                               ml.Sentence('Seven.')])

    def test_timing_math(self):
        b = ml.build_lesson(self.lesson(), fake_synth(), gap=1.0, lead_in=0.3, tail=0.5)
        t = b.timing
        # 文の長さ: 0.5, 1.0, 0.25 秒
        self.assertEqual([(s['start'], s['end']) for s in t['sentences']],
                         [(0.3, 0.8), (1.8, 2.8), (3.8, 4.05)])
        self.assertEqual(t['duration'], 4.55)
        self.assertEqual(len(b.pcm) // 2, 4550)
        self.assertEqual(t['sample_rate'], SR)
        self.assertEqual(t['word_timing'], 'piper-alignment')
        self.assertEqual(t['sentences'][0]['translation'], '一二')
        w = t['sentences'][1]['words']
        self.assertEqual([x['word'] for x in w], ['Three', 'four', 'five', 'six'])
        self.assertEqual(w[0]['start'], 1.8)
        self.assertEqual(w[-1]['end'], 2.8)
        starts = [s['start'] for s in t['sentences']]
        self.assertEqual(starts, sorted(starts))

    def test_estimated_flag(self):
        def synth(text):
            r = fake_synth()(text)
            r.words_estimated = [True] * len(r.words)
            return r
        t = ml.build_lesson(self.lesson(), synth).timing
        self.assertEqual(t['word_timing'], 'estimated')
        self.assertTrue(all(w['estimated'] for s in t['sentences'] for w in s['words']))
        self.assertEqual(t['sentences'][0]['word_timing'], 'estimated')

    def test_word_count_mismatch_is_error(self):
        def synth(text):
            r = fake_synth()(text)
            r.words, r.words_estimated = r.words[:1], r.words_estimated[:1]
            return r
        with self.assertRaises(RuntimeError):
            ml.build_lesson(self.lesson(), synth)


class SpeakbackTest(unittest.TestCase):
    def test_shape(self):
        audio = b'RIFF\x00\x01\x02 some bytes \xff'
        p = ml.speakback_project('Name', 'Track', audio, 'audio/wav',
                                 [{'t': 0.3, 'name': 'Hi.'}, {'t': 2.0, 'name': 'Bye.'}], now_ms=1764100000123)
        j = json.loads(json.dumps(p))
        self.assertEqual(j['format'], 'speakback-project')
        self.assertEqual(j['version'], 2)
        self.assertEqual(j['exported'], '2025-11-25T19:46:40.123Z')
        self.assertEqual(j['recordings'], [])
        pr = j['project']
        self.assertEqual(pr, {**pr, 'name': 'Name', 'created': 1764100000123, 'rate': 1, 'vol': 100, 'curTrack': 0})
        self.assertEqual(len(pr['tracks']), 1)
        tr = pr['tracks'][0]
        self.assertEqual(set(tr), {'name', 'type', 'markers', 'data'})
        self.assertEqual(tr['type'], 'audio/wav')
        self.assertEqual(tr['markers'], [{'t': 0.3, 'name': 'Hi.'}, {'t': 2.0, 'name': 'Bye.'}])
        self.assertEqual(base64.b64decode(tr['data']), audio)

    def test_matches_import_code(self):
        """english-practice2.html の importProject が読む名前と合っているか（ファイルを読むだけ）。"""
        html = HERE.parents[1] / 'english-practice2.html'
        if not html.exists():
            self.skipTest('english-practice2.html がない')
        src = html.read_text(encoding='utf-8')
        m = re.search(r'async function importProject\(file\)\{(.*?)\n\}', src, re.S)
        self.assertIsNotNone(m)
        body = m.group(1)
        for needle in ["j.format!=='speakback-project'", 'p.tracks', 't.name', 't.type', 't.markers', 't.data',
                       'p.name', 'p.created', 'p.curTrack', 'p.rate', 'p.vol', 'j.recordings']:
            self.assertIn(needle, body)
        # 印は {t, name} で持つ（normalizeProject）
        self.assertIn('t.markers=(t.markers||[]).map(m=>({t:m.t,name:m.name', src)


class FakeChunk:
    def __init__(self, n, alignments):
        self.sample_rate = SR
        self.audio_int16_bytes = b'\x00\x01' * n
        self.phoneme_alignments = alignments


class FakeVoice:
    """piper.PiperVoice のにせもの。「I like the cat」を 1 つの文として返す。"""
    config = types.SimpleNamespace(sample_rate=SR, length_scale=1.0)
    PH = {'I': 'aɪ', 'like': 'lˈaɪk', 'the': 'ðə', 'cat': 'kˈæt'}

    def __init__(self, with_alignment=True):
        self.with_alignment = with_alignment
        self.last_config = None

    def phonemize(self, text):
        return [list(self.PH[text])]

    def synthesize(self, text, syn_config=None, include_alignments=False):
        self.last_config = syn_config
        A = types.SimpleNamespace
        # espeak は「the cat」を「ðəkˈæt」のように 1 つにすることがある
        al = [A(phoneme=p, num_samples=n) for p, n in
              [('^', 50), ('aɪ', 100), (' ', 20), ('l', 50), ('ˈ', 0), ('aɪ', 60), ('k', 40), (' ', 30),
               ('ð', 30), ('ə', 30), ('k', 40), ('ˈ', 0), ('æ', 60), ('t', 40), ('.', 100), ('$', 50)]]
        n = sum(a.num_samples for a in al)
        yield FakeChunk(n * 2, al if self.with_alignment else None)   # 実際の音声は 2 倍の長さ（そろえる処理を見る）


class PiperBackendTest(unittest.TestCase):
    def setUp(self):
        # piper-tts が入っていなくても動くように、SynthesisConfig だけのにせのモジュールを入れる
        self._saved = sys.modules.get('piper')
        fake = types.ModuleType('piper')
        fake.PiperVoice = object
        fake.SynthesisConfig = lambda **kw: types.SimpleNamespace(**kw)
        sys.modules['piper'] = fake

    def tearDown(self):
        if self._saved is None:
            sys.modules.pop('piper', None)
        else:
            sys.modules['piper'] = self._saved

    def test_alignment_words(self):
        v = FakeVoice()
        b = ml.PiperBackend(voice=v, speed=0.8)
        self.assertAlmostEqual(b.length_scale, 1.25)
        r = b('I like the cat.')
        self.assertAlmostEqual(v.last_config.length_scale, 1.25)
        self.assertEqual(r.n_samples, 1400)
        self.assertEqual(r.words_estimated, [False, False, True, True])
        got = [(round(a, 3), round(c, 3)) for a, c in r.words]
        # 音素の長さを 2 倍にそろえてから秒に直す
        self.assertEqual(got[0], (0.1, 0.3))
        self.assertEqual(got[1], (0.34, 0.64))
        self.assertEqual(got[2][0], 0.7)
        self.assertEqual(got[3][1], 1.1)
        self.assertEqual(got[2][1], got[3][0])
        self.assertEqual((round(r.speech[0], 3), round(r.speech[1], 3)), (0.1, 1.1))

    def test_no_alignment_falls_back_to_estimate(self):
        b = ml.PiperBackend(voice=FakeVoice(with_alignment=False))
        r = b('I like the cat.')
        self.assertEqual(r.words_estimated, [True] * 4)
        self.assertEqual(r.words[0][0], 0.0)
        self.assertAlmostEqual(r.words[-1][1], 1.4)
        self.assertEqual(b.alignment_missing, 1)


class RunTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.lesson = self.tmp / 'mini.txt'
        self.lesson.write_text('Mini\nHello there. | やあ\nGood night.\n', encoding='utf-8')

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def _run(self, *extra):
        with redirect_stderr(StringIO()):
            return ml.run([str(self.lesson), '--out', str(self.tmp / 'out'), *extra],
                          backend_factory=lambda args: fake_synth(sr=8000))  # MP3 が使える周波数

    def test_wav_only(self):
        res = self._run('--no-mp3')
        self.assertIsNone(res['mp3'])
        with wave.open(str(res['wav'])) as w:
            self.assertEqual((w.getframerate(), w.getnchannels(), w.getsampwidth()), (8000, 1, 2))
            dur = w.getnframes() / w.getframerate()
        t = json.loads(res['timing'].read_text(encoding='utf-8'))
        self.assertAlmostEqual(t['duration'], dur, places=3)
        sb = json.loads(res['speakback'].read_text(encoding='utf-8'))
        tr = sb['project']['tracks'][0]
        self.assertEqual(tr['type'], 'audio/wav')
        self.assertEqual(base64.b64decode(tr['data']), res['wav'].read_bytes())
        self.assertEqual([m['name'] for m in tr['markers']], ['Hello there.', 'Good night.'])
        self.assertEqual(sb['project']['name'], 'Mini')
        self.assertTrue(all(0 <= m['t'] < dur for m in tr['markers']))

    @unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg がない')
    def test_mp3(self):
        res = self._run()
        self.assertTrue(res['mp3'].exists())
        tr = json.loads(res['speakback'].read_text(encoding='utf-8'))['project']['tracks'][0]
        self.assertEqual(tr['type'], 'audio/mpeg')
        self.assertEqual(base64.b64decode(tr['data']), res['mp3'].read_bytes())

    def test_bad_speed(self):
        with self.assertRaises(SystemExit), redirect_stderr(StringIO()):
            self._run('--speed', '0')


if __name__ == '__main__':
    unittest.main()
