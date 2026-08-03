/**
 * 培力英檢後台修改報名資料與上傳檔案。
 */
import { useCallback } from 'react';
import { updateRegistration, uploadRegistrationFiles } from '../services/englishTestApi';

export function useEnglishTestAdminUpdate({
  selectedRegistration,
  setSelectedRegistration,
  registrations,
  setRegistrations,
  loadRegistrations,
  showToast
}) {
  const handleUpdateRegistration = useCallback(async (registrationId, updateData, authToken) => {
    try {
      const cleanedUpdateData = {};
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          cleanedUpdateData[key] = updateData[key];
        }
      });

      if (Object.keys(cleanedUpdateData).length === 0) {
        showToast('沒有需要更新的資料', 'info');
        return registrations.find(reg => reg.id === registrationId) || selectedRegistration || null;
      }

      const result = await updateRegistration(authToken, registrationId, cleanedUpdateData);
      const updatedRegistration = result.registration || result;

      if (selectedRegistration && selectedRegistration.id === registrationId) {
        setSelectedRegistration(updatedRegistration);
      }

      setRegistrations(prev =>
        prev.map(reg => reg.id === registrationId ? updatedRegistration : reg)
      );

      await loadRegistrations();
      showToast('報名資料已更新', 'success');
      return updatedRegistration;
    } catch (error) {
      console.error('更新報名資料錯誤:', error);
      showToast(error.message || '更新失敗，請稍後再試', 'danger');
      throw error;
    }
  }, [selectedRegistration, setSelectedRegistration, registrations, setRegistrations, loadRegistrations, showToast]);

  const handleUploadRegistrationFiles = useCallback(async (registrationId, formData, authToken) => {
    const data = await uploadRegistrationFiles(authToken, registrationId, formData);
    if (data.registration && selectedRegistration?.id === registrationId) {
      setSelectedRegistration(data.registration);
    }
    if (data.message) showToast(data.message, 'success');
    return data.registration;
  }, [selectedRegistration, setSelectedRegistration, showToast]);

  return {
    handleUpdateRegistration,
    handleUploadRegistrationFiles
  };
}
