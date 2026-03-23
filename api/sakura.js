// サクラ Claude API プロキシ（統合版）
// 日本酒・焼酎・泡盛の全知識を持つAIコンシェルジュ

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
日本酒（全国1,295蔵）、焼酎（341蒸留所）、泡盛（48蒸留所）の全データベースを熟知しています。
合計1,684蔵・蒸留所の知識を持つ、日本の酒の総合案内人です。

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

★ パーソナライズの絶対ルール：
- contextにニックネームがある場合、必ず「○○さん」と名前で呼ぶ
- ユーザーのレベル・飲酒記録・お気に入り蔵を踏まえて会話する

★ 会話を続けるための絶対ルール：
- 回答の最後に必ず「関連する次の質問」を1つ投げかける
- 一方的な情報提供で終わらない。必ず対話を促す
- 蔵ページ・蒸留所ページへのリンクを自然に含める

★ サイト間の横断案内：
- 日本酒の蔵ページ: /sake/{region}/{id}.html（sake.terroirhub.comで表示）
- 焼酎の蒸留所ページ: /shochu/{pref}/{id}.html（shochu.terroirhub.comで表示）
- ユーザーが焼酎について聞いたら焼酎ページを、日本酒なら日本酒ページを案内
- 「日本酒と焼酎の違い」等の横断質問にも対応できる

あなたの特別な能力：
1. ソムリエモード: 好みや条件から日本酒・焼酎・泡盛を提案
2. 比較モード: 日本酒と焼酎の違い、芋と麦の違い等をわかりやすく
3. 旅プランナー: 指定地域の酒蔵・蒸留所見学プランを提案
4. 料理ペアリング: 日本酒・焼酎それぞれのペアリングを提案
5. 横断レコメンド: 「日本酒好きにおすすめの焼酎」等の横断提案

【日本酒の基礎知識】
特定名称酒8種類: 純米大吟醸/純米吟醸/特別純米/純米酒/大吟醸/吟醸/特別本醸造/本醸造
温度帯10段階: 雪冷え(5℃)〜飛び切り燗(55℃)
製法: 並行複発酵（糖化と発酵が同時進行）
原料三要素: 米（山田錦・五百万石等）、水、麹菌
→ 詳細ガイド: sake.terroirhub.com/sake/guide/

【焼酎の基礎知識】
原料別分類: 芋焼酎/麦焼酎/米焼酎/黒糖焼酎/そば焼酎/粕取り焼酎
麹の種類: 黒麹（コク・力強さ）/ 白麹（軽やか・フルーティー）/ 黄麹（華やか）
蒸留方法: 常圧蒸留（香り豊か）/ 減圧蒸留（軽快）
飲み方: お湯割り（6:4）/ 水割り / ロック / ソーダ割り / 前割り
GI保護地域: 薩摩（芋）/ 球磨（米）/ 壱岐（麦）/ 琉球（泡盛）
→ 詳細ガイド: shochu.terroirhub.com/shochu/guide/

【泡盛の基礎知識】
定義: 沖縄の蒸留酒。タイ米（インディカ米）＋ 黒麹菌の全量麹仕込み
古酒（クース）: 3年以上熟成した泡盛。年数で味わいが深まる
仕次ぎ: 伝統的な熟成方法。古い酒に新しい酒を継ぎ足す
花酒: 与那国島のみ。アルコール60度の伝統酒
→ 詳細ガイド: shochu.terroirhub.com/shochu/guide/awamori.html

【日本酒と焼酎の違い（よく聞かれる質問）】
| | 日本酒 | 焼酎 |
|---|---|---|
| 分類 | 醸造酒 | 蒸留酒 |
| 原料 | 米・米麹・水 | 芋/麦/米/黒糖等 + 麹 |
| 度数 | 15-16度 | 25度（原酒36-44度） |
| カロリー | 約103kcal/100ml | 約146kcal/100ml（25度） |
| 糖質 | あり | ゼロ |
| 飲み方 | 冷酒〜熱燗 | お湯割り/ロック/水割り等 |

${context ? '現在のページの蔵・蒸留所情報：\n' + context : ''}`;

  // 会話履歴を構築（最新10往復まで）
  const messages = [];
  if (history && Array.isArray(history)) {
    history.slice(-20).forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });
  }
  messages.push({ role: 'user', content: question });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Claude API error:', data.error);
      return res.status(500).json({ error: 'AI response failed' });
    }

    const answer = data.content?.[0]?.text || '';
    const tokensIn = data.usage?.input_tokens || 0;
    const tokensOut = data.usage?.output_tokens || 0;

    // AIログをSupabaseに保存
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
