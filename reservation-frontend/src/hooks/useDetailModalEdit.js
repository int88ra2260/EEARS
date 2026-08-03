import { useState } from 'react';
import useToast from '../components/ui/useToast';

const EMPTY_FILE_INPUTS = {
  idPhoto: null,
  b2CertificateFile: null,
  disabilityCertFront: null,
  disabilityCertBack: null,
};

export default function useDetailModalEdit({
  registration,
  onUpdateRegistration,
  onUploadRegistrationFiles,
  token,
}) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [editFileInputs, setEditFileInputs] = useState(EMPTY_FILE_INPUTS);

  const resetEditState = () => {
    setIsEditing(false);
    setEditData({});
    setEditFileInputs(EMPTY_FILE_INPUTS);
  };

  const handleStartEdit = () => {
    setEditData({ ...registration });
    setEditFileInputs(EMPTY_FILE_INPUTS);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetEditState();
  };

  const handleSaveEdit = async () => {
    if (!onUpdateRegistration || !token) {
      toast.error('無法儲存：缺少必要的更新函數或權限');
      return;
    }

    try {
      const hasFileChanges =
        editFileInputs.idPhoto ||
        editFileInputs.b2CertificateFile ||
        editFileInputs.disabilityCertFront ||
        editFileInputs.disabilityCertBack;

      if (hasFileChanges && onUploadRegistrationFiles) {
        const formData = new FormData();
        if (editFileInputs.idPhoto) formData.append('idPhoto', editFileInputs.idPhoto);
        if (editFileInputs.b2CertificateFile) {
          formData.append('b2CertificateFile', editFileInputs.b2CertificateFile);
        }
        if (editFileInputs.disabilityCertFront) {
          formData.append('disabilityCertFront', editFileInputs.disabilityCertFront);
        }
        if (editFileInputs.disabilityCertBack) {
          formData.append('disabilityCertBack', editFileInputs.disabilityCertBack);
        }
        await onUploadRegistrationFiles(registration.id, formData, token);
      }

      await onUpdateRegistration(registration.id, editData, token);
      resetEditState();
    } catch (error) {
      console.error('儲存失敗:', error);
      toast.error(error.message || '儲存失敗，請稍後再試');
    }
  };

  const handleEditChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileInputChange = (field, file) => {
    setEditFileInputs((prev) => ({ ...prev, [field]: file && file.size > 0 ? file : null }));
  };

  return {
    isEditing,
    editData,
    editFileInputs,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleEditChange,
    handleFileInputChange,
  };
}
