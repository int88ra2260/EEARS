import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import MediaPicker from '../../components/media/MediaPicker';
import { P } from '../../constants/permissions';
import {
  createLeaderPublicProfile,
  deleteLeaderPublicProfile,
  fetchLeaderProfileImages,
  fetchLeaderPublicProfiles,
  reorderLeaderPublicProfiles,
  updateLeaderPublicProfile,
  uploadLeaderProfileImage,
} from '../../services/leadersTeamAdminApi';

const EMPTY_FORM = {
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

function toForm(leader) {
  if (!leader) return { ...EMPTY_FORM };
  return {
    slug: leader.slug || '',
    displayName: leader.displayName || '',
    photoUrl: leader.photoUrl || '',
    degree: leader.degree || '',
    experience: leader.experience || '',
    languages: leader.languages || '',
    focus: leader.focus || '',
    videoId: leader.videoId || '',
    isPublished: leader.isPublished !== false,
  };
}

function canEditLeaders(profile) {
  const set = profile?.permissionSet;
  if (!set || typeof set.has !== 'function') return false;
  return set.has(P.CAN_MANAGE_ET_GROUPING) || set.has(P.CAN_MANAGE_SITE_CONTENT);
}

export default function AdminLeadersTeamPage({ embedded = false }) {
  const { token, accessProfile } = useOutletContext() || {};
  const canEdit = canEditLeaders(accessProfile);

  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);

  const selected = useMemo(
    () => leaders.find((leader) => leader.id === selectedId) || null,
    [leaders, selectedId],
  );

  const load = useCallback(async () => {
    if (!token || !canEdit) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeaderPublicProfiles(token);
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
  }, [token, canEdit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedId === 'new') return;
    setForm(toForm(selected));
  }, [selected, selectedId]);

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

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startCreate = () => {
    setSelectedId('new');
    setForm({ ...EMPTY_FORM });
    setNotice('');
    setError('');
  };

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const asset = await uploadLeaderProfileImage(token, file);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      return asset;
    } catch (err) {
      setError(err.message || '上傳失敗');
      throw err;
    } finally {
      setUploading(false);
    }
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
      isPublished: form.isPublished,
    };
    try {
      if (selectedId === 'new') {
        const created = await createLeaderPublicProfile(token, { ...body, slug: form.slug });
        setNotice('已新增');
        await load();
        setSelectedId(created.id);
      } else {
        await updateLeaderPublicProfile(token, selectedId, body);
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
    if (!selected || !window.confirm(`從介紹頁移除「${selected.displayName}」？這不會刪除 Leader 帳號。`)) return;
    setSaving(true);
    setError('');
    try {
      await deleteLeaderPublicProfile(token, selected.id);
      setNotice('已從介紹頁移除');
      setSelectedId(null);
      await load();
    } catch (err) {
      setError(err.message || '移除失敗');
    } finally {
      setSaving(false);
    }
  };

  const move = async (delta) => {
    const index = leaders.findIndex((leader) => leader.id === selectedId);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= leaders.length) return;
    const ids = leaders.map((leader) => leader.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(next, 0, moved);
    setSaving(true);
    setError('');
    try {
      const data = await reorderLeaderPublicProfiles(token, ids);
      setLeaders(Array.isArray(data?.leaders) ? data.leaders : []);
    } catch (err) {
      setError(err.message || '排序失敗');
    } finally {
      setSaving(false);
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
            <h1 className="h4 mb-1">LEADERS 介紹</h1>
            <p className="text-muted small mb-0">
              這裡只改公開介紹頁。學號、信箱、帳號和時薪不會出現在這頁。
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
        <p className="text-muted small">
          只改公開卡片。學號、信箱、帳號和時薪留在 Leader 帳號與支薪資料。
        </p>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>名單</strong>
            <Button size="sm" variant="dark" onClick={startCreate}>新增</Button>
          </div>
          {loading ? <Spinner size="sm" animation="border" /> : null}
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
                <span className="small">{leader.isPublished ? index + 1 : '隱藏'}</span>
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
                label="顯示在介紹頁"
                checked={form.isPublished}
                onChange={(e) => setField('isPublished', e.target.checked)}
              />

              <div className="mb-3">
                <MediaPicker
                  value={{ url: form.photoUrl, mediaId: null }}
                  assets={assets}
                  onChange={(next) => setField('photoUrl', next?.url || '')}
                  onUploadFile={handleUpload}
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
                    <Button type="button" variant="outline-danger" disabled={saving} onClick={remove}>
                      從介紹頁移除
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
