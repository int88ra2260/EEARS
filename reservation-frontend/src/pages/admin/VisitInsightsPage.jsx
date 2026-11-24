import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Alert, Button, Spinner, Table } from 'react-bootstrap';
import { fetchClient } from '../../utils/fetchClient';

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

const INTENT_LABELS = {
  reserve: '預約',
  announcements: '公告',
  class_credit: '課堂加分',
};

const ORDER_LABELS = {
  reserve_then_login: '先到預約頁，之後才登入',
  login_then_reserve: '這次先登入，再進預約頁',
  already_logged_in: '進來時已經登入，然後進預約頁',
  reserve_without_login: '看了預約頁，離開前沒有登入',
  login_without_reserve: '有登入，但沒進預約頁',
};

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export default function VisitInsightsPage() {
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchClient(`/api/stats/visit-insights?days=${days}`, { headers: authHeaders(token) })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || json.error || '載入失敗');
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '載入失敗');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, token]);

  const intentTotal = data
    ? data.intents.reserve + data.intents.announcements + data.intents.class_credit
    : 0;
  const peakHour = data?.hours?.reduce((best, item) => (item.count > best.count ? item : best), { hour: 0, count: 0 });

  return (
    <div className="container-fluid px-2 px-md-3 py-3">
      <p className="mb-2">
        <Link to="/admin/analytics/overview">活動營運總覽</Link>
      </p>
      <h1 className="h3">造訪目的</h1>
      <p className="text-muted">
        每一趟公開頁造訪只記一次。目的是這趟最先進入的預約、公告或課堂加分頁面。時段是台北時間。不記學號、姓名或信箱。上線前的造訪不會出現在這裡。裝置與 scroll-world 從這次上線後才開始記。
      </p>
      <div className="d-flex gap-2 mb-3">
        {[7, 30].map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={days === value ? 'primary' : 'outline-primary'}
            onClick={() => setDays(value)}
          >
            近 {value} 天
          </Button>
        ))}
      </div>
      {loading && <Spinner animation="border" size="sm" role="status" />}
      {error && <Alert variant="danger">{error}</Alert>}
      {data && !loading && (
        <>
          <h2 className="h5 mt-3">用什麼裝置</h2>
          <p className="text-muted small">
            寬度至少 861px 算電腦，這也是首頁會出現 scroll-world 的寬度。較窄的視窗算手機。同一趟只記一次。
          </p>
          <Table bordered responsive>
            <tbody>
              <tr>
                <td>電腦</td>
                <td>{data.devices?.desktop || 0}</td>
              </tr>
              <tr>
                <td>手機</td>
                <td>{data.devices?.phone || 0}</td>
              </tr>
            </tbody>
          </Table>

          <h2 className="h5">scroll-world 有沒有被使用</h2>
          <p className="text-muted small">
            只算電腦首頁真的打開沉浸層的人。捲動、方向鍵、點主題或點裡面的連結算有使用。自動進場動畫不算。手機不會出現這層。
          </p>
          <Table bordered responsive>
            <tbody>
              <tr>
                <td>有看到</td>
                <td>{data.scrollWorld?.shown || 0}</td>
              </tr>
              <tr>
                <td>有操作</td>
                <td>{data.scrollWorld?.scrolled || 0}</td>
              </tr>
              <tr>
                <td>按關閉，而且幾乎沒操作</td>
                <td>{data.scrollWorld?.closed_idle || 0}</td>
              </tr>
              <tr>
                <td>沒按關閉就離開，而且幾乎沒操作</td>
                <td>{data.scrollWorld?.left_idle || 0}</td>
              </tr>
            </tbody>
          </Table>

          <h2 className="h5 mt-3">這趟來做什麼</h2>
          <Table bordered responsive>
            <thead>
              <tr>
                <th>目的</th>
                <th>人次</th>
                <th>佔這三項</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(INTENT_LABELS).map(([key, label]) => {
                const count = data.intents[key] || 0;
                const share = intentTotal ? `${Math.round((count / intentTotal) * 100)}%` : '—';
                return (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{count}</td>
                    <td>{share}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="text-muted small">只進首頁或其他頁面、沒有進入這三頁的人，不計在這張表。</p>

          <h2 className="h5">預約和登入的順序</h2>
          <Table bordered responsive>
            <tbody>
              {Object.entries(ORDER_LABELS).map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>{data.loginOrders[key] || 0}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <h2 className="h5">來站時段</h2>
          <p>
            近 {data.days} 天共 {data.hours.reduce((sum, item) => sum + item.count, 0)} 趟造訪。
            {peakHour?.count ? ` 最多人在 ${String(peakHour.hour).padStart(2, '0')}:00–${String(peakHour.hour).padStart(2, '0')}:59。` : ' 還沒有造訪紀錄。'}
          </p>
          <Table bordered responsive size="sm">
            <thead>
              <tr>
                <th>星期</th>
                <th>人次</th>
              </tr>
            </thead>
            <tbody>
              {data.weekdays.map((item) => (
                <tr key={item.weekday}>
                  <td>{WEEKDAY_LABELS[item.weekday]}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Table bordered responsive size="sm">
            <thead>
              <tr>
                <th>時段</th>
                <th>人次</th>
              </tr>
            </thead>
            <tbody>
              {data.hours.filter((item) => item.count > 0).map((item) => (
                <tr key={item.hour}>
                  <td>{String(item.hour).padStart(2, '0')}:00</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
}
