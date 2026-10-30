import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadStudentSession } from '../../utils/studentSession';
import { surveyBackTarget } from '../../utils/surveyExit';

export default function SurveyExitActions({
  fallback,
  showAccount = true,
  showChoice = false,
  showEvents = false,
  showHome = false,
  eventsLabel = '查看活動',
  homeLabel = '回首頁',
}) {
  const navigate = useNavigate();
  const loggedIn = Boolean(loadStudentSession()?.student);
  const resolvedFallback = fallback || (loggedIn ? '/student/account' : '/events');

  const goBack = () => {
    const target = surveyBackTarget(window.history.state, resolvedFallback);
    if (target === -1) navigate(-1);
    else navigate(target);
  };

  return (
    <div className="d-flex flex-wrap gap-2">
      <button type="button" className="btn btn-outline-secondary" onClick={goBack}>
        上一頁
      </button>
      {showChoice ? (
        <Link to="/survey/choice" className="btn btn-outline-primary">
          回問卷列表
        </Link>
      ) : null}
      {showAccount && loggedIn ? (
        <Link to="/student/account" className="btn btn-outline-primary">
          回我的帳號
        </Link>
      ) : null}
      {showEvents ? (
        <Link to="/events" className="btn btn-outline-primary">
          {eventsLabel}
        </Link>
      ) : null}
      {showHome ? (
        <Link to="/" className="btn btn-outline-secondary">
          {homeLabel}
        </Link>
      ) : null}
    </div>
  );
}
