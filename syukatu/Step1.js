/**
 * Step1: REFERENCE_URLS（参考URLまとめ）
 * 入力: 会社名、inputData（任意）
 * 流れ: ユーザー提供URL整理 → AIで検索キーワード作成 → キーワードで検索 → 参考URLまとめDoc生成
 */
function runStep1(companyName, inputData) {
  var safeInput = (inputData && typeof inputData === 'object') ? inputData : {};
  var keywordsAndRefs = getKeywordsAndReferencesByAI(companyName, safeInput);
  var references = keywordsAndRefs.references || [];

  if (keywordsAndRefs.keywords && keywordsAndRefs.keywords.length > 0) {
    var searchResults = searchWithKeywords(keywordsAndRefs.keywords);
    if (searchResults && searchResults.length > 0) {
      for (var i = 0; i < searchResults.length; i++) {
        references.push(searchResults[i]);
      }
    }
  }

  references = references.filter(function(r) {
    return r && r.url && /^https?:\/\/.{3,}/.test(r.url.trim());
  });

  // ユーザー提供URLを先頭に追加（確認済みURLとして優先表示）
  var userRefs = buildUserUrlRefs(safeInput);
  references = userRefs.concat(references);

  if (references.length === 0) {
    console.warn('[Step1] 有効な参考URLが0件です。会社名: ' + companyName);
  }

  var content = formatReferenceUrlsContent(keywordsAndRefs.keywords || [], references);
  var url = createDocFromContent(companyName, 'REFERENCE_URLS', content);
  return { url: url, content: content };
}

/**
 * ユーザー提供URLをリファレンス形式に変換
 */
function buildUserUrlRefs(inputData) {
  var refs = [];
  if (!inputData) return refs;

  if (inputData.recruitUrl && inputData.recruitUrl.trim()) {
    refs.push({
      category: '採用ページ（ユーザー提供）',
      title: '採用ページ',
      url: inputData.recruitUrl.trim(),
      why_important: '応募先の採用情報・求める人物像'
    });
  }

  var irUrls = Array.isArray(inputData.irUrls) ? inputData.irUrls : [];
  for (var i = 0; i < irUrls.length; i++) {
    var u = irUrls[i] && irUrls[i].trim();
    if (u) refs.push({ category: 'IR・有価証券報告書（ユーザー提供）', title: 'IR情報', url: u, why_important: '財務状況・中期経営計画・事業戦略' });
  }

  var interviewUrls = Array.isArray(inputData.interviewUrls) ? inputData.interviewUrls : [];
  for (var j = 0; j < interviewUrls.length; j++) {
    var v = interviewUrls[j] && interviewUrls[j].trim();
    if (v) refs.push({ category: '社長インタビュー（ユーザー提供）', title: '社長インタビュー', url: v, why_important: '経営者のビジョン・価値観・今後の方向性' });
  }

  var newsUrls = Array.isArray(inputData.newsUrls) ? inputData.newsUrls : [];
  for (var k = 0; k < newsUrls.length; k++) {
    var w = newsUrls[k] && newsUrls[k].trim();
    if (w) refs.push({ category: 'ニュース記事（ユーザー提供）', title: 'ニュース記事', url: w, why_important: '最新動向・業界での話題' });
  }

  return refs;
}

/**
 * ユーザー提供URLをプロンプト用の文字列に変換
 */
function buildUserUrlSection(inputData) {
  var lines = [];
  if (!inputData) return '';
  if (inputData.recruitUrl && inputData.recruitUrl.trim()) {
    lines.push('採用ページ: ' + inputData.recruitUrl.trim());
  }
  var irUrls = Array.isArray(inputData.irUrls) ? inputData.irUrls : [];
  for (var i = 0; i < irUrls.length; i++) {
    if (irUrls[i] && irUrls[i].trim()) lines.push('IR/有報: ' + irUrls[i].trim());
  }
  var interviewUrls = Array.isArray(inputData.interviewUrls) ? inputData.interviewUrls : [];
  for (var j = 0; j < interviewUrls.length; j++) {
    if (interviewUrls[j] && interviewUrls[j].trim()) lines.push('社長インタビュー: ' + interviewUrls[j].trim());
  }
  var newsUrls = Array.isArray(inputData.newsUrls) ? inputData.newsUrls : [];
  for (var k = 0; k < newsUrls.length; k++) {
    if (newsUrls[k] && newsUrls[k].trim()) lines.push('ニュース: ' + newsUrls[k].trim());
  }
  return lines.join('\n');
}

/**
 * 会社名をAIで分析し、検索キーワードと参考URL候補を取得（JSONで返す）
 */
