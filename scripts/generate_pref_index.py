#!/usr/bin/env python3
"""
各県の蒸留所一覧ページ（index.html）を生成。
JSONデータから蒸留所リストをインライン埋め込みし、JSで動的フィルタリング。
"""

import json
import glob
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = 'shochu.terroirhub.com'

PREF_NAMES = {
    'hokkaido':'北海道','aomori':'青森県','iwate':'岩手県','miyagi':'宮城県','akita':'秋田県',
    'yamagata':'山形県','fukushima':'福島県','ibaraki':'茨城県','tochigi':'栃木県','gunma':'群馬県',
    'saitama':'埼玉県','chiba':'千葉県','tokyo':'東京都','kanagawa':'神奈川県','niigata':'新潟県',
    'toyama':'富山県','ishikawa':'石川県','fukui':'福井県','yamanashi':'山梨県','nagano':'長野県',
    'gifu':'岐阜県','shizuoka':'静岡県','aichi':'愛知県','mie':'三重県','shiga':'滋賀県',
    'kyoto':'京都府','osaka':'大阪府','hyogo':'兵庫県','nara':'奈良県','wakayama':'和歌山県',
    'tottori':'鳥取県','shimane':'島根県','okayama':'岡山県','hiroshima':'広島県','yamaguchi':'山口県',
    'tokushima':'徳島県','kagawa':'香川県','ehime':'愛媛県','kochi':'高知県','fukuoka':'福岡県',
    'saga':'佐賀県','nagasaki':'長崎県','kumamoto':'熊本県','oita':'大分県','miyazaki':'宮崎県',
    'kagoshima':'鹿児島県','okinawa':'沖縄県'
}

INGREDIENT_LABELS = {
    'sweet_potato': '芋焼酎', 'barley': '麦焼酎', 'rice': '米焼酎',
    'brown_sugar': '黒糖焼酎', 'buckwheat': 'そば焼酎', 'awamori': '泡盛',
    'kasutori': '粕取り焼酎', 'mixed': '混和焼酎',
}

def esc(s):
    if not s: return ''
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;').replace("'","&#39;")

def generate_pref_index(pref_slug, distilleries):
    pref_name = PREF_NAMES.get(pref_slug, pref_slug)
    count = len(distilleries)

    if count == 0:
        return None

    # Build inline JSON for JS
    inline_data = []
    for d in distilleries:
        inline_data.append({
            'id': d.get('id',''),
            'name': d.get('name',''),
            'brand': d.get('brand',''),
            'type': d.get('type',''),
            'area': d.get('area',''),
            'founded': d.get('founded',''),
            'founded_era': d.get('founded_era',''),
            'desc': (d.get('desc','')[:100] + '…') if len(d.get('desc','')) > 100 else d.get('desc',''),
            'main_ingredient': d.get('main_ingredient',''),
            'koji_type': d.get('koji_type',''),
        })

    json_str = json.dumps(inline_data, ensure_ascii=False)

    # ItemList schema
    items_schema = []
    for i, d in enumerate(distilleries):
        items_schema.append({
            "@type": "ListItem",
            "position": i + 1,
            "url": f"https://{DOMAIN}/shochu/{pref_slug}/{d['id']}.html",
            "name": d.get('name','')
        })

    schema = json.dumps({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": f"{pref_name}の焼酎蒸留所一覧",
        "numberOfItems": count,
        "itemListElement": items_schema
    }, ensure_ascii=False)

    spirit_word = '泡盛' if pref_slug == 'okinawa' else '焼酎'
    title_text = f"{pref_name}の{spirit_word}蒸留所一覧（{count}蔵）— Terroir HUB"

    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title_text)}</title>
