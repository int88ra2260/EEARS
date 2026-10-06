import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import {
  addTripCountExpense,
  addTripCountMember,
  createTripCount,
  deleteTripCount,
  getTripCount,
  listTripCounts,
  removeTripCountExpense,
  removeTripCountMember,
} from '../../services/tripCountApi';
import { formatTwd, parseTwdToCents } from '../../utils/tripCountMoney';

const EMPTY_EXPENSE = {
  title: '',
  amount: '',
  payerMemberId: '',
  splitMode: 'equal',
  memberIds: [],
  customAmounts: {},
};

function balanceLabel(cents) {
  if (cents > 0) return `可收回 ${formatTwd(cents)}`;
  if (cents < 0) return `還要付 ${formatTwd(-cents)}`;
  return '已平衡';
}

export default function TripCountPage() {
  const { token } = useOutletContext();
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [memberName, setMemberName] = useState('');
  const [expense, setExpense] = useState(EMPTY_EXPENSE);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    const rows = await listTripCounts(token);
    setTrips(Array.isArray(rows) ? rows : []);
  }, [token]);

  const loadDetail = useCallback(async (id) => {
    const data = await getTripCount(token, id);
    setDetail(data);
    setExpense((current) => ({
      ...current,
      payerMemberId: current.payerMemberId || String(data.members[0]?.id || ''),
      memberIds: current.memberIds.length ? current.memberIds : data.members.map((member) => member.id),
    }));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setExpense(EMPTY_EXPENSE);
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

  const reload = async (id = tripId) => {
    await loadList();
    if (id) await loadDetail(id);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
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

  const handleAddMember = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
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

  const handleRemoveMember = async (memberId) => {
    setError('');
    try {
      await removeTripCountMember(token, tripId, memberId);
      await reload();
    } catch (err) {
      setError(err.message || '無法移除成員');
    }
  };

  const handleAddExpense = async (event) => {
    event.preventDefault();
    const amountCents = parseTwdToCents(expense.amount);
    if (!expense.title.trim() || !amountCents || !expense.payerMemberId) {
      setError('請填項目、金額，並選擇誰先付錢');
      return;
    }
    const payload = {
      title: expense.title.trim(),
      amountCents,
      payerMemberId: Number(expense.payerMemberId),
      splitMode: expense.splitMode,
    };
    if (expense.splitMode === 'equal') {
      payload.memberIds = expense.memberIds;
    } else {
      payload.shares = detail.members.flatMap((member) => {
        const shareCents = parseTwdToCents(expense.customAmounts[member.id]);
        return shareCents ? [{ memberId: member.id, shareCents }] : [];
      });
    }
    setSaving(true);
    setError('');
    try {
      await addTripCountExpense(token, tripId, payload);
      setExpense({
        ...EMPTY_EXPENSE,
        payerMemberId: expense.payerMemberId,
        memberIds: detail.members.map((member) => member.id),
      });
      await reload();
    } catch (err) {
      setError(err.message || '無法新增帳目');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveExpense = async (expenseId) => {
    setError('');
    try {
      await removeTripCountExpense(token, tripId, expenseId);
      await reload();
    } catch (err) {
      setError(err.message || '無法刪除帳目');
    }
  };

  const handleDeleteTrip = async () => {
    if (!window.confirm(`確定刪除「${detail?.trip?.title || ''}」？帳目會一併刪除。`)) return;
    setError('');
    try {
      await deleteTripCount(token, tripId);
      navigate('/admin/trip-counts');
    } catch (err) {
      setError(err.message || '無法刪除旅程');
    }
  };

  const toggleMember = (memberId) => {
    setExpense((current) => {
      const selected = new Set(current.memberIds);
      if (selected.has(memberId)) selected.delete(memberId);
      else selected.add(memberId);
      return { ...current, memberIds: [...selected] };
    });
  };

  return (
    <div>
      <p className="text-muted small">
        記下誰先付錢、這筆由誰分攤。系統會把互相抵銷後的結果收成建議轉帳。只看得到自己建立的旅程，金額以新台幣計算。
      </p>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted">
          <Spinner animation="border" size="sm" />
          <span>載入中</span>
        </div>
      ) : null}

      {!loading && !tripId ? (
        <>
          <form className="card shadow-sm mb-4" onSubmit={handleCreate}>
            <div className="card-body">
              <div className="fw-semibold mb-2">新的旅程</div>
              <div className="d-flex flex-wrap gap-2">
                <Form.Control
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例如：楊安畢業旅行"
                  aria-label="旅程名稱"
                  style={{ maxWidth: 360 }}
                />
                <Button type="submit" disabled={saving || !title.trim()}>建立</Button>
              </div>
            </div>
          </form>
          {trips.length === 0 ? (
            <p className="text-muted">還沒有旅程。</p>
          ) : (
            <div className="list-group">
              {trips.map((trip) => (
                <Link key={trip.id} to={`/admin/trip-counts/${trip.id}`} className="list-group-item list-group-item-action">
                  <div className="fw-semibold">{trip.title}</div>
                  {trip.note ? <div className="small text-muted">{trip.note}</div> : null}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}

      {!loading && tripId && detail ? (
        <>
          <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
            <div>
              <Link to="/admin/trip-counts" className="small">全部旅程</Link>
              <h2 className="h4 mt-1 mb-0">{detail.trip.title}</h2>
            </div>
            <Button variant="outline-danger" size="sm" onClick={handleDeleteTrip}>刪除旅程</Button>
          </div>

          <div className="card shadow-sm mb-4">
            <div className="card-header">建議轉帳</div>
            <div className="card-body">
              {detail.settlement.transfers.length === 0 ? (
                <p className="text-muted mb-3">目前沒有人需要再轉帳。</p>
              ) : (
                <ul className="mb-3">
                  {detail.settlement.transfers.map((transfer) => (
                    <li key={`${transfer.fromMemberId}-${transfer.toMemberId}-${transfer.amountCents}`}>
                      {transfer.fromName} 給 {transfer.toName} {formatTwd(transfer.amountCents)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="row g-2">
                {detail.settlement.people.map((person) => (
                  <div key={person.memberId} className="col-md-3">
                    <div className="border rounded p-2 h-100">
                      <div className="fw-semibold">{person.name}</div>
                      <div className="small text-muted">先付 {formatTwd(person.paidCents)}</div>
                      <div className="small text-muted">應分攤 {formatTwd(person.shareCents)}</div>
                      <div className="small">{balanceLabel(person.balanceCents)}</div>
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
                  <span key={member.id} className="badge text-bg-light border">
                    {member.name}
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 ms-2"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      移除
                    </button>
                  </span>
                ))}
                {detail.members.length === 0 ? <span className="text-muted small">先加入一起分帳的人。</span> : null}
              </div>
              <form className="d-flex flex-wrap gap-2" onSubmit={handleAddMember}>
                <Form.Control
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  placeholder="名稱"
                  aria-label="成員名稱"
                  style={{ maxWidth: 220 }}
                />
                <Button type="submit" variant="outline-primary" disabled={saving || !memberName.trim()}>加入</Button>
              </form>
            </div>
          </div>

          <form className="card shadow-sm mb-4" onSubmit={handleAddExpense}>
            <div className="card-header">新增一筆帳</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <Form.Label>項目</Form.Label>
                  <Form.Control
                    value={expense.title}
                    onChange={(event) => setExpense((current) => ({ ...current, title: event.target.value }))}
                  />
                </div>
                <div className="col-md-3">
                  <Form.Label>金額</Form.Label>
                  <Form.Control
                    inputMode="decimal"
                    value={expense.amount}
                    onChange={(event) => setExpense((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="2497 或 1104.50"
                  />
                </div>
                <div className="col-md-3">
                  <Form.Label>誰先付</Form.Label>
                  <Form.Select
                    value={expense.payerMemberId}
                    onChange={(event) => setExpense((current) => ({ ...current, payerMemberId: event.target.value }))}
                  >
                    <option value="">請選擇</option>
                    {detail.members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-2">
                  <Form.Label>分攤</Form.Label>
                  <Form.Select
                    value={expense.splitMode}
                    onChange={(event) => setExpense((current) => ({ ...current, splitMode: event.target.value }))}
                  >
                    <option value="equal">均分</option>
                    <option value="custom">指定金額</option>
                  </Form.Select>
                </div>
              </div>
              {expense.splitMode === 'equal' ? (
                <div className="d-flex flex-wrap gap-3 mt-3">
                  {detail.members.map((member) => (
                    <Form.Check
                      key={member.id}
                      type="checkbox"
                      id={`share-${member.id}`}
                      label={member.name}
                      checked={expense.memberIds.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="row g-2 mt-3">
                  {detail.members.map((member) => (
                    <div key={member.id} className="col-md-3">
                      <Form.Label className="small">{member.name}</Form.Label>
                      <Form.Control
                        inputMode="decimal"
                        value={expense.customAmounts[member.id] || ''}
                        onChange={(event) => setExpense((current) => ({
                          ...current,
                          customAmounts: { ...current.customAmounts, [member.id]: event.target.value },
                        }))}
                        placeholder="不填表示不分攤"
                      />
                    </div>
                  ))}
                  <div className="col-12 small text-muted">
                    已填 {formatTwd(customSum)}，這一筆是 {formatTwd(parseTwdToCents(expense.amount) || 0)}。兩邊要相同。
                  </div>
                </div>
              )}
              <Button className="mt-3" type="submit" disabled={saving || detail.members.length === 0}>加入帳目</Button>
            </div>
          </form>

          <div className="card shadow-sm">
            <div className="card-header">帳目</div>
            <div className="card-body p-0">
              {detail.expenses.length === 0 ? (
                <p className="text-muted p-3 mb-0">還沒有帳目。</p>
              ) : (
                <div className="table-responsive">
                  <table className="table mb-0 align-middle">
                    <thead>
                      <tr>
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
                          <td>{row.title}</td>
                          <td>{formatTwd(row.amountCents)}</td>
                          <td>{row.payerName}</td>
                          <td className="small">
                            {row.splitMode === 'equal' ? '均分：' : '指定：'}
                            {row.shares.map((share) => `${share.name} ${formatTwd(share.shareCents)}`).join('、')}
                          </td>
                          <td className="text-end">
                            <Button variant="link" size="sm" onClick={() => handleRemoveExpense(row.id)}>刪除</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
