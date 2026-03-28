#!/usr/bin/env python3
"""
英語・フランス語版の蒸留所ページを一括生成。
UIラベルのみ翻訳。説明文（desc）は日本語のまま。
"""

import json
import glob
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# テンプレートからCSS取得
with open(os.path.join(BASE, 'template_shochu.html'), 'r') as f:
    tmpl = f.read()
CSS = tmpl[tmpl.find('<style>') + 7:tmpl.find('</style>')]

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

PREF_EN = {
    'hokkaido':'Hokkaido','aomori':'Aomori','iwate':'Iwate','miyagi':'Miyagi','akita':'Akita',
    'yamagata':'Yamagata','fukushima':'Fukushima','ibaraki':'Ibaraki','tochigi':'Tochigi','gunma':'Gunma',
    'saitama':'Saitama','chiba':'Chiba','tokyo':'Tokyo','kanagawa':'Kanagawa','niigata':'Niigata',
    'toyama':'Toyama','ishikawa':'Ishikawa','fukui':'Fukui','yamanashi':'Yamanashi','nagano':'Nagano',
    'gifu':'Gifu','shizuoka':'Shizuoka','aichi':'Aichi','mie':'Mie','shiga':'Shiga',
    'kyoto':'Kyoto','osaka':'Osaka','hyogo':'Hyogo','nara':'Nara','wakayama':'Wakayama',
    'tottori':'Tottori','shimane':'Shimane','okayama':'Okayama','hiroshima':'Hiroshima','yamaguchi':'Yamaguchi',
    'tokushima':'Tokushima','kagawa':'Kagawa','ehime':'Ehime','kochi':'Kochi','fukuoka':'Fukuoka',
    'saga':'Saga','nagasaki':'Nagasaki','kumamoto':'Kumamoto','oita':'Oita','miyazaki':'Miyazaki',
    'kagoshima':'Kagoshima','okinawa':'Okinawa'
}

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

