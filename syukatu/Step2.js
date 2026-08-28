/**
 * Step2: COMPANY_OVERVIEW（会社概要）
 * 入力: 会社名、Step1の結果、inputData（任意）
 */
function runStep2(companyName, step1Result, inputData) {
  var safeCompanyName = (companyName || '').replace(/[`\\]/g, '');
  var safeInput = (inputData && typeof inputData === 'object') ? inputData : {};
  var ref = (step1Result && step1Result.content) ? step1Result.content : '';

  var jobType = (safeInput.jobType || '').replace(/[`\\]/g, '');
  var phase = safeInput.phase || '';

  // ユーザー提供URLセクション
  var userUrlLines = [];
  if (safeInput.recruitUrl) userUrlLines.push('採用ページ: ' + safeInput.recruitUrl);
  var irUrls = Array.isArray(safeInput.irUrls) ? safeInput.irUrls : [];
  for (var i = 0; i < irUrls.length; i++) { if (irUrls[i]) userUrlLines.push('IR/有報: ' + irUrls[i]); }
  var interviewUrls = Array.isArray(safeInput.interviewUrls) ? safeInput.interviewUrls : [];
  for (var j = 0; j < interviewUrls.length; j++) { if (interviewUrls[j]) userUrlLines.push('社長インタビュー: ' + interviewUrls[j]); }
  var newsUrls = Array.isArray(safeInput.newsUrls) ? safeInput.newsUrls : [];
  for (var k = 0; k < newsUrls.length; k++) { if (newsUrls[k]) userUrlLines.push('ニュース: ' + newsUrls[k]); }
  var userUrlSection = userUrlLines.length > 0
    ? '\n■ ユーザー提供URL（必ず参照）\n' + userUrlLines.join('\n')
    : '';

  var targetSection = (jobType || phase)
    ? '\n■ 応募職種: ' + (jobType || '（未設定）') + '\n■ 選考フェーズ: ' + (phase || '（未設定）')
    : '';

  var phaseInstruction = buildStep2PhaseInstruction(phase, jobType);

  var prompt = `
あなたは就活支援に特化した企業研究アシスタントです。
${targetSection}${userUrlSection}

【最重要ルール】
・推測禁止。情報が確認できない場合は必ず「不明」と記載。
・必ず出典・参照URLを併記する。
・事実と評価を分ける。
・就活生が「志望動機」「企業理解」「面接対策」に使える粒度で具体的に書く。
${phaseInstruction}

【参考資料】
Step1で取得した参考URL・情報は以下です：
${ref}

上記を必ず参照し、裏付けのある内容のみでまとめること。

【出力構造】

■ 0. 3分でわかる会社概要（最初に必ず出力）
・会社の一言要約
・業界内ポジション
・主力事業
・強みの要点
・現在の注力分野
・就活で押さえるべきポイント3つ

■ 1. 会社概要（基礎情報）
・正式名称
・設立年
・本社所在地
・代表者
・資本金
・売上高（直近）
・従業員数
・上場区分
・グループ構成
※不明は「不明」と記載

■ 2. 事業内容（具体的に）
・事業セグメント別に説明
・主力サービス・商品
・収益構造
・顧客層
・BtoB / BtoC の区分
・競合企業名
・差別化要因

■ 3. 強み・特徴（具体的に）
・技術力
・ブランド力
・人材戦略
・組織文化
・ビジネスモデルの優位性
・財務面の強み
・他社との比較ポイント

■ 4. 最近の動向（直近3年中心）
・中期経営計画
・DX戦略
・海外展開
・M&A
・新規事業
・不祥事・課題とその対応
・業界トレンドとの関係

■ 5. 競合他社マップ（必須）

以下の観点で競合他社を分析し、構造化すること。

【競合企業一覧】
・直接競合（同業・同規模）: 企業名、強み、弱み
・間接競合（異業種からの参入含む）: 企業名、競合する領域

【差別化マトリクス】
以下の軸で当社 vs 競合2〜3社を比較すること：
・技術力／サービス品質
・価格競争力
・顧客層・市場シェア
・DX・AI対応度
・財務安定性
・採用・人材戦略

【面接必須の差別化ロジック】
「なぜ競合ではなく当社か」に答えるための論点を3つ生成する。
各論点に：
- 差別化の根拠（数字・事実ベース）
- 面接での言い回し例
- 深掘りされた場合の返し方

【競合比較で注意すべき地雷】
・言ってはいけない競合の名前の出し方
・比較軸として使うと印象が悪い観点

■ 6. 就活対策視点（応募職種・フェーズ特化）
・求める人物像（${jobType || '全職種'}向けに特化して記述）
・評価される能力
・面接で深掘られやすい論点（${phase || '全フェーズ'}を想定）
・志望動機で使える論点
・懸念点（逆質問で使える視点）

必ず各セクションで参照URLを明記すること。
`;
  var content = generateContent(prompt, { companyName: safeCompanyName });
  if (!content || content.trim().length < 100) {
    console.error('[Step2] Gemini の応答が短すぎます (' + (content ? content.length : 0) + '文字): ' + safeCompanyName);
    content = content || '（コンテンツの生成に失敗しました）';
  }
  var url = createDocFromContent(companyName, 'COMPANY_OVERVIEW', content);
  return { url: url, content: content };
}

/**
 * フェーズ・職種に応じたStep2向けの追加指示を生成
 */
function buildStep2PhaseInstruction(phase, jobType) {
  var lines = [];
  if (!phase && !jobType) return '';
  lines.push('');
  lines.push('【フェーズ・職種別の重点出力指示】');
  if (jobType) {
    lines.push('・「■ 6. 就活対策視点」は「' + jobType + '」職種への採用という観点で、必要スキル・業務内容との接続を具体的に記述すること。');
  }
  if (phase === 'ES') {
    lines.push('・ESフェーズ: 志望動機・ガクチカとの接続点、書類で差がつくポイントを重点的に記述すること。');
    lines.push('・学生がESに書きやすいエピソードの切り口も提示すること。');
  } else if (phase === '1次面接') {
    lines.push('・1次面接フェーズ: 人事担当者が見る基本的な人物像・志望動機の深さを重視した視点で記述すること。');
    lines.push('・「なぜこの会社か」を論理的に説明するための材料を重点的に整理すること。');
  } else if (phase === '2次面接') {
    lines.push('・2次面接フェーズ: 現場社員が見る職種理解・専門性・業務適合性を重視した視点で記述すること。');
    lines.push('・「' + (jobType || '応募職種') + '」として入社後に何ができるか、具体的な活躍イメージを記述すること。');
  } else if (phase === '最終面接') {
    lines.push('・最終面接フェーズ: 役員・経営層が見るビジョン・価値観・長期的な貢献可能性を重視した視点で記述すること。');
    lines.push('・会社の中期的な方向性と応募者のキャリアビジョンを接続する材料を重点的に整理すること。');
  }
  return lines.join('\n');
}
