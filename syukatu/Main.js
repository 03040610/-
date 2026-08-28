/**
 * メイン：doGet / include / generateCompanyPack（全ステップのオーケストレーション）
 * 実行関数はすべてこのファイルに集約
 */

function doGet(e) {
  try {
    var html = HtmlService.createTemplateFromFile('Ui').evaluate();
    html.setTitle('就活Doc自動生成');
    html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN);
    return html;
  } catch (err) {
    var msg = (err && err.message) ? err.message : String(err);
    var safeMsg = escapeHtml(msg);
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>エラー</title></head><body><h1>エラー</h1><pre>' + safeMsg + '</pre></body></html>'
    ).setTitle('就活Doc自動生成');
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Gemini 使用量から概算コスト（円）を計算（2.5 Flash: Input $0.30/100万, Output $2.50/100万）
 */
function calcGeminiCostYen(usage) {
  if (!usage || !CONFIG || !CONFIG.GEMINI) return null;
  var g = CONFIG.GEMINI;
  var inPrice = typeof g.INPUT_PRICE_PER_1M_USD === 'number' ? g.INPUT_PRICE_PER_1M_USD : 0.30;
  var outPrice = typeof g.OUTPUT_PRICE_PER_1M_USD === 'number' ? g.OUTPUT_PRICE_PER_1M_USD : 2.50;
  var rate = typeof g.USD_TO_JPY === 'number' ? g.USD_TO_JPY : 150;
  var prompt = (usage.promptTokens || 0) / 1000000 * inPrice;
  var candidates = (usage.candidatesTokens || 0) / 1000000 * outPrice;
  var usd = prompt + candidates;
  return Math.round(usd * rate * 100) / 100;
}

/**
 * CacheServiceに進捗を書き込む（TTL: 300秒）
 */
function writeGenerationProgress(key, step, label, totalSteps) {
  try {
    CacheService.getUserCache().put(
      key,
      JSON.stringify({ step: step, label: label, totalSteps: totalSteps || 6 }),
      300
    );
  } catch (e) {
    console.warn('[Main] 進捗の書き込みに失敗: ' + e.message);
  }
}

/**
 * UIポーリング用：現在の生成進捗を返す
 * @param {string} progressKey
 * @returns {{ step: number, label: string, totalSteps: number }}
 */
function getGenerationProgress(progressKey) {
  try {
    var val = CacheService.getUserCache().get(progressKey);
    if (val) return JSON.parse(val);
  } catch (e) {
    console.warn('[Main] 進捗の読み込みに失敗: ' + e.message);
  }
  return { step: 0, label: '待機中', totalSteps: 6 };
}

/**
 * 入力データのサニタイズおよびバリデーション（DoS・プロンプトインジェクション・不正データ防止）
 */
function sanitizeInputData(raw) {
  var data = (raw && typeof raw === 'object') ? raw : {};
  var maxLen = (CONFIG.LIMITS && CONFIG.LIMITS.MAX_TEXT_INPUT_LENGTH) || 2000;
  var maxUrls = (CONFIG.LIMITS && CONFIG.LIMITS.MAX_URLS_PER_FIELD) || 10;
  var maxQuestions = (CONFIG.LIMITS && CONFIG.LIMITS.MAX_ES_QUESTIONS) || 10;

  function cleanString(val, limit) {
    if (typeof val !== 'string') return '';
    // 不可視制御文字を取り除き、長さを制限
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().substring(0, limit || maxLen);
  }

  function cleanUrl(val) {
    var s = cleanString(val, 500);
    // httpまたはhttpsから始まる有効なURL形式のみ許可
    if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s)) {
      return s;
    }
    return '';
  }

  function cleanUrlList(list) {
    if (!Array.isArray(list)) return [];
    var res = [];
    for (var i = 0; i < Math.min(list.length, maxUrls); i++) {
      var u = cleanUrl(list[i]);
      if (u) res.push(u);
    }
    return res;
  }

  function cleanQuestions(list) {
    if (!Array.isArray(list)) return [];
    var res = [];
    for (var i = 0; i < Math.min(list.length, maxQuestions); i++) {
      var item = list[i];
      if (!item || typeof item !== 'object') continue;
      var q = cleanString(item.question, 500);
      var lim = parseInt(item.charLimit, 10);
      if (q) {
        res.push({
          question: q,
          charLimit: (lim >= 50 && lim <= 3000) ? lim : 400
        });
      }
    }
    return res;
  }

  var validPhases = ['ES', '1次面接', '2次面接', '最終面接'];
  var phase = cleanString(data.phase, 50);
  if (validPhases.indexOf(phase) === -1) {
    phase = '';
  }

  return {
    recruitUrl: cleanUrl(data.recruitUrl),
    jobType: cleanString(data.jobType, 100),
    phase: phase,
    irUrls: cleanUrlList(data.irUrls),
    interviewUrls: cleanUrlList(data.interviewUrls),
    newsUrls: cleanUrlList(data.newsUrls),
    pastQuestions: cleanString(data.pastQuestions, maxLen),
    concerns: cleanString(data.concerns, maxLen),
    esMode: data.esMode === 'custom' ? 'custom' : 'template',
    customEsQuestions: cleanQuestions(data.customEsQuestions),
    additionalEsQuestions: cleanQuestions(data.additionalEsQuestions)
  };
}

