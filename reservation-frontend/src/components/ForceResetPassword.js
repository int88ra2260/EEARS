import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import { changeTeacherPassword } from '../services/authApi';
import { getAdminRoleHomePath } from '../constants/adminNavigation';
import { consumeStaffNext } from '../utils/staffLoginNext';

function passwordChecks(password, confirmPassword) {
  const classCount = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/]
    .filter((pattern) => pattern.test(password)).length;
  return [
    { ok: password.length >= 12, label: '至少 12 碼' },
    { ok: classCount >= 3, label: '大寫、小寫、數字、符號至少三種' },
    { ok: password.length > 0 && password === confirmPassword, label: '兩次輸入相同' },
  ];
}

function ForceResetPassword() {
  const { token, mustResetPassword, setMustResetPassword } = useOutletContext();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const requireCurrent = !mustResetPassword;
  const passwordInputType = showPassword ? 'text' : 'password';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('新密碼與確認密碼不一致。');
      return;
    }

    if (requireCurrent && !currentPassword) {
      setError('請輸入目前密碼。');
      return;
    }

    try {
      setLoading(true);
      const data = await changeTeacherPassword(token, { currentPassword, newPassword });
      if (mustResetPassword && data?.token) {
        const role = data.role || localStorage.getItem('userRole') || '';
        const home = getAdminRoleHomePath({
          role,
          teacherLevel: data.teacherLevel,
          workerLevel: data.workerLevel,
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', role);
        localStorage.setItem('mustResetPassword', 'false');
        setMustResetPassword(false);
        setSuccess('密碼已更新，正在進入後台…');
        window.location.replace(consumeStaffNext() || home);
        return;
      }
      setSuccess('密碼已更新，即將帶您重新登入…');
      try {
        window.dispatchEvent(
          new CustomEvent('eears:toast', { detail: { message: '密碼已更新，請重新登入。', variant: 'success' } })
        );
      } catch (_) {
        // ignore
      }
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('username');
      localStorage.removeItem('teacherName');
      localStorage.setItem('mustResetPassword', 'false');
      setMustResetPassword(false);
      setTimeout(() => {
        window.location.href = '/login';
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <Card style={{ maxWidth: '420px', width: '100%' }}>
        <Card.Body>
          <Card.Title className="mb-3">{mustResetPassword ? '首次登入，請變更密碼' : '變更密碼'}</Card.Title>
          <Card.Text className="text-muted">
            這組密碼只給英語中心後台。學生預約請用學生登入。密碼至少 12 碼，並包含大寫、小寫、數字、符號中的至少三種。不可使用常見弱密碼，也不可包含帳號、Email 或姓名。
          </Card.Text>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id="show-password-toggle"
                label="顯示密碼"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                disabled={loading}
              />
            </Form.Group>
            {requireCurrent && (
              <Form.Group className="mb-3" controlId="staff-current-password">
                <Form.Label>目前密碼</Form.Label>
                <Form.Control
                  type={passwordInputType}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </Form.Group>
            )}
            <Form.Group className="mb-3" controlId="staff-new-password">
              <Form.Label>新密碼</Form.Label>
              <Form.Control
                type={passwordInputType}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
                required
                aria-describedby="staff-password-checklist"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="staff-confirm-password">
              <Form.Label>確認新密碼</Form.Label>
              <Form.Control
                type={passwordInputType}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
                required
              />
            </Form.Group>
            <ul id="staff-password-checklist" className="small ps-3 mb-4">
              {passwordChecks(newPassword, confirmPassword).map((item) => (
                <li key={item.label} className={item.ok ? 'text-success' : 'text-muted'}>
                  {item.ok ? '已符合：' : '尚未符合：'}{item.label}
                </li>
              ))}
            </ul>
            <Button type="submit" className="w-100" disabled={loading}>
              {loading ? '送出中...' : '更新密碼'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}

export default ForceResetPassword;


