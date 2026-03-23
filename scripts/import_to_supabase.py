#!/usr/bin/env python3
"""
全蒸留所JSONデータをSupabaseのdistilleriesテーブルにインポート。
既存データはupsert（id一致で上書き）。

使い方:
  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=xxx python3 scripts/import_to_supabase.py
"""

import json, glob, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SB_URL = os.environ.get('SUPABASE_URL', 'https://hhwavxavuqqfiehrogwv.supabase.co')
SB_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

if not SB_KEY:
    print("ERROR: SUPABASE_SERVICE_KEY環境変数を設定してください")
    print("  export SUPABASE_SERVICE_KEY='eyJ...'")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("requestsライブラリが必要です: pip install requests")
    sys.exit(1)

headers = {
    'apikey': SB_KEY,
    'Authorization': f'Bearer {SB_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
}

total = 0
errors = 0

for jf in sorted(glob.glob(os.path.join(BASE, 'data', 'data_*_distilleries.json'))):
    pref = os.path.basename(jf).replace('data_', '').replace('_distilleries.json', '')
    with open(jf, 'r', encoding='utf-8') as f:
        distilleries = json.load(f)

    if not distilleries:
        continue

    # バッチでupsert（Supabase REST APIは配列をサポート）
    rows = []
    for d in distilleries:
        if not d.get('id'):
            continue
        row = {
            'id': d['id'],
            'prefecture': pref,
            'name': d.get('name', ''),
            'company': d.get('company', ''),
            'brand': d.get('brand', ''),
            'founded': d.get('founded', ''),
            'founded_era': d.get('founded_era', ''),
            'address': d.get('address', ''),
            'tel': d.get('tel', ''),
            'url': d.get('url', ''),
            'area': d.get('area', ''),
            'desc': d.get('desc', ''),
            'visit': d.get('visit', ''),
            'brands': json.dumps(d.get('brands', []), ensure_ascii=False),
            'features': json.dumps(d.get('features', []), ensure_ascii=False),
            'nearest_station': d.get('nearest_station', ''),
            'source': d.get('source', ''),
            'lat': d.get('lat'),
            'lng': d.get('lng'),
            'spirit_type': d.get('spirit_type', 'honkaku'),
            'koji_type': d.get('koji_type', ''),
            'main_ingredient': d.get('main_ingredient', ''),
        }
        rows.append(row)

    # 50件ずつバッチ送信
    for i in range(0, len(rows), 50):
        batch = rows[i:i+50]
        resp = requests.post(
            f'{SB_URL}/rest/v1/distilleries',
            headers=headers,
            json=batch,
        )
        if resp.status_code in (200, 201):
            total += len(batch)
        else:
            print(f"  ERROR {pref}: {resp.status_code} {resp.text[:200]}")
            errors += len(batch)

    print(f"  {pref}: {len(rows)} distilleries")

print(f"\nDone: {total} imported, {errors} errors")
