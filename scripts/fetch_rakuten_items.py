#!/usr/bin/env python3
"""
楽天市場商品検索APIで、各蔵の「代表銘柄ごとの商品画像・リンク」と
「蔵の商品グリッド」を取得し shochu/rakuten_items.json に保存する。

構造:
  { "<brewery_id>": {
      "brands": [ {"name","image","url"}, ... ],   # JSONの代表銘柄に対応（フォールバック検索）
      "items":  [ {"name","image","url"}, ... ]     # 蔵の商品グリッド（最大6）
  }, ... }

使い方:
  python3 scripts/fetch_rakuten_items.py --test ito_aichi
  python3 scripts/fetch_rakuten_items.py --pref aichi
  python3 scripts/fetch_rakuten_items.py            # 全県

認証情報は scripts/rakuten_config.json（.gitignore済み）から読む。
結果JSONに accessKey 等の秘密情報は一切含まれない。
"""
import json, glob, os, sys, time, re, urllib.request, urllib.parse, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shochu_filter import is_shochu_item   # 焼酎・泡盛以外を弾く共通フィルタ

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(BASE, 'scripts', 'rakuten_config.json'), encoding='utf-8'))
ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701'
OUT_PATH = os.path.join(BASE, 'shochu', 'rakuten_items.json')

GRID_ITEMS = 6
RATE_SLEEP = 1.5      # QPS=1申請。安全側で1.5秒
_last_call = [0.0]


def _throttle():
    dt = time.monotonic() - _last_call[0]
    if dt < RATE_SLEEP:
        time.sleep(RATE_SLEEP - dt)
    _last_call[0] = time.monotonic()


def normalize_kw(name):
    """検索ヒット率を上げるための銘柄名正規化：括弧と中身・先頭の『清酒』を除去"""
    s = re.sub(r'[（(][^）)]*[）)]', '', name or '')
    s = re.sub(r'^清酒', '', s).strip()
    return s or (name or '').strip()


def _clean_kw(keyword):
    """楽天APIが弾くキーワードを整える。
    - 記号 & / \\ | - + 等は除去
    - 半角1文字 or かな1文字トークン（"A" "s" "ル" 等）は keyword is not valid になるため除去。
      漢字1文字（「蔵」等）は残す。
    """
    s = re.sub(r'[&＆/／\\|｜<>"\'\-+~^*]', ' ', keyword or '')
    toks = [t for t in s.split() if len(t) > 1 or re.match(r'[一-龥々〆ヶ]', t)]
    return ' '.join(toks).strip()


def search(keyword, hits=30, avail=True):
    keyword = _clean_kw(keyword)
    if not keyword:
        return {}
    params = {
        'applicationId': CFG['applicationId'], 'accessKey': CFG['accessKey'],
        'affiliateId': CFG['affiliateId'], 'keyword': keyword, 'hits': hits,
        'format': 'json', 'imageFlag': 1, 'sort': 'standard',
    }
    if avail:
        params['availability'] = 1
    url = ENDPOINT + '?' + urllib.parse.urlencode(params)
    for attempt in range(5):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={
                'Referer': CFG['referer'], 'Origin': CFG['referer'],
                'User-Agent': 'terroirhub-batch/1.0'})
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(6 * (attempt + 1)); continue
            if attempt < 4:
                time.sleep(3 * (attempt + 1)); continue
            raise
        except Exception:
            # ConnectionReset / timeout / URLError 等の一時的エラーもリトライ
            if attempt < 4:
                time.sleep(3 * (attempt + 1)); continue
            raise
    return {}


def img_of(it):
    imgs = it.get('mediumImageUrls') or []
    img = (imgs[0].get('imageUrl') if imgs and isinstance(imgs[0], dict) else (imgs[0] if imgs else ''))
    return (img.split('?')[0] + '?_ex=500x500') if img else ''


