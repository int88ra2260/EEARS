import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { loginSpeakingHost, saveSpeakingHostToken } from '../services/speakingCheckApi';
import './SpeakingHostPage.css';

export default function SpeakingHostLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await loginSpeakingHost({ username, password });
      saveSpeakingHostToken(data.token);
      navigate('/practice/speaking-host');
    } catch (err) {
      setError(err.message || '登入失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="speaking-host-page">
      <PageHeader
        breadcrumbs={[
          { label: '首頁', path: '/' },
          { label: '口說題組' },
        ]}
        title="老師登入"
        lead="登入後可以建立一組口說題、公布加入代碼，並查看學生的作答。"
      />
      <main className="container pb-5">
        <form className="speaking-host-login" onSubmit={handleSubmit}>
          <label htmlFor="speaking-host-username">帳號</label>
          <input
            id="speaking-host-username"
            className="form-control"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="speaking-host-password">密碼</label>
          <input
            id="speaking-host-password"
            className="form-control"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={submitting || !username.trim() || !password}>
            {submitting ? '登入中...' : '登入'}
          </button>
          <Link to="/practice/speaking-check">我是學生，輸入代碼加入</Link>
        </form>
      </main>
    </div>
  );
}
