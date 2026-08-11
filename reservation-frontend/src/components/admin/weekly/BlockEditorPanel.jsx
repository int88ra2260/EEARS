import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import WeeklyMediaPicker from './WeeklyMediaPicker';
import WordBridgeThemePicker from './WordBridgeThemePicker';
import EventPicker from './EventPicker';
import AnnouncementPicker from './AnnouncementPicker';

function MediaUrlField({ label, value, onChange, token, kind }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isImage = kind === 'image' || !kind;
  return (
    <>
      <Form.Group className="mb-2">
        <Form.Label>{label}</Form.Label>
        <div className="d-flex gap-2">
          <Form.Control
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isImage ? '點右側從媒體庫選擇，或貼上圖片網址' : '/uploads/weekly/...'}
          />
          <Button variant="outline-secondary" type="button" onClick={() => setPickerOpen(true)}>
            {isImage ? '選擇圖片' : '選擇檔案'}
          </Button>
        </div>
        {value && isImage ? (
          <div className="mt-2" style={{ maxWidth: 180 }}>
            <img
              src={value}
              alt=""
              style={{ width: '100%', borderRadius: 8, border: '1px solid #eaeaea' }}
            />
          </div>
        ) : null}
      </Form.Group>
      <WeeklyMediaPicker
        show={pickerOpen}
        onHide={() => setPickerOpen(false)}
        token={token}
        kind={kind}
        onSelect={(item) => onChange(item.url || item.urlPath)}
      />
    </>
  );
}

