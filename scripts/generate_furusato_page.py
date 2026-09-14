#!/usr/bin/env python3
"""
ふるさと納税ページ生成（SEO重視の3層構造）。
  1) ハブ: wine/furusato/index.html （全国・ライブ検索/県フィルタ）
  2) 県別: wine/furusato/{pref}.html （「山梨 焼酎 ふるさと納税」等を県ごとに獲る）
既存 rakuten_items.json から【ふるさと納税】返礼品を抽出。各ページに JSON-LD(CollectionPage/
ItemList/FAQPage/BreadcrumbList)・meta/OG。県別ページ一覧は wine/furusato/_prefs.json に出力し、
蔵ページ(regenerate_all_pages.py)からの内部リンクに使う。
"""
import json, glob, os, sys, html, re, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shochu_filter import is_shochu_item

TODAY = datetime.date.today().isoformat()

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = "shochu.terroirhub.com"
OUTDIR = os.path.join(BASE, "shochu", "furusato")

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
    'kagoshima':'鹿児島県','okinawa':'沖縄県',
}
PREF_ORDER = list(PREF_NAMES.keys())

# 表示順: 焼酎の主要産地を上位に。残りは返礼品数の多い順。
GENRE_PRIORITY = ['kagoshima', 'miyazaki', 'kumamoto', 'oita', 'okinawa', 'fukuoka']


def sort_prefs(by_pref):
    def key(p):
        pr = GENRE_PRIORITY.index(p) if p in GENRE_PRIORITY else len(GENRE_PRIORITY)
        return (pr, -len(by_pref[p]), PREF_ORDER.index(p))
    return sorted(by_pref.keys(), key=key)

# 県別リード文はデータから自動生成（捏造を避けるため固有断定文は置かない）
PREF_LEAD = {}


def esc(s):
    return html.escape(str(s or ""), quote=True)


def load_wineries():
    m = {}
    for jf in glob.glob(os.path.join(BASE, "data/data_*_distilleries.json")):
        pref = os.path.basename(jf).replace("data_", "").replace("_distilleries.json", "")
        for b in json.load(open(jf, encoding="utf-8")):
            if b.get("id"):
                m[b["id"]] = {"name": b.get("name", ""), "pref": pref, "id": b["id"]}
    return m


def collect():
    rk = json.load(open(os.path.join(BASE, "shochu", "rakuten_items.json"), encoding="utf-8"))
    wineries = load_wineries()
    by_pref, seen = {}, set()
    for wid, g in rk.items():
        w = wineries.get(wid)
        if not w:
            continue
        for it in g.get("items", []):
            nm = it.get("name", "")
            if not it.get("image") or "ふるさと納税" not in nm or not is_shochu_item(nm):
                continue
            key = it.get("url") or nm
            if key in seen:
                continue
            seen.add(key)
            by_pref.setdefault(w["pref"], []).append({**it, "winery": w["name"], "winery_id": wid, "pref": w["pref"]})
    return by_pref


def clean_name(nm):
    s = re.sub(r'^[【\[]?\s*ふるさと納税\s*[】\]]?\s*', '', nm)
    s = re.sub(r'\s*(御祝|御礼|母の日|父の日|敬老の日|御中元|御歳暮|御年賀|内祝|出産内祝|誕生日祝|結婚祝|退職祝|卒業祝|還暦祝|古希祝|傘寿祝|喜寿祝|米寿祝|開店祝|感謝|贈り物|プレゼント|ギフト|人気|寿|壽|御供|仏事).*$', '', s)
    s = re.sub(r'\s*【[A-Za-z0-9\-]+】\s*$', '', s)   # 末尾の管理番号【B2-628】等を除去
    s = re.sub(r'\s*\[[A-Za-z0-9\-]+\]\s*$', '', s)
    return s.strip() or nm


BUDGET_BANDS = [
    ('u10', '1万円以下', 0, 10000),
    ('10-20', '1万〜2万円', 10000, 20000),
    ('20-30', '2万〜3万円', 20000, 30000),
    ('o30', '3万円以上', 30000, 10 ** 9),
]


def band_of(price):
    """寄付金額の帯。金額が取れていない返礼品は帯なし（絞り込みの対象外にする）。"""
    if not price:
        return ''
    for key, _label, lo, hi in BUDGET_BANDS:
        if lo < price <= hi or (lo == 0 and price <= hi):
            return key
    return ''


def card_html(it):
    nm = clean_name(it["name"])
    kw = esc((nm + " " + it["winery"]).lower())
    price = it.get('price')
    band = band_of(price)
    # 金額はデータにある場合のみ表示する（推測で出さない）
    price_html = (f'<div class="fcard-price">寄付 <b>{price:,}</b>円</div>' if price else '')
    return f'''
        <article class="fcard" data-kw="{kw}" data-price="{price or 0}" data-band="{band}">
          <a class="fcard-imgwrap" href="{esc(it['url'])}" target="_blank" rel="nofollow sponsored noopener">
            <img class="fcard-img" src="{esc(it['image'])}" alt="{esc(nm)}" loading="lazy">
            <span class="fcard-badge">ふるさと納税</span>
          </a>
          <div class="fcard-body">
            <a class="fcard-winery" href="/shochu/{esc(it.get('pref',''))}/{esc(it.get('winery_id','').split(':')[-1])}.html">{esc(it['winery'])} ›</a>
            <h3 class="fcard-name" title="{esc(it['name'])}">{esc(nm)}</h3>
            {price_html}
            <a class="fcard-btn" href="{esc(it['url'])}" target="_blank" rel="nofollow sponsored noopener" onclick="if(window.gtag)gtag('event','furusato_click',{{genre:'shochu'}});">楽天ふるさと納税で寄付 →</a>
          </div>
        </article>'''


