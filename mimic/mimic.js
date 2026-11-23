/* Mimic（デザイン試作）
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
const $ = id => document.getElementById(id);
const fmt = s => { if(!isFinite(s)) s=0; const m=Math.floor(s/60); return m+':'+(s%60).toFixed(1).padStart(4,'0'); };
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
// アプリ版（iOS）が使う差し込み口。window.MimicHooks が無ければ何もしない
const hooks = () => window.MimicHooks || {};
async function mayCreateProject(){ const h=hooks().beforeCreateProject; if(!h) return true; try{ return !!(await h()); }catch(e){ return true; } }
function toast(t){ const el=$('toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),1800); }

/* ---------- モーダル ---------- */
function ask(title,msg,buttons){
  return new Promise(res=>{
    $('mTitle').textContent=title; $('mMsg').textContent=msg; const b=$('mBtns'); b.innerHTML='';
    buttons.forEach(([label,val,cls])=>{ const e=document.createElement('button'); e.textContent=label; if(cls) e.className=cls;
      e.onclick=()=>{ $('modal').style.display='none'; res(val); }; b.appendChild(e); });
    $('modal').style.display='flex';
  });
}
$('modal').addEventListener('click',e=>{ if(e.target.id==='modal'){ $('modal').style.display='none'; } });

/* ---------- DB ---------- */
let db=null;
function openDB(){
  return new Promise(res=>{
    try{
      const r=indexedDB.open('mimic',3);
      r.onupgradeneeded=(ev)=>{
        const d=r.result, tx=r.transaction;
        if(!d.objectStoreNames.contains('recs')) d.createObjectStore('recs',{keyPath:'id',autoIncrement:true});
        if(!d.objectStoreNames.contains('projects')) d.createObjectStore('projects',{keyPath:'id',autoIncrement:true});
        // 旧バージョンの「最近の音源」をプロジェクトに移行
        if(d.objectStoreNames.contains('models')){
          const q=tx.objectStore('models').getAll();
          q.onsuccess=()=>{
            q.result.forEach(m=>{
              let mk=[]; try{ mk=(JSON.parse(localStorage.getItem('speakback-marks:'+m.name))||[]).map(x=>({t:x.t,name:x.name||x.label||''})); }catch(e){}
              tx.objectStore('projects').add({name:m.name.replace(/\.[^.]+$/,''),created:m.used||Date.now(),updated:m.used||Date.now(),
                tracks:[{id:uid(),name:m.name,type:m.type,blob:m.blob,markers:mk}],curTrack:0,rate:1,vol:100});
            });
            d.deleteObjectStore('models');
          };
        }
      };
      r.onsuccess=()=>{db=r.result; db.onclose=()=>{ dbLost=true; db=null; }; res()}; r.onerror=()=>res(); r.onblocked=()=>res();
    }catch(e){res()}
  });
}
// iOS ではアプリを裏に回したあとなどに、データベースとの接続が切れることがある。そのときは1回だけつなぎ直す
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
  return new Promise((ok,ng)=>{
    if(!db) return ng(new Error('no db'));
    try{ const q=fn(db.transaction(storeName,mode).objectStore(storeName)); q.onsuccess=()=>ok(q.result); q.onerror=()=>ng(q.error); }catch(e){ ng(e); }
  });
}
const dbAll   = s => req(s,'readonly',st=>st.getAll()).catch(()=>[]);
const dbGet   = (s,k) => req(s,'readonly',st=>st.get(k)).catch(()=>null);
const dbPut   = (s,v) => { if(v.id==null) delete v.id; return req(s,'readwrite',st=>st.put(v)); };
const dbDel   = (s,k) => req(s,'readwrite',st=>st.delete(k)).catch(()=>{});

