import React from 'react';

export default function EmbedBlock({ props }) {
  const url = String(props?.url || '').trim();
  if (!url) return null;

  const height = Math.min(800, Math.max(200, Number(props?.height) || 360));

  return (
    <div className="wb-embed public-card">
      {props?.title ? <p className="wb-media__title">{props.title}</p> : null}
      <div className="wb-embed__frame">
        <iframe
          src={url}
          title={props?.title || '嵌入內容'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ height: `${height}px` }}
        />
      </div>
    </div>
  );
}
