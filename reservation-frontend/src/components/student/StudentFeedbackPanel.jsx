import React, { useState } from 'react';
import { submitStudentFeedback } from '../../services/studentFeedbackApi';

const CATEGORIES = [
  { id: 'reservation', label: '預約或取消' },
  { id: 'survey', label: '問卷' },
  { id: 'account', label: '帳號或信箱' },
  { id: 'english_test', label: '培力報名' },
  { id: 'other', label: '其他' },
];

const CONTACT_NOTE = '上班時間（週一至週五 09:00–17:00）也可打 07-5252000 分機 5808／5876。急件請直接打電話。';

export default function StudentFeedbackPanel({ student }) {
  const [kind, setKind] = useState('problem');
  const [category, setCategory] = useState('reservation');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setReceipt('');
    try {
      const { ok, data } = await submitStudentFeedback({ kind, category, message });
      if (!ok) {
        setError(data?.message || '送出失敗，請稍後再試');
        return;
      }
      setReceipt(data?.message || '已送到中心。');
      setMessage('');
    } catch {
      setError('與伺服器連線發生錯誤');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="student-account__section" id="student-account-feedback" aria-labelledby="student-feedback-title">
      <h2 className="h6" id="student-feedback-title">遇到問題</h2>
      <p className="text-muted small mb-2">
        問題和建議都會送到英語中心，只給中心看，不會公開給其他學生。
        {CONTACT_NOTE}
      </p>
      <dl className="student-feedback__identity small mb-3">
        <div>
          <dt>學號</dt>
          <dd>{student.studentId}</dd>
        </div>
        <div>
          <dt>姓名</dt>
          <dd>{student.name}</dd>
        </div>
        <div>
          <dt>信箱</dt>
          <dd>{student.email}</dd>
        </div>
      </dl>
      <form onSubmit={handleSubmit}>
        <fieldset className="mb-3">
          <legend className="form-label mb-2">類型</legend>
          <div className="student-feedback__kinds">
            <label className="form-check-label">
              <input
                className="form-check-input me-1"
                type="radio"
                name="student-feedback-kind"
                value="problem"
                checked={kind === 'problem'}
                onChange={() => setKind('problem')}
              />
              問題回報
            </label>
            <label className="form-check-label">
              <input
                className="form-check-input me-1"
                type="radio"
                name="student-feedback-kind"
                value="wish"
                checked={kind === 'wish'}
                onChange={() => setKind('wish')}
              />
              建議／許願
            </label>
          </div>
        </fieldset>
        <div className="mb-3">
          <label className="form-label" htmlFor="student-feedback-category">
            {kind === 'wish' ? '和哪一項有關' : '問題屬於'}
          </label>
          <select
            id="student-feedback-category"
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="student-feedback-message">
            {kind === 'wish' ? '想許的願或建議' : '發生了什麼'}
          </label>
          <textarea
            id="student-feedback-message"
            className="form-control"
            rows={4}
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? '送出中…' : '送到中心'}
        </button>
        {error ? <p className="text-danger mt-3 mb-0" role="alert">{error}</p> : null}
        {receipt ? <p className="text-success mt-3 mb-0" role="status">{receipt}</p> : null}
      </form>
    </section>
  );
}