def items_from(data):
    out = []
    for w in data.get('Items', []):
        it = w.get('Item', w)
        img = img_of(it)
        if not img:
            continue
        name = it.get('itemName', '').strip()
        if not is_shochu_item(name):   # 焼酎・泡盛以外は除外
            continue
        rec = {
            'name': name,
            'image': img,
            'url': it.get('affiliateUrl') or it.get('itemUrl'),
        }
        # ふるさと納税は寄付金額で選ぶ行動が支配的。取得できた場合のみ price を持たせる
        try:
            p = int(it.get('itemPrice') or 0)
            if p > 0:
                rec['price'] = p
        except (TypeError, ValueError):
            pass
        out.append(rec)
    return out


# ── 蔵の同定（その蔵の商品だけを残すためのトークン） ──
_IDENTITY = [set()]

_COMPANY_SUFFIX = re.compile(r'(株式会社|有限会社|合同会社|合名会社|農事組合法人|有限責任事業組合|株|（株）|\(株\)|蒸溜所|蒸留所|ディスティラリー|distillery|醸造|酒造|酒店|本店|本家|商店)')


def identity_tokens(b):
    """その蔵を一意に表すトークン集合（蔵名・会社名・ブランド名・銘柄名）。"""
    toks = set()

    def add(s):
        if not s:
            return
        s = s.strip()
        if len(s) >= 2:
            toks.add(s.lower())

    name = b.get('name', '') or ''
    for part in re.split(r'[（()）]', name):
        add(part)
    add(b.get('brand', ''))
    add(_COMPANY_SUFFIX.sub('', b.get('company', '') or ''))
    for br in b.get('brands', []):
        nm = br.get('name', '') if isinstance(br, dict) else str(br)
        add(nm)
        if nm:
            head = nm.split()[0]
            if re.search(r'[ぁ-んァ-ヶ一-龠]', head):   # 汎用英単語の先頭語は別ブランドを拾うため日本語のみ
                add(head)
    return toks


def item_matches_identity(item_name, tokens):
    if not tokens:
        return True
    low = (item_name or '').lower()
    return any(t in low for t in tokens)


def brand_image(brname, brand, pool):
    """まず蒸留所検索結果(pool)から全トークン一致で探し、無ければ個別フォールバック検索（その蔵の商品のみ）"""
    tokens = [t for t in brname.split() if t]
    for it in pool:
        nm = it['name']
        if tokens and all(t in nm for t in tokens):
            return {'name': brname, 'image': it['image'], 'url': it['url'], 'match': nm}
    # フォールバック: 銘柄名→末尾を削る→蔵代表（pool/items_fromは既に日本酒限定）
    cands = [brname]
    p = list(tokens)
    while len(p) > 1:
        p = p[:-1]; cands.append(' '.join(p))
    if brand and brand not in cands:
        cands.append(brand)
    for kw in cands[1:]:
        for it in items_from(search(kw, hits=5)):
            if item_matches_identity(it['name'], _IDENTITY[0]):
                return {'name': brname, 'image': it['image'], 'url': it['url'], 'match': it['name']}
    return {'name': brname, 'image': '', 'url': ''}