/* ---------- プロジェクト ---------- */
function blankProject(){ return {name:'無題のプロジェクト',created:Date.now(),updated:Date.now(),tracks:[],curTrack:0,rate:1,vol:100}; }
// 1プロジェクト＝複数の音源（tracks）。旧形式（audio＋markers が1つ）は読み込み時に変換する
function normalizeProject(p){
  if(!p) return p;
  if(!Array.isArray(p.tracks)){
    p.tracks = p.audio ? [{id:uid(),name:p.audio.name,type:p.audio.type,blob:p.audio.blob,markers:p.markers||[]}] : [];
    delete p.audio; delete p.markers;
  }
  p.tracks.forEach(t=>{ if(!t.id) t.id=uid(); t.markers=(t.markers||[]).map(m=>({t:m.t,name:m.name||m.label||''})); });
  p.curTrack=Math.max(0,Math.min(p.tracks.length-1,p.curTrack|0));
  return p;
}
const trk   = () => (segs[activeSeg]||{}).tr||null; // 今聞いている位置の音源
const baseName = n => String(n).replace(/\.[^.]+$/,'');
let cur=blankProject();
let saveTimer=null, dirty=false;
function touch(){ // 変更があったら自動保存
  cur.updated=Date.now(); dirty=true;
  $('saveState').textContent='保存中…';
  clearTimeout(saveTimer); saveTimer=setTimeout(saveProject,400);
}
async function saveProject(){
  clearTimeout(saveTimer); dirty=false;
  if(!db){ $('saveState').textContent='（保存不可）'; return; }
  try{
    const id=await dbPut('projects',cur); cur.id=id;
    try{ localStorage.setItem('mimic-last',id); }catch(e){}
    $('saveState').textContent='✓ 保存済み';
    if($('projPanel').style.display==='block') renderProjList();
  }catch(e){ $('saveState').textContent='保存に失敗'; }
}
async function openProject(p){
  if(dirty) await saveProject();
  model.pause(); mine.pause();
  cur=normalizeProject(p);
  if(cur.id!=null) try{ localStorage.setItem('mimic-last',cur.id); }catch(e){}
  selMark=-1; segs=[]; peaks=null; activeSeg=-1; buildId++;
  renderProject();
}
function renderProject(){
  $('projName').value=cur.name;
  $('saveState').textContent=cur.id!=null?'✓ 保存済み':'';
  setRate(cur.rate||1,false); setVol(cur.vol??100,false);
  if(cur.tracks.length){ buildTimeline(); }
  else{
    model.pause(); model.removeAttribute('src'); model.load(); modelReady=false; peaks=null; segs=[]; activeSeg=-1; buildId++;
    $('modelArea').style.display='none'; $('drop').style.display='block';
  }
  renderTracks(); renderMarks(); renderSaved();
  if($('projPanel').style.display==='block') renderProjList();
}
$('projName').addEventListener('change',()=>{ cur.name=$('projName').value.trim()||'無題のプロジェクト'; $('projName').value=cur.name; touch(); });
$('projName').addEventListener('keydown',e=>{ if(e.key==='Enter') e.target.blur(); });
$('projNewBtn').onclick=async()=>{ if(!await mayCreateProject()) return; await openProject(blankProject()); closeProjIfOverlay(); toast('新しいプロジェクトを作りました'); $('projName').focus(); $('projName').select(); };
$('projListBtn').onclick=()=>{
  const p=$('projPanel'); const open=p.style.display!=='block';
  p.style.display=open?'block':'none'; $('projListBtn').setAttribute('aria-expanded',String(open)); document.body.classList.toggle('proj-open',open);
  if(open) renderProjList();
};
// 一覧を重ねて表示するデザインでは、開いたら閉じる
function closeProjIfOverlay(){ if(document.body.dataset.projOverlay && $('projPanel').style.display==='block') $('projListBtn').click(); }
document.querySelectorAll('[data-close-proj]').forEach(b=>b.addEventListener('click',()=>{ if($('projPanel').style.display==='block') $('projListBtn').click(); }));
async function renderProjList(){
  const list=(await dbAll('projects')).sort((a,b)=>b.updated-a.updated);
  const recs=await dbAll('recs');
  const ul=$('projList'); ul.innerHTML='';
  if(!list.length){ ul.innerHTML='<li class="muted empty-li">保存されたプロジェクトはまだありません。音源を読み込むか録音を保存すると、自動で保存されます。</li>'; return; }
  list.forEach(p=>{
    const n=recs.filter(r=>r.projectId===p.id).length;
    const tr=normalizeProject({...p}).tracks;
    const tInfo=tr.length?'音源 '+tr.length+'（'+esc(tr.slice(0,3).map(t=>t.name).join('、'))+(tr.length>3?' ほか':'')+'）':'音源なし';
    const li=document.createElement('li'); if(p.id===cur.id) li.className='current';
    li.innerHTML=`<div class="pinfo"><div class="pname">${esc(p.name)}${p.id===cur.id?'<span class="pcur">開いています</span>':''}</div>
      <div class="pmeta"><span>${tInfo}</span><span>印 ${tr.reduce((s,t)=>s+t.markers.length,0)}</span><span>録音 ${n}</span><span>${new Date(p.updated).toLocaleString('ja-JP',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div></div>
      <div class="pacts"><button class="small primary">開く</button><button class="small">${ic('export')}<span>書き出し</span></button><button class="small">${ic('copy')}<span>複製</span></button><button class="small danger">${ic('trash')}<span>削除</span></button></div>`;
    const [bOpen,bExp,bDup,bDel]=li.querySelectorAll('button');
    bOpen.onclick=async()=>{ await openProject(await dbGet('projects',p.id)); closeProjIfOverlay(); toast('「'+p.name+'」を開きました'); };
    bExp.onclick=()=>exportProject(p);
    bDup.onclick=async()=>{ if(!await mayCreateProject()) return; const s=normalizeProject({...p}); const c={...s,id:undefined,name:p.name+' のコピー',created:Date.now(),updated:Date.now(),
        tracks:s.tracks.map(t=>({...t,id:uid(),markers:t.markers.map(m=>({...m}))}))}; c.id=await dbPut('projects',c); renderProjList(); toast('複製しました'); };
    bDel.onclick=async()=>{
      const ok=await ask('「'+p.name+'」を削除しますか？','このプロジェクトの音源・印・保存した録音（'+n+'件）がすべて消えます。元に戻せません。',[['削除する',true,'danger'],['キャンセル',false]]);
      if(!ok) return;
      await dbDel('projects',p.id);
      for(const r of recs.filter(r=>r.projectId===p.id)) await dbDel('recs',r.id);
      if(p.id===cur.id) await openProject(blankProject());
      renderProjList(); renderSaved(); toast('削除しました');
    };
    ul.appendChild(li);
  });
}

