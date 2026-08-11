import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import {
  fetchMediaLibraryAdmin,
  uploadMediaLibraryAdmin,
} from '../../services/mediaLibraryAdminApi';
import './SharedMediaLibraryModal.css';

/**
 * 共用媒體庫選圖 Modal（週報／公告／其他編輯器可重用）
 * 保持「縮圖點選 + 上傳」的熟悉互動；回傳形狀相容舊 WeeklyMediaPicker。
 */
export default function SharedMediaLibraryModal({
  show,
  onHide,
  token,
  title = '選擇圖片',
  uploadScope = 'general',
  onSelect,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchMediaLibraryAdmin(token, {
        q: q.trim() || undefined,
        mimePrefix: 'image/',
      });
      setItems(Array.isArray(data?.assets) ? data.assets : []);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, q]);

  useEffect(() => {
    if (show) load();
  }, [show, load]);

  const toCompatItem = (asset) => ({
    id: asset.dbId || asset.id,
    mediaId: asset.id,
    url: asset.url,
    urlPath: asset.url,
    originalName: asset.originalName || asset.label,
    mimeType: asset.mime || 'image/*',
    alt: asset.label || '',
    label: asset.label,
    source: asset.source,
    scope: asset.scope,
  });

  const handleSelect = (asset) => {
    onSelect?.(toCompatItem(asset));
    onHide?.();
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setError('');
    try {
      const created = await uploadMediaLibraryAdmin(token, file, { scope: uploadScope });
      setItems((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      handleSelect(created);
    } catch (err) {
      setError(err.message || '上傳失敗');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      enforceFocus={false}
      restoreFocus={false}
      style={{ zIndex: 1070 }}
    >
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
          <label className="btn btn-outline-primary btn-sm mb-0">
            {uploading ? '上傳中…' : '上傳新圖片'}
            <input
              type="file"
              className="d-none"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
          <Button size="sm" variant="outline-secondary" onClick={load} disabled={loading}>
            重新整理
          </Button>
          <input
            className="form-control form-control-sm"
            style={{ maxWidth: 220 }}
            placeholder="搜尋圖片名稱…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                load();
              }
            }}
          />
          <Button size="sm" variant="outline-dark" onClick={load} disabled={loading}>
            搜尋
          </Button>
        </div>
        <p className="small text-muted mb-3">
          點縮圖即可套用。也可到「學生端內容 → 媒體庫」集中管理。
        </p>
        {error ? <p className="text-danger small">{error}</p> : null}
        {loading ? (
          <div className="text-center py-4">
            <Spinner size="sm" animation="border" />
          </div>
        ) : (
          <div className="shared-media-grid">
            {items.length === 0 ? (
              <p className="text-muted small mb-0">尚無圖片，請先上傳。</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="shared-media-grid__item"
                  title={item.label}
                  onClick={() => handleSelect(item)}
                >
                  <img src={item.url} alt={item.label || item.originalName || ''} />
                </button>
              ))
            )}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
