import React from 'react';

function ColumnSlot({ slot }) {
  if (!slot) return null;
  if (slot.kind === 'image') {
    if (!slot.url) {
      return <div className="wb-columns__placeholder text-muted small">尚未設定圖片</div>;
    }
    return (
      <figure className="wb-columns__figure">
        <img src={slot.url} alt={slot.alt || ''} loading="lazy" />
        {slot.caption ? <figcaption>{slot.caption}</figcaption> : null}
      </figure>
    );
  }
  if (!slot.html) {
    return <div className="wb-columns__placeholder text-muted small">尚未填寫內容</div>;
  }
  return <div className="wb-rich wb-columns__rich" dangerouslySetInnerHTML={{ __html: slot.html }} />;
}

export default function ColumnsBlock({ props }) {
  const ratio = props?.ratio || '50-50';
  return (
    <div className={`wb-columns wb-columns--${ratio}`}>
      <div className="wb-columns__col">
        <ColumnSlot slot={props?.left} />
      </div>
      <div className="wb-columns__col">
        <ColumnSlot slot={props?.right} />
      </div>
    </div>
  );
}
