/**
 * Step3: APPEAL_POINTS（アピールポイント）
 * 入力: 会社名、Step2の結果（会社概要）、自己分析
 */
function runStep3(companyName, step2Result, selfAnalysis) {
  var safeCompanyName = (companyName || '').replace(/[`\\]/g, '');
  var overview = (step2Result && step2Result.content) ? step2Result.content : '';
  var selfStr = (selfAnalysis && typeof selfAnalysis.content === 'string') ? selfAnalysis.content : JSON.stringify(selfAnalysis || {}, null, 0);
  var prompt = `
あなたは就活支援に特化した自己分析・企業接続アシスタントです。

【最重要ルール】
・推測禁止。不明な点は必ず「不明」と記載。
・会社情報は必ず Step2 の内容を根拠にする。
・抽象的表現は禁止（例：「頑張り屋」→具体行動に分解）。
・企業の求める人物像との接続を明確に示す。

【入力情報】

■ 会社概要（Step2の結果）
${overview}

■ 自己分析情報
${selfStr}

上記のみを根拠に整理すること。

【出力構造】

■ 0. 結論（この会社に最も刺さる強み3つ）

■ 1. 会社と自身の接点（論理的に）
・企業の強み／方向性
・求める人物像
・事業特性
↓
・自分のどの経験が接続するか
※接続ロジックを明文化

■ 2. アピール可能な強み（具体）
各強みについて：
・強みの定義（具体的行動レベル）
・裏付けエピソード要約
・企業でどう再現できるか
・どの事業／職種で活きるか

■ 3. 志望動機の方向性（構造化）
・なぜこの業界か
・なぜこの会社か（競合との差別化込み）
・なぜ自分が貢献できるか
※三段論法で整理

■ 4. 面接で使えるエピソード（STAR形式）
Situation：
Task：
Action：
Result：
学び：
企業での再現性：

■ 5. 想定される深掘り質問と回答準備ポイント
・弱みを聞かれた場合
・なぜ他社ではないのか
・挫折経験
・チーム経験

論理の飛躍がないように構造化して出力すること。
`;
  var content = generateContent(prompt, { companyName: safeCompanyName });
  if (!content || content.trim().length < 100) {
    console.error('[Step3] Gemini の応答が短すぎます (' + (content ? content.length : 0) + '文字): ' + safeCompanyName);
    content = content || '（コンテンツの生成に失敗しました）';
  }
  var url = createDocFromContent(companyName, 'APPEAL_POINTS', content);
  return { url: url, content: content };
}
