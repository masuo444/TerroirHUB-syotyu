#!/usr/bin/env python3
"""
全蒸留所HTMLページを一括再生成。
テンプレートCSS + FAB + サクラパネル + Terroir HUBヘッダーを全蒸留所に適用。
"""

import json
import glob
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# テンプレートからCSS取得
with open(os.path.join(BASE, 'template_shochu.html'), 'r') as f:
    tmpl = f.read()
CSS = tmpl[tmpl.find('<style>') + 7:tmpl.find('</style>')]

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

# 原料の日本語表示
INGREDIENT_LABELS = {
    'sweet_potato': '芋焼酎',
    'barley': '麦焼酎',
    'rice': '米焼酎',
    'brown_sugar': '黒糖焼酎',
    'buckwheat': 'そば焼酎',
    'awamori': '泡盛',
    'kasutori': '粕取り焼酎',
    'mixed': '混和焼酎',
}

DOMAIN = 'shochu.terroirhub.com'

def esc(s):
    if not s: return ''
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

def generate_page(b, pref_slug, siblings=None):
    pref_name = PREF_NAMES.get(pref_slug, pref_slug)
    name = b.get('name','')
    brand = b.get('brand','')
    founded = b.get('founded','')
    founded_era = b.get('founded_era','')
    desc = b.get('desc','')
    address = b.get('address','')
    tel = b.get('tel','')
    url = b.get('url','')
    area = b.get('area','')
    visit = b.get('visit','')
    station = b.get('nearest_station','')
    source = b.get('source','')
    features = b.get('features', [])
    brands = b.get('brands', [])
    spirit_type = b.get('spirit_type','')
    koji_type = b.get('koji_type','')
    main_ingredient = b.get('main_ingredient','')

    # Spirit type label
    spirit_label = '泡盛' if spirit_type == 'awamori' else INGREDIENT_LABELS.get(main_ingredient, '焼酎')
    badge_text = 'TERROIR HUB AWAMORI' if spirit_type == 'awamori' else 'TERROIR HUB SHOCHU'

    years = ''
    founded = str(founded) if founded else ''
    if founded and founded.isdigit():
        years = str(2026 - int(founded))

    # Brands HTML
    brands_html = ''
    for br in brands[:3]:
        if isinstance(br, str):
            br = {'name': br, 'specs': ''}
        if not isinstance(br, dict):
            continue
        br_name = br.get('name','') if isinstance(br.get('name'), str) else str(br.get('name',''))
        br_specs = br.get('specs','') if isinstance(br.get('specs'), str) else str(br.get('specs',''))
        br_type = br.get('type','')
        br_ingredient = br.get('ingredient','')
        specs_short = br_specs.split('、')[0] if br_specs else ''

        koji_badge_html = ''
        if koji_type:
            koji_class = 'kuro' if '黒' in koji_type else ('shiro' if '白' in koji_type else 'ki')
            koji_badge_html = f'<div class="koji-badge {koji_class}">{esc(koji_type)}</div>'

        brands_html += f'''
    <div class="brand-card">
      <div class="brand-img-wrap">
        <div class="brand-img-placeholder">PHOTO</div>
      </div>
      {koji_badge_html}
      {f'<div class="ingredient-tag">{esc(br_ingredient)}</div>' if br_ingredient else ''}
      <h3 class="brand-name">{esc(br_name)}</h3>
      <p class="brand-type">{esc(br_type or specs_short)}</p>
      {f'<p class="brand-desc">{esc(br_specs)}</p>' if br_specs else ''}
    </div>'''

    # Features HTML
    nums = ['①','②','③']
    features_html = ''
    for i, feat in enumerate([_f for _f in features if not (desc and (str(_f).strip() in desc or desc in str(_f).strip()))][:3]):
        feat_text = feat if isinstance(feat, str) else str(feat)
        features_html += f'''
      <div class="fact">
        <div class="fact-num" style="font-family:'Zen Old Mincho',serif;font-size:42px;opacity:0.7;">{nums[i] if i < 3 else str(i+1)}</div>
        <div>
          <div class="fact-lbl">特徴 {i+1}</div>
          <div class="fact-body">{esc(feat_text)}</div>
        </div>
      </div>'''

    # Facts
    facts_html = ''
    if years:
        facts_html += f'''
          <div class="fact">
            <div class="fact-num">{years}</div>
            <div>
              <div class="fact-lbl">年の歴史</div>
              <div class="fact-body">{esc(founded_era)}（{esc(founded)}年）創業。</div>
            </div>
          </div>'''

    # Story section
    story_section = ''
    if desc:
        story_section = f'''
<section class="section" style="background:var(--bg);">
  <div class="sec-inner">
    <div class="story-grid">
      <div class="story-visual">
        <div class="story-visual-inner">
          <div class="bottle">
            <div class="bottle-neck"></div>
            <div class="bottle-lbl">
              <div class="bottle-lbl-txt">{esc(brand or name)}</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <label class="sec-label">STORY</label>
        <h2 class="sec-title">{esc(name)}の物語</h2>
        <div class="sec-divider"></div>
        <p class="sec-body">{esc(desc)}</p>
        {f'<div class="facts" style="margin-top:32px;">{facts_html}</div>' if facts_html else ''}
      </div>
    </div>
  </div>
</section>'''

    # Features section
    features_section = ''
    if features:
        features_section = f'''
<section class="section" style="background:var(--bg);">
  <div class="sec-inner">
    <label class="sec-label">FEATURES</label>
    <h2 class="sec-title">{esc(name)}の特徴</h2>
    <div class="sec-divider"></div>
    <div class="facts">{features_html}
    </div>
  </div>
</section>'''

    # Brands section
    brands_section = ''
    if brands:
        section_label = 'AWAMORI' if spirit_type == 'awamori' else 'SHOCHU'
        brands_section = f'''
<section class="section brands-section">
  <div class="sec-inner">
    <label class="sec-label">{section_label}</label>
    <h2 class="sec-title">代表銘柄</h2>
    <div class="sec-divider"></div>
    <div class="brands-grid">{brands_html}
    </div>
  </div>
</section>'''

    # Visit items
    visit_items = ''
    if address:
        visit_items += f'<div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:20px;">📍</span><div><div style="font-size:14px;font-weight:500;margin-bottom:3px;">所在地</div><div style="font-size:15px;color:var(--text-body);">{esc(address)}</div></div></div>'
    if tel:
        visit_items += f'<div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:20px;">📞</span><div><div style="font-size:14px;font-weight:500;margin-bottom:3px;">電話</div><div style="font-size:15px;color:var(--text-body);">{esc(tel)}</div></div></div>'
    if url:
        visit_items += f'<div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:20px;">🌐</span><div><div style="font-size:14px;font-weight:500;margin-bottom:3px;">ウェブサイト</div><div style="font-size:15px;"><a href="{esc(url)}" style="color:var(--accent);text-decoration:none;">{esc(url)}</a></div></div></div>'
    if visit:
        visit_items += f'<div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:20px;">🏠</span><div><div style="font-size:14px;font-weight:500;margin-bottom:3px;">見学</div><div style="font-size:15px;color:var(--text-body);">{esc(visit)}</div></div></div>'

    # Suggestions for Sakura
    def jsesc(s):
        return s.replace("\\","\\\\").replace("'","\\'").replace("\n","\\n") if s else ''
    sug1 = f'{jsesc(brand or name)}ってどんな焼酎？' if brand else f'{jsesc(name)}について教えて'
    sug2 = '蒸留所見学はできる？'
    sug3 = 'おすすめの飲み方は？'
    sug4 = f'{jsesc(name)}の歴史を教えて'
    js_name = jsesc(name)
    js_brand = jsesc(brand or name)

    # OGP meta tags
    # ── メタ description（SEO最適化）
    brand_str = f'代表銘柄「{brand}」。' if brand else ''
    founded_str = f'{founded_era}（{founded}年）創業。' if founded else ''
    if desc:
        meta_desc = desc[:155] + ('…' if len(desc) > 155 else '')
    else:
        meta_desc = f'{founded_str}{brand_str}{area}の蒸留所。{pref_name}の焼酎・泡盛情報 — Terroir HUB SHOCHU'
    meta_desc = meta_desc[:160]
    og_desc = esc(meta_desc[:80])
    page_url = f"https://{DOMAIN}/shochu/{pref_slug}/{b['id']}.html"

    # JSON-LD: LocalBusiness + BreadcrumbList
    local_biz = {
        "@type": "LocalBusiness",
        "name": name,
        "description": desc[:200] if desc else name,
        "address": {
            "@type": "PostalAddress",
            "addressLocality": area,
            "addressRegion": pref_name,
            "addressCountry": "JP"
        }
    }
    if url:
        local_biz["url"] = url
    if founded:
        local_biz["foundingDate"] = founded
    if tel:
        local_biz["telephone"] = tel

    breadcrumb = {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Terroir HUB SHOCHU", "item": f"https://{DOMAIN}/"},
            {"@type": "ListItem", "position": 2, "name": pref_name, "item": f"https://{DOMAIN}/shochu/{pref_slug}/"},
            {"@type": "ListItem", "position": 3, "name": name}
        ]
    }

    faq_pairs = []
    if brands:
        br0 = brands[0] if isinstance(brands[0], dict) else {'name': brands[0], 'specs': ''}
        faq_pairs.append({"@type": "Question", "name": f"{name}の代表銘柄は？",
            "acceptedAnswer": {"@type": "Answer", "text": f"{name}の代表銘柄は「{br0.get('name', brand)}」です。{br0.get('specs','')}"}})
    if founded:
        faq_pairs.append({"@type": "Question", "name": f"{name}はいつ創業ですか？",
            "acceptedAnswer": {"@type": "Answer", "text": f"{name}は{founded_era or founded+'年'}創業の{pref_name}の蒸留所です。"}})
    if visit:
        faq_pairs.append({"@type": "Question", "name": f"{name}は見学できますか？",
            "acceptedAnswer": {"@type": "Answer", "text": visit}})
    graph = [local_biz, breadcrumb]
    if faq_pairs:
        graph.append({"@type": "FAQPage", "mainEntity": faq_pairs})
    jsonld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)

    # ── 同県の他の施設（内部リンク + 実データ県ファクト）──
    related_html = ''
    if siblings:
        _n = len([x for x in siblings if isinstance(x, dict) and x.get('id')])
        _olds = [(int(x['founded']), x.get('name','')) for x in siblings
                 if isinstance(x, dict) and str(x.get('founded','')).isdigit() and int(str(x.get('founded'))) > 1000]
        _visitable = len([x for x in siblings if isinstance(x, dict) and x.get('visit') and x.get('visit') not in ('—','ー','-')])
        _parts = [f'Terroir HUBには{pref_name}の蒸留所を{_n}件収録しています。']
        if _olds:
            _oy, _on = min(_olds)
            _parts.append(f'最も創業が古いのは{_oy}年創業の{_on}。')
        if _visitable:
            _parts.append(f'{_visitable}件が見学情報を公開しています。')
        _pref_facts = ''.join(_parts)
        _others = [x for x in siblings if isinstance(x, dict) and x.get('id') and x.get('id') != b.get('id') and x.get('name')]
        _others.sort(key=lambda x: x.get('name',''))
        _cards = ''
        for _x in _others[:6]:
            _xa = esc(_x.get('area','') or pref_name)
            _xb = esc(_x.get('brand',''))
            _cards += (f'<a class="related-card" href="/shochu/{pref_slug}/{esc(_x["id"])}.html" '
                       f'style="display:flex;flex-direction:column;gap:5px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px 18px;text-decoration:none;">'
                       f'<span style="font-family:\'Zen Old Mincho\',serif;font-size:15px;color:var(--text);">{esc(_x["name"])}</span>'
                       f'<span style="font-size:11.5px;color:var(--text-muted);">{_xa}{f" ｜ {_xb}" if _xb else ""}</span></a>')
        if _cards:
            related_html = (f'<section class="section" style="background:var(--bg);"><div class="sec-inner">'
                            f'<label class="sec-label">MORE</label>'
                            f'<h2 class="sec-title">{esc(pref_name)}の他の蒸留所</h2><div class="sec-divider"></div>'
                            f'<p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">{esc(_pref_facts)}</p>'
                            f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">{_cards}</div>'
                            f'<div style="margin-top:22px;"><a href="/shochu/{pref_slug}/" style="font-size:13px;color:var(--accent);text-decoration:none;font-weight:500;">{esc(pref_name)}の蒸留所一覧をすべて見る →</a></div>'
                            f'</div></section>')

    # ── サクラ実接続 ──
    _brand_list = [str(x.get('name','')) if isinstance(x, dict) else str(x) for x in brands[:5]]
    _brand_list = [x for x in _brand_list if x]
    _sug = ([f'{brand or name}ってどんな焼酎？'] if brand else [f'{name}について教えて']) + ['おすすめの飲み方は？', '見学はできる？', f'{name}の歴史を教えて']
    sakura_ctx = {
        'lang': 'ja', 'site': 'TERROIR HUB SHOCHU（焼酎のページ）',
        'facility': '蒸留所', 'facility_en': 'distillery',
        'name': name, 'brand': brand, 'pref': pref_name, 'area': area,
        'founded': founded, 'founded_era': founded_era, 'brands': _brand_list,
        'visit': visit if visit not in ('—', 'ー', '-') else '', 'url': url, 'desc': desc,
        'suggestions': _sug,
    }
    sakura_block = ('<script>window.SAKURA_CTX = '
                    + json.dumps(sakura_ctx, ensure_ascii=False).replace('</', '<\\/')
                    + ';</script>\n<script src="/sakura-page.js" defer></script>')

    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>{esc(name)} — {esc(pref_name)}の蒸留所 | Terroir HUB SHOCHU</title>
