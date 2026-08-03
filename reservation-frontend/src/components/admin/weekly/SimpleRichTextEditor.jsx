import React, { useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

function wrapSelection(textarea, before, after = before) {
  const el = textarea;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const val = el.value;
  const selected = val.slice(start, end);
  const next = `${val.slice(0, start)}${before}${selected}${after}${val.slice(end)}`;
  el.value = next;
  el.focus();
  el.setSelectionRange(start + before.length, start + before.length + selected.length);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function SimpleRichTextEditor({ value, onChange, rows = 8, label }) {
  const [mode, setMode] = useState('visual');
  const htmlRef = useRef(null);
  const visualRef = useRef(null);

  useEffect(() => {
    if (mode === 'visual' && visualRef.current && visualRef.current.innerHTML !== value) {
      visualRef.current.innerHTML = value || '';
    }
  }, [mode, value]);

  const runVisualCmd = (cmd) => {
    if (mode !== 'visual' || !visualRef.current) return;
    visualRef.current.focus();
    if (cmd === 'link') {
      const url = window.prompt('連結 URL', 'https://');
      if (!url) return;
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand(cmd, false, null);
    }
    onChange(visualRef.current.innerHTML);
  };

  const handleHtmlFormat = (cmd) => {
    const el = htmlRef.current;
    if (!el) return;
    switch (cmd) {
      case 'b':
        wrapSelection(el, '<strong>', '</strong>');
        break;
      case 'i':
        wrapSelection(el, '<em>', '</em>');
        break;
      case 'h2':
        wrapSelection(el, '<h2>', '</h2>');
        break;
      case 'ul':
        wrapSelection(el, '<ul><li>', '</li></ul>');
        break;
      case 'link': {
        const url = window.prompt('連結 URL', 'https://');
        if (!url) return;
        wrapSelection(el, `<a href="${url}">`, '</a>');
        break;
      }
      default:
        break;
    }
    onChange(el.value);
  };

  const handleFormat = (cmd) => {
    if (mode === 'visual') {
      const map = { b: 'bold', i: 'italic', h2: 'formatBlock', ul: 'insertUnorderedList' };
      if (cmd === 'h2') {
        document.execCommand('formatBlock', false, 'h2');
        onChange(visualRef.current?.innerHTML || '');
        return;
      }
      if (cmd === 'ul') runVisualCmd('insertUnorderedList');
      else if (cmd === 'link') runVisualCmd('link');
      else runVisualCmd(map[cmd] || cmd);
    } else {
      handleHtmlFormat(cmd);
    }
  };

  return (
    <div className="weekly-richtext-editor">
      {label ? <div className="form-label mb-1">{label}</div> : null}
      <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
        <ButtonGroup size="sm">
          <Button variant={mode === 'visual' ? 'primary' : 'outline-secondary'} type="button" onClick={() => setMode('visual')}>視覺</Button>
          <Button variant={mode === 'html' ? 'primary' : 'outline-secondary'} type="button" onClick={() => setMode('html')}>HTML</Button>
        </ButtonGroup>
        <ButtonGroup size="sm" className="flex-wrap">
          <Button variant="outline-secondary" type="button" onClick={() => handleFormat('b')}>粗體</Button>
          <Button variant="outline-secondary" type="button" onClick={() => handleFormat('i')}>斜體</Button>
          <Button variant="outline-secondary" type="button" onClick={() => handleFormat('h2')}>小標</Button>
          <Button variant="outline-secondary" type="button" onClick={() => handleFormat('ul')}>清單</Button>
          <Button variant="outline-secondary" type="button" onClick={() => handleFormat('link')}>連結</Button>
        </ButtonGroup>
      </div>
      {mode === 'visual' ? (
        <div
          ref={visualRef}
          className="weekly-richtext-editor__visual form-control"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
          role="textbox"
          aria-multiline="true"
        />
      ) : (
        <textarea
          ref={htmlRef}
          className="form-control font-monospace"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      )}
      <div className="form-text">支援簡易 HTML；發布前後端會自動清理不安全標籤。</div>
    </div>
  );
}
