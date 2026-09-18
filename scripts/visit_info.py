# -*- coding: utf-8 -*-
"""visit_info — 蔵の見学情報（構造化）の共通描画モジュール。

data_{pref}_breweries.json の各蔵に以下の visit_info オブジェクトを追加できる。
全フィールド任意。**データがある項目のみ表示**（RULES.md「嘘をつかない原則」準拠）。
値は公式サイトの記載に基づくこと。source（出典URL）と last_checked（確認日）は必須。

  "visit_info": {
    "status": "open|paused|closed|inquire",   # 見学受付状況
    "reservation": "required|recommended|not_required",
    "reservation_url": "https://...",          # 公式の予約ページ
    "english": "tour|materials|none",          # 英語対応（英語ツアー/英語資料）
    "tasting": "paid|free|available|none",     # 試飲
    "fee": "500円（試飲付き）",                  # 公式記載の料金文言
    "duration": "約45分",
    "shop": true,                              # 直売所・売店あり
    "facility": "月桂冠大倉記念館",              # 見学施設名（あれば）
    "notes_ja": "年末年始休館",                  # 公式記載の補足
    "notes_en": "",                            # 英語補足（公式英語ページがある場合のみ）
    "source": "https://.../tour/",             # 出典（公式見学ページ）
    "last_checked": "2026-07-12"
  }
"""
import html


def _esc(s):
    return html.escape(str(s), quote=True) if s else ''


LABELS = {
    'ja': {
        'visit': '見学', 'reservation': '予約', 'english': '英語対応',
        'tasting': '試飲', 'fee': '料金', 'duration': '所要時間',
        'shop': '直売所', 'facility': '見学施設', 'notes': '備考',
        'reserve_btn': '公式サイトで見学を予約する →',
        'source': '出典', 'last_checked': '最終確認日',
        'status': {'open': '見学可', 'paused': '見学休止中', 'closed': '見学不可',
                   'inquire': '要問い合わせ'},
        'res': {'required': '要予約', 'recommended': '予約推奨', 'not_required': '予約不要'},
        'eng': {'tour': '英語ツアーあり', 'materials': '英語資料あり', 'none': '日本語のみ'},
        'tast': {'paid': 'あり（有料）', 'free': 'あり（無料）', 'available': 'あり', 'none': 'なし'},
        'shop_yes': 'あり',
    },
    'en': {
        'visit': 'Visits', 'reservation': 'Reservation', 'english': 'English support',
        'tasting': 'Tasting', 'fee': 'Fee', 'duration': 'Duration',
        'shop': 'Shop', 'facility': 'Visitor facility', 'notes': 'Notes',
        'reserve_btn': 'Book a visit on the official site →',
        'source': 'Source', 'last_checked': 'Last verified',
        'status': {'open': 'Open to visitors', 'paused': 'Tours suspended', 'closed': 'Not open to visitors',
                   'inquire': 'Contact the brewery'},
        'res': {'required': 'Reservation required', 'recommended': 'Reservation recommended',
                'not_required': 'No reservation needed'},
        'eng': {'tour': 'English tours available', 'materials': 'English materials available',
                'none': 'Japanese only'},
        'tast': {'paid': 'Available (paid)', 'free': 'Available (free)', 'available': 'Available',
                 'none': 'Not available'},
        'shop_yes': 'Yes',
    },
}


def _row(icon, label, value_html):
    return (f'<div style="display:flex;gap:14px;align-items:flex-start;">'
            f'<span style="font-size:20px;">{icon}</span><div>'
            f'<div style="font-size:14px;font-weight:500;margin-bottom:3px;">{label}</div>'
            f'<div style="font-size:15px;color:var(--text-body);">{value_html}</div></div></div>')


