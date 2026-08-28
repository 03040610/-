/**
 * Step4: QA_COLLECTION（想定質問返答集）
 * 入力: 会社名、Step2（会社概要）、Step3（アピールポイント）、自己分析、inputData（任意）
 */
function runStep4(companyName, step2Result, step3Result, selfAnalysis, inputData) {
  var safeCompanyName = (companyName || '').replace(/[`\\]/g, '');
  var safeInput = (inputData && typeof inputData === 'object') ? inputData : {};
  var overview = (step2Result && step2Result.content) ? step2Result.content : '';
  var appeal = (step3Result && step3Result.content) ? step3Result.content : '';
  var selfStr = (selfAnalysis && typeof selfAnalysis.content === 'string') ? selfAnalysis.content : JSON.stringify(selfAnalysis || {}, null, 0);

  var jobType = (safeInput.jobType || '').replace(/[`\\]/g, '');
  var phase = safeInput.phase || '';
  var pastQuestions = (safeInput.pastQuestions || '').replace(/[`\\]/g, '');

  var contextSize = overview.length + appeal.length + selfStr.length;
  if (contextSize > 35000) {
    console.warn('[Step4] コンテキストが大きいため (' + contextSize + '文字)、概要とアピールを最適化します。');
    overview = overview.substring(0, 15000);
    appeal = appeal.substring(0, 15000);
  }

  var targetSection = (jobType || phase)
    ? '\n■ 応募職種: ' + (jobType || '（未設定）') + '\n■ 選考フェーズ: ' + (phase || '（未設定）')
    : '';
  var pastQSection = pastQuestions
    ? '\n■ 過去に聞かれた質問（必ず回答を生成すること）:\n' + pastQuestions
    : '';
  var phaseInstruction = buildStep4PhaseInstruction(phase, jobType);

  var prompt = `
あなたは就活支援に特化した面接対策アシスタントです。
目的は「内定獲得レベルの面接想定Q&A集」を作成することです。
${targetSection}${pastQSection}

──────────────────
【最重要ルール】
・推測禁止。不明な情報は必ず「不明」と記載。
・必ず以下の入力情報のみを根拠にする。
・抽象表現は禁止（具体行動・成果・数字・再現性を含める）。
・企業特性（Step2）と応募者強み（Step3）を必ず接続する。
・すべての回答に「再現性」を持たせる。
・浅い回答になる場合は「改善案」を提示する。
・企業固有の質問も必ず生成する。
${phaseInstruction}

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

■ 0. 面接戦略サマリー
・この企業が重視している評価軸
・今回の面接（${phase || '全フェーズ'}）で押し出すべき強み
・警戒すべき弱点

──────────────────
■ ① 自己分析系質問

対象：
・自己紹介
・自己PR
・強みと弱み
・ガクチカ
・困難克服
・リーダー経験
・周囲からの評価
・最近の成長

各質問ごとに：

【質問】
【模範回答（具体・数字・成果入り）】
【深掘り想定質問】
【回答が浅い場合の改善例】

※再現性が伝わる構造で。

──────────────────
■ ② 志望動機系

対象：
・なぜこの業界か
・なぜ当社か
・他社ではなく当社の理由
・企業選びの軸
・第一志望か

各質問ごとに：

【質問】
【業界→企業→自分 の順で構造化回答】
【競合比較視点】
【深掘り想定】
【より刺さる改善案】

──────────────────
■ ③ 企業理解・仕事理解系

対象：
・当社の強み
・当社の課題
・必要な能力
・入社後やりたいこと
・10年後のビジョン

各質問ごとに：

【質問】
【具体的回答（事業・戦略・強みに言及）】
【追加で聞かれやすい論点】
【答えを一段深くする視点】

──────────────────
■ ④ 人柄・価値観系

対象：
・大切な価値観
・挫折経験
・ストレス対処法
・チーム衝突経験
・働く意味

各質問ごとに：

【質問】
【一貫性のある回答】
【価値観を裏付ける具体エピソード】
【深掘り想定】

──────────────────
■ ⑤ 応用・深掘り対応力強化

以下の汎用深掘りに対する思考テンプレートを提示：

・なぜそう考えたのか
・他の方法は？
・もう一度やるなら？
・その経験の本質的学びは？

加えて：
・回答の浅さチェックリスト
・論理破綻チェックポイント

──────────────────
■ ⑥ この会社特有の質問（必須）

会社概要（Step2）から、
その企業ならではの質問を最低5問生成する。

例：
・事業特性に関する質問
・業界課題への見解
・企業の最近の動向に関する意見
・企業文化との適合性確認質問
・過去の不祥事・課題への考え

各質問ごとに：

【質問】
【模範回答】
【深掘り想定】
【差がつく回答ポイント】

──────────────────
■ ⑦ 圧迫・意地悪質問対策（必須）

以下のカテゴリごとに想定質問と対策を生成すること。

【A. 志望動機への攻撃系】
例：「それって他社でもできますよね？」
　　「なぜ競合のXXXじゃないんですか？」
　　「うちじゃなくてもよくないですか？」

【B. 経験・スキルへの懐疑系】
例：「数学科なのになぜ文系職種を志望するんですか？」
　　「アルバイトの経験が仕事に活きるとは思えませんが」
　　「それはあなたじゃなくてもできますよね？」

【C. 一貫性を突く系】
例：「ESと今おっしゃったことが矛盾していますが」
　　「さっきと言っていることが違いませんか？」

【D. 詰め系】
例：「もっと具体的に言ってください」
　　「それで結果はどうだったんですか（数字で）」
　　「なぜそうしなかったんですか」

【E. 価値観・人格系】
例：「あなたって要するに自己中じゃないですか？」
　　「チームより個人プレーが好きそうですね」

各質問ごとに：
【質問】
【なぜこの質問をするか（面接官の意図）】
【やってはいけない返し方】
【模範的な切り返し方】
【さらに深掘りされた場合の対応】

【圧迫面接で使える汎用マインドセット】
・動揺しないための思考フレーム
・「わかりません」と言っていい場面・言い方
・沈黙が続いた時の対処法

加えて、会社概要（Step2）から読み取れるこの企業固有の
圧迫・意地悪質問を最低3問生成し、上記と同じ形式で回答すること。

──────────────────

最終出力は「実際の面接直前に使える完成版Q&A集」とすること。
`;
  var content = generateContent(prompt, { companyName: safeCompanyName });
  if (!content || content.trim().length < 100) {
    console.error('[Step4] Gemini の応答が短すぎます (' + (content ? content.length : 0) + '文字): ' + safeCompanyName);
    content = content || '（コンテンツの生成に失敗しました）';
  }
  var url = createDocFromContent(companyName, 'QA_COLLECTION', content);
  return { url: url, content: content };
}

/**
 * フェーズ・職種に応じたStep4向けの追加指示を生成
 */
function buildStep4PhaseInstruction(phase, jobType) {
  var lines = [];
  if (!phase && !jobType) return '';
  lines.push('');
  lines.push('【フェーズ・職種別の重点出力指示】');
  if (jobType) {
    lines.push('・「■ ③ 企業理解・仕事理解系」は「' + jobType + '」職種として入社後のイメージを具体的に語れる回答にすること。');
    lines.push('・職種固有のスキル・経験が問われる質問を「■ ⑥」に最低2問追加すること。');
  }
  if (phase === 'ES') {
    lines.push('・ESフェーズ: 設問に記述する文章として機能する回答を生成すること（200〜400字程度の文体で）。');
    lines.push('・志望動機・ガクチカ・自己PRを中心に、採用担当者が書類で見るポイントを重視すること。');
    lines.push('・「■ 0. 面接戦略サマリー」はES選考突破のための戦略サマリーとして記述すること。');
  } else if (phase === '1次面接') {
    lines.push('・1次面接フェーズ: 人事担当者が評価する基本的な自己PR・志望動機・人柄を重視した回答にすること。');
    lines.push('・話し言葉として自然に聞こえる文体（1〜2分で話せる量）で回答を生成すること。');
    lines.push('・専門性より「一緒に働きたいか」「熱意があるか」が伝わる構成を優先すること。');
  } else if (phase === '2次面接') {
    lines.push('・2次面接フェーズ: 現場社員・マネージャーが評価する職種理解・専門性・業務遂行力を重視すること。');
    lines.push('・「' + (jobType || '応募職種') + '」として具体的に何ができるか、過去経験との接続を必ず含めること。');
    lines.push('・チームワーク・主体性・現場での問題解決能力が伝わる質問を重点強化すること。');
  } else if (phase === '最終面接') {
    lines.push('・最終面接フェーズ: 役員・経営層が評価するビジョン・価値観・長期的な成長意欲を重視すること。');
    lines.push('・「なぜこの会社で長期的に働くのか」「会社の成長にどう貢献するか」を深掘りした回答にすること。');
    lines.push('・経営観・業界観・社会への貢献イメージが伝わる質問を「■ ⑥」に追加すること。');
  }
  return lines.join('\n');
}