FAQ_COMMON = [
    ("ふるさと納税で焼酎を選ぶメリットは？",
     "実質自己負担2,000円で、寄付額に応じた返礼品として焼酎を受け取れます。さらに地域の小規模蔵を直接応援できるのが魅力です。控除上限額は年収・家族構成で変わるため、各ふるさと納税サイトのシミュレーターで確認してから寄付しましょう。"),
    ("掲載の焼酎はどこで寄付できますか？",
     "各返礼品の「楽天ふるさと納税で見る」ボタンから、楽天ふるさと納税の該当ページに移動して寄付できます。楽天ポイントを貯めている方は楽天経由が便利です。"),
    ("控除を受けるには何が必要ですか？",
     "確定申告、またはワンストップ特例制度の申請が必要です。ワンストップ特例は、確定申告が不要な給与所得者で寄付先が年間5自治体以内の場合に利用でき、寄付ごとに申請書を提出します。"),
    ("返礼品の内容や寄付額は変わりますか？",
     "返礼品・寄付額・在庫・取扱自治体は時期により変動します。本ページは楽天ふるさと納税の情報をもとにしており、最新の内容は各返礼品ページでご確認ください。"),
]

CSS = """
*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;overflow-x:hidden;}
body{background:#fdf9f6;color:#222;font-family:'Noto Sans JP',sans-serif;font-size:16px;line-height:1.8;-webkit-font-smoothing:antialiased;}
a{color:inherit;}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);border-bottom:1px solid rgba(0,0,0,0.06);}
.nav-top{display:flex;align-items:center;height:54px;padding:0 28px;max-width:1280px;margin:0 auto;}
.nav-logo{font-family:'Shippori Mincho',serif;font-size:18px;font-weight:700;color:#1a1a1a;text-decoration:none;letter-spacing:0.04em;}
.nav-back{font-size:13px;color:#B8452A;text-decoration:none;margin-left:auto;padding:6px 16px;border:1px solid rgba(114,47,55,0.3);border-radius:20px;transition:all 0.2s;}
.nav-back:hover{background:#B8452A;color:#fff;}
.crumb{max-width:1180px;margin:0 auto;padding:10px 24px 0;font-size:12px;color:#9a8a8d;}
.crumb a{color:#9a8a8d;text-decoration:none;}.crumb a:hover{color:#B8452A;}
.hero{margin-top:54px;position:relative;background:linear-gradient(135deg,#5a1e10 0%,#B8452A 55%,#c4623f 100%);color:#fff;padding:60px 28px 52px;overflow:hidden;}
.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 20%,rgba(255,255,255,0.12),transparent 45%);}
.hero-inner{max-width:960px;margin:0 auto;position:relative;z-index:1;}
.hero-tag{display:inline-block;font-size:12px;letter-spacing:0.16em;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.32);border-radius:20px;padding:5px 16px;margin-bottom:16px;}
.hero h1{font-family:'Shippori Mincho',serif;font-size:clamp(26px,5vw,44px);font-weight:700;letter-spacing:0.03em;line-height:1.4;margin-bottom:16px;}
.hero p{font-size:clamp(15px,2vw,17px);line-height:2;opacity:0.94;max-width:700px;}
.stats{display:flex;gap:14px;margin-top:28px;flex-wrap:wrap;}
.stat{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.22);border-radius:12px;padding:13px 22px;min-width:108px;}
.stat-n{font-family:'Shippori Mincho',serif;font-size:28px;font-weight:700;line-height:1;}
.stat-l{font-size:12px;opacity:0.85;margin-top:6px;letter-spacing:0.06em;}
.steps{max-width:960px;margin:0 auto;padding:40px 28px 4px;}
.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.step{background:#fff;border:1px solid #f0e0d8;border-radius:14px;padding:22px 20px;}
.step-n{font-family:'Shippori Mincho',serif;font-size:13px;color:#fff;background:#B8452A;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:11px;}
.step h3{font-size:15px;color:#3a1208;margin-bottom:6px;}
.step p{font-size:13.5px;color:#666;line-height:1.75;}
.simbar{max-width:1180px;margin:18px auto 0;padding:0 24px;}
.simcard{background:linear-gradient(135deg,#fff,#fbf3f3);border:1px solid #f0dede;border-radius:14px;padding:20px 24px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;}
.simcard p{font-size:14px;color:#5a4a4d;flex:1;min-width:240px;}
.simcard a{background:#B8452A;color:#fff;text-decoration:none;font-size:13.5px;font-weight:600;padding:11px 22px;border-radius:24px;white-space:nowrap;}
.simcard a:hover{background:#7a2a18;}
.fcard-price{font-family:'Shippori Mincho',serif;font-size:13.5px;color:#7a2a18;margin:6px 0 2px;}
.fcard-price b{font-size:17px;font-weight:700;letter-spacing:.01em;}
.deadline{max-width:960px;margin:22px auto 0;padding:0 28px;}
.deadline.urgent .deadline-in{background:#fff2ec;border-color:#e8b9a4;box-shadow:0 6px 20px -8px rgba(184,69,42,.28);}
.deadline-in{background:#fff8f4;border:1px solid #f0d8cc;border-left:4px solid #B8452A;border-radius:10px;padding:16px 20px;}
.deadline-t{font-family:'Shippori Mincho',serif;font-size:15.5px;color:#3a1208;font-weight:600;margin-bottom:7px;}
.deadline-t em{font-style:normal;color:#B8452A;font-size:18px;}
.deadline-in ul{margin:0;padding-left:1.15em;}
.deadline-in li{font-size:13px;color:#5a4a4d;line-height:1.95;}
.budget-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;}
.budgetsec{max-width:960px;margin:34px auto 0;padding:0 28px;}
.budgetsec h2{font-family:'Shippori Mincho',serif;font-size:20px;color:#3a1208;margin-bottom:6px;}
.budgetsec .bs-lead{font-size:13.5px;color:#6b5b55;line-height:1.9;margin-bottom:16px;}
.bs-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.bs-card{display:block;background:#fff;border:1px solid #f0e0d8;border-radius:12px;padding:18px 16px;text-decoration:none;transition:border-color .2s,box-shadow .2s;}
.bs-card:hover{border-color:#B8452A;box-shadow:0 8px 22px -12px rgba(184,69,42,.3);}
.bs-band{font-family:'Shippori Mincho',serif;font-size:16px;color:#3a1208;font-weight:600;}
.bs-n{font-family:'Shippori Mincho',serif;font-size:26px;color:#B8452A;line-height:1.2;margin-top:6px;}
.bs-n small{font-size:12px;color:#8a7a72;margin-left:3px;}
@media(max-width:700px){.bs-grid{grid-template-columns:1fr 1fr;}}
.budget-lbl{font-size:11px;letter-spacing:.14em;color:#8a7a72;}
.bpill{font-size:12.5px;padding:6px 14px;border-radius:18px;border:1px solid #e6d3cb;background:#fff;color:#5a4a4d;cursor:pointer;}
.bpill.active{background:#B8452A;color:#fff;border-color:#B8452A;}
.sortsel{font-size:12.5px;padding:6px 10px;border:1px solid #e6d3cb;border-radius:8px;background:#fff;color:#5a4a4d;margin-left:auto;}
.toolbar{position:sticky;top:54px;z-index:90;background:rgba(253,250,248,0.96);backdrop-filter:blur(12px);border-bottom:1px solid #efe2e2;padding:14px 0;margin-top:30px;}
.toolbar-inner{max-width:1180px;margin:0 auto;padding:0 24px;}
.search-box{width:100%;max-width:440px;padding:11px 18px;border:1px solid #e2d0c6;border-radius:24px;font-size:14px;font-family:inherit;outline:none;background:#fff;}
.search-box:focus{border-color:#B8452A;}
.pills{display:flex;gap:8px;overflow-x:auto;margin-top:12px;padding-bottom:4px;-webkit-overflow-scrolling:touch;}
.pill{flex:0 0 auto;font-family:inherit;font-size:13px;color:#B8452A;background:#fff;border:1px solid #e2d0c6;border-radius:20px;padding:7px 14px;cursor:pointer;transition:all .18s;white-space:nowrap;text-decoration:none;}
.pill:hover{background:#fbf0ea;}
.pill.active{background:#B8452A;color:#fff;border-color:#B8452A;}
.pill-n{font-size:11px;opacity:0.7;margin-left:5px;}
.content{max-width:1180px;margin:0 auto;padding:30px 24px 60px;}
.lead{max-width:960px;margin:0 auto;padding:26px 24px 0;font-size:15px;color:#4a4044;line-height:2;}
.pref-block{margin-bottom:44px;scroll-margin-top:150px;}
.pref-title{font-family:'Shippori Mincho',serif;font-size:21px;font-weight:600;color:#3a1208;margin-bottom:16px;padding-bottom:9px;border-bottom:2px solid #B8452A;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.pref-count{font-size:13px;font-weight:400;color:#a8887a;}
.pref-more{margin-left:auto;font-size:13px;color:#B8452A;text-decoration:none;font-family:'Noto Sans JP',sans-serif;font-weight:500;}
.pref-more:hover{text-decoration:underline;}
.fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(218px,1fr));gap:18px;}
.fcard{background:#fff;border:1px solid #f0e0d8;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .22s,transform .22s;}
.fcard:hover{box-shadow:0 10px 28px rgba(80,20,30,.12);transform:translateY(-3px);}
.fcard-imgwrap{position:relative;display:block;aspect-ratio:1/1;background:#fff;}
.fcard-img{width:100%;height:100%;object-fit:contain;padding:14px;box-sizing:border-box;}
.fcard-badge{position:absolute;top:10px;left:10px;background:#B8452A;color:#fff;font-size:10.5px;letter-spacing:.05em;padding:4px 9px;border-radius:4px;}
.fcard-body{padding:13px 15px 16px;display:flex;flex-direction:column;flex:1;}
.fcard-winery{font-size:12px;color:#7a5560;margin-bottom:5px;text-decoration:none;display:block;}
.fcard-winery:hover{color:#B8452A;text-decoration:underline;}
.fcard-name{font-size:13.5px;line-height:1.55;color:#2a2024;font-weight:500;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.9em;margin-bottom:13px;}
.fcard-btn{display:block;text-align:center;background:#BF0000;color:#fff;font-size:12.5px;font-weight:600;padding:10px 0;border-radius:5px;text-decoration:none;transition:background .2s;margin-top:auto;}
.fcard-btn:hover{background:#a00000;}
.noresult{text-align:center;color:#999;padding:60px 0;font-size:15px;display:none;}
.otherpref{max-width:1180px;margin:0 auto;padding:8px 24px 0;}
.otherpref h2{font-family:'Shippori Mincho',serif;font-size:18px;color:#3a1208;margin-bottom:14px;}
.otherpref-list{display:flex;flex-wrap:wrap;gap:8px;}
.otherpref-list a{font-size:13px;color:#B8452A;background:#fff;border:1px solid #e2d0c6;border-radius:20px;padding:7px 14px;text-decoration:none;}
.otherpref-list a:hover{background:#B8452A;color:#fff;}
.faqsec{max-width:960px;margin:8px auto 0;padding:10px 24px 0;}
.faqsec h2{font-family:'Shippori Mincho',serif;font-size:22px;color:#3a1208;margin-bottom:18px;}
.faq{background:#fff;border:1px solid #f0e0d8;border-radius:14px;padding:28px;}
.faq-item{margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f3e6e6;}
.faq-item:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none;}
.faq-item dt{font-weight:600;color:#3a1208;margin-bottom:8px;font-size:15px;}
.faq-item dd{font-size:14px;color:#5a5a5a;line-height:1.85;margin:0;}
.note{max-width:960px;margin:22px auto 0;padding:0 24px;font-size:12px;color:#897a7e;line-height:1.85;}
.footer{background:#1a0d05;padding:46px 24px 30px;color:rgba(255,255,255,0.5);font-size:13px;text-align:center;margin-top:52px;}
.footer-logo{font-family:'Shippori Mincho',serif;font-size:24px;color:#fff;font-weight:600;margin-bottom:16px;}
.footer-logo .accent{color:#B8452A;}
.footer-nav{display:flex;justify-content:center;flex-wrap:wrap;margin-bottom:22px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);}
.footer-nav a{color:rgba(255,255,255,0.6);text-decoration:none;font-size:13px;padding:0 16px;border-right:1px solid rgba(255,255,255,0.2);line-height:1;}
.footer-nav a:last-child{border-right:none;}
.footer-copy{font-size:11px;color:rgba(255,255,255,0.3);}
@media(max-width:700px){.steps-grid{grid-template-columns:1fr;}.fgrid{grid-template-columns:repeat(2,1fr);gap:12px;}}
"""