/* 書き出し／読み込み */
const blobToB64 = b => new Promise(ok=>{ const r=new FileReader(); r.onload=()=>ok(r.result.split(',')[1]); r.readAsDataURL(b); });
const b64ToBlob = (s,type) => { const bin=atob(s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Blob([u],{type}); };
async function exportProject(p){
  toast('書き出し中…');
  const recs=(await dbAll('recs')).filter(r=>r.projectId===p.id);
  const s=normalizeProject({...p});
  const out={format:'speakback-project',version:2,exported:new Date().toISOString(),
    project:{name:p.name,created:p.created,rate:p.rate||1,vol:p.vol??100,curTrack:s.curTrack,
      tracks:await Promise.all(s.tracks.map(async t=>({name:t.name,type:t.type,markers:t.markers,data:await blobToB64(t.blob)})))},
    recordings:await Promise.all(recs.map(async r=>({name:r.name,type:r.type,created:r.created,
      trackIndex:s.tracks.findIndex(t=>t.id===r.trackId),data:await blobToB64(r.blob)})))};
  const blob=new Blob([JSON.stringify(out)],{type:'application/json'}), fname=(p.name||'project').replace(/[\\/:*?"<>|]/g,'_')+'.mimic.json';
  if(hooks().saveFile){ await hooks().saveFile(blob,fname); return; }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=fname;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function importProject(file){
  if(!await mayCreateProject()) return;
  try{
    const j=JSON.parse(await file.text());
    if(j.format!=='speakback-project') throw 0;
    const p=j.project;
    const src=Array.isArray(p.tracks)?p.tracks:(p.audio?[{...p.audio,markers:p.markers||[]}]:[]); // v1（音源1つ）にも対応
    const tracks=src.map(t=>({id:uid(),name:t.name,type:t.type,markers:t.markers||[],blob:b64ToBlob(t.data,t.type)}));
    const np={name:p.name||'読み込んだプロジェクト',created:p.created||Date.now(),updated:Date.now(),tracks,curTrack:p.curTrack|0,rate:p.rate||1,vol:p.vol??100};
    np.id=await dbPut('projects',np);
    for(const r of j.recordings||[]) await dbPut('recs',{name:r.name,type:r.type,created:r.created,blob:b64ToBlob(r.data,r.type),projectId:np.id,
      trackId:tracks[r.trackIndex]?tracks[r.trackIndex].id:undefined});
    await openProject(np); toast('「'+np.name+'」を読み込みました');
  }catch(e){ ask('読み込めませんでした','Speak Back または Mimic で書き出したプロジェクトファイル（.speakback.json / .mimic.json）を選んでください。',[['OK',0]]); }
}
$('importBtn').onclick=()=>$('importInput').click();
$('importInput').onchange=e=>{ if(e.target.files[0]) importProject(e.target.files[0]); e.target.value=''; };

/* ---------- 録音 ---------- */
let stream=null, recorder=null, chunks=[], lastBlob=null, lastUrl=null, recStart=0, timerId=null;
const mine=new Audio(); mine.preservesPitch=true;
let actx=null, analyser=null;
function getCtx(){ return actx || (actx=new (window.AudioContext||window.webkitAudioContext)()); }
// iOS などでは、音の仕組みはタップの中でしか動き出さない。最初のタップで起こしておく（お手本が鳴らないのを防ぐ）
['pointerdown','touchend','keydown'].forEach(t=>document.addEventListener(t,()=>{ try{ const c=getCtx(); if(c.state==='suspended') c.resume(); }catch(e){} },{capture:true,passive:true}));
function pickMime(){
  for(const m of ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'])
    if(window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}
// マイクが使えないときの案内（原因ごとに直し方を出す）
let meterOn=false, recStarting=false;
const inAppBrowser=/\bLine\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent);
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
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:true}});
    analyser=getCtx().createAnalyser(); analyser.fftSize=512;
    getCtx().createMediaStreamSource(stream).connect(analyser);
    if(!meterOn){ meterOn=true; meterLoop(); } return true;
  }catch(e){ showMicProblem(micMessage(e)); return false; }
}
function meterLoop(){
  const d=new Uint8Array(analyser.fftSize);
  (function f(){
    analyser.getByteTimeDomainData(d); let p=0; for(const v of d) p=Math.max(p,Math.abs(v-128));
    $('meter').firstElementChild.style.width=(recorder&&recorder.state==='recording'?Math.min(100,p/128*160):0)+'%';
    requestAnimationFrame(f);
  })();
}
async function toggleRec(){
  if(recorder && recorder.state==='recording'){ recorder.stop(); return; }
  if(recStarting) return; recStarting=true;
  try{ if(!await ensureMic()) return; } finally { recStarting=false; }
  if(actx&&actx.state==='suspended') actx.resume();
  mine.pause(); chunks=[];
  const mime=pickMime();
  try{ recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined); }
  catch(e){ try{ recorder=new MediaRecorder(stream); }catch(e2){ releaseMic(); showMicProblem('このブラウザでは録音を始められませんでした。Chrome や Safari の最新版で開いてください。'); return; } }
  recorder.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  recorder.onstop=onRecStop; recorder.start();
  recStart=performance.now();
  $('recBtn').classList.add('recording'); $('recLabel').textContent='停止';
  timerId=setInterval(()=>{ $('status').innerHTML='<span class="rec-dot"></span>録音中 <span id="timer">'+fmt((performance.now()-recStart)/1000)+'</span>'; },100);
  if($('syncModel').checked && modelReady) playFrom(selectedMarkTime());
}
function onRecStop(){
  clearInterval(timerId);
  $('recBtn').classList.remove('recording'); $('recLabel').textContent='録音';
  if($('syncModel').checked && modelReady) model.pause();
  releaseMic();
  const recBlob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
  if(!recBlob.size || performance.now()-recStart<350){ $('status').textContent='短すぎたので録音しませんでした。録音ボタンを押して話し、話し終わったらもう一度押してください。'; return; }
  lastBlob=recBlob;
  const dur=(performance.now()-recStart)/1000;
  if(lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl=URL.createObjectURL(lastBlob); mine.src=lastUrl;
  $('playMine').disabled=false; $('saveBtn').disabled=false;
  $('status').textContent='録音しました（'+fmt(dur)+'）';
  if($('autoPlay').checked) playMine();
}
function playMine(){
  if(!lastUrl) return; model.pause();
  const r=+$('mineRate').value; mine.defaultPlaybackRate=r; mine.playbackRate=r;
  mine.currentTime=0; mine.play().catch(()=>{ $('status').textContent='録音を再生できませんでした。もう一度録音してください。'; }); $('status').textContent='再生中…'+(r!==1?'（'+r+'×）':'');
}
mine.onended=()=>{ $('status').textContent='再生終了。もう一度録るなら Space / 録音ボタン'; };
$('mineRate').onchange=()=>{ mine.playbackRate=+$('mineRate').value; };
$('recBtn').onclick=toggleRec;
$('playMine').onclick=playMine;
$('saveBtn').onclick=saveCurrent;

async function saveCurrent(){
  if(!lastBlob) return;
  if(!db){ toast('このブラウザでは保存できません'); return; }
  if(cur.id==null) await saveProject();
  const d=new Date();
  const g=gmarks()[selMark];
  const markName = g&&g.name ? g.name+' ' : '';
  await dbPut('recs',{name:markName+d.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    blob:lastBlob,type:lastBlob.type,created:d.getTime(),projectId:cur.id,trackId:trk()?trk().id:undefined});
  $('saveBtn').disabled=true; toast('「'+cur.name+'」に保存しました'); renderSaved();
}
async function renderSaved(){
  const all=await dbAll('recs');
  const showAll=$('showAllRecs').checked;
  const list=all.filter(r=>showAll || (cur.id!=null && r.projectId===cur.id)).sort((a,b)=>b.created-a.created);
  const projs=showAll?Object.fromEntries((await dbAll('projects')).map(p=>[p.id,p.name])):{};
  const ul=$('saved'); ul.querySelectorAll('audio').forEach(a=>URL.revokeObjectURL(a.src)); ul.innerHTML='';
  $('noSaved').style.display=list.length?'none':'block';
  for(const r of list){
    const li=document.createElement('li');
    const url=URL.createObjectURL(r.blob);
    const ext=(r.type||'').includes('mp4')?'m4a':(r.type||'').includes('ogg')?'ogg':'webm';
    const ti=r.projectId===cur.id&&cur.tracks.length>1?cur.tracks.findIndex(t=>t.id===r.trackId):-1;
    li.innerHTML=(showAll?`<span class="ptag">${esc(projs[r.projectId]||'プロジェクトなし')}</span>`:'')+
      (ti>=0?`<span class="ptag" style="background:${tint(colorOf(ti)[0],.16)}">${ic('track')}${esc(baseName(cur.tracks[ti].name))}</span>`:'')+
      `<input class="nm" aria-label="録音の名前"><audio controls src="${url}"></audio><a download class="dl" title="ファイルとしてダウンロード" aria-label="ダウンロード">${ic('download')}</a><button class="x" title="削除" aria-label="削除">${ic('x')}</button>`;
    const nm=li.querySelector('.nm'); nm.value=r.name;
    const a=li.querySelector('a'); a.href=url;
    const setDl=()=>a.download=(nm.value||'recording').replace(/[\\/:*?"<>|]/g,'_')+'.'+ext; setDl();
    a.onclick=e=>{ const h=hooks().saveFile; if(h){ e.preventDefault(); h(r.blob,a.download); } };
    const au=li.querySelector('audio'); au.preservesPitch=true; au.onplay=()=>{ au.playbackRate=+$('mineRate').value; };
    nm.onchange=()=>{ r.name=nm.value; setDl(); dbPut('recs',r).catch(()=>{}); };
    li.querySelector('.x').onclick=async()=>{ await dbDel('recs',r.id); renderSaved(); };
    ul.appendChild(li);
  }
}
$('showAllRecs').onchange=renderSaved;

/* ---------- お手本（プロジェクト内の音源を順番に1本につなげて扱う） ---------- */
const model=new Audio(); model.preservesPitch=true;
let modelReady=false, peaks=null, peakSeg=null, selMark=-1;
let segs=[], activeSeg=-1, buildId=0;   // segs[k] = {tr, start, dur, ok}：つなげた中での各音源の位置（秒）
const decoded=new Map();                // 音源id → {data: モノラルPCM, sr}
const canvas=$('wave'), ctx2=canvas.getContext('2d');
let PAL=[['#2f6f5e','#b9c7c1'],['#3b5f99','#bcc6da'],['#8a4f7d','#d8c3d4'],['#9a6a1f','#dfcdab'],['#4d7a2c','#c6d5b7'],['#a14a3c','#e0beb7']];
const colorOf = i => PAL[((i%PAL.length)+PAL.length)%PAL.length];
const tint = (hex,a) => 'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+a+')';
const TH={};
function readTheme(){
  const cs=getComputedStyle(document.documentElement), v=(n,d)=>cs.getPropertyValue(n).trim()||d;
  Object.assign(TH,{empty:v('--wave-empty','#b9c7c1'), gap:v('--wave-gap','#faf8f3'), divider:v('--wave-divider','rgba(31,35,40,.45)'),
    mark:v('--wave-mark','#e8a317'), markSel:v('--wave-mark-sel','#c47f00'), markNum:v('--wave-mark-num','#fff'),
    markText:v('--wave-mark-text','#6b5a2e'), markTextSel:v('--wave-mark-text-sel','#8a5900'),
    loop:v('--wave-loop','rgba(232,163,23,.13)'), head:v('--wave-head','#e0483e'), font:v('--wave-font','sans-serif')});
  const pal=[]; for(let i=1;i<=6;i++){ const p=v('--pal-'+i,'').split(/\s+/).filter(Boolean); if(p.length===2) pal.push(p); }
  if(pal.length) PAL=pal;
}
readTheme();
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ readTheme(); renderTracks(); renderMarks(); renderSaved(); }); }catch(e){}
const mmss = s => { s=Math.round(s||0); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const totalDur = () => segs.length ? segs[segs.length-1].start+segs[segs.length-1].dur : 0;

async function decodeTrack(t){
  if(decoded.has(t.id)) return decoded.get(t.id);
  let r={data:null,sr:0};
  try{
    const buf=await getCtx().decodeAudioData(await t.blob.arrayBuffer());
    const n=buf.length, C=buf.numberOfChannels, out=new Float32Array(n);
    for(let c=0;c<C;c++){ const d=buf.getChannelData(c); for(let i=0;i<n;i++) out[i]+=d[i]/C; }
    r={data:out,sr:buf.sampleRate};
  }catch(e){}
  decoded.set(t.id,r); return r;
}
function segAt(t){
  for(let k=segs.length-1;k>=0;k--) if(segs[k].ok && t>=segs[k].start-1e-6) return k;
  return segs.findIndex(s=>s.ok);
}
// 全音源をデコードして1本のWAVにつなげる。seekTrackId を渡すとその音源の頭へ、なければ今聞いている位置を保つ
async function buildTimeline(seekTrackId){
  const id=++buildId;
  const keep = seekTrackId ? {id:seekTrackId,off:0}
             : segs[activeSeg] ? {id:segs[activeSeg].tr.id, off:model.currentTime-segs[activeSeg].start} : null;
  model.pause(); modelReady=false;
  $('modelArea').style.display='block'; $('drop').style.display='none'; $('waveBusy').style.display='flex';
  const tracks=cur.tracks.slice(), dec=[];
  for(const t of tracks) dec.push(await decodeTrack(t));
  if(id!==buildId) return; // 途中で別の変更が入った
  for(const k of [...decoded.keys()]) if(!cur.tracks.some(t=>t.id===k)) decoded.delete(k);
  const sr=(dec.find(d=>d.data)||{sr:44100}).sr;
  let total=0;
  segs=tracks.map((t,i)=>{ const n=dec[i].data?dec[i].data.length:0; const s={tr:t,start:total/sr,dur:n/sr,ok:n>0}; total+=n; return s; });
  activeSeg=-1; $('waveBusy').style.display='none';
  if(!total){ peaks=null; renderTracks(); renderMarks(); toast('音源を読み込めませんでした'); return; }

  const buf=new ArrayBuffer(44+total*2), v=new DataView(buf);
  const w=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4,36+total*2,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,total*2,true);
  const pcm=new Int16Array(buf,44,total), N=1600, pk=new Float32Array(N), ps=new Uint16Array(N), scale=N/total;
  let g=0;
  dec.forEach((d,k)=>{ if(!d.data) return; const a=d.data;
    for(let i=0;i<a.length;i++,g++){ let s=a[i]; if(s>1)s=1; else if(s<-1)s=-1; pcm[g]=s*32767;
      const b=(g*scale)|0, av=s<0?-s:s; if(av>pk[b]) pk[b]=av; ps[b]=k; } });
  let mx=0; for(const x of pk) if(x>mx) mx=x; mx=mx||1; for(let i=0;i<N;i++) pk[i]/=mx;
  peaks=pk; peakSeg=ps;

  if(model.src && model.src.startsWith('blob:')) URL.revokeObjectURL(model.src);
  model.src=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
  model.defaultPlaybackRate=cur.rate||1; model.playbackRate=cur.rate||1;
  const k=keep?segs.findIndex(s=>s.tr.id===keep.id&&s.ok):-1;
  const startT=k>=0?segs[k].start+Math.max(0,Math.min(keep.off,segs[k].dur-0.05)):0;
  model.addEventListener('loadedmetadata',()=>{ model.currentTime=startT; },{once:true});
  modelReady=true;
  const n=gmarks().length; if(selMark<0&&n) selMark=0; if(selMark>=n) selMark=n-1;
  renderTracks(); renderMarks();
  if(segs.some(s=>!s.ok)) toast('読み込めなかった音源があります');
}