export default function BlockEditorPanel({ block, onChange, token }) {
  if (!block) {
    return <p className="text-muted small mb-0">選擇左側區塊以編輯內容。</p>;
  }

  const setProp = (key, val) => {
    onChange({ ...block, props: { ...block.props, [key]: val } });
  };

  switch (block.type) {
    case 'hero':
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>Kicker</Form.Label>
            <Form.Control value={block.props.kicker || ''} onChange={(e) => setProp('kicker', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>標題</Form.Label>
            <Form.Control value={block.props.title || ''} onChange={(e) => setProp('title', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>副標 / 首頁摘要</Form.Label>
            <Form.Control as="textarea" rows={2} value={block.props.subtitle || ''} onChange={(e) => setProp('subtitle', e.target.value)} />
          </Form.Group>
          <MediaUrlField label="封面圖（選填）" value={block.props.imageUrl} onChange={(v) => setProp('imageUrl', v)} token={token} kind="image" />
          <Form.Group className="mb-2">
            <Form.Label>圖片替代文字</Form.Label>
            <Form.Control value={block.props.imageAlt || ''} onChange={(e) => setProp('imageAlt', e.target.value)} />
          </Form.Group>
        </>
      );
    case 'richText':
      return (
        <SimpleRichTextEditor
          label="段落內容"
          value={block.props.html || ''}
          onChange={(html) => setProp('html', html)}
          rows={12}
        />
      );
    case 'image':
      return (
        <>
          <MediaUrlField label="圖片 URL" value={block.props.url} onChange={(v) => setProp('url', v)} token={token} kind="image" />
          <Form.Group className="mb-2">
            <Form.Label>說明文字</Form.Label>
            <Form.Control value={block.props.caption || ''} onChange={(e) => setProp('caption', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>寬度</Form.Label>
            <Form.Select value={block.props.width || 'full'} onChange={(e) => setProp('width', e.target.value)}>
              <option value="full">全寬</option>
              <option value="medium">中等</option>
            </Form.Select>
          </Form.Group>
        </>
      );
    case 'gallery': {
      const items = Array.isArray(block.props.items) ? block.props.items : [];
      const addItem = (url) => {
        if (!url) return;
        setProp('items', [...items, { url, alt: '', caption: '' }]);
      };
      const updateItem = (idx, patch) => {
        setProp('items', items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
      };
      const removeItem = (idx) => setProp('items', items.filter((_, i) => i !== idx));
      return (
        <>
          <GalleryAdd token={token} onAdd={addItem} />
          {items.map((item, idx) => (
            <div key={`${item.url}-${idx}`} className="weekly-gallery-edit-item mb-2">
              <img src={item.url} alt="" className="weekly-gallery-edit-item__thumb" />
              <Form.Control className="mb-1" size="sm" value={item.caption || ''} placeholder="說明" onChange={(e) => updateItem(idx, { caption: e.target.value })} />
              <Button size="sm" variant="outline-danger" type="button" onClick={() => removeItem(idx)}>移除</Button>
            </div>
          ))}
        </>
      );
    }
    case 'audio':
      return (
        <>
          <MediaUrlField label="音檔 URL" value={block.props.url} onChange={(v) => setProp('url', v)} token={token} kind="audio" />
          <Form.Group className="mb-2">
            <Form.Label>標題</Form.Label>
            <Form.Control value={block.props.title || ''} onChange={(e) => setProp('title', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>說明</Form.Label>
            <Form.Control value={block.props.caption || ''} onChange={(e) => setProp('caption', e.target.value)} />
          </Form.Group>
        </>
      );
    case 'video':
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>來源</Form.Label>
            <Form.Select value={block.props.provider || 'file'} onChange={(e) => setProp('provider', e.target.value)}>
              <option value="file">上傳檔案</option>
              <option value="youtube">YouTube</option>
            </Form.Select>
          </Form.Group>
          {block.props.provider === 'youtube' ? (
            <Form.Group className="mb-2">
              <Form.Label>YouTube 連結</Form.Label>
              <Form.Control value={block.props.url || ''} onChange={(e) => setProp('url', e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
            </Form.Group>
          ) : (
            <MediaUrlField label="影片 URL" value={block.props.url} onChange={(v) => setProp('url', v)} token={token} kind="video" />
          )}
          <Form.Group className="mb-2">
            <Form.Label>標題</Form.Label>
            <Form.Control value={block.props.title || ''} onChange={(e) => setProp('title', e.target.value)} />
          </Form.Group>
        </>
      );
    case 'callout':
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>樣式</Form.Label>
            <Form.Select value={block.props.variant || 'tip'} onChange={(e) => setProp('variant', e.target.value)}>
              <option value="tip">學習提示</option>
              <option value="info">資訊</option>
              <option value="warning">注意</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>標題</Form.Label>
            <Form.Control value={block.props.title || ''} onChange={(e) => setProp('title', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>內容</Form.Label>
            <Form.Control as="textarea" rows={4} value={block.props.body || ''} onChange={(e) => setProp('body', e.target.value)} />
          </Form.Group>
        </>
      );
    case 'cta':
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>按鈕文字</Form.Label>
            <Form.Control value={block.props.label || ''} onChange={(e) => setProp('label', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>連結</Form.Label>
            <Form.Control value={block.props.href || ''} onChange={(e) => setProp('href', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>樣式</Form.Label>
            <Form.Select value={block.props.variant || 'primary'} onChange={(e) => setProp('variant', e.target.value)}>
              <option value="primary">主要</option>
              <option value="outline">外框</option>
            </Form.Select>
          </Form.Group>
        </>
      );
    case 'wordBridgeChallenge':
      return (
        <WordBridgeThemePicker
          level={block.props.level || 'A2'}
          themeIds={block.props.themeIds || []}
          onLevelChange={(lv) => onChange({ ...block, props: { ...block.props, level: lv, themeIds: [] } })}
          onThemeIdsChange={(ids) => setProp('themeIds', ids)}
        />
      );
    case 'quote':
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>引用內容</Form.Label>
            <Form.Control as="textarea" rows={4} value={block.props.text || ''} onChange={(e) => setProp('text', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>出處（選填）</Form.Label>
            <Form.Control value={block.props.attribution || ''} onChange={(e) => setProp('attribution', e.target.value)} />
          </Form.Group>
        </>
      );
    case 'divider':
      return (
        <Form.Group className="mb-2">
          <Form.Label>樣式</Form.Label>
          <Form.Select value={block.props.style || 'line'} onChange={(e) => setProp('style', e.target.value)}>
            <option value="line">實線</option>
            <option value="dots">點線</option>
            <option value="space">留白</option>
          </Form.Select>
        </Form.Group>
      );
    case 'eventsHighlight':
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>區塊標題</Form.Label>
            <Form.Control value={block.props.title || ''} onChange={(e) => setProp('title', e.target.value)} />
          </Form.Group>
          <EventPicker
            selectedIds={block.props.eventIds || []}
            onChange={(ids) => setProp('eventIds', ids)}
          />
        </>
      );
    case 'announcementCard':
      return (
        <>
          <Form.Label>選擇公告</Form.Label>
          <AnnouncementPicker
            value={block.props}
            onChange={(patch) => onChange({ ...block, props: { ...block.props, ...patch } })}
          />
          <Form.Check
            className="mt-2"
            type="checkbox"
            label="顯示摘要"
            checked={block.props.showSummary !== false}
            onChange={(e) => setProp('showSummary', e.target.checked)}
          />
        </>
      );
    case 'columns': {
      const setSlot = (side, patch) => {
        onChange({
          ...block,
          props: {
            ...block.props,
            [side]: { ...(block.props[side] || {}), ...patch },
          },
        });
      };
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>欄寬比例</Form.Label>
            <Form.Select value={block.props.ratio || '50-50'} onChange={(e) => setProp('ratio', e.target.value)}>
              <option value="50-50">50 / 50</option>
              <option value="40-60">40 / 60</option>
              <option value="60-40">60 / 40</option>
            </Form.Select>
          </Form.Group>
          <ColumnSlotEditor
            label="左欄"
            slot={block.props.left || {}}
            token={token}
            onChange={(patch) => setSlot('left', patch)}
          />
          <ColumnSlotEditor
            label="右欄"
            slot={block.props.right || {}}
            token={token}
            onChange={(patch) => setSlot('right', patch)}
          />
        </>
      );
    }
    case 'embed':
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>嵌入網址（HTTPS）</Form.Label>
            <Form.Control
              value={block.props.url || ''}
              onChange={(e) => setProp('url', e.target.value)}
              placeholder="https://docs.google.com/..."
            />
            <Form.Text className="text-muted">支援 Google Slides、Forms 等 iframe 嵌入連結。</Form.Text>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>標題（選填）</Form.Label>
            <Form.Control value={block.props.title || ''} onChange={(e) => setProp('title', e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>高度（px）</Form.Label>
            <Form.Control
              type="number"
              min={200}
              max={800}
              value={block.props.height || 360}
              onChange={(e) => setProp('height', Number(e.target.value) || 360)}
            />
          </Form.Group>
        </>
      );
    case 'poll': {
      const options = Array.isArray(block.props.options) ? block.props.options : [];
      const updateOption = (idx, patch) => {
        setProp('options', options.map((opt, i) => (i === idx ? { ...opt, ...patch } : opt)));
      };
      const addOption = () => {
        if (options.length >= 6) return;
        setProp('options', [...options, { id: `opt-${Date.now().toString(36)}`, label: '' }]);
      };
      const removeOption = (idx) => setProp('options', options.filter((_, i) => i !== idx));
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>投票問題</Form.Label>
            <Form.Control value={block.props.question || ''} onChange={(e) => setProp('question', e.target.value)} />
          </Form.Group>
          <Form.Label>選項</Form.Label>
          {options.map((opt, idx) => (
            <div key={opt.id || idx} className="d-flex gap-2 mb-2">
              <Form.Control
                size="sm"
                value={opt.label || ''}
                placeholder={`選項 ${idx + 1}`}
                onChange={(e) => updateOption(idx, { label: e.target.value })}
              />
              <Button size="sm" variant="outline-danger" type="button" onClick={() => removeOption(idx)}>移除</Button>
            </div>
          ))}
          <Button size="sm" variant="outline-secondary" type="button" className="mb-2" onClick={addOption}>
            新增選項
          </Button>
          <Form.Check
            type="checkbox"
            className="mb-2"
            label="允許複選"
            checked={!!block.props.allowMultiple}
            onChange={(e) => setProp('allowMultiple', e.target.checked)}
          />
          <Form.Group className="mb-2">
            <Form.Label>結果顯示</Form.Label>
            <Form.Select value={block.props.showResults || 'afterVote'} onChange={(e) => setProp('showResults', e.target.value)}>
              <option value="afterVote">投票後顯示</option>
              <option value="always">一律顯示</option>
              <option value="never">不顯示（僅後台統計）</option>
            </Form.Select>
          </Form.Group>
        </>
      );
    }
    case 'quiz': {
      const questions = Array.isArray(block.props.questions) ? block.props.questions : [];
      const updateQuestion = (idx, patch) => {
        setProp('questions', questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
      };
      const addQuestion = () => {
        if (questions.length >= 10) return;
        setProp('questions', [
          ...questions,
          {
            id: `q-${Date.now().toString(36)}`,
            type: 'choice',
            prompt: '',
            options: ['', '', '', ''],
            correctAnswer: '',
            audioUrl: '',
            explanation: '',
          },
        ]);
      };
      const removeQuestion = (idx) => setProp('questions', questions.filter((_, i) => i !== idx));
      return (
        <>
          <Form.Group className="mb-2">
            <Form.Label>測驗標題</Form.Label>
            <Form.Control value={block.props.title || ''} onChange={(e) => setProp('title', e.target.value)} />
          </Form.Group>
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="weekly-quiz-edit mb-3 p-2 border rounded">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong className="small">題目 {idx + 1}</strong>
                <Button size="sm" variant="outline-danger" type="button" onClick={() => removeQuestion(idx)}>移除</Button>
              </div>
              <Form.Group className="mb-2">
                <Form.Label className="small">題型</Form.Label>
                <Form.Select
                  size="sm"
                  value={q.type || 'choice'}
                  onChange={(e) => updateQuestion(idx, { type: e.target.value })}
                >
                  <option value="choice">選擇題</option>
                  <option value="fill">填空題</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label className="small">題目</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  size="sm"
                  value={q.prompt || ''}
                  onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                />
              </Form.Group>
              <MediaUrlField
                label="聽力音檔（選填）"
                value={q.audioUrl}
                onChange={(v) => updateQuestion(idx, { audioUrl: v })}
                token={token}
                kind="audio"
              />
              {q.type === 'fill' ? (
                <Form.Group className="mb-2">
                  <Form.Label className="small">正確答案</Form.Label>
                  <Form.Control
                    size="sm"
                    value={q.correctAnswer || ''}
                    onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                  />
                </Form.Group>
              ) : (
                <>
                  <Form.Label className="small">選項（每行一個）</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    size="sm"
                    className="mb-2"
                    value={(q.options || []).join('\n')}
                    onChange={(e) => updateQuestion(idx, {
                      options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })}
                  />
                  <Form.Group className="mb-2">
                    <Form.Label className="small">正確答案（須與選項一致）</Form.Label>
                    <Form.Control
                      size="sm"
                      value={q.correctAnswer || ''}
                      onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                    />
                  </Form.Group>
                </>
              )}
              <Form.Group className="mb-0">
                <Form.Label className="small">解析（選填）</Form.Label>
                <Form.Control
                  size="sm"
                  value={q.explanation || ''}
                  onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                />
              </Form.Group>
            </div>
          ))}
          <Button size="sm" variant="outline-primary" type="button" onClick={addQuestion}>
            新增題目
          </Button>
        </>
      );
    }
    case 'spacer':
      return (
        <Form.Group className="mb-2">
          <Form.Label>間距大小</Form.Label>
          <Form.Select value={block.props.size || 'md'} onChange={(e) => setProp('size', e.target.value)}>
            <option value="sm">小</option>
            <option value="md">中</option>
            <option value="lg">大</option>
          </Form.Select>
        </Form.Group>
      );
    default:
      return <p className="text-muted small">此區塊類型尚無編輯器。</p>;
  }
}

function ColumnSlotEditor({ label, slot, token, onChange }) {
  const kind = slot.kind === 'image' ? 'image' : 'richText';
  return (
    <div className="weekly-column-slot mb-3 p-2 border rounded">
      <p className="small fw-semibold mb-2">{label}</p>
      <Form.Group className="mb-2">
        <Form.Label className="small">內容類型</Form.Label>
        <Form.Select
          size="sm"
          value={kind}
          onChange={(e) => {
            const nextKind = e.target.value;
            onChange({
              kind: nextKind,
              html: nextKind === 'richText' ? (slot.html || '<p></p>') : '',
              url: nextKind === 'image' ? (slot.url || '') : '',
              alt: slot.alt || '',
              caption: slot.caption || '',
            });
          }}
        >
          <option value="richText">富文本</option>
          <option value="image">圖片</option>
        </Form.Select>
      </Form.Group>
      {kind === 'richText' ? (
        <SimpleRichTextEditor
          label="內容"
          value={slot.html || ''}
          onChange={(html) => onChange({ html })}
          rows={6}
        />
      ) : (
        <>
          <MediaUrlField label="圖片 URL" value={slot.url} onChange={(v) => onChange({ url: v })} token={token} kind="image" />
          <Form.Group className="mb-2">
            <Form.Label className="small">替代文字</Form.Label>
            <Form.Control size="sm" value={slot.alt || ''} onChange={(e) => onChange({ alt: e.target.value })} />
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label className="small">說明</Form.Label>
            <Form.Control size="sm" value={slot.caption || ''} onChange={(e) => onChange({ caption: e.target.value })} />
          </Form.Group>
        </>
      )}
    </div>
  );
}

function GalleryAdd({ token, onAdd }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline-primary" className="mb-2" type="button" onClick={() => setOpen(true)}>
        新增圖片
      </Button>
      <WeeklyMediaPicker
        show={open}
        onHide={() => setOpen(false)}
        token={token}
        kind="image"
        onSelect={(item) => onAdd(item.url || item.urlPath)}
      />
    </>
  );
}
