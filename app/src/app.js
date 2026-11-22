// Mimic iOS アプリだけの仕組み。
// ・課金：無料はプロジェクト1つまで、プレミアム（月額）は無制限。ログインは使わず、Apple ID の購入で判断する
// ・解約しても作ったプロジェクトは消さない（新しく作るのだけ制限する）
// ・オフラインでも、前回確かめた購入状況で使える（期限を過ぎても少しだけ猶予を残す）
// ・iPhone ではダウンロードができないので、書き出しは共有シートで行う
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

const PRODUCT_ID = 'mimic.premium.monthly';   // App Store Connect で作る月額課金の製品 ID
const FREE_PROJECTS = 1;
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;      // 更新を確かめられないときの猶予（3日）
const PLAN_KEY = 'mimic-plan';
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://kento20020.github.io/english-lisening/privacy.html';

const isNative = Capacitor.isNativePlatform();
// ブラウザで動作を確かめるときは window.__mockStore に偽のストアを入れる
const store = isNative ? NativePurchases : (window.__mockStore || null);
const byId = (id) => document.getElementById(id);

let plan = readPlan();
let product = null;
let busy = false;

/* ---------- 購入状況 ---------- */
function readPlan() {
  try {
    const p = JSON.parse(localStorage.getItem(PLAN_KEY));
    if (p && typeof p === 'object') return p;
  } catch (_) { /* 読めなければ無料として扱う */ }
  return { active: false, expires: 0, willCancel: false, checkedAt: 0 };
}

function writePlan() {
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch (_) { /* noop */ }
}

function isPremium() {
  if (!plan.active) return false;
  if (!plan.expires) return true;
  return Date.now() < plan.expires + GRACE_MS;
}

async function refreshPlan() {
  if (store) {
    try {
      const { purchases = [] } = await store.getPurchases({ productType: PURCHASE_TYPE.SUBS, onlyCurrentEntitlements: true });
      const now = Date.now();
      const mine = purchases
        .filter((t) => t.productIdentifier === PRODUCT_ID && !t.revocationDate)
        .map((t) => ({ t, exp: t.expirationDate ? Date.parse(t.expirationDate) : 0 }))
        .sort((a, b) => b.exp - a.exp);
      const best = mine[0];
      plan = {
        active: !!best && (best.t.isActive === true || best.exp > now),
        expires: best ? best.exp : 0,
        willCancel: !!(best && best.t.willCancel),
        checkedAt: now,
      };
      writePlan();
    } catch (e) {
      // オフラインなどで確かめられないときは、前回の結果のまま
      console.warn('購入状況を確認できませんでした', e);
    }
  }
  renderPlan();
}

async function loadProduct() {
  if (!store || product) return product;
  try {
    const { products = [] } = await store.getProducts({ productIdentifiers: [PRODUCT_ID], productType: PURCHASE_TYPE.SUBS });
    product = products.find((p) => p.identifier === PRODUCT_ID) || products[0] || null;
  } catch (e) {
    console.warn('商品情報を読み込めませんでした', e);
  }
  return product;
}

/* ---------- 購入・復元・管理 ---------- */
function setMsg(text) { byId('pwMsg').textContent = text; }

function updateBuyButton() {
  const b = byId('pwBuy');
  const label = byId('pwBuyLabel');
  if (product) {
    label.textContent = `月額 ${product.priceString} で始める`;
    b.disabled = busy;
  } else {
    label.textContent = store ? '価格を読み込んでいます…' : '購入は iPhone のアプリで行えます';
    b.disabled = true;
  }
  byId('pwRestore').disabled = busy || !store;
}

async function buy() {
  if (!store || !product || busy) return;
  busy = true;
  updateBuyButton();
  setMsg('');
  try {
    await store.purchaseProduct({ productIdentifier: PRODUCT_ID, productType: PURCHASE_TYPE.SUBS });
    await refreshPlan();
    if (isPremium()) {
      closePaywall();
      toast('プレミアムになりました。プロジェクトを好きなだけ作れます');
    } else {
      // 保護者の承認待ちなど
      setMsg('購入をまだ確認できません。承認が済んだら、少し待ってから「購入を復元」を押してください。');
    }
  } catch (e) {
    const msg = String((e && (e.message || e.code)) || e);
    if (!/cancel/i.test(msg)) setMsg('購入できませんでした。時間をおいて、もう一度お試しください。');
  } finally {
    busy = false;
    updateBuyButton();
  }
}

async function restore() {
  if (!store || busy) return;
  busy = true;
  updateBuyButton();
  setMsg('確認しています…');
  try { await store.restorePurchases(); } catch (e) { console.warn('復元に失敗', e); }
  await refreshPlan();
  busy = false;
  updateBuyButton();
  if (isPremium()) {
    setMsg('');
    closePaywall();
    toast('購入を復元しました');
  } else {
    setMsg('復元できる購入が見つかりませんでした。購入したときと同じ Apple ID か確かめてください。');
  }
}

async function manage() {
  if (!store) return;
  try { await store.manageSubscriptions(); } catch (e) { toast('管理画面を開けませんでした'); }
}