/* 音源の追加（複数可）。confirm=true のとき、既存プロジェクトへ追加するか新規にするかを聞く */
const isAudio = f => /^(audio|video)\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|mp4|mov)$/i.test(f.name);
async function handleAudioFiles(files,confirm){
  files=[...files].filter(isAudio);
  if(!files.length){ toast('音声ファイルを選んでください'); return; }
  const mk=f=>({id:uid(),name:f.name,type:f.type,blob:f,markers:[]});
  const what=files.length>1?files.length+' 個のファイル':'「'+files[0].name+'」';
  if(confirm && cur.tracks.length){
    const choice=await ask('音源を追加',what+'をどうしますか？',[
      ['このプロジェクトに追加する','add','primary'],
      ['新しいプロジェクトとして開く（今のプロジェクトはそのまま残ります）','new'],
      ['キャンセル',null]]);
    if(!choice) return;
    if(choice==='new'){
      if(!await mayCreateProject()) return;
      const p=blankProject(); p.name=baseName(files[0].name); p.tracks=files.map(mk); p.rate=cur.rate; p.vol=cur.vol;
      await openProject(p); touch(); toast('新しいプロジェクトを作りました'); return;
    }
  }
  if(!cur.tracks.length && cur.name==='無題のプロジェクト'){ cur.name=baseName(files[0].name); $('projName').value=cur.name; }
  const added=files.map(mk);
  cur.tracks.push(...added);
  renderTracks(); buildTimeline(added[0].id); touch();
  toast(what+'を追加しました（全 '+cur.tracks.length+' 音源）');
}
function gotoTrack(i){ // その音源の頭へ移動
  const s=segs[i]; if(!s||!s.ok||!modelReady) return false;
  mine.pause(); model.currentTime=s.start; return true;
}
function moveTrack(i,d){
  const j=i+d; if(j<0||j>=cur.tracks.length) return;
  [cur.tracks[i],cur.tracks[j]]=[cur.tracks[j],cur.tracks[i]];
  renderTracks(); buildTimeline(); touch();
}
async function removeTrack(i){
  const t=cur.tracks[i];
  const ok=await ask('「'+t.name+'」をプロジェクトから外しますか？','この音源と、つけた印（'+t.markers.length+' 個）が消えます。保存した録音は残ります。',[['外す',true,'danger'],['キャンセル',false]]);
  if(!ok) return;
  cur.tracks.splice(i,1); decoded.delete(t.id);
  if(cur.tracks.length){ renderTracks(); buildTimeline(); } else { segs=[]; renderProject(); }
  touch(); toast('音源を外しました');
}
function trackMeta(i){
  const t=cur.tracks[i], s=segs.find(x=>x.tr===t);
  if(!s) return '読み込み中…';
  return s.ok ? mmss(s.dur)+' ・ 印 '+t.markers.length : '読み込めません';
}
function renderTracks(){
  const ul=$('trackList'); ul.innerHTML='';
  const tot=totalDur(), n=cur.tracks.length;
  $('trackCount').textContent='音源 '+n+' 個'+(n>1?'を順番につなげて再生':'')+(tot&&n>1?'（合計 '+mmss(tot)+'）':'');
  cur.tracks.forEach((t,i)=>{
    const li=document.createElement('li'); if(i===activeSeg) li.className='active';
    li.innerHTML=`<span class="tnum" style="background:${colorOf(i)[0]}" title="クリックでこの音源の頭から">${i+1}</span><input maxlength="80" title="名前を変更できます" aria-label="音源 ${i+1} の名前"><span class="tmeta">${trackMeta(i)}</span>
      <span class="tacts"><button class="x" title="前へ" aria-label="前へ">${ic('up')}</button><button class="x" title="後ろへ" aria-label="後ろへ">${ic('down')}</button><button class="x" title="この音源を外す" aria-label="この音源を外す">${ic('x')}</button></span>`;
    const inp=li.querySelector('input'); inp.value=t.name;
    const [up,down,del]=li.querySelectorAll('button');
    up.disabled=i===0; down.disabled=i===n-1;
    li.onclick=e=>{ if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT') return; gotoTrack(i); };
    inp.onchange=()=>{ t.name=inp.value.trim()||t.name; inp.value=t.name; touch(); renderSaved(); };
    inp.onkeydown=e=>{ if(e.key==='Enter'||e.key==='Escape'){ e.preventDefault(); inp.blur(); } };
    up.onclick=()=>moveTrack(i,-1); down.onclick=()=>moveTrack(i,1); del.onclick=()=>removeTrack(i);
    ul.appendChild(li);
  });
}
$('drop').onclick=()=>$('fileInput').click();
$('addTrackBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{ const fs=[...e.target.files]; e.target.value=''; if(fs.length) handleAudioFiles(fs,false); };
['dragenter','dragover'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault(); $('drop').classList.add('over');}));
['dragleave','drop'].forEach(t=>document.addEventListener(t,e=>{e.preventDefault(); if(t==='drop'||e.target===$('drop')) $('drop').classList.remove('over');}));
document.addEventListener('drop',e=>{
  const fs=[...e.dataTransfer.files]; if(!fs.length) return;
  if(fs.length===1 && /\.json$/i.test(fs[0].name)) importProject(fs[0]); else handleAudioFiles(fs,true);
});

