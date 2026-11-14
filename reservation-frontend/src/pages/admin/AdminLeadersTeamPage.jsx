import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Modal, Nav, Spinner, Tab } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import MediaPicker from '../../components/media/MediaPicker';
import { P } from '../../constants/permissions';
import { SITE_CONTENT_KEY_SUGGESTIONS } from '../../constants/siteContentManifest';
import {
  archiveLeader,
  assignLeaderToSemester,
  copyLeadersFromSemester,
  createLeaderPublicProfile,
  createLeadersCarouselSlide,
  deleteLeaderPublicProfile,
  deleteLeadersCarouselSlide,
  fetchArchivedLeaders,
  fetchAvailableSemesters,
  fetchLeaderProfileImages,
  fetchLeadersBySemester,
  fetchLeadersCarousel,
  removeLeaderFromSemester,
  reorderLeadersCarousel,
  reorderLeadersInSemester,
  unarchiveLeader,
  updateLeaderPublicProfile,
  updateLeadersCarouselSlide,
  updateSemesterAssignment,
  uploadLeaderProfileImage,
} from '../../services/leadersTeamAdminApi';
import {
  fetchSiteContentSection,
  upsertSiteContentText,
} from '../../services/siteContentAdminApi';

const EMPTY_LEADER_FORM = {
  slug: '',
  displayName: '',
  photoUrl: '',
  degree: '',
  experience: '',
  languages: '',
  focus: '',
  videoId: '',
  isPublished: true,
};

const EMPTY_SLIDE_FORM = {
  imageUrl: '',
  altZh: '',
  altEn: '',
  label: '',
  isActive: true,
};

function toLeaderForm(leader) {
  if (!leader) return { ...EMPTY_LEADER_FORM };
  return {
    slug: leader.slug || '',
    displayName: leader.displayName || '',
    photoUrl: leader.photoUrl || '',
    degree: leader.degree || '',
    experience: leader.experience || '',
    languages: leader.languages || '',
    focus: leader.focus || '',
    videoId: leader.videoId || '',
    isPublished: leader.semesterAssignment?.isPublished !== false,
  };
}

function toSlideForm(slide) {
  if (!slide) return { ...EMPTY_SLIDE_FORM };
  return {
    imageUrl: slide.imageUrl || '',
    altZh: slide.alt?.zh || '',
    altEn: slide.alt?.en || '',
    label: slide.label || '',
    isActive: slide.isActive !== false,
  };
}

function canEditLeaders(profile) {
  const set = profile?.permissionSet;
  if (!set || typeof set.has !== 'function') return false;
  return set.has(P.CAN_MANAGE_ET_GROUPING) || set.has(P.CAN_MANAGE_SITE_CONTENT);
}

// ============ Leader 名單分頁 ============

