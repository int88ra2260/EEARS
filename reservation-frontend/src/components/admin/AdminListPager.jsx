import Button from 'react-bootstrap/Button';

export const ADMIN_LIST_PAGE_SIZE = 6;

export function clampPage(page, total, pageSize = ADMIN_LIST_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(Number(total) / pageSize) || 1);
  const current = Number(page) || 1;
  return Math.min(Math.max(1, current), pages);
}

export function slicePage(items, page, pageSize = ADMIN_LIST_PAGE_SIZE) {
  const list = Array.isArray(items) ? items : [];
  const pages = Math.max(1, Math.ceil(list.length / pageSize) || 1);
  const current = clampPage(page, list.length, pageSize);
  const start = (current - 1) * pageSize;
  return {
    current,
    pages,
    start,
    rows: list.slice(start, start + pageSize),
  };
}

export default function AdminListPager({
  page,
  pages,
  total,
  pageSize = ADMIN_LIST_PAGE_SIZE,
  onPage,
  label,
}) {
  if (!total || total <= pageSize || pages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav className="admin-list-pager d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3" aria-label={label}>
      <span className="small text-muted">第 {start}–{end} 筆，共 {total} 筆</span>
      <div className="d-flex align-items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline-secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          上一頁
        </Button>
        <span className="small text-nowrap">{page} / {pages}</span>
        <Button
          type="button"
          size="sm"
          variant="outline-secondary"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          下一頁
        </Button>
      </div>
    </nav>
  );
}
