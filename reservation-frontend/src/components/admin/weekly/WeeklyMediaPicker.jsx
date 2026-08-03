import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import { fetchWeeklyMedia, uploadWeeklyMedia } from '../../../services/weeklyMediaAdminApi';

export default function WeeklyMediaPicker({
  show,
  onHide,
  token,
  kind = 'image',
  onSelect,
}) {
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

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>媒體庫</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
          <label className="btn btn-outline-primary btn-sm mb-0">
            {uploading ? '上傳中…' : '上傳新檔案'}
            <input type="file" className="d-none" onChange={onUpload} disabled={uploading} />
          </label>
          <Button size="sm" variant="outline-secondary" onClick={load} disabled={loading}>
            重新整理
          </Button>
        </div>
        {error ? <p className="text-danger small">{error}</p> : null}
        {loading ? (
          <div className="text-center py-4"><Spinner size="sm" animation="border" /></div>
        ) : (
          <div className="weekly-media-grid">
            {items.length === 0 ? (
              <p className="text-muted small mb-0">尚無媒體，請先上傳。</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="weekly-media-grid__item"
                  onClick={() => {
                    onSelect?.(item);
                    onHide?.();
                  }}
                >
                  {item.mimeType?.startsWith('image/') ? (
                    <img src={item.url || item.urlPath} alt={item.alt || item.originalName} />
                  ) : (
                    <span className="weekly-media-grid__file">{item.originalName}</span>
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
