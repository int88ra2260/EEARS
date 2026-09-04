import React from 'react';
import { useSiteContentVisualEdit } from '../../context/SiteContentVisualEditContext';

/**
 * 學生端圖片節點；在後台視覺編輯模式下可點擊選取並更換。
 */
export default function ContentImage({
  k,
  src,
  alt = '',
  className,
  ...rest
}) {
  const visual = useSiteContentVisualEdit();

  if (!visual?.enabled || !visual.isEditable(k)) {
    return <img className={className} src={src} alt={alt} {...rest} />;
  }

  const isActive = visual.activeKey === k;
  const wrapClass = [
    'scm-visual-editable',
    'scm-visual-editable--image',
    isActive ? 'is-active' : '',
  ].filter(Boolean).join(' ');

  const handleSelect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    visual.selectKey(k);
  };

  return (
    <button
      type="button"
      className={wrapClass}
      data-content-key={k}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSelect(e);
        }
      }}
      title="點擊更換這張圖片"
      aria-label="點擊更換這張圖片"
    >
      <img className={className} src={src} alt={alt} draggable={false} {...rest} />
      <span className="scm-visual-image-badge" aria-hidden="true">
        {isActive ? '編輯中' : '更換圖片'}
      </span>
    </button>
  );
}
