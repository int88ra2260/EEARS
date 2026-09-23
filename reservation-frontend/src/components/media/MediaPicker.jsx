import React, { useMemo, useRef, useState } from 'react';
import './MediaPicker.css';

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf';

function isPdfAsset(asset) {
  const mime = String(asset?.mime || asset?.mimeType || '').toLowerCase();
  const url = String(asset?.url || '').toLowerCase();
  return mime === 'application/pdf' || url.endsWith('.pdf');
}

/**
 * 可重用媒體挑選器（縮圖選取 → 上傳 → 媒體庫）
 *
 * value: { url, mediaId? }
 * assets: MediaAssetRef[]
 * onChange({ url, mediaId })
 * onUploadFile?(File) => Promise<MediaAssetRef>
 * onDeleteAsset?(asset) => Promise<void>|void — 提供時顯示每張卡片的刪除鈕
 * accept?: file input accept（預設含圖片 + PDF）
 */
export default function MediaPicker({
  value,
  assets = [],
  onChange,
  onUploadFile,
  onDeleteAsset,
  uploading = false,
  deletingId = null,
  emptyHint = '尚無可選媒體。',
  allowClear = true,
  accept = DEFAULT_ACCEPT,
  toolbarLabel = '選擇媒體',
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customUrl, setCustomUrl] = useState(value?.url || '');
  const fileRef = useRef(null);

  const selectedUrl = value?.url || '';
  const selectedId = value?.mediaId || null;

  const selectedAsset = useMemo(() => {
    if (!assets.length) return null;
    if (selectedId) {
      const byId = assets.find((a) => a.id === selectedId);
      if (byId) return byId;
    }
    return assets.find((a) => a.url === selectedUrl) || null;
  }, [assets, selectedId, selectedUrl]);

  const handleSelect = (asset) => {
    onChange?.({
      url: asset.url,
      mediaId: asset.id || null,
    });
    setCustomUrl(asset.url);
  };

  const handleClear = () => {
    onChange?.({ url: '', mediaId: null });
    setCustomUrl('');
  };

  const handleCustomApply = () => {
    const url = String(customUrl || '').trim();
    onChange?.({ url, mediaId: null });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadFile) return;
    try {
      const asset = await onUploadFile(file);
      if (asset?.url) handleSelect(asset);
    } catch {
      // 錯誤由呼叫端 toast
    }
  };

  const renderThumb = (asset) => {
    if (isPdfAsset(asset)) {
      return (
        <span className="media-picker__thumb-wrap media-picker__thumb-wrap--file" aria-hidden="true">
          <span className="media-picker__file-badge">PDF</span>
        </span>
      );
    }
    return (
      <span className="media-picker__thumb-wrap">
        <img src={asset.url} alt="" loading="lazy" />
      </span>
    );
  };

  return (
    <div className="media-picker">
      <div className="media-picker__toolbar">
        <span className="media-picker__toolbar-label">{toolbarLabel}</span>
        <div className="media-picker__toolbar-actions">
          {onUploadFile ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                hidden
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-sm btn-dark"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? '上傳中…' : '上傳檔案'}
              </button>
            </>
          ) : null}
          {allowClear && selectedUrl ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleClear}>
              清除選取
            </button>
          ) : null}
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="media-picker__empty">{emptyHint}</div>
      ) : (
        <div className="media-picker__grid" role="listbox" aria-label="可選媒體">
          {assets.map((asset) => {
            const isActive =
              (selectedId && asset.id === selectedId) || (!selectedId && asset.url === selectedUrl);
            const canDelete = typeof onDeleteAsset === 'function' && asset.source !== 'catalog';
            const isDeleting = deletingId != null && String(deletingId) === String(asset.id);
            return (
              <div
                key={asset.id}
                className={`media-picker__tile${isActive ? ' is-active' : ''}`}
                role="option"
                aria-selected={isActive}
              >
                <button
                  type="button"
                  className="media-picker__tile-main"
                  onClick={() => handleSelect(asset)}
                  title={asset.label}
                >
                  {renderThumb(asset)}
                  <span className="media-picker__tile-label">{asset.label}</span>
                  {asset.source === 'upload' ? (
                    <span className="media-picker__tile-badge">已上傳</span>
                  ) : asset.source === 'catalog' ? (
                    <span className="media-picker__tile-badge media-picker__tile-badge--catalog">系統</span>
                  ) : null}
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    className="media-picker__tile-delete"
                    title={`刪除「${asset.label || ''}」`}
                    aria-label={`刪除 ${asset.label || '媒體'}`}
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteAsset(asset);
                    }}
                  >
                    {isDeleting ? '…' : '刪除'}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {selectedAsset || selectedUrl ? (
        <div className="media-picker__selected">
          <div className="media-picker__selected-preview">
            {selectedUrl ? (
              isPdfAsset(selectedAsset) || String(selectedUrl).toLowerCase().endsWith('.pdf') ? (
                <div className="media-picker__selected-file">
                  <span className="media-picker__file-badge">PDF</span>
                  <a href={selectedUrl} target="_blank" rel="noopener noreferrer" className="small">
                    開啟預覽
                  </a>
                </div>
              ) : (
                <img src={selectedUrl} alt={selectedAsset?.label || '已選媒體'} />
              )
            ) : null}
          </div>
          <div className="media-picker__selected-meta">
            <div className="media-picker__selected-title">
              {selectedAsset?.label || '自訂媒體'}
            </div>
            <div className="media-picker__selected-url">{selectedUrl}</div>
          </div>
        </div>
      ) : null}

      <details
        className="media-picker__advanced"
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced(e.currentTarget.open)}
      >
        <summary>進階：手動輸入路徑</summary>
        <div className="media-picker__advanced-body">
          <input
            className="form-control form-control-sm"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="/images/... 或 /uploads/media/..."
          />
          <button type="button" className="btn btn-sm btn-outline-dark mt-2" onClick={handleCustomApply}>
            套用路徑
          </button>
          <p className="small text-muted mb-0 mt-2">
            一般請用上方縮圖或上傳。此欄位留給特殊路徑或舊資料相容。
          </p>
        </div>
      </details>
    </div>
  );
}
