import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import SharedMediaLibraryModal from '../../media/SharedMediaLibraryModal';

const MAX_ATTACHMENTS = 5;

/**
 * 郵件模板附件（從媒體庫選圖／檔，寄出時作為附件）
 */
export default function EmailTemplateAttachmentsField({
  value = [],
  onChange,
  token,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const list = Array.isArray(value) ? value : [];

  const removeAt = (idx) => {
    onChange?.(list.filter((_, i) => i !== idx));
  };

  return (
    <div className="mb-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
        <label className="form-label small fw-semibold mb-0">
          附件（媒體庫）
          <span className="text-muted fw-normal"> — 最多 {MAX_ATTACHMENTS} 個，寄出時附加檔案</span>
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline-primary"
          disabled={disabled || !token || list.length >= MAX_ATTACHMENTS}
          onClick={() => setOpen(true)}
        >
          從媒體庫新增
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="small text-muted mb-0">尚未附加檔案。</p>
      ) : (
        <ul className="list-group list-group-flush border rounded">
          {list.map((item, idx) => (
            <li
              key={`${item.url}-${idx}`}
              className="list-group-item d-flex justify-content-between align-items-center gap-2 py-2"
            >
              <div className="d-flex align-items-center gap-2 min-w-0">
                {item.url && String(item.mime || '').startsWith('image/') ? (
                  <img
                    src={item.url}
                    alt=""
                    width={40}
                    height={40}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                ) : String(item.mime || '').includes('pdf') || String(item.url || '').endsWith('.pdf') ? (
                  <span
                    className="d-inline-flex align-items-center justify-content-center"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 4,
                      background: '#b91c1c',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    PDF
                  </span>
                ) : null}
                <div className="min-w-0">
                  <div className="small text-truncate" title={item.label || item.filename}>
                    {item.label || item.filename || item.url}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {item.mime || 'file'}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline-danger"
                disabled={disabled}
                onClick={() => removeAt(idx)}
              >
                移除
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SharedMediaLibraryModal
        show={open}
        onHide={() => setOpen(false)}
        token={token}
        title="選擇郵件附件"
        uploadScope="general"
        allowPdf
        onSelect={(item) => {
          if (list.length >= MAX_ATTACHMENTS) return;
          const next = {
            mediaId: (() => {
              if (item.dbId != null && Number.isFinite(Number(item.dbId))) return Number(item.dbId);
              const raw = item.mediaId ?? item.id;
              if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
              const m = String(raw || '').match(/^media:(\d+)$/);
              return m ? Number(m[1]) : null;
            })(),
            url: item.url || item.urlPath,
            filename: item.originalName || item.label || 'attachment',
            mime: item.mimeType || item.mime || null,
            label: item.label || item.originalName || null,
          };
          if (!next.url) return;
          if (list.some((x) => x.url === next.url)) return;
          onChange?.([...list, next]);
        }}
      />
    </div>
  );
}