HEAD = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="{ogtitle}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="https://shochu.terroirhub.com/img/hero.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index,follow,max-image-preview:large">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-9JWN7TVZ6N"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-9JWN7TVZ6N');</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">
<script type="application/ld+json">
{jsonld}
</script>
"""

HEAD_TAIL = "<style>\n" + CSS + """</style>
</head>
<body>
<nav class="nav">
  <div class="nav-top">
    <a href="/" class="nav-logo">Terroir HUB <span style="color:#8B5E3C">SHOCHU</span></a>
    <a href="/shochu/furusato/" class="nav-back">&#8592; ふるさと納税トップ</a>
  </div>
</nav>
"""

FOOTER = """
<footer class="footer">
  <div class="footer-logo">Terroir HUB <span class="accent">SHOCHU</span></div>
  <nav class="footer-nav">
    <a href="/">ホーム</a>
    <a href="/shochu/search/">蔵検索</a>
    <a href="/shochu/furusato/">ふるさと納税</a>
    <a href="/shochu/guide/">焼酎ガイド</a>
    <a href="/privacy.html">プライバシー</a>
    <a href="/terms.html">利用規約</a>
  </nav>
  <p class="footer-copy">&copy; 2026 合同会社FOMUS — Terroir HUB SHOCHU</p>
