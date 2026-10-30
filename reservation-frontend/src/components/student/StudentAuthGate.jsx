import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useCampusSso from '../../hooks/useCampusSso';

const GATES = [
  {
    match: (path) => path.startsWith('/my-reservations'),
    title: '我的預約',
    detail: '查詢和取消預約要先登入。登入後使用你的學號，不用再填姓名和信箱。取消時仍要輸入預約信裡的驗證碼。',
  },
  {
    match: (path) => path.startsWith('/student/progress'),
    title: '我的紀錄',
    detail: '活動、修課、考試和護照摘要現在只顯示登入帳號的資料。',
  },
  {
    match: (path) => path.startsWith('/student/speaking-portfolio'),
    title: '口說紀錄',
    detail: '口說紀錄只屬於登入的學號，未登入不能查看。',
  },
  {
    match: (path) => path.startsWith('/student/class-credit-allocation'),
    title: '課堂加分配置',
    detail: '課堂加分配置只屬於登入的學號。',
  },
  {
    match: (path) => path.startsWith('/register/english-test'),
    title: '培力英檢報名',
    detail: '報名、查詢和修正都要先登入。系統會使用你的學號與姓名。',
  },
  {
    match: (path) => path.startsWith('/student/account'),
    title: '我的帳號',
    detail: '查看帳號和收信信箱前，請先登入。',
  },
];

function gateFor(pathname) {
  return GATES.find((item) => item.match(pathname)) || {
    title: '這項功能',
    detail: '這項功能要先登入學生帳號才能使用。',
  };
}

export default function StudentAuthGate() {
  const location = useLocation();
  const campusSso = useCampusSso();
  const next = `${location.pathname}${location.search || ''}`;
  const gate = gateFor(location.pathname);
  const loginTo = `/student/login?next=${encodeURIComponent(next)}`;
  const registerTo = `/student/register?next=${encodeURIComponent(next)}`;
  const forgotTo = `/student/forgot-password?next=${encodeURIComponent(next)}`;

  return (
    <div className="d-flex justify-content-center py-4">
      <div className="card p-4" style={{ width: '100%', maxWidth: 520 }} role="status">
        <h1 className="h4 mb-2">請先登入學生帳號</h1>
        <p className="mb-2">
          {gate.title}
          現在需要登入才能使用。
        </p>
        <p className="text-muted small mb-3">{gate.detail}</p>
        {campusSso ? (
          <ul className="small mb-3">
            <li>用學號和中山單一入口的密碼登入。登入後會回到這個頁面。</li>
            <li>不必先建立帳號。以前在這個網站自設的密碼不能再登入。</li>
            <li>忘記密碼、預設密碼或密碼到期，請到單一入口處理。</li>
          </ul>
        ) : (
          <ul className="small mb-3">
            <li>已有帳號：登入後會回到這個頁面。</li>
            <li>還沒有帳號：用學號建立。名冊對得到就可以直接使用。</li>
            <li>忘記密碼：驗證碼會寄到註冊信箱，畫面上不會出現密碼。</li>
          </ul>
        )}
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-primary" to={loginTo}>登入</Link>
          {campusSso ? (
            <a className="btn btn-outline-primary" href="https://sso.nsysu.edu.tw">到單一入口重設密碼</a>
          ) : (
            <Link className="btn btn-outline-primary" to={registerTo}>建立帳號</Link>
          )}
        </div>
        {campusSso ? null : (
          <p className="small mt-3 mb-0">
            <Link to={forgotTo}>忘記密碼</Link>
          </p>
        )}
      </div>
    </div>
  );
}
