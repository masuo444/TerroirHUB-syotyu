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


// ── AIサクラ チャットUI デザイン統一（デモ版と統一） ──
(function(){
  var CSS=[
    '.panel{max-width:none!important;height:88svh!important;box-shadow:0 -24px 60px rgba(0,0,0,.5)!important;}',
    '@media(min-width:701px){',
    '.overlay{align-items:stretch!important;justify-content:flex-end!important;}',
    '.panel{width:420px!important;height:100%!important;border-radius:0!important;max-width:100vw!important;transform:translateX(100%)!important;box-shadow:-8px 0 40px rgba(0,0,0,.4)!important;}',
    '.overlay.open .panel{transform:translateX(0)!important;}',
    '.p-handle{display:none!important;}',
    '}',
    '.inp-row{padding-bottom:max(16px,env(safe-area-inset-bottom))!important;}',
    '.msg.butler .bubble{border-left-width:2px!important;line-height:1.9!important;letter-spacing:.03em!important;}',
    '.msg{animation:_su_in .3s ease both!important;}',
    '@keyframes _su_in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}',
    '.chat::-webkit-scrollbar{width:2px!important;}',
    '.mob-close-bar{display:none;padding:8px 16px 4px;flex-shrink:0;}',
    '.mob-close-bar button{width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:.8rem;letter-spacing:.1em;cursor:pointer;font-family:inherit;transition:all .2s;}',
    '.mob-close-bar button:hover{color:var(--text);}',
    '@media(max-width:699px){.mob-close-bar{display:block;}}'
  ].join('');
  function inject(){
    if(document.getElementById('_su_style'))return;
    var panel=document.querySelector('.panel');
    if(!panel)return;
    var row=panel.querySelector('.inp-row');
    if(!row)return;
    var s=document.createElement('style');s.id='_su_style';s.textContent=CSS;document.head.appendChild(s);
    if(!panel.querySelector('.mob-close-bar')){
      var bar=document.createElement('div');bar.className='mob-close-bar';
      bar.innerHTML='<button onclick="typeof closePanel===\'function\'&&closePanel()">✕ チャットを閉じる</button>';
      row.insertAdjacentElement('afterend',bar);
    }
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',inject):inject();
})();
