// components/english-test/PhotoViewer.js
import React, { useState, useRef, useEffect } from 'react';

export default function PhotoViewer({ 
  imageUrl, 
  alt = '證件照',
  standardWidth = 413,  // 標準證件照寬度（像素）
  standardHeight = 531  // 標準證件照高度（像素）
}) {
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(2);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [sizeMatch, setSizeMatch] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (imgRef.current && imageUrl) {
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
        // 檢查尺寸是否符合標準（允許 ±10px 誤差）
        const widthMatch = Math.abs(img.width - standardWidth) <= 10;
        const heightMatch = Math.abs(img.height - standardHeight) <= 10;
        setSizeMatch(widthMatch && heightMatch);
      };
      img.src = imageUrl.startsWith('/') ? imageUrl : `/uploads/${imageUrl}`;
    }
  }, [imageUrl, standardWidth, standardHeight]);

  const handleMouseMove = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMagnifierPos({ x, y });
  };

  const handleMouseEnter = () => {
    setShowMagnifier(true);
  };

  const handleMouseLeave = () => {
    setShowMagnifier(false);
  };

  const handleDragStart = (e) => {
    e.preventDefault();
  };

  return (
    <div className="position-relative">
      <div
        className="position-relative"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block', cursor: 'zoom-in' }}
      >
        <img
          ref={imgRef}
          src={imageUrl.startsWith('/') ? imageUrl : `/uploads/${imageUrl}`}
          alt={alt}
          style={{
            maxWidth: '100%',
            maxHeight: '400px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            userSelect: 'none'
          }}
          draggable={false}
          onDragStart={handleDragStart}
        />
        
        {/* 放大鏡 */}
        {showMagnifier && imgRef.current && (
          <div
            style={{
              position: 'absolute',
              left: magnifierPos.x + 20,
              top: magnifierPos.y + 20,
              width: '150px',
              height: '150px',
              border: '3px solid #2a5d9f',
              borderRadius: '50%',
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 1000,
              backgroundImage: `url(${imageUrl.startsWith('/') ? imageUrl : `/uploads/${imageUrl}`})`,
              backgroundSize: `${imgRef.current.width * zoomLevel}px ${imgRef.current.height * zoomLevel}px`,
              backgroundPosition: `-${magnifierPos.x * zoomLevel - 75}px -${magnifierPos.y * zoomLevel - 75}px`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          />
        )}
      </div>

      {/* 尺寸比對提示 */}
      {imageSize.width > 0 && (
        <div className="mt-2">
          {sizeMatch ? (
            <div className="alert alert-success mb-0 py-2">
              <i className="fas fa-check-circle me-2"></i>
              <strong>尺寸符合標準：</strong>
              {imageSize.width} × {imageSize.height} 像素
            </div>
          ) : (
            <div className="alert alert-warning mb-0 py-2">
              <i className="fas fa-exclamation-triangle me-2"></i>
              <strong>尺寸提醒：</strong>
              目前 {imageSize.width} × {imageSize.height} 像素
              <br />
              <small>標準尺寸：{standardWidth} × {standardHeight} 像素</small>
            </div>
          )}
        </div>
      )}

      {/* 拖曳放大控制 */}
      <div className="mt-2 d-flex align-items-center gap-2">
        <label className="form-label mb-0">縮放：</label>
        <input
          type="range"
          className="form-range"
          min="1"
          max="5"
          step="0.5"
          value={zoomLevel}
          onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
          style={{ width: '150px' }}
        />
        <span>{zoomLevel}x</span>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => {
            const newWindow = window.open();
            newWindow.document.write(`
              <html>
                <head><title>${alt}</title></head>
                <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f0f0">
                  <img src="${imageUrl.startsWith('/') ? imageUrl : `/uploads/${imageUrl}`}" 
                       style="max-width:90%;max-height:90%;border:2px solid #ddd;border-radius:8px" />
                </body>
              </html>
            `);
          }}
        >
          <i className="fas fa-expand me-1"></i>
          全螢幕檢視
        </button>
      </div>
    </div>
  );
}