/**
 * 会社名で Step1→Step6 を順に実行し、6本のDocを生成
 * @param {string} companyName - 会社名
 * @param {Object} [inputData] - UI拡張入力データ
 * @param {string} [progressKey] - CacheService用の進捗キー（UIがポーリングに使用）
 * @returns {{ success: boolean, docUrls: object, totalTokens?: number, costYen?: number, error?: string }}
 */
function generateCompanyPack(companyName, inputData, progressKey) {
  var companyNameSanitized = (companyName || '').toString().replace(/[\x00-\x1F\x7F\\/:*?"<>|]/g, '').trim().substring(0, 100);
  if (!companyNameSanitized) {
    return { success: false, error: '有効な会社名を入力してください。', docUrls: null };
  }

  var safeInputData = sanitizeInputData(inputData);
  var pKey = progressKey || ('gen_' + encodeURIComponent(companyNameSanitized) + '_' + Date.now());

  if (typeof resetGeminiUsage === 'function') {
    resetGeminiUsage();
  }

  var docUrls = {};
  var currentStep = 0;
  try {
    var selfAnalysis = getSelfAnalysis();

    currentStep = 1;
    writeGenerationProgress(pKey, 0, 'Step1: 参考URL を取得中…');
    console.log('[Main] Step1 開始: ' + companyNameSanitized);
    var r1 = runStep1(companyNameSanitized, safeInputData);
    docUrls.REFERENCE_URLS = r1.url;
    writeGenerationProgress(pKey, 1, 'Step1: 参考URLまとめ 完了');
    console.log('[Main] Step1 完了');

    currentStep = 2;
    writeGenerationProgress(pKey, 1, 'Step2: 会社概要 を生成中…');
    console.log('[Main] Step2 開始');
    var r2 = runStep2(companyNameSanitized, r1, safeInputData);
    docUrls.COMPANY_OVERVIEW = r2.url;
    writeGenerationProgress(pKey, 2, 'Step2: 会社概要まとめ 完了');
    console.log('[Main] Step2 完了');

    currentStep = 3;
    writeGenerationProgress(pKey, 2, 'Step3: アピールポイント を生成中…');
    console.log('[Main] Step3 開始');
    var r3 = runStep3(companyNameSanitized, r2, selfAnalysis);
    docUrls.APPEAL_POINTS = r3.url;
    writeGenerationProgress(pKey, 3, 'Step3: アピールポイント 完了');
    console.log('[Main] Step3 完了');

    currentStep = 4;
    writeGenerationProgress(pKey, 3, 'Step4: 想定Q&A を生成中…');
    console.log('[Main] Step4 開始');
    var r4 = runStep4(companyNameSanitized, r2, r3, selfAnalysis, safeInputData);
    docUrls.QA_COLLECTION = r4.url;
    writeGenerationProgress(pKey, 4, 'Step4: 想定質問返答集 完了');
    console.log('[Main] Step4 完了');

    currentStep = 5;
    writeGenerationProgress(pKey, 4, 'Step5: ES最適化 を生成中…');
    console.log('[Main] Step5 開始');
    var r5 = runStep5(companyNameSanitized, r2, r3, selfAnalysis, safeInputData);
    docUrls.ES_OPTIMIZATION = r5.url;
    writeGenerationProgress(pKey, 5, 'Step5: ES自動最適化 完了');
    console.log('[Main] Step5 完了');

    currentStep = 6;
    writeGenerationProgress(pKey, 5, 'Step6: 逆質問 を生成中…');
    console.log('[Main] Step6 開始');
    var r6 = runStep6(companyNameSanitized, r2, r3, selfAnalysis, r5, safeInputData);
    docUrls.REVERSE_QUESTIONS = r6.url;
    writeGenerationProgress(pKey, 6, 'Step6: 刺さる逆質問 完了', 6);
    console.log('[Main] Step6 完了 — 全ステップ終了');

    var totalTokens = null;
    var costYen = null;
    if (typeof getGeminiUsage === 'function') {
      var usage = getGeminiUsage();
      if (usage && typeof usage.totalTokens === 'number') {
        totalTokens = usage.totalTokens;
        costYen = calcGeminiCostYen(usage);
      }
    }

    return { success: true, docUrls: docUrls, totalTokens: totalTokens, costYen: costYen };
  } catch (e) {
    var errMsg = 'Step' + currentStep + 'でエラー: ' + ((e && e.message) ? e.message : String(e));
    console.error('[Main] ' + errMsg + '\n' + (e && e.stack ? e.stack : ''));
    writeGenerationProgress(pKey, currentStep, 'エラー: ' + errMsg);
    var totalTokensErr = null;
    var costYenErr = null;
    if (typeof getGeminiUsage === 'function') {
      var usageErr = getGeminiUsage();
      if (usageErr && typeof usageErr.totalTokens === 'number') {
        totalTokensErr = usageErr.totalTokens;
        costYenErr = calcGeminiCostYen(usageErr);
      }
    }
    return {
      success: false,
      error: errMsg,
      docUrls: docUrls,
      totalTokens: totalTokensErr,
      costYen: costYenErr
    };
  }
}
