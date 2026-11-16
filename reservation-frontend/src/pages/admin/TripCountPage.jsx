import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import useConfirm from '../../components/ui/useConfirm';
import { TRIP_COUNT_CATEGORIES, tripCountCategoryLabel } from '../../constants/tripCountCategories';
import {
  addTripCountExpense,
  addTripCountMember,
  createTripCount,
  deleteTripCount,
  getTripCount,
  listTripCounts,
  removeTripCountExpense,
  removeTripCountMember,
  renameTripCountMember,
  updateTripCount,
  updateTripCountExpense,
} from '../../services/tripCountApi';
import { centsToInput, formatTwd, parseTwdToCents } from '../../utils/tripCountMoney';
import { allocateEqualShares, allocateWeightedShares } from '../../utils/tripCountShares';
import { formatTripSettlementCopy } from '../../utils/tripCountSettlementText';
import './TripCountPage.css';

const EMPTY_EXPENSE = {
  title: '',
  amount: '',
  payerMemberId: '',
  splitMode: 'equal',
  memberIds: [],
  customAmounts: {},
  weights: {},
  category: '',
  spentOn: '',
};

function balanceLabel(cents) {
  if (cents > 0) return `可收回 ${formatTwd(cents)}`;
  if (cents < 0) return `還要付 ${formatTwd(-cents)}`;
  return '已平衡';
}

function Money({ cents, className = '' }) {
  return <span className={`trip-count-money ${className}`.trim()}>{formatTwd(cents)}</span>;
}

function formatUpdatedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function expenseToForm(row, members) {
  const weights = Object.fromEntries(members.map((member) => [member.id, '']));
  const customAmounts = {};
  const memberIds = [];
  row.shares.forEach((share) => {
    if (row.splitMode === 'equal') memberIds.push(share.memberId);
    if (row.splitMode === 'weights' && share.weight) weights[share.memberId] = String(share.weight);
    if (row.splitMode === 'custom') customAmounts[share.memberId] = centsToInput(share.shareCents);
  });
  if (row.splitMode === 'weights') {
    members.forEach((member) => {
      if (!weights[member.id]) weights[member.id] = '';
    });
  }
  return {
    title: row.title,
    amount: centsToInput(row.amountCents),
    payerMemberId: String(row.payerMemberId),
    splitMode: row.splitMode,
    memberIds: memberIds.length ? memberIds : members.map((member) => member.id),
    customAmounts,
    weights: row.splitMode === 'weights'
      ? weights
      : Object.fromEntries(members.map((member) => [member.id, '1'])),
    category: row.category || '',
    spentOn: row.spentOn || '',
  };
}

