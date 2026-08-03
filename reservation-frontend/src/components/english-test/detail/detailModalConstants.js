export const DETAIL_MODAL_TABS = [
  { key: 'basic', label: '基本資料', icon: 'user' },
  { key: 'academic', label: '學籍資訊', icon: 'graduation-cap' },
  { key: 'special', label: '特殊身分', icon: 'heart' },
  { key: 'exam', label: '選考資料', icon: 'clipboard-list' },
  { key: 'files', label: '檔案附件', icon: 'file' },
];

export const DETAIL_MODAL_STATUS_OPTIONS = [
  { status: 'pending', label: '審核中', icon: 'clock' },
  { status: 'approved', label: '已通過', icon: 'check-circle', iconClass: 'text-success' },
  { status: 'revision', label: '請修正', icon: 'exclamation-triangle', iconClass: 'text-danger' },
  {
    status: 'success',
    label: '報名成功',
    icon: 'flag-checkered',
    iconClass: 'text-success',
    confirmDescription: '確定要將此筆設為「報名成功」嗎？',
  },
  {
    status: 'failed',
    label: '報名失敗',
    icon: 'times-circle',
    iconClass: 'text-secondary',
    confirmDescription: '確定要將此筆設為「報名失敗」嗎？',
  },
];

export const INITIAL_EXPANDED_SECTIONS = {
  basic: true,
  academic: false,
  special: false,
  files: false,
  exam: false,
};