model.onloadedmetadata=()=>{ $('durT').textContent=fmt(model.duration); drawWave(); };
function setPlayBtn(on){ const b=$('mPlay'); b.classList.toggle('is-playing',on); b.setAttribute('aria-label',on?'一時停止':'再生');
  const l=b.querySelector('.lbl'); if(l) l.textContent=on?'一時停止':'再生'; document.body.classList.toggle('model-playing',on); }
model.onplay=()=>setPlayBtn(true);
model.onpause=()=>setPlayBtn(false);

/* 速度 */
function setRate(r,save=true){
  r=Math.round(Math.max(0.25,Math.min(2,r))*100)/100;
  cur.rate=r; model.defaultPlaybackRate=r; model.playbackRate=r;
  $('rate').value=r; $('rateVal').textContent=r.toFixed(2)+'×';
  $('rateChips').querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.r===r));
  if(save) touch();
}
$('rate').oninput=e=>setRate(+e.target.value);
$('rateChips').querySelectorAll('button').forEach(b=>b.onclick=()=>setRate(+b.dataset.r));

/* 音量（0〜300%） */
let gainNode=null;
function ensureGain(){
  if(gainNode) return;
  try{ const src=getCtx().createMediaElementSource(model); gainNode=getCtx().createGain(); src.connect(gainNode).connect(getCtx().destination); }
  catch(e){ gainNode=null; }
}
function setVol(pct,save=true){
  pct=Math.max(0,Math.min(300,pct)); cur.vol=pct;
  $('vol').value=pct; $('volVal').textContent=pct+'%';
  if(gainNode) gainNode.gain.value=pct/100; else model.volume=Math.min(1,pct/100);
  if(save) touch();
}
$('vol').oninput=e=>{ ensureGain(); setVol(+e.target.value); };
$('volReset').onclick=()=>setVol(100);
model.addEventListener('play',()=>{ ensureGain(); if(actx&&actx.state==='suspended') actx.resume(); setVol(cur.vol??100,false); });

