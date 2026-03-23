// サクラ Claude API プロキシ（統合版 + ツール検索）
// 日本酒・焼酎・泡盛の全知識を持つAIコンシェルジュ
// DBにない銘柄でもClaudeの知識 + Supabase検索で回答可能

const fs = require('fs');
const path = require('path');

// 検索インデックスをメモリにキャッシュ
let searchIndex = null;
function getSearchIndex() {
  if (searchIndex) return searchIndex;
  try {
    const indexPath = path.join(__dirname, '..', 'shochu', 'search_index.json');
    searchIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch (e) {
    searchIndex = [];
  }
  return searchIndex;
}

// ローカル検索関数
function searchDistilleries(query) {
  const idx = getSearchIndex();
  const ql = query.toLowerCase();
  const keywords = ql.split(/\s+/).filter(k => k.length > 0);

  const scored = idx.map(entry => {
    const fl = (entry.f || '').toLowerCase();
    let s = 0;
    if (entry.b && entry.b === query) s += 200;
    if (entry.b && entry.b.toLowerCase().includes(ql)) s += 100;
    if (entry.br && entry.br.toLowerCase().includes(ql)) s += 90;
    if (entry.n && entry.n.includes(query)) s += 80;
    if (entry.n && entry.n.toLowerCase().includes(ql)) s += 60;
    if (entry.ne && entry.ne.toLowerCase().includes(ql)) s += 50;
    if (entry.pn && entry.pn.includes(ql)) s += 40;
    if (entry.t && entry.t.includes(ql)) s += 30;
    if (entry.k && entry.k.includes(ql)) s += 25;
    if (fl.includes(ql)) s += 10;
    if (keywords.length > 1) {
      if (keywords.every(k => fl.includes(k))) s += 80;
    }
    return { entry, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);

  return scored.slice(0, 5).map(x => ({
    name: x.entry.n,
    brand: x.entry.b,
    brands: x.entry.br,
    prefecture: x.entry.pn,
    area: x.entry.a,
    type: x.entry.t,
    koji: x.entry.k,
    founded: x.entry.fd,
    page: `/shochu/${x.entry.p}/${x.entry.id}.html`,
  }));
}

// ツール定義
const TOOLS = [
  {
    name: 'search_distilleries',
    description: '焼酎・泡盛の蒸留所や銘柄をデータベースから検索する。蒸留所名、銘柄名、地域名、原料（芋焼酎、麦焼酎等）、麹の種類で検索可能。ユーザーが特定の銘柄や蒸留所について質問した場合に使う。',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索キーワード（蒸留所名、銘柄名、地域名、原料名など）'
        }
      },
      required: ['query']
    }
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
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseKey && userId) {
    try {
      const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=plan,bonus_credits`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      const profiles = await profileRes.json();
      const profile = profiles && profiles[0];
      if (profile && typeof profile.bonus_credits === 'number' && profile.bonus_credits > 0) {
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
日本酒（全国1,295蔵）、焼酎（341蒸留所）、泡盛（48蒸留所）の全データベースを熟知しています。

キャラクター：
- 名前は「サクラ」。日本の酒が大好きな、知識豊富で親しみやすいコンシェルジュ
- 一人称は「サクラ」。敬語だが堅すぎない、友達に話すような温かさ
- 絵文字は控えめに（🌸🍶🏺📍程度）

会話のルール（最重要）：
- 回答は正確に、公式情報に基づいて行う
- 知らないことは「公式サイトをご確認ください」と案内する
- 情報を捏造しない。推測で埋めない
- 日本語、英語、フランス語に対応（相手の言語に合わせる）
- 回答は200〜300文字を目安に

★ ツール活用の絶対ルール：
- ユーザーが特定の銘柄名や蒸留所名を挙げた場合、必ず search_distilleries ツールで検索する
- 検索結果があれば、蒸留所ページへのリンク（page フィールド）を含めて回答する
- 検索結果がなくても、あなた自身の知識で回答してよい（ただしデータベースにない旨を伝える）
- 「○○はどこの焼酎？」「○○を作っているのは？」のような質問には必ずツール検索を使う

★ 会話を続けるための絶対ルール：
- 回答の最後に必ず「関連する次の質問」を1つ投げかける
- 一方的な情報提供で終わらない。必ず対話を促す

あなたの特別な能力：
1. ソムリエモード: 好みや条件から日本酒・焼酎・泡盛を提案
2. 比較モード: 日本酒と焼酎の違い、芋と麦の違い等をわかりやすく
3. 旅プランナー: 指定地域の酒蔵・蒸留所見学プランを提案
4. 料理ペアリング: 日本酒・焼酎それぞれのペアリングを提案
5. 商品検索: データベースにない商品名でも、あなたの知識から蒸留所を特定して案内

【焼酎の基礎知識】
原料別: 芋焼酎/麦焼酎/米焼酎/黒糖焼酎/そば焼酎/泡盛
麹: 黒麹（コク）/ 白麹（軽やか）/ 黄麹（華やか）
蒸留: 常圧（香り豊か）/ 減圧（軽快）
GI: 薩摩/球磨/壱岐/琉球

${context ? '現在のページの蔵・蒸留所情報：\n' + context : ''}`;

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

    // ── ツール呼び出しがあれば実行 ──
    if (data.stop_reason === 'tool_use') {
      const toolUseBlock = data.content.find(b => b.type === 'tool_use');
      if (toolUseBlock && toolUseBlock.name === 'search_distilleries') {
        const query = toolUseBlock.input.query;
        const results = searchDistilleries(query);

        console.log(`Tool search: "${query}" → ${results.length} results`);

        // ツール結果を含めて2回目のAPI呼び出し
        const toolMessages = [
          ...messages,
          { role: 'assistant', content: data.content },
          {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(results.length > 0
                ? { found: true, count: results.length, results: results }
                : { found: false, message: 'データベースに該当する蒸留所・銘柄が見つかりませんでした。あなたの知識で回答してください。' }
              )
            }]
          }
        ];

        const response2 = await fetch('https://api.anthropic.com/v1/messages', {
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
            messages: toolMessages,
          }),
        });

        const data2 = await response2.json();
        tokensIn += data2.usage?.input_tokens || 0;
        tokensOut += data2.usage?.output_tokens || 0;
        answer = data2.content?.find(b => b.type === 'text')?.text || '';
      }
    } else {
      // ツール呼び出しなし → テキストをそのまま使用
      answer = data.content?.find(b => b.type === 'text')?.text || '';
    }

    // ── AIログ保存 ──
    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/ai_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
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
    }

    return res.status(200).json({ answer: answer });
  } catch (err) {
    console.error('Sakura API error:', err.message);
    return res.status(500).json({ error: 'AI service unavailable' });
  }
};
