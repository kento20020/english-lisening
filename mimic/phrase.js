/* C Phrase だけの使い勝手（見た目は phrase.css）。仕組み（mimic.js）はそのまま使い、外から足している。
   ・初めての人への案内と、サンプルですぐ試せる入口
   ・フレーズのカードの ▶ は、そのフレーズだけを流す（「くり返す」がオンなら、くり返す）
   ・録音バーの「お手本」で、選んでいるフレーズを聞き比べる。いま練習しているフレーズを表示する
   ・お手本と同時に録るときも、フレーズの終わりでお手本を止める
   ・マイクが使えないときは、直し方の案内を出す */
(function () {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 初めての人への案内 ---------- */
  const welcome = byId('welcome');
  let welcomeCheck = 0;
  async function updateWelcome() {
    const n = ++welcomeCheck;
    if (cur.tracks.length) { welcome.hidden = true; return; }
    // 音源の入ったプロジェクトがまだ1つもないときだけ出す
    const all = await dbAll('projects');
    if (n !== welcomeCheck) return;
    welcome.hidden = all.some((p) => p && Array.isArray(p.tracks) && p.tracks.length);
  }
  new MutationObserver(updateWelcome).observe(byId('trackList'), { childList: true });
  setTimeout(updateWelcome, 300);

  async function openSample(btn) {
    if (btn) btn.disabled = true;
    try {
      const r = await MimicSample.load();
      if (r.blocked) return;
      toast('サンプルを開きました。フレーズの ▶ で聞いて、下の録音ボタンでまねしてみましょう');
      setTimeout(() => byId('s2').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }), 350);
    } catch (e) {
      console.warn(e);
      toast('サンプルを開けませんでした。インターネットにつながっているか確かめてください');
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  document.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => openSample(b)));
  byId('useOwn').addEventListener('click', () => byId('fileInput').click());

  /* ---------- フレーズだけを流す ---------- */
  let stopAt = null;   // ここまで来たら止める（秒）
  let backTo = null;   // 止めたあと、ここに戻す（もう一度押すと同じフレーズが流れるように）

  function playPhrase() {
    const seg = currentSegment();
    if (!seg) { toggleModel(); return; }
    playFrom(seg[0]);
    stopAt = seg[1];
    backTo = seg[0];
  }

  // カードの ▶：mimic.js がそのフレーズを選んで再生したあとで、止める位置を決める
  byId('markers').addEventListener('click', (e) => {
    if (!e.target.closest('.mplay')) return;
    setTimeout(() => {
      const seg = currentSegment();
      stopAt = seg ? seg[1] : null;
      backTo = seg ? seg[0] : null;
    }, 0);
  }, true);

  // ふつうの再生・移動は、最後まで流す
  ['mPlay', 'mBack', 'mFwd', 'waveWrap'].forEach((id) => byId(id).addEventListener('click', () => { stopAt = null; }, true));
  model.addEventListener('ended', () => { stopAt = null; });

  // お手本と同時に録るときも、フレーズの終わりでお手本を止める
  byId('recBtn').addEventListener('click', () => {
    const recording = typeof recorder !== 'undefined' && recorder && recorder.state === 'recording';
    if (recording || !byId('syncModel').checked || !modelReady) return;
    const seg = currentSegment();
    stopAt = seg ? seg[1] : null;
    backTo = seg ? seg[0] : null;
  }, true);

  (function watch() {
    if (stopAt != null && !model.paused && !byId('loopSeg').checked && model.currentTime >= stopAt - 0.04) {
      model.pause();
      if (backTo != null) model.currentTime = backTo;
      stopAt = null;
    }
    requestAnimationFrame(watch);
  })();

  /* ---------- 録音バー：いまのフレーズと「お手本」 ---------- */
  const rbPhrase = byId('rbPhrase');
  const modelBtn = byId('playModelPhrase');
  modelBtn.addEventListener('click', () => { if (modelReady) playPhrase(); });

  function updateBar() {
    const ready = typeof modelReady !== 'undefined' && modelReady;
    const ms = ready ? gmarks() : [];
    const g = ms[selMark];
    const label = g ? `いまのフレーズ　${selMark + 1}. ${g.name || '（名前なし）'}` : '';
    if (rbPhrase.textContent !== label) {
      rbPhrase.textContent = label;
      rbPhrase.hidden = !label;
    }
    modelBtn.disabled = !ready;
  }
  setInterval(updateBar, 250);

  /* ---------- マイクが使えないとき ---------- */
  const micHelp = byId('micHelp');
  window.MimicHooks = Object.assign(window.MimicHooks || {}, {
    onMicProblem(msg) {
      byId('micHelpText').textContent = msg;
      micHelp.hidden = false;
      byId('status').textContent = 'マイクを使えません。上の案内を見てください。';
      return true;
    },
  });
  byId('micHelpClose').addEventListener('click', () => { micHelp.hidden = true; });
  byId('micRetry').addEventListener('click', () => { micHelp.hidden = true; toggleRec(); });
  // 録音が始まったら案内を閉じる
  new MutationObserver(() => {
    if (byId('recBtn').classList.contains('recording')) micHelp.hidden = true;
  }).observe(byId('recBtn'), { attributes: true, attributeFilter: ['class'] });
})();
