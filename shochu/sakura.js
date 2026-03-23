// ══════════════════════════════════════════════════
// サクラ — Terroir HUB SHOCHU AIコンシェルジュ
// 全蒸留所の知識を保有し、どのページからでも回答可能
// ══════════════════════════════════════════════════

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

let SAKURA_KB = [];
let SAKURA_READY = false;
let SAKURA_CURRENT = null;
let SAKURA_OPENED = false;

// ── ナレッジベース読み込み ──
async function sakuraInit(currentDistilleryId) {
  SAKURA_CURRENT = currentDistilleryId;
  try {
    // sakura_kb.json を読み込み（CDNキャッシュ有効）
    const res = await fetch('./sakura_kb.json');
    if (res.ok) {
      SAKURA_KB = await res.json();
      SAKURA_READY = true;
      console.log(`サクラ: ${SAKURA_KB.length}蒸留所のデータを読み込みました`);
    }
  } catch (e) {
    console.warn('サクラ: ナレッジベース読み込みエラー', e);
  }
}

// ── 蔵を検索 ──
function sakuraFind(id) {
  return SAKURA_KB.find(b => b.id === id);
}

function sakuraFindByName(query) {
  const q = query.toLowerCase();
  return SAKURA_KB.find(b =>
    b.name && q.includes(b.name) ||
    b.brand && q.includes(b.brand) ||
    b.name_en && q.includes(b.name_en.toLowerCase()) ||
    b.company && q.includes(b.company)
  );
}

function sakuraSearch(query) {
  const q = query.toLowerCase();
  return SAKURA_KB.filter(b =>
    (b.name && b.name.toLowerCase().includes(q)) ||
    (b.brand && b.brand.toLowerCase().includes(q)) ||
    (b.name_en && b.name_en.toLowerCase().includes(q)) ||
    (b.area && b.area.includes(q)) ||
    (b.region && b.region.includes(q)) ||
    (b.desc && b.desc.includes(q)) ||
    (b.water && b.water.includes(q)) ||
    (b.rice && b.rice.includes(q))
  );
}

// ── 地域別蔵元一覧 ──
function sakuraByArea(area) {
  return SAKURA_KB.filter(b => b.area === area);
}

function sakuraByRegion(region) {
  return SAKURA_KB.filter(b => b.region === region);
}

// ── 近くの蔵元 ──
function sakuraNearby(breweryId, limit = 5) {
  const current = sakuraFind(breweryId);
  if (!current) return [];
  return SAKURA_KB.filter(b => b.area === current.area && b.id !== breweryId).slice(0, limit);
}

// ── 銘柄検索 ──
function sakuraFindBrand(query) {
  const q = query.toLowerCase();
  const results = [];
  SAKURA_KB.forEach(b => {
    if (b.brands) {
      b.brands.forEach(brand => {
        if (brand.name && brand.name.toLowerCase().includes(q)) {
          results.push({ brewery: b, brand: brand });
        }
      });
    }
  });
  return results;
}

// ── 味わいで検索 ──
function sakuraByTaste(taste) {
  const q = taste.toLowerCase();
  const results = [];
  SAKURA_KB.forEach(b => {
    if (b.brands) {
      b.brands.forEach(brand => {
        if (brand.desc && brand.desc.toLowerCase().includes(q)) {
          results.push({ brewery: b, brand: brand });
        }
      });
    }
  });
  return results;
}

// ── 統計情報 ──
function sakuraStats() {
  const total = SAKURA_KB.length;
  const regions = {};
  const areas = {};
  let totalBrands = 0;
  let oldestYear = 9999;
  let oldestName = '';

  SAKURA_KB.forEach(b => {
    const r = b.region || '不明';
    regions[r] = (regions[r] || 0) + 1;
    const a = b.area || '不明';
    areas[a] = (areas[a] || 0) + 1;
    if (b.brands) totalBrands += b.brands.length;
    const y = parseInt(b.founded);
    if (!isNaN(y) && y < oldestYear) { oldestYear = y; oldestName = b.name; }
  });

  return { total, regions, areas, totalBrands, oldestYear, oldestName };
}

// ══════════════════════════════════════════════════
// チャットUI
// ══════════════════════════════════════════════════

function openPanel() {
  document.getElementById('overlay').classList.add('open');
  // Freeユーザーに控えめなPro誘導バナーを表示
  var plan = (window.thubAuth && window.thubAuth.plan) || 'free';
  var nudge = document.getElementById('sakura-pro-nudge');
  if (nudge) { nudge.style.display = plan === 'free' ? 'block' : 'none'; }
  if (!SAKURA_OPENED) {
    SAKURA_OPENED = true;
    const b = sakuraFind(SAKURA_CURRENT);
    const stats = sakuraStats();
    var profile = getTasteProfile();
    var nickname = window.thubGetNickname ? window.thubGetNickname() : '';
    var nameCall = nickname ? nickname + 'さん' : '';
    let greeting = '🌸 ' + (nameCall ? nameCall + '、こんにちは！' : 'こんにちは！') + 'サクラです。日本酒のことなら何でも聞いてください。\n\n';
    if (b) {
      greeting += b.name + '（' + (b.founded_era || '') + '創業）のページへようこそ。\n';
      greeting += '代表銘柄「' + b.brand + '」をはじめ、';
    }
    greeting += '全' + stats.total + '蔵・' + stats.totalBrands + '銘柄の情報をお伝えできます。\n\n';
    if (profile) {
      greeting += (nameCall ? nameCall + 'の' : '') + '前回の味覚診断の結果を覚えていますよ！おすすめを聞いてみてください。\n';
    } else {
      greeting += '🍶 まずは「私に合う酒を診断」してみませんか？3つの質問で' + (nameCall ? nameCall + 'に' : 'あなたに') + 'ぴったりの日本酒を見つけます。';
    }
    addMsg('butler', greeting);
    renderSugs();
  }
}

function closePanel() {
  document.getElementById('overlay').classList.remove('open');
}

