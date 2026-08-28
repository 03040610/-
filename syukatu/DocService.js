/**
 * DocService：Google Documentのテンプレ複製・差し込み・URL返却
 * テンプレート未設定時は新規Docを作成。企業ごとにサブフォルダを作成。
 */
(function (global) {
  'use strict';

  /**
   * 親フォルダ（就活Doc自動生成）を取得または作成
   * @returns {Folder}
   */
  function getOrCreateAppRootFolder() {
    var rootFolderName = (CONFIG.DRIVE && CONFIG.DRIVE.ROOT_FOLDER_NAME) || '就活Doc自動生成';
    try {
      var folders = DriveApp.getFoldersByName(rootFolderName);
      if (folders.hasNext()) return folders.next();
      return DriveApp.createFolder(rootFolderName);
    } catch (e) {
      console.warn('[DocService] 親フォルダ取得/作成失敗、Driveルートを使用します: ' + e.message);
      return DriveApp.getRootFolder();
    }
  }

  /**
   * 会社名に対応するDriveフォルダを取得または作成（親フォルダ配下）
   * @param {string} companyName
   * @returns {Folder}
   */
  function getOrCreateCompanyFolder(companyName) {
    var safeName = (companyName || '名称未設定').replace(/[\\/:*?"<>|]/g, '').trim() || '名称未設定';
    try {
      var appRoot = getOrCreateAppRootFolder();
      var folders = appRoot.getFoldersByName(safeName);
      if (folders.hasNext()) return folders.next();
      return appRoot.createFolder(safeName);
    } catch (e) {
      console.warn('[DocService] 企業フォルダ取得/作成失敗、親フォルダに保存します: ' + e.message);
      return getOrCreateAppRootFolder();
    }
  }

  /**
   * 指定Doc種別のドキュメントを生成し、URLを返す
   *
   * @param {string} companyName - 会社名
   * @param {string} docType - CONFIG.DOC_TYPESのいずれか
   * @param {string} content - 差し込む本文
   * @returns {string} 生成したDocのURL
   */
  function createDocFromContent(companyName, docType, content) {
    var templateIds = getTemplateDocIds();
    var templateId = templateIds[docType];
    var doc;
    var docName = formatDocName(companyName, docType);
    var folder = getOrCreateCompanyFolder(companyName);

    if (templateId) {
      try {
        var template = DriveApp.getFileById(templateId);
        var copiedId = template.makeCopy(docName, folder).getId();
        doc = DocumentApp.openById(copiedId);
      } catch (e) {
        console.warn('[DocService] テンプレートコピー失敗（フォールバック: 新規作成）: ' + e.message);
        doc = null;
      }
    }

    if (!doc) {
      doc = DocumentApp.create(docName);
      try {
        DriveApp.getFileById(doc.getId()).moveTo(folder);
      } catch (e) {
        console.warn('[DocService] Docの移動に失敗しました: ' + e.message);
      }
    }

    insertContent(doc, content);
    try {
      doc.saveAndClose();
    } catch (e) {
      console.warn('[DocService] saveAndClose 失敗: ' + e.message);
    }
    return doc.getUrl();
  }

  /**
   * Doc名をフォーマット（例：「〇〇会社_参考URLまとめ」）
   */
  function formatDocName(companyName, docType) {
    var labels = {
      REFERENCE_URLS: '参考URLまとめ',
      COMPANY_OVERVIEW: '会社概要まとめ',
      APPEAL_POINTS: 'アピールポイント',
      QA_COLLECTION: '想定質問返答集',
      ES_OPTIMIZATION: 'ES自動最適化',
      REVERSE_QUESTIONS: '刺さる逆質問'
    };
    return companyName + '_' + (labels[docType] || docType);
  }

  /**
   * 本文をDocに差し込み
   * プレースホルダー {{CONTENT}} があれば差し替え、なければ行単位でスタイル付き挿入
   */
  function insertContent(doc, content) {
    var body = doc.getBody();
    var placeholder = body.findText('\\{\\{CONTENT\\}\\}');
    if (placeholder) {
      body.replaceText('\\{\\{CONTENT\\}\\}', content || '');
      return;
    }
    if (body.getText().length > 0) body.clear();
    var lines = (content || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;

      var para;
      if (/^■/.test(line)) {
        para = body.appendParagraph(line);
        para.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      } else if (/^【.+】/.test(line)) {
        para = body.appendParagraph(line);
        para.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      } else if (/^[・•]/.test(line)) {
        para = body.appendParagraph(line.replace(/^[・•]\s*/, ''));
        para.setIndentStart(16);
      } else if (/^──+/.test(line)) {
        para = body.appendParagraph(line);
        para.setForegroundColor('#999999');
      } else {
        body.appendParagraph(line);
      }
    }
  }

  global.createDocFromContent = createDocFromContent;
  global.formatDocName = formatDocName;
})(this);
