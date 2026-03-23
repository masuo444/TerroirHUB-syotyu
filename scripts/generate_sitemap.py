#!/usr/bin/env python3
"""
sitemap.xmlを全ページから自動生成。
"""

import json
import glob
import os
from datetime import date

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

# Guide pages
for g in GUIDE_PAGES:
    path = f'/shochu/guide/{g}.html' if g != 'index' else '/shochu/guide/'
    add(path, '0.9', 'monthly')

# Region pages
for r in REGIONS:
    add(f'/shochu/region/{r}.html', '0.8', 'monthly')

# Prefecture index + individual distillery pages
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
        ja_path = f'/shochu/{pref}/{d["id"]}.html'
        en_path = f'/shochu/en/{pref}/{d["id"]}.html'
        fr_path = f'/shochu/fr/{pref}/{d["id"]}.html'
        langs = {'ja': ja_path, 'en': en_path, 'fr': fr_path}
        add(ja_path, '0.6', 'monthly', langs)
        add(en_path, '0.5', 'monthly', langs)
        add(fr_path, '0.5', 'monthly', langs)

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

print(f"Sitemap generated: {len(urls)} URLs → sitemap.xml")
