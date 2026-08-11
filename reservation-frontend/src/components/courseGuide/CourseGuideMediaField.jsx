import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import MediaPicker from '../media/MediaPicker';
import {
  fetchMediaLibraryAdmin,
  uploadMediaLibraryAdmin,
} from '../../services/mediaLibraryAdminApi';
import useToast from '../ui/useToast';

/**
 * 修課說明圖片欄位 — 接共用媒體庫（Step3）
 */
export default function CourseGuideMediaField({ value, onChange }) {
  const { token } = useOutletContext() || {};
  const toast = useToast();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchMediaLibraryAdmin(token, { scope: 'course-guide' });
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
    } catch (e) {
      toast.error(e?.message || '載入媒體庫失敗');
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selection = {
    url: value?.src || '',
    mediaId: value?.mediaId || null,
  };

  const handleChange = (next) => {
    onChange?.({
      ...value,
      src: next.url || '',
      mediaId: next.mediaId || null,
      altZh: value?.altZh || value?.captionZh || '',
      altEn: value?.altEn || value?.captionEn || '',
    });
  };

  const handleUpload = async (file) => {
    if (!token) throw new Error('未登入');
    setUploading(true);
    try {
      const asset = await uploadMediaLibraryAdmin(token, file, {
        scope: 'course-guide',
      });
      setAssets((cur) => [asset, ...cur.filter((x) => x.id !== asset.id)]);
      toast.success('圖片已加入媒體庫');
      return asset;
    } catch (e) {
      toast.error(e?.message || '上傳失敗');
      throw e;
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {loading ? <div className="small text-muted mb-2">載入媒體庫…</div> : null}
      <MediaPicker
        value={selection}
        assets={assets}
        onChange={handleChange}
        onUploadFile={token ? handleUpload : undefined}
        uploading={uploading}
        emptyHint="媒體庫尚無圖片。請上傳，或到「媒體庫」任務集中管理。"
      />
    </div>
  );
}
