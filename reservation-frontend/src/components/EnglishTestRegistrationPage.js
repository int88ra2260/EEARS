// components/EnglishTestRegistrationPage.js
// 獨立的培力英檢報名頁面
import React from 'react';
import useEnglishTestRegistrationPage from '../hooks/useEnglishTestRegistrationPage';
import RegistrationPageLayout from './english-test/registration/RegistrationPageLayout';
import RegistrationPrivacyStep from './english-test/registration/RegistrationPrivacyStep';
import RegistrationVerifyStep from './english-test/registration/RegistrationVerifyStep';
import EnglishTestStep3Form from './EnglishTestStep3Form';
import EnglishTestDetailForm from './EnglishTestDetailForm';
import EnglishTestViewEditModal from './EnglishTestViewEditModal';

export default function EnglishTestRegistrationPage() {
  const {
    englishTestStep,
    agreedToPrivacyPolicy,
    setAgreedToPrivacyPolicy,
    englishTestForm,
    formErrors,
    studentData,
    isLoadingStudent,
    showViewEditModal,
    existingRegistration,
    isLoadingRegistration,
    step3Data,
    registrationTab,
    setRegistrationTab,
    registrationEnabled,
    isCheckingRegistrationStatus,
    handleCloseEnglishTestModal,
    handlePrivacyPolicyNext,
    handleViewEdit,
    handleEnglishTestFormChange,
    handleEnglishTestSubmit,
    handleRegistrationClosedSubmitClick,
    handleCloseViewEditModal,
    handleViewEditUpdateSuccess,
    handleStep3Next,
    handleStep4Back,
    handleSubmitNonExam,
    handleNavigateToGroupRegistration,
  } = useEnglishTestRegistrationPage();

  return (
    <RegistrationPageLayout
      englishTestStep={englishTestStep}
      isCheckingRegistrationStatus={isCheckingRegistrationStatus}
      onClose={handleCloseEnglishTestModal}
    >
      {englishTestStep === 0 && (
        <RegistrationPrivacyStep
          agreedToPrivacyPolicy={agreedToPrivacyPolicy}
          onAgreedChange={setAgreedToPrivacyPolicy}
          onNext={handlePrivacyPolicyNext}
        />
      )}

      {englishTestStep === 1 && (
        <RegistrationVerifyStep
          registrationTab={registrationTab}
          onRegistrationTabChange={setRegistrationTab}
          onNavigateToGroupRegistration={handleNavigateToGroupRegistration}
          registrationEnabled={registrationEnabled}
          englishTestForm={englishTestForm}
          formErrors={formErrors}
          onFormChange={handleEnglishTestFormChange}
          onSubmit={handleEnglishTestSubmit}
          onViewEdit={handleViewEdit}
          onClose={handleCloseEnglishTestModal}
          onRegistrationClosedSubmitClick={handleRegistrationClosedSubmitClick}
          isLoadingRegistration={isLoadingRegistration}
          isLoadingStudent={isLoadingStudent}
        />
      )}

      {showViewEditModal && existingRegistration && (
        <EnglishTestViewEditModal
          registration={existingRegistration}
          basicInfo={englishTestForm}
          onClose={handleCloseViewEditModal}
          onUpdateSuccess={handleViewEditUpdateSuccess}
        />
      )}

      {registrationEnabled && englishTestStep === 2 && (
        <EnglishTestStep3Form
          basicInfo={englishTestForm}
          initialData={studentData}
          onNext={handleStep3Next}
          onClose={handleCloseEnglishTestModal}
          onSubmitNonExam={handleSubmitNonExam}
        />
      )}

      {registrationEnabled && englishTestStep === 3 && (
        <EnglishTestDetailForm
          initialData={studentData}
          basicInfo={englishTestForm}
          step3Data={step3Data}
          onBack={handleStep4Back}
          onClose={handleCloseEnglishTestModal}
        />
      )}
    </RegistrationPageLayout>
  );
}