/* ---------- 画面：プレミアムの案内 ---------- */
function buildPaywall() {
  const tpl = document.createElement('template');
  tpl.innerHTML = `
  <div class="pw-scrim" id="pwScrim" hidden></div>
  <section class="paywall" id="paywall" role="dialog" aria-modal="true" aria-labelledby="pwTitle" hidden>
    <div class="grab" aria-hidden="true"></div>
    <img class="pw-logo" src="logo.svg" alt="" width="56" height="56">
    <h2 id="pwTitle">プロジェクトを、好きなだけ</h2>
    <p class="pw-lead">無料プランで作れるプロジェクトは ${FREE_PROJECTS} つまでです。プレミアムにすると、教材ごと・場面ごとにプロジェクトを分けて練習できます。</p>
    <ul class="pw-list">
      <li>プロジェクトを無制限に作れる</li>
      <li>オフラインでも、そのまま練習できる</li>
      <li>解約しても、作ったプロジェクトは消えずに使える</li>
    </ul>
    <button class="pw-buy" id="pwBuy" disabled><span id="pwBuyLabel">価格を読み込んでいます…</span></button>
    <p class="pw-msg" id="pwMsg" role="status"></p>
    <button class="pw-restore" id="pwRestore">購入を復元</button>
    <p class="pw-fine">プレミアム（1か月・自動更新）。お支払いは Apple ID に請求されます。期間が終わる24時間前までに解約しない限り、同じ料金で毎月自動で更新されます。解約は「設定」アプリ → 自分の名前 → サブスクリプション から、いつでもできます。</p>
    <p class="pw-links"><a href="${TERMS_URL}" target="_blank" rel="noopener">利用規約（EULA）</a><a href="${PRIVACY_URL}" target="_blank" rel="noopener">プライバシーポリシー</a></p>
    <button class="pw-later" id="pwLater">あとで</button>
  </section>`;
  document.body.append(tpl.content);
  byId('pwScrim').addEventListener('click', closePaywall);
  byId('pwLater').addEventListener('click', closePaywall);
  byId('pwBuy').addEventListener('click', buy);
  byId('pwRestore').addEventListener('click', restore);
}

async function openPaywall() {
  // プロジェクト一覧のシートが開いていたら、先に閉じる
  if (document.body.classList.contains('proj-open')) byId('projListBtn').click();
  byId('pwScrim').hidden = false;
  byId('paywall').hidden = false;
  document.body.classList.add('pw-open');
  setMsg('');
  updateBuyButton();
  if (!store) return;
  await loadProduct();
  updateBuyButton();
  if (!product) setMsg('価格を読み込めませんでした。インターネットにつながっているか確かめてください。');
}

function closePaywall() {
  byId('pwScrim').hidden = true;
  byId('paywall').hidden = true;
  document.body.classList.remove('pw-open');
}

/* ---------- 画面：プロジェクト一覧のシートに、いまのプラン ---------- */
function buildPlanBox() {
  const box = document.createElement('div');
  box.className = 'plan';
  box.id = 'planBox';
  document.querySelector('#projPanel .sheet-head').after(box);
}

function renderPlan() {
  const box = byId('planBox');
  if (!box) return;
  const premium = isPremium();
  const date = plan.expires ? new Date(plan.expires).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' }) : '';
  box.classList.toggle('is-premium', premium);
  if (premium) {
    const note = date ? (plan.willCancel ? `${date}まで（自動更新はオフ）` : `次の更新は${date}`) : '';
    box.innerHTML = `
      <div class="plan-text">
        <div class="plan-name">プレミアム</div>
        <div class="plan-sub">プロジェクトを好きなだけ作れます${note ? '。' + note : ''}</div>
      </div>
      <button class="pill small" id="planManage">管理</button>`;
    byId('planManage').addEventListener('click', manage);
  } else {
    box.innerHTML = `
      <div class="plan-text">
        <div class="plan-name">無料プラン</div>
        <div class="plan-sub">プロジェクトは ${FREE_PROJECTS} つまで</div>
        <button class="plan-restore" id="planRestore">購入を復元</button>
      </div>
      <button class="pill small plan-up" id="planUpgrade">プレミアム</button>`;
    byId('planUpgrade').addEventListener('click', openPaywall);
    byId('planRestore').addEventListener('click', async () => {
      await openPaywall();
      restore();
    });
  }
}

/* ---------- 書き出し（共有シート） ---------- */
function blobToBase64(blob) {
  return new Promise((ok, ng) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => ng(r.error);
    r.readAsDataURL(blob);
  });
}

async function saveFile(blob, name) {
  const safe = String(name || 'mimic').replace(/[\\/:*?"<>|]/g, '_');
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safe;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  try {
    const data = await blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({ path: safe, data, directory: Directory.Cache });
    await Share.share({ title: safe, files: [uri] });
  } catch (e) {
    if (!/cancel/i.test(String(e && e.message))) toast('ファイルを書き出せませんでした');
  }
}

/* ---------- Mimic（仕組み側）との接続 ---------- */
window.MimicHooks = {
  async beforeCreateProject() {
    if (isPremium()) return true;
    const count = (await dbAll('projects')).length;
    if (count < FREE_PROJECTS) return true;
    openPaywall();
    return false;
  },
  saveFile,
};

// アプリが裏に回るときに、編集中のプロジェクトを保存しておく
function saveNow() {
  try { if (typeof dirty !== 'undefined' && dirty) saveProject(); } catch (_) { /* noop */ }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

if (isNative) {
  App.addListener('pause', saveNow);
  App.addListener('resume', () => { refreshPlan(); });
  // 更新・解約・家族の購入などが届いたとき
  NativePurchases.addListener('transactionUpdated', () => { refreshPlan(); });
}

buildPaywall();
buildPlanBox();
renderPlan();
refreshPlan();

// 動作確認用（ブラウザの開発者ツールから）
window.MimicApp = { isPremium, refreshPlan, openPaywall, get plan() { return plan; } };
