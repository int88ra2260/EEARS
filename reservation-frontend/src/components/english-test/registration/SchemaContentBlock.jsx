import React, { useState } from 'react';

/**
 * 渲染 content_block（證件照規範、個資同意書圖文等）。
 */
export default function SchemaContentBlock({ question, compact = false, collapsibleListFrom = 0 }) {
  const [listExpanded, setListExpanded] = useState(false);

  if (!question || question.visible === false) return null;
  const content = question.content || {};
  const listItems = Array.isArray(content.listItems) ? content.listItems : [];
  const shouldCollapseList = compact && collapsibleListFrom > 0 && listItems.length > collapsibleListFrom;
  const visibleListItems = shouldCollapseList && !listExpanded
    ? listItems.slice(0, collapsibleListFrom)
    : listItems;
  const hiddenListCount = shouldCollapseList ? listItems.length - collapsibleListFrom : 0;
  const images = Array.isArray(content.images) ? content.images : [];
  const hasMainImage = Boolean(content.imageUrl);

  const variantStyle = (variant) => {
    switch (variant) {
      case 'success':
        return { backgroundColor: '#d4edda', border: '2px solid #28a745', titleColor: '#155724' };
      case 'danger':
        return { backgroundColor: '#f8d7da', border: '2px solid #dc3545', titleColor: '#721c24' };
      case 'warning':
        return { backgroundColor: '#fff4e6', border: '2px solid #ff8c00', titleColor: '#cc6600' };
      default:
        return { backgroundColor: '#e7f3ff', border: '2px solid #0066cc', titleColor: '#0066cc' };
    }
  };

  return (
    <div className={compact ? 'mb-3' : 'mb-4'}>
      {(content.intro || question.helpText) && !hasMainImage && (
        <p className="text-muted mb-3" style={{ lineHeight: 1.6 }}>
          {content.intro || question.helpText}
        </p>
      )}

      {(question.label || content.warning || listItems.length > 0) && (
        <div
          className="p-3 rounded"
          style={{
            backgroundColor: '#e7f3ff',
            border: '2px solid #0066cc',
            fontSize: '0.95rem',
            lineHeight: 1.8,
          }}
        >
          {question.label ? (
            <strong style={{ color: '#0066cc', fontSize: '1.1rem' }}>{question.label}</strong>
          ) : null}

          {(content.intro || question.helpText) && hasMainImage ? (
            <p className="mt-2 mb-2" style={{ lineHeight: 1.6 }}>
              {content.intro || question.helpText}
            </p>
          ) : null}

          {content.warning ? (
            <div
              className="mt-2 mb-2 p-2 rounded"
              style={{
                backgroundColor: '#fff4e6',
                border: '2px solid #ff8c00',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: '#cc6600' }}>{content.warning}</strong>
            </div>
          ) : null}

          {visibleListItems.length > 0 ? (
            <ol style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
              {visibleListItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : null}

          {shouldCollapseList && !listExpanded ? (
            <button
              type="button"
              className="btn btn-link btn-sm px-0 mt-2"
              onClick={() => setListExpanded(true)}
            >
              展開其餘 {hiddenListCount} 項重點
            </button>
          ) : null}

          {shouldCollapseList && listExpanded ? (
            <button
              type="button"
              className="btn btn-link btn-sm px-0 mt-2"
              onClick={() => setListExpanded(false)}
            >
              收合摘要
            </button>
          ) : null}
        </div>
      )}

      {hasMainImage && (
        <div className="mt-3 privacy-image-container">
          <img
            src={content.imageUrl}
            alt={content.imageAlt || question.label || '說明圖片'}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-3">
          <div className="row">
            {images.map((img) => {
              const style = variantStyle(img.variant);
              return (
                <div className="col-md-6 mb-3" key={`${img.url}-${img.caption}`}>
                  <div className="p-3 rounded" style={{ ...style, textAlign: 'center' }}>
                    {img.caption ? (
                      <strong style={{ color: style.titleColor, display: 'block', marginBottom: '0.5rem' }}>
                        {img.caption}
                      </strong>
                    ) : null}
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.alt || img.caption || ''}
                        style={{
                          maxWidth: '100%',
                          maxHeight: 300,
                          border: style.border,
                          borderRadius: 5,
                          cursor: 'pointer',
                        }}
                        onClick={() => window.open(img.url, '_blank')}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