function addMsg(role, text) {
  const chat = document.getElementById('chat');
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  const avatar = role === 'butler' ? '桜' : 'You';
  d.innerHTML = '<div class="av">' + avatar + '</div><div class="bubble">' + escHtml(text).replace(/\n/g, '<br>') + '</div>';
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function showTyping() {
  const chat = document.getElementById('chat');
  const d = document.createElement('div');
  d.className = 'msg butler';
  d.id = 'sakura-typing';
  d.innerHTML = '<div class="av">桜</div><div class="bubble"><div class="typing"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>';
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('sakura-typing');
  if (el) el.remove();
}

function renderSugs() {
  const b = sakuraFind(SAKURA_CURRENT);
  const profile = getTasteProfile();
  const sugs = profile ? [
    '自分に合うおすすめ',
    'この蔵の代表銘柄は？',
    '近くの蔵を教えて',
    'フルーティーな酒を探して',
    '刺身に合う辛口を探して',
    '好みリセット',
  ] : [
    '🌸 私に合う酒を診断',
    'この蔵の代表銘柄は？',
    '近くの蔵を教えて',
    '純米と吟醸の違いは？',
    'ぬる燗って何度？',
    '日本酒の造り方',
    '新潟で酒蔵巡り',
    '獺祭と八海山の違いは？',
  ];
  document.getElementById('sugs').innerHTML = sugs.map(s =>
    '<button class="sug" onclick="askSug(this.textContent)">' + escHtml(s) + '</button>'
  ).join('');
}

function askSug(q) {
  addMsg('user', q);
  showTyping();
  routeQuestion(q);
}

// 会話履歴（API送信用）
let SAKURA_HISTORY = [];

function sendMsg() {
  const inp = document.getElementById('chat-inp');
  const q = inp.value.trim();
  if (!q) return;
  inp.value = '';
  addMsg('user', q);
  showTyping();
  routeQuestion(q);
}

// 質問のルーティング: API or ローカル
function routeQuestion(q) {
  if (!window.thubCheckSakuraLimit) {
    // features.js未読み込み → ローカル応答
    setTimeout(function(){ hideTyping(); respond(q); }, 500);
    return;
  }

  var result = window.thubCheckSakuraLimit();

  if (result === true) {
    // ログイン済み＋クレジットあり → Claude API
    askClaude(q);
  } else {
    // false: 未ログインorクレジット切れ → モーダル表示済み
    hideTyping();
  }
}

// ══════════════════════════════════════════════════
// 味覚プロファイル（localStorage永続化）
// ══════════════════════════════════════════════════

const TASTE_KEY = 'sakura_taste_profile';

function getTasteProfile() {
  try { return JSON.parse(localStorage.getItem(TASTE_KEY)) || null; } catch(e) { return null; }
}

function saveTasteProfile(profile) {
  localStorage.setItem(TASTE_KEY, JSON.stringify(profile));
}

let TASTE_ONBOARDING_STEP = 0;
let TASTE_ONBOARDING_DATA = {};

function startTasteOnboarding() {
  TASTE_ONBOARDING_STEP = 1;
  TASTE_ONBOARDING_DATA = {};
  addMsg('butler', '🌸 あなたにぴったりの日本酒を見つけるために、3つだけ質問させてください！\n\n【Q1】味わいの好みは？\n\n① 辛口・キレのある味\n② まろやか・旨味のある味\n③ フルーティー・華やかな味\n④ まだよくわからない');
  // Replace suggestions
  document.getElementById('sugs').innerHTML =
    '<button class="sug" onclick="answerTaste(1)">① 辛口</button>' +
    '<button class="sug" onclick="answerTaste(2)">② まろやか</button>' +
    '<button class="sug" onclick="answerTaste(3)">③ フルーティー</button>' +
    '<button class="sug" onclick="answerTaste(4)">④ わからない</button>';
}

function answerTaste(n) {
  if (TASTE_ONBOARDING_STEP === 1) {
    TASTE_ONBOARDING_DATA.taste = ['dry','umami','fruity','neutral'][n-1];
    addMsg('user', ['辛口','まろやか','フルーティー','わからない'][n-1]);
    TASTE_ONBOARDING_STEP = 2;
    addMsg('butler', '【Q2】飲む温度帯は？\n\n① 冷酒（キリッと冷やして）\n② 常温〜ぬる燗\n③ 熱燗（温かく）\n④ いろいろ試したい');
    document.getElementById('sugs').innerHTML =
      '<button class="sug" onclick="answerTaste(1)">① 冷酒</button>' +
      '<button class="sug" onclick="answerTaste(2)">② 常温〜ぬる燗</button>' +
      '<button class="sug" onclick="answerTaste(3)">③ 熱燗</button>' +
      '<button class="sug" onclick="answerTaste(4)">④ いろいろ</button>';
  } else if (TASTE_ONBOARDING_STEP === 2) {
    TASTE_ONBOARDING_DATA.temp = ['cold','room','hot','any'][n-1];
    addMsg('user', ['冷酒','常温〜ぬる燗','熱燗','いろいろ'][n-1]);
    TASTE_ONBOARDING_STEP = 3;
    addMsg('butler', '【Q3】一緒に楽しむのは？\n\n① 刺身・寿司など和食\n② 肉料理・洋食\n③ チーズ・おつまみ系\n④ お酒だけで楽しむ');
    document.getElementById('sugs').innerHTML =
      '<button class="sug" onclick="answerTaste(1)">① 和食</button>' +
      '<button class="sug" onclick="answerTaste(2)">② 肉・洋食</button>' +
      '<button class="sug" onclick="answerTaste(3)">③ チーズ・つまみ</button>' +
      '<button class="sug" onclick="answerTaste(4)">④ 酒だけ</button>';
  } else if (TASTE_ONBOARDING_STEP === 3) {
    TASTE_ONBOARDING_DATA.food = ['washoku','meat','cheese','solo'][n-1];
    addMsg('user', ['和食','肉・洋食','チーズ・つまみ','酒だけ'][n-1]);
    TASTE_ONBOARDING_STEP = 0;
    saveTasteProfile(TASTE_ONBOARDING_DATA);
    // Generate recommendation
    const rec = generateRecommendation(TASTE_ONBOARDING_DATA);
    addMsg('butler', rec);
    renderSugs();
  }
}

function generateRecommendation(profile) {
  let typeFilter = [];
  let tempRec = '';
  let foodRec = '';

  // Taste → type mapping
  if (profile.taste === 'dry') { typeFilter = ['本醸造','特別本醸造','辛口','ドライ']; }
  else if (profile.taste === 'umami') { typeFilter = ['純米酒','純米','特別純米','山廃','生酛']; }
  else if (profile.taste === 'fruity') { typeFilter = ['純米大吟醸','大吟醸','純米吟醸','吟醸']; }
  else { typeFilter = ['純米吟醸','純米酒']; }

  // Find matching brands
  const matches = [];
  SAKURA_KB.forEach(function(b) {
    if (!b.brands || !Array.isArray(b.brands)) return;
    b.brands.forEach(function(br) {
      if (typeof br !== 'object') return;
      const t = (br.type || '') + (br.specs || '') + (br.desc || '');
      if (typeFilter.some(function(tf) { return t.includes(tf); })) {
        matches.push({ brewery: b, brand: br });
      }
    });
  });

  // Shuffle and pick top 5
  const shuffled = matches.sort(function() { return 0.5 - Math.random(); });
  const top = shuffled.slice(0, 5);

  let a = '🌸 あなたの好みに合わせたおすすめです！\n\n';
  a += '【あなたのプロファイル】\n';
  a += '味わい：' + {dry:'辛口・キレ',umami:'まろやか・旨味',fruity:'フルーティー・華やか',neutral:'バランス型'}[profile.taste] + '\n';
  a += '温度：' + {cold:'冷酒',room:'常温〜ぬる燗',hot:'熱燗',any:'オールラウンド'}[profile.temp] + '\n';
  a += '料理：' + {washoku:'和食',meat:'肉・洋食',cheese:'チーズ・つまみ',solo:'酒単体'}[profile.food] + '\n\n';

  if (top.length > 0) {
    a += '【おすすめ銘柄】\n';
    top.forEach(function(r) {
      a += '\n■ ' + r.brewery.name + '「' + r.brand.name + '」\n';
      if (r.brand.type) a += '　' + r.brand.type;
      if (r.brand.specs) a += '（' + r.brand.specs + '）';
      a += '\n　📍 ' + r.brewery.region + ' ' + (r.brewery.area || '');
      a += '\n　→ /shochu/' + r.brewery.region_slug + '/' + r.brewery.id + '.html\n';
    });
  } else {
    a += 'まだ十分なデータがありませんが、以下をお試しください：\n';
    if (profile.taste === 'fruity') a += '・純米大吟醸や純米吟醸を冷酒で\n';
    else if (profile.taste === 'dry') a += '・本醸造や辛口純米を常温〜ぬる燗で\n';
    else a += '・純米酒をぬる燗で\n';
  }

  a += '\n💡 「もっとおすすめ」と聞くと、別の銘柄を提案します。';
  return a;
}

// ══════════════════════════════════════════════════
// ソムリエモード（条件検索）
// ══════════════════════════════════════════════════

function sommelierSearch(q) {
  const ql = q.toLowerCase();
  let typeKeywords = [];
  let regionKeywords = [];
  let foodKeywords = [];
  let results = [];

  // Type detection
  if (ql.match(/辛口|ドライ|キレ|dry|crisp/)) typeKeywords.push('辛口','本醸造','ドライ');
  if (ql.match(/甘口|甘い|sweet/)) typeKeywords.push('甘口','甘');
  if (ql.match(/フルーティ|華やか|fruity|aromatic/)) typeKeywords.push('吟醸','フルーティ','華やか');
  if (ql.match(/コク|旨味|umami|rich/)) typeKeywords.push('純米','旨味','コク');
  if (ql.match(/大吟醸/)) typeKeywords.push('大吟醸');
  if (ql.match(/純米/)) typeKeywords.push('純米');
  if (ql.match(/にごり/)) typeKeywords.push('にごり');
  if (ql.match(/スパークリング|泡/)) typeKeywords.push('スパークリング','発泡');
  if (ql.match(/古酒|熟成/)) typeKeywords.push('古酒','熟成');
  if (ql.match(/生酒|なま/)) typeKeywords.push('生酒','生');
  if (ql.match(/生酛|きもと|山廃/)) typeKeywords.push('生酛','山廃');

  // Region detection
  var regionNames = {};
  SAKURA_KB.forEach(function(b) { if (b.region) regionNames[b.region] = true; });
  Object.keys(regionNames).forEach(function(r) { if (ql.includes(r.replace('県','').replace('府','').replace('都',''))) regionKeywords.push(r); });

  // Food detection
  if (ql.match(/魚|刺身|寿司|sashimi|fish/)) foodKeywords.push('刺身','魚');
  if (ql.match(/肉|ステーキ|meat|steak/)) foodKeywords.push('肉','ステーキ');
  if (ql.match(/チーズ|cheese/)) foodKeywords.push('チーズ');
  if (ql.match(/鍋|おでん|煮物/)) foodKeywords.push('燗','純米');
  if (ql.match(/天ぷら|tempura/)) foodKeywords.push('吟醸');

  // Search
  SAKURA_KB.forEach(function(b) {
    if (!b.brands || !Array.isArray(b.brands)) return;
    if (regionKeywords.length > 0 && !regionKeywords.some(function(r) { return b.region === r; })) return;

    b.brands.forEach(function(br) {
      if (typeof br !== 'object') return;
      var text = (br.type||'') + ' ' + (br.specs||'') + ' ' + (br.desc||'') + ' ' + (br.name||'');
      var score = 0;
      typeKeywords.forEach(function(kw) { if (text.includes(kw)) score += 2; });
      foodKeywords.forEach(function(kw) { if (text.includes(kw)) score += 1; });
      if (score > 0) results.push({ brewery: b, brand: br, score: score });
    });
  });

  results.sort(function(a, b) { return b.score - a.score; });
  return results.slice(0, 6);
}

// ══════════════════════════════════════════════════
// 比較モード
// ══════════════════════════════════════════════════

function compareBreweries(q) {
  var ql = q.toLowerCase();
  // Find two brewery names in the question
  var found = [];
  SAKURA_KB.forEach(function(b) {
    if (found.length >= 2) return;
    if ((b.name && ql.includes(b.name.toLowerCase())) ||
        (b.brand && ql.includes(b.brand.toLowerCase()))) {
      if (!found.some(function(f) { return f.id === b.id; })) found.push(b);
    }
  });

  if (found.length < 2) return null;

  var a = '【比較】' + found[0].name + ' vs ' + found[1].name + '\n\n';
  a += '┌─────────────┬──────────────┬──────────────┐\n';
  a += '│             │ ' + found[0].name.padEnd(10) + ' │ ' + found[1].name.padEnd(10) + ' │\n';
  a += '├─────────────┼──────────────┼──────────────┤\n';

  var rows = [
    ['代表銘柄', found[0].brand, found[1].brand],
    ['創業', (found[0].founded||'不明')+'年', (found[1].founded||'不明')+'年'],
    ['所在地', found[0].area||found[0].region||'', found[1].area||found[1].region||''],
  ];
  rows.forEach(function(r) {
    a += '│ ' + r[0].padEnd(10) + ' │ ' + (r[1]||'').padEnd(10) + ' │ ' + (r[2]||'').padEnd(10) + ' │\n';
  });
  a += '└─────────────┴──────────────┴──────────────┘\n\n';

  // Brands comparison
  [0,1].forEach(function(i) {
    var b = found[i];
    a += '■ ' + b.name + 'の銘柄：\n';
    if (b.brands && b.brands.length > 0) {
      b.brands.slice(0,3).forEach(function(br) {
        if (typeof br === 'object') {
          a += '　・' + br.name + (br.type ? '（' + br.type + '）' : '') + '\n';
          if (br.specs) a += '　　' + br.specs + '\n';
        }
      });
    }
    a += '\n';
  });

  a += '詳しくはそれぞれのページをご覧ください：\n';
  a += '→ /shochu/' + found[0].region_slug + '/' + found[0].id + '.html\n';
  a += '→ /shochu/' + found[1].region_slug + '/' + found[1].id + '.html';

  return a;
}

// ══════════════════════════════════════════════════
// 旅プランナー
// ══════════════════════════════════════════════════

function planTrip(q) {
  var ql = q.toLowerCase();
  // Detect target region
  var targetRegion = null;
  var regionNames = {};
  SAKURA_KB.forEach(function(b) { if (b.region) regionNames[b.region] = true; });
  Object.keys(regionNames).forEach(function(r) {
    var short = r.replace('県','').replace('府','').replace('都','').replace('道','');
    if (ql.includes(short)) targetRegion = r;
  });

  if (!targetRegion) return null;

  // Find visitable breweries in region
  var visitable = SAKURA_KB.filter(function(b) {
    return b.region === targetRegion && b.visit && b.visit !== '—' &&
           !b.visit.includes('不可') && !b.visit.includes('実施していない');
  });

  var allInRegion = SAKURA_KB.filter(function(b) { return b.region === targetRegion; });

  var a = '🗺️ 【' + targetRegion + '酒蔵巡りプラン】\n\n';
  a += targetRegion + 'には' + allInRegion.length + '蔵があります。\n';

  if (visitable.length > 0) {
    a += '見学・体験ができる蔵は' + visitable.length + '蔵：\n\n';

    // Group by area
    var byArea = {};
    visitable.forEach(function(b) {
      var area = b.area || '不明';
      if (!byArea[area]) byArea[area] = [];
      byArea[area].push(b);
    });

    Object.keys(byArea).sort().forEach(function(area) {
      a += '📍 ' + area + 'エリア\n';
      byArea[area].slice(0, 3).forEach(function(b) {
        a += '　・' + b.name + '「' + b.brand + '」\n';
        a += '　　見学：' + b.visit + '\n';
        if (b.address) a += '　　住所：' + b.address + '\n';
        if (b.nearest_station) a += '　　最寄り：' + b.nearest_station + '\n';
        a += '\n';
      });
    });

    a += '💡 おすすめルート：\n';
    var areas = Object.keys(byArea);
    if (areas.length >= 2) {
      a += '午前：' + areas[0] + 'エリア（' + byArea[areas[0]][0].name + '）\n';
      a += '午後：' + areas[Math.min(1, areas.length-1)] + 'エリア（' + byArea[areas[Math.min(1, areas.length-1)]][0].name + '）\n';
    } else if (visitable.length >= 2) {
      a += '午前：' + visitable[0].name + '\n';
      a += '午後：' + visitable[1].name + '\n';
    }
    a += '\n⚠️ 見学は要予約の蔵が多いです。必ず公式サイトで事前確認を。';
  } else {
    a += '現在、見学可能な蔵の情報が登録されていません。\n';
    a += '各蔵の公式サイトで最新情報をご確認ください。\n\n';
    a += '代表的な蔵：\n';
    allInRegion.slice(0, 5).forEach(function(b) {
      a += '・' + b.name + '「' + b.brand + '」' + (b.founded ? '（' + b.founded + '年創業）' : '') + '\n';
    });
  }

  return a;
}

// ══════════════════════════════════════════════════
// 日本酒教科書ナレッジ（ローカル応答用）
// ══════════════════════════════════════════════════

const SAKE_TEXTBOOK = {
  types: {
    keywords: ['種類','分類','特定名称','純米大吟醸','大吟醸','純米吟醸','吟醸','本醸造','純米酒','特別純米','特別本醸造','醸造アルコール','type','junmai','ginjo','daiginjo','honjozo'],
    answer: '【日本酒の種類（特定名称酒 8種）】\n\n' +
      '■ 純米系（米・米麹のみ）\n' +
      '・純米大吟醸 — 精米歩合50%以下、吟醸造り。華やかな香りと繊細な味わい\n' +
      '・純米吟醸 — 精米歩合60%以下、吟醸造り。フルーティーで軽やか\n' +
      '・特別純米 — 精米歩合60%以下または特別な製法。個性ある旨味\n' +
      '・純米酒 — 米の旨味とコクが特徴。燗酒にも向く\n\n' +
      '■ アル添系（米・米麹＋醸造アルコール）\n' +
      '・大吟醸 — 精米歩合50%以下。香り高く繊細\n' +
      '・吟醸 — 精米歩合60%以下。すっきりした飲み口\n' +
      '・特別本醸造 — 精米歩合60%以下。キレよく食中酒向き\n' +
      '・本醸造 — 精米歩合70%以下。万能で温度帯も広い\n\n' +
      '詳しくはこちら → /shochu/guide/types.html'
  },
  seimaibuai: {
    keywords: ['精米歩合','精米','磨き','削','polishing','rice polishing'],
    answer: '【精米歩合とは？】\n\n' +
      '玄米を削って残った割合のことです。\n\n' +
      '例：精米歩合50% = 米の半分を削った\n' +
      '例：精米歩合35% = 米の65%を削った\n\n' +
      '米の外側にはタンパク質や脂肪が含まれ、これが雑味の原因に。\n' +
      '削るほど雑味が減り、クリアで華やかな味わいになります。\n\n' +
      '・50%以下 → 大吟醸クラス\n' +
      '・60%以下 → 吟醸クラス\n' +
      '・70%以下 → 本醸造クラス'
  },
  brewing: {
    keywords: ['造り方','製造','工程','作り方','並行複発酵','麹','酵母','三段仕込','酒母','もろみ','brewing','process','how.*made','fermentation','koji'],
    answer: '【日本酒の造り方（6工程・約60日間）】\n\n' +
      '① 精米・蒸米 — 米を磨いて蒸す\n' +
      '② 製麹 — 蒸し米に麹菌をつけ、48時間で麹を造る\n' +
      '③ 酒母造り — 酵母を大量培養する\n' +
      '④ 三段仕込み — 3回に分けて麹・蒸し米・水を加える\n' +
      '⑤ 発酵 — 20〜30日間、並行複発酵でアルコールが生まれる\n' +
      '⑥ 上槽・火入れ・貯蔵 — 搾って、加熱して、熟成\n\n' +
      '★ 並行複発酵：糖化（デンプン→糖）と発酵（糖→アルコール）が同時進行。\n' +
      'これは世界で日本酒だけの技術で、醸造酒として世界最高の約20%のアルコール度数を実現します。\n\n' +
      '詳しくはこちら → /shochu/guide/brewing.html'
  },
  temperature: {
    keywords: ['温度','冷酒','燗','熱燗','ぬる燗','人肌','雪冷え','花冷え','飛び切り','冷や','常温','温めて','温かい','temperature','hot sake','cold sake','warm'],
    answer: '【日本酒の温度帯（10段階）】\n\n' +
      '■ 冷酒\n' +
      '・雪冷え（5℃）— キンキンに冷えた状態\n' +
      '・花冷え（10℃）— 吟醸酒の香りが楽しめる定番温度\n' +
      '・涼冷え（15℃）— 利き酒はこの温度で\n\n' +
      '■ 常温（冷や）\n' +
      '・20〜25℃ — お酒の本来の味がわかる\n\n' +
      '■ 燗酒\n' +
      '・日向燗（30℃）— ほんのり温かい\n' +
      '・人肌燗（35℃）— 体温と同じ、燗酒入門に\n' +
      '・ぬる燗（40℃）— 一番人気。まろやかで料理に合う\n' +
      '・上燗（45℃）— 香り立つ\n' +
      '・熱燗（50℃）— キリッとした飲み口、冬向き\n' +
      '・飛び切り燗（55℃）— 力強い辛口\n\n' +
      '★ 同じお酒でも温度で全然違う味に！ぜひ飲み比べを。\n\n' +
      '詳しくはこちら → /shochu/guide/temperature.html'
  },
  pairing: {
    keywords: ['合う料理','ペアリング','つまみ','おつまみ','合わせ','料理','食事','pair','food','match'],
    answer: '【日本酒×料理 ペアリングの基本】\n\n' +
      '■ 3つの法則\n' +
      '① 同調 — 甘い料理×甘口、こってり×コクのある純米酒\n' +
      '② 補完 — 脂っこい料理×酸味のある酒、淡泊×繊細な吟醸\n' +
      '③ 洗い流し — 濃い味のあと×辛口で口をリセット\n\n' +
      '■ 種類別のおすすめ\n' +
      '・大吟醸 → 白身刺身、カルパッチョ、フルーツ\n' +
      '・吟醸 → 天ぷら、蒸し鶏、サラダ\n' +
      '・純米酒 → 煮物、焼き鳥タレ、チーズ\n' +
      '・本醸造 → 刺身全般、焼き魚、おでん、餃子\n' +
      '・生酛/山廃 → ジビエ、ブルーチーズ、すき焼き\n' +
      '・にごり/スパークリング → カレー、麻婆豆腐、チョコ\n\n' +
      '詳しくはこちら → /shochu/guide/pairing.html'
  },
  history_sake: {
    keywords: ['日本酒の歴史','起源','いつから','始まり','発祥','origin','history of sake'],
    answer: '【日本酒の歴史】\n\n' +
      '・弥生時代（3世紀頃）— 稲作伝来とともに酒造りが始まる\n' +
      '・奈良時代（8世紀）— 麹を使った酒造り確立、朝廷に「造酒司」設置\n' +
      '・室町時代（15世紀）— 僧坊酒の技術革新。火入れ（加熱殺菌）開始（パスツールより300年先行！）\n' +
      '・江戸時代 — 灘・伏見が二大銘醸地に。「宮水」発見、「寒造り」定着\n' +
      '・明治〜昭和 — 醸造試験所設立、科学的酒造り。全国新酒鑑評会開始\n' +
      '・平成 — 地酒ブーム到来。十四代・獺祭など個性派の台頭\n' +
      '・令和 — 輸出額410億円突破。世界のSAKEへ。Kura Master、IWCなど国際評価\n\n' +
      '詳しくはこちら → /shochu/guide/history.html'
  },
  kansake: {
    keywords: ['燗のつけ方','燗の作り方','燗にする','温め方','how.*warm','how.*heat'],
    answer: '【おいしい燗のつけ方】\n\n' +
      '① 鍋にお湯を沸かし、火を止める\n' +
      '② 徳利にお酒を入れ、お湯に浸す（湯煎）\n' +
      '③ 温度の目安：底を触って「やや熱い」→約45℃\n' +
      '④ 電子レンジより湯煎がおすすめ（均一に温まる）\n\n' +
      '★ 酒器でも味が変わる！\n' +
      '・冷酒 → ガラスや錫の薄い器\n' +
      '・燗酒 → 陶器の厚みのある器'
  },
  ingredients: {
    keywords: ['原料','材料','何から','米麹','酒米','山田錦','五百万石','雄町','ingredient','rice type','yamada'],
    answer: '【日本酒の原料】\n\n' +
      '■ 米（酒造好適米）\n' +
      '食用米より粒が大きく、中心に「心白」というデンプン質の塊がある。\n' +
      '・山田錦 — 酒米の王様。兵庫県が主産地\n' +
      '・五百万石 — 新潟を中心に東日本で広く使用\n' +
      '・雄町 — 岡山原産の最古の酒米。ふくよかな味わい\n' +
      '・美山錦 — 長野生まれ。軽快で飲みやすい酒に\n\n' +
      '■ 水（仕込み水）\n' +
      '日本酒の約80%は水。\n' +
      '・硬水 → 辛口に（例：灘の宮水）\n' +
      '・軟水 → まろやかに（例：伏見の伏水）\n\n' +
      '■ 麹菌（黄麹菌）\n' +
      '2006年に「国菌」認定。米のデンプンを糖に変える力で酒造りを可能にする。'
  },
  glossary_common: {
    keywords: ['生酒','にごり','原酒','古酒','ひやおろし','新酒','しぼりたて','無濾過','生酛','山廃','nama','nigori','genshu','koshu'],
    answer: '【日本酒の用語集】\n\n' +
      '・生酒（なまざけ）— 火入れ（加熱処理）をしない酒。フレッシュで華やか\n' +
      '・にごり酒 — 粗い目で搾り、白く濁った酒。クリーミーな味わい\n' +
      '・原酒（げんしゅ）— 加水しない酒。アルコール度数17〜20%と高め\n' +
      '・古酒（こしゅ）— 3年以上熟成。琥珀色で複雑な味わい\n' +
      '・ひやおろし — 春に火入れし、夏を越して秋に出荷。まろやかな旨味\n' +
      '・しぼりたて/新酒 — その年に造ったばかりの酒。フレッシュ\n' +
      '・無濾過 — 濾過していない酒。味が濃厚\n' +
      '・生酛/山廃 — 天然の乳酸菌を活かした伝統製法。複雑で奥深い味わい\n\n' +
      '詳しくはこちら → /shochu/guide/glossary.html'
  }
};

function typeKeywordsInQuery(ql) {
  return ql.match(/辛口|甘口|フルーティ|大吟醸|純米|吟醸|にごり|スパークリング|古酒|生酒|生酛|山廃|dry|sweet|fruity|junmai|ginjo|sparkling/);
}

function matchTextbook(q) {
  const ql = q.toLowerCase();
  for (const [key, entry] of Object.entries(SAKE_TEXTBOOK)) {
    for (const kw of entry.keywords) {
      if (kw.includes('.*')) {
        // regex pattern
        try { if (new RegExp(kw, 'i').test(ql)) return entry.answer; } catch(e) {}
      } else if (ql.includes(kw.toLowerCase())) {
        return entry.answer;
      }
    }
  }
  return null;
}

// ══════════════════════════════════════════════════
// 応答ロジック（全蔵横断検索 + 教科書知識）
// ══════════════════════════════════════════════════

function respond(q) {
  if (!SAKURA_READY) {
    addMsg('butler', 'データを読み込み中です。少々お待ちください…');
    return;
  }

  const ql = q.toLowerCase();
  const B = sakuraFind(SAKURA_CURRENT);
  let a = '';

  // ── 味覚プロファイル オンボーディング中 ──
  if (TASTE_ONBOARDING_STEP > 0) {
    // 番号で回答された場合
    const num = parseInt(q);
    if (num >= 1 && num <= 4) { answerTaste(num); return; }
    addMsg('butler', '①〜④の番号で選んでください。');
    return;
  }

  // ── 「おすすめ」「自分に合う」→ プロファイルベースのレコメンド ──
  if (ql.match(/自分に合う|私に合う|おすすめ教えて|おすすめは|レコメンド|好みに|好みを|diagnose|recommend me|my taste/)) {
    const profile = getTasteProfile();
    if (profile) {
      addMsg('butler', generateRecommendation(profile));
    } else {
      startTasteOnboarding();
    }
    return;
  }

  // ── 「もっとおすすめ」→ 再レコメンド ──
  if (ql.match(/もっとおすすめ|他のおすすめ|別の|more recommend/)) {
    const profile = getTasteProfile();
    if (profile) {
      addMsg('butler', generateRecommendation(profile));
    } else {
      startTasteOnboarding();
    }
    return;
  }

  // ── 「好みリセット」 ──
  if (ql.match(/好みリセット|プロファイルリセット|やり直し|reset.*taste|reset.*profile/)) {
    localStorage.removeItem(TASTE_KEY);
    startTasteOnboarding();
    return;
  }

  // ── 比較モード（「AとBの違い」「A vs B」） ──
  if (ql.match(/違い|比較|比べ|vs|versus|difference|compare/)) {
    const comp = compareBreweries(q);
    if (comp) { addMsg('butler', comp); return; }
  }

  // ── 旅プランナー（「○○に行く」「酒蔵巡り」「ツアー」） ──
  if (ql.match(/行く|旅|巡り|ツアー|プラン|ルート|trip|tour|plan|travel|visit.*brew/)) {
    const trip = planTrip(q);
    if (trip) { addMsg('butler', trip); return; }
  }

  // ── ソムリエモード（条件付き検索） ──
  if (ql.match(/探して|見つけて|ある\?|ある？|ありますか|教えて.*酒|find|search|looking for/) ||
      (typeKeywordsInQuery(ql) && ql.length > 6)) {
    const results = sommelierSearch(q);
    if (results.length > 0) {
      let a = '🍶 条件に合う銘柄を見つけました：\n\n';
      results.forEach(function(r) {
        a += '■ ' + r.brewery.name + '「' + r.brand.name + '」\n';
        if (r.brand.type) a += '　' + r.brand.type;
        if (r.brand.specs) a += '（' + r.brand.specs + '）';
        a += '\n　📍 ' + r.brewery.region + ' ' + (r.brewery.area || '') + '\n\n';
      });
      a += '💡 さらに絞りたい場合は、地域名や味の特徴を追加してください。';
      addMsg('butler', a);
      return;
    }
  }

  // ── 教科書（日本酒の基礎知識）への質問チェック ──
  const textbookAnswer = matchTextbook(q);
  if (textbookAnswer) {
    addMsg('butler', textbookAnswer);
    return;
  }

  // ── 他の蔵について聞かれた場合 ──
  const otherBrewery = sakuraFindByName(ql);
  if (otherBrewery && otherBrewery.id !== SAKURA_CURRENT) {
    a = formatBreweryFull(otherBrewery);
  }
  // ── 一覧・統計 ──
  else if (ql.includes('一覧') || ql.includes('全部') || ql.includes('リスト') || ql.includes('何蔵') || ql.includes('いくつ')) {
    const stats = sakuraStats();
    a = '現在、' + stats.total + '蔵の情報を保有しています。\n\n';
    Object.keys(stats.areas).sort().forEach(area => {
      a += '【' + area + '】' + stats.areas[area] + '蔵\n';
      sakuraByArea(area).forEach(b => {
        a += '　・' + b.name + '（' + b.brand + '）' + b.founded + '年\n';
      });
      a += '\n';
    });
  }
  // ── 辛口 ──
  else if (ql.includes('辛口') || ql.includes('ドライ') || ql.includes('キレ') || ql.includes('dry')) {
    const results = sakuraByTaste('辛口');
    a = '辛口の日本酒でおすすめ：\n\n';
    results.slice(0, 5).forEach(r => {
      a += '・' + r.brewery.name + '「' + r.brand.name + '」\n　' + r.brand.desc + '\n\n';
    });
    if (results.length === 0) a = '辛口の銘柄情報は現在準備中です。';
  }
  // ── 甘口・フルーティ ──
  else if (ql.includes('甘口') || ql.includes('フルーティ') || ql.includes('甘い') || ql.includes('fruity') || ql.includes('sweet')) {
    const results = [...sakuraByTaste('フルーティ'), ...sakuraByTaste('甘')];
    const unique = results.filter((r, i, arr) => arr.findIndex(x => x.brand.name === r.brand.name) === i);
    a = 'フルーティ・甘口系のおすすめ：\n\n';
    unique.slice(0, 5).forEach(r => {
      a += '・' + r.brewery.name + '「' + r.brand.name + '」\n　' + r.brand.desc + '\n\n';
    });
    if (unique.length === 0) a = 'フルーティな銘柄情報は現在準備中です。';
  }
  // ── 燗酒 ──
  else if (ql.includes('燗') || ql.includes('温かい') || ql.includes('hot') || ql.includes('warm')) {
    const results = [...sakuraByTaste('燗'), ...sakuraByTaste('温')];
    const unique = results.filter((r, i, arr) => arr.findIndex(x => x.brand.name === r.brand.name) === i);
    a = '燗酒（温めて飲む）のおすすめ：\n\n';
    unique.slice(0, 5).forEach(r => {
      a += '・' + r.brewery.name + '「' + r.brand.name + '」\n　' + r.brand.desc + '\n\n';
    });
  }
  // ── 見学 ──
  else if (ql.includes('見学') || ql.includes('訪問') || ql.includes('visit') || ql.includes('tour')) {
    const visitable = SAKURA_KB.filter(b => b.visit && b.visit !== '—' && !b.visit.includes('実施していない') && !b.visit.includes('公式サイト'));
    a = '見学・体験が可能な蔵元：\n\n';
    visitable.forEach(b => {
      a += '・' + b.name + ' — ' + b.visit + '\n　' + b.address + '\n\n';
    });
    if (B && B.visit && B.visit !== '—') {
      a += '\n現在ご覧の' + B.name + '：\n' + B.visit + '\n所在地：' + B.address;
      if (B.station) a += '\n最寄り駅：' + B.station;
    }
  }
  // ── 近くの蔵 ──
  else if (ql.includes('近く') || ql.includes('周辺') || ql.includes('near') || ql.includes('他の蔵')) {
    const nearby = sakuraNearby(SAKURA_CURRENT, 6);
    a = B ? B.name + 'の近くにある蔵元：\n\n' : '近くの蔵元：\n\n';
    nearby.forEach(b => {
      a += '・' + b.name + '（' + b.brand + '）\n　' + b.address;
      if (b.station) a += '　' + b.station;
      a += '\n\n';
    });
  }
  // ── 水 ──
  else if (ql.includes('水') || ql.includes('仕込') || ql.includes('water')) {
    a = '京都の酒造りを支える名水：\n\n';
    const waters = {};
    SAKURA_KB.forEach(b => {
      if (b.water && b.water !== '—') {
        if (!waters[b.water]) waters[b.water] = [];
        waters[b.water].push(b.name);
      }
    });
    Object.keys(waters).forEach(w => {
      a += '【' + w + '】\n　使用蔵：' + waters[w].join('、') + '\n\n';
    });
  }
  // ── 米 ──
  else if (ql.includes('米') || ql.includes('山田錦') || ql.includes('雄町') || ql.includes('祝') || ql.includes('rice')) {
    a = '京都の蔵元が使用する酒米：\n\n';
    const rices = {};
    SAKURA_KB.forEach(b => {
      if (b.rice && b.rice !== '—') {
        if (!rices[b.rice]) rices[b.rice] = [];
        rices[b.rice].push(b.name);
      }
    });
    Object.keys(rices).forEach(r => {
      a += '【' + r + '】\n　使用蔵：' + rices[r].join('、') + '\n\n';
    });
    if (Object.keys(rices).length === 0) a = '使用米の情報は現在準備中です。';
  }
  // ── 歴史 ──
  else if (ql.includes('歴史') || ql.includes('創業') || ql.includes('古い') || ql.includes('history') || ql.includes('oldest')) {
    if (B) {
      a = '【' + B.name + 'の歴史】\n' + B.desc;
      if (B.features && B.features.length > 0) {
        a += '\n\n特徴：\n' + B.features.join('\n');
      }
    }
    a += '\n\n【京都で歴史の古い蔵元 TOP5】\n';
    const sorted = [...SAKURA_KB].sort((a, b) => {
      const ya = parseInt(a.founded) || 9999;
      const yb = parseInt(b.founded) || 9999;
      return ya - yb;
    }).slice(0, 5);
    sorted.forEach(b => {
      a += '・' + b.name + ' — ' + b.founded + '年（' + b.founded_era + '）\n';
    });
  }
  // ── 銘柄・おすすめ ──
  else if (ql.includes('銘柄') || ql.includes('おすすめ') || ql.includes('sake') || ql.includes('recommend')) {
    if (B && B.brands && B.brands.length > 0) {
      a = '【' + B.name + 'の代表銘柄】\n';
      B.brands.forEach(bd => {
        const spec = bd.spec ? '（' + bd.spec + '）' : '';
        a += '\n■ ' + bd.name + '　' + bd.type + spec + '\n　' + bd.desc + '\n';
      });
    } else {
      a = '代表銘柄は「' + (B ? B.brand : '') + '」です。';
    }
  }
  // ── 特徴 ──
  else if (ql.includes('特徴') || ql.includes('こだわり') || ql.includes('unique') || ql.includes('special')) {
    if (B) {
      a = '【' + B.name + 'の特徴】\n' + B.desc;
      if (B.features && B.features.length > 0) {
        a += '\n\n' + B.features.join('\n');
      }
    }
  }
  // ── 英語で質問された場合 ──
  else if (/^[a-zA-Z\s\?\.!,'\-0-9°]+$/.test(q)) {
    // 英語の教科書質問チェック
    const el = q.toLowerCase();
    if (el.includes('type') || el.includes('junmai') || el.includes('ginjo') || el.includes('daiginjo') || el.includes('honjozo') || el.includes('classification')) {
      a = '【Sake Types (Tokutei Meisho-shu)】\n\n';
      a += '■ Junmai (Pure Rice — no added alcohol)\n';
      a += '・Junmai Daiginjo — polishing ≤50%, most premium\n';
      a += '・Junmai Ginjo — polishing ≤60%, fruity & elegant\n';
      a += '・Tokubetsu Junmai — polishing ≤60%, distinctive\n';
      a += '・Junmai — rich umami, great warm or cold\n\n';
      a += '■ With Brewing Alcohol\n';
      a += '・Daiginjo — polishing ≤50%, fragrant & delicate\n';
      a += '・Ginjo — polishing ≤60%, light & aromatic\n';
      a += '・Tokubetsu Honjozo — polishing ≤60%, crisp\n';
      a += '・Honjozo — polishing ≤70%, versatile\n\n';
      a += 'Learn more → /shochu/guide/types.html';
    } else if (el.includes('temperature') || el.includes('warm') || el.includes('hot') || el.includes('cold') || el.includes('kan') || el.includes('hiya')) {
      a = '【Sake Temperature Guide】\n\n';
      a += '■ Cold (Reishu)\n';
      a += '・Yuki-bie (5°C) — Snow-chilled, crisp\n';
      a += '・Hana-bie (10°C) — Flower-chilled, ideal for ginjo\n';
      a += '・Suzu-bie (15°C) — Cool, best for tasting\n\n';
      a += '■ Room Temp (Hiya): 20-25°C\n\n';
      a += '■ Warm (Kanzake)\n';
      a += '・Hinata-kan (30°C) — Sun-warmed\n';
      a += '・Hitohada-kan (35°C) — Body temperature\n';
      a += '・Nuru-kan (40°C) — Lukewarm, most popular\n';
      a += '・Jo-kan (45°C) — Elevated warmth\n';
      a += '・Atsu-kan (50°C) — Hot sake\n';
      a += '・Tobikiri-kan (55°C) — Piping hot\n\n';
      a += 'Learn more → /shochu/guide/temperature.html';
    } else if (el.includes('brew') || el.includes('how') || el.includes('made') || el.includes('process') || el.includes('koji') || el.includes('ferment')) {
      a = '【How Sake is Made (60-day process)】\n\n';
      a += '① Rice Polishing & Steaming\n';
      a += '② Koji Making — mold converts starch to sugar (48hrs)\n';
      a += '③ Yeast Starter (Shubo) — cultivate yeast\n';
      a += '④ Three-Stage Brewing (Sandan Shikomi)\n';
      a += '⑤ Parallel Multiple Fermentation — saccharification + fermentation happen simultaneously (unique to sake!)\n';
      a += '⑥ Pressing, Pasteurization & Aging\n\n';
      a += '★ This "parallel multiple fermentation" achieves ~20% ABV — highest of any brewed beverage in the world.\n\n';
      a += 'Learn more → /shochu/guide/brewing.html';
    } else if (el.includes('pair') || el.includes('food') || el.includes('match') || el.includes('eat') || el.includes('dish')) {
      a = '【Sake & Food Pairing】\n\n';
      a += '3 Basic Rules:\n';
      a += '① Match — similar flavors together\n';
      a += '② Complement — fill what the other lacks\n';
      a += '③ Cleanse — reset the palate\n\n';
      a += 'By Type:\n';
      a += '・Daiginjo → sashimi, carpaccio, fruit\n';
      a += '・Ginjo → tempura, salad, light dishes\n';
      a += '・Junmai → stews, yakitori, cheese\n';
      a += '・Honjozo → grilled fish, oden, gyoza\n';
      a += '・Kimoto/Yamahai → game, blue cheese, sukiyaki\n\n';
      a += 'Learn more → /shochu/guide/pairing.html';
    } else if (el.includes('histor') || el.includes('origin') || el.includes('old')) {
      a = '【History of Sake】\n\n';
      a += '・3rd century — Rice cultivation brings sake brewing to Japan\n';
      a += '・8th century — Koji-based brewing established\n';
      a += '・15th century — Pasteurization invented (300 years before Pasteur!)\n';
      a += '・Edo period — Nada & Fushimi become sake capitals\n';
      a += '・Modern era — Scientific brewing, national competitions\n';
      a += '・Today — Exports reach ¥41 billion, global recognition\n\n';
      a += 'Learn more → /shochu/guide/history.html';
    } else if (el.includes('polish') || el.includes('seimaibuai') || el.includes('milling')) {
      a = '【Rice Polishing Ratio (Seimaibuai)】\n\n';
      a += 'The % of rice remaining after polishing.\n';
      a += '50% = half the grain was polished away.\n\n';
      a += 'The outer layer contains proteins & fats that cause off-flavors.\n';
      a += 'More polishing → cleaner, more fragrant sake.\n\n';
      a += '・≤50% → Daiginjo class\n';
      a += '・≤60% → Ginjo class\n';
      a += '・≤70% → Honjozo class';
    } else if (B) {
      a = '【' + B.name + '】' + (B.name_en ? ' (' + B.name_en + ')' : '') + '\n\n';
      a += 'Founded: ' + B.founded + (B.founded_era ? ' (' + B.founded_era + ')' : '') + '\n';
      a += 'Location: ' + B.address + '\n';
      a += 'Flagship Brand: ' + B.brand + '\n';
      if (B.url) a += 'Website: ' + B.url + '\n';
      if (B.visit && B.visit !== '—') a += 'Tours: ' + B.visit + '\n';
      a += '\n' + B.desc;
      if (B.brands && B.brands.length > 0) {
        a += '\n\nKey Brands:';
        B.brands.forEach(function(bd) {
          if (typeof bd === 'object') {
            a += '\n・' + bd.name + (bd.type ? ' (' + bd.type + ')' : '') + (bd.specs ? ' — ' + bd.specs : '');
          } else {
            a += '\n・' + bd;
          }
        });
      }
    } else {
      a = 'Welcome to Terroir HUB SHOCHU! I\'m Sakura, your AI concierge.\n\n';
      a += 'I can help you with:\n';
      a += '・Info on ' + SAKURA_KB.length + ' sake breweries across Japan\n';
      a += '・Sake types, brewing process, serving temperatures\n';
      a += '・Food pairing recommendations\n';
      a += '・History of Japanese sake\n\n';
      a += 'Try asking: "What is junmai daiginjo?" or "How is sake made?"';
    }
  }
  // ── デフォルト：現在の蔵について ──
  else {
    if (B) {
      a = B.desc;
      if (B.brands && B.brands.length > 0) {
        a += '\n\n代表銘柄：';
        B.brands.forEach(bd => {
          a += '\n・' + bd.name + ' — ' + bd.desc;
        });
      }
    } else {
      a = 'ご質問の内容について、詳しい情報が見つかりませんでした。別のキーワードでお試しいただくか、具体的な蒸留所名や銘柄名でお聞きください。';
    }
  }

  // ── 会話を続ける：回答後にフォローアップを追加 ──
  a = addFollowUp(a, ql, B);
  addMsg('butler', a);
  updateSugsAfterAnswer(ql, B);
}

// ── 会話を続けるためのフォローアップ生成 ──
function addFollowUp(answer, ql, B) {
  // 短すぎる回答にはフォローアップしない
  if (answer.length < 30) return answer;
  // 既にフォローアップ的な文がある場合はスキップ
  if (answer.includes('？') && answer.lastIndexOf('？') > answer.length - 60) return answer;

  var followUps = [];

  if (ql.match(/種類|分類|type|ginjo|junmai/)) {
    followUps = [
      '\n\n🌸 普段はどんなタイプのお酒を飲まれますか？好みに合った銘柄をご紹介できますよ。',
      '\n\n🌸 気になる種類はありましたか？具体的な銘柄もお探しできます。',
    ];
  } else if (ql.match(/温度|燗|冷酒|temperature/)) {
    followUps = [
      '\n\n🍶 今度ぬる燗、試してみませんか？おすすめの銘柄もご紹介できますよ。',
      '\n\n🍶 いつもはどの温度帯で飲まれますか？',
    ];
  } else if (ql.match(/造り方|brewing|製造|工程/)) {
    followUps = [
      '\n\n🌸 酒造りの現場を見てみたいですか？見学できる蔵元もご紹介できます。',
      '\n\n🌸 並行複発酵以外にも、日本酒には面白い技術がたくさんあります。何か気になることは？',
    ];
  } else if (ql.match(/歴史|history|古い|oldest/)) {
    followUps = [
      '\n\n🌸 歴史ある蔵元を訪ねてみませんか？おすすめの酒蔵巡りプランも作れますよ。',
    ];
  } else if (ql.match(/ペアリング|料理|合う|pair|food/)) {
    followUps = [
      '\n\n🍶 今夜のメニューは決まっていますか？具体的な料理に合わせた銘柄を探せますよ。',
    ];
  } else if (ql.match(/見学|visit|tour/)) {
    followUps = [
      '\n\n🌸 どの地域に行かれる予定ですか？エリア別の酒蔵巡りプランもお作りできます。',
    ];
  } else if (B && ql.match(/銘柄|おすすめ|recommend/)) {
    followUps = [
      '\n\n🌸 この中で気になる銘柄はありますか？もっと詳しくお伝えできます。',
      '\n\n🍶 他の蔵の似た銘柄との比較もできますよ。気になる蔵はありますか？',
    ];
  } else if (B) {
    followUps = [
      '\n\n🌸 ' + B.name + 'について、他に気になることはありますか？銘柄の詳細や近くの蔵もお伝えできます。',
    ];
  } else {
    followUps = [
      '\n\n🌸 他にも気になることがあれば、何でも聞いてくださいね。',
    ];
  }

  // ランダムに1つ選ぶ
  var followUp = followUps[Math.floor(Math.random() * followUps.length)];
  return answer + followUp;
}

// ── 回答後にサジェスチョンボタンを文脈に合わせて更新 ──
function updateSugsAfterAnswer(ql, B) {
  var sugs = [];

  if (ql.match(/種類|分類|type/)) {
    sugs = ['純米大吟醸のおすすめは？', '初心者向けの種類は？', '辛口の酒を探して', '自分に合う酒を診断'];
  } else if (ql.match(/温度|燗|冷酒/)) {
    sugs = ['燗に合う銘柄は？', '冷酒のおすすめは？', '燗のつけ方を教えて', '料理との合わせ方'];
  } else if (ql.match(/造り方|brewing/)) {
    sugs = ['見学できる蔵は？', '酒米の種類は？', '生酛造りって何？', '日本酒の歴史'];
  } else if (ql.match(/旅|巡り|tour|plan/)) {
    sugs = ['見学できる蔵は？', 'この地域のおすすめ銘柄', '近くの蔵を教えて', '自分に合う酒を診断'];
  } else if (ql.match(/比較|vs|違い/)) {
    sugs = ['他の蔵も比較したい', '自分に合う酒を診断', 'おすすめの銘柄は？', '酒蔵巡りプラン'];
  } else if (B) {
    sugs = ['代表銘柄の詳細', B.region + 'の他の蔵', B.name + 'の見学情報', '似た味わいの蔵を探して'];
  } else {
    return; // デフォルトのまま
  }

  var sugsEl = document.getElementById('sugs');
  if (sugsEl && sugs.length > 0) {
    sugsEl.innerHTML = sugs.map(function(s) {
      return '<button class="sug" onclick="askSug(this.textContent)">' + s + '</button>';
    }).join('');
  }
}

// ── 蔵のフル情報フォーマット ──
function formatBreweryFull(b) {
  let a = '【' + b.name;
  if (b.name_en) a += '（' + b.name_en + '）';
  a += '】\n\n';
  a += b.desc + '\n\n';
  a += '創業：' + b.founded + '年（' + b.founded_era + '）\n';
  a += '所在地：' + b.address + '\n';
  a += '代表銘柄：' + b.brand + '\n';
  if (b.tel) a += '電話：' + b.tel + '\n';
  if (b.station) a += '最寄り駅：' + b.station + '\n';
  if (b.water && b.water !== '—') a += '仕込水：' + b.water + '\n';
  if (b.rice && b.rice !== '—') a += '使用米：' + b.rice + '\n';
  if (b.visit && b.visit !== '—') a += '見学：' + b.visit + '\n';

  if (b.features && b.features.length > 0) {
    a += '\n特徴：\n';
    b.features.forEach(f => { a += '・' + f + '\n'; });
  }

  if (b.brands && b.brands.length > 0) {
    a += '\n主な銘柄：';
    b.brands.forEach(bd => {
      const spec = bd.spec ? '（' + bd.spec + '）' : '';
      a += '\n・' + bd.name + '　' + bd.type + spec + '\n　' + bd.desc;
    });
  }

  return a;
}

// ══════════════════════════════════════════════════
// Claude API連携（サーバーサイドプロキシ経由）
// ══════════════════════════════════════════════════

async function askClaude(question) {
  const b = sakuraFind(SAKURA_CURRENT);

  // コンテキスト強化: 質問に関連する蔵を検索してcontextに含める
  let context = '';
  if (b) {
    context += '【現在のページの蔵】\n' + formatBreweryFull(b) + '\n\n';
  }

  // 質問から関連蔵を検索（最大3蔵）
  const relatedByName = sakuraFindByName(question.toLowerCase());
  if (relatedByName && (!b || relatedByName.id !== b.id)) {
    context += '【質問に含まれる蔵】\n' + formatBreweryFull(relatedByName) + '\n\n';
  }

  // 比較質問の場合、2つ目の蔵も検索
  if (question.match(/違い|比較|vs|compare/)) {
    const found = [];
    SAKURA_KB.forEach(function(kb) {
      if (found.length >= 2) return;
      var ql = question.toLowerCase();
      if ((kb.name && ql.includes(kb.name.toLowerCase())) || (kb.brand && ql.includes(kb.brand.toLowerCase()))) {
        if (!found.some(function(f) { return f.id === kb.id; })) found.push(kb);
      }
    });
    found.forEach(function(fb) {
      if ((!b || fb.id !== b.id) && (!relatedByName || fb.id !== relatedByName.id)) {
        context += '【比較対象の蔵】\n' + formatBreweryFull(fb) + '\n\n';
      }
    });
  }

  // 地域質問の場合、その地域の蔵リストを追加
  var regionMatch = null;
  SAKURA_KB.forEach(function(kb) {
    if (kb.region && question.includes(kb.region.replace('県','').replace('府','').replace('都','').replace('道',''))) {
      regionMatch = kb.region;
    }
  });
  if (regionMatch) {
    var regionBreweries = SAKURA_KB.filter(function(kb) { return kb.region === regionMatch; });
    context += '【' + regionMatch + 'の蔵元一覧（' + regionBreweries.length + '蔵）】\n';
    regionBreweries.slice(0, 15).forEach(function(rb) {
      context += '・' + rb.name + '（' + rb.brand + '）' + (rb.founded||'') + '年 ' + (rb.area||'');
      if (rb.visit && rb.visit !== '—') context += ' [見学可]';
      context += '\n';
    });
    if (regionBreweries.length > 15) context += '...他' + (regionBreweries.length - 15) + '蔵\n';
    context += '\n';
  }

  // ユーザープロファイル（ニックネーム+味覚+統計）をcontextに追加
  var userProfile = window.thubGetUserProfile ? window.thubGetUserProfile() : null;
  if (userProfile) {
    context += '【ユーザー情報（パーソナライズ用）】\n';
    if (userProfile.nickname) context += 'ニックネーム：' + userProfile.nickname + '（会話では「' + userProfile.nickname + 'さん」と呼んでください）\n';
    if (userProfile.level) context += 'レベル：Lv.' + userProfile.level.lv + ' ' + userProfile.level.name + '\n';
    if (userProfile.streak > 1) context += '連続記録：' + userProfile.streak + '日\n';
    context += '飲酒記録：' + userProfile.logsCount + '杯 / お気に入り：' + userProfile.favsCount + '蔵 / チェックイン：' + userProfile.stampsCount + '蔵\n';
    if (userProfile.taste) {
      context += '味覚の好み：' + {dry:'辛口',umami:'旨味・まろやか',fruity:'フルーティー',neutral:'バランス型'}[userProfile.taste.taste] + '\n';
      context += '温度：' + {cold:'冷酒',room:'常温〜ぬる燗',hot:'熱燗',any:'オールラウンド'}[userProfile.taste.temp] + '\n';
      context += '料理：' + {washoku:'和食',meat:'肉・洋食',cheese:'チーズ・つまみ',solo:'酒単体'}[userProfile.taste.food] + '\n';
    }
    if (userProfile.recentLogs.length > 0) context += '最近飲んだ酒：' + userProfile.recentLogs.join('、') + '\n';
    if (userProfile.favBreweries.length > 0) context += 'お気に入り蔵：' + userProfile.favBreweries.join('、') + '\n';
    context += '\n';
  }

  try {
    const res = await fetch('/api/sakura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        context: context,
        history: SAKURA_HISTORY,
        userId: window.thubAuth && window.thubAuth.user ? window.thubAuth.user.id : null,
      }),
    });
    const data = await res.json();
    hideTyping();

    if (data.answer) {
      addMsg('butler', data.answer);
      SAKURA_HISTORY.push({ role: 'user', content: question });
      SAKURA_HISTORY.push({ role: 'assistant', content: data.answer });
      // 履歴は最新20件まで（長い会話を維持）
      if (SAKURA_HISTORY.length > 20) SAKURA_HISTORY = SAKURA_HISTORY.slice(-20);
    } else {
      // API失敗時はローカル応答にフォールバック
      respond(question);
    }
  } catch (e) {
    console.warn('Claude API error:', e);
    hideTyping();
    respond(question);
  }
}
