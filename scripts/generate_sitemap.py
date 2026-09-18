#!/usr/bin/env python3
"""
sitemap.xml を自動生成（中身の厚い蔵だけを載せる「core方式」）。

2026-09-18: URL検査APIで shochu は全セクション 0/34 が未登録
（Crawled - currently not indexed）と判明。薄いページにクロール予算を食われているため、
サイトマップを絞ってクロールを集中させる。ページ自体は消さない
（内部リンクからは従来どおり辿れる）。全件版が要るときは --all を付ける。
"""

import json
import glob
import os
import sys
from datetime import date

CORE_ONLY = '--all' not in sys.argv
skipped = [0]


def is_rich(d):
    """説明文100字以上・公式サイトあり・代表銘柄2つ以上 = 独自の中身があるとみなす"""
    return (len(d.get('desc') or '') >= 100
            and (d.get('url') or '').startswith('http')
            and len(d.get('brands') or []) >= 2)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = 'https://shochu.terroirhub.com'
TODAY = date.today().isoformat()

PREF_SLUGS = [
    'hokkaido','aomori','iwate','miyagi','akita','yamagata','fukushima',
    'ibaraki','tochigi','gunma','saitama','chiba','tokyo','kanagawa',
    'niigata','toyama','ishikawa','fukui','yamanashi','nagano','gifu','shizuoka','aichi',
    'mie','shiga','kyoto','osaka','hyogo','nara','wakayama',
    'tottori','shimane','okayama','hiroshima','yamaguchi',
    'tokushima','kagawa','ehime','kochi',
    'fukuoka','saga','nagasaki','kumamoto','oita','miyazaki','kagoshima','okinawa'
]

REGIONS = ['hokkaido','tohoku','kanto','chubu','kinki','chugoku','shikoku','kyushu']

GUIDE_PAGES = ['index','types','production','drinking','pairing','history','awamori','glossary']

urls = []

def add(loc, priority, changefreq='monthly', langs=None):
    urls.append({'loc': loc, 'priority': priority, 'changefreq': changefreq, 'langs': langs})

# Homepage
add('/', '1.0', 'weekly', {'ja': '/', 'en': '/en/'})
add('/en/', '0.9', 'weekly')
add('/shochu/blog/visit-guide.html', '0.9', 'monthly')
# 見学ガイド（2026-09-18追加）。実在するページだけを載せる
for _vp in sorted(glob.glob(os.path.join(BASE, 'shochu', 'visit', '**', 'index.html'), recursive=True)):
    _rel = os.path.relpath(_vp, BASE).replace(os.sep, '/')[:-len('index.html')]
    add('/' + _rel, '0.9', 'monthly')

# Guide pages
for g in GUIDE_PAGES:
    path = f'/shochu/guide/{g}.html' if g != 'index' else '/shochu/guide/'
    add(path, '0.9', 'monthly')

# Region pages
for r in REGIONS:
    add(f'/shochu/region/{r}.html', '0.8', 'monthly')

# Prefecture index + individual distillery pages
# 本物のEN本文がある蔵（data/en_content.json）はENページもsitemapに含める
_enc_path = os.path.join(BASE, 'data', 'en_content.json')
EN_REAL = set()
if os.path.exists(_enc_path):
    try:
        EN_REAL = {k for k in json.load(open(_enc_path, encoding='utf-8')) if not k.startswith('_')}
    except Exception:
        EN_REAL = set()

json_files = sorted(glob.glob(os.path.join(BASE, 'data', 'data_*_distilleries.json')))
for jf in json_files:
    pref = os.path.basename(jf).replace('data_', '').replace('_distilleries.json', '')
    with open(jf, 'r', encoding='utf-8') as f:
        distilleries = json.load(f)

    if not distilleries:
        continue

    # Prefecture index
    add(f'/shochu/{pref}/', '0.7', 'weekly')

    # Individual pages (ja + en + fr with hreflang cross-references)
    for d in distilleries:
        if not d.get('id'):
            continue
        if CORE_ONLY and not is_rich(d):
            skipped[0] += 1
            continue
        ja_path = f'/shochu/{pref}/{d["id"]}.html'
        en_path = f'/shochu/en/{pref}/{d["id"]}.html'
        if f'{pref}:{d["id"]}' in EN_REAL:
            langs = {'ja': ja_path, 'en': en_path, 'x-default': ja_path}
            add(ja_path, '0.6', 'monthly', langs)
            add(en_path, '0.6', 'monthly', langs)
        else:
            # 殻ENページはnoindexのためsitemapから除外（EN本物化したら戻す）
            langs = {'ja': ja_path, 'x-default': ja_path}
            add(ja_path, '0.6', 'monthly', langs)

# Build XML
xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>']
xml_parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">')

for u in urls:
    xml_parts.append('  <url>')
    xml_parts.append(f'    <loc>{DOMAIN}{u["loc"]}</loc>')
    xml_parts.append(f'    <lastmod>{TODAY}</lastmod>')
    xml_parts.append(f'    <changefreq>{u["changefreq"]}</changefreq>')
    xml_parts.append(f'    <priority>{u["priority"]}</priority>')
    if u.get('langs'):
        for lang, href in u['langs'].items():
            xml_parts.append(f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{DOMAIN}{href}"/>')
    xml_parts.append('  </url>')

xml_parts.append('</urlset>')

sitemap = '\n'.join(xml_parts)
out_path = os.path.join(BASE, 'sitemap.xml')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(sitemap)

print(f"Sitemap generated: {len(urls)} URLs → sitemap.xml"
      + (f"（core方式: 中身の薄い蔵 {skipped[0]}者を除外）" if CORE_ONLY else "（--all: 全件）"))
