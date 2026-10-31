import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import StudentAccountEmailVerification from '../../components/student/StudentAccountEmailVerification';
import {
  changeStudentNotificationEmail,
  changeStudentPassword,
} from '../../services/studentAuthApi';
import {
  fetchEnglishTestRegistrationEditEnabledPublic,
  fetchEnglishTestRegistrationEnabledPublic,
} from '../../services/settingsAdminApi';
import { saveStudentSession } from '../../utils/studentSession';
import { fetchMySemesterSurveys } from '../../services/surveyPublicApi';
import useCampusSso from '../../hooks/useCampusSso';
import useStudentSession from '../../hooks/useStudentSession';
import { safeStudentNext } from '../../utils/studentSession';
import '../../components/student/StudentRecordShell.css';

function AppIcon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    width: '28',
    height: '28',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    );
  }
  if (name === 'survey') {
    return (
      <svg {...common}>
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    );
  }
  if (name === 'list') {
    return (
      <svg {...common}>
        <path d="M9 7h11M9 12h11M9 17h11" />
        <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M4 19V5M4 19h16" />
        <path d="M8 15v4M12 10v9M16 7v12" />
      </svg>
    );
  }
  if (name === 'mic') {
    return (
      <svg {...common}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
      </svg>
    );
  }
  if (name === 'award') {
    return (
      <svg {...common}>
        <circle cx="12" cy="9" r="5" />
        <path d="M9 13.5 8 21l4-2 4 2-1-7.5" />
      </svg>
    );
  }
  if (name === 'edit') {
    return (
      <svg {...common}>
        <path d="M4 20h4L18 10l-4-4L4 16v4z" />
      </svg>
    );
  }
  if (name === 'book') {
    return (
      <svg {...common}>
        <path d="M5 4.5h6a3 3 0 0 1 3 3V20a3 3 0 0 0-3-3H5z" />
        <path d="M19 4.5h-6a3 3 0 0 0-3 3V20a3 3 0 0 1 3-3h6z" />
      </svg>
    );
  }
  if (name === 'mail') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="14" r="3.2" />
      <path d="M11 14h9M17 14v2.5M20 14v2" />
    </svg>
  );
}

const BOOKING_SHORTCUT = {
  to: '/events',
  title: '預約場次（預約活動）',
  short: '預約場次',
  detail: '選擇開放中的場次完成預約',
  icon: 'calendar',
  primary: true,
};

const BASE_SHORTCUTS = [
  { to: '/my-reservations', title: '我的預約', short: '我的預約', detail: '查看、取消即將參加的活動', icon: 'list' },
  { to: '/student/progress', title: '我的紀錄', short: '我的紀錄', detail: '出席與學習紀錄', icon: 'chart' },
  { to: '/student/speaking-portfolio', title: '口說紀錄', short: '口說紀錄', detail: '口說練習與回饋', icon: 'mic' },
  { to: '/student/class-credit-allocation', title: '課堂加分', short: '課堂加分', detail: '課堂加分配置', icon: 'award' },
  { to: '/student/english-learning-passport', title: '英語實踐歷程檔案', short: '歷程檔案', detail: '申請與通知使用這個帳號信箱', icon: 'book' },
];

const ENGLISH_TEST_SHORTCUTS = {
  register: {
    to: '/register/english-test',
    title: '培力英檢報名',
    short: '培力報名',
    detail: '現在開放報名。用登入身分帶入可填欄位',
    icon: 'edit',
  },
  edit: {
    to: '/register/english-test',
    title: '培力英檢資料修正',
    short: '資料修正',
    detail: '報名已關閉。可以查詢或修正已送出的資料',
    icon: 'edit',
  },
};

