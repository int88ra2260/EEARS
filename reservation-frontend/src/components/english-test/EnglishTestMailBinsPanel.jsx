import React, { useEffect, useState } from 'react';
import {
  addEnglishTestMailBinMembers,
  createEnglishTestMailBin,
  deleteEnglishTestMailBin,
  fetchEnglishTestMailBins,
  removeEnglishTestMailBinMembers,
} from '../../services/englishTestApi';

export default function EnglishTestMailBinsPanel({ token, selectedIds, onUseBin }) {
  const [bins, setBins] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newName, setNewName] = useState('');

  const load = async () => {
    const data = await fetchEnglishTestMailBins(token);
    setBins(data);
    setActiveId((current) => (
      data.some((bin) => bin.id === current) ? current : (data[0]?.id ?? null)
    ));
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchEnglishTestMailBins(token)
      .then((data) => {
        if (cancelled) return;
        setBins(data);
        setActiveId((current) => (
          data.some((bin) => bin.id === current) ? current : (data[0]?.id ?? null)
        ));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '載入寄件區失敗');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const active = bins.find((bin) => bin.id === activeId) || null;

  const handleAddSelected = async () => {
    if (!active || selectedIds.length === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await addEnglishTestMailBinMembers(token, active.id, selectedIds);
      await load();
      setNotice(`已加入 ${result.added} 人${result.skipped ? `，${result.skipped} 人原本就在此區` : ''}`);
    } catch (err) {
      setError(err.message || '加入寄件區失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (registrationId) => {
    if (!active) return;
    setBusy(true);
    setError('');
    try {
      await removeEnglishTestMailBinMembers(token, active.id, [registrationId]);
      await load();
    } catch (err) {
      setError(err.message || '移出寄件區失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      const created = await createEnglishTestMailBin(token, name);
      setNewName('');
      await load();
      setActiveId(created.id);
    } catch (err) {
      setError(err.message || '建立寄件區失敗');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!active) return;
    if (!window.confirm(`刪除「${active.name}」？裡面的名單會一併清掉。`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteEnglishTestMailBin(token, active.id);
      await load();
    } catch (err) {
      setError(err.message || '刪除寄件區失敗');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="small text-muted">載入寄件區中…</p>;

  return (
    <>
      <p className="small text-muted">
        先把勾選的人放進寄件區，之後再對該區寄信。名單會留在系統裡，重新整理後還在。第一次使用會有寄件區1、寄件區2、寄件區3。
      </p>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {notice && <div className="alert alert-success py-2">{notice}</div>}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {bins.map((bin) => (
          <button
            key={bin.id}
            type="button"
            className={`btn btn-sm ${bin.id === activeId ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveId(bin.id)}
          >
            {bin.name}（{bin.members.length}）
          </button>
        ))}
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          className="form-control form-control-sm"
          style={{ maxWidth: 220 }}
          placeholder="新寄件區名稱"
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || !newName.trim()} onClick={handleCreate}>
          新增寄件區
        </button>
      </div>
      {active && (
        <>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy || selectedIds.length === 0}
              onClick={handleAddSelected}
            >
              把目前勾選的 {selectedIds.length} 人加入{active.name}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              disabled={busy || active.members.length === 0}
              onClick={() => onUseBin({
                id: active.id,
                name: active.name,
                ids: active.members.filter((member) => !member.missing).map((member) => member.registrationId),
              })}
            >
              用{active.name}寄信
            </button>
            <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={handleDelete}>
              刪除此區
            </button>
          </div>
          {active.members.length === 0 ? (
            <p className="text-muted small mb-0">此區還沒有人。</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>學號</th>
                    <th>姓名</th>
                    <th>信箱</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {active.members.map((member) => (
                    <tr key={member.registrationId}>
                      <td>{member.missing ? '—' : member.studentId}</td>
                      <td>{member.missing ? '找不到這筆報名' : member.studentName}</td>
                      <td>{member.email || ''}</td>
                      <td className="text-end">
                        <button type="button" className="btn btn-link btn-sm" disabled={busy} onClick={() => handleRemove(member.registrationId)}>
                          移出
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
