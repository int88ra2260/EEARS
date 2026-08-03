import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Alert, Button, ButtonGroup, Dropdown, Form } from 'react-bootstrap';
import WeeklyBlockRenderer from '../../components/weekly/WeeklyBlockRenderer';
import BlockEditorPanel from '../../components/admin/weekly/BlockEditorPanel';
import SortableBlockItem from '../../components/admin/weekly/SortableBlockItem';
import WeeklyAnalyticsPanel from '../../components/admin/weekly/WeeklyAnalyticsPanel';
import {
  BLOCK_TYPE_ORDER,
  BLOCK_TYPE_META,
  createBlock,
  defaultBlocksTemplate,
  applyWeeklyLayoutTemplate,
  WEEKLY_LAYOUT_TEMPLATE_OPTIONS,
} from '../../constants/weeklyBlocks';
import {
  createWeeklyPreviewToken,
  fetchAdminWeeklyReport,
  updateAdminWeeklyReport,
} from '../../services/weeklyReportAdminApi';
import './weeklyReportAdmin.css';

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function snapshotState(meta, blocks) {
  return JSON.stringify({ meta, blocks });
}

export default function AdminWeeklyReportEditorPage() {
  const { id } = useParams();
  const { token } = useOutletContext();
  const [report, setReport] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [meta, setMeta] = useState({
    issueKey: '',
    slug: '',
    status: 'draft',
    weekStart: '',
    weekEnd: '',
    publishedAtLocal: '',
  });
  const [selectedId, setSelectedId] = useState(null);
  const [previewViewport, setPreviewViewport] = useState('desktop');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const baselineRef = useRef('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isDirty = useMemo(
    () => snapshotState(meta, blocks) !== baselineRef.current,
    [meta, blocks]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminWeeklyReport(token, id);
      setReport(data);
      const nextMeta = {
        issueKey: data.issueKey || '',
        slug: data.slug || '',
        status: data.status || 'draft',
        weekStart: data.weekStart || '',
        weekEnd: data.weekEnd || '',
        publishedAtLocal: toDatetimeLocalValue(data.publishedAt),
      };
      setMeta(nextMeta);
      const nextBlocks = Array.isArray(data.blocks) && data.blocks.length
        ? data.blocks
        : defaultBlocksTemplate({ title: data.title, headline: data.headline });
      setBlocks(nextBlocks);
      setSelectedId(nextBlocks[0]?.id || null);
      baselineRef.current = snapshotState(nextMeta, nextBlocks);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty) return undefined;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) || null,
    [blocks, selectedId]
  );

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((items) => {
      const oldIndex = items.findIndex((b) => b.id === active.id);
      const newIndex = items.findIndex((b) => b.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const addBlock = (type) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const applyTemplate = (templateId) => {
    const hero = blocks.find((b) => b.type === 'hero');
    const title = hero?.props?.title || report?.title || meta.issueKey;
    const headline = hero?.props?.subtitle || '';
    const next = applyWeeklyLayoutTemplate(templateId, { title, headline });
    if (!next) return;
    const ok = window.confirm('套用版型會取代目前所有區塊，確定要繼續嗎？');
    if (!ok) return;
    setBlocks(next);
    setSelectedId(next[0]?.id || null);
  };

  const moveBlock = (blockId, direction) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, idx, target);
    });
  };

  const duplicateBlock = (blockId) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx < 0) return prev;
      const src = prev[idx];
      const copy = { ...src, id: createBlock(src.type).id, props: { ...src.props } };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setSelectedId(copy.id);
      return next;
    });
  };

  const removeBlock = (blockId) => {
    const block = blocks.find((b) => b.id === blockId);
    const label = BLOCK_TYPE_META[block?.type]?.label || '區塊';
    if (!window.confirm(`確定刪除「${label}」？`)) return;
    const next = blocks.filter((b) => b.id !== blockId);
    setBlocks(next);
    if (selectedId === blockId) {
      setSelectedId(next[0]?.id || null);
    }
  };

  const onSave = async (publishStatus) => {
    setSaving(true);
    setError('');
    try {
      const hero = blocks.find((b) => b.type === 'hero');
      const publishedAt = fromDatetimeLocalValue(meta.publishedAtLocal);
      const body = {
        ...meta,
        status: publishStatus || meta.status,
        title: hero?.props?.title || report?.title || meta.issueKey,
        headline: hero?.props?.subtitle || '',
        blocks,
        blocksVersion: 1,
      };
      delete body.publishedAtLocal;
      if (publishStatus === 'published') {
        body.publishedAt = publishedAt || new Date().toISOString();
      }
      const updated = await updateAdminWeeklyReport(token, id, body);
      const nextMeta = {
        issueKey: updated.issueKey || meta.issueKey,
        slug: updated.slug || meta.slug,
        status: updated.status || meta.status,
        weekStart: updated.weekStart || meta.weekStart,
        weekEnd: updated.weekEnd || meta.weekEnd,
        publishedAtLocal: toDatetimeLocalValue(updated.publishedAt),
      };
      setReport(updated);
      setMeta(nextMeta);
      baselineRef.current = snapshotState(nextMeta, blocks);
      const isScheduled = updated.status === 'published'
        && updated.publishedAt
        && new Date(updated.publishedAt) > new Date();
      if (publishStatus === 'published') {
        setToast(isScheduled ? '已排程發布' : '已發布週報');
      } else {
        setToast('已儲存草稿');
      }
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const onCopyPreviewLink = async () => {
    try {
      const data = await createWeeklyPreviewToken(token, id);
      const url = `${window.location.origin}/weekly/preview/${data.token}`;
      await navigator.clipboard.writeText(url);
      setToast('已複製預覽連結（約 1 小時有效）');
    } catch (err) {
      setError(err.message || '無法產生預覽連結');
    }
  };

  if (loading) {
    return <p className="text-muted">載入編輯器…</p>;
  }

  if (!report) {
    return <Alert variant="danger">{error || '找不到週報'}</Alert>;
  }

  const previewMode = previewViewport === 'modal' ? 'modal' : 'page';

  return (
    <div className="weekly-editor">
      <div className="weekly-editor__toolbar">
        <div>
          <Link to="/admin/weekly-reports" className="small text-muted d-inline-block mb-1">
            ← 返回列表
          </Link>
          <h2 className="mb-0">編輯週報 · {meta.issueKey}</h2>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button variant="outline-secondary" disabled={saving} onClick={onCopyPreviewLink}>
            複製預覽連結
          </Button>
          <Button
            variant="outline-secondary"
            disabled={saving || meta.status !== 'published'}
            onClick={() => window.open(`/weekly/${meta.slug || meta.issueKey}`, '_blank')}
          >
            公開頁
          </Button>
          <Button variant="outline-primary" disabled={saving} onClick={() => onSave('draft')}>
            {saving ? '儲存中…' : '儲存草稿'}
          </Button>
          <Button variant="primary" disabled={saving} onClick={() => onSave('published')}>
            {meta.publishedAtLocal && new Date(meta.publishedAtLocal) > new Date() ? '排程發布' : '發布'}
          </Button>
        </div>
      </div>

      {toast ? (
        <Alert variant="success" dismissible onClose={() => setToast('')}>{toast}</Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>
      ) : null}
      {isDirty ? (
        <Alert variant="info" className="py-2 small mb-3">有未儲存的變更</Alert>
      ) : null}

      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <Form.Group>
            <Form.Label className="small">期數</Form.Label>
            <Form.Control size="sm" value={meta.issueKey} onChange={(e) => setMeta((m) => ({ ...m, issueKey: e.target.value }))} />
          </Form.Group>
        </div>
        <div className="col-md-3">
          <Form.Group>
            <Form.Label className="small">slug</Form.Label>
            <Form.Control size="sm" value={meta.slug} onChange={(e) => setMeta((m) => ({ ...m, slug: e.target.value }))} />
          </Form.Group>
        </div>
        <div className="col-md-2">
          <Form.Group>
            <Form.Label className="small">weekStart</Form.Label>
            <Form.Control size="sm" type="date" value={meta.weekStart} onChange={(e) => setMeta((m) => ({ ...m, weekStart: e.target.value }))} />
          </Form.Group>
        </div>
        <div className="col-md-2">
          <Form.Group>
            <Form.Label className="small">weekEnd</Form.Label>
            <Form.Control size="sm" type="date" value={meta.weekEnd} onChange={(e) => setMeta((m) => ({ ...m, weekEnd: e.target.value }))} />
          </Form.Group>
        </div>
        <div className="col-md-2">
          <Form.Group>
            <Form.Label className="small">發布時間</Form.Label>
            <Form.Control
              size="sm"
              type="datetime-local"
              value={meta.publishedAtLocal}
              onChange={(e) => setMeta((m) => ({ ...m, publishedAtLocal: e.target.value }))}
            />
          </Form.Group>
        </div>
      </div>

      <div className="weekly-editor__layout">
        <aside className="weekly-editor__sidebar">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong className="small">區塊</strong>
            <div className="d-flex gap-1">
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="outline-secondary" id="weekly-apply-template">
                  版型
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {WEEKLY_LAYOUT_TEMPLATE_OPTIONS.map((tpl) => (
                    <Dropdown.Item key={tpl.id} onClick={() => applyTemplate(tpl.id)}>
                      <div>{tpl.label}</div>
                      <div className="small text-muted">{tpl.description}</div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="outline-primary" id="weekly-add-block">
                  新增
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {BLOCK_TYPE_ORDER.map((type) => (
                    <Dropdown.Item key={type} onClick={() => addBlock(type)}>
                      {BLOCK_TYPE_META[type]?.label || type}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
          <p className="weekly-editor__block-hint small text-muted mb-2">
            拖曳左側把手，或使用 ↑↓ 調整順序
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="weekly-editor__block-list">
                {blocks.map((block, index) => (
                  <SortableBlockItem
                    key={block.id}
                    block={block}
                    selected={block.id === selectedId}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                    onSelect={setSelectedId}
                    onMoveUp={(blockId) => moveBlock(blockId, -1)}
                    onMoveDown={(blockId) => moveBlock(blockId, 1)}
                    onDuplicate={duplicateBlock}
                    onRemove={removeBlock}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </aside>

        <section className="weekly-editor__panel">
          <h3 className="h6 mb-3">區塊設定</h3>
          <BlockEditorPanel
            block={selectedBlock}
            token={token}
            onChange={(next) => {
              setBlocks((prev) => prev.map((b) => (b.id === next.id ? next : b)));
            }}
          />
          <WeeklyAnalyticsPanel token={token} reportId={id} />
        </section>

        <section className={`weekly-editor__preview public-site weekly-editor__preview--${previewViewport}`}>
          <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
            <h3 className="h6 mb-0">預覽</h3>
            <ButtonGroup size="sm">
              <Button
                variant={previewViewport === 'desktop' ? 'primary' : 'outline-secondary'}
                type="button"
                onClick={() => setPreviewViewport('desktop')}
              >
                桌面
              </Button>
              <Button
                variant={previewViewport === 'mobile' ? 'primary' : 'outline-secondary'}
                type="button"
                onClick={() => setPreviewViewport('mobile')}
              >
                手機
              </Button>
              <Button
                variant={previewViewport === 'modal' ? 'primary' : 'outline-secondary'}
                type="button"
                onClick={() => setPreviewViewport('modal')}
              >
                首頁彈窗
              </Button>
            </ButtonGroup>
          </div>
          <WeeklyBlockRenderer
            blocks={blocks}
            mode={previewMode}
            weeklySlug={meta.slug || meta.issueKey}
            issueKey={meta.issueKey}
          />
        </section>
      </div>
    </div>
  );
}
