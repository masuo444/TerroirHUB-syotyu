// ══════════════════════════════════════════════════
// サクラ — 蔵ページ用チャットクライアント（ja/en）
// window.SAKURA_CTX（ページ生成時に埋め込み）を文脈として /api/sakura を呼ぶ
// 未ログインでも1日3問まで利用可（サーバー側でIP制限）
// ══════════════════════════════════════════════════
(function () {
  var CTX = window.SAKURA_CTX || {};
  var LANG = CTX.lang === 'en' ? 'en' : 'ja';
  var HISTORY = [];
  var ci = false;
  var GUEST_LIMIT = 3;

  var FAC = CTX.facility || '蔵';
  var FAC_EN = CTX.facility_en || 'brewery';
  var T = LANG === 'en' ? {
    greet: 'Welcome to ' + (CTX.display_name || CTX.name || 'this ' + FAC_EN) + '! 🌸\nI\'m Sakura, your concierge. Ask me anything about this ' + FAC_EN + ' — brands, taste, food pairing, or visiting.',
    limitMsg: 'You\'ve used your 3 free questions for today. Create a free account on our top page to keep chatting with me! 🌸',
    limitCta: '🌸 Sign up free (30 sec)',
    errMsg: 'Sorry, something went wrong. Please try again in a moment.',
    creditsMsg: 'You\'ve run out of credits. Please check your plan.',
    remaining: function (n) { return 'Free questions left today: ' + n; },
  } : {
    greet: 'ようこそ、' + (CTX.name || 'この' + FAC) + 'のページへ🌸\nサクラです。この' + FAC + 'のこと、銘柄、味わい、料理との相性、見学情報など、何でも聞いてください。',
    limitMsg: '本日の無料お試し（3問）を使い切りました。無料会員登録をすると、もっとサクラと話せます🌸',
    limitCta: '🌸 無料登録して続ける（30秒）',
    errMsg: 'ごめんなさい、少し調子が悪いみたいです。時間をおいてもう一度お試しください。',
    creditsMsg: 'クレジットが不足しています。プランをご確認ください。',
    remaining: function (n) { return '本日の無料質問 残り' + n + '回'; },
  };

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function linkify(safe) {
    return safe.replace(/(https?:\/\/[^\s<）)、。]+)/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener" style="color:var(--accent);">' + u + '</a>';
    });
  }

  function buildContext() {
    var p = [];
    if (CTX.site) p.push(CTX.site);
    if (LANG === 'en') {
      p.push('Current page: ' + FAC_EN + ' page for ' + (CTX.display_name || CTX.name || '') + (CTX.name && CTX.display_name ? ' (' + CTX.name + ')' : ''));
      if (CTX.pref) p.push('Prefecture: ' + CTX.pref);
    } else {
      p.push('現在のページ：' + FAC + 'ページ「' + (CTX.name || '') + '」');
      if (CTX.pref) p.push('都道府県：' + CTX.pref);
    }
    if (CTX.area) p.push((LANG === 'en' ? 'Area: ' : '地域：') + CTX.area);
    if (CTX.founded) p.push((LANG === 'en' ? 'Founded: ' : '創業：') + CTX.founded + (CTX.founded_era ? '（' + CTX.founded_era + '）' : ''));
    if (CTX.brand) p.push((LANG === 'en' ? 'Main brand: ' : '代表銘柄：') + CTX.brand);
    if (CTX.brands && CTX.brands.length) p.push((LANG === 'en' ? 'Brands: ' : '銘柄：') + CTX.brands.join('、'));
    if (CTX.visit) p.push((LANG === 'en' ? 'Visit info: ' : '見学：') + CTX.visit);
    if (CTX.url) p.push((LANG === 'en' ? 'Official site: ' : '公式サイト：') + CTX.url);
    if (CTX.desc) p.push(CTX.desc);
    if (LANG === 'en') p.push('The user is on the English site. Reply in English.');
    return p.join('\n').slice(0, 3800);
  }

  // ── ゲストカウンタ（UX用。実制限はサーバー側） ──
  function guestKey() { return 'sakura_guest_' + new Date().toISOString().slice(0, 10); }
  function guestCount() { try { return parseInt(localStorage.getItem(guestKey()) || '0', 10); } catch (e) { return 0; } }
  function guestIncr() { try { localStorage.setItem(guestKey(), String(guestCount() + 1)); } catch (e) {} }

  async function getAuthHeaders() {
    var h = { 'Content-Type': 'application/json' };
    try {
      if (window.thubAuth && window.thubAuth.supabase) {
        var s = await window.thubAuth.supabase.auth.getSession();
        if (s && s.data && s.data.session) h['Authorization'] = 'Bearer ' + s.data.session.access_token;
      }
    } catch (e) {}
    return h;
  }

  // ── UI ──
  window.openPanel = function () {
    var ov = document.getElementById('overlay');
    var fab = document.getElementById('fab');
    if (ov) ov.classList.add('open');
    if (fab) fab.style.display = 'none';
    if (!ci) initChat();
  };
  window.closePanel = function () {
    var ov = document.getElementById('overlay');
    var fab = document.getElementById('fab');
    if (ov) ov.classList.remove('open');
    if (fab) fab.style.display = 'flex';
  };

  function addMsg(role, text, isHtml) {
    var c = document.getElementById('chat');
    if (!c) return;
    var d = document.createElement('div');
    d.className = 'msg ' + role;
    var body = isHtml ? text : linkify(escHtml(text)).replace(/\n/g, '<br>');
    d.innerHTML = '<div class="av">' + (role === 'butler' ? '桜' : (LANG === 'en' ? 'U' : 'あ')) + '</div><div class="bubble">' + body + '</div>';
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }
  function showT() {
    var c = document.getElementById('chat');
    if (!c) return;
    var d = document.createElement('div');
    d.className = 'msg butler'; d.id = 'tp';
    d.innerHTML = '<div class="av">桜</div><div class="bubble"><div class="typing"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>';
    c.appendChild(d); c.scrollTop = c.scrollHeight;
  }
  function removeT() { var e = document.getElementById('tp'); if (e) e.remove(); }

  function renderSugs() {
    var el = document.getElementById('sugs');
    if (!el) return;
    var sugs = CTX.suggestions || [];
    el.innerHTML = sugs.map(function (s) {
      return '<button class="sug" onclick="askSug(this.textContent)">' + escHtml(s) + '</button>';
    }).join('');
  }
  function showSignupCta() {
    addMsg('butler', '<a href="/" style="display:inline-block;background:#B8452A;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:22px;">' + escHtml(T.limitCta) + '</a>', true);
  }

  function initChat() {
    ci = true;
    var c = document.getElementById('chat');
    if (c) c.innerHTML = '';
    addMsg('butler', T.greet);
    renderSugs();
  }

  var busy = false;
  async function ask(question) {
    if (busy) return;
    var loggedIn = !!(window.thubAuth && window.thubAuth.isLoggedIn);
    if (!loggedIn && guestCount() >= GUEST_LIMIT) {
      addMsg('user', question);
      addMsg('butler', T.limitMsg);
      showSignupCta();
      return;
    }
    busy = true;
    addMsg('user', question);
    showT();
    try {
      var headers = await getAuthHeaders();
      var res = await fetch('https://sake.terroirhub.com/api/sakura', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ question: question, context: buildContext(), history: HISTORY }),
      });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      removeT();
      if (res.status === 429) {
        addMsg('butler', (data && data.message) || T.limitMsg);
        showSignupCta();
      } else if (res.status === 402) {
        addMsg('butler', T.creditsMsg);
      } else if (data && data.answer) {
        addMsg('butler', data.answer);
        HISTORY.push({ role: 'user', content: question });
        HISTORY.push({ role: 'assistant', content: data.answer });
        if (HISTORY.length > 10) HISTORY = HISTORY.slice(-10);
        if (data.guest) {
          guestIncr();
          var left = typeof data.guestRemaining === 'number' ? data.guestRemaining : Math.max(0, GUEST_LIMIT - guestCount());
          var el = document.getElementById('sugs');
          if (el && !document.getElementById('guest-left')) {
            var note = document.createElement('div');
            note.id = 'guest-left';
            note.style.cssText = 'font-size:11px;color:var(--text-muted);padding:4px 8px;';
            el.parentNode.insertBefore(note, el);
          }
          var n = document.getElementById('guest-left');
          if (n) n.textContent = T.remaining(left);
        }
      } else {
        addMsg('butler', T.errMsg);
      }
    } catch (e) {
      removeT();
      addMsg('butler', T.errMsg);
    }
    busy = false;
    renderSugs();
  }

  window.askSug = function (q) {
    var el = document.getElementById('sugs');
    if (el) el.innerHTML = '';
    ask(q);
  };
  window.sendMsg = function () {
    var i = document.getElementById('chat-inp');
    if (!i) return;
    var q = i.value.trim();
    if (!q) return;
    i.value = '';
    var el = document.getElementById('sugs');
    if (el) el.innerHTML = '';
    ask(q);
  };
})();
