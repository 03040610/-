/**
 * GeminiClient：Gemini API呼び出し
 * - UrlFetchAppでREST
 * - リトライ（指数バックオフ）、タイムアウト、エラーハンドリング
 */
(function (global) {
  'use strict';

  var GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

  /**
   * APIキー取得（ハードコード禁止）
   * @returns {string}
   */
  function getApiKey() {
    var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key) {
      throw new Error('GEMINI_API_KEY is not set in Script Properties.');
    }
    return key;
  }

  /**
   * Gemini APIにコンテンツ生成を依頼
   *
   * @param {string} prompt - プロンプト（役割・ルール・依頼・データを1つにまとめたもの）
   * @param {Object} [context] - 追加コンテキスト（参考URL等）
   * @returns {string} 生成されたテキスト
   */
  function generateContent(prompt, context, customOptions) {
    var apiKey = getApiKey();
    var model = CONFIG.GEMINI.MODEL;
    var url = GEMINI_BASE_URL + model + ':generateContent';
    var maxRetries = CONFIG.GEMINI.MAX_RETRIES;
    var baseDelay = CONFIG.GEMINI.BASE_DELAY_MS;
    var maxOutputTokens = (customOptions && customOptions.maxOutputTokens) ? customOptions.maxOutputTokens : CONFIG.GEMINI.MAX_OUTPUT_TOKENS;

    var userText = (context && typeof context === 'object' ? '【追加コンテキスト】\n' + JSON.stringify(context, null, 0) + '\n\n' : '') + prompt;
    var payload = {
      contents: [{
        role: 'user',
        parts: [{ text: userText }]
      }],
      generationConfig: {
        temperature: CONFIG.GEMINI.TEMPERATURE,
        topP: CONFIG.GEMINI.TOP_P,
        maxOutputTokens: maxOutputTokens,
        responseMimeType: 'text/plain'
      }
    };

    var lastError;
    for (var i = 0; i <= maxRetries; i++) {
      try {
        var fetchOptions = {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'x-goog-api-key': apiKey
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };
        var response = UrlFetchApp.fetch(url, fetchOptions);
        var code = response.getResponseCode();
        var body = response.getContentText();

        if (code >= 200 && code < 300) {
          var data = JSON.parse(body);
          accumulateGeminiUsage(data);
          var text = extractTextFromResponse(data);
          if (text) return text;
          throw new Error('Empty or invalid Gemini response.');
        }

        if (code === 429 || code >= 500) {
          lastError = new Error('Gemini API error (HTTP ' + code + ')');
          if (i < maxRetries) {
            var delayMs = baseDelay * Math.pow(2, i);
            if (code === 429) {
              var retrySec = parseRetryAfterSeconds(body);
              if (retrySec > 0) delayMs = Math.max(delayMs, retrySec * 1000);
            }
            Utilities.sleep(delayMs);
            continue;
          }
        }

        throw new Error('Gemini API error (HTTP ' + code + ')');
      } catch (e) {
        lastError = e;
        if (e.message && (e.message.indexOf('timeout') !== -1 || e.message.indexOf('Timeout') !== -1)) {
          if (i < maxRetries) {
            Utilities.sleep(baseDelay * Math.pow(2, i));
            continue;
          }
        }
        throw new Error('[GeminiClient] ' + (e.message || String(e)));
      }
    }
    throw lastError || new Error('Gemini API failed after retries.');
  }

  /**
   * 429レスポンスから「何秒後にリトライ」を取得（RetryInfo / "retry in X.XXs"）
   * @param {string} body - レスポンスJSON文字列
   * @returns {number} 待機秒数（取得できない場合は 0）
   */
  function parseRetryAfterSeconds(body) {
    try {
      var data = JSON.parse(body);
      var details = data.error && data.error.details;
      if (details && Array.isArray(details)) {
        for (var d = 0; d < details.length; d++) {
          if (details[d]['@type'] && details[d]['@type'].indexOf('RetryInfo') !== -1 && details[d].retryDelay) {
            var s = details[d].retryDelay.replace(/s$/i, '').trim();
            var sec = parseFloat(s, 10);
            if (!isNaN(sec) && sec > 0) return Math.ceil(sec);
          }
        }
      }
      var m = body.match(/retry\s+in\s+([\d.]+)\s*s/i);
      if (m) {
        var sec = parseFloat(m[1], 10);
        if (!isNaN(sec) && sec > 0) return Math.ceil(sec);
      }
    } catch (e) { /* ignore */ }
    return 0;
  }

  /**
   * レスポンスからテキストを抽出
   * @param {Object} data - APIレスポンス
   * @returns {string|null}
   */
  function extractTextFromResponse(data) {
    try {
      var cands = data.candidates;
      if (!cands || cands.length === 0) {
        console.warn('[GeminiClient] レスポンスに candidates がありません');
        return null;
      }
      var parts = cands[0].content && cands[0].content.parts;
      if (!parts || parts.length === 0) {
        console.warn('[GeminiClient] レスポンスに parts がありません');
        return null;
      }
      return parts[0].text || null;
    } catch (e) {
      console.error('[GeminiClient] extractTextFromResponse 失敗: ' + e.message + ' | data: ' + JSON.stringify(data).substring(0, 200));
      return null;
    }
  }

  /**
   * レスポンスの usageMetadata からトークン使用量を集計
   */
  function accumulateGeminiUsage(data) {
    try {
      var u = data && data.usageMetadata;
      if (!u) return;
      if (!global.GEMINI_USAGE) {
        global.GEMINI_USAGE = {
          promptTokens: 0,
          candidatesTokens: 0,
          totalTokens: 0
        };
      }
      global.GEMINI_USAGE.promptTokens += u.promptTokenCount || 0;
      global.GEMINI_USAGE.candidatesTokens += u.candidatesTokenCount || 0;
      global.GEMINI_USAGE.totalTokens += u.totalTokenCount || 0;
    } catch (e) {}
  }

  /**
   * トークン使用量のリセット・取得（1リクエスト単位で利用）
   */
  function resetGeminiUsage() {
    global.GEMINI_USAGE = {
      promptTokens: 0,
      candidatesTokens: 0,
      totalTokens: 0
    };
  }

  function getGeminiUsage() {
    return global.GEMINI_USAGE || {
      promptTokens: 0,
      candidatesTokens: 0,
      totalTokens: 0
    };
  }

  global.generateContent = generateContent;
  global.getApiKey = getApiKey;
  global.resetGeminiUsage = resetGeminiUsage;
  global.getGeminiUsage = getGeminiUsage;
})(this);