function LeaderListPanel({ token, assets, onUploadFile, uploading }) {
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [leaders, setLeaders] = useState([]);
  const [archivedLeaders, setArchivedLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_LEADER_FORM);
  const [showArchived, setShowArchived] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySource, setCopySource] = useState('');

  const selected = useMemo(
    () => leaders.find((leader) => leader.id === selectedId) || null,
    [leaders, selectedId],
  );

  const loadSemesters = useCallback(async () => {
    try {
      const data = await fetchAvailableSemesters(token);
      const sems = Array.isArray(data?.semesters) ? data.semesters : [];
      setSemesters(sems);
      const current = sems.find((s) => s.isCurrent);
      if (current && !selectedSemester) {
        setSelectedSemester(current.id);
      } else if (sems.length && !selectedSemester) {
        setSelectedSemester(sems[0].id);
      }
    } catch (err) {
      setError(err.message || '載入學期失敗');
    }
  }, [token, selectedSemester]);

  const loadLeaders = useCallback(async () => {
    if (!selectedSemester) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeadersBySemester(token, selectedSemester);
      const rows = Array.isArray(data?.leaders) ? data.leaders : [];
      setLeaders(rows);
      setSelectedId((current) => {
        if (current === 'new') return current;
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, selectedSemester]);

  const loadArchived = useCallback(async () => {
    try {
      const data = await fetchArchivedLeaders(token);
      setArchivedLeaders(Array.isArray(data?.leaders) ? data.leaders : []);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (selectedSemester) {
      loadLeaders();
    }
  }, [selectedSemester, loadLeaders]);

  useEffect(() => {
    loadArchived();
  }, [loadArchived]);

  useEffect(() => {
    if (selectedId === 'new') return;
    setForm(toLeaderForm(selected));
  }, [selected, selectedId]);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startCreate = () => {
    setSelectedId('new');
    setForm({ ...EMPTY_LEADER_FORM });
    setNotice('');
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const body = {
      displayName: form.displayName,
      photoUrl: form.photoUrl,
      degree: form.degree,
      experience: form.experience,
      languages: form.languages,
      focus: form.focus,
      videoId: form.videoId,
    };
    try {
      if (selectedId === 'new') {
        const created = await createLeaderPublicProfile(token, {
          ...body,
          slug: form.slug,
          isPublished: form.isPublished,
          semesterId: selectedSemester,
        });
        setNotice('已新增');
        await loadLeaders();
        setSelectedId(created.id);
      } else {
        await updateLeaderPublicProfile(token, selectedId, body);
        // 更新發布狀態
        if (selected?.semesterAssignment?.id) {
          await updateSemesterAssignment(token, selected.semesterAssignment.id, {
            isPublished: form.isPublished,
          });
        }
        setNotice('已儲存');
        await loadLeaders();
      }
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!selected || !window.confirm(`封存「${selected.displayName}」？封存後會從所有學期列表中移除。`)) return;
    setSaving(true);
    setError('');
    try {
      await archiveLeader(token, selected.id);
      setNotice('已封存');
      setSelectedId(null);
      await Promise.all([loadLeaders(), loadArchived()]);
    } catch (err) {
      setError(err.message || '封存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleUnarchive = async (id) => {
    setSaving(true);
    setError('');
    try {
      await unarchiveLeader(token, id);
      setNotice('已還原');
      await Promise.all([loadLeaders(), loadArchived()]);
    } catch (err) {
      setError(err.message || '還原失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromSemester = async () => {
    if (!selected || !window.confirm(`從 ${selectedSemester} 學期移除「${selected.displayName}」？（不會刪除 Leader 資料）`)) return;
    setSaving(true);
    setError('');
    try {
      await removeLeaderFromSemester(token, selectedSemester, selected.id);
      setNotice('已從本學期移除');
      setSelectedId(null);
      await loadLeaders();
    } catch (err) {
      setError(err.message || '移除失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !window.confirm(`永久刪除「${selected.displayName}」？這會刪除所有學期的資料，無法復原。`)) return;
    setSaving(true);
    setError('');
    try {
      await deleteLeaderPublicProfile(token, selected.id);
      setNotice('已永久刪除');
      setSelectedId(null);
      await Promise.all([loadLeaders(), loadArchived()]);
    } catch (err) {
      setError(err.message || '刪除失敗');
    } finally {
      setSaving(false);
    }
  };

  const move = async (delta) => {
    const index = leaders.findIndex((leader) => leader.id === selectedId);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= leaders.length) return;
    const ids = leaders.map((leader) => leader.semesterAssignment?.id).filter(Boolean);
    if (ids.length !== leaders.length) return;
    const [moved] = ids.splice(index, 1);
    ids.splice(next, 0, moved);
    setSaving(true);
    setError('');
    try {
      const data = await reorderLeadersInSemester(token, selectedSemester, ids);
      setLeaders(Array.isArray(data?.leaders) ? data.leaders : []);
    } catch (err) {
      setError(err.message || '排序失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromSemester = async () => {
    if (!copySource) return;
    setSaving(true);
    setError('');
    try {
      const result = await copyLeadersFromSemester(token, selectedSemester, copySource);
      setNotice(`已複製 ${result.copied} 位，略過 ${result.skipped} 位`);
      setShowCopyModal(false);
      await loadLeaders();
    } catch (err) {
      setError(err.message || '複製失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignArchived = async (leaderId) => {
    setSaving(true);
    setError('');
    try {
      await assignLeaderToSemester(token, selectedSemester, leaderId, { isPublished: true });
      setNotice('已加入本學期');
      await Promise.all([loadLeaders(), loadArchived()]);
    } catch (err) {
      setError(err.message || '加入失敗');
    } finally {
      setSaving(false);
    }
  };

  const currentSemester = semesters.find((s) => s.isCurrent);

  return (
    <div>
      {/* 學期選擇器 */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <Form.Label className="mb-0 small fw-bold">學期：</Form.Label>
        <Form.Select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          style={{ width: 'auto', minWidth: '120px' }}
          size="sm"
        >
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}{s.isCurrent ? ' (當前)' : ''}
            </option>
          ))}
        </Form.Select>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => {
            setCopySource(semesters.find((s) => s.id !== selectedSemester)?.id || '');
            setShowCopyModal(true);
          }}
        >
          從其他學期複製
        </Button>
        <Button
          size="sm"
          variant={showArchived ? 'secondary' : 'outline-secondary'}
          onClick={() => setShowArchived(!showArchived)}
        >
          封存區 {archivedLeaders.length > 0 ? `(${archivedLeaders.length})` : ''}
        </Button>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      {/* 封存區 */}
      {showArchived && archivedLeaders.length > 0 ? (
        <div className="mb-4 p-3 bg-light rounded">
          <h6 className="mb-2">封存的 Leaders</h6>
          <div className="d-flex flex-wrap gap-2">
            {archivedLeaders.map((leader) => (
              <div key={leader.id} className="d-flex align-items-center gap-2 bg-white rounded px-2 py-1 border">
                <span className="small">{leader.displayName}</span>
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => handleUnarchive(leader.id)}
                  disabled={saving}
                >
                  還原
                </Button>
                <Button
                  size="sm"
                  variant="outline-success"
                  onClick={() => handleAssignArchived(leader.id)}
                  disabled={saving}
                  title="還原並加入當前學期"
                >
                  +本學期
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>{selectedSemester} 學期名單</strong>
            <Button size="sm" variant="dark" onClick={startCreate}>新增</Button>
          </div>
          {loading ? <Spinner size="sm" animation="border" /> : null}
          {!loading && leaders.length === 0 ? (
            <p className="text-muted small">本學期尚無 Leaders。可新增或從其他學期複製。</p>
          ) : null}
          <div className="list-group">
            {leaders.map((leader, index) => (
              <button
                key={leader.id}
                type="button"
                className={`list-group-item list-group-item-action d-flex justify-content-between gap-2${leader.id === selectedId ? ' active' : ''}`}
                onClick={() => {
                  setSelectedId(leader.id);
                  setNotice('');
                }}
              >
                <span>{leader.displayName}</span>
                <span className="small">
                  {leader.semesterAssignment?.isPublished ? index + 1 : <Badge bg="secondary">隱藏</Badge>}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="col-lg-8">
          {selectedId == null ? (
            <p className="text-muted">選擇一位，或新增介紹。</p>
          ) : (
            <Form onSubmit={save}>
              {selectedId === 'new' ? (
                <Form.Group className="mb-3">
                  <Form.Label>代號</Form.Label>
                  <Form.Control
                    value={form.slug}
                    onChange={(e) => setField('slug', e.target.value)}
                    placeholder="例如 audrey"
                    required
                  />
                  <Form.Text className="text-muted">建立後用來對應這張卡片，請用英文小寫。</Form.Text>
                </Form.Group>
              ) : (
                <p className="small text-muted">代號：{form.slug}</p>
              )}

              <Form.Group className="mb-3">
                <Form.Label>顯示名稱</Form.Label>
                <Form.Control
                  value={form.displayName}
                  onChange={(e) => setField('displayName', e.target.value)}
                  placeholder="謝宗叡 Udon"
                  required
                />
              </Form.Group>

              <Form.Check
                className="mb-3"
                type="checkbox"
                id="leader-public-published"
                label={`在 ${selectedSemester} 學期顯示於前台`}
                checked={form.isPublished}
                onChange={(e) => setField('isPublished', e.target.checked)}
              />

              <div className="mb-3">
                <MediaPicker
                  value={{ url: form.photoUrl, mediaId: null }}
                  assets={assets}
                  onChange={(next) => setField('photoUrl', next?.url || '')}
                  onUploadFile={onUploadFile}
                  uploading={uploading}
                  toolbarLabel="大頭照"
                  emptyHint="媒體庫尚無圖片。可直接上傳。"
                />
              </div>

              <Form.Group className="mb-3">
                <Form.Label>學歷</Form.Label>
                <Form.Control value={form.degree} onChange={(e) => setField('degree', e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>經歷</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={form.experience}
                  onChange={(e) => setField('experience', e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>帶領語言</Form.Label>
                <Form.Control value={form.languages} onChange={(e) => setField('languages', e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>帶領主題</Form.Label>
                <Form.Control value={form.focus} onChange={(e) => setField('focus', e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>YouTube 影片編號</Form.Label>
                <Form.Control
                  value={form.videoId}
                  onChange={(e) => setField('videoId', e.target.value)}
                  placeholder="只填編號，例如 dQw4w9WgXcQ"
                />
              </Form.Group>

              <div className="d-flex flex-wrap gap-2">
                <Button type="submit" variant="dark" disabled={saving}>
                  {saving ? '儲存中…' : '儲存'}
                </Button>
                {selected ? (
                  <>
                    <Button type="button" variant="outline-secondary" disabled={saving} onClick={() => move(-1)}>
                      上移
                    </Button>
                    <Button type="button" variant="outline-secondary" disabled={saving} onClick={() => move(1)}>
                      下移
                    </Button>
                    <Button type="button" variant="outline-warning" disabled={saving} onClick={handleRemoveFromSemester}>
                      從本學期移除
                    </Button>
                    <Button type="button" variant="outline-secondary" disabled={saving} onClick={handleArchive}>
                      封存
                    </Button>
                    <Button type="button" variant="outline-danger" disabled={saving} onClick={handleDelete}>
                      永久刪除
                    </Button>
                  </>
                ) : null}
              </div>
            </Form>
          )}
        </div>
      </div>

      {/* 複製學期 Modal */}
      <Modal show={showCopyModal} onHide={() => setShowCopyModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>從其他學期複製</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>將其他學期的 Leaders 複製到 <strong>{selectedSemester}</strong>。已存在的會略過。</p>
          <Form.Group>
            <Form.Label>來源學期</Form.Label>
            <Form.Select value={copySource} onChange={(e) => setCopySource(e.target.value)}>
              <option value="">選擇學期</option>
              {semesters.filter((s) => s.id !== selectedSemester).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCopyModal(false)}>取消</Button>
          <Button variant="primary" onClick={handleCopyFromSemester} disabled={!copySource || saving}>
            {saving ? '複製中…' : '複製'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ============ 輪播圖片分頁 ============

function CarouselPanel({ token, assets, onUploadFile, uploading }) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_SLIDE_FORM);

  const selected = useMemo(
    () => slides.find((slide) => slide.id === selectedId) || null,
    [slides, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeadersCarousel(token);
      const rows = Array.isArray(data?.slides) ? data.slides : [];
      setSlides(rows);
      setSelectedId((current) => {
        if (current === 'new') return current;
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedId === 'new') return;
    setForm(toSlideForm(selected));
  }, [selected, selectedId]);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startCreate = () => {
    setSelectedId('new');
    setForm({ ...EMPTY_SLIDE_FORM });
    setNotice('');
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const body = {
      imageUrl: form.imageUrl,
      altZh: form.altZh,
      altEn: form.altEn,
      label: form.label || form.altZh || '輪播圖片',
      isActive: form.isActive,
    };
    try {
      if (selectedId === 'new') {
        const created = await createLeadersCarouselSlide(token, body);
        setNotice('已新增');
        await load();
        setSelectedId(created.id);
      } else {
        await updateLeadersCarouselSlide(token, selectedId, body);
        setNotice('已儲存');
        await load();
      }
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm(`刪除「${selected.label}」？`)) return;
    setSaving(true);
    setError('');
    try {
      await deleteLeadersCarouselSlide(token, selected.id);
      setNotice('已刪除');
      setSelectedId(null);
      await load();
    } catch (err) {
      setError(err.message || '刪除失敗');
    } finally {
      setSaving(false);
    }
  };

  const move = async (delta) => {
    const index = slides.findIndex((slide) => slide.id === selectedId);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= slides.length) return;
    const ids = slides.map((slide) => slide.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(next, 0, moved);
    setSaving(true);
    setError('');
    try {
      const data = await reorderLeadersCarousel(token, ids);
      setSlides(Array.isArray(data?.slides) ? data.slides : []);
    } catch (err) {
      setError(err.message || '排序失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-muted small mb-3">
        設定前台 LEADERS 頁面頂部的輪播圖片。建議使用寬橫幅圖片（約 16:9）。
      </p>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>圖片列表</strong>
            <Button size="sm" variant="dark" onClick={startCreate}>新增</Button>
          </div>
          {loading ? <Spinner size="sm" animation="border" /> : null}
          <div className="list-group">
            {slides.length === 0 && !loading ? (
              <p className="text-muted small">尚無輪播圖片，點新增開始。</p>
            ) : null}
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`list-group-item list-group-item-action d-flex justify-content-between gap-2${slide.id === selectedId ? ' active' : ''}`}
                onClick={() => {
                  setSelectedId(slide.id);
                  setNotice('');
                }}
              >
                <span className="text-truncate" style={{ maxWidth: '180px' }}>
                  {slide.label || slide.alt?.zh || `圖片 ${index + 1}`}
                </span>
                <span className="small">{slide.isActive ? index + 1 : '隱藏'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="col-lg-8">
          {selectedId == null ? (
            <p className="text-muted">選擇一張圖片，或新增輪播圖片。</p>
          ) : (
            <Form onSubmit={save}>
              <div className="mb-3">
                <MediaPicker
                  value={{ url: form.imageUrl, mediaId: null }}
                  assets={assets}
                  onChange={(next) => setField('imageUrl', next?.url || '')}
                  onUploadFile={onUploadFile}
                  uploading={uploading}
                  toolbarLabel="輪播圖片"
                  emptyHint="媒體庫尚無圖片。可直接上傳。"
                />
              </div>

              <Form.Group className="mb-3">
                <Form.Label>管理標籤（方便辨識）</Form.Label>
                <Form.Control
                  value={form.label}
                  onChange={(e) => setField('label', e.target.value)}
                  placeholder="例如「合影照」"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>替代文字（中文）</Form.Label>
                <Form.Control
                  value={form.altZh}
                  onChange={(e) => setField('altZh', e.target.value)}
                  placeholder="簡述圖片內容，供視障者使用"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>替代文字（英文）</Form.Label>
                <Form.Control
                  value={form.altEn}
                  onChange={(e) => setField('altEn', e.target.value)}
                  placeholder="Alt text in English"
                />
              </Form.Group>

              <Form.Check
                className="mb-3"
                type="checkbox"
                id="carousel-slide-active"
                label="顯示在前台"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
              />

              <div className="d-flex flex-wrap gap-2">
                <Button type="submit" variant="dark" disabled={saving}>
                  {saving ? '儲存中…' : '儲存'}
                </Button>
                {selected ? (
                  <>
                    <Button type="button" variant="outline-secondary" disabled={saving} onClick={() => move(-1)}>
                      上移
                    </Button>
                    <Button type="button" variant="outline-secondary" disabled={saving} onClick={() => move(1)}>
                      下移
                    </Button>
                    <Button type="button" variant="outline-danger" disabled={saving} onClick={remove}>
                      刪除
                    </Button>
                  </>
                ) : null}
              </div>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ 頁面文案分頁 ============

function PageTextPanel({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editedValues, setEditedValues] = useState({});

  const suggestions = SITE_CONTENT_KEY_SUGGESTIONS.leaders_team || [];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSiteContentSection(token, 'leaders_team');
      const loaded = Array.isArray(data?.items) ? data.items : [];
      setItems(loaded);
      // 初始化編輯值
      const initial = {};
      loaded.forEach((item) => {
        initial[item.contentKey] = { zh: item.valueZh || '', en: item.valueEn || '' };
      });
      // 加上未填的建議鍵
      suggestions.forEach((s) => {
        if (!initial[s.key]) {
          initial[s.key] = { zh: '', en: '' };
        }
      });
      setEditedValues(initial);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, suggestions]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (key, lang, value) => {
    setEditedValues((prev) => ({
      ...prev,
      [key]: { ...prev[key], [lang]: value },
    }));
  };

  const handleSave = async (key) => {
    const values = editedValues[key];
    if (!values) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const suggestion = suggestions.find((s) => s.key === key);
      await upsertSiteContentText(token, 'leaders_team', {
        contentKey: key,
        label: suggestion?.label || key,
        valueZh: values.zh,
        valueEn: values.en,
      });
      setNotice(`已儲存「${suggestion?.label || key}」`);
      await load();
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner animation="border" size="sm" />;
  }

  return (
    <div>
      <p className="text-muted small mb-3">
        編輯前台 LEADERS 頁面的標題、導言與介紹文字。留空會使用系統預設值。
      </p>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <div className="d-flex flex-column gap-4">
        {suggestions.map((s) => {
          const values = editedValues[s.key] || { zh: '', en: '' };
          const isLong = s.key === 'leadersTeam.intro';
          return (
            <div key={s.key} className="border rounded p-3">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <strong>{s.label}</strong>
                  <code className="ms-2 small text-muted">{s.key}</code>
                </div>
                <Button
                  size="sm"
                  variant="outline-dark"
                  disabled={saving}
                  onClick={() => handleSave(s.key)}
                >
                  儲存
                </Button>
              </div>
              <div className="row g-2">
                <div className="col-md-6">
                  <Form.Label className="small text-muted mb-1">中文</Form.Label>
                  {isLong ? (
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={values.zh}
                      onChange={(e) => handleChange(s.key, 'zh', e.target.value)}
                      placeholder="中文內容"
                    />
                  ) : (
                    <Form.Control
                      value={values.zh}
                      onChange={(e) => handleChange(s.key, 'zh', e.target.value)}
                      placeholder="中文內容"
                    />
                  )}
                </div>
                <div className="col-md-6">
                  <Form.Label className="small text-muted mb-1">English</Form.Label>
                  {isLong ? (
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={values.en}
                      onChange={(e) => handleChange(s.key, 'en', e.target.value)}
                      placeholder="English content"
                    />
                  ) : (
                    <Form.Control
                      value={values.en}
                      onChange={(e) => handleChange(s.key, 'en', e.target.value)}
                      placeholder="English content"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ 主元件 ============

export default function AdminLeadersTeamPage({ embedded = false }) {
  const { token, accessProfile } = useOutletContext() || {};
  const canEdit = canEditLeaders(accessProfile);

  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('leaders');

  useEffect(() => {
    if (!token || !canEdit) return undefined;
    let cancelled = false;
    fetchLeaderProfileImages(token)
      .then((data) => {
        if (!cancelled) setAssets(Array.isArray(data?.assets) ? data.assets : []);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, canEdit]);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const asset = await uploadLeaderProfileImage(token, file);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      return asset;
    } catch (err) {
      throw err;
    } finally {
      setUploading(false);
    }
  };

  if (!canEdit) {
    return <Alert variant="warning">您沒有編輯 LEADERS 介紹頁的權限。</Alert>;
  }

  return (
    <div className="admin-leaders-team">
      {embedded ? null : (
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <div>
            <h1 className="h4 mb-1">LEADERS 介紹頁管理</h1>
            <p className="text-muted small mb-0">
              管理 LEADERS 頁面的學期名單、輪播圖片與文案。學號、信箱、帳號和時薪不會出現在這頁。
            </p>
          </div>
          <Button
            variant="outline-primary"
            href="/activities/english-table/leaders"
            target="_blank"
            rel="noopener noreferrer"
          >
            開前台頁
          </Button>
        </div>
      )}

      {embedded ? (
        <p className="text-muted small mb-3">
          管理 LEADERS 頁面的學期名單、輪播圖片與文案。學號、信箱、帳號和時薪留在 Leader 帳號與支薪資料。
        </p>
      ) : null}

      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Nav variant="tabs" className="mb-3">
          <Nav.Item>
            <Nav.Link eventKey="leaders">學期名單</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="carousel">輪播圖片</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="text">頁面文案</Nav.Link>
          </Nav.Item>
        </Nav>
        <Tab.Content>
          <Tab.Pane eventKey="leaders">
            <LeaderListPanel
              token={token}
              assets={assets}
              onUploadFile={handleUpload}
              uploading={uploading}
            />
          </Tab.Pane>
          <Tab.Pane eventKey="carousel">
            <CarouselPanel
              token={token}
              assets={assets}
              onUploadFile={handleUpload}
              uploading={uploading}
            />
          </Tab.Pane>
          <Tab.Pane eventKey="text">
            <PageTextPanel token={token} />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </div>
  );
}
