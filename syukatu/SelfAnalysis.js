/**
 * 自己分析：このファイル内の SELF_ANALYSIS を編集して使用。Step3〜6で参照。
 * UIでは入力しない。値を変えたら clasp push または GAS エディタで保存すること。
 */

var SELF_ANALYSIS = {
  content: ``
};

function getSelfAnalysis() {
  // Script Properties の 'SELF_ANALYSIS_CONTENT' でハードコード値を上書き可能
  try {
    var override = PropertiesService.getScriptProperties().getProperty('SELF_ANALYSIS_CONTENT');
    if (override && override.trim().length >= 30) {
      return { content: override.trim() };
    }
  } catch (e) {
    console.warn('[SelfAnalysis] Script Properties の読み込みに失敗: ' + e.message);
  }
  if (!SELF_ANALYSIS || !SELF_ANALYSIS.content || SELF_ANALYSIS.content.trim().length < 30) {
    console.warn('[SelfAnalysis] SELF_ANALYSIS.content が未設定または短いです。自己分析を記載すると精度が向上します。');
  }
  return SELF_ANALYSIS || { content: '' };
}