/* 波形 */
function drawWave(){
  const dpr=window.devicePixelRatio||1, W=canvas.clientWidth, H=canvas.clientHeight;
  if(!W) return;
  if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);}
  ctx2.setTransform(dpr,0,0,dpr,0,0); ctx2.clearRect(0,0,W,H);
  const dur=modelReady?(model.duration||totalDur()):0, pos=dur?model.currentTime/dur:0, top=24, strip=5, h0=H-top-strip;
  const multi=segs.length>1;
  // 音源ごとに背景と下の帯を色分けして、どこからどこまでが1つのファイルか分かるようにする
  if(dur && multi) segs.forEach((s,k)=>{ if(!s.ok) return;
    const x0=s.start/dur*W, x1=(s.start+s.dur)/dur*W, c=colorOf(k)[0];
    ctx2.fillStyle=tint(c,.07); ctx2.fillRect(x0,0,x1-x0,H);
    ctx2.fillStyle=c; ctx2.fillRect(x0,H-strip,Math.max(1,x1-x0-2),strip); });
  const seg=currentSegment();
  if($('loopSeg').checked && seg && dur){ ctx2.fillStyle=TH.loop; ctx2.fillRect(seg[0]/dur*W,0,(seg[1]-seg[0])/dur*W,H); }
  if(peaks && dur){
    const n=peaks.length, bw=W/n;
    for(let i=0;i<n;i++){ const h=Math.max(1,peaks[i]*h0*0.85), c=colorOf(peakSeg[i]);
      ctx2.fillStyle=(i/n<pos)?c[0]:c[1]; ctx2.fillRect(i*bw,top+(h0-h)/2,Math.max(1,bw-0.3),h); }
  }else{ ctx2.fillStyle=TH.empty; ctx2.fillRect(0,top+h0/2-1,W,2); }
  if(dur && multi) segs.forEach((s,k)=>{ if(k===0||!s.ok) return; // 境目
    const x=Math.round(s.start/dur*W);
    ctx2.fillStyle=TH.gap; ctx2.fillRect(x-2,0,4,H);
    ctx2.fillStyle=TH.divider; ctx2.fillRect(x-0.5,0,1,H); });
  if(dur){
    const ms=gmarks();
    ms.forEach((m,i)=>{
      const x=m.t/dur*W, sel=i===selMark;
      ctx2.fillStyle=sel?TH.markSel:TH.mark; ctx2.fillRect(x-1,10,2,H);
      ctx2.beginPath(); ctx2.arc(x,11,9,0,7); ctx2.fill();
      ctx2.fillStyle=TH.markNum; ctx2.font='bold 10px '+TH.font; ctx2.textAlign='center'; ctx2.textBaseline='middle'; ctx2.fillText(i+1,x,11.5);
      if(m.name){
        const nextX = ms[i+1]? ms[i+1].t/dur*W : W;
        const room=nextX-x-16; if(room>24){
          ctx2.font=(sel?'bold ':'')+'12px '+TH.font; ctx2.textAlign='left';
          let t=m.name; while(t.length>1 && ctx2.measureText(t).width>room) t=t.slice(0,-1);
          if(t!==m.name) t=t.slice(0,-1)+'…';
          ctx2.fillStyle=sel?TH.markTextSel:TH.markText; ctx2.fillText(t,x+12,11.5);
        }
      }
    });
    ctx2.fillStyle=TH.head; ctx2.fillRect(pos*W-1,0,2,H);
  }
}
(function loop(){
  if(modelReady){
    $('curT').textContent=fmt(model.currentTime);
    const k=segAt(model.currentTime);
    if(k!==activeSeg){ activeSeg=k; $('trackList').querySelectorAll('li').forEach((l,j)=>l.classList.toggle('active',j===k)); }
    if(!model.paused && $('loopSeg').checked){ const seg=currentSegment(); if(seg && model.currentTime>=seg[1]-0.02) model.currentTime=seg[0]; }
    drawWave();
  }
  requestAnimationFrame(loop);
})();
model.onended=()=>{ const seg=currentSegment(); if($('loopSeg').checked && seg){ model.currentTime=seg[0]; model.play(); } };
window.addEventListener('resize',drawWave);

