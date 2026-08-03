/**
 * 培力英檢報名開關：個人報名、團體報名啟用狀態與切換。
 */
import { useState, useCallback, useEffect } from 'react';
import {
  fetchIndividualRegistrationEnabled,
  fetchGroupRegistrationEnabled,
  updateIndividualRegistrationEnabled,
  updateGroupRegistrationEnabled,
} from '../services/englishTestApi';

export function useRegistrationSetting({ token, showToast }) {
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationGroupEnabled, setRegistrationGroupEnabled] = useState(true);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState(false);

  const loadRegistrationSetting = useCallback(async () => {
    try {
      const [ind, group] = await Promise.all([
        fetchIndividualRegistrationEnabled(token),
        fetchGroupRegistrationEnabled(token),
      ]);
      setRegistrationEnabled(ind);
      setRegistrationGroupEnabled(group);
    } catch (error) {
      console.error('載入報名開關設定錯誤:', error);
    }
  }, [token]);

  const handleToggleRegistration = useCallback(async (enabled) => {
    setIsUpdatingSetting(true);
    try {
      const next = await updateIndividualRegistrationEnabled(token, enabled);
      setRegistrationEnabled(next);
      if (showToast) showToast('個人報名開關已更新', 'success');
    } catch (error) {
      console.error('更新報名開關設定錯誤:', error);
      if (showToast) showToast(error.message || '更新設定時發生錯誤', 'danger');
    } finally {
      setIsUpdatingSetting(false);
    }
  }, [token, showToast]);

  const handleToggleRegistrationGroup = useCallback(async (enabled) => {
    setIsUpdatingSetting(true);
    try {
      const next = await updateGroupRegistrationEnabled(token, enabled);
      setRegistrationGroupEnabled(next);
      if (showToast) showToast('團體報名開關已更新', 'success');
    } catch (error) {
      console.error('更新團體報名開關設定錯誤:', error);
      if (showToast) showToast(error.message || '更新設定時發生錯誤', 'danger');
    } finally {
      setIsUpdatingSetting(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    if (token) loadRegistrationSetting();
  }, [token, loadRegistrationSetting]);

  return {
    registrationEnabled,
    registrationGroupEnabled,
    isUpdatingSetting,
    loadRegistrationSetting,
    handleToggleRegistration,
    handleToggleRegistrationGroup
  };
}
