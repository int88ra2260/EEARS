import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { fetchWeeklyMedia, uploadWeeklyMedia } from '../../../services/weeklyMediaAdminApi';
import SharedMediaLibraryModal from '../../media/SharedMediaLibraryModal';
import '../../media/SharedMediaLibraryModal.css';

/**
 * 週報媒體挑選：
 * - 圖片 → 共用媒體庫（與修課說明／公告同源）
 * - 音訊／影片 → 維持週報專用上傳（媒體庫目前以圖片為主）
 */
export default function WeeklyMediaPicker({
  show,
  onHide,
  token,
  kind = 'image',
  onSelect,
}) {
  const useSharedLibrary = kind === 'image' || !kind;

  if (useSharedLibrary) {
    return (
      <SharedMediaLibraryModal
        show={show}
        onHide={onHide}
        token={token}
        title="選擇圖片"
        uploadScope="weekly"
        onSelect={onSelect}
      />
    );
  }

  return (
    <LegacyWeeklyFilePicker
      show={show}
      onHide={onHide}
      token={token}
      kind={kind}
      onSelect={onSelect}
    />
  );
}

function LegacyWeeklyFilePicker({ show, onHide, token, kind, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchWeeklyMedia(token, { limit: 60, kind });
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, kind]);

  useEffect(() => {
    if (show) load();
  }, [show, load]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setError('');
    try {
      const created = await uploadWeeklyMedia(token, file);
      setItems((prev) => [created, ...prev]);
      onSelect?.(created);
      onHide?.();
    } catch (err) {
      setError(err.message || '上傳失敗');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const kindLabel = kind === 'audio' ? '音檔' : kind === 'video' ? '影片' : '檔案';

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>選擇{kindLabel}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
          <label className="btn btn-outline-primary btn-sm mb-0">
            {uploading ? '上傳中…' : `上傳新${kindLabel}`}
            <input type="file" className="d-none" onChange={onUpload} disabled={uploading} />
          </label>
          <Button size="sm" variant="outline-secondary" onClick={load} disabled={loading}>
            重新整理
          </Button>
        </div>
        <p className="small text-muted mb-3">
          {kindLabel}暫存於週報專用空間；圖片請改用共用媒體庫。
        </p>
        {error ? <p className="text-danger small">{error}</p> : null}
        {loading ? (
          <div className="text-center py-4">
            <Spinner size="sm" animation="border" />
          </div>
        ) : (
          <div className="shared-media-grid">
            {items.length === 0 ? (
              <p className="text-muted small mb-0">尚無{kindLabel}，請先上傳。</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="shared-media-grid__item"
                  onClick={() => {
                    onSelect?.(item);
                    onHide?.();
                  }}
                >
                  {item.mimeType?.startsWith('image/') ? (
                    <img src={item.url || item.urlPath} alt={item.alt || item.originalName} />
                  ) : (
                    <span className="shared-media-grid__file">{item.originalName}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
