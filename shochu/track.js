/**
 * Terroir HUB SHOCHU — 行動トラッキング
 * ページビュー・滞在時間・スクロール深度を記録
 */
(function(){
  'use strict';
  const DOMAIN = 'shochu.terroirhub.com';
  const page = location.pathname;
  const ref = document.referrer;
  const start = Date.now();

  // Page view
  function trackView(){
    const data = {
      type: 'pageview',
      page: page,
      ref: ref,
      ua: navigator.userAgent,
      lang: navigator.language,
      w: window.innerWidth,
      h: window.innerHeight,
      ts: new Date().toISOString()
    };
    if(navigator.sendBeacon){
      navigator.sendBeacon('/api/track', JSON.stringify(data));
    }
  }

  // Scroll depth
  let maxScroll = 0;
  function trackScroll(){
    const scrollPct = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
    if(scrollPct > maxScroll) maxScroll = scrollPct;
  }

  // Time on page
  function trackExit(){
    const duration = Math.round((Date.now() - start) / 1000);
    const data = {
      type: 'exit',
      page: page,
      duration: duration,
      scroll: maxScroll,
      ts: new Date().toISOString()
    };
    if(navigator.sendBeacon){
      navigator.sendBeacon('/api/track', JSON.stringify(data));
    }
  }

  window.addEventListener('scroll', trackScroll, {passive: true});
  window.addEventListener('beforeunload', trackExit);

  // Delay pageview to avoid counting bounces
  setTimeout(trackView, 1000);
})();