function getKeywordsAndReferencesByAI(companyName, inputData) {
  var safeInput = (inputData && typeof inputData === 'object') ? inputData : {};
  var userUrlSection = buildUserUrlSection(safeInput);
  var userUrlBlock = userUrlSection
    ? '\n【ユーザーが提供したURL（これらを必ず参照し、関連する追加情報URLも探すこと）】\n' + userUrlSection + '\n'
    : '';

  var prompt = `
あなたは就活支援に特化した企業研究アシスタントです。
目的は「企業理解に本当に役立つ一次情報URL」を厳選して提示することです。
${userUrlBlock}
──────────────────
【最重要ルール】

・推測禁止。不明な場合は「不明」と記載。
・実在が不確かなURLは出さない。
・最大10件まで。
・必ず公式・信頼性の高い情報源を優先する。
・ニュースはできるだけ直近のものを優先。
・採用視点で重要度が高い順に並べる。

──────────────────
【出力対象カテゴリ】

以下の観点を満たすURLを優先的に抽出すること：

1. 公式サイト（企業トップページ）
2. 事業内容ページ
3. IR情報ページ
4. 中期経営計画・決算説明資料
5. 社長メッセージ・トップインタビュー
6. 役員紹介ページ
7. 直近ニュース（業績・提携・新規事業など）
8. 採用ページ（新卒）
9. サステナビリティ・CSR情報
10. 業界内でのポジションが分かる資料

該当がない場合は無理に埋めないこと。

──────────────────
【出力形式】

JSONのみで出力すること。
説明文は一切不要。

{
  "company": "${companyName}",
  "references": [
    {
      "category": "カテゴリ名",
      "title": "ページタイトル",
      "url": "https://...",
      "why_important": "就活で見るべき理由（簡潔に）"
    }
  ]
}

最大10件まで。
重要度順に並べること。

──────────────────

対象会社：${companyName}
`;
  var raw = generateContent(prompt, { companyName: companyName });
  return parseKeywordsAndReferencesJson(raw);
}

function parseKeywordsAndReferencesJson(raw) {
  var def = { keywords: [], references: [] };
  if (!raw || typeof raw !== 'string') return def;
  var text = raw.trim().replace(/^```[a-z]*\s*$/gm, '');
  var start = text.indexOf('{');
  var end = text.lastIndexOf('}') + 1;
  if (start === -1 || end <= start) return def;
  try {
    var data = JSON.parse(text.substring(start, end));
    return {
      keywords: Array.isArray(data.keywords) ? data.keywords : def.keywords,
      references: Array.isArray(data.references) ? data.references : def.references
    };
  } catch (e) {
    console.warn('[Step1] JSON パース失敗: ' + e.message + ' | raw: ' + text.substring(0, 300));
    return def;
  }
}

/**
 * キーワードで検索（Google Custom Search API が設定されていれば使用）
 * Script Properties: CSE_API_KEY, CSE_ENGINE_ID
 */
function searchWithKeywords(keywords) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('CSE_API_KEY');
  var cx = PropertiesService.getScriptProperties().getProperty('CSE_ENGINE_ID');
  if (!apiKey || !cx || !keywords || keywords.length === 0) return [];
  var results = [];
  var seen = {};
  for (var i = 0; i < Math.min(keywords.length, 5); i++) {
    var q = keywords[i];
    if (!q || typeof q !== 'string' || seen[q]) continue;
    seen[q] = true;
    try {
      var url = 'https://www.googleapis.com/customsearch/v1?cx=' + encodeURIComponent(cx) + '&q=' + encodeURIComponent(q);
      var resp = UrlFetchApp.fetch(
        url,
        {
          headers: {
            'X-Goog-Api-Key': apiKey
          },
          muteHttpExceptions: true
        }
      );
      if (resp.getResponseCode() !== 200) {
        console.warn('[Step1] CSE API HTTP ' + resp.getResponseCode() + ' (キーワード: "' + q + '")');
        continue;
      }
      var data = JSON.parse(resp.getContentText());
      var items = data.items || [];
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        var u = (it.link || '').trim();
        if (u && !seen[u] && /^https?:\/\//i.test(u)) {
          seen[u] = true;
          results.push({ title: it.title || u, url: u, snippet: it.snippet || '' });
        }
      }
    } catch (e) {
      console.warn('[Step1] CSE 検索失敗 (キーワード: "' + q + '"): ' + e.message);
    }
  }
  return results;
}

/**
 * 参考URL一覧の本文テキストを組み立て
 * ユーザー提供URLとAI生成URLをセクション分けして表示
 */
function formatReferenceUrlsContent(keywords, references) {
  var lines = [];

  // ユーザー提供URLとAI生成URLを分離
  var userRefs = [];
  var aiRefs = [];
  for (var i = 0; i < references.length; i++) {
    var r = references[i];
    if (r.category && r.category.indexOf('ユーザー提供') !== -1) {
      userRefs.push(r);
    } else {
      aiRefs.push(r);
    }
  }

  if (userRefs.length > 0) {
    lines.push('【ユーザー提供URL】');
    lines.push('');
    for (var u = 0; u < userRefs.length; u++) {
      var ur = userRefs[u];
      lines.push((u + 1) + '. [' + (ur.category || '') + '] ' + (ur.title || ur.url || '(不明)'));
      lines.push('   ' + (ur.url || '').trim());
      if (ur.why_important) lines.push('   ' + ur.why_important);
      lines.push('');
    }
  }

  if (keywords && keywords.length > 0) {
    lines.push('検索キーワード');
    lines.push(keywords.join('、'));
    lines.push('');
  }

  lines.push('【AIによる参考URL一覧】');
  lines.push('');
  if (aiRefs.length > 0) {
    for (var a = 0; a < aiRefs.length; a++) {
      var ar = aiRefs[a];
      var title = (ar.title || '').trim() || ar.url || '(不明)';
      var url = (ar.url || '').trim();
      var snippet = (ar.snippet || ar.why_important || '').trim();
      lines.push((a + 1) + '. ' + title);
      lines.push('   ' + url);
      if (snippet) lines.push('   ' + snippet);
      lines.push('');
    }
  } else {
    lines.push('（参考URLは見つかりませんでした）');
  }

  return lines.join('\n').trim();
}
