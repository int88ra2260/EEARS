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
  if (examType === 'LRSW') return '四項全考';
  if (examType === 'LR') return '聽讀';
  if (examType === 'SW') return '說寫';
  if (examType === 'NON') return '不報考';
  return examType || '未填寫';
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
