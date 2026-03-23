// Terroir HUB — Supabase Auth Integration
// 使い方: Supabaseプロジェクト作成後、URLとKEYを設定

(function(){
  'use strict';

  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  // ══════════════════════════════════════
  // ▼▼▼ ここにSupabaseの情報を入れる ▼▼▼
  const SUPABASE_URL = 'https://hhwavxavuqqfiehrogwv.supabase.co';      // 例: https://xxxxx.supabase.co
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhod2F2eGF2dXFxZmllaHJvZ3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Njk3MzAsImV4cCI6MjA4OTU0NTczMH0.tHMQ_u51jp69AMUKKtTvxL09Sr11JFPKGRhKMmUzEjg';  // 例: eyJhbGciOiJIUzI1NiIs...
  // ▲▲▲ ここにSupabaseの情報を入れる ▲▲▲
  // ══════════════════════════════════════

  // SDK読み込み前のフォールバック（ボタンが先に押された場合）
  window.thubAuthSubmit = function(){
    alert('認証システムを読み込み中です。数秒お待ちください。');
  };

  // Skip if not configured
  if(SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.log('[AUTH] Supabase not configured. Using demo mode.');
    window.thubAuth = { user: null, demo: true };
    return;
  }

  // Load Supabase client
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = initAuth;
  document.head.appendChild(script);

  function initAuth() {
    const { createClient } = supabase;
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ══════════════════════════════════════
    // Auth State
    // ══════════════════════════════════════
    let currentUser = null;
    let currentPlan = 'free';

    // ポータルからのトークン受け取り → セッション復元
    (function(){
      var params = new URLSearchParams(window.location.search);
      var accessToken = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      if(accessToken && refreshToken){
        sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(function(){
          // URLからトークンパラメータを除去
          var url = new URL(window.location);
          url.searchParams.delete('access_token');
          url.searchParams.delete('refresh_token');
          window.history.replaceState({}, '', url);
        });
        return; // setSession後にonAuthStateChangeが発火するのでここでreturn
      }
    })();

    // Check session on load
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        currentUser = session.user;
        onLogin(currentUser);
      }
    });

    // Listen for auth changes
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        // profilesに自動作成（なければ）
        await sb.from('profiles').upsert({ id: currentUser.id, plan: 'free' }, { onConflict: 'id', ignoreDuplicates: true });
        onLogin(currentUser);
        // 保留中のサブスク購入があれば自動遷移
        var pendingPlan = sessionStorage.getItem('thub_pending_plan');
        if (pendingPlan) {
          sessionStorage.removeItem('thub_pending_plan');
          setTimeout(function(){ if(window.thubSubscribe) window.thubSubscribe(pendingPlan); }, 500);
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        onLogout();
      }
    });

    // ══════════════════════════════════════
    // Sign Up
    // ══════════════════════════════════════
    window.thubSignUp = async function(email, password) {
      try {
        const { data, error } = await sb.auth.signUp({
          email: email,
          password: password,
        });
        if (error) {
          showAuthError(error.message);
          return false;
        }
        showAuthSuccess('確認メールを送信しました。メールのリンクをクリックしてください。');

        // Track
        if (window.thub) window.thub.signup('email');
        return true;
      } catch (e) {
        showAuthError('エラーが発生しました');
        return false;
      }
    };

    // ══════════════════════════════════════
    // Sign In
    // ══════════════════════════════════════
    window.thubSignIn = async function(email, password) {
      try {
        const { data, error } = await sb.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) {
          showAuthError(error.message === 'Invalid login credentials' ? 'メールアドレスまたはパスワードが違います' : error.message);
          return false;
        }
        closeAuth();
        return true;
      } catch (e) {
        showAuthError('エラーが発生しました');
        return false;
      }
    };

    // ══════════════════════════════════════
    // Google Sign In
    // ══════════════════════════════════════
    window.thubSignInWithGoogle = async function() {
      try {
        const { error } = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + window.location.pathname,
          },
        });
        if (error) {
          showAuthError('Googleログインに失敗しました');
        }
      } catch (e) {
        showAuthError('エラーが発生しました');
      }
    };

    // ══════════════════════════════════════
    // Sign Out
    // ══════════════════════════════════════
    window.thubSignOut = async function() {
      await sb.auth.signOut();
    };

    // ══════════════════════════════════════
    // Google Sign In (optional)
    // ══════════════════════════════════════
    window.thubGoogleSignIn = async function() {
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
    };

    // ══════════════════════════════════════
    // UI Updates
    // ══════════════════════════════════════
    function onLogin(user) {
      // Update nav
      const authBtns = document.querySelector('.nav-auth');
      if (authBtns) {
        authBtns.innerHTML = `
          <button onclick="thubShowMypage()" style="display:flex;align-items:center;gap:6px;background:none;border:1px solid #eee;border-radius:20px;padding:4px 12px 4px 4px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor='#D4728A'" onmouseout="this.style.borderColor='#eee'">
            <span style="width:24px;height:24px;background:linear-gradient(135deg,#D4728A,#B8452A);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:600;">${escHtml(user.email[0].toUpperCase())}</span>
            <span style="font-size:12px;color:#555;" id="plan-badge"></span>
          </button>
        `;
      }

      // Set user in tracking
      if (window.thub) window.thub.setUser(user.id);

      // プランをDBから取得
      sb.from('profiles').select('plan, bonus_credits').eq('id', user.id).single().then(function(res) {
        if (res.data) {
          currentPlan = res.data.plan || 'free';
          if (typeof res.data.bonus_credits === 'number') {
            localStorage.setItem('thub_bonus_credits', String(res.data.bonus_credits));
          }
        }
        updatePlanBadge();
      });

      loadNickname();
      console.log('[AUTH] Logged in:', user.email);
    }

    function onLogout() {
      // Reset nav
      const authBtns = document.querySelector('.nav-auth');
      if (authBtns) {
        authBtns.innerHTML = `
          <button class="nav-login-btn" onclick="showAuth('login')">ログイン</button>
          <button class="nav-signup-btn" onclick="showAuth('signup')">無料登録</button>
        `;
      }
      console.log('[AUTH] Logged out');
    }

    function showAuthError(msg) {
      let el = document.getElementById('auth-error');
      if (!el) {
        el = document.createElement('div');
        el.id = 'auth-error';
        el.style.cssText = 'color:#e05c5c;font-size:13px;text-align:center;margin-bottom:12px;';
        const btn = document.getElementById('auth-btn');
        if (btn) btn.parentNode.insertBefore(el, btn);
      }
      el.textContent = msg;
      setTimeout(() => { if (el) el.textContent = ''; }, 5000);
    }

    function showAuthSuccess(msg) {
      let el = document.getElementById('auth-error');
      if (!el) {
        el = document.createElement('div');
        el.id = 'auth-error';
        el.style.cssText = 'color:#3D9970;font-size:13px;text-align:center;margin-bottom:12px;';
        const btn = document.getElementById('auth-btn');
        if (btn) btn.parentNode.insertBefore(el, btn);
      }
      el.style.color = '#3D9970';
      el.textContent = msg;
    }

    // ══════════════════════════════════════
    // Connect to existing auth modal
    // ══════════════════════════════════════
    // auth-btnのクリックをグローバル関数として公開
    window.thubAuthSubmit = function(){
      const email = document.getElementById('auth-email');
      const pass = document.getElementById('auth-pass');
      if(!email || !pass) return;
      const e = email.value.trim();
      const p = pass.value;

      if (!e || !p) {
        showAuthError('メールアドレスとパスワードを入力してください');
        return;
      }
      if (p.length < 6) {
        showAuthError('パスワードは6文字以上で入力してください');
        return;
      }

      const titleEl = document.getElementById('auth-title');
      const mode = titleEl ? titleEl.textContent : '';
      if (mode.includes('作成') || mode.includes('登録') || mode.includes('Create')) {
        thubSignUp(e, p);
      } else {
        thubSignIn(e, p);
      }
    };

    // DOM上のボタンにonclickを直接設定
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
      authBtn.onclick = function(ev){ ev.preventDefault(); window.thubAuthSubmit(); };
    }

    // ══════════════════════════════════════
    // ニックネーム管理
    // ══════════════════════════════════════
    const NICK_KEY = 'thub_nickname';

    window.thubGetNickname = function() {
      return localStorage.getItem(NICK_KEY) || '';
    };

    window.thubSetNickname = function(name) {
      localStorage.setItem(NICK_KEY, name);
      if (window.thubAuth && window.thubAuth.supabase && currentUser) {
        window.thubAuth.supabase.from('profiles').upsert({
          id: currentUser.id,
          nickname: name
        });
      }
    };

    // ログイン時にDBからニックネーム取得
    function loadNickname() {
      if (currentUser && sb) {
        sb.from('profiles').select('nickname').eq('id', currentUser.id).single().then(function(res) {
          if (res.data && res.data.nickname) {
            localStorage.setItem(NICK_KEY, res.data.nickname);
          }
        });
      }
    }

    // ユーザープロファイル（サクラ連携用）
    window.thubGetUserProfile = function() {
      var nickname = window.thubGetNickname();
      var logs = JSON.parse(localStorage.getItem('thub_sake_log') || '[]');
      var favs = JSON.parse(localStorage.getItem('thub_favorites') || '[]');
      var stamps = JSON.parse(localStorage.getItem('thub_stamps') || '[]');
      var taste = null;
      try { taste = JSON.parse(localStorage.getItem('sakura_taste_profile')); } catch(e){}
      var level = window.thubGetLevel ? window.thubGetLevel() : {lv:1,name:'初心者'};
      var streak = window.thubGetStreak ? window.thubGetStreak() : {count:0};

      return {
        nickname: nickname,
        level: level,
        streak: streak.count,
        logsCount: logs.length,
        favsCount: favs.length,
        stampsCount: stamps.length,
        taste: taste,
        recentLogs: logs.slice(0,3).map(function(l){ return l.brewery_name + (l.brand ? '「'+l.brand+'」' : ''); }),
        favBreweries: favs.slice(0,5).map(function(f){ return f.brewery_name; }),
      };
    };

    // マイページモーダル
    window.thubShowMypage = function(tab) {
      var plan = currentPlan || 'free';
      var email = currentUser ? currentUser.email : '';
      var nickname = window.thubGetNickname();
      var credits = window.thubGetSakuraRemaining ? window.thubGetSakuraRemaining() : 0;
      var favs = JSON.parse(localStorage.getItem('thub_favorites') || '[]');
      var stamps = JSON.parse(localStorage.getItem('thub_stamps') || '[]');
      var history = (window.thub && window.thub.getHistory) ? window.thub.getHistory() : [];
      var badges = JSON.parse(localStorage.getItem('thub_badges') || '[]');
      var taste = (window.thub && window.thub.getTasteProfile) ? window.thub.getTasteProfile() : {};
      var activeTab = tab || 'home';

      var planLabel = plan === 'premium' ? 'Premium' : plan === 'pro' ? 'Pro' : 'Free';
      var planColor = plan === 'premium' ? 'linear-gradient(135deg,#B8452A,#8B3520)' : plan === 'pro' ? 'linear-gradient(135deg,#D4728A,#B8452A)' : '#eee';
      var planTextColor = plan === 'free' ? '#999' : '#fff';

      // タブコンテンツ生成
      function buildHome() {
        // クエストリンクにセッショントークンを付与
        var questUrl = 'https://terroirhub.com/quest/';
        try {
          if(sb && currentUser) {
            sb.auth.getSession().then(function(res){
              if(res.data && res.data.session){
                var btn = document.getElementById('quest-link-btn');
                if(btn) btn.href = questUrl + '?access_token=' + res.data.session.access_token + '&refresh_token=' + res.data.session.refresh_token;
              }
            });
          }
        } catch(e){}
        var questBtn = '<a id="quest-link-btn" href="' + questUrl + '" style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#D4728A,#B8452A);color:#fff;border-radius:12px;padding:14px 16px;margin-bottom:16px;text-decoration:none;" onclick="this.closest(\'#mypage-modal\').remove()">' +
          '<div style="font-size:28px;">🗺️</div>' +
          '<div><div style="font-size:14px;font-weight:600;">テロワールクエスト</div><div style="font-size:11px;opacity:0.8;">記録・写真投稿・バッジを集めよう</div></div>' +
          '<div style="margin-left:auto;font-size:16px;">→</div></a>';

        var upgradeBtn = '';
        if (plan === 'free') upgradeBtn = '<button onclick="this.closest(\'#mypage-modal\').remove();showAuth(\'signup\')" style="width:100%;padding:11px;background:#B8452A;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;margin-top:12px;">Proにアップグレード</button>';

        var creditHtml = plan !== 'free'
          ? '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;"><span style="font-size:13px;color:#666;">クレジット残高</span><div><span style="font-size:20px;font-weight:600;color:#B8452A;">' + credits + '</span></div></div>' : '';

        var logs = JSON.parse(localStorage.getItem('thub_sake_log') || '[]');

        var summary = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0;">' +
          '<div style="text-align:center;background:#fafaf8;padding:12px 4px;border-radius:10px;"><div style="font-size:22px;font-weight:700;color:#B8452A;">' + logs.length + '</div><div style="font-size:10px;color:#aaa;">飲酒記録</div></div>' +
          '<div style="text-align:center;background:#fafaf8;padding:12px 4px;border-radius:10px;"><div style="font-size:22px;font-weight:700;color:#B8452A;">' + favs.length + '</div><div style="font-size:10px;color:#aaa;">お気に入り</div></div>' +
          '<div style="text-align:center;background:#fafaf8;padding:12px 4px;border-radius:10px;"><div style="font-size:22px;font-weight:700;color:#B8452A;">' + stamps.length + '</div><div style="font-size:10px;color:#aaa;">チェックイン</div></div>' +
        '</div>';

        var nearbyHtml = '<div id="mypage-nearby" style="margin:16px 0;">' +
          '<div style="font-size:14px;font-weight:600;color:#333;margin-bottom:8px;">📍 近くの酒蔵</div>' +
          '<div id="nearby-list" style="color:#aaa;font-size:12px;">位置情報を取得中...</div>' +
        '</div>';

        // 位置情報取得→近くの蔵表示（非同期）
        setTimeout(function(){
          if(!navigator.geolocation) {
            var el = document.getElementById('nearby-list');
            if(el) el.textContent = '位置情報が利用できません';
            return;
          }
          navigator.geolocation.getCurrentPosition(function(pos){
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            // search_index.jsonを取得して近い蔵を検索
            fetch('/shochu/search_index.json').then(function(r){return r.json()}).then(function(data){
              // 各県のざっくり緯度経度（中心点）
              var PREF_COORDS = {
                hokkaido:[43.06,141.35],aomori:[40.82,140.74],iwate:[39.70,141.15],miyagi:[38.27,140.87],akita:[39.72,140.10],yamagata:[38.24,140.34],fukushima:[37.75,140.47],ibaraki:[36.34,140.45],tochigi:[36.57,139.88],gunma:[36.39,139.06],saitama:[35.86,139.65],chiba:[35.60,140.12],tokyo:[35.68,139.69],kanagawa:[35.45,139.64],niigata:[37.90,139.02],toyama:[36.70,137.21],ishikawa:[36.59,136.63],fukui:[36.07,136.22],yamanashi:[35.66,138.57],nagano:[36.23,138.18],gifu:[35.39,136.72],shizuoka:[34.98,138.38],aichi:[35.18,136.91],mie:[34.73,136.51],shiga:[35.00,135.87],kyoto:[35.02,135.76],osaka:[34.69,135.52],hyogo:[34.69,135.18],nara:[34.69,135.83],wakayama:[33.95,135.17],tottori:[35.50,134.24],shimane:[35.47,133.05],okayama:[34.66,133.93],hiroshima:[34.40,132.46],yamaguchi:[34.19,131.47],tokushima:[34.07,134.56],kagawa:[34.34,134.04],ehime:[33.84,132.77],kochi:[33.56,133.53],fukuoka:[33.61,130.42],saga:[33.25,130.30],nagasaki:[32.74,129.87],kumamoto:[32.79,130.74],oita:[33.24,131.61],miyazaki:[31.91,131.42],kagoshima:[31.56,130.56],okinawa:[26.34,127.68]
              };
              function dist(lat1,lng1,lat2,lng2){
                var R=6371;var dLat=(lat2-lat1)*Math.PI/180;var dLng=(lng2-lng1)*Math.PI/180;
                var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
                return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
              }
              // 県の中心点で近い県を特定
              var prefDists = Object.entries(PREF_COORDS).map(function(e){return{p:e[0],d:dist(lat,lng,e[1][0],e[1][1])}}).sort(function(a,b){return a.d-b.d});
              var nearPrefs = prefDists.slice(0,3).map(function(e){return e.p});
              // 近い県の蔵を表示
              var nearby = data.filter(function(b){return nearPrefs.indexOf(b.p)>=0}).slice(0,5);
              var el = document.getElementById('nearby-list');
              if(!el) return;
              if(nearby.length === 0){
                el.textContent = '近くに酒蔵が見つかりませんでした';
                return;
              }
              var PN = {"hokkaido":"北海道","aomori":"青森","iwate":"岩手","miyagi":"宮城","akita":"秋田","yamagata":"山形","fukushima":"福島","ibaraki":"茨城","tochigi":"栃木","gunma":"群馬","saitama":"埼玉","chiba":"千葉","tokyo":"東京","kanagawa":"神奈川","niigata":"新潟","toyama":"富山","ishikawa":"石川","fukui":"福井","yamanashi":"山梨","nagano":"長野","gifu":"岐阜","shizuoka":"静岡","aichi":"愛知","mie":"三重","shiga":"滋賀","kyoto":"京都","osaka":"大阪","hyogo":"兵庫","nara":"奈良","wakayama":"和歌山","tottori":"鳥取","shimane":"島根","okayama":"岡山","hiroshima":"広島","yamaguchi":"山口","tokushima":"徳島","kagawa":"香川","ehime":"愛媛","kochi":"高知","fukuoka":"福岡","saga":"佐賀","nagasaki":"長崎","kumamoto":"熊本","oita":"大分","miyazaki":"宮崎","kagoshima":"鹿児島","okinawa":"沖縄"};
              el.innerHTML = nearby.map(function(b){
                return '<a href="/shochu/'+b.p+'/'+b.id+'.html" onclick="this.closest(\'#mypage-modal\').remove()" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f5f5f5;text-decoration:none;color:inherit;">' +
                  '<div style="width:36px;height:36px;background:linear-gradient(135deg,#D4728A,#B8452A);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;flex-shrink:0;">'+(b.n?b.n[0]:'酒')+'</div>' +
                  '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:500;color:#333;">'+escHtml(b.n||'')+'</div><div style="font-size:11px;color:#B8452A;">'+escHtml(b.b||'')+'</div><div style="font-size:10px;color:#aaa;">'+(PN[b.p]||b.p)+' '+escHtml(b.a||'')+'</div></div>' +
                  '<div style="font-size:10px;color:#B8452A;flex-shrink:0;">チェックイン →</div></a>';
              }).join('');
            });
          }, function(){
            var el = document.getElementById('nearby-list');
            if(el) el.textContent = '位置情報を許可してください';
          }, {enableHighAccuracy:false,timeout:8000});
        }, 300);

        return questBtn +
          nearbyHtml +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;"><span style="font-size:13px;color:#666;">プラン</span><span style="font-size:12px;font-weight:600;padding:3px 12px;border-radius:12px;background:' + planColor + ';color:' + planTextColor + ';">' + planLabel + '</span></div>' +
          creditHtml +
          summary +
          upgradeBtn;
      }

      function buildHistory() {
        if (history.length === 0) return '<div style="text-align:center;padding:32px 0;color:#ccc;font-size:13px;">まだ閲覧履歴がありません</div>';
        return history.slice(0, 20).map(function(h) {
          var timeAgo = getTimeAgo(h.time);
          return '<a href="/shochu/' + encodeURIComponent(h.pref) + '/' + encodeURIComponent(h.id) + '.html" onclick="this.closest(\'#mypage-modal\').remove()" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f5f5f5;text-decoration:none;color:inherit;">' +
            '<div><div style="font-size:13px;font-weight:500;color:#333;">' + escHtml(h.name) + '</div><div style="font-size:11px;color:#aaa;">' + escHtml(PREF_NAMES[h.pref] || h.pref) + '</div></div>' +
            '<span style="font-size:10px;color:#ccc;">' + timeAgo + '</span></a>';
        }).join('');
      }

      function buildTaste() {
        var sweetness = taste.sweetness || 3;
        var body = taste.body || 3;
        var temp = taste.temp || 'any';
        var scene = taste.scene || '';

        return '<div style="font-size:13px;color:#666;margin-bottom:16px;">好みを設定すると、サクラの提案が合いやすくなります。</div>' +
          '<div style="margin-bottom:16px;">' +
            '<div style="font-size:12px;color:#999;margin-bottom:8px;">甘辛の好み</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">' +
              buildSlider('sweetness', sweetness, '甘口', '辛口') +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:16px;">' +
            '<div style="font-size:12px;color:#999;margin-bottom:8px;">濃淡の好み</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">' +
              buildSlider('body', body, '淡麗', '濃醇') +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:16px;">' +
            '<div style="font-size:12px;color:#999;margin-bottom:8px;">飲み方</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              buildTempChip('冷酒', temp) + buildTempChip('常温', temp) + buildTempChip('燗酒', temp) + buildTempChip('any', temp, 'こだわりなし') +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:16px;">' +
            '<div style="font-size:12px;color:#999;margin-bottom:8px;">よく飲むシーン</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              buildSceneChip('食事と一緒に', scene) + buildSceneChip('一人でゆっくり', scene) + buildSceneChip('仲間と', scene) + buildSceneChip('贈り物', scene) +
            '</div>' +
          '</div>' +
          '<button onclick="saveTasteFromUI()" style="width:100%;padding:11px;background:#B8452A;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">保存する</button>';
      }

      function buildBadges() {
        if (badges.length === 0) return '<div style="text-align:center;padding:32px 0;color:#ccc;font-size:13px;">蔵ページを閲覧すると実績が解除されます</div>';
        return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">' +
          badges.map(function(b) {
            return '<div style="text-align:center;padding:14px 8px;background:#fafaf8;border-radius:10px;border:1px solid #eee;">' +
              '<div style="font-size:24px;margin-bottom:4px;">' + b.icon + '</div>' +
              '<div style="font-size:11px;font-weight:600;color:#333;">' + b.name + '</div>' +
              '<div style="font-size:9px;color:#aaa;margin-top:2px;">' + b.desc + '</div></div>';
          }).join('') + '</div>';
      }

      function buildSlider(name, val, labelL, labelR) {
        var dots = '';
        for (var i = 1; i <= 5; i++) {
          var active = i === val;
          dots += '<button onclick="document.getElementById(\'taste-' + name + '\').value=' + i + ';this.parentElement.querySelectorAll(\'button\').forEach(function(b,j){b.style.background=j+1===' + i + '?\'#B8452A\':\'#eee\';b.style.color=j+1===' + i + '?\'#fff\':\'#999\';})" style="width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;font-size:11px;background:' + (active ? '#B8452A' : '#eee') + ';color:' + (active ? '#fff' : '#999') + ';">' + i + '</button>';
        }
        return '<span style="font-size:10px;color:#aaa;">' + labelL + '</span>' + dots + '<span style="font-size:10px;color:#aaa;">' + labelR + '</span><input type="hidden" id="taste-' + name + '" value="' + val + '">';
      }

      function buildTempChip(val, current, label) {
        var isActive = current === val;
        return '<button onclick="document.getElementById(\'taste-temp\').value=\'' + val + '\';this.parentElement.querySelectorAll(\'button\').forEach(function(b){b.style.background=\'#fff\';b.style.color=\'#666\';b.style.borderColor=\'#eee\';});this.style.background=\'#B8452A\';this.style.color=\'#fff\';this.style.borderColor=\'#B8452A\';" style="font-size:11px;padding:6px 12px;border-radius:16px;border:1px solid ' + (isActive ? '#B8452A' : '#eee') + ';background:' + (isActive ? '#B8452A' : '#fff') + ';color:' + (isActive ? '#fff' : '#666') + ';cursor:pointer;">' + (label || val) + '</button>';
      }

      function buildSceneChip(val, current) {
        var isActive = current === val;
        return '<button onclick="document.getElementById(\'taste-scene\').value=\'' + val + '\';this.parentElement.querySelectorAll(\'button\').forEach(function(b){b.style.background=\'#fff\';b.style.color=\'#666\';b.style.borderColor=\'#eee\';});this.style.background=\'#B8452A\';this.style.color=\'#fff\';this.style.borderColor=\'#B8452A\';" style="font-size:11px;padding:6px 12px;border-radius:16px;border:1px solid ' + (isActive ? '#B8452A' : '#eee') + ';background:' + (isActive ? '#B8452A' : '#fff') + ';color:' + (isActive ? '#fff' : '#666') + ';cursor:pointer;">' + val + '</button>';
      }

      function getTimeAgo(iso) {
        var diff = Date.now() - new Date(iso).getTime();
        var min = Math.floor(diff / 60000);
        if (min < 1) return 'たった今';
        if (min < 60) return min + '分前';
        var hr = Math.floor(min / 60);
        if (hr < 24) return hr + '時間前';
        var day = Math.floor(hr / 24);
        return day + '日前';
      }

      var PREF_NAMES = {"hokkaido":"北海道","aomori":"青森","iwate":"岩手","miyagi":"宮城","akita":"秋田","yamagata":"山形","fukushima":"福島","ibaraki":"茨城","tochigi":"栃木","gunma":"群馬","saitama":"埼玉","chiba":"千葉","tokyo":"東京","kanagawa":"神奈川","niigata":"新潟","toyama":"富山","ishikawa":"石川","fukui":"福井","yamanashi":"山梨","nagano":"長野","gifu":"岐阜","shizuoka":"静岡","aichi":"愛知","mie":"三重","shiga":"滋賀","kyoto":"京都","osaka":"大阪","hyogo":"兵庫","nara":"奈良","wakayama":"和歌山","tottori":"鳥取","shimane":"島根","okayama":"岡山","hiroshima":"広島","yamaguchi":"山口","tokushima":"徳島","kagawa":"香川","ehime":"愛媛","kochi":"高知","fukuoka":"福岡","saga":"佐賀","nagasaki":"長崎","kumamoto":"熊本","oita":"大分","miyazaki":"宮崎","kagoshima":"鹿児島","okinawa":"沖縄"};

      function buildSakeDiary() {
        var logs = JSON.parse(localStorage.getItem('thub_sake_log') || '[]');
        var wishlist = JSON.parse(localStorage.getItem('thub_wishlist') || '[]');
        var html = '';

        // 飲酒記録
        html += '<div style="font-size:14px;font-weight:600;color:#333;margin-bottom:8px;">🍶 飲酒記録</div>';
        if (logs.length === 0) {
          html += '<div style="text-align:center;padding:20px 0;color:#ccc;font-size:13px;">まだ記録がありません</div>';
        } else {
          html += logs.slice(0, 10).map(function(l){
            var stars = ''; for(var i=1;i<=5;i++) stars += i<=l.rating?'★':'☆';
            var date = l.timestamp ? l.timestamp.slice(0,10) : '';
            return '<div style="padding:8px 0;border-bottom:1px solid #f5f5f5;">' +
              '<div style="display:flex;justify-content:space-between;"><div style="font-size:13px;font-weight:500;color:#333;">' + escHtml(l.brewery_name) + '</div><span style="font-size:10px;color:#ccc;">' + date + '</span></div>' +
              (l.brand ? '<div style="font-size:12px;color:#B8452A;">' + escHtml(l.brand) + '</div>' : '') +
              (l.rating > 0 ? '<div style="color:#B8452A;font-size:12px;">' + stars + '</div>' : '') +
            '</div>';
          }).join('');
        }

        // お気に入り蔵
        html += '<div style="font-size:14px;font-weight:600;color:#333;margin:20px 0 8px;">❤️ お気に入り蔵（' + favs.length + '）</div>';
        if (favs.length === 0) {
          html += '<div style="color:#ccc;font-size:12px;padding:8px 0;">まだありません</div>';
        } else {
          html += favs.map(function(f){
            return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5;">' +
              '<div style="flex:1;font-size:13px;color:#333;">' + escHtml(f.brewery_name) + '</div>' +
              '<button data-fav-id="' + escHtml(f.brewery_id) + '" data-fav-name="' + escHtml(f.brewery_name) + '" style="background:none;border:none;color:#ccc;font-size:11px;cursor:pointer;">✕</button></div>';
          }).join('');
        }

        // 飲みたいリスト
        html += '<div style="font-size:14px;font-weight:600;color:#333;margin:20px 0 8px;">📋 飲みたい（' + wishlist.length + '）</div>';
        if (wishlist.length === 0) {
          html += '<div style="color:#ccc;font-size:12px;padding:8px 0;">まだありません</div>';
        } else {
          html += wishlist.map(function(w){
            return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f5f5f5;">' +
              '<div style="flex:1;"><div style="font-size:13px;color:#333;">' + escHtml(w.brewery_name) + '</div>' +
              (w.brand ? '<div style="font-size:11px;color:#B8452A;">' + escHtml(w.brand) + '</div>' : '') + '</div></div>';
          }).join('');
        }

        return html;
      }

      function buildWishlist() {
        var list = JSON.parse(localStorage.getItem('thub_wishlist') || '[]');
        if (list.length === 0) return '<div style="text-align:center;padding:32px 0;color:#ccc;font-size:13px;">飲みたいリストが空です。<br>蔵ページの「📋 飲みたい」で追加しましょう。</div>';
        return '<div style="font-size:12px;color:#888;margin-bottom:8px;">' + list.length + ' 銘柄</div>' +
          list.map(function(w){
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f5f5f5;">' +
              '<div style="flex:1;"><div style="font-size:13px;font-weight:500;color:#333;">' + escHtml(w.brewery_name) + '</div>' +
              (w.brand ? '<div style="font-size:12px;color:#B8452A;">' + escHtml(w.brand) + '</div>' : '') + '</div>' +
              '<button onclick="thubToggleWish(\'' + escAttr(w.brewery_id) + '\',\'' + escAttr(w.brewery_name) + '\',\'' + escAttr(w.brand||'') + '\');this.closest(\'#mypage-modal\').remove();thubShowMypage(\'wishlist\')" style="background:none;border:none;color:#ccc;font-size:11px;cursor:pointer;">✕</button>' +
            '</div>';
          }).join('');
      }

      function buildFavs() {
        if (favs.length === 0) return '<div style="text-align:center;padding:32px 0;color:#ccc;font-size:13px;">まだお気に入りがありません</div>';
        return '<div style="font-size:12px;color:#888;margin-bottom:8px;">' + favs.length + ' 蔵</div>' +
          favs.map(function(f){
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f5f5f5;">' +
              '<div style="flex:1;font-size:13px;font-weight:500;color:#333;">' + escHtml(f.brewery_name) + '</div>' +
              '<button onclick="thubToggleFav(\'' + escAttr(f.brewery_id) + '\',\'' + escAttr(f.brewery_name) + '\');this.closest(\'#mypage-modal\').remove();thubShowMypage(\'favs\')" style="background:none;border:none;color:#ccc;font-size:11px;cursor:pointer;">✕</button>' +
            '</div>';
          }).join('');
      }

      function buildStamps() {
        if (stamps.length === 0) return '<div style="text-align:center;padding:32px 0;color:#ccc;font-size:13px;">まだチェックインがありません。<br>蔵の近く(500m以内)で「📍チェックイン」を押しましょう。</div>';
        var prefSet = new Set();
        stamps.forEach(function(s){ if(s.region) prefSet.add(s.region); });
        var header = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px;">' +
          '<div style="text-align:center;background:#fafaf8;padding:12px 8px;border-radius:10px;"><div style="font-size:20px;font-weight:700;color:#B8452A;">' + stamps.length + '</div><div style="font-size:10px;color:#aaa;">蔵</div></div>' +
          '<div style="text-align:center;background:#fafaf8;padding:12px 8px;border-radius:10px;"><div style="font-size:20px;font-weight:700;color:#B8452A;">' + prefSet.size + '/47</div><div style="font-size:10px;color:#aaa;">都道府県</div></div>' +
        '</div>';
        var list = stamps.slice(0,15).map(function(s){
          var date = s.timestamp ? s.timestamp.slice(0,10) : '';
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5;">' +
            '<div style="font-size:13px;color:#333;">📍 ' + escHtml(s.brewery_name) + '</div>' +
            '<span style="font-size:10px;color:#ccc;">' + date + '</span></div>';
        }).join('');
        return header + list;
      }

      function buildNewBadges() {
        var earned = JSON.parse(localStorage.getItem('thub_badges') || '[]');
        var allBadges = [
          {id:'first_log',name:'初めての一杯',desc:'飲酒記録を初めて付けた',icon:'🍶'},
          {id:'log_5',name:'日本酒ファン',desc:'5杯の飲酒記録',icon:'🌸'},
          {id:'log_10',name:'日本酒通',desc:'10杯の飲酒記録',icon:'🏅'},
          {id:'log_30',name:'酒豪',desc:'30杯の飲酒記録',icon:'🏆'},
          {id:'log_100',name:'日本酒マイスター',desc:'100杯の飲酒記録',icon:'👑'},
          {id:'stamp_1',name:'蔵巡りデビュー',desc:'初チェックイン',icon:'📍'},
          {id:'stamp_5',name:'蔵巡り愛好家',desc:'5蔵チェックイン',icon:'🗺️'},
          {id:'stamp_10',name:'蔵巡りマスター',desc:'10蔵チェックイン',icon:'⭐'},
          {id:'stamp_47',name:'全国制覇',desc:'47都道府県制覇',icon:'🇯🇵'},
          {id:'fav_5',name:'コレクター',desc:'5蔵をお気に入り',icon:'❤️'},
          {id:'wish_5',name:'探求者',desc:'5銘柄を飲みたいリスト',icon:'📋'},
          {id:'taste_set',name:'自分を知る',desc:'味覚診断を完了',icon:'🎯'},
          {id:'region_niigata',name:'新潟マスター',desc:'新潟3蔵以上記録',icon:'🌾'},
          {id:'region_kyoto',name:'京都マスター',desc:'京都3蔵以上記録',icon:'⛩️'},
          {id:'region_hyogo',name:'灘マスター',desc:'兵庫3蔵以上記録',icon:'🏔️'},
        ];
        var header = '<div style="font-size:12px;color:#888;margin-bottom:12px;">' + earned.length + ' / ' + allBadges.length + ' 獲得</div>';
        var grid = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
          allBadges.map(function(b){
            var got = earned.includes(b.id);
            return '<div style="text-align:center;padding:14px 6px;background:' + (got ? '#fafaf8' : '#f8f8f8') + ';border-radius:10px;border:1px solid ' + (got ? '#eee' : '#f0f0f0') + ';' + (got ? '' : 'opacity:0.35;') + '">' +
              '<div style="font-size:24px;margin-bottom:4px;">' + (got ? b.icon : '🔒') + '</div>' +
              '<div style="font-size:10px;font-weight:600;color:#333;">' + b.name + '</div>' +
              '<div style="font-size:8px;color:#aaa;margin-top:1px;">' + b.desc + '</div></div>';
          }).join('') + '</div>';
        return header + grid;
      }

      function buildQuest(){
        var quests = window.thubGetQuests ? window.thubGetQuests() : [];
        if(quests.length === 0){
          return '<div style="text-align:center;padding:32px 0;">' +
            '<div style="font-size:48px;margin-bottom:12px;">🗺️</div>' +
            '<div style="font-family:Shippori Mincho,serif;font-size:18px;font-weight:700;color:#333;margin-bottom:8px;">テロワールクエスト</div>' +
            '<div style="font-size:13px;color:#888;line-height:1.7;margin-bottom:20px;">蔵元の銘柄写真を撮影して投稿しよう。<br>写真がない銘柄には📷マークが表示されています。</div>' +
            '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px;text-align:center;">' +
              '<div style="background:#fdf5f6;border-radius:10px;padding:12px;"><div style="font-size:24px;font-weight:700;color:#B8452A;">0</div><div style="font-size:10px;color:#aaa;">投稿数</div></div>' +
              '<div style="background:#fdf5f6;border-radius:10px;padding:12px;"><div style="font-size:24px;font-weight:700;color:#B8452A;">📸</div><div style="font-size:10px;color:#aaa;">初投稿で<br>バッジ獲得</div></div>' +
            '</div>' +
            '<div style="font-size:11px;color:#ccc;">酒蔵検索から蔵ページを開いて、銘柄の📷マークをタップ</div>' +
          '</div>';
        }

        var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;text-align:center;">' +
          '<div style="background:#fdf5f6;border-radius:10px;padding:10px;"><div style="font-size:22px;font-weight:700;color:#B8452A;">' + quests.length + '</div><div style="font-size:9px;color:#aaa;">投稿数</div></div>' +
          '<div style="background:#fdf5f6;border-radius:10px;padding:10px;"><div style="font-size:22px;font-weight:700;color:#B8452A;">' + new Set(quests.map(function(q){return q.brewery_id})).size + '</div><div style="font-size:9px;color:#aaa;">蔵元数</div></div>' +
          '<div style="background:#fdf5f6;border-radius:10px;padding:10px;"><div style="font-size:22px;font-weight:700;color:#B8452A;">' + (quests.length >= 30 ? '👑' : quests.length >= 10 ? '🏆' : quests.length >= 5 ? '🔍' : '📸') + '</div><div style="font-size:9px;color:#aaa;">ランク</div></div>' +
        '</div>';

        html += '<div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px;">投稿履歴</div>';
        quests.slice().reverse().slice(0, 20).forEach(function(q){
          var date = new Date(q.timestamp).toLocaleDateString('ja-JP');
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5;">' +
            '<div><div style="font-size:13px;font-weight:500;color:#333;">' + escHtml(q.brand_name || '') + '</div><div style="font-size:11px;color:#aaa;">' + escHtml(q.brewery_name) + '</div></div>' +
            '<span style="font-size:10px;color:#ccc;">' + date + '</span></div>';
        });

        return html;
      }

      var tabs = [
        { id: 'home', icon: '🏠', label: 'ホーム' },
        { id: 'diary', icon: '🍶', label: '記録' },
      ];

      var tabBar = '<div style="display:flex;border-bottom:1px solid #f0f0f0;margin:-4px -28px 16px;padding:0 28px;">' +
        tabs.map(function(t) {
          var isActive = t.id === activeTab;
          return '<button onclick="this.closest(\'#mypage-modal\').remove();thubShowMypage(\'' + t.id + '\')" style="flex:1;padding:10px 0;font-size:11px;border:none;background:none;cursor:pointer;color:' + (isActive ? '#B8452A' : '#aaa') + ';border-bottom:2px solid ' + (isActive ? '#B8452A' : 'transparent') + ';font-weight:' + (isActive ? '600' : '400') + ';font-family:Noto Sans JP,sans-serif;">' + t.icon + '<br>' + t.label + '</button>';
        }).join('') + '</div>';

      var content = '';
      if (activeTab === 'home') content = buildHome();
      else if (activeTab === 'diary') content = buildSakeDiary();
      else if (activeTab === 'favs') content = buildFavs();
      else if (activeTab === 'wishlist') content = buildWishlist();
      else if (activeTab === 'stamps') content = buildStamps();
      else if (activeTab === 'quest') content = buildQuest();
      else if (activeTab === 'badges') content = buildNewBadges();
      else if (activeTab === 'taste') content = buildTaste();
      else if (activeTab === 'history') content = buildHistory();

      var modal = document.createElement('div');
      modal.id = 'mypage-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
      modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
      modal.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:440px;width:calc(100% - 32px);padding:28px;box-shadow:0 16px 48px rgba(0,0,0,0.12);max-height:85vh;min-height:70vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:40px;height:40px;background:linear-gradient(135deg,#D4728A,#B8452A);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:600;">' + escHtml(nickname ? nickname[0].toUpperCase() : email[0].toUpperCase()) + '</div>' +
            '<div>' +
              '<div style="display:flex;align-items:center;gap:6px;">' +
                '<span id="mypage-nickname" style="font-size:14px;font-weight:500;color:#333;">' + escHtml(nickname || email.split('@')[0]) + '</span>' +
                '<button onclick="thubEditNickname()" style="background:none;border:none;color:#B8452A;font-size:11px;cursor:pointer;">✏️</button>' +
              '</div>' +
              '<div style="font-size:10px;color:#aaa;">' + escHtml(email) + '</div>' +
            '</div>' +
          '</div>' +
          '<button onclick="this.closest(\'#mypage-modal\').remove()" style="background:#fafaf8;border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;color:#999;font-size:14px;">✕</button>' +
        '</div>' +
        tabBar + content +
        '<button onclick="this.closest(\'#mypage-modal\').remove();thubSignOut()" style="width:100%;padding:10px;background:none;border:1px solid #eee;border-radius:8px;font-size:12px;color:#aaa;cursor:pointer;margin-top:16px;">ログアウト</button>' +
        '<div style="text-align:center;margin-top:24px;"><a href="mailto:info@terroirhub.com?subject=退会希望&body=退会を希望します。%0Aメールアドレス: ' + (currentUser ? currentUser.email : '') + '" style="font-size:10px;color:#ccc;text-decoration:none;">会員退会・解約をご希望の方</a></div>' +
        '</div>';
      document.body.appendChild(modal);

      // ニックネーム編集
      window.thubEditNickname = function() {
        var current = window.thubGetNickname() || '';
        var input = prompt('ニックネームを入力してください（サクラがあなたの名前で呼びます）', current);
        if (input !== null) {
          var name = input.trim().slice(0, 20);
          window.thubSetNickname(name);
          document.getElementById('mypage-modal').remove();
          thubShowMypage('home');
        }
      };

      // 味の好み保存関数をグローバルに
      window.saveTasteFromUI = function() {
        var profile = {
          sweetness: parseInt(document.getElementById('taste-sweetness').value),
          body: parseInt(document.getElementById('taste-body').value),
          temp: document.getElementById('taste-temp').value,
          scene: document.getElementById('taste-scene').value,
        };
        if (window.thub) window.thub.saveTasteProfile(profile);
        document.getElementById('mypage-modal').remove();
        thubShowMypage('taste');
      };
    };

    // プランバッジ表示
    function updatePlanBadge() {
      var badge = document.getElementById('plan-badge');
      if (!badge) return;
      if (currentPlan === 'premium') {
        badge.textContent = 'Premium';
        badge.style.cssText = 'font-size:10px;background:#B8452A;color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;';
      } else if (currentPlan === 'pro') {
        badge.textContent = 'Pro';
        badge.style.cssText = 'font-size:10px;background:#D4728A;color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;';
      } else {
        badge.textContent = '';
        badge.style.cssText = 'display:none;';
      }
    }

    // サブスク購入
    window.thubSubscribe = async function(plan) {
      if (!currentUser) {
        if (typeof showAuth === 'function') showAuth('login');
        return;
      }
      try {
        var res = await fetch('/api/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: plan,
            userId: currentUser.id,
            email: currentUser.email,
          }),
        });
        var data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch (e) {
        console.error('Subscribe error:', e);
      }
    };

    // プラン有効化チェック（購入完了URLパラメータ）
    function checkPlanActivation() {
      var params = new URLSearchParams(window.location.search);
      var activated = params.get('plan_activated');
      if (activated) {
        currentPlan = activated;
        updatePlanBadge();
        var url = new URL(window.location);
        url.searchParams.delete('plan_activated');
        window.history.replaceState({}, '', url);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkPlanActivation);
    } else {
      checkPlanActivation();
    }

    // Expose auth state
    window.thubAuth = {
      get user() { return currentUser; },
      get plan() { return currentPlan; },
      get isLoggedIn() { return !!currentUser; },
      supabase: sb
    };
  }
})();
