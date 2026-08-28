/**
 * Step6: REVERSE_QUESTIONS（刺さる逆質問）
 * 入力: 会社名、Step2、Step3、自己分析、Step5（ES最適化）、inputData（任意）
 */
function runStep6(companyName, step2Result, step3Result, selfAnalysis, step5Result, inputData) {
  var safeCompanyName = (companyName || '').replace(/[`\\]/g, '');
  var safeInput = (inputData && typeof inputData === 'object') ? inputData : {};
  var overview = (step2Result && step2Result.content) ? step2Result.content : '';
  var appeal = (step3Result && step3Result.content) ? step3Result.content : '';
  var esOpt = (step5Result && step5Result.content) ? step5Result.content : '';
  var selfStr = (selfAnalysis && typeof selfAnalysis.content === 'string') ? selfAnalysis.content : JSON.stringify(selfAnalysis || {}, null, 0);

  var phase = safeInput.phase || '';
  var concerns = (safeInput.concerns || '').replace(/[`\\]/g, '');
  var jobType = (safeInput.jobType || '').replace(/[`\\]/g, '');

  var contextSize = overview.length + appeal.length + esOpt.length + selfStr.length;
  if (contextSize > 35000) {
    console.warn('[Step6] コンテキストが大きいため (' + contextSize + '文字)、コンテキストを最適化します。');
    overview = overview.substring(0, 10000);
    appeal = appeal.substring(0, 10000);
    esOpt = esOpt.substring(0, 10000);
  }

  var targetSection = (phase || jobType)
    ? '\n■ 選考フェーズ: ' + (phase || '（未設定）') + '\n■ 応募職種: ' + (jobType || '（未設定）')
    : '';
  var concernsSection = concerns
    ? '\n■ 企業への懸念・気になる点（逆質問に昇華させること）:\n' + concerns
    : '';
  var phaseInstruction = buildStep6PhaseInstruction(phase, jobType);

  var prompt = `
あなたは就活支援に特化した逆質問（面接終盤の質問）戦略アシスタントです。
目的は「評価を上げる逆質問」を設計することです。
${targetSection}${concernsSection}

──────────────────
【最重要ルール】

・推測禁止。不明は「不明」と記載。
・必ず以下の入力情報のみを根拠にする。
・企業研究の深さが伝わる内容にする。
・「調べれば分かる質問」は禁止。
・応募者の強み（Step3）と接続させる。
・面接官が"この学生は本気だ"と感じる水準にする。
${phaseInstruction}

──────────────────
【入力情報】

■ 会社概要（Step2）
${overview}

■ アピールポイント（Step3）
${appeal}

■ ES最適化結果（Step5）
${esOpt}

■ 自己分析
${selfStr}

上記のみを根拠に作成すること。

──────────────────
【出力構造】

■ 0. 逆質問戦略サマリー
・この企業で逆質問が持つ意味
・${phase || '各フェーズ'}で評価を上げる方向性
・避けるべき質問タイプ

──────────────────
■ ① 人事面接向け逆質問（3問以上）

各質問ごとに：

【逆質問】
【質問の意図】
【評価されるポイント】
【質問後に続けると良い一言】

──────────────────
■ ② 現場社員向け逆質問（3問以上）

各質問ごとに：

【逆質問】
【なぜ刺さるか（事業との接続）】
【応募者強みとの接続】
【差がつくフォローアップ】

──────────────────
■ ③ 役員・最終面接向け逆質問（2〜3問）

各質問ごとに：

【逆質問】
【経営視点との接続】
【企業戦略との関連】
【一段深い追加質問】

──────────────────
■ ④ 会社特有の逆質問（必須）

Step2の内容を分析し、
その企業でしか使えない逆質問を最低5問生成する。

例：
・中期経営計画への具体質問
・DX戦略の進捗
・競合との差別化
・業界課題への対応
・過去の課題・不祥事からの変化

各質問ごとに：

【逆質問】
【出すタイミング】
【評価が上がる理由】
【NGな聞き方】

──────────────────
■ ⑤ 応募者特化型逆質問

自己分析・ES内容を踏まえ、
「自分の強みを再度印象付けられる逆質問」を3問生成する。

──────────────────
■ ⑥ NG逆質問例

・印象が悪い質問例
・調査不足と見なされる質問
・待遇中心になりすぎる質問

理由も明記すること。

──────────────────

最終出力は「面接直前にそのまま使える逆質問集」とすること。
`;
  var content = generateContent(prompt, { companyName: safeCompanyName });
  if (!content || content.trim().length < 100) {
    console.error('[Step6] Gemini の応答が短すぎます (' + (content ? content.length : 0) + '文字): ' + safeCompanyName);
    content = content || '（コンテンツの生成に失敗しました）';
  }
  var url = createDocFromContent(companyName, 'REVERSE_QUESTIONS', content);
  return { url: url, content: content };
}

/**
 * フェーズ・職種に応じたStep6向けの追加指示を生成
 */
function buildStep6PhaseInstruction(phase, jobType) {
  var lines = [];
  if (!phase && !jobType) return '';
  lines.push('');
  lines.push('【フェーズ別の重点出力指示】');
  if (jobType) {
    lines.push('・「■ ⑤ 応募者特化型逆質問」は「' + jobType + '」職種として活躍するイメージを面接官に与える内容にすること。');
  }
  if (phase === 'ES') {
    lines.push('・ESフェーズ: 通常ESに逆質問欄はないが、面談・説明会での質問として使える内容を「補足」として生成すること。');
    lines.push('・「■ ① 人事面接向け」を中心に、企業理解の深さをアピールできる質問を重点的に生成すること。');
  } else if (phase === '1次面接') {
    lines.push('・1次面接フェーズ: 「■ ① 人事面接向け」を最重点とし、5問以上生成すること。');
    lines.push('・職場環境・社風・育成制度・チームの雰囲気を深掘りする質問を優先すること。');
    lines.push('・「■ ② 現場社員向け」「■ ③ 役員向け」は参考程度（2問ずつ）でよい。');
  } else if (phase === '2次面接') {
    lines.push('・2次面接フェーズ: 「■ ② 現場社員向け」を最重点とし、5問以上生成すること。');
    lines.push('・「' + (jobType || '応募職種') + '」の実務・チーム構成・プロジェクト進め方を深掘りする質問を優先すること。');
    lines.push('・「■ ① 人事向け」「■ ③ 役員向け」は参考程度（2問ずつ）でよい。');
  } else if (phase === '最終面接') {
    lines.push('・最終面接フェーズ: 「■ ③ 役員・最終面接向け」を最重点とし、5問以上生成すること。');
    lines.push('・経営ビジョン・中期戦略・会社の将来像に関する深みのある質問を優先すること。');
    lines.push('・「■ ① 人事向け」「■ ② 現場向け」は参考程度（2問ずつ）でよい。');
  }
  return lines.join('\n');
}
