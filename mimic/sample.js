/* Mimic のサンプル（初めての人が、自分の音声がなくてもすぐ試せるように）
   お手本の音声 sample/everyday-english.mp3 は、このために合成したもの。
   音声合成 Piper と、パブリックドメインの英語音声 LJSpeech から作った声を使っている。
   mimic.js のあとに読み込む。どのデザインからでも MimicSample.load() で開ける。 */
(function () {
  'use strict';

  const SAMPLE = {
    url: new URL('sample/everyday-english.mp3', document.currentScript ? document.currentScript.src : location.href).href,
    project: 'サンプル：日常のひとこと',
    track: 'Everyday English（サンプル）',
    type: 'audio/mpeg',
    // 各フレーズの始まり（秒）と英文。印の名前として表示される
    marks: [
      { t: 0.38, name: 'Hi, how are you doing today?' },
      { t: 2.9, name: 'Could you say that again, please?' },
      { t: 5.83, name: "I'd like a cup of coffee, please." },
      { t: 8.93, name: 'Where is the nearest station?' },
      { t: 11.85, name: 'Thank you so much for your help.' },
      { t: 14.81, name: 'The weather is really nice today.' },
    ],
  };

  // すでにサンプルのプロジェクトがあれば、それを開く。なければ作る
  async function load() {
    const all = await dbAll('projects');
    const existing = all.find((p) => p && p.sample);
    if (existing) {
      await openProject(existing);
      return { created: false };
    }
    if (!await mayCreateProject()) return { created: false, blocked: true };
    const res = await fetch(SAMPLE.url);
    if (!res.ok) throw new Error('サンプルの音声を読み込めませんでした（' + res.status + '）');
    const blob = new Blob([await res.blob()], { type: SAMPLE.type });
    const p = blankProject();
    p.name = SAMPLE.project;
    p.sample = true;
    p.tracks = [{ id: uid(), name: SAMPLE.track, type: SAMPLE.type, blob, markers: SAMPLE.marks.map((m) => ({ ...m })) }];
    await openProject(p);
    touch();
    return { created: true };
  }

  window.MimicSample = { load, marks: SAMPLE.marks };
})();
