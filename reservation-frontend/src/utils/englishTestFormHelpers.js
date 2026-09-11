import React from 'react';
import AppIcon from '../components/ui/AppIcon';

export const ERROR_PULSE_STYLE = `
  @keyframes errorPulse {
    0%, 100% { box-shadow: 0 0 0 0.2rem rgba(180, 35, 24, 0.25); }
    50% { box-shadow: 0 0 0 0.5rem rgba(180, 35, 24, 0.45); }
  }
`;

export function getErrorStyle(errors, fieldName) {
  return errors[fieldName]
    ? {
        border: '3px solid #b42318',
        backgroundColor: '#fdeceb',
        boxShadow: '0 0 0 0.2rem rgba(180, 35, 24, 0.25)',
        animation: 'errorPulse 0.5s ease-in-out',
      }
    : {};
}

export function getDisabledStyle(disabled) {
  return disabled ? { backgroundColor: '#eef2f7', cursor: 'not-allowed' } : {};
}

/** Stable identity for browser File objects (name + size + lastModified). */
export function getFileIdentityKey(file) {
  if (!file) return '';
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/**
 * Append newly picked files without replacing prior selections.
 * Native <input type="file" multiple> only exposes the latest dialog pick.
 */
export function appendUniqueFiles(existingFiles = [], incomingFiles = []) {
  const existing = Array.isArray(existingFiles) ? existingFiles : [];
  const incoming = Array.isArray(incomingFiles) ? incomingFiles : [];
  if (incoming.length === 0) return existing;

  const seen = new Set(existing.map(getFileIdentityKey));
  const merged = [...existing];
  for (const file of incoming) {
    const key = getFileIdentityKey(file);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(file);
  }
  return merged;
}

export function FormErrorMessage({ message, small = false }) {
  if (!message) return null;
  if (small) {
    return (
      <div className="text-danger mt-1 small d-flex align-items-start gap-1" style={{ fontWeight: 'bold' }}>
        <AppIcon name="warning" size="sm" />
        <span>{message}</span>
      </div>
    );
  }
  return (
    <div
      className="text-danger mt-2 p-2 rounded d-flex align-items-start gap-2"
      style={{
        backgroundColor: '#fdeceb',
        border: '1px solid #f5c2c0',
        fontWeight: 'bold',
        fontSize: '1rem',
      }}
    >
      <AppIcon name="warning" size="md" />
      <span>{message}</span>
    </div>
  );
}

export function scrollToFirstError(getFieldRef, firstErrorField) {
  setTimeout(() => {
    if (!firstErrorField) return;
    const fieldRef = typeof getFieldRef === 'function' ? getFieldRef(firstErrorField) : null;
    if (!fieldRef?.current) return;

    fieldRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    fieldRef.current.style.animation = 'none';
    setTimeout(() => {
      if (fieldRef.current) {
        fieldRef.current.style.animation = 'errorPulse 0.5s ease-in-out 3';
      }
    }, 10);

    const input = fieldRef.current.querySelector('input, select, textarea');
    if (input && input.type !== 'file' && input.type !== 'checkbox' && input.type !== 'radio') {
      input.focus();
    }
  }, 100);
}

export function buildRegisterFormData(formData) {
  const submitData = new FormData();

  submitData.append('studentId', formData.studentId);
  submitData.append('name', formData.name);
  submitData.append('idNumber', formData.idNumber);
  submitData.append('email', formData.email);
  submitData.append('studentNameZh', formData.studentNameZh);
  submitData.append('lastNameEn', formData.lastNameEn.toUpperCase());
  submitData.append('firstNameEn', formData.firstNameEn.toUpperCase());
  submitData.append('birthDate', formData.birthDate);

  submitData.append('examType', formData.examType);
  submitData.append('hasCEFRB2', formData.hasCEFRB2);
  submitData.append('listeningExamType', formData.listeningExamType || '');
  submitData.append('listeningScore', formData.listeningScore || '');
  submitData.append('readingExamType', formData.readingExamType || '');
  submitData.append('readingScore', formData.readingScore || '');
  submitData.append('speakingExamType', formData.speakingExamType || '');
  submitData.append('speakingScore', formData.speakingScore || '');
  submitData.append('writingExamType', formData.writingExamType || '');
  submitData.append('writingScore', formData.writingScore || '');
  if (formData.b2CertificateFiles && formData.b2CertificateFiles.length > 0) {
    formData.b2CertificateFiles.forEach((file) => {
      submitData.append('b2CertificateFiles', file);
    });
  }

  submitData.append('nationalId', formData.nationalId);
  submitData.append('phone', formData.phone);
  submitData.append('postalCode', formData.postalCode);
  submitData.append('city', formData.city);
  submitData.append('district', formData.district);
  submitData.append('address', formData.address);
  submitData.append('degreeLevel', formData.degreeLevel);
  submitData.append('grade', formData.grade);
  submitData.append('college', formData.college);
  submitData.append('department', formData.department);

  submitData.append('isLowIncome', formData.isLowIncome);
  submitData.append('hasDisabilityCard', formData.hasDisabilityCard);
  submitData.append('disabilityTypes', JSON.stringify(formData.disabilityTypes));
  if (formData.disabilityCertFront) {
    submitData.append('disabilityCertFront', formData.disabilityCertFront);
  }
  if (formData.disabilityCertBack) {
    submitData.append('disabilityCertBack', formData.disabilityCertBack);
  }
  submitData.append('examAssistanceOptions', JSON.stringify(formData.examAssistanceOptions));
  if (formData.examAssistanceOther) {
    submitData.append('examAssistanceOther', formData.examAssistanceOther);
  }
  if (formData.disabilityOther) {
    submitData.append('disabilityOther', formData.disabilityOther);
  }

  if (formData.idPhoto) {
    submitData.append('idPhoto', formData.idPhoto);
  }
  submitData.append('agreedToTerms', formData.agreedToTerms);
  submitData.append('addressConfirmed', formData.addressConfirmed);
  submitData.append('infoSource', formData.infoSource);
  if (formData.infoSourceOther) {
    submitData.append('infoSourceOther', formData.infoSourceOther);
  }
  if (formData.emailVerificationToken) {
    submitData.append('emailVerificationToken', formData.emailVerificationToken);
  }
  if (formData.extraAnswers && typeof formData.extraAnswers === 'object') {
    submitData.append('extraAnswers', JSON.stringify(formData.extraAnswers));
  }

  return submitData;
}

export function buildUpdateFormData(formData, fileInputs) {
  const submitData = new FormData();

  submitData.append('registrationId', formData.registrationId);
  submitData.append('studentId', formData.studentId);
  submitData.append('name', formData.name);
  submitData.append('idNumber', formData.idNumber);
  submitData.append('email', formData.email || '');
  submitData.append('studentNameZh', formData.studentNameZh);
  submitData.append('lastNameEn', String(formData.lastNameEn || '').toUpperCase());
  submitData.append('firstNameEn', String(formData.firstNameEn || '').toUpperCase());
  submitData.append('birthDate', formData.birthDate || '');

  submitData.append('examType', formData.examType || '');
  submitData.append('hasCEFRB2', formData.hasCEFRB2 || '否');
  if (formData.hasCEFRB2 === '是') {
    submitData.append('listeningExamType', formData.listeningExamType || '');
    submitData.append('listeningScore', formData.listeningScore || '');
    submitData.append('readingExamType', formData.readingExamType || '');
    submitData.append('readingScore', formData.readingScore || '');
    submitData.append('speakingExamType', formData.speakingExamType || '');
    submitData.append('speakingScore', formData.speakingScore || '');
    submitData.append('writingExamType', formData.writingExamType || '');
    submitData.append('writingScore', formData.writingScore || '');
    if (Array.isArray(formData.b2CertificateFiles) && formData.b2CertificateFiles.length > 0) {
      formData.b2CertificateFiles.forEach((file) => {
        submitData.append('b2CertificateFiles', file);
      });
    }
  } else {
    submitData.append('listeningExamType', '');
    submitData.append('listeningScore', '');
    submitData.append('readingExamType', '');
    submitData.append('readingScore', '');
    submitData.append('speakingExamType', '');
    submitData.append('speakingScore', '');
    submitData.append('writingExamType', '');
    submitData.append('writingScore', '');
    submitData.append('clearB2Certificate', 'true');
  }

  submitData.append('nationalId', formData.nationalId || formData.idNumber);
  submitData.append('phone', formData.phone || '');
  submitData.append('postalCode', formData.postalCode || '');
  submitData.append('city', formData.city || '');
  submitData.append('district', formData.district || '');
  submitData.append('address', formData.address || '');
  submitData.append('degreeLevel', formData.degreeLevel || '');
  submitData.append('grade', formData.grade || '');
  submitData.append('college', formData.college || '');
  submitData.append('department', formData.department || '');

  submitData.append('isLowIncome', formData.isLowIncome);
  submitData.append('hasDisabilityCard', formData.hasDisabilityCard);
  submitData.append('disabilityTypes', JSON.stringify(formData.disabilityTypes || []));
  if (fileInputs.disabilityCertFront || formData.disabilityCertFront) {
    submitData.append('disabilityCertFront', fileInputs.disabilityCertFront || formData.disabilityCertFront);
  }
  if (fileInputs.disabilityCertBack || formData.disabilityCertBack) {
    submitData.append('disabilityCertBack', fileInputs.disabilityCertBack || formData.disabilityCertBack);
  }
  submitData.append('examAssistanceOptions', JSON.stringify(formData.examAssistanceOptions || []));
  if (formData.examAssistanceOther) {
    submitData.append('examAssistanceOther', formData.examAssistanceOther);
  }

  if (fileInputs.idPhoto || formData.idPhoto) {
    submitData.append('idPhoto', fileInputs.idPhoto || formData.idPhoto);
  }
  submitData.append('agreedToTerms', formData.agreedToTerms);
  submitData.append('infoSource', formData.infoSource || '');
  if (formData.emailVerificationToken) {
    submitData.append('emailVerificationToken', formData.emailVerificationToken);
  }
  if (formData.extraAnswers && typeof formData.extraAnswers === 'object') {
    submitData.append('extraAnswers', JSON.stringify(formData.extraAnswers));
  }

  return submitData;
}
