import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import MediaPicker from '../media/MediaPicker';
import {
  deleteMediaLibraryAdmin,
  fetchMediaLibraryAdmin,
  updateMediaLibraryAdmin,
  uploadMediaLibraryAdmin,
} from '../../services/mediaLibraryAdminApi';
import useToast from '../ui/useToast';
import '../media/MediaPicker.css';
import './MediaLibraryPanel.css';

function dbIdFromAssetId(assetId) {
  if (assetId == null) return null;
  const s = String(assetId);
  if (s.startsWith('media:')) return s.slice(6);
  if (/^\d+$/.test(s)) return s;
  return null;
}

/**
 * 學生端內容中心 — 媒體庫管理
 */
export default function MediaLibraryPanel() {
  const { token } = useOutletContext();
  const toast = useToast();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [scopeFilter, setScopeFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState({ url: '', mediaId: null });
  const [includeInactive, setIncludeInactive] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMediaLibraryAdmin(token, {
        scope: scopeFilter === 'all' ? undefined : scopeFilter,
        q: q.trim() || undefined,
        includeInactive,
      });
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
    } catch (e) {
      toast.error(e?.message || '載入媒體庫失敗');
    } finally {
      setLoading(false);
    }
  }, [token, scopeFilter, q, includeInactive, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedAsset = useMemo(() => {
    if (!selected.mediaId && !selected.url) return null;
    return (
      assets.find((a) => a.id === selected.mediaId || a.url === selected.url) || null
    );
  }, [assets, selected]);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const asset = await uploadMediaLibraryAdmin(token, file, {
        scope: scopeFilter === 'all' ? 'general' : scopeFilter,
      });
      toast.success('已上傳到媒體庫');
      await refresh();
      setSelected({ url: asset.url, mediaId: asset.id });
      return asset;
    } catch (e) {
      toast.error(e?.message || '上傳失敗');
      throw e;
    } finally {
      setUploading(false);
    }
  };

  const handleRename = async () => {
    const dbId = dbIdFromAssetId(selectedAsset?.id);
    if (!dbId || !selectedAsset) return;
    // eslint-disable-next-line no-alert
    const next = window.prompt('顯示名稱', selectedAsset.label || '');
    if (next == null) return;
    try {
      await updateMediaLibraryAdmin(token, dbId, { label: next });
      toast.success('已更新名稱');
      await refresh();
    } catch (e) {
      toast.error(e?.message || '更新失敗');
    }
  };

  const handleToggleActive = async () => {
    const dbId = dbIdFromAssetId(selectedAsset?.id);
    if (!dbId || !selectedAsset) return;
    try {
      await updateMediaLibraryAdmin(token, dbId, { isActive: !selectedAsset.isActive });
      toast.success(selectedAsset.isActive ? '已停用' : '已啟用');
      await refresh();
    } catch (e) {
      toast.error(e?.message || '更新失敗');
    }
  };

  const deleteAsset = async (asset, { force = false } = {}) => {
    const dbId = dbIdFromAssetId(asset?.id);
    if (!dbId || !asset) return;
    if (asset.source === 'catalog') {
      toast.warning('系統內建圖不可刪除，可改為停用');
      return;
    }
    if (!force) {
      // eslint-disable-next-line no-alert
      const ok = window.confirm(
        `確定刪除「${asset.label || asset.originalName || asset.url}」？\n此操作會移除媒體庫紀錄與伺服器檔案，無法復原。`,
      );
      if (!ok) return;
    }
    setDeletingId(asset.id);
    try {
      await deleteMediaLibraryAdmin(token, dbId, { force });
      toast.success('已刪除');
      if (selected.mediaId === asset.id || selected.url === asset.url) {
        setSelected({ url: '', mediaId: null });
      }
      await refresh();
    } catch (e) {
      if (e.status === 409 && e.references?.length) {
        const names = e.references.map((r) => r.label).join('、');
        // eslint-disable-next-line no-alert
        const ok = window.confirm(
          `此媒體仍被引用：${names}\n\n仍要強制刪除嗎？（引用處可能出現破圖或附件失效）`,
        );
        if (ok) await deleteAsset(asset, { force: true });
        return;
      }
      toast.error(e?.message || '刪除失敗');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="media-library-panel">
      <div className="media-library-panel__intro small text-muted mb-3">
        支援圖片（JPG／PNG／WebP／GIF）與 PDF。顯示名稱會保留中文；磁碟檔名為系統產生的英文檔名。
        每張卡片下方可直接刪除（系統內建圖除外）。
      </div>

      <div className="media-library-panel__filters row g-2 align-items-end mb-3">
        <div className="col-md-3">
          <label className="d-block small text-muted mb-1">用途分類</label>
          <select
            className="form-select form-select-sm"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option value="all">全部</option>
            <option value="course-guide">修課說明</option>
            <option value="weekly">週報</option>
            <option value="announcement">公告</option>
            <option value="general">通用</option>
          </select>
        </div>
        <div className="col-md-5">
          <label className="d-block small text-muted mb-1">搜尋</label>
          <input
            className="form-control form-control-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名稱或路徑"
          />
        </div>
        <div className="col-md-2">
          <label className="d-flex align-items-center gap-2 small text-muted mb-0">
            <input
              type="checkbox"
              className="form-check-input"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            含停用
          </label>
        </div>
        <div className="col-md-2">
          <button type="button" className="btn btn-sm btn-outline-secondary w-100" onClick={refresh}>
            重新整理
          </button>
        </div>
      </div>

      {loading ? <div className="text-muted small mb-2">載入中…</div> : null}

      <MediaPicker
        value={selected}
        assets={assets}
        onChange={setSelected}
        onUploadFile={handleUpload}
        onDeleteAsset={(asset) => deleteAsset(asset)}
        uploading={uploading}
        deletingId={deletingId}
        emptyHint="媒體庫還是空的。請上傳圖片或 PDF。"
        allowClear
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        toolbarLabel="媒體庫"
      />

      {selectedAsset ? (
        <div className="media-library-panel__detail mt-3">
          <div className="media-library-panel__detail-title">已選媒體</div>
          <div className="small fw-semibold mb-1">{selectedAsset.label}</div>
          <div className="small text-muted mb-2">
            {selectedAsset.source === 'catalog' ? '系統內建' : '已上傳'}
            {selectedAsset.scope ? ` · ${selectedAsset.scope}` : ''}
            {selectedAsset.mime ? ` · ${selectedAsset.mime}` : ''}
            {selectedAsset.isActive ? '' : ' · 已停用'}
          </div>
          <div className="small text-muted mb-2 text-break">{selectedAsset.url}</div>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-outline-dark" onClick={handleRename}>
              重新命名
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleToggleActive}>
              {selectedAsset.isActive ? '停用' : '啟用'}
            </button>
            {selectedAsset.source !== 'catalog' ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                disabled={deletingId === selectedAsset.id}
                onClick={() => deleteAsset(selectedAsset)}
              >
                刪除檔案
              </button>
            ) : null}
            {selectedAsset.url ? (
              <a
                className="btn btn-sm btn-outline-primary"
                href={selectedAsset.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                開啟／下載
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="small text-muted mt-3 mb-0">點選上方媒體可檢視詳情；卡片上的「刪除」可直接移除檔案。</p>
      )}
    </div>
  );
}
