/**
 * Step5: ES_OPTIMIZATION（ES自動最適化）
 * 入力: 会社名、Step2（会社概要）、Step3（アピールポイント）、自己分析、inputData（任意）
 */
function runStep5(companyName, step2Result, step3Result, selfAnalysis, inputData) {
  var safeCompanyName = (companyName || '').replace(/[`\\]/g, '');
  var safeInput = (inputData && typeof inputData === 'object') ? inputData : {};
  var overview = (step2Result && step2Result.content) ? step2Result.content : '';
  var appeal = (step3Result && step3Result.content) ? step3Result.content : '';
  var selfStr = (selfAnalysis && typeof selfAnalysis.content === 'string') ? selfAnalysis.content : JSON.stringify(selfAnalysis || {}, null, 0);
  var contextSize = overview.length + appeal.length + selfStr.length;
  if (contextSize > 35000) {
    console.warn('[Step5] コンテキストが大きいため (' + contextSize + '文字)、概要とアピールを最適化します。');
    overview = overview.substring(0, 15000);
    appeal = appeal.substring(0, 15000);
  }

  var isCustomMode = safeInput.esMode === 'custom'
    && Array.isArray(safeInput.customEsQuestions)
    && safeInput.customEsQuestions.length > 0;

  var mainSection = isCustomMode
    ? buildCustomEsSection(safeInput.customEsQuestions)
    : buildTemplateEsSection();

  var additionalEsQuestions = Array.isArray(safeInput.additionalEsQuestions) ? safeInput.additionalEsQuestions : [];
  var hasAdditional = additionalEsQuestions.length > 0;
  var additionalSection = hasAdditional ? buildAdditionalEsSection(additionalEsQuestions) : '';
  var companySectionNum = hasAdditional ? '⑦' : '⑥';
  var checklistNum = hasAdditional ? '⑧' : '⑦';

  var prompt = `
あなたは就活支援に特化したES（エントリーシート）最適化アシスタントです。
目的は「通過率を最大化する完成ES」を生成することです。

──────────────────
【最重要ルール】
・推測禁止。不明は「不明」と記載。
・必ず入力情報のみを根拠にする。
・抽象表現禁止（具体行動・成果・再現性を含める）。
・企業特性（Step2）と応募者強み（Step3）を必ず接続する。
・業界→企業→自分 の論理構造を徹底する。
・結論ファーストで書く。

──────────────────
【入力情報】

■ 会社概要（Step2）
${overview}

■ アピールポイント整理（Step3）
${appeal}

■ 自己分析
${selfStr}

上記のみを根拠に作成すること。

──────────────────
【出力構造】

■ 0. ES全体戦略サマリー
・この企業で評価される要素
・今回のESで押し出す軸
・差別化ポイント

──────────────────
${mainSection}
${additionalSection}
■ ${companySectionNum} 会社特有ES設問（必須）

会社概要（Step2）を分析し、
その企業ならではの設問を3〜5問生成する。

例：
・事業戦略への意見
・業界課題への提案
・企業文化との適合性
・最近のニュースに対する見解
・競合比較

各設問ごとに：

【設問】
【出題意図】
【構成指針】
【構成済み文章（文字数明記）】
1. 結論：〜
2. 発見した課題：〜
3. 解決策の思考プロセス：〜
4. 実行した行動：〜
5. 結果と成長：〜

【完成文章（文字数明記）】
（上記の構成をベースに、番号・ラベルをすべて除去し、
自然なつながりで一続きの文章として出力する。
そのまま提出できる状態にすること。）

【文字数チェック】
・指定: XX字
・実際: XX字
・過不足: XX字
・判定: OK / 要調整

──────────────────
■ ${checklistNum} ES弱点チェックリスト

・抽象表現になっていないか
・企業との接続が弱くないか
・成果が定量化されているか
・他社でも使い回せる内容になっていないか

最終出力は「そのまま提出可能な完成ES」とすること。
`;
  var content = generateContent(prompt, { companyName: safeCompanyName }, { maxOutputTokens: 16384 });
  if (!content || content.trim().length < 100) {
    console.error('[Step5] Gemini の応答が短すぎます (' + (content ? content.length : 0) + '文字): ' + safeCompanyName);
    content = content || '（コンテンツの生成に失敗しました）';
  }
  var url = createDocFromContent(companyName, 'ES_OPTIMIZATION', content);
  return { url: url, content: content };
}

/**
 * 2段階出力ブロック（構成済み文章 → 完成文章 → 文字数チェック）を返すヘルパー
 * @param {number} charLimit - 文字数制限
 * @returns {string}
 */
function buildTwoStageOutput(charLimit) {
  return '【構成済み文章（' + charLimit + '字以内）】\n' +
    '1. 結論：〜\n' +
    '2. 発見した課題：〜\n' +
    '3. 解決策の思考プロセス：〜\n' +
    '4. 実行した行動：〜\n' +
    '5. 結果と成長：〜\n\n' +
    '【完成文章（' + charLimit + '字以内）】\n' +
    '（上記の構成をベースに、番号・ラベルをすべて除去し、\n' +
    '自然なつながりで一続きの文章として出力する。\n' +
    'そのまま提出できる状態にすること。）\n\n' +
    '【文字数チェック】\n' +
    '・指定: ' + charLimit + '字\n' +
    '・実際: XX字\n' +
    '・過不足: XX字\n' +
    '・判定: OK / 要調整\n';
}

/**
 * テンプレートESモード（デフォルト）の固定設問セクションを返す
 */
function buildTemplateEsSection() {
  return '■ ① 志望動機（400字固定）\n\n' +
    '【設問】\n' +
    '「当社を志望する理由を教えてください。（400字）」\n\n' +
    '【構成指針】\n' +
    '・業界志望理由（100字）\n' +
    '・企業志望理由（150字）\n' +
    '・自分の強みとの接続（150字）\n\n' +
    buildTwoStageOutput(400) +
    '──────────────────\n' +
    '■ ② 自己PR（400字固定）\n\n' +
    '【設問】\n' +
    '「あなたの強みを教えてください。（400字）」\n\n' +
    '【構成指針】\n' +
    '・結論（強み）\n' +
    '・具体エピソード（STAR）\n' +
    '・成果（数字）\n' +
    '・企業での再現性\n\n' +
    buildTwoStageOutput(400) +
    '──────────────────\n' +
    '■ ③ ガクチカ（600字固定）\n\n' +
    '【設問】\n' +
    '「学生時代に最も力を入れたことを教えてください。（600字）」\n\n' +
    '【構成指針】\n' +
    '・課題設定\n' +
    '・行動\n' +
    '・工夫\n' +
    '・成果（数値）\n' +
    '・学び\n' +
    '・企業での再現性\n\n' +
    buildTwoStageOutput(600) +
    '──────────────────\n' +
    '■ ④ 強みと弱み（300字固定）\n\n' +
    '【設問】\n' +
    '「あなたの強みと弱みを教えてください。（300字）」\n\n' +
    buildTwoStageOutput(300) +
    '──────────────────\n' +
    '■ ⑤ 入社後にやりたいこと（400字固定）\n\n' +
    '【設問】\n' +
    '「入社後に挑戦したいことを教えてください。（400字）」\n\n' +
    buildTwoStageOutput(400) +
    '──────────────────\n';
}

/**
 * カスタムESモード時の設問セクションを動的生成して返す
 * @param {Array} questions - [{ question: string, charLimit: number }, ...]
 */
function buildCustomEsSection(questions) {
  var lines = ['■ 実際のES設問への回答', ''];
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var question = (q.question || '').replace(/[`\\]/g, '');
    var charLimit = (parseInt(q.charLimit, 10) > 0) ? parseInt(q.charLimit, 10) : 400;
    lines.push('【設問 ' + (i + 1) + '】' + question + '（' + charLimit + '字以内）');
    lines.push('');
    lines.push('【出題意図の分析】');
    lines.push('・この設問で企業が見ていること');
    lines.push('・避けるべき回答パターン');
    lines.push('');
    lines.push('【構成指針】');
    lines.push('・文字数配分（例：結論XX字＋エピソードXX字＋企業接続XX字）');
    lines.push('');
    lines.push('【構成済み文章（' + charLimit + '字以内）】');
    lines.push('1. 結論：〜');
    lines.push('2. 発見した課題：〜');
    lines.push('3. 解決策の思考プロセス：〜');
    lines.push('4. 実行した行動：〜');
    lines.push('5. 結果と成長：〜');
    lines.push('');
    lines.push('【完成文章（' + charLimit + '字以内）】');
    lines.push('（上記の構成をベースに、番号・ラベルをすべて除去し、');
    lines.push('自然なつながりで一続きの文章として出力する。');
    lines.push('そのまま提出できる状態にすること。）');
    lines.push('');
    lines.push('【文字数チェック】');
    lines.push('・指定: ' + charLimit + '字');
    lines.push('・実際: XX字');
    lines.push('・過不足: XX字');
    lines.push('・判定: OK / 要調整');
    lines.push('');
    lines.push('【改善チェック】');
    lines.push('・抽象表現になっていないか');
    lines.push('・企業との接続が弱くないか');
    lines.push('・他社使い回しになっていないか');
    lines.push('');
    lines.push('──────────────────');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * 会社独自の追加設問セクションを動的生成して返す
 * @param {Array} questions - [{ question: string, charLimit: number }, ...]
 */
function buildAdditionalEsSection(questions) {
  var lines = [
    '■ ⑥ 会社独自の追加設問への回答',
    '',
    '以下のルールで各設問に回答すること：',
    '',
    '【文章構成】',
    '1. 結論（何を達成・頑張ったか、または主張）',
    '2. 発見した課題（なぜそれが問題・テーマとして重要か）',
    '3. 解決策の思考プロセス（どう考えたか・なぜその方法を選んだか）',
    '4. 実行した行動（具体的に何をしたか）',
    '5. 結果と成長（何を得たか・どう変わったか）',
    '   ※失敗した場合は正直に書き今後の展望を述べる',
    '',
    '【文体ルール】',
    '・一人称は「私」に統一',
    '・語尾は「〜しました」「〜です」「〜ます」で統一',
    '・体言止め禁止・箇条書き禁止',
    '・抽象表現禁止（具体行動に置き換える）',
    '',
    '【数字ルール】',
    '・成果は必ず数字で表現する',
    '・数字が不明な場合は（要確認：具体的な数値を記入してください）と明記',
    '',
    '【企業接続ルール】',
    '・企業名または応募職種を文中に1回以上入れる',
    '・汎用表現（「御社で活かしたい」）は禁止',
    '',
    '各設問の出力形式：',
    ''
  ];

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var question = (q.question || '').replace(/[`\\]/g, '');
    var charLimit = (parseInt(q.charLimit, 10) > 0) ? parseInt(q.charLimit, 10) : 300;

    lines.push('【設問 ' + (i + 1) + '】' + question + '（' + charLimit + '字以内）');
    lines.push('');
    lines.push('【出題意図の分析】');
    lines.push('・この設問で企業が見ていること');
    lines.push('・避けるべき回答パターン');
    lines.push('');
    lines.push('【構成指針】');
    lines.push('・文字数配分（例：結論XX字＋課題XX字＋行動XX字＋成果XX字）');
    lines.push('');
    lines.push('【構成済み文章（' + charLimit + '字以内）】');
    lines.push('1. 結論：〜');
    lines.push('2. 発見した課題：〜');
    lines.push('3. 解決策の思考プロセス：〜');
    lines.push('4. 実行した行動：〜');
    lines.push('5. 結果と成長：〜');
    lines.push('');
    lines.push('【完成文章（' + charLimit + '字以内）】');
    lines.push('（上記の構成をベースに、番号・ラベルをすべて除去し、');
    lines.push('自然なつながりで一続きの文章として出力する。');
    lines.push('そのまま提出できる状態にすること。）');
    lines.push('');
    lines.push('【文字数チェック】');
    lines.push('・指定: ' + charLimit + '字');
    lines.push('・実際: XX字');
    lines.push('・過不足: XX字');
    lines.push('・判定: OK / 要調整');
    lines.push('──────────────────');
    lines.push('');
  }

  return lines.join('\n');
}