<meta name="description" content="{esc(meta_desc)}">
<meta property="og:title" content="{esc(name)} — {esc(pref_name)}の蒸留所 | Terroir HUB SHOCHU">
<meta property="og:description" content="{og_desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{page_url}">
<meta property="og:image" content="https://{DOMAIN}/img/hero.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(name)} — Terroir HUB SHOCHU">
<meta name="twitter:description" content="{og_desc}">
<meta name="twitter:image" content="https://{DOMAIN}/img/hero.jpg">
<link rel="canonical" href="https://{DOMAIN}/shochu/{pref_slug}/{b['id']}.html">
    <link rel="alternate" hreflang="ja" href="https://{DOMAIN}/shochu/{pref_slug}/{b['id']}.html">
    <link rel="alternate" hreflang="en" href="https://{DOMAIN}/shochu/en/{pref_slug}/{b['id']}.html">
    <link rel="alternate" hreflang="x-default" href="https://{DOMAIN}/shochu/en/{pref_slug}/{b['id']}.html">
<script type="application/ld+json">
{jsonld}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Noto+Serif+JP:wght@200;300;400&family=Zen+Old+Mincho:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
{CSS}
</style>
</head>
<body>

<nav class="nav">
  <a class="nav-brand" href="/">
    <span class="nav-logo">Terroir HUB</span>
    <span class="nav-logo-sub">SHOCHU</span>
  </a>
  <div class="nav-r">
    <a class="lb active" href="/shochu/{pref_slug}/{b['id']}.html">日本語</a>
    <a class="lb" href="/shochu/en/{pref_slug}/{b['id']}.html">EN</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="hero-badge"><span class="badge-dot"></span>{badge_text}</div>
    {f'<p class="hero-est">EST. {esc(founded)}</p>' if founded else ''}
    <h1 class="hero-title">{esc(name)}</h1>
    {f'<p class="hero-subtitle">{esc(brand)}</p>' if brand else ''}
    {f'<p class="hero-en" style="font-style:italic;">Since {esc(founded)} — {esc(area)}, {esc(pref_name)}</p>' if founded and area else ''}
    {f'<p class="hero-tagline">{esc(desc)}</p>' if desc else ''}
    <div class="hero-actions">
      <button class="btn-p" onclick="openPanel()">サクラに聞く</button>
      {'<button class="btn-s" onclick="location.href=' + "'" + esc(url) + "'" + '">公式サイト</button>' if url else ''}
    </div>
  </div>
