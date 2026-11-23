"""Speak Back（english-practice2.html）の仕組みを、Mimic 用の mimic/mimic.js に写すスクリプト。

使い方（リポジトリのどこからでも）:
    python3 mimic/tools/sync_from_speakback.py

Speak Back に機能が増えたら、これを実行して mimic.js を作り直す。
アプリ版の差し込み口と、録音・再生まわりの直し（マイクの案内、マイクを放す、iOS の音の起動など）もここで入れている。
これらの直しは Speak Back 本体にはまだ入っていないので、Speak Back 側に入れたら、ここの置き換えは外してよい。
置き換え先が見つからないと止まるので、そのときはこのファイルの置き換えを Speak Back に合わせて直す。
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
src_path = ROOT / 'english-practice2.html'
out_path = ROOT / 'mimic' / 'mimic.js'

html = src_path.read_text(encoding='utf-8')
start = html.rfind('<script>')
end = html.rfind('</script>')
assert start >= 0 and end > start, 'Speak Back の <script> が見つかりません'
s = html[start + len('<script>'):end].lstrip('\n')
assert s.startswith('const $ = id'), 'Speak Back の script の先頭が想定と違います'

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f'置き換え先が {n} 箇所見つかりました（{count} 箇所のはず）:\n{old[:200]}')
    s = s.replace(old, new)

# --- 保存先を Speak Back と分ける ---
rep("indexedDB.open('speakback',3)", "indexedDB.open('mimic',3)")
rep("'speakback-last'", "'mimic-last'", 3)

# --- プロジェクト一覧の開閉（文字を書き換えず、状態だけ持たせる）---
rep("""  p.style.display=open?'block':'none'; $('projListBtn').textContent=open?'一覧 ▴':'一覧 ▾';
  if(open) renderProjList();
};""", """  p.style.display=open?'block':'none'; $('projListBtn').setAttribute('aria-expanded',String(open)); document.body.classList.toggle('proj-open',open);
  if(open) renderProjList();
};
// 一覧を重ねて表示するデザインでは、開いたら閉じる
function closeProjIfOverlay(){ if(document.body.dataset.projOverlay && $('projPanel').style.display==='block') $('projListBtn').click(); }
document.querySelectorAll('[data-close-proj]').forEach(b=>b.addEventListener('click',()=>{ if($('projPanel').style.display==='block') $('projListBtn').click(); }));""")
rep("""$('projNewBtn').onclick=async()=>{ await openProject(blankProject()); toast('新しいプロジェクトを作りました'); $('projName').focus(); $('projName').select(); };""",
    """$('projNewBtn').onclick=async()=>{ await openProject(blankProject()); closeProjIfOverlay(); toast('新しいプロジェクトを作りました'); $('projName').focus(); $('projName').select(); };""")

# --- プロジェクト一覧の行 ---
rep("""  if(!list.length){ ul.innerHTML='<li class="muted">""", """  if(!list.length){ ul.innerHTML='<li class="muted empty-li">""")
rep("""    const tInfo=tr.length?'🎧 '+tr.length+' 音源（'+esc(tr.slice(0,3).map(t=>t.name).join('、'))+(tr.length>3?' ほか':'')+'）':'音源なし';""",
    """    const tInfo=tr.length?'音源 '+tr.length+'（'+esc(tr.slice(0,3).map(t=>t.name).join('、'))+(tr.length>3?' ほか':'')+'）':'音源なし';""")
rep("""    li.innerHTML=`<div class="pinfo"><div class="pname">${esc(p.name)}${p.id===cur.id?'（開いています）':''}</div>
      <div class="pmeta">${tInfo} ・ 印 ${tr.reduce((s,t)=>s+t.markers.length,0)} ・ 録音 ${n} ・ ${new Date(p.updated).toLocaleString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div>
      <button class="small primary">開く</button><button class="small">書き出し</button><button class="small">複製</button><button class="small danger">削除</button>`;""",
    """    li.innerHTML=`<div class="pinfo"><div class="pname">${esc(p.name)}${p.id===cur.id?'<span class="pcur">開いています</span>':''}</div>
      <div class="pmeta"><span>${tInfo}</span><span>印 ${tr.reduce((s,t)=>s+t.markers.length,0)}</span><span>録音 ${n}</span><span>${new Date(p.updated).toLocaleString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div></div>
      <div class="pacts"><button class="small primary">開く</button><button class="small">${ic('export')}<span>書き出し</span></button><button class="small">${ic('copy')}<span>複製</span></button><button class="small danger">${ic('trash')}<span>削除</span></button></div>`;""")
rep("""    bOpen.onclick=async()=>{ await openProject(await dbGet('projects',p.id)); toast('「'+p.name+'」を開きました'); };""",
    """    bOpen.onclick=async()=>{ await openProject(await dbGet('projects',p.id)); closeProjIfOverlay(); toast('「'+p.name+'」を開きました'); };""")

# --- 書き出し・読み込み（形式は Speak Back と共通）---
rep("""+'.speakback.json';""", """+'.mimic.json';""")
rep("""'Speak Back で書き出したプロジェクトファイル（.speakback.json）を選んでください。'""",
    """'Speak Back または Mimic で書き出したプロジェクトファイル（.speakback.json / .mimic.json）を選んでください。'""")

# --- 録音の表示 ---
rep("""$('status').innerHTML='● 録音中 <span id="timer">'""", """$('status').innerHTML='<span class="rec-dot"></span>録音中 <span id="timer">'""")
rep("""$('status').textContent='▶ 再生中…'""", """$('status').textContent='再生中…'""")

# --- 保存した録音の行 ---
rep("""      (ti>=0?`<span class="ptag" style="background:${tint(colorOf(ti)[0],.16)}">🎧 ${esc(baseName(cur.tracks[ti].name))}</span>`:'')+
      `<input class="nm"><audio controls src="${url}"></audio><a download title="ファイルとしてダウンロード" style="text-decoration:none">⬇</a><button class="x" title="削除">✕</button>`;""",
    """      (ti>=0?`<span class="ptag" style="background:${tint(colorOf(ti)[0],.16)}">${ic('track')}${esc(baseName(cur.tracks[ti].name))}</span>`:'')+
      `<input class="nm" aria-label="録音の名前"><audio controls src="${url}"></audio><a download class="dl" title="ファイルとしてダウンロード" aria-label="ダウンロード">${ic('download')}</a><button class="x" title="削除" aria-label="削除">${ic('x')}</button>`;""")

# --- 色はデザインごとに CSS から読む ---
rep("""const PAL=[""", """let PAL=[""")
rep("""const tint = (hex,a) => 'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+a+')';""",
    """const tint = (hex,a) => 'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+a+')';
const TH={};
function readTheme(){
  const cs=getComputedStyle(document.documentElement), v=(n,d)=>cs.getPropertyValue(n).trim()||d;
  Object.assign(TH,{empty:v('--wave-empty','#b9c7c1'), gap:v('--wave-gap','#faf8f3'), divider:v('--wave-divider','rgba(31,35,40,.45)'),
    mark:v('--wave-mark','#e8a317'), markSel:v('--wave-mark-sel','#c47f00'), markNum:v('--wave-mark-num','#fff'),
    markText:v('--wave-mark-text','#6b5a2e'), markTextSel:v('--wave-mark-text-sel','#8a5900'),
    loop:v('--wave-loop','rgba(232,163,23,.13)'), head:v('--wave-head','#e0483e'), font:v('--wave-font','sans-serif')});
  const pal=[]; for(let i=1;i<=6;i++){ const p=v('--pal-'+i,'').split(/\\s+/).filter(Boolean); if(p.length===2) pal.push(p); }
  if(pal.length) PAL=pal;
}
readTheme();
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ readTheme(); renderTracks(); renderMarks(); renderSaved(); }); }catch(e){}""")
rep("""ctx2.fillStyle='rgba(232,163,23,.13)';""", """ctx2.fillStyle=TH.loop;""")
rep("""}else{ ctx2.fillStyle='#b9c7c1'; ctx2.fillRect(0,top+h0/2-1,W,2); }""", """}else{ ctx2.fillStyle=TH.empty; ctx2.fillRect(0,top+h0/2-1,W,2); }""")
rep("""ctx2.fillStyle='#faf8f3'; ctx2.fillRect(x-2,0,4,H);""", """ctx2.fillStyle=TH.gap; ctx2.fillRect(x-2,0,4,H);""")
rep("""ctx2.fillStyle='rgba(31,35,40,.45)'; ctx2.fillRect(x-0.5,0,1,H);""", """ctx2.fillStyle=TH.divider; ctx2.fillRect(x-0.5,0,1,H);""")
rep("""ctx2.fillStyle=sel?'#c47f00':'#e8a317';""", """ctx2.fillStyle=sel?TH.markSel:TH.mark;""")
rep("""ctx2.fillStyle='#fff'; ctx2.font='bold 10px sans-serif';""", """ctx2.fillStyle=TH.markNum; ctx2.font='bold 10px '+TH.font;""")
rep("""ctx2.font=(sel?'bold ':'')+'12px sans-serif';""", """ctx2.font=(sel?'bold ':'')+'12px '+TH.font;""")
rep("""ctx2.fillStyle=sel?'#8a5900':'#6b5a2e';""", """ctx2.fillStyle=sel?TH.markTextSel:TH.markText;""")
rep("""ctx2.fillStyle='#e0483e'; ctx2.fillRect(pos*W-1,0,2,H);""", """ctx2.fillStyle=TH.head; ctx2.fillRect(pos*W-1,0,2,H);""")

# --- 音源の行 ---
rep("""  return s.ok ? mmss(s.dur)+' ・ 印 '+t.markers.length : '⚠ 読み込めません';""",
    """  return s.ok ? mmss(s.dur)+' ・ 印 '+t.markers.length : '読み込めません';""")
rep("""    li.innerHTML=`<span class="tnum" style="background:${colorOf(i)[0]}" title="クリックでこの音源の頭から">${i+1}</span><input maxlength="80" title="名前を変更できます"><span class="tmeta">${trackMeta(i)}</span>
      <button class="x" title="前へ">↑</button><button class="x" title="後ろへ">↓</button><button class="x" title="この音源を外す">✕</button>`;""",
    """    li.innerHTML=`<span class="tnum" style="background:${colorOf(i)[0]}" title="クリックでこの音源の頭から">${i+1}</span><input maxlength="80" title="名前を変更できます" aria-label="音源 ${i+1} の名前"><span class="tmeta">${trackMeta(i)}</span>
      <span class="tacts"><button class="x" title="前へ" aria-label="前へ">${ic('up')}</button><button class="x" title="後ろへ" aria-label="後ろへ">${ic('down')}</button><button class="x" title="この音源を外す" aria-label="この音源を外す">${ic('x')}</button></span>`;""")
rep("""  if(segs.some(s=>!s.ok)) toast('⚠ 読み込めなかった音源があります');""", """  if(segs.some(s=>!s.ok)) toast('読み込めなかった音源があります');""")

# --- お手本の再生ボタン ---
rep("""model.onplay=()=>$('mPlay').innerHTML='❚❚ 一時停止 <kbd>Enter</kbd>';
model.onpause=()=>$('mPlay').innerHTML='▶ 再生 <kbd>Enter</kbd>';""",
    """function setPlayBtn(on){ const b=$('mPlay'); b.classList.toggle('is-playing',on); b.setAttribute('aria-label',on?'一時停止':'再生');
  const l=b.querySelector('.lbl'); if(l) l.textContent=on?'一時停止':'再生'; document.body.classList.toggle('model-playing',on); }
model.onplay=()=>setPlayBtn(true);
model.onpause=()=>setPlayBtn(false);""")

# --- 印 ---
rep("""  selMark=gmarks().findIndex(g=>g.m===m);
  touch(); renderMarks(); toast('印 '+(selMark+1)+' をつけました — N キーで名前を入力');""",
    """  selMark=gmarks().findIndex(g=>g.m===m);
  touch(); renderMarks(); toast('印 '+(selMark+1)+' をつけました'+(matchMedia('(hover: hover)').matches?'（N キーで名前を入力）':''));""")
rep("""    if(segs.length>1) li.style.borderLeft='4px solid '+colorOf(g.k)[0];
    li.innerHTML=`<span class="mnum">${i+1}</span><button class="small" title="ここから再生">▶</button><span class="mtime">${fmt(g.t)}</span>
      <input placeholder="名前をつける（例：Intro／the weather の th）" maxlength="60">
      <button class="x" title="0.2秒前へ">−0.2</button><button class="x" title="0.2秒後ろへ">+0.2</button><button class="x" title="削除">✕</button>`;""",
    """    if(segs.length>1){ li.classList.add('multi'); li.style.setProperty('--tc',colorOf(g.k)[0]); }
    li.innerHTML=`<span class="mnum">${i+1}</span><button class="small mplay" title="ここから再生" aria-label="印 ${i+1} から再生">${ic('play')}</button><span class="mtime">${fmt(g.t)}</span>
      <input placeholder="名前をつける（例：Intro／the weather の th）" maxlength="60" aria-label="印 ${i+1} の名前">
      <span class="macts"><button class="x" title="0.2秒前へ">−0.2</button><button class="x" title="0.2秒後ろへ">+0.2</button><button class="x" title="削除" aria-label="印 ${i+1} を削除">${ic('x')}</button></span>`;""")

# --- 前後の音源へ ---
rep("""if(gotoTrack(i)) toast('🎧 '+(i+1)+'. '+segs[i].tr.name); }""", """if(gotoTrack(i)) toast((i+1)+'. '+segs[i].tr.name); }""")


# ====== アプリ版（iOS）のための差し込み口。window.MimicHooks が無い Web の試作では、Speak Back と同じ動き ======
rep("""function toast(t){""", """// アプリ版（iOS）が使う差し込み口。window.MimicHooks が無ければ何もしない
const hooks = () => window.MimicHooks || {};
async function mayCreateProject(){ const h=hooks().beforeCreateProject; if(!h) return true; try{ return !!(await h()); }catch(e){ return true; } }
function toast(t){""")

# iOS でデータベースの接続が切れたら、つなぎ直す
rep("""      r.onsuccess=()=>{db=r.result;res()}; r.onerror=()=>res(); r.onblocked=()=>res();""",
    """      r.onsuccess=()=>{db=r.result; db.onclose=()=>{ dbLost=true; db=null; }; res()}; r.onerror=()=>res(); r.onblocked=()=>res();""")
rep("""function req(storeName,mode,fn){
  return new Promise((ok,ng)=>{""", """// iOS ではアプリを裏に回したあとなどに、データベースとの接続が切れることがある。そのときは1回だけつなぎ直す
let dbLost=false;
async function req(storeName,mode,fn){
  if(!db && dbLost){ dbLost=false; await openDB(); }
  try{ return await req1(storeName,mode,fn); }
  catch(e){
    if(!(e && e.name==='InvalidStateError') && !dbLost) throw e;
    dbLost=false; try{ db&&db.close(); }catch(_){} db=null; await openDB();
    return req1(storeName,mode,fn);
  }
}
function req1(storeName,mode,fn){
  return new Promise((ok,ng)=>{""")

# プロジェクトを増やす操作の前に、アプリ版の確認（無料プランの上限）を通す
rep("""$('projNewBtn').onclick=async()=>{ await openProject(blankProject());""",
    """$('projNewBtn').onclick=async()=>{ if(!await mayCreateProject()) return; await openProject(blankProject());""")
rep("""    bDup.onclick=async()=>{ const s=normalizeProject({...p});""",
    """    bDup.onclick=async()=>{ if(!await mayCreateProject()) return; const s=normalizeProject({...p});""")
rep("""async function importProject(file){
  try{""", """async function importProject(file){
  if(!await mayCreateProject()) return;
  try{""")
rep("""    if(choice==='new'){
      const p=blankProject();""", """    if(choice==='new'){
      if(!await mayCreateProject()) return;
      const p=blankProject();""")

# ファイルの保存（iPhone のアプリでは共有シートを使う）
rep("""  const url=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download=(p.name||'project').replace(/[\\\\/:*?"<>|]/g,'_')+'.mimic.json';""",
    """  const blob=new Blob([JSON.stringify(out)],{type:'application/json'}), fname=(p.name||'project').replace(/[\\\\/:*?"<>|]/g,'_')+'.mimic.json';
  if(hooks().saveFile){ await hooks().saveFile(blob,fname); return; }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=fname;""")
rep("""    const setDl=()=>a.download=(nm.value||'recording').replace(/[\\\\/:*?"<>|]/g,'_')+'.'+ext; setDl();""",
    """    const setDl=()=>a.download=(nm.value||'recording').replace(/[\\\\/:*?"<>|]/g,'_')+'.'+ext; setDl();
    a.onclick=e=>{ const h=hooks().saveFile; if(h){ e.preventDefault(); h(r.blob,a.download); } };""")


# ====== 初めての人でも録音・再生でつまずかないための直し（全デザインとアプリに効く） ======
# iOS などでは、音の仕組み（AudioContext）はタップの中でしか動き出さない。最初のタップで起こしておく
rep("""function getCtx(){ return actx || (actx=new (window.AudioContext||window.webkitAudioContext)()); }""",
    """function getCtx(){ return actx || (actx=new (window.AudioContext||window.webkitAudioContext)()); }
// iOS などでは、音の仕組みはタップの中でしか動き出さない。最初のタップで起こしておく（お手本が鳴らないのを防ぐ）
['pointerdown','touchend','keydown'].forEach(t=>document.addEventListener(t,()=>{ try{ const c=getCtx(); if(c.state==='suspended') c.resume(); }catch(e){} },{capture:true,passive:true}));""")

# マイクが使えないとき、原因ごとに直し方を案内する。録音が終わったらマイクを放す
rep("""async function ensureMic(){
  if(stream) return true;
  try{""", """// マイクが使えないときの案内（原因ごとに直し方を出す）
let meterOn=false, recStarting=false;
const inAppBrowser=/\\bLine\\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent);
const isIOSDevice=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent));
function micPrecheck(){
  if(!window.isSecureContext) return 'マイクを使うには、https:// で始まるページで開いてください。';
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return inAppBrowser
    ? 'LINE などのアプリの中のブラウザでは、マイクが使えません。メニューから「Safari で開く」または「ブラウザで開く」を選んでください。'
    : 'このブラウザはマイクに対応していません。Chrome や Safari の最新版で開いてください。';
  if(!window.MediaRecorder) return 'このブラウザは録音に対応していません。iPhone なら iOS を最新にするか、Chrome や Safari の最新版で開いてください。';
  return '';
}
function micMessage(e){
  const n=e&&e.name;
  if(n==='NotAllowedError'||n==='SecurityError'){
    if(inAppBrowser) return 'アプリの中のブラウザでは、マイクが使えないことがあります。メニューから Safari や Chrome で開き直してください。';
    if(isIOSDevice) return 'マイクが許可されていません。iPhone の「設定」→「Safari」→「マイク」を「確認」か「許可」にして、ページを読み込み直してください。';
    return 'マイクが許可されていません。アドレスバーの左にあるアイコンからマイクを「許可」にして、もう一度録音ボタンを押してください。';
  }
  if(n==='NotFoundError'||n==='OverconstrainedError') return 'マイクが見つかりません。マイクやイヤホンがつながっているか確かめてください。';
  if(n==='NotReadableError'||n==='AbortError') return 'マイクをほかのアプリが使っているようです。通話やほかの録音アプリを閉じてから、もう一度押してください。';
  if(n==='NotSupportedError') return 'このブラウザではマイクを使えませんでした。Chrome や Safari の最新版で開いてください。';
  return 'マイクを使えませんでした。ページを読み込み直して、もう一度試してください。';
}
function showMicProblem(msg){
  $('status').textContent=msg;
  // デザイン側が案内を出したときは、通知は出さない
  const h=hooks().onMicProblem; let shown=false;
  if(h){ try{ shown=!!h(msg); }catch(e){} }
  if(!shown) toast('マイクを使えませんでした');
}
// 録音が終わったらマイクを放す（録音中の表示がずっと出たままにならないように）
function releaseMic(){ if(stream){ try{ stream.getTracks().forEach(t=>t.stop()); }catch(e){} stream=null; } }
async function ensureMic(){
  if(stream) return true;
  const pre=micPrecheck(); if(pre){ showMicProblem(pre); return false; }
  try{""")
rep("""    meterLoop(); return true;
  }catch(e){ $('status').textContent='マイクを使えませんでした。ブラウザのマイク許可を確認してください。'; return false; }""",
    """    if(!meterOn){ meterOn=true; meterLoop(); } return true;
  }catch(e){ showMicProblem(micMessage(e)); return false; }""")
# 録音ボタンの連打で、録音が二重に始まらないように
rep("""  if(recorder && recorder.state==='recording'){ recorder.stop(); return; }
  if(!await ensureMic()) return;""", """  if(recorder && recorder.state==='recording'){ recorder.stop(); return; }
  if(recStarting) return; recStarting=true;
  try{ if(!await ensureMic()) return; } finally { recStarting=false; }""")
# 録音の形式が合わないブラウザでも、形式を指定せずにもう一度試す
rep("""  recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);""",
    """  try{ recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined); }
  catch(e){ try{ recorder=new MediaRecorder(stream); }catch(e2){ releaseMic(); showMicProblem('このブラウザでは録音を始められませんでした。Chrome や Safari の最新版で開いてください。'); return; } }""")
# 録音が空のとき（すぐ止めた等）は、前の録音を残したまま知らせる
rep("""  lastBlob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});""",
    """  releaseMic();
  const recBlob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
  if(!recBlob.size || performance.now()-recStart<350){ $('status').textContent='短すぎたので録音しませんでした。録音ボタンを押して話し、話し終わったらもう一度押してください。'; return; }
  lastBlob=recBlob;""")

# 自分の声を再生できなかったとき（壊れた録音など）は、案内を出す
rep("""  mine.currentTime=0; mine.play();""", """  mine.currentTime=0; mine.play().catch(()=>{ $('status').textContent='録音を再生できませんでした。もう一度録音してください。'; });""")

header = r'''/* Mimic（デザイン試作）
   ロジックは Speak Back（english-practice2.html）の機能をそのままコピーしたもの。
   変えたのは見た目まわり（アイコン、色をデザインごとの CSS から読む、ボタン表示の切り替え）と、
   保存先を Speak Back と分けたこと（データベース名 mimic）だけ。書き出しファイルの形式は共通。 */

/* ---------- アイコン（どのデザインでも共通で使う） ---------- */
const ICONS={
  play:'<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause:'<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  back:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4h4"/>',
  fwd:'<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4h-4"/>',
  replay:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4h4"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none"/>',
  mark:'<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  loop:'<path d="M17 3l3 3-3 3"/><path d="M4 12v-1a5 5 0 0 1 5-5h11"/><path d="M7 21l-3-3 3-3"/><path d="M20 12v1a5 5 0 0 1-5 5H4"/>',
  speed:'<path d="M12 14l4.5-4.5"/><path d="M3.5 17.5a9 9 0 1 1 17 0"/>',
  vol:'<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  reset:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4h4"/>',
  folder:'<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  list:'<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.75" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="4.75" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.75" cy="17.5" r="1" fill="currentColor" stroke="none"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chev:'<path d="M6.5 9.5 12 15l5.5-5.5"/>',
  up:'<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
  down:'<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>',
  x:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  download:'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload:'<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  export:'<path d="M12 14V3.5M8 7.5l4-4 4 4"/><path d="M5 11.5v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  copy:'<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  trash:'<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>',
  save:'<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>',
  track:'<path d="M4.5 14.5V12a7.5 7.5 0 0 1 15 0v2.5"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  wave:'<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
  file:'<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5"/><path d="M9.5 16.5v-4l4-1v4"/><circle cx="8.5" cy="16.5" r="1"/><circle cx="12.5" cy="15.5" r="1"/>'
};
(function injectIcons(){
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg');
  s.setAttribute('aria-hidden','true'); s.setAttribute('width','0'); s.setAttribute('height','0');
  s.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML=Object.entries(ICONS).map(([k,v])=>`<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('');
  document.body.prepend(s);
})();
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;

/* ---------- ここから下は Speak Back と同じ ---------- */
'''
out_path.write_text(header + s, encoding='utf-8')
print(f'{out_path.relative_to(ROOT)} を作り直しました（{len(header + s)} 文字）')
