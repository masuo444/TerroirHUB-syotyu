# Terroir HUB SHOCHU — エージェント作業マニュアル

## プロジェクト概要
全国約970蒸留所の焼酎・泡盛データベース。47都道府県カバー（主要産地：鹿児島120蔵・熊本49蔵・沖縄48蔵・宮崎45蔵・大分36蔵）。
デプロイ先: （未設定）
GitHub: （未設定）
姉妹サイト: https://sake.terroirhub.com/（日本酒版）

## ファイル構成

```
/Users/masuo/Desktop/terroirHUB 焼酎/
├── index.html                          # トップページ
├── RULES.md                            # 情報正確性ルール（必読）
├── CLAUDE.md                           # このファイル
├── template_shochu.html                # CSSテンプレート（蒸留所ページ用）
├── data/
│   └── data_{県slug}_distilleries.json # 各県の蒸留所データ
├── shochu/
│   ├── sakura_kb.json                  # AIサクラ ナレッジベース
│   ├── track.js                        # 行動データ取得スクリプト
│   ├── region/                         # 8地域ページ
│   │   ├── hokkaido.html
│   │   ├── tohoku.html
│   │   ├── kanto.html
│   │   ├── chubu.html
│   │   ├── kinki.html
│   │   ├── chugoku.html
│   │   ├── shikoku.html
│   │   └── kyushu.html
│   ├── guide/                          # 教科書ページ
│   │   ├── index.html                  # 焼酎・泡盛の基礎
│   │   ├── types.html                  # 種類（芋・麦・米・黒糖・泡盛等）
│   │   ├── production.html             # 蒸留・麹の製法
│   │   ├── drinking.html               # 飲み方（お湯割り・ロック・水割り等）
│   │   ├── pairing.html                # 料理ペアリング
│   │   ├── history.html                # 歴史（500年の蒸留酒文化）
│   │   ├── awamori.html                # 泡盛とは（独立教科書ページ）
│   │   └── glossary.html               # 用語集
│   ├── en/                             # 英語版
│   ├── fr/                             # フランス語版
│   └── {県slug}/                       # 各県ディレクトリ
│       ├── index.html                  # 県一覧ページ
│       └── {distillery_id}.html        # 個別蒸留所ページ
├── admin/
│   └── index.html                      # 管理ダッシュボード
├── api/
│   ├── sakura.js                       # Claude AI プロキシ（AIサクラ）
│   ├── create-checkout.js              # Stripe決済
│   └── webhook.js                      # Stripeウェブフック
├── scripts/
│   ├── regenerate_all_pages.py         # 全蒸留所ページ一括生成
│   ├── generate_multilang_pages.py     # 多言語版生成
│   └── build_sakura_kb.py              # AIナレッジベース構築
├── vercel.json
├── robots.txt
├── sitemap.xml
└── package.json
```

## データ形式（JSON）

各`data/{県slug}_distilleries.json`は配列。1蒸留所あたり:

```json
{
  "id": "kirishima",
  "name": "霧島酒造",
  "company": "霧島酒造（株）",
  "brand": "黒霧島",
  "type": "芋焼酎",
  "founded": "1916",
  "founded_era": "大正5年",
  "address": "宮崎県都城市下川東4丁目28-1",
  "tel": "0986-22-2100",
  "url": "https://www.kirishima.co.jp/",
  "area": "都城市",
  "desc": "大正5年（1916年）創業。南九州の豊かな自然と都城盆地の清らかな水で芋焼酎を醸す。",
  "visit": "霧島ファクトリーガーデンにて工場見学可（要予約）",
  "spirit_type": "honkaku",
  "koji_type": "黒麹",
  "main_ingredient": "sweet_potato",
  "brands": [
    {
      "name": "黒霧島",
      "type": "芋焼酎",
      "specs": "黒麹仕込み、アルコール25度",
      "ingredient": "黄金千貫（芋）"
    },
    {
      "name": "赤霧島",
      "type": "芋焼酎",
      "specs": "ムラサキマサリ使用、アルコール25度",
      "ingredient": "ムラサキマサリ（芋）"
    }
  ],
  "features": [
    "都城盆地の地下水「霧島裂罅水」を仕込み水に使用",
    "芋焼酎売上日本一（2003年〜）",
    "霧島ファクトリーガーデンで工場見学・ショップ併設"
  ],
  "nearest_station": "JR日豊本線 都城駅（タクシー約10分）",
  "source": "https://www.kirishima.co.jp/company/",
  "lat": 31.7167,
  "lng": 131.0667,
  "name_en": "Kirishima Shuzo"
}
```

