/* AIサクラは2026-10-21に撤去。古いページが読み込んでも何も表示しないための空ファイル。
   撤去手順: automation/analytics/strip_sakura.py */
(function(){
  window.openPanel = window.closePanel = window.sendMsg = window.askSug = function(){};
  var css = document.createElement("style");
  css.textContent = ".fab,.fab-label,#fab,#overlay,.skr-fab,.sakura-cta-btn{display:none!important}";
  (document.head || document.documentElement).appendChild(css);
})();
