import React from 'react';

const NAV_BTN_STYLE = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 1051,
  width: '50px',
  height: '50px',
  borderRadius: '50%',
  border: '3px solid #007bff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#007bff',
  boxShadow: '0 4px 12px rgba(0,123,255,0.4)',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

function NavArrowButton({ side, onClick, title }) {
  const isLeft = side === 'left';
  return (
    <button
      type="button"
      className="btn btn-light"
      onClick={onClick}
      style={{ ...NAV_BTN_STYLE, [isLeft ? 'left' : 'right']: '-60px' }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = '#0056b3';
        e.target.style.borderColor = '#0056b3';
        e.target.style.transform = 'translateY(-50%) scale(1.15)';
        e.target.style.boxShadow = '0 6px 16px rgba(0,123,255,0.6)';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = '#007bff';
        e.target.style.borderColor = '#007bff';
        e.target.style.transform = 'translateY(-50%) scale(1)';
        e.target.style.boxShadow = '0 4px 12px rgba(0,123,255,0.4)';
      }}
      title={title}
    >
      <i
        className={`fas fa-chevron-${isLeft ? 'left' : 'right'}`}
        style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}
      />
    </button>
  );
}

function parseB2Files(b2CertificateFile) {
  try {
    const parsed = typeof b2CertificateFile === 'string'
      ? JSON.parse(b2CertificateFile)
      : b2CertificateFile;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return [b2CertificateFile];
  }
}

export default function EnglishTestLegacyDetailModal({
  registration,
  currentRegistrationIndex,
  registrationsLength,
  getStatusText,
  onClose,
  onNavigatePrevious,
  onNavigateNext,
  onQuickStatusUpdate,
}) {
  if (!registration) return null;

  const b2Files = registration.b2CertificateFile ? parseB2Files(registration.b2CertificateFile) : [];

  return (
    <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable" style={{ position: 'relative', margin: '0 auto' }}>
        {currentRegistrationIndex > 0 && (
          <NavArrowButton side="left" onClick={onNavigatePrevious} title="上一筆" />
        )}
        {currentRegistrationIndex < registrationsLength - 1 && (
          <NavArrowButton side="right" onClick={onNavigateNext} title="下一筆" />
        )}
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center w-100">
              <h5 className="modal-title mb-0">報名詳細資料 - {registration.name}</h5>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${registration.status === 'pending' ? 'btn-warning' : 'btn-outline-warning'}`}
                  onClick={() => onQuickStatusUpdate(null, 'pending')}
                  title="設為待審核"
                >
                  待審核
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${registration.status === 'approved' ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => onQuickStatusUpdate(null, 'approved')}
                  title="設為已通過"
                >
                  已通過
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${registration.status === 'revision' ? 'btn-danger' : 'btn-outline-danger'}`}
                  onClick={() => onQuickStatusUpdate(null, 'revision')}
                  title="設為請修正"
                >
                  請修正
                </button>
                <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="關閉" />
              </div>
            </div>
          </div>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-6 mb-3"><strong>學號：</strong> {registration.studentId}</div>
              <div className="col-md-6 mb-3"><strong>姓名：</strong> {registration.name}</div>
              <div className="col-md-6 mb-3"><strong>Email：</strong> {registration.email}</div>
              <div className="col-md-6 mb-3"><strong>電話：</strong> {registration.phone}</div>
              <div className="col-md-6 mb-3"><strong>出生日期：</strong> {registration.birthDate}</div>
              <div className="col-md-6 mb-3">
                <strong>英文姓名：</strong> {registration.lastNameEn} {registration.firstNameEn}
              </div>
              <div className="col-md-6 mb-3"><strong>學院：</strong> {registration.college}</div>
              <div className="col-md-6 mb-3"><strong>科系：</strong> {registration.department}</div>
              <div className="col-md-6 mb-3"><strong>年級：</strong> {registration.grade}</div>
              <div className="col-md-6 mb-3"><strong>就讀身分：</strong> {registration.degreeLevel}</div>
              <div className="col-12 mb-3">
                <strong>地址：</strong> {registration.postalCode} {registration.city} {registration.district} {registration.address}
              </div>
              <div className="col-md-6 mb-3"><strong>是否曾報考 BESTEP：</strong> {registration.hasTakenBESTEP}</div>
              <div className="col-md-6 mb-3"><strong>是否取得 CEFR B2：</strong> {registration.hasCEFRB2}</div>
              {registration.hasCEFRB2 === '是' && (
                <>
                  <div className="col-md-6 mb-3">
                    <strong>已通過測驗種類：</strong>
                    {registration.passedExamTypes && Array.isArray(registration.passedExamTypes)
                      ? registration.passedExamTypes.join(', ')
                      : '無'}
                  </div>
                  <div className="col-md-6 mb-3"><strong>B2 項目：</strong> {registration.b2SkillType || '無'}</div>
                </>
              )}
              <div className="col-md-6 mb-3"><strong>中低收入戶：</strong> {registration.isLowIncome}</div>
              <div className="col-md-6 mb-3"><strong>身心障礙手冊：</strong> {registration.hasDisabilityCard}</div>
              <div className="col-md-6 mb-3"><strong>資訊來源：</strong> {registration.infoSource}</div>
              <div className="col-md-6 mb-3">
                <strong>狀態：</strong>
                <span className={`badge bg-${getStatusText(registration.status).class} ms-2`}>
                  {getStatusText(registration.status).text}
                </span>
              </div>
              {registration.notes && (
                <div className="col-12 mb-3">
                  <strong>備註：</strong>
                  <div className="mt-2 p-2 bg-light rounded">{registration.notes}</div>
                </div>
              )}
              <div className="col-12 mb-3">
                <strong>報名時間：</strong> {new Date(registration.createdAt).toLocaleString('zh-TW')}
              </div>
              {registration.idPhoto && (
                <div className="col-12 mb-3">
                  <strong>證件照：</strong>
                  <div className="mt-2">
                    <img
                      src={`/uploads/${registration.idPhoto}`}
                      alt="證件照"
                      style={{
                        maxWidth: '300px',
                        maxHeight: '400px',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                      onClick={() => window.open(`/uploads/${registration.idPhoto}`, '_blank')}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{ display: 'none', color: '#999' }}>圖片載入失敗</div>
                  </div>
                </div>
              )}
              {b2Files.length > 0 && (
                <div className="col-12 mb-3">
                  <strong>B2 成績證明：</strong>
                  <div className="mt-2 d-flex gap-2 flex-wrap">
                    {b2Files.map((file, index) => (
                      <a
                        key={index}
                        href={`/uploads/${file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        查看檔案 {b2Files.length > 1 ? `(${index + 1})` : ''}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {(registration.disabilityCertFront || registration.disabilityCertBack) && (
                <div className="col-12 mb-3">
                  <strong>身心障礙證明：</strong>
                  <div className="mt-2 d-flex gap-2">
                    {registration.disabilityCertFront && (
                      <a
                        href={`/uploads/${registration.disabilityCertFront}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        正面
                      </a>
                    )}
                    {registration.disabilityCertBack && (
                      <a
                        href={`/uploads/${registration.disabilityCertBack}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        反面
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>關閉</button>
          </div>
        </div>
      </div>
    </div>
  );
}
