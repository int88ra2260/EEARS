import React from 'react';

function pickText(item, lang, zhKey = 'textZh', enKey = 'textEn') {
  if (!item) return '';
  if (lang === 'en') return item[enKey] || item[zhKey] || '';
  return item[zhKey] || item[enKey] || '';
}

function ListItem({ item, lang }) {
  const text = pickText(item, lang);
  const body = item.href ? (
    <a className="course-guide-a" href={item.href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  ) : (
    text
  );

  return (
    <li>
      {body}
      {Array.isArray(item.children) && item.children.length > 0 ? (
        <ul className="course-guide-ul course-guide-ul--tight">
          {item.children.map((child, idx) => (
            <ListItem key={`${text}-${idx}`} item={child} lang={lang} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function renderList(block, lang, key) {
  const style = block.style || 'ul';
  const className =
    style === 'ol'
      ? 'course-guide-ol'
      : style === 'tight'
        ? 'course-guide-ul course-guide-ul--tight'
        : 'course-guide-ul';
  const Tag = style === 'ol' ? 'ol' : 'ul';
  const items = Array.isArray(block.items) ? block.items : [];

  return (
    <Tag key={key} className={className}>
      {items.map((item, idx) => (
        <ListItem key={`${key}-${idx}`} item={item} lang={lang} />
      ))}
    </Tag>
  );
}

export function CourseGuideBlocks({ blocks, lang = 'zh' }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return blocks.map((block, index) => {
    const key = `${block.type || 'block'}-${index}`;

    if (block.type === 'figure') {
      const src = block.src || '';
      const alt = pickText(block, lang, 'altZh', 'altEn');
      const caption = pickText(block, lang, 'captionZh', 'captionEn');
      if (!src) return null;
      return (
        <figure key={key} className="course-guide-figure">
          <a href={src} target="_blank" rel="noopener noreferrer">
            <img src={src} alt={alt} loading="lazy" />
          </a>
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      );
    }

    if (block.type === 'heading') {
      const Tag = block.level === 3 ? 'h3' : 'h4';
      const className = block.level === 3 ? 'course-guide-h3' : 'course-guide-h4';
      return (
        <Tag key={key} className={className}>
          {pickText(block, lang)}
        </Tag>
      );
    }

    if (block.type === 'paragraph') {
      const className = block.muted
        ? 'course-guide-p course-guide-p--muted'
        : 'course-guide-p';
      return (
        <p key={key} className={className}>
          {pickText(block, lang)}
        </p>
      );
    }

    if (block.type === 'list') {
      return renderList(block, lang, key);
    }

    if (block.type === 'callout') {
      const items = Array.isArray(block.items) ? block.items : [];
      return (
        <div key={key} className="course-guide-callout">
          <div className="course-guide-callout__title">
            {pickText(block, lang, 'titleZh', 'titleEn')}
          </div>
          <ul className="course-guide-ul course-guide-ul--tight">
            {items.map((item, idx) => (
              <li key={`${key}-i-${idx}`}>{pickText(item, lang)}</li>
            ))}
          </ul>
        </div>
      );
    }

    return null;
  });
}

export default CourseGuideBlocks;