### 日本酒版との差分フィールド
| フィールド | 説明 | 例 |
|-----------|------|-----|
| `spirit_type` | honkaku（本格焼酎）/ awamori（泡盛）/ korui（甲類） | "honkaku" |
| `koji_type` | 麹の種類 | "黒麹" / "白麹" / "黄麹" |
| `main_ingredient` | 主原料コード | "sweet_potato" / "barley" / "rice" / "brown_sugar" / "buckwheat" |
| `brands[].ingredient` | 銘柄ごとの原料品種 | "黄金千貫（芋）" |

## 品質ランク定義

| ランク | 条件 | 状態 |
|--------|------|------|
| A | founded + brands(1〜3銘柄) + features(2+) + url + spirit_type | 完全版 |
| B | founded + brands or features あるがURL無し or spirit_type未設定 | 要改善 |
| C | foundedのみ | 最低限 |
| D | 何もなし | 対象外 |

**目標: 主要産地（鹿児島・宮崎・大分・沖縄）は全蔵Aランク**

## AIコンシェルジュ「サクラ」（日本酒版と共通）

全Terroir HUBサイト共通のAIコンシェルジュ「サクラ」。
- 知識ベース: `shochu/sakura_kb.json`
- API: `/api/sakura.js`
- キャラクター: 焼酎の奥深さを語る、落ち着いた案内人

## 焼酎の種類（原料別分類）

| コード | 日本語 | 英語 | 主要産地 |
|--------|--------|------|----------|
| sweet_potato | 芋焼酎 | Imo (Sweet Potato) | 鹿児島・宮崎 |
| barley | 麦焼酎 | Mugi (Barley) | 大分・長崎 |
| rice | 米焼酎 | Kome (Rice) | 熊本・大分 |
| brown_sugar | 黒糖焼酎 | Kokuto (Brown Sugar) | 奄美大島 |
| buckwheat | そば焼酎 | Soba (Buckwheat) | 宮崎 |
| awamori | 泡盛 | Awamori | 沖縄 |
| kasutori | 粕取り焼酎 | Kasutori (Sake Lees) | 全国 |
| mixed | 混和焼酎 | Blended | 全国 |

## データソース（蒸留所リスト取得元）

### 県酒造組合サイト（一次ソース）
| 県 | URL | 蔵数 |
|---|---|---|
| 鹿児島 | https://www.honkakushochu.or.jp/kuramoto/ | 120 |
| 宮崎 | https://www.dareyami.jp/brewery/ | 34-45 |
| 大分 | https://oita-sake.or.jp/kuramoto/ | 33-36 |
| 熊本（球磨） | https://kumashochu.or.jp/map/ | 27 |
| 沖縄 | https://www.awamori.or.jp/ | 47-48 |
| 長崎（壱岐） | https://ikishouchu.com/product/ | 7 |
| 福岡 | http://fukuoka-sake.org/map/ | ~50 |
| 佐賀 | https://sagasake.jp/ | 10 |

### 全国データソース
| ソース | URL | 備考 |
|---|---|---|
| 国税庁 酒蔵マップ | https://www.nta.go.jp/taxes/sake/sakagura/index.htm | 公式データ |
| 日本酒造組合中央会 | https://www.honkakushochu-awamori.jp/ | 全国ポータル |
| おきなわ物語 泡盛一覧 | https://www.okinawastory.jp/feature/awamori/list | 泡盛全蔵 |
| 泡盛新聞 酒造所一覧 | https://awamori-news.co.jp/酒造所一覧/ | 泡盛詳細 |

### GI（地理的表示）保護地域
| GI名 | 地域 | 種類 |
|---|---|---|
| 薩摩 | 鹿児島県（奄美除く） | 芋焼酎 |
| 球磨 | 熊本県球磨郡・人吉市 | 米焼酎 |
| 壱岐 | 長崎県壱岐島 | 麦焼酎 |
| 琉球 | 沖縄県 | 泡盛 |

## 絶対にやってはいけないこと

1. **情報を捏造しない** — 公式サイトにない情報は入れない
2. **推測で埋めない** — 分からない項目は空欄のまま
3. **AIが文章を生成しない** — 説明文は公式サイトの文言を使う
4. **他の蒸留所のデータを混同しない** — IDと蔵名を必ず照合
5. **泡盛を焼酎の「おまけ」扱いしない** — 泡盛は独自文化として第一級に扱う
6. **brandsにspecs=""で入れて「完了」と言わない** — 実データがないならBランクと正直に報告

## 県slugマッピング

```
hokkaido aomori iwate miyagi akita yamagata fukushima
ibaraki tochigi gunma saitama chiba tokyo kanagawa
niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi
mie shiga kyoto osaka hyogo nara wakayama
tottori shimane okayama hiroshima yamaguchi
tokushima kagawa ehime kochi
fukuoka saga nagasaki kumamoto oita miyazaki kagoshima okinawa
```
