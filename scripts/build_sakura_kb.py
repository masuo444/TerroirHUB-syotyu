#!/usr/bin/env python3
"""
統合サクラナレッジベース構築。
日本酒版(FOMUS_TerriorHUB)と焼酎版の全蔵データを1つのKBに統合。
サクラは日本酒も焼酎も泡盛も全て知っている。
"""

import json
import glob
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAKE_BASE = os.path.join(os.path.dirname(BASE), 'FOMUS_TerriorHUB')

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

kb = {
    "version": "2.0",
    "description": "Terroir HUB 統合ナレッジベース — 日本酒・焼酎・泡盛",
    "sake": {"breweries": [], "count": 0},
    "shochu": {"distilleries": [], "count": 0},
    "awamori": {"distilleries": [], "count": 0},
}

# ── 日本酒データ読み込み ──
sake_count = 0
sake_files = sorted(glob.glob(os.path.join(SAKE_BASE, 'data_*_breweries.json')))
for jf in sake_files:
    pref = os.path.basename(jf).replace('data_', '').replace('_breweries.json', '')
    pref_name = PREF_NAMES.get(pref, pref)
    try:
        with open(jf, 'r', encoding='utf-8') as f:
            breweries = json.load(f)
        for b in breweries:
            entry = {
                "category": "sake",
                "id": b.get('id', ''),
                "name": b.get('name', ''),
                "brand": b.get('brand', ''),
                "pref": pref,
                "pref_name": pref_name,
                "area": b.get('area', ''),
                "founded": b.get('founded', ''),
                "url": b.get('url', ''),
                "page": f"/sake/{pref}/{b.get('id','')}.html",
                "desc": b.get('desc', '')[:200],
                "brands": [br.get('name','') for br in b.get('brands', [])[:3] if isinstance(br, dict)],
                "features": b.get('features', [])[:3],
            }
            kb["sake"]["breweries"].append(entry)
            sake_count += 1
    except Exception as e:
        print(f"  WARN: sake/{pref} — {e}")

kb["sake"]["count"] = sake_count
print(f"日本酒: {sake_count} 蔵を読み込み")

# ── 焼酎・泡盛データ読み込み ──
shochu_count = 0
awamori_count = 0
shochu_files = sorted(glob.glob(os.path.join(BASE, 'data', 'data_*_distilleries.json')))
for jf in shochu_files:
    pref = os.path.basename(jf).replace('data_', '').replace('_distilleries.json', '')
    pref_name = PREF_NAMES.get(pref, pref)
    try:
        with open(jf, 'r', encoding='utf-8') as f:
            distilleries = json.load(f)
        for d in distilleries:
            spirit = d.get('spirit_type', 'honkaku')
            is_awamori = spirit == 'awamori'
            entry = {
                "category": "awamori" if is_awamori else "shochu",
                "id": d.get('id', ''),
                "name": d.get('name', ''),
                "brand": d.get('brand', ''),
                "type": d.get('type', ''),
                "pref": pref,
                "pref_name": pref_name,
                "area": d.get('area', ''),
                "founded": d.get('founded', ''),
                "url": d.get('url', ''),
                "page": f"/shochu/{pref}/{d.get('id','')}.html",
                "desc": d.get('desc', '')[:200],
                "main_ingredient": d.get('main_ingredient', ''),
                "koji_type": d.get('koji_type', ''),
                "brands": [br.get('name','') for br in d.get('brands', [])[:3] if isinstance(br, dict)],
                "features": d.get('features', [])[:3],
            }
            if is_awamori:
                kb["awamori"]["distilleries"].append(entry)
                awamori_count += 1
            else:
                kb["shochu"]["distilleries"].append(entry)
                shochu_count += 1
    except Exception as e:
        print(f"  WARN: shochu/{pref} — {e}")

kb["shochu"]["count"] = shochu_count
kb["awamori"]["count"] = awamori_count
print(f"焼酎: {shochu_count} 蒸留所を読み込み")
print(f"泡盛: {awamori_count} 蒸留所を読み込み")
print(f"合計: {sake_count + shochu_count + awamori_count} 蔵・蒸留所")

# ── 出力 ──
out_path = os.path.join(BASE, 'shochu', 'sakura_kb.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(kb, f, ensure_ascii=False, separators=(',', ':'))

size_kb = os.path.getsize(out_path) / 1024
print(f"\n統合KB出力: {out_path} ({size_kb:.0f} KB)")