function timeAtX(cx){ const r=canvas.getBoundingClientRect(); return Math.max(0,Math.min(1,(cx-r.left)/r.width))*(model.duration||0); }
let clickT=null;
$('waveWrap').addEventListener('click',e=>{
  const r=canvas.getBoundingClientRect(), dur=model.duration||1, x=e.clientX-r.left, y=e.clientY-r.top;
  const gm=gmarks(), hit=gm.findIndex(m=>Math.abs(m.t/dur*r.width-x)<(y<24?11:6));
  const t=timeAtX(e.clientX);
  clearTimeout(clickT);
  clickT=setTimeout(()=>{ if(hit>=0){ selMark=hit; renderMarks(); playFrom(gm[hit].t);} else model.currentTime=t; },180);
});
$('waveWrap').addEventListener('dblclick',e=>{ clearTimeout(clickT); addMarker(timeAtX(e.clientX)); });
$('waveWrap').addEventListener('mousemove',e=>{ // マウスを乗せるとファイル名が出る
  const k=segs.length>1?segAt(timeAtX(e.clientX)):-1;
  $('waveWrap').title=k>=0?(k+1)+'. '+segs[k].tr.name:'';
});

function playFrom(t){ mine.pause(); model.currentTime=t; model.play(); }
function toggleModel(){ if(!modelReady) return; if(model.paused){ mine.pause(); model.play(); } else model.pause(); }
$('mPlay').onclick=toggleModel;
$('mBack').onclick=()=>model.currentTime=Math.max(0,model.currentTime-3);
$('mFwd').onclick=()=>model.currentTime=Math.min(model.duration||0,model.currentTime+3);
$('addMark').onclick=()=>addMarker(model.currentTime);
$('loopSeg').onchange=drawWave;

/* ---------- 印 ---------- */
/* 印は音源ごとに（その音源の中の秒数で）保存し、表示はつなげた全体の時間に直して並べる。
   こうしておくと音源を並べ替えても印は自分の音源についていく */
