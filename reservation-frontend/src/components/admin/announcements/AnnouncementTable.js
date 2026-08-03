import React from 'react';
import { Table, Button, Badge, Form } from 'react-bootstrap';
import dayjs from 'dayjs';
import useMediaQuery from '../../../hooks/useMediaQuery';
import SkeletonCard from '../../ui/SkeletonCard';

const STATUS_BADGE = {
  draft: { bg: 'secondary', label: '草稿' },
  scheduled: { bg: 'info', label: '已排程' },
  published: { bg: 'success', label: '已發布' },
  unpublished: { bg: 'warning', label: '已下架', text: 'dark' },
  archived: { bg: 'dark', label: '已封存' },
};

function fmt(d) {
  if (!d) return '—';
  return dayjs(d).format('YYYY/MM/DD HH:mm');
}

function statusBadge(row) {
  const st = row.status || (row.isPublished ? 'published' : 'draft');
  const cfg = STATUS_BADGE[st] || STATUS_BADGE.draft;
  return (
    <Badge bg={cfg.bg} text={cfg.text}>
      {cfg.label}
    </Badge>
  );
}

export default function AnnouncementTable({
  items,
  loading,
  selectedIds,
  actionBusyId,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDeleteClick,
  onTogglePublish,
  onTogglePin,
  onArchive,
  onDuplicate,
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (loading) {
    return (
      <div>
        <div className="row g-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={idx} className="col-12">
              <SkeletonCard lines={3} titleHeight={14} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center text-muted py-4" role="status" aria-live="polite">
        尚未建立公告。點擊「新增公告」建立第一則公告。
      </div>
    );
  }

  const allChecked = items.length > 0 && items.every((r) => selectedIds.has(r.id));
  const isRowBusy = (row) => actionBusyId != null && row?.id === actionBusyId;

  if (isMobile) {
    return (
      <div className="d-flex flex-column gap-2">
        {items.map((row) => (
          <div key={row.id} className="p-2 border rounded bg-white">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <div
                  className="fw-semibold"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={row.title}
                >
                  {row.title}
                </div>
                <div className="small text-muted d-flex flex-wrap align-items-center gap-2 mt-1">
                  {statusBadge(row)}
                  {row.isPinned ? <Badge bg="warning" text="dark">置頂</Badge> : null}
                  <span title={row.slug}>
                    <code className="small">{row.slug}</code>
                  </span>
                  <span>{fmt(row.publishedAt)}</span>
                  <span className="text-muted" style={{ opacity: 0.9 }}>
                    更新 {fmt(row.updatedAt)}
                  </span>
                </div>
              </div>

              <Form.Check
                checked={selectedIds.has(row.id)}
                onChange={(e) => onToggleSelect(row.id, e.target.checked)}
                aria-label={`選取 ${row.title}`}
                style={{ marginTop: 6, flex: '0 0 auto' }}
              />
            </div>

            <div className="d-flex flex-wrap gap-1 mt-2">
              <Button size="sm" variant="outline-primary" onClick={() => onEdit(row)} disabled={isRowBusy(row)}>
                編輯
              </Button>
              <Button
                size="sm"
                variant={row.status === 'published' || row.isPublished ? 'outline-warning' : 'outline-success'}
                onClick={() => onTogglePublish(row)}
                disabled={isRowBusy(row)}
              >
                {row.status === 'published' || row.isPublished ? '下架' : '發布'}
              </Button>
              <Button
                size="sm"
                variant={row.isPinned ? 'outline-secondary' : 'outline-info'}
                onClick={() => onTogglePin(row)}
                disabled={isRowBusy(row)}
              >
                {row.isPinned ? '取消置頂' : '置頂'}
              </Button>
              <Button size="sm" variant="outline-dark" onClick={() => onArchive(row)} disabled={isRowBusy(row) || row.status === 'archived'}>
                封存
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={() => onDuplicate(row)} disabled={isRowBusy(row)}>
                複製
              </Button>
              <Button size="sm" variant="outline-danger" onClick={() => onDeleteClick(row)} disabled={isRowBusy(row)}>
                刪除
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <Table striped bordered hover size="sm" className="align-middle">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <Form.Check
                checked={allChecked}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
                aria-label="全選"
              />
            </th>
            <th>標題</th>
            <th>slug</th>
            <th>狀態</th>
            <th>置頂</th>
            <th>分類</th>
            <th>發布時間</th>
            <th>更新</th>
            <th>作者</th>
            <th style={{ minWidth: 280 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>
                <Form.Check
                  checked={selectedIds.has(row.id)}
                  onChange={(e) => onToggleSelect(row.id, e.target.checked)}
                  aria-label={`選取 ${row.title}`}
                />
              </td>
              <td>{row.title}</td>
              <td>
                <code className="small">{row.slug}</code>
              </td>
              <td>{statusBadge(row)}</td>
              <td>{row.isPinned ? <Badge bg="warning" text="dark">置頂</Badge> : '—'}</td>
              <td>{row.category || '—'}</td>
              <td>{fmt(row.publishedAt)}</td>
              <td>{fmt(row.updatedAt)}</td>
              <td className="small">{row.authorNameSnapshot || row.authorId || '—'}</td>
              <td>
                <div className="d-flex flex-wrap gap-1">
                  <Button size="sm" variant="outline-primary" onClick={() => onEdit(row)} disabled={isRowBusy(row)}>
                    編輯
                  </Button>
                  <Button
                    size="sm"
                    variant={row.status === 'published' || row.isPublished ? 'outline-warning' : 'outline-success'}
                    onClick={() => onTogglePublish(row)}
                    disabled={isRowBusy(row)}
                  >
                    {row.status === 'published' || row.isPublished ? '下架' : '發布'}
                  </Button>
                  <Button
                    size="sm"
                    variant={row.isPinned ? 'outline-secondary' : 'outline-info'}
                    onClick={() => onTogglePin(row)}
                    disabled={isRowBusy(row)}
                  >
                    {row.isPinned ? '取消置頂' : '置頂'}
                  </Button>
                  <Button size="sm" variant="outline-dark" onClick={() => onArchive(row)} disabled={isRowBusy(row) || row.status === 'archived'}>
                    封存
                  </Button>
                  <Button size="sm" variant="outline-secondary" onClick={() => onDuplicate(row)} disabled={isRowBusy(row)}>
                    複製
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => onDeleteClick(row)} disabled={isRowBusy(row)}>
                    刪除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
