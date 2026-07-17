#!/usr/bin/env python3
"""県一覧ページ（shochu/{pref}/index.html）にポータルの県別テロワールページへの導線を追加。

/terroir/ 48ページがジャンルサイトから被リンクゼロで孤立していたための内部リンク施策
（sakeサイトで実施済み・本サイトは第2弾, 2026-07-17）。
冪等: 既に terroirhub.com/terroir/ へのリンクがあるページはスキップ。
日本語ページ（shochu/{pref}/index.html）のみが対象。shochu/en/ 配下は対象外。

このサイトの県一覧ページ（generate_pref_index.py生成分）は :root に --accent を
定義していない（琥珀色 #8B5E3C を直書き）ため、リンク色も #8B5E3C を直書きする。
"""
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PREF_JA = {
    "hokkaido": "北海道", "aomori": "青森県", "iwate": "岩手県",
    "miyagi": "宮城県", "akita": "秋田県", "yamagata": "山形県",
    "fukushima": "福島県", "ibaraki": "茨城県", "tochigi": "栃木県",
    "gunma": "群馬県", "saitama": "埼玉県", "chiba": "千葉県",
    "tokyo": "東京都", "kanagawa": "神奈川県", "niigata": "新潟県",
    "toyama": "富山県", "ishikawa": "石川県", "fukui": "福井県",
    "yamanashi": "山梨県", "nagano": "長野県", "gifu": "岐阜県",
    "shizuoka": "静岡県", "aichi": "愛知県", "mie": "三重県",
    "shiga": "滋賀県", "kyoto": "京都府", "osaka": "大阪府",
    "hyogo": "兵庫県", "nara": "奈良県", "wakayama": "和歌山県",
    "tottori": "鳥取県", "shimane": "島根県", "okayama": "岡山県",
    "hiroshima": "広島県", "yamaguchi": "山口県", "tokushima": "徳島県",
    "kagawa": "香川県", "ehime": "愛媛県", "kochi": "高知県",
    "fukuoka": "福岡県", "saga": "佐賀県", "nagasaki": "長崎県",
    "kumamoto": "熊本県", "oita": "大分県", "miyazaki": "宮崎県",
    "kagoshima": "鹿児島県", "okinawa": "沖縄県",
}

ACCENT = "#8B5E3C"


def block(pref, name):
    url = f"https://www.terroirhub.com/terroir/{pref}.html"
    return (f'<div style="max-width:1080px;margin:36px auto 0;padding:0 24px;text-align:center;">'
            f'<a href="{url}" style="font-size:13px;color:{ACCENT};text-decoration:none;letter-spacing:0.03em;">'
            f'{name}のテロワールを見る — 日本酒・ワイン・焼酎・ウイスキーを横断 →</a></div>\n')


def main():
    done = skipped = missing = 0
    for pref, name in PREF_JA.items():
        path = os.path.join(BASE, 'shochu', pref, 'index.html')
        if not os.path.exists(path):
            missing += 1
            continue
        with open(path, encoding='utf-8') as f:
            html = f.read()
        if 'terroirhub.com/terroir/' in html:
            skipped += 1
            continue
        if '<footer' not in html:
            print(f'  ⚠ {pref}: <footer> が見つからずスキップ')
            continue
        html = html.replace('<footer', block(pref, name) + '<footer', 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
        done += 1
    print(f'追加 {done} / 既存スキップ {skipped} / ページなし {missing}')


if __name__ == '__main__':
    main()
