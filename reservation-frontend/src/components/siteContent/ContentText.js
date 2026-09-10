import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useSiteContentVisualEdit } from '../../context/SiteContentVisualEditContext';
import './ContentText.css';

/**
 * 學生端文案節點；在後台視覺編輯模式下可點擊選取並修改。
 * 若文案含換行字元，以 pre-wrap 保留編輯時的段落換行。
 */
export default function ContentText({
  k,
  as: Tag = 'span',
  className,
  children,
  ...rest
}) {
  const { t } = useLanguage();
  const visual = useSiteContentVisualEdit();
  const text = children ?? t(k);
  const hasLineBreaks = typeof text === 'string' && /[\r\n]/.test(text);

  const baseClasses = [
    className,
    hasLineBreaks ? 'scm-content-text--prewrap' : '',
  ].filter(Boolean).join(' ');

  if (!visual?.enabled || !visual.isEditable(k)) {
    return (
      <Tag className={baseClasses || undefined} {...rest}>
        {text}
      </Tag>
    );
  }

  const isActive = visual.activeKey === k;
  const classes = [
    baseClasses,
    'scm-visual-editable',
    isActive ? 'is-active' : '',
  ].filter(Boolean).join(' ');

  const handleSelect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    visual.selectKey(k);
  };

  return (
    <Tag
      {...rest}
      className={classes}
      data-content-key={k}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSelect(e);
        }
      }}
      role="button"
      tabIndex={0}
      title="點擊編輯這段文字"
    >
      {text}
    </Tag>
  );
}
