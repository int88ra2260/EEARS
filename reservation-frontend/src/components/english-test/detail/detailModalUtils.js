export const getStatusText = (status) => {
  const statusMap = {
    pending: { text: '審核中', class: 'warning' },
    approved: { text: '已通過', class: 'success' },
    revision: { text: '請修正', class: 'danger' },
    success: { text: '報名成功', class: 'success' },
    failed: { text: '報名失敗', class: 'secondary' },
  };

  return statusMap[status] || { text: status, class: 'secondary' };
};

export const getExamTypeText = (examType) => {
  const raw = String(examType || '').trim();
  if (!raw) return '未填寫';
  if (
    raw === 'LRSW'
    || raw === '聽讀說寫'
    || raw.includes('（LRSW）')
    || raw.includes('(LRSW)')
    || raw.startsWith('聽說讀寫')
    || raw.startsWith('四項全考')
  ) {
    return '四項全考';
  }
  if (raw === 'LR' || raw.includes('（LR）') || raw.includes('(LR)') || raw.startsWith('聽讀')) {
    return '聽讀';
  }
  if (raw === 'SW' || raw.includes('（SW）') || raw.includes('(SW)') || raw.startsWith('說寫')) {
    return '說寫';
  }
  if (raw === 'NON' || raw.includes('（NON）') || raw.includes('(NON)') || raw.startsWith('不報考')) {
    return '不報考';
  }
  return raw;
};

export const parseB2Files = (b2CertificateFile) => {
  if (!b2CertificateFile) return [];

  try {
    const parsed =
      typeof b2CertificateFile === 'string' ? JSON.parse(b2CertificateFile) : b2CertificateFile;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    return [b2CertificateFile];
  }
};

export const getFirstB2File = (b2CertificateFile) => {
  const files = parseB2Files(b2CertificateFile);
  return files[0] || null;
};
