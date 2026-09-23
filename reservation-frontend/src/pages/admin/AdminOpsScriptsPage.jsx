import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import { P } from '../../constants/permissions';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { fetchBackupOpsStatus, runBackupJob } from '../../services/opsScriptsApi';
import EwlSyncPanel from '../../components/learningJourneyV3/EwlSyncPanel';
import useToast from '../../components/ui/useToast';
import '../../styles/learning-journey-import.css';

function formatBytes(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return '—';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

function jobBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'running') return <Badge bg="primary">執行中</Badge>;
  if (s === 'success') return <Badge bg="success">成功</Badge>;
  if (s === 'failed') return <Badge bg="danger">失敗</Badge>;
  return <Badge bg="secondary">待命</Badge>;
}

/**
 * 管理員維運腳本控制台
 * /admin/ops-scripts
 * - 資料庫備份（正式 scripts/backup-db.bat）
 * - 英文寫作工坊（EWL）同步
 */
export default function AdminOpsScriptsPage() {
  const token = localStorage.getItem('token') || '';
  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const isAdmin = Boolean(accessProfile?.isAdmin);
  const canManageLj = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [job, setJob] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchBackupOpsStatus(token);
      setHealth(data?.health || null);
      setJob(data?.job || null);
    } catch (err) {
      setError(err.message || '無法載入備份狀態');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (job?.status !== 'running') return undefined;
    const timer = setInterval(async () => {
      try {
        const data = await fetchBackupOpsStatus(token);
        setHealth(data?.health || null);
        setJob(data?.job || null);
      } catch {
        // ignore poll errors
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [job?.status, token]);

  const handleRunBackup = async () => {
    const ok = window.confirm(
      '確定要立即執行資料庫備份？\n會執行正式備份腳本（mysqldump → .sql.gz，並可能複製 USB／rclone）。\n執行期間請勿重複點擊。'
    );
    if (!ok) return;
    setRunning(true);
    setError('');
    try {
      const data = await runBackupJob(token);
      setJob(data);
      toast.success('已開始執行備份作業');
    } catch (err) {
      setError(err.message || '啟動備份失敗');
      toast.error(err.message || '啟動備份失敗');
    } finally {
      setRunning(false);
    }
  };

  if (!isAdmin) {
    return (
      <main className="lj-import-page">
        <div className="alert alert-warning mb-0">此頁僅限系統管理員（admin）使用。</div>
      </main>
    );
  }

  return (
    <main className="lj-import-page">
      <header className="lj-import-page__header">
        <p className="lj-import-page__kicker">系統維運</p>
        <p className="lj-import-page__lede">
          由管理員直接控制資料庫備份腳本，以及英文寫作工坊（EWL）資料同步。高風險操作請先確認環境與時段。
        </p>
        <nav className="lj-import-page__nav" aria-label="相關頁面">
          <Link to="/admin/diagnostics">系統診斷</Link>
          <Link to="/admin/learning-journey/ewl-sync">EWL 同步（獨立頁）</Link>
          <Link to="/admin/learning-journey/operations">資料維運紀錄</Link>
          <Link to="/admin/logs">操作紀錄</Link>
        </nav>
      </header>

      <section className="lj-import-block mb-4" aria-labelledby="ops-backup-title">
        <div className="lj-import-block__head">
          <div className="lj-import-block__title-group">
            <span className="lj-import-block__kind">BACKUP</span>
            <h2 id="ops-backup-title" className="lj-import-block__title">資料庫備份</h2>
            <p className="lj-import-block__desc mb-0">
              系統每天 02:00（台北時間）會自動執行 <code>scripts/backup-db.bat</code>，把整個 MySQL 資料庫壓成 <code>eears_*.sql.gz</code>。
              本機存 <code>D:\EEARS_backup\local</code>；有 E: 時複製到 <code>E:\EEARS_backup</code>；有 rclone 時再同步到 <code>gdrive:EEARS_backup</code>。
              本機與 USB 超過 7 天的檔案會刪除。這裡的按鈕用來立刻再備份一次。
            </p>
          </div>
        </div>

        {error ? <Alert variant="danger" className="mt-3 mb-0">{error}</Alert> : null}

        {loading ? (
          <div className="d-flex align-items-center gap-2 mt-3 text-muted">
            <Spinner animation="border" size="sm" />
            <span>載入備份狀態…</span>
          </div>
        ) : (
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>健康檢查</strong>
                  {health?.ok ? (
                    <Badge bg="success">OK</Badge>
                  ) : (
                    <Badge bg="danger">{health?.code || 'FAIL'}</Badge>
                  )}
                </div>
                <dl className="row small mb-0">
                  <dt className="col-4 text-muted">目錄</dt>
                  <dd className="col-8">{health?.dir || '—'}</dd>
                  <dt className="col-4 text-muted">pattern</dt>
                  <dd className="col-8">{health?.pattern || '—'}</dd>
                  <dt className="col-4 text-muted">允許時效</dt>
                  <dd className="col-8">{health?.maxAgeHours != null ? `${health.maxAgeHours} 小時` : '—'}</dd>
                  <dt className="col-4 text-muted">最近檔案</dt>
                  <dd className="col-8">{health?.latestFile?.name || '（無）'}</dd>
                  <dt className="col-4 text-muted">修改時間</dt>
                  <dd className="col-8">
                    {health?.latestFile?.mtime
                      ? new Date(health.latestFile.mtime).toLocaleString('zh-TW', { hour12: false })
                      : '—'}
                  </dd>
                  <dt className="col-4 text-muted">大小</dt>
                  <dd className="col-8">{formatBytes(health?.latestFile?.sizeBytes)}</dd>
                  <dt className="col-4 text-muted">說明</dt>
                  <dd className="col-8 mb-0">{health?.message || '—'}</dd>
                </dl>
              </div>
            </div>
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>作業狀態</strong>
                  {jobBadge(job?.status)}
                </div>
                <dl className="row small mb-3">
                  <dt className="col-4 text-muted">腳本</dt>
                  <dd className="col-8 text-break">{job?.scriptPath || health?.scriptPath || '—'}</dd>
                  <dt className="col-4 text-muted">開始</dt>
                  <dd className="col-8">
                    {job?.startedAt
                      ? new Date(job.startedAt).toLocaleString('zh-TW', { hour12: false })
                      : '—'}
                  </dd>
                  <dt className="col-4 text-muted">結束</dt>
                  <dd className="col-8">
                    {job?.finishedAt
                      ? new Date(job.finishedAt).toLocaleString('zh-TW', { hour12: false })
                      : '—'}
                  </dd>
                  <dt className="col-4 text-muted">訊息</dt>
                  <dd className="col-8 mb-0">{job?.message || '—'}</dd>
                </dl>
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={handleRunBackup}
                    disabled={running || job?.status === 'running' || health?.scriptExists === false}
                  >
                    {(running || job?.status === 'running') && (
                      <Spinner animation="border" size="sm" className="me-2" />
                    )}
                    立即執行備份
                  </Button>
                  <Button variant="outline-secondary" onClick={load} disabled={loading || running}>
                    重新整理狀態
                  </Button>
                </div>
                {health?.scriptExists === false ? (
                  <Alert variant="warning" className="mt-3 mb-0 small">
                    伺服器找不到備份腳本，請確認 <code>OPS_BACKUP_SCRIPT</code> 或 repo 的{' '}
                    <code>scripts/backup-db.bat</code>。
                  </Alert>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="ops-ewl-title">
        <div className="lj-import-block lj-import-block--ewl mb-3">
          <div className="lj-import-block__head">
            <div className="lj-import-block__title-group">
              <span className="lj-import-block__kind">EWL</span>
              <h2 id="ops-ewl-title" className="lj-import-block__title">英文寫作工坊資料同步</h2>
              <p className="lj-import-block__desc mb-0">
                從 EWL 系統拉取預約／簽到並寫入學習歷程。建議先預覽再寫入；執行紀錄可至資料維運紀錄查看。
              </p>
            </div>
          </div>
        </div>
        {canManageLj ? (
          <EwlSyncPanel token={token} />
        ) : (
          <Alert variant="warning">目前帳號缺少學習歷程管理權限，無法執行 EWL 同步。</Alert>
        )}
      </section>
    </main>
  );
}
