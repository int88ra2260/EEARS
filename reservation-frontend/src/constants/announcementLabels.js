/** 與後端 announcementConstants category 對齊 */
export const ANNOUNCEMENT_CATEGORY_LABELS = {
  general: '一般',
  activity: '活動',
  policy: '政策',
  system: '系統',
  emergency: '緊急',
};

/** 狀態徽章 hover 說明 */
export const ANNOUNCEMENT_STATUS_HINTS = {
  draft: '尚未發布，前台不可見。',
  scheduled: '已設定排程，到時間會自動發布。',
  published: '前台可見中（首頁、公告列表）。',
  unpublished: '已暫時下架，前台不可見；可按「再發布」恢復。',
  archived: '已長期封存，前台不可見；後台仍可查詢、編輯、複製。',
};

/** 操作按鈕 hover 說明 */
export const ANNOUNCEMENT_ACTION_HINTS = {
  edit: '編輯標題、內容、排程與 SEO 等設定。',
  publish: '讓公告出現在前台（首頁、公告列表）。',
  republish: '重新發布，讓公告再次出現在前台。',
  unpublish: '暫時隱藏：適合活動延期、內容修正中；之後可再發布，下架時間會被記錄。',
  archive: '長期歸檔：適合過期或不再當現行資訊的公告；後台仍可查詢，之後也可再發布。',
  pin: '置頂後排序優先，仍須為已發布狀態才會出現在前台。',
  unpin: '取消置頂，恢復一般排序。',
  duplicate: '複製為新草稿，方便改寫後再發布。',
  delete: '軟刪除：極少使用，背景仍保留資料供稽核。',
};

/** 頁首工作流程對照 */
export const ANNOUNCEMENT_WORKFLOW_ROWS = [
  {
    action: '下架',
    suitable: '暫時不顯示，之後可能再發（活動延期、內容修正）',
    frontend: '不可見',
    recover: '按「再發布」',
  },
  {
    action: '封存',
    suitable: '確定不再當現行公告，但需保留後台查詢（舊政策、年度彙整）',
    frontend: '不可見',
    recover: '仍可「再發布」，但建議僅作例外',
  },
  {
    action: '刪除',
    suitable: '極少使用；軟刪除保留背景資料',
    frontend: '不可見',
    recover: '需由工程／DB 處理，一般使用者勿用',
  },
];

export function getAnnouncementPublishAction(row) {
  const isLive = row?.status === 'published' || row?.isPublished === true;
  if (isLive) {
    return { label: '下架', hint: ANNOUNCEMENT_ACTION_HINTS.unpublish, willUnpublish: true };
  }
  const hint =
    row?.status === 'archived'
      ? `${ANNOUNCEMENT_ACTION_HINTS.republish}（目前為已封存）`
      : row?.status === 'unpublished'
        ? `${ANNOUNCEMENT_ACTION_HINTS.republish}（目前為已下架）`
        : ANNOUNCEMENT_ACTION_HINTS.publish;
  return { label: '再發布', hint, willUnpublish: false };
}

export function getUnpublishConfirmCopy(title) {
  return {
    title: '確認下架（暫時隱藏）',
    description: `「${title}」將從前台隱藏。\n\n• 適合：活動延期、內容修正、暫時撤回\n• 之後可按「再發布」恢復顯示\n• 系統會記錄下架時間`,
    confirmText: '確定下架',
  };
}

export function getArchiveConfirmCopy(title) {
  return {
    title: '確認封存（長期歸檔）',
    description: `「${title}」將標記為已封存。\n\n• 適合：過期公告、舊政策、不再當現行資訊\n• 前台不可見，但後台仍可查詢、編輯、複製\n• 若日後需要，仍可按「再發布」`,
    confirmText: '確定封存',
  };
}

export function getPublishConfirmCopy(title, status) {
  const fromState =
    status === 'archived' ? '（目前為已封存）' : status === 'unpublished' ? '（目前為已下架）' : '';
  return {
    title: status === 'draft' || status === 'scheduled' ? '確認發布' : '確認再發布',
    description: `確定要${status === 'draft' || status === 'scheduled' ? '發布' : '再發布'}「${title}」${fromState}嗎？\n\n發布後將出現在前台公告列表與相關展示位置。`,
    confirmText: status === 'draft' || status === 'scheduled' ? '確定發布' : '確定再發布',
  };
}
