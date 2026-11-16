import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import useConfirm from '../../components/ui/useConfirm';
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
import './TripCountPage.css';

const EMPTY_EXPENSE = {
  title: '',
  amount: '',
  payerMemberId: '',
  splitMode: 'equal',
  memberIds: [],
  customAmounts: {},
  weights: {},
};

function balanceLabel(cents) {
  if (cents > 0) return `可收回 ${formatTwd(cents)}`;
  if (cents < 0) return `還要付 ${formatTwd(-cents)}`;
  return '已平衡';
}

function Money({ cents, className = '' }) {
  return <span className={`trip-count-money ${className}`.trim()}>{formatTwd(cents)}</span>;
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
  const [memberName, setMemberName] = useState('');
  const [memberError, setMemberError] = useState('');
  const [expense, setExpense] = useState(EMPTY_EXPENSE);
  const [expenseError, setExpenseError] = useState('');
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

  const weightTotal = useMemo(() => {
    return Object.values(expense.weights).reduce((sum, value) => {
      const weight = Number(value);
      return sum + (Number.isInteger(weight) && weight > 0 ? weight : 0);
    }, 0);
  }, [expense.weights]);

  const reload = async (id = tripId) => {
    await loadList();
    if (id) await loadDetail(id);
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

  const handleAddExpense = async (event) => {
    event.preventDefault();
    const amountCents = parseTwdToCents(expense.amount);
    if (!expense.title.trim()) {
      setExpenseError('請填項目名稱');
      return;
    }
    if (!amountCents) {
      setExpenseError('請填大於 0 的金額');
      return;
    }
    if (!expense.payerMemberId) {
      setExpenseError('請選擇誰先付錢');
      return;
    }
    if (expense.splitMode === 'equal' && !expense.memberIds.length) {
      setExpenseError('請至少選一位分攤的人');
      return;
    }
    if (expense.splitMode === 'weights' && weightTotal < 1) {
      setExpenseError('請至少為一位成員設定份數（情侶可填 2）');
      return;
    }
    if (expense.splitMode === 'custom' && customSum !== amountCents) {
      setExpenseError('指定金額加總必須等於這一筆的金額');
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
    } else if (expense.splitMode === 'weights') {
      payload.shares = detail.members.flatMap((member) => {
        const weight = Number(expense.weights[member.id]);
        return Number.isInteger(weight) && weight > 0
          ? [{ memberId: member.id, weight }]
          : [];
      });
    } else {
      payload.shares = detail.members.flatMap((member) => {
        const shareCents = parseTwdToCents(expense.customAmounts[member.id]);
        return shareCents ? [{ memberId: member.id, shareCents }] : [];
      });
    }
    setSaving(true);
    setError('');
    setExpenseError('');
    try {
      await addTripCountExpense(token, tripId, payload);
      setExpense({
        ...EMPTY_EXPENSE,
        payerMemberId: expense.payerMemberId,
        memberIds: detail.members.map((member) => member.id),
        weights: Object.fromEntries(detail.members.map((member) => [member.id, '1'])),
      });
      await reload();
    } catch (err) {
      setError(err.message || '無法新增帳目');
    } finally {
      setSaving(false);
    }
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

  const toggleMember = (memberId) => {
    setExpense((current) => {
      const selected = new Set(current.memberIds);
      if (selected.has(memberId)) selected.delete(memberId);
      else selected.add(memberId);
      return { ...current, memberIds: [...selected] };
    });
  };

  const shareSummary = (row) => (
    <>
      {row.splitMode === 'equal' ? '均分：' : row.splitMode === 'weights' ? '依份數：' : '指定：'}
      {row.shares.map((share) => `${share.name} ${formatTwd(share.shareCents)}`).join('、')}
    </>
  );

  return (
    <div className="trip-count-page">
      <p className="text-muted small">
        每筆帳可各自選分攤的人：有的三個人、有的四個人都行。情侶可改用「依份數」，其中一人填 2 份。系統會把互相抵銷後的結果收成建議轉帳。只看得到自己建立的旅程，金額以新台幣計算。
      </p>
      <div aria-live="polite">
        {error ? <Alert variant="danger">{error}</Alert> : null}
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
                  <div className="fw-semibold text-break">{trip.title}</div>
                  {trip.note ? <div className="small text-muted text-break">{trip.note}</div> : null}
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
              <h2 className="h4 mt-1 mb-0 text-break">{detail.trip.title}</h2>
            </div>
            <Button variant="outline-danger" onClick={handleDeleteTrip}>刪除旅程</Button>
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
                    <span className="text-break">{member.name}</span>
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

          <form className="card shadow-sm mb-4" onSubmit={handleAddExpense} autoComplete="off">
            <div className="card-header">新增一筆帳</div>
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
                <div className="col-12 col-sm-6 col-lg-3">
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
                <div className="col-12 col-sm-6 col-lg-3">
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
                <div className="mt-3">
                  <div className="small text-muted mb-2">勾選這一筆要分攤的人；沒參加的就不要勾。</div>
                  <div className="d-flex flex-wrap gap-3">
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
                </div>
              ) : null}
              {expense.splitMode === 'weights' ? (
                <div className="row g-2 mt-3">
                  <div className="col-12 small text-muted">
                    填份數即可；不參加的人留空或填 0。情侶一起時，可讓其中一人填 2、另一人留空。
                  </div>
                  {detail.members.map((member) => (
                    <div key={member.id} className="col-6 col-lg-3">
                      <Form.Label htmlFor={`weight-share-${member.id}`} className="small text-break">
                        {member.name}（份）
                      </Form.Label>
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
                      />
                    </div>
                  ))}
                  <div className="col-12 small text-muted">
                    共 {weightTotal} 份，會依份數比例分攤這一筆。
                  </div>
                </div>
              ) : null}
              {expense.splitMode === 'custom' ? (
                <div className="row g-2 mt-3">
                  {detail.members.map((member) => (
                    <div key={member.id} className="col-6 col-lg-3">
                      <Form.Label htmlFor={`custom-share-${member.id}`} className="small text-break">
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
                        placeholder="不填表示不分攤…"
                      />
                    </div>
                  ))}
                  <div className="col-12 small text-muted">
                    已填 <Money cents={customSum} />，這一筆是{' '}
                    <Money cents={parseTwdToCents(expense.amount) || 0} />。兩邊要相同。
                  </div>
                </div>
              ) : null}
              {expenseError ? <p className="trip-count-field-error mt-3" role="alert">{expenseError}</p> : null}
              <Button className="mt-3" type="submit" disabled={saving || detail.members.length === 0}>
                {saving ? '儲存中…' : '加入帳目'}
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
                            <div className="small text-muted text-break">誰先付：{row.payerName}</div>
                            <div className="small text-break mt-1">{shareSummary(row)}</div>
                          </div>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="flex-shrink-0"
                            aria-label={`刪除 ${row.title}`}
                            onClick={() => handleRemoveExpense(row)}
                          >
                            刪除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="d-none d-lg-block table-responsive">
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
                            <td className="text-break">{row.title}</td>
                            <td className="trip-count-money"><Money cents={row.amountCents} /></td>
                            <td className="text-break">{row.payerName}</td>
                            <td className="small text-break">{shareSummary(row)}</td>
                            <td className="text-end">
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
