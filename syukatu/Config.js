/**
 * 設定・定数（Gemini、Doc種別、テンプレート、制限値）
 */
var CONFIG = {
  GEMINI: {
    MODEL: 'gemini-2.5-flash',
    MAX_RETRIES: 3, // GAS 6分制限を考慮し最大3回に最適化
    BASE_DELAY_MS: 1500,
    TEMPERATURE: 0.3,
    TOP_P: 0.95,
    MAX_OUTPUT_TOKENS: 8192,
    STEP_DELAY_MS: 0,
    // Gemini 2.5 Flash 公式料金
    INPUT_PRICE_PER_1M_USD: 0.30,
    OUTPUT_PRICE_PER_1M_USD: 2.50,
    USD_TO_JPY: 150
  },
  DOC_TYPES: [
    'REFERENCE_URLS',
    'COMPANY_OVERVIEW',
    'APPEAL_POINTS',
    'QA_COLLECTION',
    'ES_OPTIMIZATION',
    'REVERSE_QUESTIONS'
  ],
  DRIVE: {
    ROOT_FOLDER_NAME: '就活Doc自動生成'
  },
  LIMITS: {
    MAX_TEXT_INPUT_LENGTH: 2000,
    MAX_URLS_PER_FIELD: 10,
    MAX_ES_QUESTIONS: 10
  },
  TEMPLATE_DOC_IDS: {}
};

function getTemplateDocIds() {
  try {
    var json = PropertiesService.getScriptProperties().getProperty('TEMPLATE_DOC_IDS_JSON');
    if (json) return JSON.parse(json);
  } catch (e) {
    console.warn('[Config] TEMPLATE_DOC_IDS_JSON のパースに失敗しました: ' + e.message);
  }
  return CONFIG.TEMPLATE_DOC_IDS || {};
}