export default function StudentAccountPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useStudentSession();
  const student = session?.student;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const campusSso = useCampusSso();
  const [editingEmail, setEditingEmail] = useState(false);
  const [mailbox, setMailbox] = useState(student?.email || '');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [englishTestMode, setEnglishTestMode] = useState('hidden');
  const [surveyDetail, setSurveyDetail] = useState('查詢本學期是否已填');
  const [openPanel, setOpenPanel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchEnglishTestRegistrationEnabledPublic(),
      fetchEnglishTestRegistrationEditEnabledPublic(),
    ])
      .then(([registrationEnabled, editEnabled]) => {
        if (cancelled) return;
        if (registrationEnabled) setEnglishTestMode('register');
        else if (editEnabled) setEnglishTestMode('edit');
        else setEnglishTestMode('hidden');
      })
      .catch(() => {
        if (!cancelled) setEnglishTestMode('register');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!student?.emailVerifiedAt) return undefined;
    let cancelled = false;
    fetchMySemesterSurveys()
      .then((data) => {
        if (cancelled) return;
        const surveys = data.surveys || [];
        if (!surveys.length) {
          setSurveyDetail('目前沒有開放中的問卷');
          return;
        }
        const pending = surveys.filter((item) => item.bookingSurveyRequired && !item.filled);
        if (!pending.length) {
          const stillOpen = surveys.some((item) => !item.filled);
          setSurveyDetail(stillOpen
            ? '還沒簽到參加過的話，再次預約前不用填問卷'
            : '本學期都已填');
          return;
        }
        setSurveyDetail(`再次預約前需填：${pending.map((item) => item.surveyName).join('、')}`);
      })
      .catch(() => {
        if (!cancelled) setSurveyDetail('查看本學期問卷與填寫狀態');
      });
    return () => {
      cancelled = true;
    };
  }, [student?.emailVerifiedAt]);

  const shortcuts = [
    BOOKING_SHORTCUT,
    {
      to: '/survey/choice',
      title: '本學期問卷',
      short: '本學期問卷',
      detail: surveyDetail,
      icon: 'survey',
    },
    ...BASE_SHORTCUTS.slice(0, 4),
    ...(englishTestMode === 'hidden' ? [] : [ENGLISH_TEST_SHORTCUTS[englishTestMode]]),
    BASE_SHORTCUTS[4],
  ];

  const togglePanel = (panel) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setEmailSubmitting(true);
    setEmailError('');
    setEmailNotice('');
    try {
      const { ok, data } = await changeStudentNotificationEmail({
        email: mailbox,
        emailVerificationToken,
      });
      if (!ok || !data?.token || !data?.student) {
        setEmailError(data?.message || '無法更新信箱');
        return;
      }
      saveStudentSession({ token: data.token, student: data.student });
      setMailbox(data.student.email);
      setEmailVerificationToken('');
      setVerifiedEmail('');
      setEditingEmail(false);
      const wasActivation = !student.emailVerifiedAt;
      setEmailNotice(wasActivation
        ? '信箱已確認，帳號已啟動。之後的通知會寄到這個信箱。'
        : '收信信箱已更新。之後的通知會寄到這個信箱。');
      if (wasActivation) {
        const next = safeStudentNext(params.get('next') || '');
        if (next && next !== '/student/account') navigate(next);
      }
    } catch {
      setEmailError('與伺服器連線發生錯誤');
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { ok, data } = await changeStudentPassword({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      });
      if (!ok) {
        setError(data?.message || '無法更新密碼');
        return;
      }
      navigate('/student/login?notice=password-updated&next=%2Fstudent%2Faccount', { replace: true });
    } catch {
      setError('與伺服器連線發生錯誤');
    } finally {
      setSubmitting(false);
    }
  };

  if (!student) return null;
  const needsActivation = !student.emailVerifiedAt;

  return (
    <div className="student-account">
      <header className="student-account__hero">
        <div>
          <h1 className="student-account__name">{student.name}</h1>
          <p className="student-account__id">{student.studentId}</p>
        </div>
        <p className="student-account__mailbox">{student.email}</p>
      </header>

      {needsActivation ? (
        <p className="student-account__section text-muted small mb-3" role="status">
          帳號還沒啟動。單一入口帶入的信箱不一定是你平常會看的信箱。請確認或改成你會收的信箱，再到信箱收驗證碼。啟動前不能預約，也不能查看個人紀錄。
        </p>
      ) : null}

      <nav className="student-account__launcher" aria-label="帳號功能">
        {needsActivation ? null : shortcuts.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`student-account__app${item.primary ? ' student-account__app--primary' : ''}`}
            aria-label={`${item.title}。${item.detail}`}
          >
            <span className="student-account__app-icon">
              <AppIcon name={item.icon} />
              {item.to === '/survey/choice' && surveyDetail.startsWith('再次預約前需填') ? (
                <span className="student-account__app-dot" aria-hidden="true" />
              ) : null}
            </span>
            <span className="student-account__app-label">{item.short}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`student-account__app${openPanel === 'email' ? ' is-open' : ''}`}
          aria-expanded={openPanel === 'email'}
          onClick={() => togglePanel('email')}
        >
          <span className="student-account__app-icon">
            <AppIcon name="mail" />
          </span>
          <span className="student-account__app-label">通知信箱</span>
        </button>
        <button
          type="button"
          className={`student-account__app${openPanel === 'login' ? ' is-open' : ''}`}
          aria-expanded={openPanel === 'login'}
          onClick={() => togglePanel('login')}
        >
          <span className="student-account__app-icon">
            <AppIcon name="key" />
          </span>
          <span className="student-account__app-label">登入方式</span>
        </button>
      </nav>

      {needsActivation || openPanel === 'email' ? (
      <section className="student-account__section" id="student-account-email">
        <h2 className="h6">{needsActivation ? '啟動帳號' : '通知信箱'}</h2>
        <p className="text-muted small mb-2">
          {needsActivation
            ? '驗證碼會寄到下面這個信箱。若這不是你平常使用的信箱，先改成你會看的再寄出。'
            : campusSso
              ? '預約、培力與歷程檔案的通知寄到這個信箱。它可以和單一入口的信箱不同。'
              : '預約、培力與歷程檔案的通知寄到這個信箱。'}
        </p>
        {emailNotice ? <p className="text-success small">{emailNotice}</p> : null}
        {needsActivation || editingEmail ? (
          <form onSubmit={handleEmailSubmit}>
            <label className="form-label" htmlFor="student-mailbox">
              {needsActivation ? '收信信箱' : '新的信箱'}
            </label>
            <input
              id="student-mailbox"
              className="form-control mb-3"
              type="email"
              value={mailbox}
              onChange={(e) => setMailbox(e.target.value)}
              autoComplete="email"
              required
            />
            <StudentAccountEmailVerification
              email={mailbox}
              studentId={student.studentId}
              emailVerificationToken={emailVerificationToken}
              verifiedEmail={verifiedEmail}
              hint={needsActivation
                ? '驗證碼約 10 分鐘內有效。確認後即可按「啟動帳號」。'
                : '驗證碼約 10 分鐘內有效。確認後才會更新收信信箱。'}
              verifiedMessage={needsActivation ? '信箱已驗證，可以啟動帳號' : '信箱已驗證，可以更新收信信箱'}
              onVerified={({ token, verifiedEmail: nextEmail }) => {
                setEmailVerificationToken(token || '');
                setVerifiedEmail(nextEmail || '');
              }}
            />
            <div className="d-flex gap-2 mt-3">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={emailSubmitting || !emailVerificationToken || verifiedEmail !== mailbox.trim().toLowerCase()}
              >
                {emailSubmitting ? '確認中…' : (needsActivation ? '啟動帳號' : '更新收信信箱')}
              </button>
              {needsActivation ? null : (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => {
                    setEditingEmail(false);
                    setMailbox(student.email);
                    setEmailError('');
                  }}
                >
                  取消
                </button>
              )}
            </div>
            {emailError ? <p className="text-danger mt-3 mb-0">{emailError}</p> : null}
          </form>
        ) : (
          <button className="btn btn-outline-primary" type="button" onClick={() => setEditingEmail(true)}>
            更換收信信箱
          </button>
        )}
      </section>
      ) : null}

      {openPanel === 'login' ? (
      <section className="student-account__section" id="student-account-login">
        <h2 className="h6">登入方式</h2>
        {campusSso ? (
          <>
            <p className="text-muted small">登入密碼是中山單一入口的密碼。學號與姓名也來自單一入口。</p>
            <a className="btn btn-outline-primary" href="https://sso.nsysu.edu.tw">到單一入口改密碼</a>
          </>
        ) : (
          <>
            <p className="text-muted small">更新後會登出，請用新密碼重新登入。</p>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="student-current-password">目前密碼</label>
                <input id="student-current-password" className="form-control" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="student-new-password">新密碼</label>
                <input id="student-new-password" className="form-control" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="student-new-password-2">再輸入一次新密碼</label>
                <input id="student-new-password-2" className="form-control" type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} autoComplete="new-password" required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? '更新中…' : '更新密碼'}
              </button>
            </form>
            {error ? <p className="text-danger mt-3 mb-0">{error}</p> : null}
          </>
        )}
      </section>
      ) : null}
    </div>
  );
}