<meta name="description" content="{esc(pref_name)}の{spirit_word}蒸留所{count}蔵を一覧表示。蔵名・銘柄・原料・地域で検索・フィルタリング。Terroir HUB SHOCHU。">
<link rel="canonical" href="https://{DOMAIN}/shochu/{pref_slug}/">
<link rel="alternate" hreflang="ja" href="https://{DOMAIN}/shochu/{pref_slug}/">
<link rel="alternate" hreflang="en" href="https://{DOMAIN}/shochu/en/{pref_slug}/">
<link rel="alternate" hreflang="x-default" href="https://{DOMAIN}/shochu/en/{pref_slug}/">
<script type="application/ld+json">{schema}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600;700&family=Noto+Sans+JP:wght@300;400;500;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{background:#FAF8F5;color:#1A1814;font-family:'Noto Sans JP','DM Sans',sans-serif;font-size:16px;line-height:1.85;}}
.nav{{position:fixed;top:0;left:0;right:0;z-index:100;height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:rgba(250,248,245,0.96);backdrop-filter:blur(20px);border-bottom:1px solid #E5DDD5;}}
.nav-brand{{display:flex;align-items:center;gap:9px;text-decoration:none;}}
.nav-logo{{font-family:'Shippori Mincho',serif;font-size:18px;font-weight:700;letter-spacing:0.06em;color:#1A1814;}}
.nav-logo-sub{{font-size:10px;color:#8A8070;letter-spacing:0.06em;margin-left:8px;}}
.nav-r{{display:flex;gap:12px;}}
.nav-r a{{font-size:13px;color:#8B5E3C;text-decoration:none;font-weight:500;}}
.nav-r a:hover{{opacity:0.7;}}
.main{{max-width:1100px;margin:0 auto;padding:78px 24px 48px;}}
.breadcrumb{{font-size:13px;color:#8A8070;margin-bottom:24px;}}
.breadcrumb a{{color:#8B5E3C;text-decoration:none;}}
.breadcrumb a:hover{{text-decoration:underline;}}
.header{{margin-bottom:32px;}}
.header h1{{font-family:'Shippori Mincho',serif;font-size:clamp(26px,4vw,36px);font-weight:700;color:#1A1814;margin-bottom:6px;}}
.header .count{{font-size:14px;color:#8A8070;}}
.filters{{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;}}
.filter-btn{{background:#fff;border:1px solid #E5DDD5;color:#3D3830;font-size:13px;padding:6px 14px;border-radius:6px;cursor:pointer;transition:all 0.15s;font-family:'Noto Sans JP',sans-serif;}}
.filter-btn:hover,.filter-btn.active{{border-color:#8B5E3C;color:#8B5E3C;background:rgba(139,94,60,0.06);}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}}
@media(max-width:900px){{.grid{{grid-template-columns:repeat(2,1fr);}}}}
@media(max-width:560px){{.grid{{grid-template-columns:1fr;}}}}
.card{{background:#fff;border:1px solid #E5DDD5;border-radius:10px;padding:20px;transition:all 0.2s;text-decoration:none;display:block;color:inherit;}}
.card:hover{{border-color:#8B5E3C;box-shadow:0 4px 16px rgba(0,0,0,0.04);transform:translateY(-2px);}}
.card-name{{font-family:'Shippori Mincho',serif;font-size:17px;font-weight:600;color:#1A1814;margin-bottom:2px;}}
.card-brand{{font-size:13px;color:#8B5E3C;font-weight:500;margin-bottom:4px;}}
.card-meta{{font-size:12px;color:#8A8070;margin-bottom:6px;}}
.card-desc{{font-size:12px;color:#8A8070;line-height:1.7;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}}
.card-tags{{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;}}
.tag{{font-size:10px;padding:2px 8px;border-radius:3px;background:rgba(139,94,60,0.06);color:#8B5E3C;border:1px solid rgba(139,94,60,0.12);}}
.empty{{text-align:center;padding:48px;color:#8A8070;font-size:14px;}}
footer{{background:#1A1814;padding:32px 24px;text-align:center;margin-top:48px;}}
footer p{{font-size:12px;color:rgba(255,255,255,0.3);}}
footer a{{color:rgba(255,255,255,0.5);text-decoration:none;}}
</style>
</head>
<body>
<nav class="nav">
  <a class="nav-brand" href="/">
    <span class="nav-logo">Terroir HUB</span>
    <span class="nav-logo-sub">SHOCHU</span>
  </a>
  <div class="nav-r">
    <a href="/shochu/guide/">焼酎ガイド</a>
    <a href="/">蒸留所検索</a>
  </div>
</nav>
<main class="main">
  <div class="breadcrumb">
    <a href="/">ホーム</a> &gt; <a href="/#regions">蒸留所検索</a> &gt; {esc(pref_name)}
  </div>
  <div class="header">
    <h1>{esc(pref_name)}の{spirit_word}蒸留所</h1>
    <p class="count">{count}蔵</p>
  </div>
  <div class="filters" id="filters"></div>
  <div class="grid" id="grid"></div>
</main>
<footer>
  <p><a href="/">Terroir HUB SHOCHU</a> &copy; 2026 合同会社FOMUS</p>
</footer>
<script>
const B={json_str};
const ILABELS={{'sweet_potato':'芋','barley':'麦','rice':'米','brown_sugar':'黒糖','buckwheat':'そば','awamori':'泡盛','kasutori':'粕取り','mixed':'混和'}};
const areas=[...new Set(B.map(b=>b.area).filter(Boolean))].sort();
const types=[...new Set(B.map(b=>b.main_ingredient).filter(Boolean))];
let curArea='',curType='';
function renderFilters(){{
  const f=document.getElementById('filters');
  let h='<button class="filter-btn active" onclick="curArea=\\'\\';curType=\\'\\';renderFilters();render()">すべて</button>';
  if(types.length>1)types.forEach(t=>{{h+='<button class="filter-btn'+(curType===t?' active':'')+'" onclick="curType=curType===\\''+t+'\\'?\\'\\':'+JSON.stringify(t)+';curArea=\\'\\';renderFilters();render()">'+((ILABELS[t]||t))+'</button>';}});
  if(areas.length>1)areas.forEach(a=>{{h+='<button class="filter-btn'+(curArea===a?' active':'')+'" onclick="curArea=curArea===\\''+a.replace(/'/g,"\\\\'")+'\\' ?\\'\\':'+JSON.stringify(a)+';curType=\\'\\';renderFilters();render()">'+a+'</button>';}});
  f.innerHTML=h;
}}
function render(){{
  const g=document.getElementById('grid');
  const filtered=B.filter(b=>(!curArea||b.area===curArea)&&(!curType||b.main_ingredient===curType));
  if(!filtered.length){{g.innerHTML='<div class="empty">該当する蒸留所がありません</div>';return;}}
  g.innerHTML=filtered.map(b=>{{
    const tags=[];
    if(b.main_ingredient&&ILABELS[b.main_ingredient])tags.push(ILABELS[b.main_ingredient]);
    if(b.koji_type)tags.push(b.koji_type);
    return '<a class="card" href="/shochu/{pref_slug}/'+b.id+'.html">'+
      '<div class="card-name">'+b.name+'</div>'+
      (b.brand?'<div class="card-brand">'+b.brand+'</div>':'')+
      '<div class="card-meta">'+(b.area||'')+(b.founded?' ・ 創業'+b.founded+'年':'')+'</div>'+
      (b.desc?'<div class="card-desc">'+b.desc+'</div>':'')+
      (tags.length?'<div class="card-tags">'+tags.map(t=>'<span class="tag">'+t+'</span>').join('')+'</div>':'')+
    '</a>';
  }}).join('');
}}
renderFilters();render();
</script>
</body>
</html>'''

# Main
json_files = sorted(glob.glob(os.path.join(BASE, 'data', 'data_*_distilleries.json')))
total = 0

for jf in json_files:
    pref = os.path.basename(jf).replace('data_', '').replace('_distilleries.json', '')
    with open(jf, 'r', encoding='utf-8') as f:
        distilleries = json.load(f)

    if not distilleries:
        print(f"  {pref}: 0 distilleries (skipped)")
        continue

    html = generate_pref_index(pref, distilleries)
    if html:
        out_dir = os.path.join(BASE, 'shochu', pref)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        total += 1
        print(f"  {pref}: {len(distilleries)} distilleries → index.html")

print(f"\nDone: {total} prefecture index pages generated")