// ── AIサクラ UI v2（デザイン統一 + チャット本番対応）──
(function(){

  // ── CSS注入 ──
  var CSS=[
    // パネル: フル幅・svh・シャドウ強化
    '.panel{max-width:none!important;height:88svh!important;box-shadow:0 -24px 60px rgba(0,0,0,.5)!important;}',
    // デスクトップ: 右スライドイン
    '@media(min-width:701px){',
    '.overlay{align-items:stretch!important;justify-content:flex-end!important;}',
    '.panel{width:420px!important;height:100%!important;border-radius:0!important;max-width:100vw!important;transform:translateX(100%)!important;box-shadow:-8px 0 40px rgba(0,0,0,.4)!important;}',
    '.overlay.open .panel{transform:translateX(0)!important;}',
    '.p-handle{display:none!important;}',
    '}',
    // iOS safe area
    '.inp-row{padding-bottom:max(16px,env(safe-area-inset-bottom))!important;}',
    // バブル強化
    '.msg.butler .bubble{border-left-width:2px!important;line-height:1.9!important;letter-spacing:.03em!important;}',
    '.msg{animation:_su_in .3s ease both!important;}',
    '@keyframes _su_in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}',
    '.chat::-webkit-scrollbar{width:2px!important;}',
    // 閉じるボタン（見やすく）
    '.mob-close-bar{display:none;padding:8px 16px 10px;flex-shrink:0;border-top:1px solid var(--border);}',
    '.mob-close-bar button{width:100%;padding:12px;background:rgba(0,0,0,.04);border:1.5px solid var(--text-muted,#999);border-radius:8px;color:var(--text,#333);font-size:.85rem;font-weight:500;letter-spacing:.08em;cursor:pointer;font-family:inherit;transition:all .2s;}',
    '.mob-close-bar button:hover,.mob-close-bar button:active{background:rgba(0,0,0,.08);border-color:var(--accent,#888);}',
    '@media(max-width:699px){.mob-close-bar{display:block;}}'
  ].join('');

  // ローカル応答（未ログイン時）
  function _localReply(q) {
    var bn = window.BN || '';
    var bb = window.BB || '';
    var name = bn || 'この蔵';
    var brand = bb ? '「' + bb + '」' : 'こちらのお酒';
    var ql = (q || '').toLowerCase();
    if (/見学|ツアー|体験/.test(ql))
      return name + 'の蔵見学は、ページ下部のお問い合わせ先でご確認いただけます。\n\n🌸 会員登録するとAIサクラが詳しくご案内します（無料）。';
    if (/購入|買|通販|オンライン|店/.test(ql))
      return brand + 'はTerroir HUBや公式サイトでお求めいただけます。\n\n🌸 会員登録でAIサクラがおすすめを提案します。';
    if (/おすすめ|合う|ペアリング|料理|食/.test(ql))
      return brand + 'のペアリングや料理との合わせ方は、会員登録後にAIサクラが詳しくお答えします。\n\n🌸 無料で登録できます。';
    if (/飲み方|温度|燗|冷|ロック/.test(ql))
      return brand + 'のおいしい飲み方は、会員登録後にAIサクラがご案内します。\n\n🌸 無料登録で今すぐ聞けます。';
    if (/歴史|創業|由来|こだわり|特徴/.test(ql))
      return name + 'の歴史や蔵のこだわりは、このページをぜひご覧ください。\n\nさらに詳しくは、会員登録後にAIサクラがお話しします。';
    if (/english|en\b/.test(ql) || /[a-zA-Z]{5,}/.test(q))
      return 'Thank you for your question about ' + name + '.\n\nSign up free to chat with AI Sakura in English! 🌸';
    return name + 'についてのご質問ありがとうございます。\n\n🌸 AIサクラに詳しく聞くには、無料会員登録が必要です。ペアリング・蔵見学・銘柄のご案内まで、何でもお答えします。';
  }

  // ログイン確認
  async function _isLoggedIn() {
    try {
      if (window.thubAuth && window.thubAuth.user) return true;
      if (window.thubAuth && window.thubAuth.supabase) {
        var s = await window.thubAuth.supabase.auth.getSession();
        return !!(s && s.data && s.data.session);
      }
    } catch(e) {}
    return false;
  }

  // API呼び出し
  async function _callAPI(q) {
    var headers = {'Content-Type':'application/json'};
    try {
      var s = await window.thubAuth.supabase.auth.getSession();
      var tok = s && s.data && s.data.session && s.data.session.access_token;
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
    } catch(e) {}
    var ctx = (window.BN || '') + (window.BB ? '（代表銘柄: ' + window.BB + '）' : '');
    var hist = (window.chatHistory || []).slice(-10);
    return fetch('https://sake.terroirhub.com/api/sakura', {
      method:'POST', headers:headers,
      body:JSON.stringify({question:q, history:hist, context:ctx})
    });
  }

  // メインルーター
  async function _route(q) {
    var _rmT = window.removeT || window.hideTyping || function(){var e=document.getElementById('tp')||document.getElementById('sakura-typing');if(e)e.remove();};
    var _addMsg = window.addMsg;
    var _renderSugs = window.renderSugs;

    var loggedIn = await _isLoggedIn();

    if (!loggedIn) {
      _rmT();
      _addMsg && _addMsg('butler', _localReply(q));
      _renderSugs && _renderSugs();
      return;
    }

    try {
      var res = await _callAPI(q);
      _rmT();
      if (res.status === 401) {
        _addMsg && _addMsg('butler', _localReply(q));
      } else if (res.status === 402) {
        _addMsg && _addMsg('butler', '今月のご利用上限に達しました。\n\n🌸 プランをアップグレードするとさらに多くご利用いただけます。');
      } else if (!res.ok) {
        _addMsg && _addMsg('butler', '少し時間をおいて、もう一度お試しください。');
      } else {
        var data = await res.json();
        var ans = data.answer || data.reply || '';
        _addMsg && _addMsg('butler', ans);
        if (window.chatHistory) window.chatHistory.push({role:'user',content:q},{role:'assistant',content:ans});
      }
    } catch(e) {
      _rmT();
      _addMsg && _addMsg('butler', '少し時間をおいて、もう一度お試しください。');
    }
    _renderSugs && _renderSugs();
  }

  // askSug / sendMsg / sendQuestion を上書き
  function _overrideFns() {
    var _showT = window.showT || window.showTyping || function(){};
    window.askSug = function(q) {
      var sugs = document.getElementById('sugs');
      if (sugs) sugs.innerHTML = '';
      window.addMsg && window.addMsg('user', q);
      _showT();
      _route(q);
    };
    window.sendMsg = function() {
      var inp = document.getElementById('chat-inp');
      var q = inp ? inp.value.trim() : '';
      if (!q) return;
      if (inp) inp.value = '';
      var sugs = document.getElementById('sugs');
      if (sugs) sugs.innerHTML = '';
      window.addMsg && window.addMsg('user', q);
      _showT();
      _route(q);
    };
    window.sendQuestion = function(q) {
      _route(q);
    };
  }

  // 閉じるボタン注入
  function _injectCloseBtn(panel) {
    if (panel.querySelector('.mob-close-bar')) return;
    var row = panel.querySelector('.inp-row');
    if (!row) return;
    var bar = document.createElement('div');
    bar.className = 'mob-close-bar';
    bar.innerHTML = '<button onclick="typeof closePanel===\'function\'&&closePanel()">✕ チャットを閉じる</button>';
    row.insertAdjacentElement('afterend', bar);
  }

  // CSS注入
  function _injectCSS() {
    if (document.getElementById('_su_style')) return;
    var s = document.createElement('style');
    s.id = '_su_style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // 初期化
  function init() {
    _injectCSS();
    var panel = document.querySelector('.panel');
    if (panel) _injectCloseBtn(panel);
    _overrideFns();
  }

  // deferスクリプトはDOMContentLoaded前に実行されるが、念のため両対応
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