</section>

{story_section}

{features_section}

{brands_section}

{related_html}
<section class="section">
  <div class="sec-inner">
    <label class="sec-label">INFORMATION</label>
    <h2 class="sec-title">基本情報</h2>
    <div class="sec-divider"></div>
    <div class="story-grid" style="gap:32px;">
      <div style="display:flex;flex-direction:column;gap:22px;">
        {visit_items}
      </div>
      <div style="background:var(--surface-warm);border:1px solid var(--border);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:240px;gap:8px;">
        <span style="font-size:28px;">📍</span>
        <div style="font-family:'Zen Old Mincho',serif;font-size:16px;color:var(--text);">{esc(name)}</div>
        <div style="font-size:13px;color:var(--text-muted);">{esc(pref_name)}{esc(area)}</div>
      </div>
    </div>
    {f'<p style="font-size:13px;color:var(--text-muted);margin-top:16px;">{esc(station)}</p>' if station else ''}
    {f'<p style="font-size:11px;color:var(--text-muted);margin-top:12px;">出典：<a href="{esc(source)}" style="color:var(--accent);text-decoration:none;">{esc(source)}</a></p>' if source else ''}
  </div>
</section>

<!-- TRACKING -->
<script src="/shochu/track.js" defer></script>
<div id="reviews-section" data-producer-id="{b['id']}" data-category="shochu"></div>
<script src="/shochu/reviews.js" defer></script>

