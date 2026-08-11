import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button, Pagination, Modal, Dropdown } from 'react-bootstrap';
import {
  fetchAdminAnnouncements,
  createAdminAnnouncement,
  updateAdminAnnouncement,
  deleteAdminAnnouncement,
  patchPin,
  postPublishAnnouncement,
  postUnpublishAnnouncement,
  postArchiveAnnouncement,
  postDuplicateAnnouncement,
  postBulkAnnouncementAction,
} from '../../services/announcementAdminApi';
import AnnouncementFilters from '../../components/admin/announcements/AnnouncementFilters';
import AnnouncementTable from '../../components/admin/announcements/AnnouncementTable';
import AnnouncementWorkflowGuide from '../../components/admin/announcements/AnnouncementWorkflowGuide';
import AnnouncementFormModal from '../../components/admin/announcements/AnnouncementFormModal';
import {
  getAnnouncementPublishAction,
  getArchiveConfirmCopy,
  getPublishConfirmCopy,
  getUnpublishConfirmCopy,
} from '../../constants/announcementLabels';
import SkeletonCard from '../../components/ui/SkeletonCard';
import useConfirm from '../../components/ui/useConfirm';
import { formatDateTimeYMDHM } from '../../utils/announcementFormatters';

const limit = 20;

export default function AnnouncementManagementPage() {
  const { token } = useOutletContext();
  const confirm = useConfirm();

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [pinned, setPinned] = useState('');
  const [category, setCategory] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [applied, setApplied] = useState({
    keyword: '',
    status: 'all',
    pinned: '',
    category: '',
    authorId: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        q: applied.keyword.trim() || undefined,
        status: applied.status,
        pinned: applied.pinned || undefined,
        category: applied.category || undefined,
        authorId: applied.authorId.trim() || undefined,
        dateFrom: applied.dateFrom || undefined,
        dateTo: applied.dateTo || undefined,
        sortBy: applied.sortBy,
        sortOrder: applied.sortOrder,
      };
      const data = await fetchAdminAnnouncements(token, params);
      setItems(data.items || []);
      setPagination(data.pagination || { total: 0, totalPages: 1 });
      setSelectedIds(new Set());
    } catch (e) {
      setToast(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, page, applied]);

  useEffect(() => {
    load();
  }, [load]);

  const onApply = () => {
    setApplied({
      keyword,
      status,
      pinned,
      category,
      authorId,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    });
    setPage(1);
  };

  const onReset = () => {
    setKeyword('');
    setStatus('all');
    setPinned('');
    setCategory('');
    setAuthorId('');
    setDateFrom('');
    setDateTo('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setApplied({
      keyword: '',
      status: 'all',
      pinned: '',
      category: '',
      authorId: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleFormSubmit = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        await updateAdminAnnouncement(token, editing.id, payload);
        setToast('已更新公告');
      } else {
        await createAdminAnnouncement(token, payload);
        setToast('已建立公告');
      }
      closeModal();
      await load();
    } catch (e) {
      setToast(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setSaving(true);
    try {
      await deleteAdminAnnouncement(token, deleteRow.id);
      setToast('已刪除');
      setDeleteRow(null);
      await load();
    } catch (e) {
      setToast(e.message || '刪除失敗');
    } finally {
      setSaving(false);
    }
  };

  const onTogglePublish = async (row) => {
    try {
      const { willUnpublish } = getAnnouncementPublishAction(row);

      if (willUnpublish) {
        const copy = getUnpublishConfirmCopy(row.title);
        const ok = await confirm({
          title: copy.title,
          description: copy.description,
          confirmText: copy.confirmText,
          cancelText: '取消',
          variant: 'danger',
        });
        if (!ok) return;
      } else {
        const copy = getPublishConfirmCopy(row.title, row.status);
        const ok = await confirm({
          title: copy.title,
          description: copy.description,
          confirmText: copy.confirmText,
          cancelText: '取消',
          variant: 'warning',
        });
        if (!ok) return;
      }

      setActionBusyId(row.id);
      if (willUnpublish) {
        await postUnpublishAnnouncement(token, row.id);
        setToast('已下架（暫時隱藏）。需要恢復時，請按「再發布」。');
      } else {
        await postPublishAnnouncement(token, row.id, {});
        setToast(row.status === 'published' ? '已發布' : '已再發布，前台可見');
      }
      await load();
    } catch (e) {
      setToast(e.message || '操作失敗');
    } finally {
      setActionBusyId(null);
    }
  };

  const onTogglePin = async (row) => {
    try {
      setActionBusyId(row.id);
      await patchPin(token, row.id, !row.isPinned);
      setToast('已更新置頂');
      await load();
    } catch (e) {
      setToast(e.message || '操作失敗');
    } finally {
      setActionBusyId(null);
    }
  };

  const onArchive = async (row) => {
    try {
      const copy = getArchiveConfirmCopy(row.title);
      const ok = await confirm({
        title: copy.title,
        description: copy.description,
        confirmText: copy.confirmText,
        cancelText: '取消',
        variant: 'danger',
      });
      if (!ok) return;

      setActionBusyId(row.id);
      await postArchiveAnnouncement(token, row.id);
      setToast('已封存（長期歸檔）。後台仍可查詢；若要恢復前台顯示，請按「再發布」。');
      await load();
    } catch (e) {
      setToast(e.message || '操作失敗');
    } finally {
      setActionBusyId(null);
    }
  };

  const onDuplicate = async (row) => {
    try {
      setActionBusyId(row.id);
      await postDuplicateAnnouncement(token, row.id);
      setToast('已複製為新草稿');
      await load();
    } catch (e) {
      setToast(e.message || '複製失敗');
    } finally {
      setActionBusyId(null);
    }
  };

  const toggleSelect = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((r) => r.id)));
  };

  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const visibleStats = useMemo(() => {
    const isPublished = (a) => a?.status === 'published' || a?.isPublished === true;
    const isArchived = (a) => a?.status === 'archived';
    const isUnpublished = (a) => a?.status === 'unpublished';

    const publishedCount = items.filter(isPublished).length;
    const archivedCount = items.filter(isArchived).length;
    const unpublishedCount = items.filter(isUnpublished).length;
    const draftCount = items.filter((a) => !isPublished(a) && !isArchived(a) && !isUnpublished(a)).length;

    const latestUpdatedAt = items
      .map((a) => a?.updatedAt || a?.publishedAt || a?.createdAt)
      .filter(Boolean)
      .reduce((max, v) => {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return max;
        if (!max) return v;
        const md = new Date(max);
        return d > md ? v : max;
      }, null);

    return {
      publishedCount,
      draftCount,
      unpublishedCount,
      archivedCount,
      latestUpdatedAt,
    };
  }, [items]);

  const runBulk = async (action) => {
    if (!selectedList.length) {
      setToast('請先勾選公告');
      return;
    }

    if (['publish', 'unpublish', 'archive', 'delete'].includes(action)) {
      const ok = await confirm({
        title: '確認批次操作',
        description:
          action === 'publish'
            ? '確定要批次發布這些公告嗎？發布後將出現在前台。'
            : action === 'unpublish'
              ? '確定要批次下架嗎？\n\n• 前台將暫時不可見\n• 之後可個別「再發布」恢復'
              : action === 'archive'
                ? '確定要批次封存嗎？\n\n• 適合過期或不再當現行資訊的公告\n• 前台不可見，但後台仍可查詢'
                : '確定要批次刪除這些公告嗎？此操作無法復原（軟刪除）。',
        confirmText:
          action === 'delete'
            ? '確定刪除'
            : action === 'unpublish'
              ? '確定下架'
              : action === 'archive'
                ? '確定封存'
                : '確定發布',
        cancelText: '取消',
        variant: action === 'delete' || action === 'unpublish' || action === 'archive' ? 'danger' : 'warning',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const results = await postBulkAnnouncementAction(token, { action, ids: selectedList });
      setToast(`批次完成：成功 ${results.ok}，失敗 ${results.failed}`);
      await load();
    } catch (e) {
      setToast(e.message || '批次操作失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="mb-1">公告管理</h2>
          <p className="text-muted mb-0">篩選、編輯公告，並控管發布、下架（暫時隱藏）與封存（長期歸檔）</p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <Dropdown>
            <Dropdown.Toggle variant="outline-secondary" size="sm" disabled={saving || !selectedList.length}>
              批次操作 ({selectedList.length})
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => runBulk('publish')}>批次發布</Dropdown.Item>
              <Dropdown.Item onClick={() => runBulk('unpublish')}>批次下架（暫時隱藏）</Dropdown.Item>
              <Dropdown.Item onClick={() => runBulk('archive')}>批次封存（長期歸檔）</Dropdown.Item>
              <Dropdown.Item onClick={() => runBulk('pin')}>批次置頂</Dropdown.Item>
              <Dropdown.Item onClick={() => runBulk('unpin')}>批次取消置頂</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => runBulk('delete')}>批次刪除（軟刪）</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button variant="primary" onClick={openCreate}>
            新增公告
          </Button>
        </div>
      </div>

      {toast && (
        <div className="alert alert-info py-2 mb-3" role="status">
          {toast}
          <button type="button" className="btn btn-sm btn-link float-end p-0" onClick={() => setToast('')}>
            關閉
          </button>
        </div>
      )}

      <AnnouncementWorkflowGuide />

      <div className="row g-2 mb-3">
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="col-md-3">
                <div className="p-2 border rounded bg-light">
                  <SkeletonCard lines={2} titleHeight={14} />
                </div>
              </div>
            ))
          : [
              {
                title: '全部（本頁）',
                value: items.length,
              },
              {
                title: '已發布',
                value: visibleStats.publishedCount,
              },
              {
                title: '已下架',
                value: visibleStats.unpublishedCount,
                hint: '暫時隱藏，可再發布',
              },
              {
                title: '已封存',
                value: visibleStats.archivedCount,
                hint: '長期歸檔，後台可查',
              },
              {
                title: '草稿／排程',
                value: visibleStats.draftCount,
              },
              {
                title: '最近更新',
                value: visibleStats.latestUpdatedAt ? formatDateTimeYMDHM(visibleStats.latestUpdatedAt) : '—',
              },
            ].map((s) => (
              <div key={s.title} className="col-md-4 col-lg-2">
                <div className="p-2 border rounded bg-light h-100">
                  <div className="small text-muted mb-1" title={s.hint || undefined}>
                    {s.title}
                  </div>
                  <div className="fw-bold" style={{ wordBreak: 'break-word' }}>
                    {s.value}
                  </div>
                  {s.hint ? <div className="small text-muted mt-1">{s.hint}</div> : null}
                </div>
              </div>
            ))}
      </div>

      <AnnouncementFilters
        keyword={keyword}
        setKeyword={setKeyword}
        status={status}
        setStatus={setStatus}
        pinned={pinned}
        setPinned={setPinned}
        category={category}
        setCategory={setCategory}
        authorId={authorId}
        setAuthorId={setAuthorId}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        onSearch={onApply}
        onReset={onReset}
      />

      <AnnouncementTable
        items={items}
        loading={loading}
        selectedIds={selectedIds}
        actionBusyId={actionBusyId}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onEdit={openEdit}
        onDeleteClick={(row) => setDeleteRow(row)}
        onTogglePublish={onTogglePublish}
        onTogglePin={onTogglePin}
        onArchive={onArchive}
        onDuplicate={onDuplicate}
      />

      {!loading && pagination.totalPages > 1 && (
        <Pagination className="justify-content-center mt-3">
          <Pagination.Prev disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
          <Pagination.Item active>
            {page} / {pagination.totalPages}
          </Pagination.Item>
          <Pagination.Next
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          />
        </Pagination>
      )}

      <AnnouncementFormModal
        show={modalOpen}
        onHide={closeModal}
        initial={editing}
        onSubmit={handleFormSubmit}
        saving={saving}
        token={token}
      />

      <Modal show={!!deleteRow} onHide={() => !saving && setDeleteRow(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>確認刪除</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          確定要刪除「{deleteRow?.title}」嗎？此操作無法復原（軟刪除僅保留背景資料脈絡，slug 可能仍保留）。
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteRow(null)} disabled={saving}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={saving}>
            {saving ? '刪除中…' : '刪除'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