function gmarks(){
  const out=[];
  segs.forEach((s,k)=>{ if(s.ok) s.tr.markers.forEach(m=>out.push({m,k,t:s.start+Math.min(m.t,s.dur),name:m.name})); });
  return out.sort((a,b)=>a.t-b.t);
}
function addMarker(t){
  if(!modelReady) return;
  if(gmarks().some(g=>Math.abs(g.t-t)<0.15)) return;
  const k=segAt(t); if(k<0) return;
  const s=segs[k], m={t:Math.max(0,Math.min(s.dur,t-s.start)),name:''};
  s.tr.markers.push(m); s.tr.markers.sort((a,b)=>a.t-b.t);
  selMark=gmarks().findIndex(g=>g.m===m);
  touch(); renderMarks(); toast('印 '+(selMark+1)+' をつけました'+(matchMedia('(hover: hover)').matches?'（N キーで名前を入力）':''));
}
function selectedMarkTime(){ const g=gmarks()[selMark]; return g?g.t:0; }
function currentSegment(){
  const ms=gmarks(); if(selMark<0||!ms[selMark]) return null;
  return [ms[selMark].t, ms[selMark+1]?ms[selMark+1].t:(model.duration||totalDur())];
}
function focusMarkName(i){ const inp=$('markers').querySelectorAll('input')[i]; if(inp){ inp.focus(); inp.select(); } }
function renderMarks(){
  const ul=$('markers'); ul.innerHTML='';
  const gm=gmarks();
  $('noMarks').style.display=gm.length?'none':'block';
  $('trackList').querySelectorAll('.tmeta').forEach((e,i)=>e.textContent=trackMeta(i));
  gm.forEach((g,i)=>{
    const m=g.m, li=document.createElement('li'); if(i===selMark) li.className='active';
    if(segs.length>1){ li.classList.add('multi'); li.style.setProperty('--tc',colorOf(g.k)[0]); }
    li.innerHTML=`<span class="mnum">${i+1}</span><button class="small mplay" title="ここから再生" aria-label="印 ${i+1} から再生">${ic('play')}</button><span class="mtime">${fmt(g.t)}</span>
      <input placeholder="名前をつける（例：Intro／the weather の th）" maxlength="60" aria-label="印 ${i+1} の名前">
      <span class="macts"><button class="x" title="0.2秒前へ">−0.2</button><button class="x" title="0.2秒後ろへ">+0.2</button><button class="x" title="削除" aria-label="印 ${i+1} を削除">${ic('x')}</button></span>`;
    const [play,minus,plus,del]=li.querySelectorAll('button');
    const inp=li.querySelector('input'); inp.value=m.name||'';
    const reselect=()=>{ selMark=gmarks().findIndex(x=>x.m===m); renderMarks(); playFrom(selectedMarkTime()); };
    inp.oninput=()=>{ m.name=inp.value; drawWave(); };
    inp.onchange=()=>{ m.name=inp.value.trim(); touch(); };
    inp.onkeydown=e=>{ if(e.key==='Enter'||e.key==='Escape'){ e.preventDefault(); inp.blur(); } };
    inp.onfocus=()=>{ if(selMark!==i){ selMark=i; ul.querySelectorAll('li').forEach((l,k)=>l.classList.toggle('active',k===i)); } };
    play.onclick=()=>{ selMark=i; renderMarks(); playFrom(g.t); };
    minus.onclick=()=>{ m.t=Math.max(0,m.t-0.2); touch(); reselect(); };
    plus.onclick=()=>{ m.t=Math.min(segs[g.k].dur,m.t+0.2); touch(); reselect(); };
    del.onclick=()=>{ const a=segs[g.k].tr.markers; a.splice(a.indexOf(m),1); const n=gmarks().length; if(selMark>=n) selMark=n-1; touch(); renderMarks(); };
    ul.appendChild(li);
  });
  drawWave();
}

/* ---------- ショートカット ---------- */
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName) || $('modal').style.display==='flex') return;
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  const k=e.key;
  if(k===' '){ e.preventDefault(); toggleRec(); }
  else if(k==='p'||k==='P'){ playMine(); }
  else if(k==='s'||k==='S'){ if(!$('saveBtn').disabled) saveCurrent(); }
  else if(k==='Enter'){ e.preventDefault(); toggleModel(); }
  else if(k==='m'||k==='M'){ addMarker(model.currentTime); }
  else if(k==='n'||k==='N'){ if(selMark>=0){ e.preventDefault(); focusMarkName(selMark); } }
  else if(k==='ArrowLeft'){ e.preventDefault(); $('mBack').click(); }
  else if(k==='ArrowRight'){ e.preventDefault(); $('mFwd').click(); }
  else if(k===','||k==='<'){ setRate(cur.rate-0.05); toast('速度 '+cur.rate.toFixed(2)+'×'); }
  else if(k==='.'||k==='>'){ setRate(cur.rate+0.05); toast('速度 '+cur.rate.toFixed(2)+'×'); }
  else if(k==='ArrowUp'||k==='ArrowDown'){ e.preventDefault(); ensureGain(); setVol((cur.vol??100)+(k==='ArrowUp'?10:-10)); toast('音量 '+cur.vol+'%'); }
  else if(k==='['||k===']'){ const i=Math.max(0,activeSeg)+(k===']'?1:-1); if(gotoTrack(i)) toast((i+1)+'. '+segs[i].tr.name); }
  else if(/^[1-9]$/.test(k) && gmarks()[+k-1]){ selMark=+k-1; renderMarks(); playFrom(selectedMarkTime()); }
});
document.querySelectorAll('button').forEach(b=>b.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') e.preventDefault(); }));
document.addEventListener('mouseup',()=>{ const a=document.activeElement; if(a && a.tagName==='BUTTON') a.blur(); });
window.addEventListener('beforeunload',()=>{ if(dirty) saveProject(); });

/* ---------- 起動 ---------- */
openDB().then(async()=>{
  let p=null;
  try{ const last=+localStorage.getItem('mimic-last'); if(last) p=await dbGet('projects',last); }catch(e){}
  if(!p){ const all=(await dbAll('projects')).sort((a,b)=>b.updated-a.updated); p=all[0]||null; }
  if(p) await openProject(p); else renderProject();
});
