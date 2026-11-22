(() => {
  'use strict';

  // ============================================================
  // 定数
  // ============================================================
  const PRE_ROLL_S = 0.35;        // 声を検知する前の音もこれだけ残す（語頭が切れないように）
  const START_CHUNKS = 2;         // 何チャンク連続で閾値を超えたら「話し始め」とみなすか
  const MIN_VOICED_MS = 220;      // これより短い音は咳・物音として捨てる（自動モード）
  const MAX_AUTO_S = 25;          // 自動モードの最長録音
  const MAX_MANUAL_S = 60;        // 手動モードの最長録音
  const COOLDOWN_MS = 350;        // 再生直後は残響を拾わないよう少し待つ
  const CALIBRATE_MS = 700;       // 開始直後にまわりの雑音レベルを測る時間
  const IDLE_PAUSE_MS = 3 * 60 * 1000; // 声がないまま続いたら自動で一時停止
  const LEAD_PAD_S = 0.3;         // 再生時、声の前に残す無音
  const TAIL_PAD_S = 0.3;         // 再生時、声の後に残す無音
  const SESSION_MAX = 12;         // 「今回の練習」に残す件数
  const RECENT_MAX = 6;           // 「最近使った英文」の件数
  const RATES = [0.7, 0.85, 1, 1.15];
  const STORE_KEY = 'kodama:settings:v1';

  const EXAMPLES = [
    { title: 'よく使うフレーズ', items: [
      'Could you say that again?',
      "I'd like a cup of coffee, please.",
      'Nice to meet you.',
      'What do you do for a living?',
      'Thank you for your help.',
    ] },
    { title: '旅行', items: [
      'Where is the nearest station?',
      'Can I get a window seat?',
      'How much is this?',
      'Could you take a picture of us?',
      'I have a reservation for two.',
    ] },
    { title: '仕事', items: [
      'Let me share my screen.',
      'Could we reschedule the meeting?',
      "I'll get back to you by Friday.",
      "That's a great point.",
    ] },
    { title: 'L と R', note: 'light / right', items: [
      'The light is right there.',
      'I really love long rivers.',
      'Please correct the red line.',
    ] },
    { title: 'TH の音', note: 'think / this', items: [
      'I think this is the third one.',
      'Thank you for thinking of me.',
      'They thought about it together.',
    ] },
    { title: 'B と V', note: 'best / vest', items: [
      'The van is very big.',
      'I have a lovely view from the balcony.',
    ] },
    { title: '長めの文', items: [
      "I've been learning English for a few years, but speaking is still hard for me.",
      'If it rains tomorrow, we will stay home and watch a movie.',
    ] },
  ];

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid;
  const inAppBrowser = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger|\bTwitter/i.test(ua);

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  // ============================================================
  // 設定
  // ============================================================
  const DEFAULTS = {
    mode: 'auto',
    sens: 6,
    silence: 0.8,
    rate: 1,
    repeat: 1,
    // スマホでは録音と文字起こしがマイクを取り合うことがあるので、初期値はオフ
    transcribe: !!SR && !isMobile,
    model: false,
    lang: 'en-US',
    voice: '',
    target: '',
    recent: [],
  };

  const settings = loadSettings();
  if (!SR) settings.transcribe = false;
  if (!RATES.includes(settings.rate)) settings.rate = 1;
  if (!Array.isArray(settings.recent)) settings.recent = [];

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (_) { /* 使えない環境では既定値 */ }
    return { ...DEFAULTS };
  }

  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (_) { /* noop */ }
  }

  // ============================================================
  // DOM
  // ============================================================
  const $ = (s) => document.querySelector(s);
  const el = {
    inAppNotice: $('#inAppNotice'),
    offlineNotice: $('#offlineNotice'),
    orb: $('#orb'),
    orbLabel: $('#orbLabel'),
    ring: $('.ring'),
    ringArc: $('#ringArc'),
    status: $('#status'),
    sub: $('#sub'),
    steps: $('#steps'),
    error: $('#error'),
    modeBtns: [...document.querySelectorAll('.mode button')],
    practice: $('.practice'),
    addTarget: $('#addTarget'),
    targetBox: $('#targetBox'),
    targetText: $('#targetText'),
    changeTarget: $('#changeTarget'),
    clearTarget: $('#clearTarget'),
    said: $('#said'),
    score: $('#score'),
    actions: $('#actions'),
    replayBtn: $('#replayBtn'),
    modelBtn: $('#modelBtn'),
    saveBtn: $('#saveBtn'),
    rateChip: $('#rateChip'),
    repeatChip: $('#repeatChip'),
    modelChip: $('#modelChip'),
    settings: $('#settings'),
    sens: $('#sens'),
    meterFill: $('#meterFill'),
    meterTh: $('#meterTh'),
    silence: $('#silence'),
    silenceOut: $('#silenceOut'),
    transcribe: $('#transcribe'),
    transcribeHelp: $('#transcribeHelp'),
    lang: $('#lang'),
    voice: $('#voice'),
    sessionList: $('#sessionList'),
    sessionEmpty: $('#sessionEmpty'),
    savedList: $('#savedList'),
    savedEmpty: $('#savedEmpty'),
    dialog: $('#targetDialog'),
    targetForm: $('#targetForm'),
    targetInput: $('#targetInput'),
    targetClose: $('#targetClose'),
    recentWrap: $('#recentWrap'),
    recentList: $('#recentList'),
    exampleGroups: $('#exampleGroups'),
    toast: $('#toast'),
    toastMsg: $('#toastMsg'),
    toastAction: $('#toastAction'),
  };

  const ICON = {
    play: '<svg class="p" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
    model: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    save: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16l-5-3.5L7 20z"/></svg>',
    download: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/></svg>',
    trash: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/></svg>',
  };

  // ============================================================
  // 状態
  // ============================================================
  // off: マイク未使用 / starting: 準備中 / listening: 自動モードで声待ち
  // recording: 録音中 / playing: 再生中 / paused: 自動モードの一時停止 / idle: 手動モードの待機
  let state = 'off';
  let autoPaused = false;

  const engine = { ctx: null, stream: null, src: null, node: null, sink: null, rate: 48000 };

  let levelDb = -120;
  let floorDb = -62;
  let calibrateUntil = 0;
  let ignoreUntil = 0;
  let listenSince = 0;
  let aboveCount = 0;
  let preRoll = [];
  let preRollLen = 0;
  let rec = null;

  const session = [];     // 今回の練習（メモリのみ）
  let saved = [];         // IndexedDB に保存したもの
  const savedUrls = new Map();
  let lastClip = null;
  let playingKey = null;  // 一覧で再生中の項目
  let playingAudio = false;

  // ============================================================
  // 小物
  // ============================================================
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function fmtTime(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(ts)}`;
  }

  function fmtDur(s) { return `${s.toFixed(1)}秒`; }

  function tidyText(t) {
    const s = (t || '').replace(/\s+/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function tidyTarget(t) {
    return (t || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  }

  let toastTimer = 0;
  let toastHandler = null;
  function toast(msg, opts = {}) {
    el.toastMsg.textContent = msg;
    toastHandler = opts.onAction || null;
    el.toastAction.hidden = !opts.action;
    el.toastAction.textContent = opts.action || '';
    el.toast.classList.toggle('has-action', !!opts.action);
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts.duration || (opts.action ? 6000 : 2400));
  }

  function hideToast() {
    el.toast.classList.remove('show', 'has-action');
    toastHandler = null;
  }

  el.toastAction.addEventListener('click', () => {
    const fn = toastHandler;
    hideToast();
    if (fn) fn();
  });

  function showError(msg) {
    el.error.textContent = msg;
    el.error.hidden = !msg;
  }

  // ============================================================
  // お題との照合（どの単語が伝わったか）
  // ============================================================
  const CONTRACTIONS = {
    "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are',
    "it's": 'it is', "that's": 'that is', "what's": 'what is', "there's": 'there is',
    "here's": 'here is', "he's": 'he is', "she's": 'she is', "let's": 'let us', "where's": 'where is',
    "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
    "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will',
    "it'll": 'it will', "he'll": 'he will', "she'll": 'she will',
    "i'd": 'i would', "you'd": 'you would', "we'd": 'we would', "they'd": 'they would',
    "he'd": 'he would', "she'd": 'she would',
    "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not',
    cannot: 'can not', "won't": 'will not', "isn't": 'is not', "aren't": 'are not',
    "wasn't": 'was not', "weren't": 'were not', "couldn't": 'could not', "wouldn't": 'would not',
    "shouldn't": 'should not', "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not',
    okay: 'ok', gonna: 'going to', wanna: 'want to',
  };
  const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
    'nineteen', 'twenty'];

  function normToken(tok) {
    const out = [];
    for (const part of tok.toLowerCase().replace(/[’‘]/g, "'").split(/[-–—/]+/)) {
      const w = part.replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
      if (!w) continue;
      if (CONTRACTIONS[w]) out.push(...CONTRACTIONS[w].split(' '));
      else if (/^\d+$/.test(w) && Number(w) <= 20) out.push(NUMBER_WORDS[Number(w)]);
      else out.push(w);
    }
    return out;
  }

  // お題の単語ごとに、聞き取り結果に含まれていたかを判定する（最長共通部分列）
  function compareWords(target, heard) {
    const disp = target.split(/\s+/).filter(Boolean);
    const tt = [];
    disp.forEach((tok, d) => { for (const w of normToken(tok)) tt.push({ w, d, ok: false }); });
    const hh = (heard || '').split(/\s+/).filter(Boolean).flatMap(normToken);
    const n = tt.length;
    const m = hh.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = tt[i].w === hh[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    for (let i = 0, j = 0; i < n && j < m;) {
      if (tt[i].w === hh[j]) { tt[i].ok = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    const words = disp.map((text, d) => {
      const subs = tt.filter((x) => x.d === d);
      return { text, counted: subs.length > 0, ok: subs.length > 0 && subs.every((x) => x.ok) };
    });
    const counted = words.filter((w) => w.counted);
    return { words, ok: counted.filter((w) => w.ok).length, total: counted.length };
  }

  // ============================================================
  // 音声エンジン（マイク入力）
  // ============================================================
  async function start() {
    showError('');
    if (!window.isSecureContext) {
      showError('マイクを使うには https:// のページで開いてください（GitHub Pages なら https で開けます）。');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError(inAppBrowser
        ? 'このアプリ内ブラウザではマイクが使えません。メニューから Safari や Chrome で開き直してください。'
        : 'このブラウザはマイク録音に対応していません。最新の Chrome、Edge、Safari で開いてください。');
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      showError('このブラウザは音声処理に対応していません。最新の Chrome、Edge、Safari で開いてください。');
      return;
    }

    setState('starting');
    // iOS などはタップの中で作らないと音が鳴らないため、await より前に準備する
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    unlockPlayer();
    unlockTTS();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (err) {
      ctx.close().catch(() => {});
      setState('off');
      showError(micErrorMessage(err));
      return;
    }

    try {
      const src = ctx.createMediaStreamSource(stream);
      const sink = ctx.createGain();
      sink.gain.value = 0;
      sink.connect(ctx.destination);

      let node = null;
      if (ctx.audioWorklet && window.AudioWorkletNode) {
        try {
          await ctx.audioWorklet.addModule('recorder-worklet.js');
          node = new AudioWorkletNode(ctx, 'kodama-capture', {
            numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
          });
          node.port.onmessage = (e) => onChunk(e.data);
        } catch (_) { node = null; }
      }
      if (!node) {
        node = ctx.createScriptProcessor(1024, 1, 1);
        node.onaudioprocess = (e) => onChunk(new Float32Array(e.inputBuffer.getChannelData(0)));
      }
      src.connect(node);
      node.connect(sink);

      Object.assign(engine, { ctx, stream, src, node, sink, rate: ctx.sampleRate });
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

      // iOS で電話や別アプリに切り替わると止まるので、一時停止として扱う
      ctx.addEventListener('statechange', () => {
        if (ctx.state !== 'running' && engine.ctx === ctx) pauseForInterruption();
      });

      stream.getAudioTracks().forEach((t) => {
        t.addEventListener('ended', () => {
          stopEngine();
          showError('マイクが切断されました。もう一度タップするとやり直せます。');
        });
      });
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      setState('off');
      showError('音声の準備に失敗しました。ページを再読み込みしてください。');
      console.error(err);
      return;
    }

    calibrateUntil = performance.now() + CALIBRATE_MS;
    autoPaused = false;
    enterResting();
    // 開始直後は雑音レベルを測るので、声の検知を少し遅らせる
    ignoreUntil = Math.max(ignoreUntil, calibrateUntil);
    if (!meterRunning) { meterRunning = true; requestAnimationFrame(meterLoop); }
  }

  function stopEngine() {
    cancelRecording();
    stopPlayback();
    srWant(false);
    if (engine.stream) engine.stream.getTracks().forEach((t) => t.stop());
    if (engine.ctx) engine.ctx.close().catch(() => {});
    Object.assign(engine, { ctx: null, stream: null, src: null, node: null, sink: null });
    setState('off');
  }

  function pauseForInterruption() {
    if (state === 'off' || state === 'starting') return;
    if (state === 'recording') cancelRecording();
    if (state === 'playing') stopPlayback();
    if (settings.mode === 'auto') {
      autoPaused = true;
      srWant(false);
      setState('paused');
    } else if (state !== 'idle') {
      setState('idle');
    }
  }

  function micErrorMessage(err) {
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      if (inAppBrowser) return 'アプリ内ブラウザではマイクが使えないことがあります。メニューから Safari や Chrome で開き直してください。';
      if (isIOS) return 'マイクの使用が許可されていません。iPhone の「設定」→「Safari」→「マイク」を「許可」にして、ページを再読み込みしてください。';
      if (isAndroid) return 'マイクの使用が許可されていません。アドレスバーの左のアイコン →「権限」→「マイク」を許可にして、ページを再読み込みしてください。';
      return 'マイクの使用が許可されていません。アドレスバーの左にあるアイコンからマイクを「許可」にして、ページを再読み込みしてください。';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'マイクが見つかりません。マイクやイヤホンがつながっているか確認してください。';
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      return 'マイクをほかのアプリが使っているようです。ほかのアプリやタブを閉じてから、もう一度タップしてください。';
    }
    return 'マイクを使えませんでした。ページを再読み込みして、もう一度試してください。';
  }

  function thresholds() {
    const s = settings.sens;
    const margin = 22 - s * 1.5;      // 雑音よりどれだけ大きければ声とみなすか（dB）
    const minTh = -40 - s * 2;        // 静かな部屋でも、これより小さい音は無視
    const start = Math.max(floorDb + margin, minTh);
    return { start, end: start - 4 };
  }

  function onChunk(chunk) {
    if (!engine.ctx) return;
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    const rms = Math.sqrt(sum / chunk.length);
    const db = rms > 1e-7 ? 20 * Math.log10(rms) : -140;
    levelDb = db;
    const th = thresholds();

    if (state === 'recording') {
      pushRec(chunk, db, th);
      return;
    }

    // 声を検知する前の部分も残しておく
    preRoll.push(chunk);
    preRollLen += chunk.length;
    const keep = PRE_ROLL_S * engine.rate;
    while (preRoll.length > 1 && preRollLen - preRoll[0].length >= keep) {
      preRollLen -= preRoll.shift().length;
    }

    if (state !== 'listening' && state !== 'idle' && state !== 'paused') {
      aboveCount = 0;
      return;
    }

    const now = performance.now();
    // まわりの雑音レベルを追いかける（下がるときは速く、上がるときはゆっくり）
    if (now < calibrateUntil) {
      floorDb += (db - floorDb) * 0.25;
    } else if (db < th.start) {
      floorDb += (db - floorDb) * (db < floorDb ? 0.3 : 0.01);
    }
    floorDb = clamp(floorDb, -95, -28);

    if (state !== 'listening' || now < ignoreUntil) {
      aboveCount = 0;
      return;
    }

    if (now - listenSince > IDLE_PAUSE_MS) {
      autoPaused = true;
      srWant(false);
      setState('paused');
      toast('しばらく声がなかったので、一時停止しました');
      return;
    }

    if (db > th.start) {
      aboveCount++;
      if (aboveCount >= START_CHUNKS) startRecording(true);
    } else {
      aboveCount = 0;
    }
  }

  function startRecording(auto) {
    if (!engine.ctx) return;
    const chunks = auto ? preRoll.slice() : [];
    let len = 0;
    for (const c of chunks) len += c.length;
    const r = {
      auto,
      chunks,
      len,
      firstVoiced: -1,
      lastVoiced: -1,
      voicedMs: 0,
      silentMs: 0,
      totalMs: 0,
      sumDb: 0,
      nChunks: 0,
      target: settings.target,
      utter: newUtter(),
    };
    if (auto && aboveCount > 0) {
      // プリロールの最後の数チャンクはすでに声
      let voicedLen = 0;
      for (const c of chunks.slice(-aboveCount)) voicedLen += c.length;
      r.firstVoiced = len - voicedLen;
      r.lastVoiced = len;
      r.voicedMs = (voicedLen / engine.rate) * 1000;
    }
    preRoll = [];
    preRollLen = 0;
    aboveCount = 0;
    rec = r;
    srBeginUtterance(r.utter);
    setState('recording');
  }

  function pushRec(chunk, db, th) {
    const r = rec;
    const at = r.len;
    const ms = (chunk.length / engine.rate) * 1000;
    r.chunks.push(chunk);
    r.len += chunk.length;
    r.totalMs += ms;
    r.sumDb += Math.max(db, -100);
    r.nChunks++;

    if (db > th.end) {
      if (r.firstVoiced < 0) r.firstVoiced = at;
      r.lastVoiced = r.len;
      r.voicedMs += ms;
      r.silentMs = 0;
    } else {
      r.silentMs += ms;
    }

    const dur = r.len / engine.rate;
    if (r.auto && settings.mode === 'auto' && r.firstVoiced >= 0 && r.silentMs >= settings.silence * 1000) {
      finishRecording();
    } else if (dur >= (r.auto ? MAX_AUTO_S : MAX_MANUAL_S)) {
      if (r.auto && r.voicedMs / r.totalMs > 0.9) {
        // ずっと大きな音が続いている → 声ではなく雑音とみなして基準を上げる
        floorDb = clamp(r.sumDb / r.nChunks - 2, -95, -28);
        cancelRecording();
        toast('まわりの音が大きいようです。設定の「声への反応」を、にぶい方へ動かしてください。', { duration: 5000 });
        enterResting();
      } else {
        finishRecording();
      }
    }
  }

  function cancelRecording() {
    if (!rec) return;
    rec.utter.discarded = true;
    rec = null;
    srWant(false);
  }

  function finishRecording() {
    const r = rec;
    if (!r) return;
    rec = null;
    srEndUtterance();
    settleUtterLater(r.utter);

    if (r.auto && r.voicedMs < MIN_VOICED_MS) {
      r.utter.discarded = true;
      enterResting();
      return;
    }
    if (r.len < engine.rate * 0.15) {
      r.utter.discarded = true;
      toast('短すぎたので、もう一度どうぞ');
      enterResting();
      return;
    }

    let s = 0;
    let e = r.len;
    if (r.firstVoiced >= 0) {
      s = Math.max(0, r.firstVoiced - Math.round(LEAD_PAD_S * engine.rate));
      e = Math.min(r.len, r.lastVoiced + Math.round(TAIL_PAD_S * engine.rate));
    }
    const samples = flatten(r.chunks, s, e);
    const { blob, duration } = makeWav(samples, engine.rate);

    const clip = {
      id: uid(),
      blob,
      url: URL.createObjectURL(blob),
      duration,
      createdAt: Date.now(),
      target: r.target,
      utter: r.utter,
      savedId: null,
    };
    r.utter.clip = clip;
    addSessionClip(clip);
    playClip(clip, { auto: true });
  }

  function flatten(chunks, s, e) {
    const out = new Float32Array(Math.max(0, e - s));
    let pos = 0;
    let o = 0;
    for (const c of chunks) {
      const cs = pos;
      const ce = pos + c.length;
      pos = ce;
      if (ce <= s) continue;
      if (cs >= e) break;
      const a = Math.max(s, cs) - cs;
      const b = Math.min(e, ce) - cs;
      out.set(c.subarray(a, b), o);
      o += b - a;
    }
    return out;
  }

  // ============================================================
  // WAV 作成（聞きやすい音量にそろえ、端のプチッという音を消す）
  // ============================================================
  function makeWav(input, rate) {
    let samples;
    let sr = rate;
    if (rate >= 44100) {
      // 半分のサンプルレートにして容量を節約（音声には十分）
      const n = Math.floor(input.length / 2);
      samples = new Float32Array(n);
      for (let i = 0; i < n; i++) samples[i] = (input[2 * i] + input[2 * i + 1]) * 0.5;
      sr = rate / 2;
    } else {
      samples = new Float32Array(input);
    }

    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const gain = peak > 0 ? Math.min(0.89 / peak, 4) : 1;
    const fade = Math.min(Math.round(sr * 0.012), Math.floor(samples.length / 2));
    for (let i = 0; i < samples.length; i++) {
      let g = gain;
      if (i < fade) g *= i / fade;
      else if (i >= samples.length - fade) g *= (samples.length - 1 - i) / fade;
      samples[i] *= g;
    }
    return { blob: encodeWav(samples, sr), duration: samples.length / sr };
  }

  function encodeWav(samples, sr) {
    const buf = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(buf);
    const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    str(0, 'RIFF');
    v.setUint32(4, 36 + samples.length * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, samples.length * 2, true);
    let o = 44;
    for (let i = 0; i < samples.length; i++, o += 2) {
      const x = clamp(samples[i], -1, 1);
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  // ============================================================
  // 再生
  // ============================================================
  const player = new Audio();
  player.preload = 'auto';
  setPreservePitch(player);
  let silentUrl = null;
  let playToken = 0;
  let stopCurrent = null;

  function setPreservePitch(a) {
    a.preservesPitch = true;
    a.mozPreservesPitch = true;
    a.webkitPreservesPitch = true;
  }

  function unlockPlayer() {
    try {
      if (!silentUrl) silentUrl = URL.createObjectURL(encodeWav(new Float32Array(240), 24000));
      player.src = silentUrl;
      const p = player.play();
      if (p) p.then(() => { if (player.src === silentUrl) player.pause(); }).catch(() => {});
    } catch (_) { /* noop */ }
  }

  function unlockTTS() {
    if (!hasTTS) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (_) { /* noop */ }
  }

  function playUrl(url, rate) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        player.onended = null;
        player.onerror = null;
        stopCurrent = null;
        playingAudio = false;
        resolve();
      };
      stopCurrent = () => { player.pause(); finish(); };
      player.onended = finish;
      player.onerror = finish;
      player.defaultPlaybackRate = rate;
      player.src = url;
      player.playbackRate = rate;
      setPreservePitch(player);
      playingAudio = true;
      const p = player.play();
      if (p) p.catch((err) => { console.warn(err); finish(); });
    });
  }

  let currentUtterance = null; // Chrome で onend が消えないよう参照を保持
  function speak(text) {
    return new Promise((resolve) => {
      if (!hasTTS || !text) { resolve(); return; }
      let done = false;
      let timer = 0;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        stopCurrent = null;
        currentUtterance = null;
        resolve();
      };
      stopCurrent = () => { speechSynthesis.cancel(); finish(); };
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = settings.lang;
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = settings.rate;
      u.onend = finish;
      u.onerror = finish;
      currentUtterance = u;
      speechSynthesis.speak(u);
      // まれに onend が来ないブラウザがあるための保険
      timer = setTimeout(finish, 4000 + (text.length * 150) / settings.rate);
    });
  }

  // 再生系はすべてここを通す（再生中は声の検知を止める）
  async function runPlayback(steps, key) {
    const token = ++playToken;
    if (stopCurrent) stopCurrent();
    if (state === 'recording') cancelRecording();
    srWant(false);
    playingKey = key || null;
    setState('playing');
    renderPlayingMarks();
    for (const step of steps) {
      if (token !== playToken) return;
      await step();
    }
    if (token !== playToken) return;
    playingKey = null;
    renderPlayingMarks();
    enterResting();
  }

  function stopPlayback() {
    playToken++;
    if (stopCurrent) stopCurrent();
    if (hasTTS && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    playingKey = null;
    playingAudio = false;
    renderPlayingMarks();
  }

  function clipModelText(clip) {
    return clip.target || utterText(clip.utter);
  }

  function playClip(clip, { auto = false, voiceOnly = false } = {}) {
    const steps = [];
    const times = auto ? settings.repeat : 1;
    for (let i = 0; i < times; i++) {
      if (i > 0) steps.push(() => sleep(300));
      steps.push(() => playUrl(clip.url, settings.rate));
    }
    if (!voiceOnly && auto && settings.model && hasTTS) {
      steps.push(async () => {
        const text = clip.target || await waitForText(clip.utter, 2500);
        if (text) {
          await sleep(250);
          await speak(text);
        }
      });
    }
    runPlayback(steps, 's:' + clip.id);
  }

  function playModel(text, key) {
    if (!text) return;
    runPlayback([() => speak(text)], key ? key + ':m' : 'model');
  }

  async function waitForText(utter, maxMs) {
    const t0 = performance.now();
    while (utter.pending && !utterText(utter) && performance.now() - t0 < maxMs) await sleep(100);
    return utterText(utter);
  }

  // 再生や録音が終わったあとの「待機状態」に戻す
  function enterResting() {
    if (!engine.ctx) { setState('off'); return; }
    if (settings.mode === 'auto') {
      if (autoPaused) {
        setState('paused');
      } else {
        preRoll = [];
        preRollLen = 0;
        aboveCount = 0;
        ignoreUntil = performance.now() + COOLDOWN_MS;
        listenSince = performance.now();
        setState('listening');
        srListen();
      }
    } else {
      setState('idle');
    }
  }

  // ============================================================
  // 文字起こし（Web Speech API）
  // ============================================================
  const sr = {
    inst: null,
    active: false,
    stopping: false,
    want: false,
    owners: [],
    current: null,
    flushOwner: null,
    orphanAt: 0,
    broken: '',
    offline: false,
    starts: [],
  };

  function newUtter() {
    return {
      committed: '',
      live: '',
      pending: srUsable(),
      offline: sr.offline,
      discarded: false,
      clip: null,
    };
  }

  // 認識が動いていない・結果が来ないときに「聞き取っています…」のままにしない
  function settleUtterLater(u) {
    if (!u.pending) return;
    if (!sr.active) { u.pending = false; return; }
    setTimeout(() => {
      if (u.pending) { u.pending = false; onUtterUpdate(u); }
    }, 8000);
  }

  function utterText(u) { return tidyText(`${u.committed} ${u.live}`); }

  function srUsable() { return !!SR && settings.transcribe && !sr.broken && !sr.offline; }

  function srListen() {
    // 自動モードの声待ち中も認識を動かしておく（話し始めを取りこぼさないため）
    sr.current = null;
    srWant(true);
  }

  function srBeginUtterance(utter) {
    sr.current = utter;
    // 録音開始の直前に聞き取られた結果は、この発話のものとして引き取る
    if (sr.orphanAt && performance.now() - sr.orphanAt < 1500) {
      for (let i = 0; i < sr.owners.length; i++) if (sr.owners[i] === null) sr.owners[i] = utter;
    }
    sr.orphanAt = 0;
    srWant(true);
  }

  function srEndUtterance() {
    srWant(false);
  }

  function srWant(v) {
    sr.want = v && srUsable();
    if (sr.want) {
      if (!sr.active) srStart();
    } else if (sr.active && !sr.stopping) {
      sr.stopping = true;
      sr.flushOwner = sr.current;
      try { sr.inst.stop(); } catch (_) { /* noop */ }
    }
  }

  function srStart() {
    if (!srUsable() || sr.active) return;
    const now = performance.now();
    sr.starts = sr.starts.filter((t) => now - t < 5000);
    if (sr.starts.length >= 6) {
      srBreak('文字起こしが安定しないため、いったんオフにしました。ページを再読み込みすると再開できます。');
      return;
    }
    sr.starts.push(now);
    if (!sr.inst) sr.inst = createRecognizer();
    sr.inst.lang = settings.lang;
    sr.owners = [];
    try {
      sr.inst.start();
      sr.active = true;
      sr.stopping = false;
    } catch (err) {
      console.warn('recognition start failed', err);
    }
  }

  function createRecognizer() {
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      const touched = new Set();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (sr.owners[i] === undefined) {
          sr.owners[i] = sr.stopping ? sr.flushOwner : sr.current;
          if (!sr.owners[i]) sr.orphanAt = performance.now();
        }
      }
      for (let i = 0; i < e.results.length; i++) if (sr.owners[i]) touched.add(sr.owners[i]);
      for (const u of touched) {
        let text = '';
        for (let i = 0; i < e.results.length; i++) {
          if (sr.owners[i] === u) text += ' ' + e.results[i][0].transcript;
        }
        u.live = text;
        onUtterUpdate(u);
      }
    };

    r.onerror = (e) => {
      const code = e.error;
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        srBreak('文字起こしが許可されていません。ブラウザの設定で音声認識を許可すると使えます。');
      } else if (code === 'network') {
        if (!navigator.onLine) srGoOffline();
        else srBreak('文字起こしのサービスに接続できませんでした。インターネット接続を確認してください（録音と再生はそのまま使えます）。');
      } else if (code === 'language-not-supported') {
        srBreak('この英語の種類は文字起こしに対応していません。設定の「英語の種類」を変えてください。');
      } else if (code === 'audio-capture') {
        srBreak('文字起こしにマイクを使えませんでした。録音と再生はそのまま使えます。');
      } else {
        console.warn('recognition error', code);
      }
    };

    r.onend = () => {
      sr.active = false;
      sr.stopping = false;
      const owners = new Set(sr.owners.filter(Boolean));
      for (const u of owners) {
        u.committed = `${u.committed} ${u.live}`;
        u.live = '';
      }
      sr.owners = [];
      // 止めた時点の発話は、これで聞き取りが終わり
      if (sr.flushOwner) {
        sr.flushOwner.pending = false;
        onUtterUpdate(sr.flushOwner);
      }
      sr.flushOwner = null;
      for (const u of owners) onUtterUpdate(u);
      if (sr.want && srUsable()) setTimeout(() => { if (sr.want && !sr.active) srStart(); }, 60);
    };
    return r;
  }

  function srBreak(msg) {
    sr.broken = msg;
    sr.want = false;
    if (sr.inst && sr.active) { try { sr.inst.abort(); } catch (_) { /* noop */ } }
    for (const c of session) {
      if (c.utter.pending) { c.utter.pending = false; onUtterUpdate(c.utter); }
    }
    if (rec) rec.utter.pending = false;
    renderSettings();
    renderPractice();
    toast('文字起こしをオフにしました');
  }

  // オフラインの間だけ止める（つながったら自動で戻す）
  function srGoOffline() {
    sr.offline = true;
    sr.want = false;
    if (sr.inst && sr.active) { try { sr.inst.abort(); } catch (_) { /* noop */ } }
    for (const c of session) {
      if (c.utter.pending) {
        c.utter.pending = false;
        c.utter.offline = true;
        onUtterUpdate(c.utter);
      }
    }
    if (rec) { rec.utter.pending = false; rec.utter.offline = true; }
    renderSettings();
    renderPractice();
  }

  function renderOnline() {
    el.offlineNotice.hidden = navigator.onLine;
  }

  window.addEventListener('offline', () => {
    renderOnline();
    toast('オフラインになりました。録音と再生はそのまま使えます');
  });

  window.addEventListener('online', () => {
    renderOnline();
    if (sr.offline) {
      sr.offline = false;
      renderSettings();
      renderPractice();
      if (state === 'listening') srListen();
      else if (state === 'recording' && rec) {
        rec.utter.offline = false;
        rec.utter.pending = true;
        srBeginUtterance(rec.utter);
      }
    }
    toast('オンラインに戻りました');
  });

  function srRestart() {
    // 言語を変えたときに作り直す
    if (sr.inst && sr.active) {
      try { sr.inst.abort(); } catch (_) { /* noop */ }
    }
  }

  function onUtterUpdate(u) {
    if (u.discarded || !u.clip) return;
    const clip = u.clip;
    if (clip === lastClip) renderPractice();
    renderSessionRow(clip);
    if (clip.savedId && !u.pending) {
      const item = saved.find((s) => s.id === clip.savedId);
      const text = utterText(u);
      if (item && item.text !== text) {
        item.text = text;
        db.put(item).catch(() => {});
        renderSaved();
      }
    }
  }

  function setTranscribe(on) {
    settings.transcribe = on && !!SR;
    saveSettings();
    renderSettings();
    if (settings.transcribe) {
      if (state === 'listening') srListen();
      else if (state === 'recording' && rec) srBeginUtterance(rec.utter);
    } else {
      srWant(false);
    }
    renderPractice();
    renderSession();
  }

  // ============================================================
  // お手本の声
  // ============================================================
  let voices = [];

  function loadVoices() {
    if (!hasTTS) return;
    voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    renderVoices();
  }

  function normLang(l) { return (l || '').replace('_', '-').toLowerCase(); }

  function pickVoice() {
    const offline = !navigator.onLine;
    if (settings.voice) {
      const v = voices.find((x) => x.voiceURI === settings.voice);
      // オフラインでは、ネット経由の声は使えないので端末内の声に切り替える
      if (v && (!offline || v.localService)) return v;
    }
    const lang = normLang(settings.lang);
    const usable = offline ? voices.filter((v) => v.localService) : voices;
    const cands = usable.filter((v) => normLang(v.lang) === lang);
    const pool = cands.length ? cands : usable;
    let best = null;
    let bestScore = -1;
    for (const v of pool) {
      let s = 0;
      if (/natural|neural/i.test(v.name)) s += 4;
      if (/premium|enhanced/i.test(v.name)) s += 3;
      if (/google/i.test(v.name)) s += 2;
      if (/samantha|daniel|karen|aria|jenny|guy/i.test(v.name)) s += 1;
      if (v.default) s += 0.5;
      if (s > bestScore) { best = v; bestScore = s; }
    }
    return best;
  }

  function renderVoices() {
    const sel = el.voice;
    const lang = normLang(settings.lang);
    const sorted = [...voices].sort((a, b) => {
      const am = normLang(a.lang) === lang ? 0 : 1;
      const bm = normLang(b.lang) === lang ? 0 : 1;
      return am - bm || a.name.localeCompare(b.name);
    });
    sel.innerHTML = '';
    sel.append(new Option('おまかせ', ''));
    for (const v of sorted) sel.append(new Option(`${v.name}（${v.lang}）`, v.voiceURI));
    sel.value = voices.some((v) => v.voiceURI === settings.voice) ? settings.voice : '';
    sel.disabled = !hasTTS;
  }

  // ============================================================
  // 保存（IndexedDB）
  // ============================================================
  const db = (() => {
    let opening = null;
    function open() {
      if (opening) return opening;
      opening = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
        const req = indexedDB.open('kodama', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('clips', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      opening.catch(() => { opening = null; });
      return opening;
    }
    async function tx(mode, fn) {
      const d = await open();
      return new Promise((resolve, reject) => {
        const t = d.transaction('clips', mode);
        const req = fn(t.objectStore('clips'));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      });
    }
    return {
      all: () => tx('readonly', (s) => s.getAll()),
      put: (v) => tx('readwrite', (s) => s.put(v)),
      del: (id) => tx('readwrite', (s) => s.delete(id)),
    };
  })();

  let persistAsked = false;

  async function saveClip(clip) {
    if (!clip || clip.savedId) return;
    const item = {
      id: uid(),
      createdAt: clip.createdAt,
      duration: clip.duration,
      text: utterText(clip.utter),
      target: clip.target || '',
      type: 'audio/wav',
      data: await clip.blob.arrayBuffer(),
    };
    try {
      await db.put(item);
    } catch (err) {
      console.warn(err);
      // 保存できないブラウザでは、ファイルとしてダウンロードする
      downloadBlob(clip.blob, fileName(clip.createdAt));
      toast('このブラウザでは保存できないため、ファイルとしてダウンロードしました', { duration: 4000 });
      return;
    }
    clip.savedId = item.id;
    saved.unshift(item);
    renderSaved();
    renderSessionRow(clip);
    if (clip === lastClip) renderPractice();
    toast('保存しました');
    if (!persistAsked && navigator.storage && navigator.storage.persist) {
      persistAsked = true;
      navigator.storage.persist().catch(() => {});
    }
  }

  // 削除はすぐ反映し、トーストの「元に戻す」で戻せるようにする
  async function deleteSaved(item) {
    try {
      await db.del(item.id);
    } catch (err) {
      console.warn(err);
      toast('削除できませんでした');
      return;
    }
    if (playingKey === 'v:' + item.id) { stopPlayback(); enterResting(); }
    saved = saved.filter((s) => s.id !== item.id);
    const url = savedUrls.get(item.id);
    if (url) { URL.revokeObjectURL(url); savedUrls.delete(item.id); }
    const unlinked = session.filter((c) => c.savedId === item.id);
    for (const c of unlinked) { c.savedId = null; renderSessionRow(c); }
    renderPractice();
    renderSaved();
    toast('削除しました', {
      action: '元に戻す',
      onAction: async () => {
        try { await db.put(item); } catch (_) { toast('元に戻せませんでした'); return; }
        saved.push(item);
        saved.sort((a, b) => b.createdAt - a.createdAt);
        for (const c of unlinked) { c.savedId = item.id; renderSessionRow(c); }
        renderPractice();
        renderSaved();
      },
    });
  }

  function savedUrl(item) {
    let url = savedUrls.get(item.id);
    if (!url) {
      url = URL.createObjectURL(new Blob([item.data], { type: item.type || 'audio/wav' }));
      savedUrls.set(item.id, url);
    }
    return url;
  }

  function fileName(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `kodama-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.wav`;
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ============================================================
  // 練習する英文（お題）
  // ============================================================
  let resumeAfterDialog = false;

  function openTargetDialog() {
    // ダイアログを見ている間は、自動の聞き取りを止めておく
    resumeAfterDialog = false;
    if (state === 'listening') {
      autoPaused = true;
      resumeAfterDialog = true;
      srWant(false);
      setState('paused');
    } else if (state === 'recording') {
      cancelRecording();
      enterResting();
    }
    el.targetInput.value = settings.target;
    renderRecent();
    el.dialog.showModal();
    if (!isMobile) {
      el.targetInput.focus();
      el.targetInput.select();
    }
  }

  function closeTargetDialog() {
    if (el.dialog.open) el.dialog.close();
  }

  el.dialog.addEventListener('close', () => {
    if (resumeAfterDialog && state === 'paused') {
      autoPaused = false;
      enterResting();
    }
    resumeAfterDialog = false;
  });

  function setTarget(text) {
    const t = tidyTarget(text);
    settings.target = t;
    if (t) {
      settings.recent = [t, ...settings.recent.filter((x) => x !== t)].slice(0, RECENT_MAX);
    }
    saveSettings();
    renderPractice();
  }

  function buildExampleButton(text) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.lang = 'en';
    b.textContent = text;
    b.addEventListener('click', () => {
      setTarget(text);
      closeTargetDialog();
    });
    li.append(b);
    return li;
  }

  function renderRecent() {
    const examples = new Set(EXAMPLES.flatMap((g) => g.items));
    const items = settings.recent.filter((t) => !examples.has(t));
    el.recentWrap.hidden = items.length === 0;
    el.recentList.replaceChildren(...items.map(buildExampleButton));
  }

  function renderExamples() {
    const frag = document.createDocumentFragment();
    for (const g of EXAMPLES) {
      const h = document.createElement('h3');
      h.textContent = g.title;
      if (g.note) {
        const n = document.createElement('span');
        n.className = 'h3-note';
        n.lang = 'en';
        n.textContent = g.note;
        h.append(n);
      }
      const ul = document.createElement('ul');
      ul.className = 'examples';
      ul.append(...g.items.map(buildExampleButton));
      frag.append(h, ul);
    }
    el.exampleGroups.replaceChildren(frag);
  }

  el.targetForm.addEventListener('submit', (e) => {
    const t = tidyTarget(el.targetInput.value);
    if (!t) {
      e.preventDefault();
      el.targetInput.focus();
      return;
    }
    setTarget(t);
  });

  el.targetInput.addEventListener('keydown', (e) => {
    // Enter で決定（Shift+Enter は改行）。日本語入力の変換中は除く
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      el.targetForm.requestSubmit();
    }
  });

  el.targetClose.addEventListener('click', closeTargetDialog);
  el.dialog.addEventListener('click', (e) => { if (e.target === el.dialog) closeTargetDialog(); });

  // ============================================================
  // 画面
  // ============================================================
  const STATUS = {
    off: ['タップしてはじめる', 'マイクを使います。イヤホンがあると、より聞き取りやすくなります。', 'はじめる'],
    starting: ['マイクを準備しています', 'マイクの使用を確認されたら「許可」を選んでください。', '準備中'],
    calibrating: ['まわりの音を確認しています', '少しだけ静かにお待ちください。', '一時停止'],
    listening: ['英語で話してください', '話し終わると、すぐにあなたの声が流れます。', '一時停止'],
    recordingAuto: ['聞いています', '話し終えて黙ると、自動で再生します。', '止めて再生'],
    recordingWait: ['聞いています', 'このまま黙っていると再生します。', '止めて再生'],
    recordingManual: ['録音中', 'もう一度タップすると、止めて再生します。', '止めて再生'],
    playing: ['再生中', 'タップすると再生を止めます。', '再生を止める'],
    paused: ['一時停止中', 'タップすると、また声を聞き取ります。', '再開'],
    idle: ['タップして録音', '話し終えたら、もう一度タップしてください。', '録音する'],
  };

  let statusKey = '';
  function setState(s) {
    state = s;
    el.orb.dataset.state = s;
    renderStatus();
    renderPracticeButtons();
    updateWakeLock();
  }

  function renderStatus() {
    let key = state;
    if (state === 'recording') {
      if (!rec || !rec.auto) key = 'recordingManual';
      else key = rec.silentMs > 220 ? 'recordingWait' : 'recordingAuto';
    } else if (state === 'listening' && performance.now() < calibrateUntil) {
      key = 'calibrating';
    }
    if (key === statusKey) return;
    statusKey = key;
    const [title, sub, label] = STATUS[key];
    el.status.textContent = title;
    el.sub.textContent = sub;
    el.orbLabel.textContent = label;
    el.steps.hidden = !(state === 'off' && session.length === 0);
  }

  function renderMode() {
    for (const b of el.modeBtns) b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode));
  }

  // 文字起こしの状態
  function heardState(clip) {
    const text = utterText(clip.utter);
    if (text) return { kind: 'text', text };
    if (!SR) return { kind: 'unsupported' };
    if (!settings.transcribe && !clip.utter.pending) return { kind: 'off' };
    if (sr.broken) return { kind: 'broken' };
    if ((sr.offline || clip.utter.offline) && !clip.utter.pending) return { kind: 'offline' };
    if (clip.utter.pending) return { kind: 'pending' };
    return { kind: 'empty' };
  }

  function fillMessage(node, msg, linkLabel, onLink) {
    node.replaceChildren(document.createTextNode(msg));
    if (linkLabel) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inline-link';
      b.textContent = linkLabel;
      b.addEventListener('click', onLink);
      node.append(b);
    }
  }

  function turnOnTranscribe() {
    setTranscribe(true);
    toast(isMobile ? 'オンにしました。声に反応しなくなったら、設定からオフにしてください' : '文字起こしをオンにしました', { duration: 4000 });
  }

  function renderPractice() {
    const target = settings.target;
    const clip = lastClip;
    const relevant = clip && (target ? clip.target === target : true);

    el.addTarget.hidden = !!target;
    el.targetBox.hidden = !target;
    // 発音したあとは結果を先に見せ、「英文を選ぶ」は下へ
    el.practice.classList.toggle('has-clip', !!clip);

    // 練習する英文（伝わらなかった単語に印）
    let cmp = null;
    if (target) {
      const hs = relevant ? heardState(clip) : null;
      if (hs && hs.kind === 'text') {
        cmp = compareWords(target, hs.text);
        if (cmp.total === 0) cmp = null;
      }
      const frag = document.createDocumentFragment();
      const words = cmp ? cmp.words : target.split(/\s+/).map((text) => ({ text, ok: true, counted: true }));
      words.forEach((w, i) => {
        if (i > 0) frag.append(' ');
        const span = document.createElement('span');
        span.className = 'w' + (cmp && w.counted && !w.ok ? ' miss' : '');
        span.textContent = w.text;
        frag.append(span);
      });
      el.targetText.replaceChildren(frag);
      el.targetText.classList.toggle('waiting', !!(hs && hs.kind === 'pending'));
    }

    // 聞き取られた英文
    const said = el.said;
    said.className = 'said';
    said.hidden = !relevant;
    el.score.hidden = true;
    el.score.className = 'score';
    if (relevant) {
      const hs = heardState(clip);
      if (target) {
        if (hs.kind === 'text' && cmp) {
          said.classList.add('heard');
          said.lang = 'en';
          const label = document.createElement('span');
          label.className = 'heard-label';
          label.lang = 'ja';
          label.textContent = '聞き取り';
          said.replaceChildren(label, document.createTextNode(hs.text));
          el.score.hidden = false;
          const full = cmp.ok === cmp.total;
          el.score.classList.toggle('full', full);
          const strong = document.createElement('strong');
          strong.textContent = full ? '全部伝わりました' : `${cmp.total}語中 ${cmp.ok}語が伝わりました`;
          el.score.replaceChildren(strong, document.createTextNode(full ? '' : '。印の単語を意識して、もう一度どうぞ'));
        } else {
          said.classList.add('placeholder');
          said.lang = 'ja';
          renderHeardMessage(said, hs, true);
        }
      } else if (hs.kind === 'text') {
        said.lang = 'en';
        said.textContent = hs.text;
      } else {
        said.classList.add('placeholder');
        said.lang = 'ja';
        renderHeardMessage(said, hs, false);
      }
    }

    el.actions.hidden = !clip && !target;
    renderPracticeButtons();
  }

  function renderHeardMessage(node, hs, withTarget) {
    switch (hs.kind) {
      case 'unsupported':
        fillMessage(node, withTarget
          ? 'このブラウザは文字起こしに未対応のため、伝わったかどうかは確認できません。お手本と聞き比べてみましょう。'
          : 'このブラウザは文字起こしに未対応です。声の再生はそのまま使えます。');
        break;
      case 'off':
        fillMessage(node, withTarget
          ? '文字起こしがオフです。オンにすると、どの単語が伝わったか確認できます。'
          : '文字起こしはオフです。', 'オンにする', turnOnTranscribe);
        break;
      case 'broken':
        fillMessage(node, '文字起こしは使えない状態です。声の再生はそのまま使えます。');
        break;
      case 'offline':
        fillMessage(node, withTarget
          ? 'オフラインのため、どの単語が伝わったかは確認できません。お手本と聞き比べてみましょう。'
          : 'オフラインのため、文字起こしはお休みしています。声の再生はそのまま使えます。');
        break;
      case 'pending':
        fillMessage(node, '聞き取っています…');
        break;
      default:
        fillMessage(node, 'うまく聞き取れませんでした。ゆっくり、はっきり言ってみましょう。');
    }
  }

  function renderPracticeButtons() {
    const clip = lastClip;
    el.replayBtn.disabled = !clip;
    el.modelBtn.disabled = !hasTTS || !currentModelText();
    const isSaved = !!(clip && clip.savedId);
    el.saveBtn.disabled = !clip || isSaved;
    el.saveBtn.classList.toggle('saved', isSaved);
    el.saveBtn.querySelector('span').textContent = isSaved ? '保存済み' : '保存';
  }

  function currentModelText() {
    if (settings.target) return settings.target;
    return lastClip ? utterText(lastClip.utter) : '';
  }

  function renderChips() {
    el.rateChip.textContent = `速さ ${settings.rate}倍`;
    el.rateChip.classList.toggle('changed', settings.rate !== 1);
    el.rateChip.setAttribute('aria-label', `再生の速さ ${settings.rate}倍。押すと変わります`);
    el.repeatChip.setAttribute('aria-pressed', String(settings.repeat === 2));
    el.modelChip.setAttribute('aria-pressed', String(settings.model && hasTTS));
    el.modelChip.disabled = !hasTTS;
    el.modelChip.title = '自分の声のあとに、お手本の発音も流します';
    el.repeatChip.title = '自分の声を2回続けて流します';
  }

  function addSessionClip(clip) {
    session.unshift(clip);
    while (session.length > SESSION_MAX) {
      const old = session.pop();
      URL.revokeObjectURL(old.url);
      if (old === lastClip) lastClip = null;
    }
    lastClip = clip;
    renderPractice();
    renderSession();
  }

  function rowText(text, placeholder) {
    const p = document.createElement('p');
    p.className = 'row-text';
    if (text) {
      p.textContent = text;
      p.lang = 'en';
    } else {
      p.textContent = placeholder;
      p.classList.add('placeholder');
    }
    return p;
  }

  function rowMeta(ts, dateFmt, duration, target, text) {
    const meta = document.createElement('p');
    meta.className = 'row-meta';
    const t = document.createElement('span');
    t.textContent = dateFmt(ts);
    const d = document.createElement('span');
    d.textContent = fmtDur(duration);
    meta.append(t, d);
    const c = target && text ? compareWords(target, text) : null;
    if (c && c.total > 0) {
      const b = document.createElement('span');
      b.className = 'badge' + (c.ok === c.total ? ' full' : '');
      b.textContent = `${c.ok}/${c.total}語`;
      b.title = `練習する英文: ${target}`;
      meta.append(b);
    }
    return meta;
  }

  function iconButton(icon, label, onClick, extraClass) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn' + (extraClass ? ' ' + extraClass : '');
    b.innerHTML = icon;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function playButton(key, label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'play-btn';
    b.dataset.key = key;
    b.dataset.label = label;
    b.innerHTML = ICON.play;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  }

  function clipPlaceholder(u) {
    if (u.pending) return '聞き取っています…';
    if (!SR || !settings.transcribe) return '文字起こしなし';
    if (sr.offline || u.offline) return '文字起こしなし（オフライン）';
    return '聞き取れませんでした';
  }

  function buildSessionRow(clip) {
    const li = document.createElement('li');
    li.className = 'row';
    li.dataset.id = clip.id;
    const key = 's:' + clip.id;
    li.append(playButton(key, '自分の声を再生', () => togglePlay(key, () => playClip(clip, { voiceOnly: true }))));

    const body = document.createElement('div');
    body.className = 'row-body';
    li.append(body);

    const ops = document.createElement('div');
    ops.className = 'row-ops';
    const m = iconButton(ICON.model, 'お手本を聞く', () => playModel(clipModelText(clip), key));
    m.dataset.op = 'model';
    ops.append(m);
    const s = iconButton(ICON.save, '保存', () => saveClip(clip));
    s.dataset.op = 'save';
    ops.append(s);
    li.append(ops);
    syncSessionRow(li, clip);
    return li;
  }

  function syncSessionRow(li, clip) {
    const text = utterText(clip.utter);
    const body = li.querySelector('.row-body');
    body.replaceChildren(
      rowText(text, clipPlaceholder(clip.utter)),
      rowMeta(clip.createdAt, fmtTime, clip.duration, clip.target, text),
    );
    li.querySelector('[data-op="model"]').disabled = !hasTTS || !clipModelText(clip);
    const s = li.querySelector('[data-op="save"]');
    const isSaved = !!clip.savedId;
    s.disabled = isSaved;
    s.classList.toggle('saved', isSaved);
    s.setAttribute('aria-label', isSaved ? '保存済み' : '保存');
    s.title = isSaved ? '保存済み' : '保存';
  }

  function renderSession() {
    el.sessionList.replaceChildren(...session.map(buildSessionRow));
    el.sessionEmpty.hidden = session.length > 0;
    renderPlayingMarks();
  }

  // 文字起こしの途中経過で行ごと作り直すとフォーカスが外れるので、中身だけ更新する
  function renderSessionRow(clip) {
    const li = el.sessionList.querySelector(`[data-id="${clip.id}"]`);
    if (li) syncSessionRow(li, clip);
  }

  function buildSavedRow(item) {
    const li = document.createElement('li');
    li.className = 'row';
    const key = 'v:' + item.id;
    li.append(playButton(key, '保存した声を再生', () => togglePlay(key, () => {
      const url = savedUrl(item);
      runPlayback([() => playUrl(url, settings.rate)], key);
    })));

    const body = document.createElement('div');
    body.className = 'row-body';
    // 聞き取りがなければ、練習していた英文を出す
    body.append(
      rowText(item.text || item.target, '文字起こしなし'),
      rowMeta(item.createdAt, fmtDate, item.duration, item.target, item.text),
    );
    li.append(body);

    const ops = document.createElement('div');
    ops.className = 'row-ops';
    const modelText = item.target || item.text;
    const m = iconButton(ICON.model, 'お手本を聞く', () => playModel(modelText, key));
    m.disabled = !hasTTS || !modelText;
    ops.append(m);
    ops.append(iconButton(ICON.download, 'ダウンロード', () => {
      downloadBlob(new Blob([item.data], { type: item.type || 'audio/wav' }), fileName(item.createdAt));
    }));
    ops.append(iconButton(ICON.trash, '削除', () => deleteSaved(item)));
    li.append(ops);
    return li;
  }

  function renderSaved() {
    el.savedList.replaceChildren(...saved.map(buildSavedRow));
    el.savedEmpty.hidden = saved.length > 0;
    renderPlayingMarks();
  }

  function togglePlay(key, play) {
    if (state === 'playing' && playingKey === key) {
      stopPlayback();
      enterResting();
    } else {
      play();
    }
  }

  function renderPlayingMarks() {
    for (const b of document.querySelectorAll('.play-btn')) {
      const on = state === 'playing' && playingKey === b.dataset.key;
      if (b.classList.contains('is-playing') === on) continue;
      b.classList.toggle('is-playing', on);
      b.innerHTML = on ? ICON.stop : ICON.play;
      b.setAttribute('aria-label', on ? '停止' : b.dataset.label);
    }
  }

  function renderSettings() {
    el.sens.value = settings.sens;
    el.silence.value = settings.silence;
    el.silenceOut.textContent = `${Number(settings.silence).toFixed(1)} 秒`;
    el.lang.value = settings.lang;

    el.transcribe.checked = settings.transcribe && !!SR;
    el.transcribe.disabled = !SR;
    if (!SR) {
      el.transcribeHelp.textContent = 'このブラウザは文字起こしに対応していません。Chrome、Edge、Safari で使えます。';
    } else if (sr.broken) {
      el.transcribeHelp.textContent = sr.broken;
    } else if (sr.offline) {
      el.transcribeHelp.textContent = 'オフラインのため、いまは使えません。インターネットにつながると自動で戻ります。';
    } else if (isMobile) {
      el.transcribeHelp.textContent = '聞き取られた英文が表示され、練習する英文のどの単語が伝わったか確認できます。スマホでは録音とマイクを取り合って、声に反応しなくなることがあります。その場合はオフにしてください。';
    } else {
      el.transcribeHelp.textContent = '聞き取られた英文が表示され、練習する英文のどの単語が伝わったか確認できます。音声はブラウザの音声認識サービスに送られます。';
    }
  }

  // ============================================================
  // 画面をつけたままにする（ハンズフリー練習中にスマホが暗くならないように）
  // ============================================================
  let wakeLock = null;
  let wakeBusy = false;
  let wakeDirty = false;
  async function updateWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (wakeBusy) { wakeDirty = true; return; }
    const want = !!engine.ctx && document.visibilityState === 'visible' &&
      state !== 'paused' && state !== 'off';
    wakeBusy = true;
    try {
      if (want && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!want && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (_) { /* 拒否されても練習はできる */ }
    wakeBusy = false;
    if (wakeDirty) { wakeDirty = false; updateWakeLock(); }
  }

  // ============================================================
  // メーターと進み具合
  // ============================================================
  let smoothLv = 0;
  let meterRunning = false;
  let ringShown = false;
  function meterLoop() {
    if (!engine.ctx) {
      meterRunning = false;
      smoothLv = 0;
      el.orb.style.setProperty('--lv', '0');
      setRing(0);
      return;
    }
    const live = state === 'listening' || state === 'recording' || state === 'idle';
    const norm = live ? clamp((levelDb + 70) / 55, 0, 1) : 0;
    smoothLv += (norm - smoothLv) * (norm > smoothLv ? 0.5 : 0.15);
    el.orb.style.setProperty('--lv', smoothLv.toFixed(3));

    // 録音中: 黙ってから再生までの残り / 再生中: 進み具合
    let p = 0;
    if (state === 'recording' && rec && rec.auto && rec.silentMs > 150) {
      p = clamp(rec.silentMs / (settings.silence * 1000), 0, 1);
    } else if (state === 'playing' && playingAudio && player.duration > 0 && isFinite(player.duration)) {
      p = clamp(player.currentTime / player.duration, 0, 1);
    }
    setRing(p);
    if (state === 'recording' || state === 'listening') renderStatus();

    if (el.settings.open) {
      const raw = state === 'playing' ? 0 : clamp((levelDb + 80) / 70, 0, 1);
      el.meterFill.style.width = `${(raw * 100).toFixed(1)}%`;
      const th = clamp((thresholds().start + 80) / 70, 0, 1);
      el.meterTh.style.left = `${(th * 100).toFixed(1)}%`;
    }
    requestAnimationFrame(meterLoop);
  }

  function setRing(p) {
    const show = p > 0.001;
    if (show !== ringShown) {
      ringShown = show;
      el.ring.classList.toggle('show', show);
    }
    if (show) el.ringArc.style.strokeDashoffset = String(100 - p * 100);
  }

  // ============================================================
  // 操作
  // ============================================================
  function orbAction() {
    if (engine.ctx && engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => {});
    switch (state) {
      case 'off': start(); break;
      case 'starting': break;
      case 'listening':
        autoPaused = true;
        srWant(false);
        setState('paused');
        break;
      case 'paused':
        autoPaused = false;
        enterResting();
        break;
      case 'recording': finishRecording(); break;
      case 'playing':
        stopPlayback();
        enterResting();
        break;
      case 'idle': startRecording(false); break;
      default: break;
    }
  }

  function setMode(mode) {
    if (settings.mode === mode) return;
    settings.mode = mode;
    saveSettings();
    renderMode();
    if (!engine.ctx) return;
    if (state === 'recording') cancelRecording();
    if (state === 'playing') stopPlayback();
    autoPaused = false;
    srWant(false);
    enterResting();
  }

  el.orb.addEventListener('click', orbAction);
  for (const b of el.modeBtns) b.addEventListener('click', () => setMode(b.dataset.mode));

  // ラジオグループとして矢印キーでも切り替えられるように
  el.modeBtns.forEach((b, i) => {
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = el.modeBtns[(i + (e.key === 'ArrowRight' ? 1 : el.modeBtns.length - 1)) % el.modeBtns.length];
      next.focus();
      setMode(next.dataset.mode);
    });
  });

  function replayLast() { if (lastClip) playClip(lastClip, { voiceOnly: true }); }
  function playCurrentModel() {
    const text = currentModelText();
    if (text) playModel(text, lastClip && !settings.target ? 's:' + lastClip.id : 'target');
  }

  el.replayBtn.addEventListener('click', replayLast);
  el.modelBtn.addEventListener('click', playCurrentModel);
  el.saveBtn.addEventListener('click', () => saveClip(lastClip));

  el.addTarget.addEventListener('click', openTargetDialog);
  el.changeTarget.addEventListener('click', openTargetDialog);
  el.clearTarget.addEventListener('click', () => setTarget(''));

  el.rateChip.addEventListener('click', () => {
    settings.rate = RATES[(RATES.indexOf(settings.rate) + 1) % RATES.length];
    saveSettings();
    renderChips();
  });
  el.repeatChip.addEventListener('click', () => {
    settings.repeat = settings.repeat === 2 ? 1 : 2;
    saveSettings();
    renderChips();
  });
  el.modelChip.addEventListener('click', () => {
    settings.model = !settings.model;
    saveSettings();
    renderChips();
  });

  el.sens.addEventListener('input', () => { settings.sens = Number(el.sens.value); saveSettings(); });
  el.silence.addEventListener('input', () => {
    settings.silence = Number(el.silence.value);
    el.silenceOut.textContent = `${settings.silence.toFixed(1)} 秒`;
    saveSettings();
  });
  el.transcribe.addEventListener('change', () => setTranscribe(el.transcribe.checked));
  el.lang.addEventListener('change', () => {
    settings.lang = el.lang.value;
    saveSettings();
    renderVoices();
    srRestart();
  });
  el.voice.addEventListener('change', () => { settings.voice = el.voice.value; saveSettings(); });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || el.dialog.open) return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const onButton = tag === 'BUTTON' || tag === 'SUMMARY';
    if (e.code === 'Space' && !onButton) {
      e.preventDefault();
      orbAction();
    } else if (e.key === 'r' || e.key === 'R') {
      replayLast();
    } else if (e.key === 'm' || e.key === 'M') {
      playCurrentModel();
    } else if (e.key === 's' || e.key === 'S') {
      if (lastClip) saveClip(lastClip);
    }
  });

  // 別のタブやアプリに移ったら自動の聞き取りを止める（知らないうちに録音しないように）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pauseForInterruption();
    updateWakeLock();
  });

  // ============================================================
  // 起動
  // ============================================================
  el.inAppNotice.hidden = !inAppBrowser;
  renderOnline();

  // オフラインでも開けるようにする
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('service worker', err));
    });
  }
  renderMode();
  renderChips();
  renderSettings();
  renderExamples();
  renderPractice();
  renderSession();
  setState('off');

  if (hasTTS) {
    loadVoices();
    if ('onvoiceschanged' in speechSynthesis) speechSynthesis.addEventListener('voiceschanged', loadVoices);
  } else {
    renderVoices();
  }

  db.all()
    .then((items) => {
      saved = (items || []).sort((a, b) => b.createdAt - a.createdAt);
      renderSaved();
    })
    .catch(() => {
      el.savedEmpty.textContent = 'このブラウザでは保存できません。「保存」を押すと、ファイルとしてダウンロードします。';
      renderSaved();
    });
})();