# UI translations
UI = {
    'en': {
        'html_lang': 'en',
        'title_suffix': 'Terroir HUB SHOCHU',
        'meta_desc': 'Official information about {name} distillery in {pref}, Japan. Explore their signature spirits, distillery features, and visit information.',
        'badge_shochu': 'TERROIR HUB SHOCHU',
        'badge_awamori': 'TERROIR HUB AWAMORI',
        'story_label': 'STORY',
        'story_title': 'The Story of {name}',
        'features_label': 'FEATURES',
        'features_title': 'Characteristics of {name}',
        'feature_prefix': 'Feature',
        'brands_label_shochu': 'SHOCHU',
        'brands_label_awamori': 'AWAMORI',
        'brands_title': 'Signature Spirits',
        'info_label': 'INFORMATION',
        'info_title': 'Information',
        'location': 'Location',
        'phone': 'Phone',
        'website': 'Website',
        'visit': 'Tours',
        'years_history': 'Years of History',
        'founded_text': 'Founded in {year}.',
        'ask_sakura': 'Ask Sakura',
        'official_site': 'Official Website',
        'sakura_title': 'Sakura — AI Concierge',
        'sakura_online': 'Online',
        'sakura_placeholder': 'Ask anything about this distillery',
        'sakura_greet': 'Welcome to {name}.\\n\\nFeel free to ask anything about this distillery.',
        'sug1': 'What is {brand} like?',
        'sug2': 'Can I visit the distillery?',
        'sug3': 'How should I drink this?',
        'sug4': 'Tell me about the history',
        'sakura_demo': 'Thank you for your question.\\n\\n* Sakura AI will provide real answers once connected to the API.',
        'source': 'Source',
        'photo': 'PHOTO',
    },
    'fr': {
        'html_lang': 'fr',
        'title_suffix': 'Terroir HUB SHOCHU',
        'meta_desc': 'Informations officielles sur la distillerie {name} a {pref}, Japon. Decouvrez leurs spiritueux signatures, caracteristiques et informations de visite.',
        'badge_shochu': 'TERROIR HUB SHOCHU',
        'badge_awamori': 'TERROIR HUB AWAMORI',
        'story_label': 'HISTOIRE',
        'story_title': "L'histoire de {name}",
        'features_label': 'CARACTERISTIQUES',
        'features_title': 'Les caracteristiques de {name}',
        'feature_prefix': 'Caracteristique',
        'brands_label_shochu': 'SHOCHU',
        'brands_label_awamori': 'AWAMORI',
        'brands_title': 'Spiritueux Signature',
        'info_label': 'INFORMATIONS',
        'info_title': 'Informations',
        'location': 'Adresse',
        'phone': 'Telephone',
        'website': 'Site web',
        'visit': 'Visite',
        'years_history': "Ans d'histoire",
        'founded_text': 'Fondee en {year}.',
        'ask_sakura': 'Demander a Sakura',
        'official_site': 'Site officiel',
        'sakura_title': 'Sakura — Concierge IA',
        'sakura_online': 'En ligne',
        'sakura_placeholder': 'Posez vos questions sur cette distillerie',
        'sakura_greet': "Bienvenue chez {name}.\\n\\nN'hesitez pas a me poser vos questions sur cette distillerie.",
        'sug1': 'Comment est le {brand} ?',
        'sug2': 'Peut-on visiter la distillerie ?',
        'sug3': 'Comment le deguster ?',
        'sug4': "Quelle est l'histoire ?",
        'sakura_demo': "Merci pour votre question.\\n\\n* Sakura IA fournira de vraies reponses une fois connectee a l'API.",
        'source': 'Source',
        'photo': 'PHOTO',
    },
    'zh': {
        'html_lang': 'zh-CN',
        'title_suffix': 'Terroir HUB 烧酎',
        'meta_desc': '关于日本{pref}{name}蒸馏所的官方信息。探索其代表品牌、蒸馏所特色和参观信息。',
        'badge_shochu': 'TERROIR HUB 烧酎',
        'badge_awamori': 'TERROIR HUB 泡盛',
        'story_label': '故事',
        'story_title': '{name}的故事',
        'features_label': '特色',
        'features_title': '{name}的特色',
        'feature_prefix': '特色',
        'brands_label_shochu': '烧酎',
        'brands_label_awamori': '泡盛',
        'brands_title': '代表品牌',
        'info_label': '基本信息',
        'info_title': '基本信息',
        'location': '地址',
        'phone': '电话',
        'website': '官方网站',
        'visit': '参观',
        'years_history': '年历史',
        'founded_text': '创立于{year}年。',
        'ask_sakura': '问樱花',
        'official_site': '官方网站',
        'sakura_title': '樱花 — AI礼宾',
        'sakura_online': '在线',
        'sakura_placeholder': '关于这家蒸馏所的任何问题...',
        'sakura_greet': '欢迎来到{name}。\\n\\n请随时向我提问关于这家蒸馏所的任何问题。',
        'sug1': '这款酒怎么样？',
        'sug2': '可以参观吗？',
        'sug3': '推荐的喝法？',
        'sug4': '历史是什么？',
        'sakura_demo': '感谢您的提问。\\n\\n※ 樱花AI连接API后将提供真实回答。',
        'source': '来源',
        'photo': '照片',
    }
}


