// components/english-test/QuickReviewMode.js
import React, { useState, useEffect } from 'react';
import PhotoViewer from './PhotoViewer';
import { rejectionReasonOptions } from '../../constants/englishTestRejectionReasons';

export default function QuickReviewMode({
  registration,
  onApprove,
  onReject,
  onNext,
  onClose,
  autoNext = false
}) {
  const [rejectionReasons, setRejectionReasons] = useState([]);
  const [rejectionOther, setRejectionOther] = useState('');
  const [photoFileSize, setPhotoFileSize] = useState(null);
  const [photoFileSizeLoading, setPhotoFileSizeLoading] = useState(false);

  const handleApprove = async () => {
    if (onApprove) {
      await onApprove();
      if (autoNext && onNext) {
        setTimeout(() => onNext(), 500);
      }
    }
  };

  const handleReject = () => {
    if (rejectionReasons.length === 0) {
      try {
        window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: '請至少選擇一個拒絕原因', variant: 'warning' } }));
      } catch (_) {}
      return;
    }
    if (rejectionReasons.includes('其他') && (!rejectionOther || rejectionOther.trim() === '')) {
      try {
        window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: '選擇「其他」拒絕原因時，必須填寫說明', variant: 'warning' } }));
      } catch (_) {}
      return;
    }
    if (onReject) {
      onReject(rejectionReasons, rejectionOther);
      if (autoNext && onNext) {
        setTimeout(() => onNext(), 500);
      }
    }
  };

  // 資料完整性檢查
  const checkDataCompleteness = () => {
    const issues = [];
    if (!registration.email) issues.push('缺少 Email');
    if (!registration.phone) issues.push('缺少電話');
    if (!registration.idPhoto) issues.push('缺少證件照');
    if (!registration.college || !registration.department) issues.push('缺少學院或科系');
    return issues;
  };

  const completenessIssues = checkDataCompleteness();

  // 獲取證件照檔案大小
  useEffect(() => {
    const fetchPhotoSize = async () => {
      if (!registration.idPhoto) {
        setPhotoFileSize(null);
        return;
      }

      setPhotoFileSizeLoading(true);
      try {
        const imageUrl = registration.idPhoto.startsWith('/') 
          ? registration.idPhoto 
          : `/uploads/${registration.idPhoto}`;
        
        const response = await fetch(imageUrl, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        
        if (contentLength) {
          const sizeInBytes = parseInt(contentLength, 10);
          setPhotoFileSize(sizeInBytes);
        } else {
          // 如果 HEAD 請求沒有返回大小，嘗試 GET 請求（僅獲取部分數據）
          const blobResponse = await fetch(imageUrl);
          const blob = await blobResponse.blob();
          setPhotoFileSize(blob.size);
        }
      } catch (error) {
        console.error('無法獲取圖片檔案大小:', error);
        setPhotoFileSize(null);
      } finally {
        setPhotoFileSizeLoading(false);
      }
    };

    fetchPhotoSize();
  }, [registration.idPhoto]);

  // 格式化檔案大小
  const formatFileSize = (bytes) => {
    if (!bytes) return '未知';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-dialog" style={{ maxWidth: '95vw', width: '95vw', margin: '1.75rem auto' }}>
        <div className="modal-content" style={{ fontSize: '1.15rem' }}>
          <div className="modal-header bg-primary text-white" style={{ fontSize: '1.3rem', padding: '1.25rem 1.5rem' }}>
            <h5 className="modal-title" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              快速審核模式 - {registration.name} - {
                // 報名編號：優先顯示 semesterSequence（按學期編號），其次 successSequence（如果狀態是 success），最後才是 id
                registration.semesterSequence || (registration.status === 'success' && registration.successSequence) || registration.id
              }
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          
          <div className="modal-body" style={{ padding: '1.5rem', fontSize: '1.15rem' }}>
            <div className="row">
              {/* 左側：證件照（大圖顯示） */}
              <div className="col-md-5">
                <div className="card">
                  <div className="card-body">
                    <h6 className="card-title mb-3" style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>證件照</h6>
                    {registration.idPhoto ? (
                      <>
                        <PhotoViewer
                          imageUrl={registration.idPhoto}
                          alt="證件照"
                        />
                        <div className="mt-3" style={{ fontSize: '1.1rem' }}>
                          <strong>檔案大小：</strong>
                          {photoFileSizeLoading ? (
                            <span className="text-muted">載入中...</span>
                          ) : (
                            <span>{formatFileSize(photoFileSize)}</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="alert alert-warning" style={{ fontSize: '1.1rem' }}>
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        未上傳證件照
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 右側：關鍵資訊 */}
              <div className="col-md-7">
                <div className="card mb-3">
                  <div className="card-body">
                    <h6 className="card-title mb-3" style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>關鍵資訊</h6>
                    <div className="row" style={{ fontSize: '1.1rem' }}>
                      <div className="col-6 mb-3">
                        <strong style={{ fontSize: '1.15rem' }}>學號：</strong> {registration.studentId}
                      </div>
                      <div className="col-6 mb-3">
                        <strong style={{ fontSize: '1.15rem' }}>姓名：</strong> {registration.name}
                      </div>
                      <div className="col-6 mb-3">
                        <strong style={{ fontSize: '1.15rem' }}>Email：</strong> {registration.email || <span className="text-danger">未填寫</span>}
                      </div>
                      <div className="col-6 mb-3">
                        <strong style={{ fontSize: '1.15rem' }}>電話：</strong> {registration.phone || <span className="text-danger">未填寫</span>}
                      </div>
                      <div className="col-6 mb-3">
                        <strong style={{ fontSize: '1.15rem' }}>學院：</strong> {registration.college || <span className="text-danger">未填寫</span>}
                      </div>
                      <div className="col-6 mb-3">
                        <strong style={{ fontSize: '1.15rem' }}>科系：</strong> {registration.department || <span className="text-danger">未填寫</span>}
                      </div>
                      <div className="col-6 mb-3">
                        <strong style={{ fontSize: '1.15rem' }}>測驗類型：</strong> 
                        {registration.examType === 'LRSW' ? '四項全考' :
                         registration.examType === 'LR' ? '聽讀' :
                         registration.examType === 'SW' ? '說寫' :
                         registration.examType === 'NON' ? '不報考' : registration.examType}
                      </div>
                      <div className="col-6 mb-3">
                        <strong style={{ fontSize: '1.15rem' }}>狀態：</strong>
                        <span className={`badge bg-${registration.status === 'pending' ? 'warning' : registration.status === 'approved' ? 'success' : registration.status === 'revision' ? 'danger' : registration.status === 'success' ? 'success' : 'secondary'} ms-2`} style={{ fontSize: '1rem', padding: '0.4rem 0.8rem' }}>
                          {registration.status === 'pending' ? '審核中' : registration.status === 'approved' ? '已通過' : registration.status === 'revision' ? '請修正' : registration.status === 'success' ? '報名成功' : registration.status === 'failed' ? '報名失敗' : registration.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 資料完整性檢查提示 */}
                {completenessIssues.length > 0 && (
                  <div className="alert alert-warning mb-3" style={{ fontSize: '1.1rem' }}>
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    <strong style={{ fontSize: '1.15rem' }}>資料完整性檢查：</strong>
                    <ul className="mb-0 mt-2">
                      {completenessIssues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 拒絕原因選擇（展開/收起） */}
                <div className="card">
                  <div className="card-body">
                    <button
                      className="btn btn-link p-0 mb-2"
                      onClick={() => {
                        const panel = document.getElementById('rejectionPanel');
                        if (panel) {
                          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                        }
                      }}
                      style={{ fontSize: '1.15rem', fontWeight: 'bold' }}
                    >
                      <i className="fas fa-chevron-down me-1"></i>
                      選擇拒絕原因（如需要）
                    </button>
                    <div id="rejectionPanel" style={{ display: 'none' }}>
                      <div className="mb-3">
                        <label className="form-label" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>拒絕原因（可複選）：</label>
                        <div className="row">
                          {rejectionReasonOptions.map(option => (
                            <div key={option.id} className="col-md-6 mb-2">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`quick-rejection-${option.id}`}
                                  checked={rejectionReasons.includes(option.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRejectionReasons([...rejectionReasons, option.id]);
                                    } else {
                                      setRejectionReasons(rejectionReasons.filter(id => id !== option.id));
                                    }
                                  }}
                                  style={{ width: '1.2rem', height: '1.2rem' }}
                                />
                                <label className="form-check-label" htmlFor={`quick-rejection-${option.id}`} style={{ fontSize: '1.1rem', marginLeft: '0.5rem' }}>
                                  {option.text}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {rejectionReasons.includes('其他') && (
                        <div className="mb-3">
                          <label className="form-label" style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>其他原因說明：</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            value={rejectionOther}
                            onChange={(e) => setRejectionOther(e.target.value)}
                            placeholder="請詳細說明拒絕原因"
                            style={{ fontSize: '1.1rem' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '1.25rem 1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ fontSize: '1.15rem', padding: '0.6rem 1.2rem' }}
            >
              關閉
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleReject}
              style={{ fontSize: '1.15rem', padding: '0.6rem 1.2rem' }}
            >
              <i className="fas fa-times me-1"></i>
              拒絕(請修正)
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleApprove}
              style={{ fontSize: '1.15rem', padding: '0.6rem 1.2rem' }}
            >
              <i className="fas fa-check me-1"></i>
              通過
            </button>
            {autoNext && onNext && (
              <button
                type="button"
                className="btn btn-info"
                onClick={onNext}
                style={{ fontSize: '1.15rem', padding: '0.6rem 1.2rem' }}
              >
                <i className="fas fa-arrow-right me-1"></i>
                下一筆
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