</footer>
</body>
</html>
"""

NOTE = ('<p class="note">※ 返礼品・寄付額・在庫・取扱自治体は時期により変動します。本ページは楽天ふるさと納税の情報をもとに構成しており、'
        '最新の内容・正確な控除上限は各返礼品ページおよび各自治体・ふるさと納税サイトでご確認ください。控除には確定申告またはワンストップ特例申請が必要です。'
        '20歳未満の飲酒・お酒の購入は法律で禁止されています。Terroir HUB は焼酎の販売を行っていません。</p>')


PUBLISHER = {"@type": "Organization", "name": "合同会社FOMUS",
             "url": f"https://{DOMAIN}/", "sameAs": ["https://shochu.terroirhub.com/", "https://terroirhub.com/"]}


def jsonld_for(name, desc, url, crumb, items, faqs):
    # ItemList を Product/Offer 型に格上げ（価格は出さない方針→ offers.url + availability のみ）
    item_list = [{"@type": "ListItem", "position": i + 1,
                  "item": {"@type": "Product", "name": clean_name(it["name"]), "image": it["image"],
                           "offers": {"@type": "Offer", "url": it["url"], "availability": "https://schema.org/InStock",
                                      **({"price": it["price"], "priceCurrency": "JPY"} if it.get("price") else {})}}}
                 for i, it in enumerate(items[:30])]
    g = [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": c[0], "item": c[1]} for i, c in enumerate(crumb)]},
        {"@type": "CollectionPage", "name": name, "description": desc, "url": url,
         "datePublished": "2026-06-19", "dateModified": TODAY, "publisher": PUBLISHER,
         "isPartOf": {"@type": "WebSite", "name": "Terroir HUB SHOCHU", "url": f"https://{DOMAIN}/"}},
        {"@type": "ItemList", "name": name, "numberOfItems": len(items), "itemListElement": item_list},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]},
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": g}, ensure_ascii=False, indent=1)


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def build_hub(by_pref):
    ordered = [(p, by_pref[p]) for p in sort_prefs(by_pref)]
    total = sum(len(v) for v in by_pref.values())
    n_pref = len(by_pref)
    n_winery = len({c["winery_id"] for v in by_pref.values() for c in v})

    # 寄付金額の帯ごとの件数（金額が取れている返礼品のみ集計）
    _allitems = [it for lst in by_pref.values() for it in lst]
    _bandn = {}
    for _k, _lb, _lo, _hi in BUDGET_BANDS:
        _bandn[_k] = sum(1 for it in _allitems if band_of(it.get('price')) == _k)
    budget_cards = "".join(
        f'<a class="bs-card" href="/shochu/furusato/budget-{_k}.html">'
        f'<span class="bs-band">{_lb}</span>'
        f'<div class="bs-n">{_bandn[_k]}<small>件</small></div></a>'
        for _k, _lb, _lo, _hi in BUDGET_BANDS)

    pills = f'<button class="pill active" data-pref="all">すべて<span class="pill-n">{total}</span></button>'
    pills += "".join(
        f'<button class="pill" data-pref="{p}">{esc(PREF_NAMES[p])}<span class="pill-n">{len(v)}</span></button>'
        for p, v in ordered)

    sections = ""
    for p, items in ordered:
        cards = "".join(card_html(it) for it in items[:6])
        more = (f'<a class="pref-more" href="/shochu/furusato/{p}.html">{esc(PREF_NAMES[p])}の返礼品をすべて見る ({len(items)}件) →</a>'
                if len(items) > 6 else
                f'<a class="pref-more" href="/shochu/furusato/{p}.html">{esc(PREF_NAMES[p])}の特集ページ →</a>')
        sections += f'''
      <section class="pref-block" data-pref="{p}" id="pref-{p}">
        <h2 class="pref-title">{esc(PREF_NAMES[p])}の焼酎ふるさと納税 <span class="pref-count">{len(items)}件</span>{more}</h2>
        <div class="fgrid">{cards}
        </div>
      </section>'''

    faqs = [("焼酎のふるさと納税でおすすめは？",
             f"Terroir HUB SHOCHUでは全国{n_pref}都道府県・{n_winery}蔵の焼酎ふるさと納税返礼品{total}件を産地別に掲載。山梨・長野・北海道・山形など主要産地から、純米・吟醸・大吟醸など多彩な焼酎を寄付で応援しながら受け取れます。")] + FAQ_COMMON
    desc = (f"焼酎のふるさと納税返礼品を産地別に{total}件掲載。全国{n_winery}蔵の純米・吟醸・大吟醸を、"
            "寄付で蔵を応援しながら受け取れます。楽天ふるさと納税対応。")
    title = "焼酎のふるさと納税 返礼品 | 全国の蔵を応援 — Terroir HUB SHOCHU"
    url = f"https://{DOMAIN}/shochu/furusato/"
    crumb = [("Terroir HUB SHOCHU", f"https://{DOMAIN}/"), ("ふるさと納税", url)]
    all_items = [it for _, v in ordered for it in v]
    jsonld = jsonld_for("焼酎のふるさと納税 返礼品", desc, url, crumb, all_items, faqs)

    head = HEAD.format(title=esc(title), desc=esc(desc), ogtitle=esc("焼酎のふるさと納税 返礼品｜全国の蔵を応援"),
                       canonical=url, jsonld=jsonld) + HEAD_TAIL
    faq_html = "".join(f'<div class="faq-item"><dt>{esc(q)}</dt><dd>{esc(a)}</dd></div>' for q, a in faqs)
    body = f'''
<header class="hero">
  <div class="hero-inner">
    <div class="hero-tag">FURUSATO TAX — ふるさと納税で焼酎を</div>
    <h1>寄付して、日本の蔵を応援しよう。</h1>
    <p>ふるさと納税の返礼品として焼酎を受け取りながら、産地と蔵を直接応援。Terroir HUBが全国の蔵の返礼品を産地別に集めました。実質自己負担2,000円で、あなたの好きな焼酎を。</p>
    <div class="stats">
      <div class="stat"><div class="stat-n">{total}</div><div class="stat-l">返礼品</div></div>
      <div class="stat"><div class="stat-n">{n_winery}</div><div class="stat-l">蔵</div></div>
      <div class="stat"><div class="stat-n">{n_pref}</div><div class="stat-l">都道府県</div></div>
    </div>
  </div>
</header>
<section class="steps"><div class="steps-grid">
  <div class="step"><div class="step-n">1</div><h3>控除上限を確認</h3><p>年収・家族構成で寄付できる上限額が決まります。各サイトのシミュレーターで確認しましょう。</p></div>
  <div class="step"><div class="step-n">2</div><h3>好きな焼酎を選ぶ</h3><p>産地・蔵から選んで「楽天ふるさと納税で見る」へ。寄付すると返礼品として届きます。</p></div>
  <div class="step"><div class="step-n">3</div><h3>控除を申請</h3><p>ワンストップ特例（5自治体以内）または確定申告で、実質自己負担2,000円に。</p></div>
</div></section>
<div class="simbar"><div class="simcard">
  <p>💡 まずは控除上限額をチェック。年収と家族構成を入れるだけで、いくらまで寄付できるか分かります。</p>
  <a href="https://event.rakuten.co.jp/furusato/simulation/" target="_blank" rel="noopener">控除シミュレーターを開く ›</a>
</div></div>
<div class="toolbar"><div class="toolbar-inner">
  <input type="search" class="search-box" id="fsearch" placeholder="🔍 蔵名・銘柄で絞り込む（例: 獺祭、純米大吟醸、新潟）">
  <div class="pills" id="fpills">{pills}</div>
  <div class="budget-row">
    <span class="budget-lbl">寄付金額</span>
    <button class="bpill active" data-band="all">すべて</button>
    <button class="bpill" data-band="u10">1万円以下</button>
    <button class="bpill" data-band="10-20">1万〜2万円</button>
    <button class="bpill" data-band="20-30">2万〜3万円</button>
    <button class="bpill" data-band="o30">3万円以上</button>
    <select class="sortsel" id="fsort">
      <option value="default">並び順：おすすめ</option>
      <option value="asc">寄付金額が安い順</option>
      <option value="desc">寄付金額が高い順</option>
    </select>
  </div>
</div></div>
<main class="content" id="fcontent">
  {sections}
  <div class="noresult" id="noresult">該当する返礼品が見つかりませんでした。</div>
</main>
<section class="budgetsec">
  <h2>予算で選ぶ</h2>
  <p class="bs-lead">控除上限額の範囲で選ぶのがふるさと納税の基本です。寄付金額の帯から絞り込めます。</p>
  <div class="bs-grid">{budget_cards}</div>
</section>
{DEADLINE_BLOCK}
<section class="faqsec"><h2>ふるさと納税焼酎のよくある質問</h2><dl class="faq">{faq_html}</dl></section>
{NOTE}
{HUB_JS}
'''
    write(os.path.join(OUTDIR, "index.html"), head + body + FOOTER)
    return ordered


DEADLINE_BLOCK = """
<div class="deadline" id="dl-box"><div class="deadline-in">
  <div class="deadline-t">今年分の寄付は <em id="dl-days">12月31日</em> まで</div>
  <ul>
    <li>その年の控除対象になるのは、<b>12月31日までに入金・決済が完了した寄付</b>です。決済方法によって自治体側の受付締切が早まる場合があるため、各返礼品ページの案内を確認してください。</li>
    <li>ワンストップ特例（確定申告なしで控除を受ける制度）を使う場合、申請書の提出期限は<b>寄付した翌年の1月10日必着</b>です。寄付先が5自治体以内であることが条件です。</li>
    <li>控除上限額は年収・家族構成で変わります。寄付する前に各ふるさと納税サイトのシミュレーターで確認してください。</li>
  </ul>
