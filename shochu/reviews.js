// Terroir HUB SHOCHU — レビューコンポーネント
// 使い方: 蒸留所ページの末尾に <script src="/shochu/reviews.js"></script> を追加
// 前提: auth.js が先に読み込まれ window.thubAuth が存在すること

(function(){
  'use strict';

  const SB_URL = 'https://hhwavxavuqqfiehrogwv.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhod2F2eGF2dXFxZmllaHJvZ3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Njk3MzAsImV4cCI6MjA4OTU0NTczMH0.tHMQ_u51jp69AMUKKtTvxL09Sr11JFPKGRhKMmUzEjg';
  const CATEGORY = 'shochu';
  const ACCENT = '#8B5E3C';

  function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function getProducerId(){
    const scripts = document.querySelectorAll('script[src*="reviews.js"]');
    for(const s of scripts){
      if(s.dataset.producerId) return s.dataset.producerId;
    }
    const path = location.pathname;
    const match = path.match(/\/([^/]+)\.html$/);
    return match ? match[1] : null;
  }

  const producerId = getProducerId();
  if(!producerId){
    console.warn('[Reviews] No producer ID detected. Skipping review component.');
    return;
  }

  // Drinking methods for shochu
  const DRINKING_METHODS = [
    { value: '', label: '選択してください' },
    { value: 'oyuwari', label: 'お湯割り' },
    { value: 'mizuwari', label: '水割り' },
    { value: 'on_the_rocks', label: 'ロック' },
    { value: 'straight', label: 'ストレート' },
    { value: 'sodawari', label: 'ソーダ割り' },
    { value: 'maewari', label: '前割り' },
    { value: 'other', label: 'その他' }
  ];

  const style = document.createElement('style');
  style.textContent = `
    .rv-section{max-width:800px;margin:40px auto;padding:0 20px;}
    .rv-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f0ede8;}
    .rv-title{font-family:'Shippori Mincho',serif;font-size:22px;font-weight:700;color:#1a1a1a;}
    .rv-count{font-size:13px;color:#aaa;}
    .rv-write-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border:none;border-radius:24px;background:${ACCENT};color:#fff;font-size:14px;font-weight:500;cursor:pointer;font-family:'Noto Sans JP',sans-serif;transition:opacity 0.15s;}
    .rv-write-btn:hover{opacity:0.85;}
    .rv-write-btn:disabled{opacity:0.4;cursor:default;}
    .rv-form-overlay{display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);align-items:center;justify-content:center;}
    .rv-form-overlay.open{display:flex;}
    .rv-form{background:#fff;border-radius:16px;width:95%;max-width:560px;max-height:90vh;overflow-y:auto;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.15);}
    .rv-form-title{font-family:'Shippori Mincho',serif;font-size:20px;font-weight:700;margin-bottom:20px;color:#1a1a1a;}
    .rv-form-close{position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;color:#999;cursor:pointer;}
    .rv-field{margin-bottom:16px;}
    .rv-field label{display:block;font-size:13px;color:#666;margin-bottom:4px;font-weight:500;}
    .rv-field input,.rv-field textarea,.rv-field select{width:100%;padding:10px 12px;border:1.5px solid #e0ddd8;border-radius:8px;font-size:14px;font-family:'Noto Sans JP',sans-serif;outline:none;transition:border-color 0.2s;color:#333;background:#fff;}
    .rv-field input:focus,.rv-field textarea:focus,.rv-field select:focus{border-color:${ACCENT};}
    .rv-field textarea{resize:vertical;min-height:80px;}
    .rv-stars{display:flex;gap:4px;}
    .rv-star{font-size:28px;cursor:pointer;color:#ddd;transition:color 0.1s;background:none;border:none;padding:0;line-height:1;}
    .rv-star.filled{color:#F9A825;}
    .rv-star:hover{color:#F9A825;}
    .rv-submit-btn{width:100%;padding:12px;border:none;border-radius:10px;background:${ACCENT};color:#fff;font-size:15px;font-weight:600;cursor:pointer;font-family:'Noto Sans JP',sans-serif;transition:opacity 0.15s;margin-top:8px;}
    .rv-submit-btn:hover{opacity:0.85;}
    .rv-submit-btn:disabled{opacity:0.4;cursor:default;}
    .rv-list{display:flex;flex-direction:column;gap:16px;}
    .rv-item{background:#fff;border:1px solid #f0ede8;border-radius:12px;padding:20px;transition:box-shadow 0.15s;}
    .rv-item:hover{box-shadow:0 2px 12px rgba(0,0,0,0.04);}
    .rv-item-header{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
    .rv-avatar{width:36px;height:36px;border-radius:50%;background:#f0ede8;display:flex;align-items:center;justify-content:center;font-size:14px;color:#999;font-weight:600;flex-shrink:0;}
    .rv-user-info{flex:1;min-width:0;}
    .rv-user-name{font-size:14px;font-weight:500;color:#333;}
    .rv-date{font-size:12px;color:#bbb;}
    .rv-item-stars{font-size:16px;color:#F9A825;letter-spacing:1px;}
    .rv-item-title{font-family:'Shippori Mincho',serif;font-size:17px;font-weight:600;color:#1a1a1a;margin-bottom:6px;}
    .rv-item-product{font-size:13px;color:${ACCENT};margin-bottom:8px;font-weight:500;}
    .rv-item-body{font-size:14px;color:#555;line-height:1.7;margin-bottom:10px;}
    .rv-tasting-notes{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}
    .rv-note-tag{font-size:12px;padding:4px 10px;border-radius:8px;background:#f8f6f3;color:#888;}
    .rv-note-label{color:#aaa;margin-right:2px;}
    .rv-item-footer{display:flex;align-items:center;gap:16px;}
    .rv-helpful-btn{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#aaa;background:none;border:1px solid #eee;border-radius:16px;padding:4px 12px;cursor:pointer;transition:all 0.15s;font-family:'Noto Sans JP',sans-serif;}
    .rv-helpful-btn:hover{border-color:${ACCENT};color:${ACCENT};}
    .rv-helpful-btn.voted{border-color:${ACCENT};color:${ACCENT};background:rgba(139,94,60,0.06);}
    .rv-method-tag{font-size:11px;padding:3px 8px;border-radius:6px;background:#f5f0eb;color:#8B7355;}
    .rv-empty{text-align:center;padding:40px 20px;color:#ccc;}
    .rv-empty-text{font-size:14px;color:#bbb;}
    .rv-loading{text-align:center;padding:24px;}
    .rv-loading-spinner{display:inline-block;width:24px;height:24px;border:3px solid #eee;border-top-color:${ACCENT};border-radius:50%;animation:rvSpin 0.8s linear infinite;}
    @keyframes rvSpin{to{transform:rotate(360deg);}}
    @media(max-width:640px){
      .rv-header{flex-direction:column;align-items:flex-start;gap:12px;}
      .rv-form{padding:20px;margin:10px;}
    }
  `;
  document.head.appendChild(style);

  const section = document.createElement('section');
  section.className = 'rv-section';
  section.id = 'reviews';
  section.innerHTML = `
    <div class="rv-header">
      <div>
        <div class="rv-title">レビュー</div>
        <div class="rv-count" id="rvCount"></div>
      </div>
      <button class="rv-write-btn" id="rvWriteBtn">&#9998; レビューを書く</button>
    </div>
    <div class="rv-loading" id="rvLoading"><div class="rv-loading-spinner"></div></div>
    <div class="rv-list" id="rvList" style="display:none;"></div>
    <div class="rv-empty" id="rvEmpty" style="display:none;">
      <div class="rv-empty-text">まだレビューがありません。最初のレビューを書いてみませんか？</div>
    </div>
  `;

  const formOverlay = document.createElement('div');
  formOverlay.className = 'rv-form-overlay';
  formOverlay.id = 'rvFormOverlay';
  const methodOptions = DRINKING_METHODS.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  formOverlay.innerHTML = `
    <div class="rv-form" style="position:relative;">
      <button class="rv-form-close" id="rvFormClose">&times;</button>
      <div class="rv-form-title">レビューを書く</div>
      <div class="rv-field">
        <label>評価 *</label>
        <div class="rv-stars" id="rvFormStars">
          <button class="rv-star" data-val="1">&#9733;</button>
          <button class="rv-star" data-val="2">&#9733;</button>
          <button class="rv-star" data-val="3">&#9733;</button>
          <button class="rv-star" data-val="4">&#9733;</button>
          <button class="rv-star" data-val="5">&#9733;</button>
        </div>
      </div>
      <div class="rv-field">
        <label>銘柄名</label>
        <input type="text" id="rvProductName" placeholder="例: 黒霧島、赤兎馬">
      </div>
      <div class="rv-field">
        <label>タイトル</label>
        <input type="text" id="rvTitle" placeholder="一言で表すと...">
      </div>
      <div class="rv-field">
        <label>レビュー本文</label>
        <textarea id="rvBody" placeholder="味わいや印象を自由にお書きください"></textarea>
      </div>
      <div class="rv-field">
        <label>香り</label>
        <input type="text" id="rvAroma" placeholder="例: 芋の甘い香り、黒糖のような風味">
      </div>
      <div class="rv-field">
        <label>味わい</label>
        <input type="text" id="rvTaste" placeholder="例: まろやかな口当たり、コクのある旨味">
      </div>
      <div class="rv-field">
        <label>余韻</label>
        <input type="text" id="rvFinish" placeholder="例: 爽やかなキレ、ほのかな甘み">
      </div>
      <div class="rv-field">
        <label>飲み方</label>
        <select id="rvMethod">${methodOptions}</select>
      </div>
      <button class="rv-submit-btn" id="rvSubmitBtn">投稿する</button>
      <p id="rvFormError" style="font-size:12px;color:#d32f2f;margin-top:8px;display:none;"></p>
    </div>
  `;

  const main = document.querySelector('main') || document.querySelector('.distillery-content') || document.body;
  main.appendChild(section);
  document.body.appendChild(formOverlay);

  let formRating = 0;
  let reviews = [];

  const formStars = document.getElementById('rvFormStars');
  formStars.querySelectorAll('.rv-star').forEach(star => {
    star.addEventListener('click', function(){
      formRating = parseInt(this.dataset.val);
      updateFormStars();
    });
    star.addEventListener('mouseenter', function(){
      const val = parseInt(this.dataset.val);
      formStars.querySelectorAll('.rv-star').forEach((s,i) => {
        s.classList.toggle('filled', i < val);
      });
    });
  });
  formStars.addEventListener('mouseleave', updateFormStars);

  function updateFormStars(){
    formStars.querySelectorAll('.rv-star').forEach((s,i) => {
      s.classList.toggle('filled', i < formRating);
    });
  }

  document.getElementById('rvWriteBtn').addEventListener('click', function(){
    if(!window.thubAuth || !window.thubAuth.user){
      alert('レビューを書くにはログインが必要です。');
      return;
    }
    document.getElementById('rvFormOverlay').classList.add('open');
  });
  document.getElementById('rvFormClose').addEventListener('click', function(){
    document.getElementById('rvFormOverlay').classList.remove('open');
  });
  formOverlay.addEventListener('click', function(e){
    if(e.target === formOverlay) formOverlay.classList.remove('open');
  });

  document.getElementById('rvSubmitBtn').addEventListener('click', async function(){
    const errEl = document.getElementById('rvFormError');
    errEl.style.display = 'none';

    if(!window.thubAuth || !window.thubAuth.user){
      errEl.textContent = 'ログインが必要です。';
      errEl.style.display = 'block';
      return;
    }
    if(formRating === 0){
      errEl.textContent = '評価（星）を選択してください。';
      errEl.style.display = 'block';
      return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = '投稿中...';

    const payload = {
      user_id: window.thubAuth.user.id,
      producer_id: producerId,
      category: CATEGORY,
      rating: formRating,
      title: document.getElementById('rvTitle').value.trim() || null,
      body: document.getElementById('rvBody').value.trim() || null,
      aroma: document.getElementById('rvAroma').value.trim() || null,
      taste: document.getElementById('rvTaste').value.trim() || null,
      finish: document.getElementById('rvFinish').value.trim() || null,
      drinking_method: document.getElementById('rvMethod').value || null,
      product_name: document.getElementById('rvProductName').value.trim() || null
    };

    try {
      const token = window.thubAuth.session?.access_token || SB_KEY;
      const res = await fetch(`${SB_URL}/rest/v1/reviews`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error(await res.text());
      formOverlay.classList.remove('open');
      resetForm();
      loadReviews();
    } catch(e) {
      console.error('[Reviews] Submit error:', e);
      errEl.textContent = '投稿に失敗しました。もう一度お試しください。';
      errEl.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = '投稿する';
  });

  function resetForm(){
    formRating = 0;
    updateFormStars();
    ['rvTitle','rvBody','rvAroma','rvTaste','rvFinish','rvProductName'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('rvMethod').selectedIndex = 0;
  }

  async function loadReviews(){
    try {
      const url = `${SB_URL}/rest/v1/reviews?producer_id=eq.${encodeURIComponent(producerId)}&category=eq.${CATEGORY}&order=created_at.desc&limit=100`;
      const res = await fetch(url, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      if(!res.ok) throw new Error(res.status);
      reviews = await res.json();
    } catch(e) {
      console.warn('[Reviews] Load failed:', e);
      reviews = [];
    }
    renderReviews();
  }

  const METHOD_LABELS = {
    oyuwari: 'お湯割り', mizuwari: '水割り', on_the_rocks: 'ロック',
    straight: 'ストレート', sodawari: 'ソーダ割り', maewari: '前割り', other: 'その他'
  };

  function renderStars(n){
    let s = '';
    for(let i=0;i<5;i++) s += i < n ? '&#9733;' : '&#9734;';
    return s;
  }

  function formatDate(iso){
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  }

  function renderReviews(){
    document.getElementById('rvLoading').style.display = 'none';
    const listEl = document.getElementById('rvList');
    const emptyEl = document.getElementById('rvEmpty');
    const countEl = document.getElementById('rvCount');

    if(reviews.length === 0){
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
      countEl.textContent = '';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display = 'flex';
    const avg = (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1);
    countEl.textContent = `${reviews.length}件のレビュー（平均 ${avg}）`;

    let html = '';
    reviews.forEach(r => {
      const initial = (r.user_id || '?').substring(0,2).toUpperCase();
      const notes = [];
      if(r.aroma) notes.push(`<span class="rv-note-tag"><span class="rv-note-label">香り:</span> ${escHtml(r.aroma)}</span>`);
      if(r.taste) notes.push(`<span class="rv-note-tag"><span class="rv-note-label">味:</span> ${escHtml(r.taste)}</span>`);
      if(r.finish) notes.push(`<span class="rv-note-tag"><span class="rv-note-label">余韻:</span> ${escHtml(r.finish)}</span>`);

      html += `<div class="rv-item">
        <div class="rv-item-header">
          <div class="rv-avatar">${initial}</div>
          <div class="rv-user-info">
            <div class="rv-user-name">ユーザー</div>
            <div class="rv-date">${formatDate(r.created_at)}</div>
          </div>
          <div class="rv-item-stars">${renderStars(r.rating)}</div>
        </div>
        ${r.product_name ? `<div class="rv-item-product">${escHtml(r.product_name)}</div>` : ''}
        ${r.title ? `<div class="rv-item-title">${escHtml(r.title)}</div>` : ''}
        ${r.body ? `<div class="rv-item-body">${escHtml(r.body)}</div>` : ''}
        ${notes.length ? `<div class="rv-tasting-notes">${notes.join('')}</div>` : ''}
        <div class="rv-item-footer">
          ${r.drinking_method ? `<span class="rv-method-tag">${METHOD_LABELS[r.drinking_method] || escHtml(r.drinking_method)}</span>` : ''}
          <button class="rv-helpful-btn" data-review-id="${r.id}" onclick="window._rvHelpful(this,'${r.id}')">&#128077; 参考になった <span>${r.helpful_count || 0}</span></button>
        </div>
      </div>`;
    });
    listEl.innerHTML = html;
  }

  window._rvHelpful = async function(btn, reviewId){
    if(!window.thubAuth || !window.thubAuth.user){
      alert('ログインが必要です。');
      return;
    }
    const token = window.thubAuth.session?.access_token || SB_KEY;
    try {
      const res = await fetch(`${SB_URL}/rest/v1/review_helpful`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          review_id: reviewId,
          user_id: window.thubAuth.user.id
        })
      });
      if(res.ok){
        btn.classList.add('voted');
        const countSpan = btn.querySelector('span');
        countSpan.textContent = parseInt(countSpan.textContent) + 1;
      }
    } catch(e){
      console.warn('[Reviews] Helpful vote failed:', e);
    }
  };

  loadReviews();
})();