def visit_info_rows(b, lang='ja'):
    """visit_info の構造化表示行（HTML）。visit_info が無ければ従来の visit 文字列を返す。"""
    L = LABELS.get(lang, LABELS['en'])
    vi = b.get('visit_info') or {}
    legacy = b.get('visit', '')
    if legacy in ('—', 'ー', '-'):
        legacy = ''
    out = ''
    if not vi:
        if legacy and lang == 'ja':
            out += _row('🏠', L['visit'], _esc(legacy))
        return out

    status = vi.get('status')
    res = vi.get('reservation')
    if status:
        val = L['status'].get(status, '')
        if val and res and status == 'open':
            val += '・' + L['res'].get(res, '') if lang == 'ja' else ' · ' + L['res'].get(res, '')
        if val:
            out += _row('🏠', L['visit'], _esc(val))
    elif res:
        out += _row('🏠', L['reservation'], _esc(L['res'].get(res, '')))
    if vi.get('facility'):
        out += _row('🏛️', L['facility'], _esc(vi['facility']))
    if vi.get('english') and vi['english'] != 'none':
        out += _row('🌏', L['english'], _esc(L['eng'].get(vi['english'], '')))
    if vi.get('tasting'):
        out += _row('🍶', L['tasting'], _esc(L['tast'].get(vi['tasting'], '')))
    if vi.get('fee'):
        out += _row('💴', L['fee'], _esc(vi['fee']))
    if vi.get('duration'):
        out += _row('⏱️', L['duration'], _esc(vi['duration']))
    if vi.get('shop'):
        out += _row('🛍️', L['shop'], L['shop_yes'])
    notes = vi.get('notes_ja') if lang == 'ja' else (vi.get('notes_en') or '')
    if notes:
        out += _row('📝', L['notes'], _esc(notes))
    if not out and legacy and lang == 'ja':
        out += _row('🏠', L['visit'], _esc(legacy))
    if vi.get('reservation_url'):
        out += (f'<div style="margin-top:6px;"><a href="{_esc(vi["reservation_url"])}" target="_blank" rel="noopener" '
                f'style="display:inline-block;background:var(--accent);color:#fff;text-decoration:none;'
                f'font-size:14px;font-weight:600;padding:11px 24px;border-radius:24px;">{L["reserve_btn"]}</a></div>')
    if vi.get('source'):
        checked = f'（{L["last_checked"]}: {_esc(vi["last_checked"])}）' if vi.get('last_checked') else ''
        if lang == 'en' and vi.get('last_checked'):
            checked = f' ({L["last_checked"]}: {_esc(vi["last_checked"])})'
        out += (f'<div style="font-size:10px;color:var(--text-muted);margin-top:10px;">'
                f'{L["source"]}：<a href="{_esc(vi["source"])}" target="_blank" rel="noopener">'
                f'{"公式サイト" if lang == "ja" else "Official website"}</a>{checked}</div>')
    return out


def visit_faq_text(b, name, lang='ja'):
    """JSON-LD FAQ / サクラ用の見学情報テキスト。データが無ければ空文字。"""
    L = LABELS.get(lang, LABELS['en'])
    vi = b.get('visit_info') or {}
    legacy = b.get('visit', '')
    if legacy in ('—', 'ー', '-'):
        legacy = ''
    if not vi:
        return legacy if lang == 'ja' else ''
    parts = []
    if vi.get('status'):
        parts.append(L['status'].get(vi['status'], ''))
    if vi.get('status') == 'open' and vi.get('reservation'):
        parts.append(L['res'].get(vi['reservation'], ''))
    if vi.get('facility'):
        parts.append(vi['facility'])
    if vi.get('english') and vi['english'] != 'none':
        parts.append(L['eng'].get(vi['english'], ''))
    if vi.get('tasting') and vi['tasting'] != 'none':
        tast_label = L['tasting'] + (': ' if lang == 'en' else '：')
        parts.append(tast_label + L['tast'].get(vi['tasting'], ''))
    parts = [p for p in parts if p]
    if not parts:
        return legacy if lang == 'ja' else ''
    sep = '。' if lang == 'ja' else '. '
    return (sep.join(parts) + ('。' if lang == 'ja' else '.'))
