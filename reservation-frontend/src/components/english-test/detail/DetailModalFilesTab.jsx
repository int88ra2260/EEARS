import React from 'react';
import PhotoViewer from '../PhotoViewer';
import { getFirstB2File, parseB2Files } from './detailModalUtils';
import { TabPanel } from './detailModalTabShell';

export default function DetailModalFilesTab({
  registration,
  isEditing,
  editFileInputs,
  handleFileInputChange,
  onUploadRegistrationFiles,
  embedded = false,
}) {
  return (
    <TabPanel embedded={embedded}>
      {isEditing && onUploadRegistrationFiles && (
        <div className="alert alert-info mb-3">
          <i className="fas fa-info-circle me-2"></i>
          <strong>後台編輯</strong>
          ：可在此更換或新增證件照、B2 成績證明、身心障礙證明，選好檔案後點擊下方「儲存」一併送出。
        </div>
      )}

      <div className="mb-4">
        <h6 className="mb-3">證件照</h6>
        {!isEditing && registration.idPhoto && (
          <PhotoViewer imageUrl={registration.idPhoto} alt="證件照" />
        )}
        {isEditing && onUploadRegistrationFiles && (
          <div>
            {registration.idPhoto && (
              <div className="mb-2">
                <span className="text-muted me-2">目前：</span>
                <a
                  href={`/uploads/${registration.idPhoto}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-secondary btn-sm me-2"
                >
                  查看
                </a>
              </div>
            )}
            <label className="btn btn-outline-primary btn-sm mb-0">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="d-none"
                onChange={(e) => handleFileInputChange('idPhoto', e.target.files?.[0])}
              />
              {registration.idPhoto ? '更換證件照' : '新增證件照'}
            </label>
            {editFileInputs.idPhoto && (
              <span className="ms-2 text-success small">已選：{editFileInputs.idPhoto.name}</span>
            )}
          </div>
        )}
        {!isEditing && !registration.idPhoto && <span className="text-muted">無</span>}
      </div>

      <div className="mb-4">
        <h6 className="mb-3">B2 成績證明</h6>
        {!isEditing && registration.b2CertificateFile && (
          <div>
            {parseB2Files(registration.b2CertificateFile).map((file, index, files) => (
              <a
                key={index}
                href={`/uploads/${file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-primary me-2 mb-2"
              >
                <i className="fas fa-file-pdf me-1"></i>
                查看檔案 {files.length > 1 ? `(${index + 1})` : ''}
              </a>
            ))}
          </div>
        )}
        {isEditing && onUploadRegistrationFiles && (
          <div>
            {registration.b2CertificateFile && (
              <div className="mb-2">
                <span className="text-muted me-2">目前：</span>
                <a
                  href={`/uploads/${getFirstB2File(registration.b2CertificateFile)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-secondary btn-sm me-2"
                >
                  查看
                </a>
              </div>
            )}
            <label className="btn btn-outline-primary btn-sm mb-0">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="d-none"
                onChange={(e) => handleFileInputChange('b2CertificateFile', e.target.files?.[0])}
              />
              {registration.b2CertificateFile ? '更換 B2 成績證明' : '新增 B2 成績證明'}
            </label>
            {editFileInputs.b2CertificateFile && (
              <span className="ms-2 text-success small">
                已選：{editFileInputs.b2CertificateFile.name}
              </span>
            )}
          </div>
        )}
        {!isEditing && !registration.b2CertificateFile && <span className="text-muted">無</span>}
      </div>

      <div className="mb-4">
        <h6 className="mb-3">身心障礙證明</h6>
        {!isEditing && (registration.disabilityCertFront || registration.disabilityCertBack) && (
          <div className="d-flex gap-2">
            {registration.disabilityCertFront && (
              <a
                href={`/uploads/${registration.disabilityCertFront}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-primary"
              >
                <i className="fas fa-file me-1"></i>正面
              </a>
            )}
            {registration.disabilityCertBack && (
              <a
                href={`/uploads/${registration.disabilityCertBack}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-primary"
              >
                <i className="fas fa-file me-1"></i>反面
              </a>
            )}
          </div>
        )}
        {isEditing && onUploadRegistrationFiles && (
          <div className="d-flex flex-wrap gap-3">
            <div>
              <span className="d-block small text-muted mb-1">正面</span>
              {registration.disabilityCertFront && (
                <a
                  href={`/uploads/${registration.disabilityCertFront}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-secondary btn-sm me-2"
                >
                  查看
                </a>
              )}
              <label className="btn btn-outline-primary btn-sm mb-0">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="d-none"
                  onChange={(e) => handleFileInputChange('disabilityCertFront', e.target.files?.[0])}
                />
                {registration.disabilityCertFront ? '更換' : '新增'}
              </label>
              {editFileInputs.disabilityCertFront && (
                <span className="ms-2 text-success small">已選</span>
              )}
            </div>
            <div>
              <span className="d-block small text-muted mb-1">反面</span>
              {registration.disabilityCertBack && (
                <a
                  href={`/uploads/${registration.disabilityCertBack}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-secondary btn-sm me-2"
                >
                  查看
                </a>
              )}
              <label className="btn btn-outline-primary btn-sm mb-0">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="d-none"
                  onChange={(e) => handleFileInputChange('disabilityCertBack', e.target.files?.[0])}
                />
                {registration.disabilityCertBack ? '更換' : '新增'}
              </label>
              {editFileInputs.disabilityCertBack && (
                <span className="ms-2 text-success small">已選</span>
              )}
            </div>
          </div>
        )}
        {!isEditing && !registration.disabilityCertFront && !registration.disabilityCertBack && (
          <span className="text-muted">無</span>
        )}
      </div>
    </TabPanel>
  );
}
