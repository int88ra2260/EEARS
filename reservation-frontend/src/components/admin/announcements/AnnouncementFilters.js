import React from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';

export default function AnnouncementFilters({
  keyword,
  setKeyword,
  status,
  setStatus,
  pinned,
  setPinned,
  category,
  setCategory,
  authorId,
  setAuthorId,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onSearch,
  onReset,
}) {
  return (
    <Form
      className="mb-3 p-3 border rounded bg-light"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <Row className="g-2 align-items-end">
        <Col md={3}>
          <Form.Label className="small mb-1">關鍵字（標題／摘要／slug）</Form.Label>
          <Form.Control value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜尋…" />
        </Col>
        <Col md={2}>
          <Form.Label className="small mb-1">狀態</Form.Label>
          <Form.Select value={status} onChange={(e) => setStatus(e.target.value)} aria-describedby="announcement-status-filter-hint">
            <option value="all">全部</option>
            <option value="draft">草稿</option>
            <option value="scheduled">已排程</option>
            <option value="published">已發布</option>
            <option value="unpublished">已下架（暫時隱藏）</option>
            <option value="archived">已封存（長期歸檔）</option>
          </Form.Select>
          <Form.Text id="announcement-status-filter-hint" className="text-muted">
            下架＝暫時不顯示；封存＝不再當現行公告
          </Form.Text>
        </Col>
        <Col md={2}>
          <Form.Label className="small mb-1">分類</Form.Label>
          <Form.Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">全部分類</option>
            <option value="general">一般</option>
            <option value="activity">活動</option>
            <option value="policy">政策</option>
            <option value="system">系統</option>
            <option value="emergency">緊急</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Label className="small mb-1">作者 ID</Form.Label>
          <Form.Control
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            placeholder="Teacher.id"
          />
        </Col>
        <Col md={1}>
          <Form.Label className="small mb-1">置頂</Form.Label>
          <Form.Select value={pinned} onChange={(e) => setPinned(e.target.value)}>
            <option value="">全部</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Label className="small mb-1">更新起</Form.Label>
          <Form.Control type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </Col>
        <Col md={2}>
          <Form.Label className="small mb-1">更新迄</Form.Label>
          <Form.Control type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </Col>
        <Col md={2}>
          <Form.Label className="small mb-1">排序欄位</Form.Label>
          <Form.Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="createdAt">建立時間</option>
            <option value="updatedAt">更新時間</option>
            <option value="publishedAt">發布時間</option>
          </Form.Select>
        </Col>
        <Col md={1}>
          <Form.Label className="small mb-1">順序</Form.Label>
          <Form.Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="desc">新→舊</option>
            <option value="asc">舊→新</option>
          </Form.Select>
        </Col>
        <Col md={1} className="d-flex gap-1 flex-wrap">
          <Button type="submit" variant="primary" size="sm">
            套用
          </Button>
          <Button type="button" variant="outline-secondary" size="sm" onClick={onReset}>
            重設
          </Button>
        </Col>
      </Row>
    </Form>
  );
}
