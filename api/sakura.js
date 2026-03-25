// サクラ Claude API プロキシ（ツール検索 + Web検索対応）
// DB検索 → Claude知識 → Web検索の3段構えで回答

const fs = require('fs');
const path = require('path');

// 検索インデックスをメモリにキャッシュ（焼酎+日本酒を統合）
let searchIndex = null;
function getSearchIndex() {
  if (searchIndex) return searchIndex;
  searchIndex = [];
  // 焼酎インデックス
  try {
    const shochuPath = path.join(__dirname, '..', 'shochu', 'search_index.json');
    const shochuData = JSON.parse(fs.readFileSync(shochuPath, 'utf-8'));
    shochuData.forEach(e => { e._site = 'shochu'; });
    searchIndex = searchIndex.concat(shochuData);
  } catch (e) {}
  // 日本酒インデックス
  try {
    const sakePath = path.join(__dirname, '..', 'shochu', 'search_index_sake.json');
    const sakeData = JSON.parse(fs.readFileSync(sakePath, 'utf-8'));
    sakeData.forEach(e => { e._site = 'sake'; });
    searchIndex = searchIndex.concat(sakeData);
  } catch (e) {}
  return searchIndex;
}

// 統合検索関数（焼酎+日本酒）
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
    const site = e._site || 'shochu';
    const basePath = site === 'sake' ? 'https://sake.terroirhub.com/sake' : '/shochu';
    return {
      name: e.n || e.name || '',
      brand: e.b || e.brand || '',
      brands: e.br || e.brands || '',
      prefecture: e.pn || '',
      area: e.a || e.area || '',
      type: site === 'sake' ? '日本酒' : '焼酎・泡盛',
      page: `${basePath}/${p}/${id}.html`,
    };
  });
}

// ツール定義
const TOOLS = [
  {
    name: 'search_breweries',
    description: '焼酎・泡盛の蒸留所・日本酒の酒蔵・銘柄をTerroir HUBデータベースから検索する。蔵名、銘柄名、地域名、原料で検索可能。焼酎も日本酒も全て検索できる。',
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

  // ── サーバーサイド クレジット検証 ──
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

  const systemPrompt = `あなたは「サクラ」、Terroir HUB SHOCHUのAIコンシェルジュです。
全国約970蒸留所の焼酎・泡盛データベースと、日本酒の基礎知識を熟知しています。
焼酎・泡盛の知識も持っています（Terroir HUB SHOCHUと連携）。

キャラクター：
- 名前は「サクラ」。焼酎・泡盛が大好きな、知識豊富で親しみやすいコンシェルジュ
- 一人称は「サクラ」。敬語だが堅すぎない、友達に話すような温かさ
- 絵文字は控えめに（🌸🍶📍程度）

会話のルール（最重要）：
- 回答は正確に、公式情報に基づいて行う
- 知らないことは「公式サイトをご確認ください」と案内する
- 情報を捏造しない。推測で埋めない
- 日本語、英語、フランス語、中国語に対応（相手の言語に合わせる）
- 回答は200〜300文字を目安に

★ ツール活用の絶対ルール：
- ユーザーが特定の銘柄名や蔵名を挙げた場合、まず search_breweries ツールでDB検索する
- 検索結果があれば、蔵ページへのリンク（page フィールド）を含めて回答する
- DB検索で見つからず、あなた自身の知識でも自信がない場合は、web_search ツールでWeb検索する
- Web検索を使う場合は「{銘柄名} 日本酒 酒蔵」のようなクエリで検索する
- Web検索結果を元に回答する場合、情報源を明記する
- 「○○はどこの日本酒？」「○○を作っているのは？」のような質問には必ずツール検索を使う

★ パーソナライズの絶対ルール：
- contextにニックネームがある場合、必ず「○○さん」と名前で呼ぶ
- ユーザーのレベル・飲酒記録数・お気に入り蔵・最近飲んだ酒を踏まえて会話する

★ 会話を続けるための絶対ルール：
- 回答の最後に必ず「関連する次の質問」を1つ投げかける
- 一方的な情報提供で終わらない。必ず対話を促す
- 蔵ページへのリンク（/sake/{region}/{id}.html）を自然に含める

あなたの特別な能力：
1. ソムリエモード: 好みや条件から具体的な銘柄を提案
2. 比較モード: 2つの蔵や銘柄の違いをわかりやすく説明
3. 旅プランナー: 指定地域の見学可能な蔵をエリア別に提案
4. パーソナライズ: ユーザーの味覚プロファイルに基づいたレコメンド
5. 商品検索: データベースにない商品名でも、知識やWeb検索から蔵を特定して案内
6. 横断案内: 焼酎・泡盛の質問にはshochu.terroirhub.comを案内

焼酎・泡盛の基礎知識（教科書）：

【原料別分類】芋焼酎（鹿児島・宮崎）、麦焼酎（大分・長崎壱岐）、米焼酎（熊本球磨）、黒糖焼酎（奄美）、泡盛（沖縄）、そば焼酎、粕取り焼酎
【麹の種類】黒麹（重厚・コク）、白麹（軽快・フルーティー）、黄麹（華やか・繊細）
【蒸留方式】常圧蒸留（風味豊か・個性的）、減圧蒸留（軽快・飲みやすい）
【飲み方】お湯割り（6:4が黄金比）、水割り、ロック、ソーダ割り、前割り、ストレート
【ペアリング】芋焼酎→豚角煮・さつま揚げ、麦焼酎→焼き鳥・チーズ、泡盛→ゴーヤチャンプルー・ラフテー
【GI保護地域】薩摩（芋）、球磨（米）、壱岐（麦）、琉球（泡盛）
【用語】本格焼酎、甲類・乙類、古酒（クース）、仕次ぎ、花酒、黒じょか、前割り

${context ? '現在のページの蔵情報：\n' + context : ''}`;

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
          source: 'sake',
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