<footer style="background:#1A1814;padding:40px 24px;text-align:center;">
  <p style="font-family:'Zen Old Mincho',serif;font-size:14px;color:rgba(255,255,255,0.5);letter-spacing:0.08em;margin-bottom:8px;">Terroir HUB</p>
  <p style="font-size:11px;color:rgba(255,255,255,0.2);">{DOMAIN}</p>
</footer>

<!-- FAB -->
<button class="fab" onclick="openPanel()" id="fab">
  <span class="fab-pulse"></span>
  <span>🌸</span>
  <span id="fab-txt">サクラに聞く</span>
</button>

<!-- SAKURA PANEL -->
<div class="overlay" id="overlay" onclick="if(event.target===this)closePanel()">
  <div class="panel">
    <div class="p-handle"></div>
    <div class="p-hdr">
      <div class="p-hdr-l">
        <div class="p-av">桜</div>
        <div>
          <div class="p-title">サクラ — AIコンシェルジュ</div>
          <div class="p-status"><div class="p-dot"></div><span>オンライン</span></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        <button class="p-close" onclick="closePanel()">✕</button>
      </div>
    </div>
    <div class="chat" id="chat"></div>
    <div class="sugs" id="sugs"></div>
    <div class="inp-row">
      <textarea id="chat-inp" rows="1" placeholder="{esc(name)}について何でもどうぞ…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){{event.preventDefault();sendMsg();}}"></textarea>
      <button id="chat-send" onclick="sendMsg()">↑</button>
    </div>
  </div>
</div>

{sakura_block}
</body>
</html>'''

# Main
json_files = sorted(glob.glob(os.path.join(BASE, 'data', 'data_*_distilleries.json')))
total = 0
errors = 0

for jf in json_files:
    pref = os.path.basename(jf).replace('data_', '').replace('_distilleries.json', '')
    with open(jf, 'r', encoding='utf-8') as f:
        distilleries = json.load(f)

    out_dir = os.path.join(BASE, 'shochu', pref)
    os.makedirs(out_dir, exist_ok=True)

    for b in distilleries:
        if not b.get('id'):
            continue
        try:
            html = generate_page(b, pref, siblings=distilleries)
            with open(os.path.join(out_dir, f"{b['id']}.html"), 'w', encoding='utf-8') as f:
                f.write(html)
            total += 1
        except Exception as e:
            print(f"  ERROR: {pref}/{b.get('id','?')} — {e}")
            errors += 1

    print(f"  {pref}: {len(distilleries)} pages")

print(f"\nDone: {total} pages generated, {errors} errors")