def esc(s):
    if not s:
        return ''
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def jsesc(s):
    if not s:
        return ''
    return str(s).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def generate_lang_page(b, pref_slug, lang):
    t = UI[lang]
    pref_name = PREF_NAMES.get(pref_slug, pref_slug)
    pref_en = PREF_EN.get(pref_slug, pref_slug)
    name = b.get('name', '')
    name_en = b.get('name_en', '')
    brand = b.get('brand', '')
    founded = str(b.get('founded', '')) if b.get('founded') else ''
    founded_era = b.get('founded_era', '')
    desc = b.get('desc', '')
    address = b.get('address', '')
    tel = b.get('tel', '')
    url = b.get('url', '')
    area = b.get('area', '')
    visit = b.get('visit', '')
    station = b.get('nearest_station', '')
    source = b.get('source', '')
    features = b.get('features', [])
    brands = b.get('brands', [])
    spirit_type = b.get('spirit_type', '')
    koji_type = b.get('koji_type', '')
    main_ingredient = b.get('main_ingredient', '')
    bid = b.get('id', '')

    # Badge and section label
    is_awamori = spirit_type == 'awamori'
    badge_text = t['badge_awamori'] if is_awamori else t['badge_shochu']
    brands_label = t['brands_label_awamori'] if is_awamori else t['brands_label_shochu']

    # Title: use name_en if available for en, otherwise name
    display_name = name_en if (name_en and lang == 'en') else name
    page_title = f"{esc(display_name)} — {t['title_suffix']}"

    years = ''
    if founded and founded.isdigit():
        years = str(2026 - int(founded))

    meta_desc = t['meta_desc'].format(name=display_name, pref=pref_en)

    # hreflang tags
    hreflang = f'''    <link rel="alternate" hreflang="ja" href="https://{DOMAIN}/shochu/{pref_slug}/{bid}.html">
    <link rel="alternate" hreflang="en" href="https://{DOMAIN}/shochu/en/{pref_slug}/{bid}.html">
    <link rel="alternate" hreflang="fr" href="https://{DOMAIN}/shochu/fr/{pref_slug}/{bid}.html">
    <link rel="alternate" hreflang="zh-Hans" href="https://{DOMAIN}/shochu/zh/{pref_slug}/{bid}.html">
    <link rel="alternate" hreflang="x-default" href="https://{DOMAIN}/shochu/en/{pref_slug}/{bid}.html">'''

    # Brands HTML
    brands_html = ''
    for br in brands[:3]:
        if isinstance(br, str):
            br = {'name': br, 'specs': ''}
        if not isinstance(br, dict):
            continue
        br_name = str(br.get('name', ''))
        br_specs = str(br.get('specs', ''))
        br_type = br.get('type', '')
        br_ingredient = br.get('ingredient', '')
        specs_short = br_specs.split('\u3001')[0] if br_specs else ''

        koji_badge_html = ''
        if koji_type:
            koji_class = 'kuro' if '\u9ed2' in koji_type else ('shiro' if '\u767d' in koji_type else 'ki')
            koji_badge_html = f'<div class="koji-badge {koji_class}">{esc(koji_type)}</div>'

        brands_html += f'''
    <div class="brand-card">
      <div class="brand-img-wrap">
        <div class="brand-img-placeholder">{t['photo']}</div>
      </div>
      {koji_badge_html}
      {f'<div class="ingredient-tag">{esc(br_ingredient)}</div>' if br_ingredient else ''}
      <h3 class="brand-name">{esc(br_name)}</h3>
      <p class="brand-type">{esc(br_type or specs_short)}</p>
      {f'<p class="brand-desc">{esc(br_specs)}</p>' if br_specs else ''}
    </div>'''

    # Features HTML
    nums = ['\u2460', '\u2461', '\u2462']
    features_html = ''
    for i, feat in enumerate(features[:3]):
        feat_text = feat if isinstance(feat, str) else str(feat)
        features_html += f'''
      <div class="fact">
        <div class="fact-num" style="font-family:'Zen Old Mincho',serif;font-size:42px;opacity:0.7;">{nums[i] if i < 3 else str(i+1)}</div>
        <div>
          <div class="fact-lbl">{t['feature_prefix']} {i+1}</div>
          <div class="fact-body">{esc(feat_text)}</div>
        </div>
      </div>'''

    # Facts (years of history)
    facts_html = ''
    if years:
        facts_html = f'''
          <div class="fact">
            <div class="fact-num">{years}</div>
            <div>
              <div class="fact-lbl">{t['years_history']}</div>
              <div class="fact-body">{t['founded_text'].format(year=founded)}</div>
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
        <label class="sec-label">{t['story_label']}</label>
        <h2 class="sec-title">{t['story_title'].format(name=esc(name))}</h2>
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
    <label class="sec-label">{t['features_label']}</label>
    <h2 class="sec-title">{t['features_title'].format(name=esc(name))}</h2>
    <div class="sec-divider"></div>
    <div class="facts">{features_html}
    </div>
  </div>
</section>'''

    # Brands section
    brands_section = ''
    if brands:
        brands_section = f'''
<section class="section brands-section">
  <div class="sec-inner">
    <label class="sec-label">{brands_label}</label>
    <h2 class="sec-title">{t['brands_title']}</h2>
    <div class="sec-divider"></div>
    <div class="brands-grid">{brands_html}
    </div>
  </div>
</section>'''

    # Visit / info items
    visit_items = ''
    if address:
        visit_items += f'<div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:20px;">\U0001f4cd</span><div><div style="font-size:14px;font-weight:500;margin-bottom:3px;">{t["location"]}</div><div style="font-size:15px;color:var(--text-body);">{esc(address)}</div></div></div>'
    if tel:
        visit_items += f'<div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:20px;">\U0001f4de</span><div><div style="font-size:14px;font-weight:500;margin-bottom:3px;">{t["phone"]}</div><div style="font-size:15px;color:var(--text-body);">{esc(tel)}</div></div></div>'
    if url:
        visit_items += f'<div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:20px;">\U0001f310</span><div><div style="font-size:14px;font-weight:500;margin-bottom:3px;">{t["website"]}</div><div style="font-size:15px;"><a href="{esc(url)}" style="color:var(--accent);text-decoration:none;">{esc(url)}</a></div></div></div>'
    if visit:
        visit_items += f'<div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:20px;">\U0001f3e0</span><div><div style="font-size:14px;font-weight:500;margin-bottom:3px;">{t["visit"]}</div><div style="font-size:15px;color:var(--text-body);">{esc(visit)}</div></div></div>'

    # Sakura suggestions
    sug1 = t['sug1'].format(brand=jsesc(brand or name))
    sug2 = t['sug2']
    sug3 = t['sug3']
    sug4 = t['sug4']
    sakura_greet = t['sakura_greet'].format(name=jsesc(name))
    sakura_demo = t['sakura_demo']
    js_name = jsesc(name)
    js_brand = jsesc(brand or name)

    # OGP
    og_desc = esc(desc[:120]) if desc else esc(name)
    page_url = f"https://{DOMAIN}/shochu/{lang}/{pref_slug}/{bid}.html"

    return f'''<!DOCTYPE html>
<html lang="{t['html_lang']}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>{page_title}</title>
<meta name="description" content="{esc(meta_desc)}">
<meta property="og:title" content="{page_title}">
<meta property="og:description" content="{og_desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{page_url}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{page_title}">
<meta name="twitter:description" content="{og_desc}">
<link rel="canonical" href="{page_url}">
{hreflang}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Noto+Serif+JP:wght@200;300;400&family=Zen+Old+Mincho:wght@400;700&family=DM+Sans:wght@300;400;500&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
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
    <a class="lb" href="/shochu/{pref_slug}/{bid}.html">\u65e5\u672c\u8a9e</a>
    <a class="lb{' active' if lang == 'en' else ''}" href="/shochu/en/{pref_slug}/{bid}.html">EN</a>
    <a class="lb{' active' if lang == 'fr' else ''}" href="/shochu/fr/{pref_slug}/{bid}.html">FR</a>
    <a class="lb{' active' if lang == 'zh' else ''}" href="/shochu/zh/{pref_slug}/{bid}.html">ZH</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="hero-badge"><span class="badge-dot"></span>{badge_text}</div>
    {f'<p class="hero-est">EST. {esc(founded)}</p>' if founded else ''}
    <h1 class="hero-title">{esc(name)}</h1>
    {f'<p class="hero-subtitle">{esc(brand)}</p>' if brand else ''}
    {f'<p class="hero-en" style="font-style:italic;">Since {esc(founded)} — {esc(area)}, {pref_en}</p>' if founded and area else ''}
    {f'<p class="hero-tagline">{esc(desc)}</p>' if desc else ''}
    <div class="hero-actions">
      <button class="btn-p" onclick="openPanel()">{t['ask_sakura']}</button>
      {'<button class="btn-s" onclick="location.href=' + "'" + esc(url) + "'" + '">' + t['official_site'] + '</button>' if url else ''}
    </div>
  </div>
</section>

{story_section}

{features_section}

{brands_section}

<section class="section">
  <div class="sec-inner">
    <label class="sec-label">{t['info_label']}</label>
    <h2 class="sec-title">{t['info_title']}</h2>
    <div class="sec-divider"></div>
    <div class="story-grid" style="gap:32px;">
      <div style="display:flex;flex-direction:column;gap:22px;">
        {visit_items}
      </div>
      <div style="background:var(--surface-warm);border:1px solid var(--border);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:240px;gap:8px;">
        <span style="font-size:28px;">\U0001f4cd</span>
        <div style="font-family:'Zen Old Mincho',serif;font-size:16px;color:var(--text);">{esc(name)}</div>
        <div style="font-size:13px;color:var(--text-muted);">{pref_en}, Japan</div>
      </div>
    </div>
    {f'<p style="font-size:13px;color:var(--text-muted);margin-top:16px;">{esc(station)}</p>' if station else ''}
    {f'<p style="font-size:11px;color:var(--text-muted);margin-top:12px;">{t["source"]}: <a href="{esc(source)}" style="color:var(--accent);text-decoration:none;">{esc(source)}</a></p>' if source else ''}
  </div>
</section>

<script src="/shochu/track.js" defer></script>

<footer style="background:#1A1814;padding:40px 24px;text-align:center;">
  <p style="font-family:'Zen Old Mincho',serif;font-size:14px;color:rgba(255,255,255,0.5);letter-spacing:0.08em;margin-bottom:8px;">Terroir HUB</p>
  <p style="font-size:11px;color:rgba(255,255,255,0.2);">{DOMAIN}</p>
</footer>

<button class="fab" onclick="openPanel()" id="fab">
  <span class="fab-pulse"></span>
  <span>\U0001f338</span>
  <span id="fab-txt">{t['ask_sakura']}</span>
</button>

<div class="overlay" id="overlay" onclick="if(event.target===this)closePanel()">
  <div class="panel">
    <div class="p-handle"></div>
    <div class="p-hdr">
      <div class="p-hdr-l">
        <div class="p-av">\u685c</div>
        <div>
          <div class="p-title">{t['sakura_title']}</div>
          <div class="p-status"><div class="p-dot"></div><span>{t['sakura_online']}</span></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:7px;">
        <button class="p-close" onclick="closePanel()">\u2715</button>
      </div>
    </div>
    <div class="chat" id="chat"></div>
    <div class="sugs" id="sugs"></div>
    <div class="inp-row">
      <textarea id="chat-inp" rows="1" placeholder="{t['sakura_placeholder']}" onkeydown="if(event.key==='Enter'&&!event.shiftKey){{event.preventDefault();sendMsg();}}"></textarea>
      <button id="chat-send" onclick="sendMsg()">\u2191</button>
    </div>
  </div>
</div>

<script>
function openPanel(){{document.getElementById('overlay').classList.add('open');document.getElementById('fab').style.display='none';if(!ci)initChat();}}
function closePanel(){{document.getElementById('overlay').classList.remove('open');document.getElementById('fab').style.display='flex';}}
let ci=false;
const BN='{js_name}',BB='{js_brand}';
const SUGS=['{jsesc(sug1)}','{jsesc(sug2)}','{jsesc(sug3)}','{jsesc(sug4)}'];
function initChat(){{ci=true;document.getElementById('chat').innerHTML='';addMsg('butler','{sakura_greet}');renderSugs();}}
function addMsg(r,t){{const c=document.getElementById('chat'),d=document.createElement('div');d.className='msg '+r;d.innerHTML='<div class="av">'+(r==='butler'?'\u685c':'\U0001f464')+'</div><div class="bubble">'+t.replace(/\\n/g,'<br>')+'</div>';c.appendChild(d);c.scrollTop=c.scrollHeight;}}
function renderSugs(){{document.getElementById('sugs').innerHTML=SUGS.map(s=>'<button class="sug" onclick="askSug(this.textContent)">'+s+'</button>').join('');}}
function askSug(q){{document.getElementById('sugs').innerHTML='';addMsg('user',q);showT();setTimeout(()=>{{removeT();addMsg('butler','{sakura_demo}');renderSugs();}},1200);}}
function sendMsg(){{const i=document.getElementById('chat-inp'),q=i.value.trim();if(!q)return;i.value='';document.getElementById('sugs').innerHTML='';addMsg('user',q);showT();setTimeout(()=>{{removeT();addMsg('butler','{sakura_demo}');renderSugs();}},1500);}}
function showT(){{const c=document.getElementById('chat'),d=document.createElement('div');d.className='msg butler';d.id='tp';d.innerHTML='<div class="av">\u685c</div><div class="bubble"><div class="typing"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>';c.appendChild(d);c.scrollTop=c.scrollHeight;}}
function removeT(){{const e=document.getElementById('tp');if(e)e.remove();}}
</script>
</body>
</html>'''


# Main
json_files = sorted(glob.glob(os.path.join(BASE, 'data', 'data_*_distilleries.json')))
grand_total = 0

for lang in ['en', 'fr', 'zh']:
    total = 0
    errors = 0
    for jf in json_files:
        pref = os.path.basename(jf).replace('data_', '').replace('_distilleries.json', '')
        with open(jf, 'r', encoding='utf-8') as f:
            distilleries = json.load(f)

        out_dir = os.path.join(BASE, 'shochu', lang, pref)
        os.makedirs(out_dir, exist_ok=True)

        for b in distilleries:
            if not b.get('id'):
                continue
            try:
                html = generate_lang_page(b, pref, lang)
                with open(os.path.join(out_dir, f"{b['id']}.html"), 'w', encoding='utf-8') as f:
                    f.write(html)
                total += 1
            except Exception as e:
                print(f"  ERROR [{lang}]: {pref}/{b.get('id', '?')} — {e}")
                errors += 1

    print(f"{lang.upper()}: {total} pages generated ({errors} errors)")
    grand_total += total

print(f"\nDone! Total: {grand_total} pages generated (EN + FR + ZH)")
