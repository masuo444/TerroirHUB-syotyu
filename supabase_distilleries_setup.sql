-- ============================================================
-- Terroir HUB SHOCHU — Supabase スキーマ拡張
-- 既存の日本酒版Supabaseに追加で実行
-- 将来のジャンル追加（ウイスキー等）にも対応する設計
-- ============================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. distilleries テーブル（焼酎・泡盛の蒸留所データ）
--    breweries テーブルと同構造 + 焼酎固有カラム
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS distilleries (
  id text PRIMARY KEY,                    -- URLスラッグ (例: kirishima-shuzo)
  prefecture text NOT NULL,               -- 県slug (例: kagoshima)
  name text NOT NULL,                     -- 蒸留所名
  company text,                           -- 会社名
  brand text,                             -- 代表銘柄名
  founded text,                           -- 創業年（西暦）
  founded_era text,                       -- 創業年（和暦）
  address text,                           -- 住所
  tel text,                               -- 電話番号
  url text,                               -- 公式サイトURL
  area text,                              -- 市区町村
  "desc" text,                            -- 紹介文
  visit text,                             -- 見学情報
  brands jsonb DEFAULT '[]',              -- 代表銘柄 [{name, type, specs, ingredient}, ...]
  features jsonb DEFAULT '[]',            -- 特徴 ["特徴1", "特徴2", ...]
  nearest_station text,                   -- 最寄り駅
  source text,                            -- 情報ソースURL
  lat double precision,                   -- GPS緯度
  lng double precision,                   -- GPS経度
  -- 焼酎固有カラム
  spirit_type text DEFAULT 'honkaku',     -- honkaku / awamori / korui
  koji_type text,                         -- 黒麹 / 白麹 / 黄麹
  main_ingredient text,                   -- sweet_potato / barley / rice / brown_sugar / buckwheat / awamori
  -- 管理用
  visit_info jsonb DEFAULT '{}',          -- 見学詳細
  photos jsonb DEFAULT '[]',              -- 写真URL
  custom jsonb DEFAULT '{}',              -- カスタマイズ
  plan text DEFAULT 'none',               -- 契約プラン
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. 統合ビュー: 全ジャンルのプロデューサーを横断検索
--    将来ウイスキー等が追加されたらUNION ALLを追加するだけ
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE VIEW all_producers AS
  SELECT
    id, prefecture, name, company, brand, founded, address, url, area,
    "desc", brands, features, lat, lng,
    'sake' AS category,
    NULL AS spirit_type,
    NULL AS koji_type,
    NULL AS main_ingredient,
    plan, updated_at
  FROM breweries
  UNION ALL
  SELECT
    id, prefecture, name, company, brand, founded, address, url, area,
    "desc", brands, features, lat, lng,
    CASE WHEN spirit_type = 'awamori' THEN 'awamori' ELSE 'shochu' END AS category,
    spirit_type,
    koji_type,
    main_ingredient,
    plan, updated_at
  FROM distilleries;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. 既存テーブルに source カラムを追加（ジャンル横断対応）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- favorites に source 追加
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS source text DEFAULT 'sake';

-- stamps に source 追加
ALTER TABLE stamps ADD COLUMN IF NOT EXISTS source text DEFAULT 'sake';

-- ai_logs に source 追加（既にある場合はスキップ）
ALTER TABLE ai_logs ADD COLUMN IF NOT EXISTS source text DEFAULT 'sake';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. RLS（行レベルセキュリティ）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE distilleries ENABLE ROW LEVEL SECURITY;

-- 誰でも読める
CREATE POLICY "Anyone can read distilleries"
  ON distilleries FOR SELECT
  USING (true);

-- 蒸留所オーナーは自分の蒸留所だけ更新
CREATE POLICY "Distillery owners can update own"
  ON distilleries FOR UPDATE
  USING (
    id IN (
      SELECT brewery_id FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('brewery', 'admin')
    )
  );

-- 管理者は全て操作可能
CREATE POLICY "Admins can insert distilleries"
  ON distilleries FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can update all distilleries"
  ON distilleries FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. updated_at 自動更新トリガー
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION update_distillery_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_distillery_updated_at
  BEFORE UPDATE ON distilleries
  FOR EACH ROW
  EXECUTE FUNCTION update_distillery_timestamp();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. Storage バケット（蒸留所写真用）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('distillery-photos', 'distillery-photos', true, 5242880)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Distillery owners can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'distillery-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT brewery_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('brewery', 'admin')
    )
  );

CREATE POLICY "Anyone can view distillery photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'distillery-photos');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. profiles テーブル拡張（ジャンル横断対応）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS category text DEFAULT 'sake';
-- category: sake / shochu / admin（adminは全ジャンル管理可能）

-- bonus_credits カラム追加（既にある場合はスキップ）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bonus_credits integer DEFAULT 0;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 将来のジャンル追加手順（例：ウイスキー）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. whisky_distilleries テーブルを作成（distilleriesと同構造 + ウイスキー固有カラム）
-- 2. all_producers ビューに UNION ALL を追加
-- 3. Storage バケット 'whisky-photos' を作成
-- 4. admin/index.html に WHISKY タブを追加
-- 5. build_sakura_kb.py にウイスキーデータ読み込みを追加
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