def main():
    args = sys.argv[1:]
    test_id = args[args.index('--test') + 1] if '--test' in args else None
    pref_only = args[args.index('--pref') + 1] if '--pref' in args else None
    refill = '--refill' in args

    json_files = sorted(glob.glob(os.path.join(BASE, 'data', 'data_*_distilleries.json')))
    result = json.load(open(OUT_PATH, encoding='utf-8')) if os.path.exists(OUT_PATH) else {}
    done = with_items = 0

    # ── refill: 商品ゼロ蒸留所を、各銘柄名（正規化）＋在庫制限なしで再検索 ──
    if refill:
        allb = {}
        for jf in json_files:
            for b in json.load(open(jf, encoding='utf-8')):
                if b.get('id'):
                    allb[b['id']] = b
        targets = [bid for bid, v in result.items() if not v.get('items')]
        print(f'refill対象（商品ゼロ蒸留所）: {len(targets)}蔵')
        fixed = 0
        for i, bid in enumerate(targets):
            b = allb.get(bid)
            if not b:
                continue
            brand = (b.get('brand') or b.get('name') or '').strip()
            brnames = [(br.get('name') if isinstance(br, dict) else str(br)) for br in b.get('brands', [])[:3]]
            kws = []
            for k in [brand] + [normalize_kw(n) for n in brnames]:
                if k and k not in kws:
                    kws.append(k)
            pool, seen = [], set()
            for kw in kws:
                for it in items_from(search(kw, hits=10, avail=False)):
                    if it['name'] not in seen:
                        seen.add(it['name']); pool.append(it)
            items = pool[:GRID_ITEMS]
            brands = []
            for n in brnames:
                if not n:
                    continue
                nk = normalize_kw(n)
                got = next(({'name': n, 'image': it['image'], 'url': it['url']} for it in pool if nk and nk in it['name']), None)
                if not got:
                    r = items_from(search(nk, hits=3, avail=False)) if nk else []
                    got = {'name': n, 'image': r[0]['image'], 'url': r[0]['url']} if r else {'name': n, 'image': '', 'url': ''}
                brands.append(got)
            result[bid] = {'brands': brands, 'items': items}
            if items:
                fixed += 1
            imgcnt = sum(1 for x in brands if x['image'])
            print(f'  [{i+1}/{len(targets)}] {bid}: 商品{len(items)} / 銘柄画像{imgcnt}/{len(brands)}')
            if (i + 1) % 10 == 0:
                json.dump(result, open(OUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(result, open(OUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'\nrefill完了: {fixed}/{len(targets)}蔵に商品を追加')
        return

    for jf in json_files:
        pref = os.path.basename(jf).replace('data_', '').replace('_distilleries.json', '')
        if pref_only and pref != pref_only:
            continue
        for b in json.load(open(jf, encoding='utf-8')):
            bid = b.get('id')
            if not bid or (test_id and bid != test_id):
                continue
            brand = (b.get('brand') or b.get('name') or '').strip()
            if not brand:
                continue
            try:
                # この蔵の同定トークン（brand_imageからも参照）
                ident = identity_tokens(b)
                _IDENTITY[0] = ident
                # 複数キーワード（蔵名・ブランド・各銘柄）でリコール向上
                name_clean = normalize_kw(re.split(r'[（(]', b.get('name', ''))[0])
                brnames = [normalize_kw(br.get('name', '') if isinstance(br, dict) else str(br))
                           for br in b.get('brands', [])[:3]]
                kws = []
                for k in [brand, name_clean] + brnames:
                    k = (k or '').strip()
                    if k and k not in kws:
                        kws.append(k)
                # プール構築（日本酒判定 items_from 済み）→ その蔵の商品だけに同定
                pool, seen = [], set()
                for kw in kws:
                    for it in items_from(search(kw, hits=30)):
                        if it['name'] in seen:
                            continue
                        if not item_matches_identity(it['name'], ident):  # 他蔵・無関係を除外
                            continue
                        seen.add(it['name']); pool.append(it)
                items = pool[:GRID_ITEMS]
                # 代表銘柄ごとの画像
                brands = []
                for br in b.get('brands', [])[:3]:
                    nm = br.get('name', '') if isinstance(br, dict) else str(br)
                    if nm:
                        brands.append(brand_image(nm, brand, pool))
                result[bid] = {'brands': brands, 'items': items}
                done += 1
                if items:
                    with_items += 1
                imgcnt = sum(1 for x in brands if x['image'])
                print(f'  {pref}/{bid}: 商品{len(items)} / 銘柄画像{imgcnt}/{len(brands)}')
            except Exception as e:
                print(f'  ❌ {pref}/{bid}: {e}')
        # 県ごとに途中保存（中断対策）
        json.dump(result, open(OUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    json.dump(result, open(OUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n保存: {OUT_PATH}')
    print(f'処理 {done}蔵 / 商品あり {with_items} / 累計収録 {len(result)}蔵')


if __name__ == '__main__':
    main()