export default function TripCountPage() {
  const { token } = useOutletContext();
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [trips, setTrips] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [editingTrip, setEditingTrip] = useState(false);
  const [tripTitleDraft, setTripTitleDraft] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberError, setMemberError] = useState('');
  const [renamingMemberId, setRenamingMemberId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [expense, setExpense] = useState(EMPTY_EXPENSE);
  const [expenseError, setExpenseError] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const loadList = useCallback(async () => {
    const rows = await listTripCounts(token);
    setTrips(Array.isArray(rows) ? rows : []);
  }, [token]);

  const loadDetail = useCallback(async (id) => {
    const data = await getTripCount(token, id);
    setDetail(data);
    setTripTitleDraft(data.trip.title);
    setExpense((current) => ({
      ...current,
      payerMemberId: current.payerMemberId || String(data.members[0]?.id || ''),
      memberIds: current.memberIds.length ? current.memberIds : data.members.map((member) => member.id),
      weights: Object.keys(current.weights).length
        ? current.weights
        : Object.fromEntries(data.members.map((member) => [member.id, '1'])),
    }));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setExpense(EMPTY_EXPENSE);
      setExpenseError('');
      setMemberError('');
      setEditingExpenseId(null);
      setEditingTrip(false);
      setRenamingMemberId(null);
      setCopyMessage('');
      try {
        await loadList();
        if (tripId) await loadDetail(tripId);
        else if (!cancelled) setDetail(null);
      } catch (err) {
        if (!cancelled) setError(err.message || '無法載入旅遊分帳');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, loadList, loadDetail]);

  const customSum = useMemo(() => {
    return Object.values(expense.customAmounts).reduce((sum, value) => sum + (parseTwdToCents(value) || 0), 0);
  }, [expense.customAmounts]);

  const weightEntries = useMemo(() => {
    if (!detail) return [];
    return detail.members.flatMap((member) => {
      const weight = Number(expense.weights[member.id]);
      return Number.isInteger(weight) && weight > 0
        ? [{ memberId: member.id, name: member.name, weight }]
        : [];
    });
  }, [detail, expense.weights]);

  const weightTotal = useMemo(
    () => weightEntries.reduce((sum, row) => sum + row.weight, 0),
    [weightEntries],
  );

  const splitPreview = useMemo(() => {
    if (!detail) return [];
    const amountCents = parseTwdToCents(expense.amount);
    if (!amountCents) return [];
    if (expense.splitMode === 'equal' && expense.memberIds.length) {
      const nameById = new Map(detail.members.map((member) => [member.id, member.name]));
      return allocateEqualShares(amountCents, expense.memberIds).map((row) => ({
        ...row,
        name: nameById.get(row.memberId) || '',
      }));
    }
    if (expense.splitMode === 'weights' && weightEntries.length) {
      return allocateWeightedShares(amountCents, weightEntries).map((row) => {
        const meta = weightEntries.find((item) => item.memberId === row.memberId);
        return { ...row, name: meta?.name || '', weight: meta?.weight };
      });
    }
    return [];
  }, [detail, expense.amount, expense.splitMode, expense.memberIds, weightEntries]);

  const previewCentsByMember = useMemo(() => {
    const map = new Map();
    splitPreview.forEach((row) => map.set(row.memberId, row.shareCents));
    return map;
  }, [splitPreview]);

  const reload = async (id = tripId) => {
    await loadList();
    if (id) await loadDetail(id);
  };

  const buildExpensePayload = () => {
    const amountCents = parseTwdToCents(expense.amount);
    if (!expense.title.trim()) {
      setExpenseError('請填項目名稱');
      return null;
    }
    if (!amountCents) {
      setExpenseError('請填大於 0 的金額');
      return null;
    }
    if (!expense.payerMemberId) {
      setExpenseError('請選擇誰先付錢');
      return null;
    }
    if (expense.splitMode === 'equal' && !expense.memberIds.length) {
      setExpenseError('請至少選一位分攤的人');
      return null;
    }
    if (expense.splitMode === 'weights' && weightTotal < 1) {
      setExpenseError('請至少為一位成員設定份數（情侶可填 2）');
      return null;
    }
    if (expense.splitMode === 'custom' && customSum !== amountCents) {
      setExpenseError('指定金額加總必須等於這一筆的金額');
      return null;
    }
    const payload = {
      title: expense.title.trim(),
      amountCents,
      payerMemberId: Number(expense.payerMemberId),
      splitMode: expense.splitMode,
      category: expense.category || null,
      spentOn: expense.spentOn || null,
    };
    if (expense.splitMode === 'equal') {
      payload.memberIds = expense.memberIds;
    } else if (expense.splitMode === 'weights') {
      payload.shares = weightEntries.map((row) => ({ memberId: row.memberId, weight: row.weight }));
    } else {
      payload.shares = detail.members.flatMap((member) => {
        const shareCents = parseTwdToCents(expense.customAmounts[member.id]);
        return shareCents ? [{ memberId: member.id, shareCents }] : [];
      });
    }
    return payload;
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError('請填旅程名稱');
      return;
    }
    setSaving(true);
    setError('');
    setTitleError('');
    try {
      const data = await createTripCount(token, { title });
      setTitle('');
      navigate(`/admin/trip-counts/${data.trip.id}`);
    } catch (err) {
      setError(err.message || '無法建立旅程');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTripTitle = async (event) => {
    event.preventDefault();
    if (!tripTitleDraft.trim()) {
      setError('請填旅程名稱');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = await updateTripCount(token, tripId, {
        title: tripTitleDraft.trim(),
        note: detail.trip.note || '',
      });
      setDetail(data);
      setEditingTrip(false);
      await loadList();
    } catch (err) {
      setError(err.message || '無法更新旅程名稱');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!memberName.trim()) {
      setMemberError('請填成員名稱');
      return;
    }
    setSaving(true);
    setError('');
    setMemberError('');
    try {
      await addTripCountMember(token, tripId, memberName);
      setMemberName('');
      await reload();
    } catch (err) {
      setError(err.message || '無法新增成員');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameMember = async (event) => {
    event.preventDefault();
    if (!renameDraft.trim()) {
      setMemberError('請填成員名稱');
      return;
    }
    setSaving(true);
    setError('');
    setMemberError('');
    try {
      await renameTripCountMember(token, tripId, renamingMemberId, renameDraft.trim());
      setRenamingMemberId(null);
      setRenameDraft('');
      await reload();
    } catch (err) {
      setError(err.message || '無法重新命名成員');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (member) => {
    const ok = await confirm({
      title: '移除成員',
      description: `確定移除「${member.name}」？若已出現在帳目中，請先刪除相關帳目。`,
    });
    if (!ok) return;
    setError('');
    try {
      await removeTripCountMember(token, tripId, member.id);
      await reload();
    } catch (err) {
      setError(err.message || '無法移除成員');
    }
  };

  const handleSaveExpense = async (event) => {
    event.preventDefault();
    const payload = buildExpensePayload();
    if (!payload) return;
    setSaving(true);
    setError('');
    setExpenseError('');
    try {
      if (editingExpenseId) {
        await updateTripCountExpense(token, tripId, editingExpenseId, payload);
        setEditingExpenseId(null);
        setExpense({
          ...EMPTY_EXPENSE,
          payerMemberId: expense.payerMemberId,
          splitMode: expense.splitMode,
          memberIds: expense.memberIds,
          weights: expense.weights,
          category: expense.category,
          spentOn: expense.spentOn,
        });
      } else {
        await addTripCountExpense(token, tripId, payload);
        // 記住分攤設定，只清項目與金額
        setExpense({
          ...EMPTY_EXPENSE,
          payerMemberId: expense.payerMemberId,
          splitMode: expense.splitMode,
          memberIds: expense.memberIds,
          weights: expense.weights,
          category: expense.category,
          spentOn: expense.spentOn,
        });
      }
      await reload();
    } catch (err) {
      setError(err.message || (editingExpenseId ? '無法更新帳目' : '無法新增帳目'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditExpense = (row) => {
    setExpense(expenseToForm(row, detail.members));
    setEditingExpenseId(row.id);
    setExpenseError('');
    window.requestAnimationFrame(() => {
      document.getElementById('trip-count-expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleCancelEditExpense = () => {
    setEditingExpenseId(null);
    setExpense({
      ...EMPTY_EXPENSE,
      payerMemberId: String(detail.members[0]?.id || ''),
      memberIds: detail.members.map((member) => member.id),
      weights: Object.fromEntries(detail.members.map((member) => [member.id, '1'])),
    });
    setExpenseError('');
  };

  const handleRemoveExpense = async (row) => {
    const ok = await confirm({
      title: '刪除帳目',
      description: `確定刪除「${row.title}」（${formatTwd(row.amountCents)}）？`,
    });
    if (!ok) return;
    setError('');
    try {
      await removeTripCountExpense(token, tripId, row.id);
      if (editingExpenseId === row.id) handleCancelEditExpense();
      await reload();
    } catch (err) {
      setError(err.message || '無法刪除帳目');
    }
  };

  const handleDeleteTrip = async () => {
    const ok = await confirm({
      title: '刪除旅程',
      description: `確定刪除「${detail?.trip?.title || ''}」？帳目會一併刪除。`,
    });
    if (!ok) return;
    setError('');
    try {
      await deleteTripCount(token, tripId);
      navigate('/admin/trip-counts');
    } catch (err) {
      setError(err.message || '無法刪除旅程');
    }
  };

  const handleCopySettlement = async () => {
    const text = formatTripSettlementCopy(detail.trip, detail.settlement);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('已複製建議轉帳');
    } catch {
      setCopyMessage('無法複製，請手動選取文字');
    }
    window.setTimeout(() => setCopyMessage(''), 2500);
  };

  const toggleMember = (memberId) => {
    setExpense((current) => {
      const selected = new Set(current.memberIds);
      if (selected.has(memberId)) selected.delete(memberId);
      else selected.add(memberId);
      return { ...current, memberIds: [...selected] };
    });
  };

  const selectAllMembers = () => {
    setExpense((current) => ({
      ...current,
      memberIds: detail.members.map((member) => member.id),
    }));
  };

  const clearSelectedMembers = () => {
    setExpense((current) => ({ ...current, memberIds: [] }));
  };

  const shareSummary = (row) => (
    <>
      {row.splitMode === 'equal' ? '均分：' : row.splitMode === 'weights' ? '依份數：' : '指定：'}
      {row.shares.map((share) => {
        const weightBit = row.splitMode === 'weights' && share.weight
          ? `${share.weight} 份／`
          : '';
        return `${share.name} ${weightBit}${formatTwd(share.shareCents)}`;
      }).join('、')}
    </>
  );

  return (
    <div className="trip-count-page">
      <p className="text-muted small">
        每筆帳可各自選分攤的人：有的三個人、有的四個人都行。情侶可改用「依份數」，其中一人填 2 份。系統會把互相抵銷後的結果收成建議轉帳。只看得到自己建立的旅程，金額以新台幣計算。
      </p>
      <div aria-live="polite">
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {copyMessage ? <Alert variant="success">{copyMessage}</Alert> : null}
      </div>
      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted">
          <Spinner animation="border" size="sm" />
          <span>載入中…</span>
        </div>
      ) : null}

      {!loading && !tripId ? (
        <>
          <form className="card shadow-sm mb-4" onSubmit={handleCreate} autoComplete="off">
            <div className="card-body">
              <div className="fw-semibold mb-2">新的旅程</div>
              <div className="d-flex flex-wrap gap-2 align-items-start">
                <div className="trip-count-inline-grow">
                  <Form.Control
                    id="trip-count-title"
                    name="tripTitle"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      if (titleError) setTitleError('');
                    }}
                    placeholder="例如：楊安畢業旅行…"
                    aria-label="旅程名稱"
                    aria-invalid={Boolean(titleError)}
                    isInvalid={Boolean(titleError)}
                  />
                  {titleError ? <p className="trip-count-field-error" role="alert">{titleError}</p> : null}
                </div>
                <Button type="submit" disabled={saving || !title.trim()}>建立</Button>
              </div>
            </div>
          </form>
          {trips.length === 0 ? (
            <p className="text-muted">還沒有旅程。</p>
          ) : (
            <div className="list-group">
              {trips.map((trip) => (
                <Link
                  key={trip.id}
                  to={`/admin/trip-counts/${trip.id}`}
                  className="list-group-item list-group-item-action"
                >
                  <div className="d-flex justify-content-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="fw-semibold text-break">{trip.title}</div>
                      {trip.note ? <div className="small text-muted text-break">{trip.note}</div> : null}
                      <div className="small text-muted mt-1">
                        {trip.memberCount || 0} 人 · {trip.expenseCount || 0} 筆 · 合計{' '}
                        <Money cents={trip.totalCents || 0} />
                        {trip.updatedAt ? ` · 更新 ${formatUpdatedAt(trip.updatedAt)}` : ''}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}

      {!loading && tripId && detail ? (
        <>
          <div className="d-flex justify-content-between align-items-start gap-2 mb-3 flex-wrap">
            <div className="min-w-0 flex-grow-1">
              <Link to="/admin/trip-counts" className="small">全部旅程</Link>
              {editingTrip ? (
                <form className="d-flex flex-wrap gap-2 align-items-start mt-2" onSubmit={handleSaveTripTitle}>
                  <Form.Control
                    value={tripTitleDraft}
                    onChange={(event) => setTripTitleDraft(event.target.value)}
                    aria-label="旅程名稱"
                    style={{ maxWidth: 360 }}
                  />
                  <Button type="submit" size="sm" disabled={saving || !tripTitleDraft.trim()}>儲存</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => {
                      setEditingTrip(false);
                      setTripTitleDraft(detail.trip.title);
                    }}
                  >
                    取消
                  </Button>
                </form>
              ) : (
                <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
                  <h2 className="h4 mb-0 text-break">{detail.trip.title}</h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => {
                      setTripTitleDraft(detail.trip.title);
                      setEditingTrip(true);
                    }}
                  >
                    改名
                  </Button>
                </div>
              )}
            </div>
            <Button variant="outline-danger" onClick={handleDeleteTrip}>刪除旅程</Button>
          </div>

          <div className="card shadow-sm mb-4">
            <div className="card-header d-flex justify-content-between align-items-center gap-2 flex-wrap">
              <span>建議轉帳</span>
              <Button type="button" size="sm" variant="outline-primary" onClick={handleCopySettlement}>
                複製文字
              </Button>
            </div>
            <div className="card-body">
              {detail.settlement.transfers.length === 0 ? (
                <p className="text-muted mb-3">目前沒有人需要再轉帳。</p>
              ) : (
                <ul className="mb-3">
                  {detail.settlement.transfers.map((transfer) => (
                    <li key={`${transfer.fromMemberId}-${transfer.toMemberId}-${transfer.amountCents}`}>
                      {transfer.fromName} 給 {transfer.toName}{' '}
                      <Money cents={transfer.amountCents} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="row g-2">
                {detail.settlement.people.map((person) => (
                  <div key={person.memberId} className="col-6 col-lg-3">
                    <div className="border rounded p-2 h-100">
                      <div className="fw-semibold text-break">{person.name}</div>
                      <div className="small text-muted">先付 <Money cents={person.paidCents} /></div>
                      <div className="small text-muted">應分攤 <Money cents={person.shareCents} /></div>
                      <div className="small"><span className="trip-count-money">{balanceLabel(person.balanceCents)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card shadow-sm mb-4">
            <div className="card-header">成員</div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                {detail.members.map((member) => (
                  <div key={member.id} className="trip-count-member-chip">
                    {renamingMemberId === member.id ? (
                      <form className="d-flex flex-wrap gap-2 align-items-center" onSubmit={handleRenameMember}>
                        <Form.Control
                          size="sm"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          aria-label={`重新命名 ${member.name}`}
                          style={{ width: 120 }}
                        />
                        <Button type="submit" size="sm" disabled={saving || !renameDraft.trim()}>儲存</Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => setRenamingMemberId(null)}
                        >
                          取消
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="text-break">{member.name}</span>
                        <Button
                          type="button"
                          variant="outline-secondary"
                          size="sm"
                          className="trip-count-member-chip__rename"
                          onClick={() => {
                            setRenamingMemberId(member.id);
                            setRenameDraft(member.name);
                            setMemberError('');
                          }}
                        >
                          改名
                        </Button>
                        <Button
                          type="button"
                          variant="outline-danger"
                          size="sm"
                          className="trip-count-member-chip__remove"
                          aria-label={`移除 ${member.name}`}
                          onClick={() => handleRemoveMember(member)}
                        >
                          移除
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                {detail.members.length === 0 ? <span className="text-muted small">先加入一起分帳的人。</span> : null}
              </div>
              <form className="d-flex flex-wrap gap-2 align-items-start" onSubmit={handleAddMember} autoComplete="off">
                <div className="trip-count-inline-grow trip-count-inline-grow--member">
                  <Form.Control
                    id="trip-count-member-name"
                    name="memberName"
                    value={memberName}
                    onChange={(event) => {
                      setMemberName(event.target.value);
                      if (memberError) setMemberError('');
                    }}
                    placeholder="名稱…"
                    aria-label="成員名稱"
                    aria-invalid={Boolean(memberError)}
                    isInvalid={Boolean(memberError)}
                  />
                  {memberError ? <p className="trip-count-field-error" role="alert">{memberError}</p> : null}
                </div>
                <Button type="submit" variant="outline-primary" disabled={saving || !memberName.trim()}>加入</Button>
              </form>
            </div>
          </div>

          <form
            id="trip-count-expense-form"
            className="card shadow-sm mb-4"
            onSubmit={handleSaveExpense}
            autoComplete="off"
          >
            <div className="card-header d-flex justify-content-between align-items-center gap-2">
              <span>{editingExpenseId ? '編輯帳目' : '新增一筆帳'}</span>
              {editingExpenseId ? (
                <Button type="button" size="sm" variant="outline-secondary" onClick={handleCancelEditExpense}>
                  取消編輯
                </Button>
              ) : null}
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12 col-lg-4">
                  <Form.Label htmlFor="trip-count-expense-title">項目</Form.Label>
                  <Form.Control
                    id="trip-count-expense-title"
                    name="expenseTitle"
                    value={expense.title}
                    onChange={(event) => {
                      setExpense((current) => ({ ...current, title: event.target.value }));
                      if (expenseError) setExpenseError('');
                    }}
                  />
                </div>
                <div className="col-12 col-sm-6 col-lg-2">
                  <Form.Label htmlFor="trip-count-expense-amount">金額</Form.Label>
                  <Form.Control
                    id="trip-count-expense-amount"
                    name="expenseAmount"
                    className="trip-count-money"
                    inputMode="decimal"
                    value={expense.amount}
                    onChange={(event) => {
                      setExpense((current) => ({ ...current, amount: event.target.value }));
                      if (expenseError) setExpenseError('');
                    }}
                    placeholder="2497 或 1104.50…"
                  />
                </div>
                <div className="col-12 col-sm-6 col-lg-2">
                  <Form.Label htmlFor="trip-count-expense-category">分類</Form.Label>
                  <Form.Select
                    id="trip-count-expense-category"
                    name="expenseCategory"
                    value={expense.category}
                    onChange={(event) => setExpense((current) => ({ ...current, category: event.target.value }))}
                  >
                    <option value="">未分類</option>
                    {TRIP_COUNT_CATEGORIES.map((item) => (
                      <option key={item.code} value={item.code}>{item.label}</option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-12 col-sm-6 col-lg-2">
                  <Form.Label htmlFor="trip-count-expense-date">日期</Form.Label>
                  <Form.Control
                    id="trip-count-expense-date"
                    name="expenseDate"
                    type="date"
                    value={expense.spentOn}
                    onChange={(event) => setExpense((current) => ({ ...current, spentOn: event.target.value }))}
                  />
                </div>
                <div className="col-12 col-sm-6 col-lg-2">
                  <Form.Label htmlFor="trip-count-expense-payer">誰先付</Form.Label>
                  <Form.Select
                    id="trip-count-expense-payer"
                    name="expensePayer"
                    value={expense.payerMemberId}
                    onChange={(event) => {
                      setExpense((current) => ({ ...current, payerMemberId: event.target.value }));
                      if (expenseError) setExpenseError('');
                    }}
                  >
                    <option value="">請選擇</option>
                    {detail.members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-12 col-lg-2">
                  <Form.Label htmlFor="trip-count-expense-split">分攤</Form.Label>
                  <Form.Select
                    id="trip-count-expense-split"
                    name="expenseSplit"
                    value={expense.splitMode}
                    onChange={(event) => {
                      const splitMode = event.target.value;
                      setExpense((current) => ({
                        ...current,
                        splitMode,
                        weights: splitMode === 'weights' && !Object.keys(current.weights).length
                          ? Object.fromEntries(detail.members.map((member) => [member.id, '1']))
                          : current.weights,
                      }));
                      if (expenseError) setExpenseError('');
                    }}
                  >
                    <option value="equal">均分</option>
                    <option value="weights">依份數</option>
                    <option value="custom">指定金額</option>
                  </Form.Select>
                </div>
              </div>
              {expense.splitMode === 'equal' ? (
                <div className="trip-count-split-panel mt-3">
                  <div className="trip-count-split-panel__header">
                    <div>
                      <div className="fw-semibold">這一筆由誰分攤</div>
                      <div className="small text-muted">點名字切換；沒參加的人不要選。已選 {expense.memberIds.length}/{detail.members.length} 人</div>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-secondary"
                        onClick={selectAllMembers}
                        disabled={expense.memberIds.length === detail.members.length}
                      >
                        全選
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-secondary"
                        onClick={clearSelectedMembers}
                        disabled={!expense.memberIds.length}
                      >
                        清空
                      </Button>
                    </div>
                  </div>
                  <div className="trip-count-split-panel__grid" role="group" aria-label="選擇分攤成員">
                    {detail.members.map((member) => {
                      const selected = expense.memberIds.includes(member.id);
                      const previewCents = previewCentsByMember.get(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          className={`trip-count-split-chip${selected ? ' is-selected' : ''}`}
                          aria-pressed={selected}
                          onClick={() => toggleMember(member.id)}
                        >
                          <span className="trip-count-split-chip__check" aria-hidden="true">
                            {selected ? '✓' : ''}
                          </span>
                          <span className="trip-count-split-chip__body">
                            <span className="trip-count-split-chip__name text-break">{member.name}</span>
                            <span className="trip-count-split-chip__meta">
                              {selected
                                ? (previewCents != null ? <Money cents={previewCents} /> : '會均分')
                                : '不參加'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {expense.splitMode === 'weights' ? (
                <div className="trip-count-split-panel mt-3">
                  <div className="trip-count-split-panel__header">
                    <div>
                      <div className="fw-semibold">依份數分攤</div>
                      <div className="small text-muted">
                        不參加留空或填 0；情侶可由一人填 2。目前共 {weightTotal} 份。
                      </div>
                    </div>
                  </div>
                  <div className="row g-2">
                    {detail.members.map((member) => {
                      const previewCents = previewCentsByMember.get(member.id);
                      return (
                        <div key={member.id} className="col-6 col-md-4 col-xl-3">
                          <div className="trip-count-weight-card">
                            <Form.Label htmlFor={`weight-share-${member.id}`} className="small text-break mb-1">
                              {member.name}
                            </Form.Label>
                            <div className="input-group input-group-sm">
                              <Form.Control
                                id={`weight-share-${member.id}`}
                                name={`weightShare-${member.id}`}
                                inputMode="numeric"
                                value={expense.weights[member.id] ?? ''}
                                onChange={(event) => setExpense((current) => ({
                                  ...current,
                                  weights: { ...current.weights, [member.id]: event.target.value },
                                }))}
                                placeholder="0"
                                aria-label={`${member.name} 份數`}
                              />
                              <span className="input-group-text">份</span>
                            </div>
                            <div className="small text-muted mt-1">
                              {previewCents != null ? <Money cents={previewCents} /> : '—'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {expense.splitMode === 'custom' ? (
                <div className="trip-count-split-panel mt-3">
                  <div className="trip-count-split-panel__header">
                    <div>
                      <div className="fw-semibold">指定每人金額</div>
                      <div className="small text-muted">
                        已填 <Money cents={customSum} />，這一筆是{' '}
                        <Money cents={parseTwdToCents(expense.amount) || 0} />。兩邊要相同。
                      </div>
                    </div>
                  </div>
                  <div className="row g-2">
                    {detail.members.map((member) => (
                      <div key={member.id} className="col-6 col-md-4 col-xl-3">
                        <div className="trip-count-weight-card">
                          <Form.Label htmlFor={`custom-share-${member.id}`} className="small text-break mb-1">
                            {member.name}
                          </Form.Label>
                          <Form.Control
                            id={`custom-share-${member.id}`}
                            name={`customShare-${member.id}`}
                            className="trip-count-money"
                            inputMode="decimal"
                            value={expense.customAmounts[member.id] || ''}
                            onChange={(event) => setExpense((current) => ({
                              ...current,
                              customAmounts: { ...current.customAmounts, [member.id]: event.target.value },
                            }))}
                            placeholder="不填＝不分攤"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {expenseError ? <p className="trip-count-field-error mt-3" role="alert">{expenseError}</p> : null}
              <Button className="mt-3" type="submit" disabled={saving || detail.members.length === 0}>
                {saving ? '儲存中…' : editingExpenseId ? '更新帳目' : '加入帳目'}
              </Button>
            </div>
          </form>

          <div className="card shadow-sm">
            <div className="card-header">帳目</div>
            <div className="card-body p-0">
              {detail.expenses.length === 0 ? (
                <p className="text-muted p-3 mb-0">還沒有帳目。</p>
              ) : (
                <>
                  <div className="d-lg-none">
                    {detail.expenses.map((row) => (
                      <div key={row.id} className="trip-count-expense-card">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="min-w-0">
                            <div className="fw-semibold text-break">{row.title}</div>
                            <div className="trip-count-money"><Money cents={row.amountCents} /></div>
                            <div className="small text-muted text-break">
                              {[
                                row.spentOn,
                                tripCountCategoryLabel(row.category),
                                `誰先付：${row.payerName}`,
                              ].filter(Boolean).join(' · ')}
                            </div>
                            <div className="small text-break mt-1">{shareSummary(row)}</div>
                          </div>
                          <div className="d-flex flex-column gap-2 flex-shrink-0">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              aria-label={`編輯 ${row.title}`}
                              onClick={() => handleEditExpense(row)}
                            >
                              編輯
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              aria-label={`刪除 ${row.title}`}
                              onClick={() => handleRemoveExpense(row)}
                            >
                              刪除
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="d-none d-lg-block table-responsive">
                    <table className="table mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>分類</th>
                          <th>項目</th>
                          <th>金額</th>
                          <th>誰先付</th>
                          <th>怎麼分</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {detail.expenses.map((row) => (
                          <tr key={row.id}>
                            <td className="text-nowrap">{row.spentOn || '—'}</td>
                            <td>{tripCountCategoryLabel(row.category) || '—'}</td>
                            <td className="text-break">{row.title}</td>
                            <td className="trip-count-money"><Money cents={row.amountCents} /></td>
                            <td className="text-break">{row.payerName}</td>
                            <td className="small text-break">{shareSummary(row)}</td>
                            <td className="text-end text-nowrap">
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                className="me-2"
                                aria-label={`編輯 ${row.title}`}
                                onClick={() => handleEditExpense(row)}
                              >
                                編輯
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                aria-label={`刪除 ${row.title}`}
                                onClick={() => handleRemoveExpense(row)}
                              >
                                刪除
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
