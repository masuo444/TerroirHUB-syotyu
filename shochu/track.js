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
