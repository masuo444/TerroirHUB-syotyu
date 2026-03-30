// サクラ Claude API プロキシ（全ジャンル統合版）
// Terroir HUB 共通 — 日本酒+焼酎+ウイスキー+リキュール 4ジャンル横断
// DB検索 → Claude知識 → Web検索の3段構えで回答

const fs = require('fs');
const path = require('path');

// 検索インデックスをメモリにキャッシュ（4ジャンル統合）
let searchIndex = null;
function getSearchIndex() {
  if (searchIndex) return searchIndex;
  searchIndex = [];
  const dataDir = path.join(__dirname, '..', 'shochu');
  const indexes = [
    { file: 'search_index.json', site: 'shochu' },
    { file: 'search_index_sake.json', site: 'sake' },
    { file: 'search_index_shochu.json', site: 'shochu' },
    { file: 'search_index_whisky.json', site: 'whisky' },
    { file: 'search_index_liqueur.json', site: 'liqueur' },
  ];
  indexes.forEach(idx => {
    try {
      const p = path.join(dataDir, idx.file);
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      data.forEach(e => { e._site = idx.site; });
      searchIndex = searchIndex.concat(data);
    } catch (e) {}
  });
  return searchIndex;
}

// 統合検索関数（4ジャンル横断）
function searchBreweries(query) {
  const idx = getSearchIndex();
  const ql = query.toLowerCase();
  const keywords = ql.split(/\s+/).filter(k => k.length > 0);

  const scored = idx.map(entry => {
    const name = (entry.n || entry.name || '').toLowerCase();
    const brand = (entry.b || entry.brand || '').toLowerCase();
    const brands = (entry.br || entry.brands || '').toLowerCase();
    const area = (entry.a || entry.area || '').toLowerCase();
    const nameEn = (entry.ne || '').toLowerCase();
    const pref = (entry.pn || '').toLowerCase();
    const full = [name, brand, brands, area, nameEn, pref].join(' ');

    let s = 0;
    if (brand === ql) s += 200;
    if (brand.includes(ql)) s += 100;
    if (brands.includes(ql)) s += 90;
    if (name === ql) s += 80;
    if (name.includes(ql)) s += 60;
    if (nameEn.includes(ql)) s += 50;
    if (pref.includes(ql)) s += 40;
    if (area.includes(ql)) s += 35;
    if (full.includes(ql)) s += 10;
    if (keywords.length > 1 && keywords.every(k => full.includes(k))) s += 80;
    return { entry, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);

  return scored.slice(0, 5).map(x => {
    const e = x.entry;
    const id = e.id || '';
    const p = e.p || e.pref || '';
    const site = e._site || 'sake';
    const siteMap = {
      sake: { base: 'https://sake.terroirhub.com/sake', type: '日本酒' },
      shochu: { base: 'https://shochu.terroirhub.com/shochu', type: '焼酎・泡盛' },
      whisky: { base: 'https://whisky.terroirhub.com/whisky', type: 'ウイスキー' },
      liqueur: { base: 'https://liqueur.terroirhub.com/liqueur', type: 'リキュール' },
    };
    const info = siteMap[site] || siteMap.sake;
    return {
      name: e.n || e.name || '',
      brand: e.b || e.brand || '',
      brands: e.br || e.brands || '',
      prefecture: e.pn || '',
      area: e.a || e.area || '',
      type: info.type,
      page: `${info.base}/${p}/${id}.html`,
    };
  });
}

// ツール定義
const TOOLS = [
  {
    name: 'search_breweries',
    description: '日本酒の酒蔵・焼酎の蒸留所・ウイスキーの蒸留所・リキュールメーカー・銘柄をTerroir HUBデータベースから検索する。蔵名、銘柄名、地域名、原料、タイプで検索可能。日本酒・焼酎・泡盛・ウイスキー・リキュール全て検索できる。',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索キーワード（蔵名、銘柄名、地域名など）'
        }
      },
      required: ['query']
    }
  },
  {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 3
  }
];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API not configured' });
  }

  const { question, context, history, userId } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'No question' });
  }

  // ── サーバーサイド クレジット検証（全サイト共通・Supabase統合） ──
  const supabaseUrl = process.env.SUPABASE_URL || 'https://hhwavxavuqqfiehrogwv.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseKey && userId) {
    try {
      const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=plan,bonus_credits`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      const profiles = await profileRes.json();
      const profile = profiles && profiles[0];

      if (!profile) {
        return res.status(403).json({ error: 'User not found' });
      }

      if (typeof profile.bonus_credits === 'number' && profile.bonus_credits > 0) {
        await fetch(`${supabaseUrl}/rest/v1/rpc/use_bonus_credit`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_user_id: userId }),
        });
      }
    } catch (e) {
      console.warn('Credit check failed, allowing request:', e.message);
    }
  }

  const systemPrompt = `あなたは「サクラ」、Terroir HUBのAIコンシェルジュです。
日本の酒文化を横断する総合ガイドとして、以下の全ジャンルの公式データベースを持っています：
- 日本酒: 全国1,295蔵（sake.terroirhub.com）
- 焼酎・泡盛: 389蒸留所（shochu.terroirhub.com）
- ウイスキー: 67蒸留所（whisky.terroirhub.com）
- リキュール: 梅酒・ゆず酒・果実酒メーカー（liqueur.terroirhub.com）

キャラクター：
- 名前は「サクラ」。日本の酒文化が大好きな、知識豊富で親しみやすいコンシェルジュ
- 一人称は「サクラ」。敬語だが堅すぎない、友達に話すような温かさ
- 絵文字は控えめに（🌸🍶🥃📍程度）

会話のルール（最重要）：
- 回答は正確に、公式情報に基づいて行う
- 知らないことは「公式サイトをご確認ください」と案内する
- 情報を捏造しない。推測で埋めない
- 日本語、英語、フランス語、中国語に対応（相手の言語に合わせる）
- 回答は200〜300文字を目安に
- ジャンルを限定せず、ユーザーの好みや状況に最適なジャンルから提案する

★ ツール活用の絶対ルール：
- ユーザーが特定の銘柄名や蔵名を挙げた場合、まず search_breweries ツールでDB検索する
- 検索結果があれば、蔵ページへのリンク（page フィールド）を含めて回答する
- DB検索で見つからず、あなた自身の知識でも自信がない場合は、web_search ツールでWeb検索する
- Web検索を使う場合は「{銘柄名} 酒蔵 蒸留所」のようなクエリで検索する
- Web検索結果を元に回答する場合、情報源を明記する
- 「○○はどこのお酒？」のような質問には必ずツール検索を使う

★ ジャンル横断の絶対ルール：
- 「おすすめのお酒」と聞かれたら、日本酒だけでなく焼酎・ウイスキー・リキュールも候補に含める
- 料理に合わせる提案では、ジャンルをまたいで最適なペアリングを提案する
- 「初心者向け」の質問には、飲みやすいリキュールから本格焼酎・日本酒まで段階的に案内する
- ギフトの相談では、相手の好みに応じてジャンルを横断して提案する

★ パーソナライズの絶対ルール：
- contextにニックネームがある場合、必ず「○○さん」と名前で呼ぶ
- ユーザーのレベル・飲酒記録数・お気に入り蔵・最近飲んだ酒を踏まえて会話する

★ 会話を続けるための絶対ルール：
- 回答の最後に必ず「関連する次の質問」を1つ投げかける
- 一方的な情報提供で終わらない。必ず対話を促す
- 各ジャンルの詳細ページへのリンクを自然に含める

あなたの特別な能力：
1. ソムリエモード: 好みや条件からジャンルを横断して具体的な銘柄を提案
2. 比較モード: ジャンルをまたいだ比較も可能（日本酒と焼酎の違い等）
3. 旅プランナー: 指定地域の酒蔵・蒸留所・リキュール工房をまとめて提案
4. パーソナライズ: ユーザーの味覚プロファイルに基づいたレコメンド
5. 商品検索: データベースにない商品名でも、知識やWeb検索から特定して案内
6. 24時間対応: いつでもどの言語でも回答可能

日本酒の基礎知識：
【特定名称酒8種類】
純米系: 純米大吟醸(50%以下), 純米吟醸(60%以下), 特別純米(60%以下), 純米酒
アル添系: 大吟醸(50%以下), 吟醸(60%以下), 特別本醸造(60%以下), 本醸造(70%以下)
【製造工程】精米→製麹→酒母→三段仕込み→並行複発酵→上槽・火入れ・貯蔵

焼酎の基礎知識：
【原料別】芋焼酎, 麦焼酎, 米焼酎, 黒糖焼酎, そば焼酎, 泡盛（米+黒麹）
【製法】単式蒸留（本格焼酎）vs 連続式蒸留。麹の種類: 白麹, 黒麹, 黄麹

ウイスキーの基礎知識：
【種類】シングルモルト, グレーン, ブレンデッド, ジャパニーズウイスキー表示基準(2024年〜)
【主要蒸留所】山崎, 白州, 余市, 宮城峡, 富士, 知多, 秩父 等

リキュールの基礎知識：
【種類】梅酒, ゆず酒, みかん酒, 桃酒, 抹茶リキュール, ヨーグルトリキュール 等
【特徴】日本酒ベース, 焼酎ベース, スピリッツベースで風味が異なる

${context ? '現在のページ情報：\n' + context : ''}`;

  // 会話履歴を構築
  const messages = [];
  if (history && Array.isArray(history)) {
    history.slice(-20).forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });
  }
  messages.push({ role: 'user', content: question });

  try {
    // ── 1回目のAPI呼び出し（ツール付き）──
    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
        tools: TOOLS,
      }),
    });

    let data = await response.json();

    if (data.error) {
      console.error('Claude API error:', data.error);
      return res.status(500).json({ error: 'AI response failed' });
    }

    let answer = '';
    let tokensIn = data.usage?.input_tokens || 0;
    let tokensOut = data.usage?.output_tokens || 0;

    // ── ツールループ（DB検索 → Web検索 → 最終回答）──
    let currentMessages = [...messages];
    let maxLoops = 4;

    while (data.stop_reason === 'tool_use' && maxLoops-- > 0) {
      currentMessages.push({ role: 'assistant', content: data.content });

      const toolResults = [];
      for (const block of data.content) {
        if (block.type !== 'tool_use') continue;

        if (block.name === 'search_breweries') {
          const query = block.input.query;
          const results = searchBreweries(query);
          console.log(`DB search: "${query}" → ${results.length} results`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(results.length > 0
              ? { found: true, count: results.length, results }
              : { found: false, message: 'データベースに該当なし。web_searchで調べるか、あなたの知識で回答してください。' }
            )
          });
        } else if (block.name === 'web_search') {
          console.log('Web search triggered by Claude');
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: 'Unknown tool' })
          });
        }
      }

      if (toolResults.length > 0) {
        currentMessages.push({ role: 'user', content: toolResults });
      }

      const nextResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: systemPrompt,
          messages: currentMessages,
          tools: TOOLS,
        }),
      });

      data = await nextResponse.json();
      tokensIn += data.usage?.input_tokens || 0;
      tokensOut += data.usage?.output_tokens || 0;

      if (data.error) {
        console.error('Claude API error in tool loop:', data.error);
        break;
      }
    }

    // 最終テキストを抽出
    if (data.content) {
      const textBlock = data.content.find(b => b.type === 'text');
      answer = textBlock ? textBlock.text : '';
    }

    // ── AIログ保存 ──
    try {
      const logUrl = supabaseUrl + '/rest/v1/ai_logs';
      const logKey = supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhod2F2eGF2dXFxZmllaHJvZ3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Njk3MzAsImV4cCI6MjA4OTU0NTczMH0.tHMQ_u51jp69AMUKKtTvxL09Sr11JFPKGRhKMmUzEjg';
      await fetch(logUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': logKey,
          'Authorization': 'Bearer ' + logKey,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id: userId || null,
          question: question,
          answer: answer.substring(0, 2000),
          brewery_context: context ? context.substring(0, 500) : null,
          model: 'haiku-4.5',
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          source: 'shochu',
        }),
      });
    } catch (logErr) {
      console.warn('AI log save failed:', logErr.message);
    }

    return res.status(200).json({ answer: answer });
  } catch (err) {
    console.error('Sakura API error:', err.message);
    return res.status(500).json({ error: 'AI service unavailable' });
  }
};