</div></div>
"""

PREF_JS = """
<script>
(function(){
  var cards=[].slice.call(document.querySelectorAll('.fcard'));
  var grid=document.querySelector('.fgrid'), noresult=document.getElementById('noresult');
  var curBand='all', sortMode='default';
  function apply(){
    var shown=0;
    cards.forEach(function(c){
      var ok=(curBand==='all'||c.getAttribute('data-band')===curBand);
      c.style.display=ok?'':'none'; if(ok)shown++;
    });
    if(noresult) noresult.style.display=shown?'none':'block';
  }
  function sortCards(){
    if(sortMode==='default'||!grid) return;
    cards.slice().sort(function(x,y){
      var a=parseInt(x.getAttribute('data-price')||'0',10)||Infinity;
      var b=parseInt(y.getAttribute('data-price')||'0',10)||Infinity;
      if(a===Infinity&&b===Infinity) return 0;
      if(a===Infinity) return 1;
      if(b===Infinity) return -1;
      return sortMode==='asc'? a-b : b-a;
    }).forEach(function(c){grid.appendChild(c);});
  }
  var brow=document.querySelector('.budget-row');
  if(brow){
    brow.addEventListener('click',function(e){
      var b=e.target.closest('.bpill'); if(!b) return;
      curBand=b.getAttribute('data-band');
      [].forEach.call(brow.querySelectorAll('.bpill'),function(x){x.classList.toggle('active',x===b);});
      apply();
    });
    var sel=document.getElementById('fsort');
    if(sel) sel.addEventListener('change',function(){sortMode=sel.value;sortCards();apply();});
  }
  var dl=document.getElementById('dl-days');
  if(dl){
    var now=new Date(), end=new Date(now.getFullYear(),11,31,23,59,59);
    var days=Math.ceil((end-now)/86400000);
    dl.textContent = days>0 ? ('12月31日（あと'+days+'日）') : '12月31日';
    var box=document.getElementById('dl-box'), tb=document.querySelector('.toolbar');
    if(box && tb && now.getMonth()>=10 && days>0){ tb.parentNode.insertBefore(box, tb); box.classList.add('urgent'); }
  }
})();
</script>
"""


HUB_JS = """
<script>
(function(){
  var search=document.getElementById('fsearch'),pills=document.getElementById('fpills');
  var blocks=[].slice.call(document.querySelectorAll('.pref-block')),noresult=document.getElementById('noresult');
  var curPref='all';
  function apply(){
    var q=(search.value||'').trim().toLowerCase(),any=false;
    blocks.forEach(function(b){
      var prefOk=(curPref==='all'||b.getAttribute('data-pref')===curPref),shown=0;
      [].forEach.call(b.querySelectorAll('.fcard'),function(c){
        var ok=cardOk(c,prefOk,q);
        c.style.display=ok?'':'none';if(ok)shown++;
      });
      b.style.display=shown>0?'':'none';if(shown>0)any=true;
    });
    noresult.style.display=any?'none':'block';
  }
  // 寄付金額の帯で絞り込む。金額が取得できていない返礼品は帯フィルタ時に隠す
  var curBand='all', sortMode='default';
  var brow=document.querySelector('.budget-row');
  function cardOk(c,prefOk,q){
    if(!prefOk) return false;
    if(q && c.getAttribute('data-kw').indexOf(q)<0) return false;
    if(curBand!=='all' && c.getAttribute('data-band')!==curBand) return false;
    return true;
  }
  function sortBlocks(){
    if(sortMode==='default') return;
    blocks.forEach(function(b){
      var grid=b.querySelector('.fgrid'); if(!grid) return;
      var cs=[].slice.call(grid.querySelectorAll('.fcard'));
      cs.sort(function(x,y){
        // 金額が取得できていない返礼品は、昇順・降順どちらでも末尾に置く
        var a=parseInt(x.getAttribute('data-price')||'0',10)||Infinity;
        var b2=parseInt(y.getAttribute('data-price')||'0',10)||Infinity;
        if(a===Infinity&&b2===Infinity) return 0;
        if(a===Infinity) return 1;
        if(b2===Infinity) return -1;
        return sortMode==='asc'? a-b2 : b2-a;
      });
      cs.forEach(function(c){grid.appendChild(c);});
    });
  }
  if(brow){
    brow.addEventListener('click',function(e){
      var b=e.target.closest('.bpill'); if(!b) return;
      curBand=b.getAttribute('data-band');
      [].forEach.call(brow.querySelectorAll('.bpill'),function(x){x.classList.toggle('active',x===b);});
      apply();
    });
    var sel=document.getElementById('fsort');
    if(sel) sel.addEventListener('change',function(){sortMode=sel.value;sortBlocks();apply();});
  }
  // 今年の寄付締切までの残り日数。11〜12月は駆け込み期なので案内をページ上部へ移す
  var dl=document.getElementById('dl-days');
  if(dl){
    var now=new Date(), end=new Date(now.getFullYear(),11,31,23,59,59);
    var days=Math.ceil((end-now)/86400000);
    dl.textContent = days>0 ? ('12月31日（あと'+days+'日）') : '12月31日';
    var box=document.getElementById('dl-box'), tb=document.querySelector('.toolbar');
    if(box && tb && now.getMonth()>=10 && days>0){
      tb.parentNode.insertBefore(box, tb);
      box.classList.add('urgent');
    }
  }
  // 予算カード・?band= からの初期絞り込み（リンクを共有できるようにする）
  function setBand(b){
    curBand=b;
    if(brow){[].forEach.call(brow.querySelectorAll('.bpill'),function(x){x.classList.toggle('active',x.getAttribute('data-band')===b);});}
    apply();
    var tb=document.querySelector('.toolbar'); if(tb&&b!=='all') tb.scrollIntoView({behavior:'smooth',block:'start'});
  }
  [].forEach.call(document.querySelectorAll('[data-band-link]'),function(a){
    a.addEventListener('click',function(e){e.preventDefault();setBand(a.getAttribute('data-band-link'));});
  });
  var qb=(location.search.match(/[?&]band=([^&]+)/)||[])[1];
  if(qb) setBand(decodeURIComponent(qb));

  search.addEventListener('input',apply);
  pills.addEventListener('click',function(e){
    var btn=e.target.closest('.pill');if(!btn)return;
    curPref=btn.getAttribute('data-pref');
    [].forEach.call(pills.querySelectorAll('.pill'),function(p){p.classList.toggle('active',p===btn);});
    apply();
    if(curPref!=='all'){var t=document.getElementById('pref-'+curPref);if(t)t.scrollIntoView({behavior:'smooth',block:'start'});}
    else window.scrollTo({top:0,behavior:'smooth'});
  });
})();
</script>
"""


def build_pref(pref, items, all_prefs):
    pn = PREF_NAMES[pref]
    n = len(items)
    n_winery = len({it["winery_id"] for it in items})
    wineries = sorted({it["winery"] for it in items})
    lead = PREF_LEAD.get(pref) or (
        f"{pn}の焼酎ふるさと納税返礼品を{n}件掲載しています。"
        + f"{('、'.join(wineries[:3]))}など{n_winery}の蔵の返礼品から、寄付で{pn}の地酒と蔵を直接応援できます。")
    cards = "".join(card_html(it) for it in items)

    title = f"{pn}の焼酎 ふるさと納税 返礼品{n}件 | Terroir HUB SHOCHU"
    desc = (f"{pn}の焼酎ふるさと納税返礼品を{n}件掲載（{n_winery}蔵）。"
            f"{('、'.join(wineries[:4]))}など{pn}の焼酎を、寄付で応援しながら受け取れます。楽天ふるさと納税対応。")
    url = f"https://{DOMAIN}/shochu/furusato/{pref}.html"
    crumb = [("Terroir HUB SHOCHU", f"https://{DOMAIN}/"),
             ("ふるさと納税", f"https://{DOMAIN}/shochu/furusato/"),
             (pn, url)]
    faqs = [
        (f"{pn}の焼酎でふるさと納税のおすすめは？",
         f"{pn}では{n_winery}の蔵から{n}件の焼酎返礼品が選べます。{('、'.join(wineries[:5]))}などの焼酎が寄付で受け取れます。"),
        (f"{pn}の焼酎ふるさと納税はどこで寄付できますか？",
         "各返礼品の「楽天ふるさと納税で見る」ボタンから楽天ふるさと納税の該当ページに移動して寄付できます。"),
    ] + FAQ_COMMON[:3]
    jsonld = jsonld_for(f"{pn}の焼酎 ふるさと納税返礼品", desc, url, crumb, items, faqs)
    head = HEAD.format(title=esc(title), desc=esc(desc), ogtitle=esc(f"{pn}の焼酎 ふるさと納税 返礼品{n}件"),
                       canonical=url, jsonld=jsonld) + HEAD_TAIL

    others = [p for p in all_prefs if p != pref]
    other_links = "".join(f'<a href="/shochu/furusato/{p}.html">{esc(PREF_NAMES[p])}</a>' for p in others)
    faq_html = "".join(f'<div class="faq-item"><dt>{esc(q)}</dt><dd>{esc(a)}</dd></div>' for q, a in faqs)
    body = f'''
<div class="crumb"><a href="/">ホーム</a> › <a href="/shochu/furusato/">ふるさと納税</a> › {esc(pn)}</div>
<header class="hero">
  <div class="hero-inner">
    <div class="hero-tag">FURUSATO TAX — {esc(pn)}</div>
    <h1>{esc(pn)}の焼酎を、ふるさと納税で。</h1>
    <p>{esc(lead)}</p>
    <div class="stats">
      <div class="stat"><div class="stat-n">{n}</div><div class="stat-l">返礼品</div></div>
      <div class="stat"><div class="stat-n">{n_winery}</div><div class="stat-l">蔵</div></div>
    </div>
  </div>
</header>
<div class="simbar"><div class="simcard">
  <p>💡 控除上限額を先にチェック。年収と家族構成を入れるだけで、いくらまで寄付できるか分かります。</p>
  <a href="https://event.rakuten.co.jp/furusato/simulation/" target="_blank" rel="noopener">控除シミュレーターを開く ›</a>
</div></div>
{DEADLINE_BLOCK}
<div class="toolbar"><div class="toolbar-inner">
  <div class="budget-row">
    <span class="budget-lbl">寄付金額</span>
    <button class="bpill active" data-band="all">すべて</button>
    <button class="bpill" data-band="u10">1万円以下</button>
    <button class="bpill" data-band="10-20">1万〜2万円</button>
    <button class="bpill" data-band="20-30">2万〜3万円</button>
    <button class="bpill" data-band="o30">3万円以上</button>
    <select class="sortsel" id="fsort">
      <option value="default">並び順：おすすめ</option>
      <option value="asc">寄付金額が安い順</option>
      <option value="desc">寄付金額が高い順</option>
    </select>
  </div>
</div></div>
<main class="content">
  <section class="pref-block" data-pref="{pref}">
    <h2 class="pref-title">{esc(pn)}の焼酎ふるさと納税 返礼品 <span class="pref-count">{n}件</span></h2>
    <div class="fgrid">{cards}
    </div>
    <p id="noresult" style="display:none;font-size:14px;color:#8a7a72;padding:20px 0;">該当する返礼品がありません。金額の条件を変えてお試しください。</p>
  </section>
  <div class="otherpref">
    <h2>{esc(pn)}の焼酎をもっと知る</h2>
    <div class="otherpref-list">
      <a href="/shochu/{pref}/">{esc(pn)}の蔵一覧</a>
      <a href="/shochu/guide/">焼酎の基礎知識</a>
      <a href="/shochu/search/">蔵検索</a>
    </div>
  </div>
  <div class="otherpref">
    <h2>他の産地の焼酎ふるさと納税</h2>
    <div class="otherpref-list">{other_links}</div>
  </div>
</main>
<section class="faqsec"><h2>{esc(pn)}の焼酎ふるさと納税 よくある質問</h2><dl class="faq">{faq_html}</dl></section>
{NOTE}
'''
    write(os.path.join(OUTDIR, f"{pref}.html"), head + body + PREF_JS + FOOTER)


def build_budget(band_key, band_label, by_pref, all_prefs):
    """寄付金額帯ごとの一覧ページ。
    ハブは各県6件のプレビューしか出さないため、金額で絞って全件見たい需要をここで受ける。
    「ふるさと納税 焼酎 1万円以下」のような金額指定の検索にも対応する。"""
    items = [it for lst in by_pref.values() for it in lst if band_of(it.get('price')) == band_key]
    if not items:
        return None
    items.sort(key=lambda x: (x.get('price') or 0))
    n = len(items)
    n_winery = len({it['winery_id'] for it in items})
    n_pref = len({it['pref'] for it in items})
    prices = [it['price'] for it in items if it.get('price')]
    lo, hi = (min(prices), max(prices)) if prices else (0, 0)

    slug = f'budget-{band_key}'
    url = f"https://{DOMAIN}/shochu/furusato/{slug}.html"
    title = f"{band_label}の焼酎 ふるさと納税 返礼品{n}件 | Terroir HUB SHOCHU"
    desc = (f"寄付金額{band_label}の焼酎ふるさと納税返礼品を{n}件掲載（{n_pref}都道府県・{n_winery}蔵）。"
            f"寄付額{lo:,}円〜{hi:,}円の返礼品を金額順に並べています。楽天ふるさと納税対応。")
    lead = (f"寄付金額が{band_label}の焼酎返礼品を{n}件集めました（{n_pref}都道府県・{n_winery}蔵）。"
            f"控除上限額の範囲に収まるものを選べます。金額は掲載時点の楽天ふるさと納税の情報です。")
    crumb = [("Terroir HUB SHOCHU", f"https://{DOMAIN}/"),
             ("ふるさと納税", f"https://{DOMAIN}/shochu/furusato/"),
             (f"{band_label}", url)]
    faqs = [
        (f"{band_label}の焼酎返礼品は何件ありますか？",
         f"Terroir HUB SHOCHUでは{band_label}の焼酎返礼品を{n}件掲載しています（{n_pref}都道府県・{n_winery}蔵）。"),
        ("寄付金額はどこの情報ですか？",
         "楽天ふるさと納税の掲載金額をもとにしています。金額・在庫・取扱自治体は変動するため、寄付前に各返礼品ページで最新の内容を確認してください。"),
    ] + FAQ_COMMON[:3]
    jsonld = jsonld_for(f"{band_label}の焼酎 ふるさと納税返礼品", desc, url, crumb, items, faqs)
    head = HEAD.format(title=esc(title), desc=esc(desc),
                       ogtitle=esc(f"{band_label}の焼酎 ふるさと納税 返礼品{n}件"),
                       canonical=url, jsonld=jsonld) + HEAD_TAIL

    others = "".join(
        f'<a href="/shochu/furusato/budget-{k}.html">{esc(lb)}</a>'
        for k, lb, _lo, _hi in BUDGET_BANDS if k != band_key)
    pref_links = "".join(
        f'<a href="/shochu/furusato/{p}.html">{esc(PREF_NAMES[p])}</a>' for p in all_prefs)
    cards = "".join(card_html(it) for it in items)
    faq_html = "".join(f'<div class="faq-item"><dt>{esc(q)}</dt><dd>{esc(a)}</dd></div>' for q, a in faqs)

    body = f'''
<div class="crumb"><a href="/">ホーム</a> › <a href="/shochu/furusato/">ふるさと納税</a> › {esc(band_label)}</div>
<header class="hero">
  <div class="hero-inner">
    <div class="hero-tag">FURUSATO TAX — 寄付金額 {esc(band_label)}</div>
    <h1>{esc(band_label)}の焼酎を、ふるさと納税で。</h1>
    <p>{esc(lead)}</p>
    <div class="stats">
      <div class="stat"><div class="stat-n">{n}</div><div class="stat-l">返礼品</div></div>
      <div class="stat"><div class="stat-n">{n_winery}</div><div class="stat-l">蔵</div></div>
      <div class="stat"><div class="stat-n">{n_pref}</div><div class="stat-l">都道府県</div></div>
    </div>
  </div>
</header>
<div class="simbar"><div class="simcard">
  <p>💡 控除上限額を先にチェック。年収と家族構成を入れるだけで、いくらまで寄付できるか分かります。</p>
  <a href="https://event.rakuten.co.jp/furusato/simulation/" target="_blank" rel="noopener">控除シミュレーターを開く ›</a>
</div></div>
{DEADLINE_BLOCK}
<div class="toolbar"><div class="toolbar-inner">
  <div class="budget-row">
    <span class="budget-lbl">並び替え</span>
    <select class="sortsel" id="fsort" style="margin-left:0;">
      <option value="asc">寄付金額が安い順</option>
      <option value="desc">寄付金額が高い順</option>
    </select>
  </div>
</div></div>
<main class="content">
  <section class="pref-block">
    <h2 class="pref-title">{esc(band_label)}の焼酎返礼品 <span class="pref-count">{n}件</span></h2>
    <div class="fgrid">{cards}
    </div>
  </section>
  <div class="otherpref">
    <h2>ほかの寄付金額で見る</h2>
    <div class="otherpref-list">{others}<a href="/shochu/furusato/">すべての返礼品</a></div>
  </div>
  <div class="otherpref">
    <h2>都道府県から探す</h2>
    <div class="otherpref-list">{pref_links}</div>
  </div>
</main>
<section class="faqsec"><h2>よくある質問</h2><dl class="faq">{faq_html}</dl></section>
{NOTE}
'''
    write(os.path.join(OUTDIR, f"{slug}.html"), head + body + PREF_JS + FOOTER)
    return {'key': band_key, 'label': band_label, 'n': n, 'slug': slug}


def main():
    by_pref = collect()
    ordered = build_hub(by_pref)
    all_prefs = [p for p, _ in ordered]
    for p, items in ordered:
        build_pref(p, items, all_prefs)
    # 寄付金額帯ページ（ハブの「予算で選ぶ」からの着地先）
    budget_pages = [build_budget(k, lb, by_pref, all_prefs) for k, lb, _lo, _hi in BUDGET_BANDS]
    budget_pages = [b for b in budget_pages if b]
    # 蔵ページからの内部リンク用に、返礼品ありの県スラッグを出力
    write(os.path.join(OUTDIR, "_prefs.json"), json.dumps(all_prefs, ensure_ascii=False))
    total = sum(len(v) for v in by_pref.values())
    print(f"生成: ハブ + 県別{len(all_prefs)}ページ + 金額帯{len(budget_pages)}ページ / 返礼品{total}件")
    print("金額帯:", " ".join(f"{b['label']}={b['n']}件" for b in budget_pages))
    print("県別:", " ".join(all_prefs))


if __name__ == "__main__":
    main()
