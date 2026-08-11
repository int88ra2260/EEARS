import React, { useMemo, useRef, useState } from 'react';
import './MediaPicker.css';

/**
 * 可重用媒體挑選器（Step1 縮圖選取 → Step2 上傳 → Step3 媒體庫）
 *
 * value: { url, mediaId? }
 * assets: MediaAssetRef[]
 * onChange({ url, mediaId })
 * onUploadFile?(File) => Promise<MediaAssetRef>
 */
export default function MediaPicker({
  value,
  assets = [],
  onChange,
  onUploadFile,
  uploading = false,
  emptyHint = '尚無可選圖片。',
  allowClear = true,
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

  return (
    <div className="media-picker">
      <div className="media-picker__toolbar">
        <span className="media-picker__toolbar-label">選擇圖片</span>
        <div className="media-picker__toolbar-actions">
          {onUploadFile ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-sm btn-dark"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? '上傳中…' : '上傳新圖'}
              </button>
            </>
          ) : null}
          {allowClear && selectedUrl ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleClear}>
              清除
            </button>
          ) : null}
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="media-picker__empty">{emptyHint}</div>
      ) : (
        <div className="media-picker__grid" role="listbox" aria-label="可選圖片">
          {assets.map((asset) => {
            const isActive =
              (selectedId && asset.id === selectedId) || (!selectedId && asset.url === selectedUrl);
            return (
              <button
                key={asset.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`media-picker__tile${isActive ? ' is-active' : ''}`}
                onClick={() => handleSelect(asset)}
                title={asset.label}
              >
                <span className="media-picker__thumb-wrap">
                  <img src={asset.url} alt="" loading="lazy" />
                </span>
                <span className="media-picker__tile-label">{asset.label}</span>
                {asset.source === 'upload' ? (
                  <span className="media-picker__tile-badge">已上傳</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {selectedAsset || selectedUrl ? (
        <div className="media-picker__selected">
          <div className="media-picker__selected-preview">
            {selectedUrl ? <img src={selectedUrl} alt={selectedAsset?.label || '已選圖片'} /> : null}
          </div>
          <div className="media-picker__selected-meta">
            <div className="media-picker__selected-title">
              {selectedAsset?.label || '自訂圖片'}
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
        <summary>進階：手動輸入圖片路徑</summary>
        <div className="media-picker__advanced-body">
          <input
            className="form-control form-control-sm"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="/images/course-guide/.... 或 /uploads/..."
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
