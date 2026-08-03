import React from 'react';
import { displayIdNumber } from '../../../utils/piiMask';
import DetailModalEditingAlert from './DetailModalEditingAlert';
import DetailModalRejectionReason from './DetailModalRejectionReason';
import { TabPanel } from './detailModalTabShell';

export default function DetailModalBasicTab({
  registration,
  isEditing,
  editData,
  handleEditChange,
  embedded = false,
}) {
  return (
    <TabPanel embedded={embedded}>
      {isEditing && <DetailModalEditingAlert />}
      <div className="row">
        <div className="col-md-6 mb-3">
          <strong>學號：</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.studentId || ''}
              onChange={(e) => handleEditChange('studentId', e.target.value)}
            />
          ) : (
            registration.studentId
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>姓名：</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.name || ''}
              onChange={(e) => handleEditChange('name', e.target.value)}
            />
          ) : (
            registration.name
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>身分證字號：</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={(() => {
                const v = editData.idNumber || editData.nationalId || '';
                return v.includes('****') ? '' : v;
              })()}
              placeholder="變更時請輸入完整身分證字號"
              onChange={(e) => {
                handleEditChange('idNumber', e.target.value);
                handleEditChange('nationalId', e.target.value);
              }}
            />
          ) : (
            displayIdNumber(registration)
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>Email：</strong>{' '}
          {isEditing ? (
            <input
              type="email"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.email || ''}
              onChange={(e) => handleEditChange('email', e.target.value)}
            />
          ) : (
            registration.email
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>電話：</strong>{' '}
          {isEditing ? (
            <input
              type="tel"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.phone || ''}
              onChange={(e) => handleEditChange('phone', e.target.value)}
            />
          ) : (
            registration.phone
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>出生日期：</strong>{' '}
          {isEditing ? (
            <input
              type="date"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.birthDate || ''}
              onChange={(e) => handleEditChange('birthDate', e.target.value)}
            />
          ) : (
            registration.birthDate
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>英文姓名：</strong>{' '}
          {isEditing ? (
            <div className="d-inline-block">
              <input
                type="text"
                className="form-control form-control-sm d-inline-block me-1"
                style={{ width: '100px' }}
                value={editData.lastNameEn || ''}
                onChange={(e) => handleEditChange('lastNameEn', e.target.value)}
                placeholder="姓"
              />
              <input
                type="text"
                className="form-control form-control-sm d-inline-block"
                style={{ width: '100px' }}
                value={editData.firstNameEn || ''}
                onChange={(e) => handleEditChange('firstNameEn', e.target.value)}
                placeholder="名"
              />
            </div>
          ) : (
            `${registration.lastNameEn} ${registration.firstNameEn}`
          )}
        </div>
        <div className="col-12 mb-3">
          <strong>地址：</strong>{' '}
          {isEditing ? (
            <div className="d-inline-block w-100">
              <input
                type="text"
                className="form-control form-control-sm mb-1"
                placeholder="郵遞區號"
                value={editData.postalCode || ''}
                onChange={(e) => handleEditChange('postalCode', e.target.value)}
              />
              <input
                type="text"
                className="form-control form-control-sm mb-1"
                placeholder="縣市"
                value={editData.city || ''}
                onChange={(e) => handleEditChange('city', e.target.value)}
              />
              <input
                type="text"
                className="form-control form-control-sm mb-1"
                placeholder="行政區"
                value={editData.district || ''}
                onChange={(e) => handleEditChange('district', e.target.value)}
              />
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="詳細地址"
                value={editData.address || ''}
                onChange={(e) => handleEditChange('address', e.target.value)}
              />
            </div>
          ) : (
            `${registration.postalCode} ${registration.city} ${registration.district} ${registration.address}`
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>資訊來源：</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.infoSource || ''}
              onChange={(e) => handleEditChange('infoSource', e.target.value)}
            />
          ) : (
            registration.infoSource
          )}
        </div>
      </div>
      <DetailModalRejectionReason
        registration={registration}
        variant={embedded ? 'block' : 'alert'}
      />
    </TabPanel>
  );
}
