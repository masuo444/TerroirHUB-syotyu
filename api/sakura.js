// AIチャット（サクラ／ミズキ）は 2026-10-21 に提供を終了した。
// 認証なしで有料のAIを呼べる状態を残さないため、2026-10-25 から常に 410 を返す（元の実装は git の履歴にある）。
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(410).json({ error: 'This AI chat service has ended.' });
};
