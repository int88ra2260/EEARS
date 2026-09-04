// components/EnglishTestStep3Form.js
// 步驟三：英語能力與培力資格相關
import React from 'react';
import useToast from './ui/useToast';
import useConfirm from './ui/useConfirm';
import { useEnglishTestStep3Form } from '../hooks/useEnglishTestStep3Form';
import { checkB2Level } from '../utils/englishTestStep3Validation';
import { ERROR_PULSE_STYLE } from '../utils/englishTestFormHelpers';
import EnglishTestStep3FormBody from './english-test/registration/EnglishTestStep3FormBody';
import { useEnglishTestFormSchemaPublic } from '../hooks/useEnglishTestFormSchemaPublic';
import { buildFormOptionsFromMeta } from '../utils/englishTestFormSchemaMeta';

export default function EnglishTestStep3Form({ basicInfo, initialData, onNext, onBack, onClose, onSubmitNonExam }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { meta } = useEnglishTestFormSchemaPublic();
  const formOptions = buildFormOptionsFromMeta(meta, { mode: 'create' });

  const {
    formData,
    errors,
    getFieldRef,
    getErrorStyle,
    handleChange,
    handleFileChange,
    handleSubmit,
  } = useEnglishTestStep3Form({
    onNext,
    onClose,
    onSubmitNonExam,
    toast,
    confirm,
  });

  return (
    <form onSubmit={handleSubmit}>
      <style>{ERROR_PULSE_STYLE}</style>
      <EnglishTestStep3FormBody
        formData={formData}
        errors={errors}
        getFieldRef={getFieldRef}
        getErrorStyle={getErrorStyle}
        handleChange={handleChange}
        handleFileChange={handleFileChange}
        checkB2Level={checkB2Level}
        onBack={onBack}
        onClose={onClose}
        formOptions={formOptions}
      />
    </form>
  );
}
