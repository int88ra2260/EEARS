import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import {
  downloadSpeakingDiagnosticResearchCsv,
  createSpeakingDiagnosticAdminTask,
  fetchSpeakingDiagnosticAdminTasks,
  fetchSpeakingDiagnosticEcosystemSummary,
  fetchSpeakingDiagnosticAttempts,
  fetchSpeakingDiagnosticResearchSummary,
  recomputeSpeakingDiagnosticAlignment,
  recomputeSpeakingDiagnosticAlignmentBatch,
  saveSpeakingDiagnosticRating,
  updateSpeakingDiagnosticAdminTask,
} from '../../services/speakingDiagnosticApi';
import '../SpeakingDiagnosticPage.css';
import './SpeakingDiagnosticAdminPage.css';

const RUBRIC_FIELDS = [
  ['fluency', 'Fluency'],
  ['pronunciationIntelligibility', 'Pronunciation / intelligibility'],
  ['grammar', 'Grammar'],
  ['vocabulary', 'Vocabulary'],
  ['taskAchievement', 'Task achievement'],
];

const EMPTY_TASK_FORM = {
  taskKey: '',
  level: 'B1',
  taskType: 'campus_short_answer',
  title: '',
  prompt: '',
  targetText: '',
  estimatedSeconds: 45,
  targetWords: 55,
  discipline: 'General EMI',
  communicationFunction: 'define_concept',
  targetVocabularyText: '',
  focusTagsText: 'ESAP, EMI',
  constructTagsText: 'task_achievement, vocabulary, fluency',
  teacherGoal: '',
  linkedCourse: '',
  linkedActivity: '',
  suggestedSupportsText: 'English Table, 1-on-1 Consultation',
  teacherNotes: '',
  isActive: true,
};

const COMMUNICATION_FUNCTION_LABELS = {
  read_aloud: 'Read aloud',
  define_concept: 'Define a concept',
  explain_process: 'Explain a process',
  summarize_lecture: 'Summarize lecture',
  ask_clarification: 'Ask clarification',
  give_opinion: 'Give opinion',
  describe_project: 'Describe project',
  compare_ideas: 'Compare ideas',
  presentation_microtask: 'Mini presentation',
};

function splitListText(value) {
  return String(value || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function taskToForm(task) {
  if (!task) return EMPTY_TASK_FORM;
  return {
    taskKey: task.taskKey || '',
    level: task.level || 'B1',
    taskType: task.taskType || 'campus_short_answer',
    title: task.title || '',
    prompt: task.prompt || '',
    targetText: task.targetText || '',
    estimatedSeconds: task.estimatedSeconds || 45,
    targetWords: task.targetWords || 55,
    discipline: task.discipline || 'General EMI',
    communicationFunction: task.communicationFunction || 'define_concept',
    targetVocabularyText: joinList(task.targetVocabulary),
    focusTagsText: joinList(task.focusTags),
    constructTagsText: joinList(task.constructTags),
    teacherGoal: task.teacherGoal || '',
    linkedCourse: task.linkedCourse || '',
    linkedActivity: task.linkedActivity || '',
    suggestedSupportsText: joinList(task.suggestedSupports),
    teacherNotes: task.teacherNotes || '',
    isActive: task.isActive !== false,
  };
}

function buildTaskPayload(form) {
  return {
    taskKey: form.taskKey,
    level: form.level,
    taskType: form.taskType,
    title: form.title,
    prompt: form.prompt,
    targetText: form.targetText,
    estimatedSeconds: Number(form.estimatedSeconds),
    targetWords: Number(form.targetWords),
    discipline: form.discipline,
    communicationFunction: form.communicationFunction,
    targetVocabulary: splitListText(form.targetVocabularyText),
    focusTags: splitListText(form.focusTagsText),
    constructTags: splitListText(form.constructTagsText),
    teacherGoal: form.teacherGoal,
    linkedCourse: form.linkedCourse,
    linkedActivity: form.linkedActivity,
    suggestedSupports: splitListText(form.suggestedSupportsText),
    teacherNotes: form.teacherNotes,
    isActive: form.isActive,
  };
}

function validateTaskForm(form) {
  if (!form.title.trim()) return '請輸入題目標題';
  if (!form.prompt.trim() || form.prompt.trim().length < 8) return '請輸入至少 8 個字元的 prompt';
  if (!form.targetText.trim() || form.targetText.trim().length < 8) return '請輸入目標回答或朗讀文字';
  if (!Number.isFinite(Number(form.estimatedSeconds)) || Number(form.estimatedSeconds) < 5) return '建議秒數至少 5 秒';
  if (!Number.isFinite(Number(form.targetWords)) || Number(form.targetWords) < 1) return '目標字數至少 1';
  return '';
}

function formatDate(value) {
  if (!value) return '--';
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatPercent(value) {
  if (value == null || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return `${Math.round(n)}%`;
}

function formatNumber(value) {
  if (value == null || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatDecimal(value) {
  if (value == null || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return n.toFixed(2);
}

function mediaUrl(url) {
  if (!url) return '';
  if (!url.startsWith('/')) return url;
  if (window.location.port === '3001' && url.startsWith('/uploads')) {
    return `http://localhost:3000${url}`;
  }
  return url;
}

function ScorePill({ label, value }) {
  return (
    <div className="sd-admin-score-pill">
      <strong>{formatPercent(value)}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function SpeakingDiagnosticAdminPage() {
  const token = localStorage.getItem('token') || '';
  const [attempts, setAttempts] = useState([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [studentId, setStudentId] = useState('');
  const [ratingStatus, setRatingStatus] = useState('');
  const [summary, setSummary] = useState(null);
  const [ecosystemSummary, setEcosystemSummary] = useState(null);
  const [adminTasks, setAdminTasks] = useState([]);
  const [taskFilters, setTaskFilters] = useState({ q: '', level: '', taskType: '', active: '' });
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [editingTaskKey, setEditingTaskKey] = useState('');
  const [activeTab, setActiveTab] = useState('ecosystem');
  const [loading, setLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState({
    fluency: '',
    pronunciationIntelligibility: '',
    grammar: '',
    vocabulary: '',
    taskAchievement: '',
    comments: '',
  });

  const selected = useMemo(
    () => attempts.find((item) => item.attemptUid === selectedUid) || attempts[0] || null,
    [attempts, selectedUid],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, summaryData, ecosystemData] = await Promise.all([
        fetchSpeakingDiagnosticAttempts(token, { limit: 100, studentId, ratingStatus }),
        fetchSpeakingDiagnosticResearchSummary(token, { limit: 1000 }),
        fetchSpeakingDiagnosticEcosystemSummary(token, { limit: 1000 }),
      ]);
      setAttempts(Array.isArray(data) ? data : []);
      setSummary(summaryData || null);
      setEcosystemSummary(ecosystemData || null);
      setSelectedUid((prev) => (data || []).some((row) => row.attemptUid === prev) ? prev : data?.[0]?.attemptUid || '');
    } catch (err) {
      setAttempts([]);
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [studentId, ratingStatus, token]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setError('');
    try {
      const data = await fetchSpeakingDiagnosticAdminTasks(token, { limit: 200, ...taskFilters });
      setAdminTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch (err) {
      setAdminTasks([]);
      setError(err.message || '載入 ESAP 題庫失敗');
    } finally {
      setTasksLoading(false);
    }
  }, [taskFilters, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const existing = selected?.humanRatings?.[0];
    setRating({
      fluency: existing?.fluency || '',
      pronunciationIntelligibility: existing?.pronunciationIntelligibility || '',
      grammar: existing?.grammar || '',
      vocabulary: existing?.vocabulary || '',
      taskAchievement: existing?.taskAchievement || '',
      comments: existing?.comments || '',
    });
  }, [selected?.attemptUid, selected?.humanRatings]);

  const saveRating = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveSpeakingDiagnosticRating(token, selected.attemptUid, rating);
      setMessage('已儲存老師評分');
      await load();
    } catch (err) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    setMessage('');
    try {
      const blob = await downloadSpeakingDiagnosticResearchCsv(token, { ratingStatus });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `speaking-diagnostic-research-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('已下載研究資料 CSV');
    } catch (err) {
      setError(err.message || '下載失敗');
    } finally {
      setExporting(false);
    }
  };

  const recomputeSelected = async () => {
    if (!selected) return;
    setRecomputing(true);
    setError('');
    setMessage('');
    try {
      const data = await recomputeSpeakingDiagnosticAlignment(token, selected.attemptUid);
      const status = data?.alignment?.status || '--';
      const wordCount = data?.alignment?.words?.length ?? 0;
      const phoneCount = data?.alignment?.phones?.length ?? 0;
      setMessage(`已重新計算：${status}，${wordCount} words，${phoneCount} phones`);
      await load();
    } catch (err) {
      setError(err.message || '重新計算失敗');
    } finally {
      setRecomputing(false);
    }
  };

  const recomputeBatch = async () => {
    setRecomputing(true);
    setError('');
    setMessage('');
    try {
      const data = await recomputeSpeakingDiagnosticAlignmentBatch(token, {
        limit: 25,
        studentId,
      });
      setMessage(`批次重算完成：processed ${data?.processed ?? 0}，aligned ${data?.aligned ?? 0}，failed ${data?.failed ?? 0}`);
      await load();
    } catch (err) {
      setError(err.message || '批次重新計算失敗');
    } finally {
      setRecomputing(false);
    }
  };

  const resetTaskForm = () => {
    setEditingTaskKey('');
    setTaskForm(EMPTY_TASK_FORM);
  };

  const editTask = (task) => {
    setEditingTaskKey(task.taskKey);
    setTaskForm(taskToForm(task));
    setActiveTab('tasks');
  };

  const saveTask = async () => {
    const validation = validateTaskForm(taskForm);
    if (validation) {
      setError(validation);
      return;
    }
    setSavingTask(true);
    setError('');
    setMessage('');
    try {
      const payload = buildTaskPayload(taskForm);
      if (editingTaskKey) {
        await updateSpeakingDiagnosticAdminTask(token, editingTaskKey, payload);
        setMessage('已更新 ESAP 口說題目');
      } else {
        await createSpeakingDiagnosticAdminTask(token, payload);
        setMessage('已建立 ESAP 口說題目');
      }
      resetTaskForm();
      await Promise.all([loadTasks(), load()]);
    } catch (err) {
      setError(err.message || '儲存 ESAP 題目失敗');
    } finally {
      setSavingTask(false);
    }
  };

  const toggleTaskActive = async (task) => {
    setSavingTask(true);
    setError('');
    setMessage('');
    try {
      await updateSpeakingDiagnosticAdminTask(token, task.taskKey, { isActive: task.isActive === false });
      setMessage(task.isActive === false ? '題目已啟用' : '題目已停用');
      await loadTasks();
    } catch (err) {
      setError(err.message || '更新題目狀態失敗');
    } finally {
      setSavingTask(false);
    }
  };

  const scores = selected?.presentationScores || selected?.automatedScores?.presentationScores || {};
  const wordResults = selected?.wordResults || selected?.features?.wordResults || [];
  const alignment = selected?.alignment || selected?.features?.alignment || null;
  const alignmentWords = Array.isArray(alignment?.words) ? alignment.words : [];
  const alignmentPhones = Array.isArray(alignment?.phones) ? alignment.phones : [];
  const wordAcousticStatus = selected?.features?.wordAcousticEvidence?.status;
  const phonemeStatus = selected?.features?.phonemeEvidence?.status;
  const pronunciationConfidenceStatus = selected?.features?.pronunciationConfidenceEvidence?.status;
  const constructedStatus = selected?.task?.taskType === 'read_aloud' ? 'read_aloud_not_applicable' : selected?.features?.constructedResponseEvidence ? 'available' : 'missing';

  return (
    <div className="sd-admin-page">
      <div className="sd-admin-header">
        <div>
          <h1>口說診斷紀錄</h1>
          <p>查看 read-aloud attempts、機器 evidence，並依 A2-B2 analytical rubric 進行人評校準。</p>
        </div>
        <div className="sd-admin-filter">
          <input
            className="form-control"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="依學號篩選"
          />
          <select
            className="form-select"
            value={ratingStatus}
            onChange={(event) => setRatingStatus(event.target.value)}
            aria-label="評分狀態"
          >
            <option value="">全部評分狀態</option>
            <option value="unrated">待評</option>
            <option value="single_rated">已單評</option>
            <option value="double_rated">已雙評</option>
          </select>
          <button className="btn btn-outline-primary" type="button" onClick={load} disabled={loading}>
            查詢
          </button>
          <button className="btn btn-outline-success" type="button" onClick={exportCsv} disabled={exporting}>
            {exporting ? '匯出中...' : '匯出 CSV'}
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={recomputeBatch} disabled={recomputing}>
            {recomputing ? '重算中...' : '批次重算'}
          </button>
        </div>
      </div>

      {summary ? (
        <section className="sd-admin-summary">
          <div><strong>{summary.sample?.attempts ?? 0}</strong><span>attempts</span></div>
          <div><strong>{summary.sample?.students ?? 0}</strong><span>students</span></div>
          <div><strong>{summary.sample?.ratingStatusCounts?.unrated ?? 0}</strong><span>待評</span></div>
          <div><strong>{summary.sample?.ratingStatusCounts?.double_rated ?? 0}</strong><span>已雙評</span></div>
          <div><strong>{formatDecimal(summary.reliability?.byField?.fluency?.adjacentAgreement)}</strong><span>fluency adjacent</span></div>
          <div><strong>{formatDecimal(summary.featureCorrelations?.fluencyPercent?.pearsonR)}</strong><span>feature-human r</span></div>
        </section>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="sd-admin-tabs" role="tablist" aria-label="口說診斷工作區">
        {[
          ['ecosystem', 'EMI 成效總覽'],
          ['tasks', 'ESAP 題庫管理'],
          ['attempts', '作答與人評'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? 'sd-admin-tab sd-admin-tab--active' : 'sd-admin-tab'}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'ecosystem' ? (
        <section className="sd-admin-panel">
          <div className="sd-admin-panel__head">
            <div>
              <h2>EMI 學習生態成效</h2>
              <p>把口說弱點、ESAP 任務、中心活動與後續追蹤放在同一張工作台。</p>
            </div>
            <button className="btn btn-outline-primary btn-sm" type="button" onClick={load} disabled={loading}>
              {loading ? '更新中...' : '更新資料'}
            </button>
          </div>
          {!ecosystemSummary && loading ? (
            <div className="text-center py-4"><Spinner animation="border" size="sm" /> 載入中</div>
          ) : null}
          {ecosystemSummary ? (
            <>
              <div className="sd-admin-ecosystem-grid">
                <div><strong>{ecosystemSummary.sample?.attempts ?? 0}</strong><span>診斷作答</span></div>
                <div><strong>{ecosystemSummary.sample?.students ?? 0}</strong><span>學生數</span></div>
                <div><strong>{ecosystemSummary.sample?.ratedAttempts ?? 0}</strong><span>已有人評</span></div>
                <div><strong>{ecosystemSummary.recommendedSupports?.[0]?.support || '--'}</strong><span>目前最需要支援</span></div>
              </div>
              <div className="sd-admin-insight-grid">
                <section>
                  <h3>A2-B2 常見弱點</h3>
                  {Object.entries(ecosystemSummary.weakConstructs || {}).map(([key, value]) => (
                    <div className="sd-admin-bar-row" key={key}>
                      <span>{key}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </section>
                <section>
                  <h3>中心活動需求</h3>
                  {ecosystemSummary.recommendedSupports?.length ? ecosystemSummary.recommendedSupports.slice(0, 6).map((row) => (
                    <div className="sd-admin-bar-row" key={row.support}>
                      <span>{row.support}</span>
                      <strong>{row.demand}</strong>
                    </div>
                  )) : <p className="text-muted small mb-0">尚未累積足夠作答資料。</p>}
                </section>
                <section>
                  <h3>溝通任務表現</h3>
                  {ecosystemSummary.byCommunicationFunction?.slice(0, 6).map((row) => (
                    <div className="sd-admin-bar-row" key={row.key}>
                      <span>{COMMUNICATION_FUNCTION_LABELS[row.key] || row.key}</span>
                      <strong>{formatPercent(row.averageOverallPercent)}</strong>
                    </div>
                  ))}
                </section>
              </div>
              <div className="sd-admin-data-table">
                <div className="sd-admin-data-table__head">
                  <span>活動/支援</span>
                  <span>作答</span>
                  <span>學生</span>
                  <span>Fluency</span>
                  <span>Task</span>
                  <span>Vocabulary</span>
                </div>
                {(ecosystemSummary.byActivity || []).slice(0, 12).map((row) => (
                  <div className="sd-admin-data-table__row" key={row.key}>
                    <span>{row.key}</span>
                    <span>{row.attempts}</span>
                    <span>{row.students}</span>
                    <span>{formatPercent(row.averageFluencyPercent)}</span>
                    <span>{formatPercent(row.averageTaskAchievementPercent)}</span>
                    <span>{formatPercent(row.averageVocabularyPercent)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : !loading ? (
            <div className="text-muted small p-3">尚無 ecosystem evidence。學生送出錄音後會開始累積。</div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'tasks' ? (
        <section className="sd-admin-panel">
          <div className="sd-admin-panel__head">
            <div>
              <h2>ESAP / EMI 題庫管理</h2>
              <p>建立能對齊課程、活動與學科語彙的口說任務。</p>
            </div>
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={resetTaskForm}>
              新增題目
            </button>
          </div>
          <div className="sd-admin-task-workspace">
            <form className="sd-admin-task-form" onSubmit={(event) => { event.preventDefault(); saveTask(); }}>
              <h3>{editingTaskKey ? '編輯題目' : '新增題目'}</h3>
              <div className="sd-admin-form-grid">
                <label><span>Task key</span><input className="form-control" value={taskForm.taskKey} disabled={Boolean(editingTaskKey)} onChange={(event) => setTaskForm((prev) => ({ ...prev, taskKey: event.target.value }))} placeholder="esap-b1-define-concept" /></label>
                <label><span>Level</span><select className="form-select" value={taskForm.level} onChange={(event) => setTaskForm((prev) => ({ ...prev, level: event.target.value }))}><option>A2</option><option>B1</option><option>B2</option></select></label>
                <label><span>Task type</span><select className="form-select" value={taskForm.taskType} onChange={(event) => setTaskForm((prev) => ({ ...prev, taskType: event.target.value }))}><option value="read_aloud">read_aloud</option><option value="campus_short_answer">campus_short_answer</option><option value="picture_description">picture_description</option><option value="opinion_response">opinion_response</option></select></label>
                <label><span>Communication</span><select className="form-select" value={taskForm.communicationFunction} onChange={(event) => setTaskForm((prev) => ({ ...prev, communicationFunction: event.target.value }))}>{Object.entries(COMMUNICATION_FUNCTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Title</span><input className="form-control" value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} /></label>
                <label><span>Discipline</span><input className="form-control" value={taskForm.discipline} onChange={(event) => setTaskForm((prev) => ({ ...prev, discipline: event.target.value }))} /></label>
                <label><span>Linked course</span><input className="form-control" value={taskForm.linkedCourse} onChange={(event) => setTaskForm((prev) => ({ ...prev, linkedCourse: event.target.value }))} /></label>
                <label><span>Linked activity</span><input className="form-control" value={taskForm.linkedActivity} onChange={(event) => setTaskForm((prev) => ({ ...prev, linkedActivity: event.target.value }))} /></label>
              </div>
              <label><span>Prompt</span><textarea className="form-control" rows={3} value={taskForm.prompt} onChange={(event) => setTaskForm((prev) => ({ ...prev, prompt: event.target.value }))} /></label>
              <label><span>Target answer / read-aloud text</span><textarea className="form-control" rows={3} value={taskForm.targetText} onChange={(event) => setTaskForm((prev) => ({ ...prev, targetText: event.target.value }))} /></label>
              <div className="sd-admin-form-grid">
                <label><span>Estimated seconds</span><input className="form-control" type="number" min="5" max="180" value={taskForm.estimatedSeconds} onChange={(event) => setTaskForm((prev) => ({ ...prev, estimatedSeconds: event.target.value }))} /></label>
                <label><span>Target words</span><input className="form-control" type="number" min="1" max="500" value={taskForm.targetWords} onChange={(event) => setTaskForm((prev) => ({ ...prev, targetWords: event.target.value }))} /></label>
              </div>
              <label><span>Target vocabulary</span><textarea className="form-control" rows={2} value={taskForm.targetVocabularyText} onChange={(event) => setTaskForm((prev) => ({ ...prev, targetVocabularyText: event.target.value }))} placeholder="用逗號或換行分隔" /></label>
              <label><span>Teacher goal</span><textarea className="form-control" rows={2} value={taskForm.teacherGoal} onChange={(event) => setTaskForm((prev) => ({ ...prev, teacherGoal: event.target.value }))} /></label>
              <div className="sd-admin-form-grid">
                <label><span>Focus tags</span><input className="form-control" value={taskForm.focusTagsText} onChange={(event) => setTaskForm((prev) => ({ ...prev, focusTagsText: event.target.value }))} /></label>
                <label><span>Construct tags</span><input className="form-control" value={taskForm.constructTagsText} onChange={(event) => setTaskForm((prev) => ({ ...prev, constructTagsText: event.target.value }))} /></label>
              </div>
              <label><span>Suggested supports</span><input className="form-control" value={taskForm.suggestedSupportsText} onChange={(event) => setTaskForm((prev) => ({ ...prev, suggestedSupportsText: event.target.value }))} /></label>
              <label className="sd-admin-checkbox"><input type="checkbox" checked={taskForm.isActive} onChange={(event) => setTaskForm((prev) => ({ ...prev, isActive: event.target.checked }))} /> 啟用題目</label>
              <div className="sd-admin-form-actions">
                <button className="btn btn-primary" type="submit" disabled={savingTask}>{savingTask ? '儲存中...' : '儲存題目'}</button>
                <button className="btn btn-outline-secondary" type="button" onClick={resetTaskForm}>清空</button>
              </div>
            </form>
            <div className="sd-admin-task-list">
              <div className="sd-admin-task-filters">
                <input className="form-control" placeholder="搜尋題目/課程/活動" value={taskFilters.q} onChange={(event) => setTaskFilters((prev) => ({ ...prev, q: event.target.value }))} />
                <select className="form-select" value={taskFilters.level} onChange={(event) => setTaskFilters((prev) => ({ ...prev, level: event.target.value }))}><option value="">全部程度</option><option>A2</option><option>B1</option><option>B2</option></select>
                <select className="form-select" value={taskFilters.active} onChange={(event) => setTaskFilters((prev) => ({ ...prev, active: event.target.value }))}><option value="">全部狀態</option><option value="true">啟用</option><option value="false">停用</option></select>
              </div>
              {tasksLoading ? <div className="text-center py-4"><Spinner animation="border" size="sm" /> 載入題庫中</div> : null}
              {!tasksLoading && !adminTasks.length ? <div className="text-muted small p-3">尚無符合條件的題目。</div> : null}
              {adminTasks.map((task) => (
                <article className="sd-admin-task-card" key={task.taskKey}>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.level} · {task.taskType} · {task.discipline || 'General'} · {COMMUNICATION_FUNCTION_LABELS[task.communicationFunction] || task.communicationFunction || '--'}</small>
                    <p>{task.prompt}</p>
                    <div className="sd-admin-chipline">
                      {(task.targetVocabulary || []).slice(0, 8).map((word) => <span key={word}>{word}</span>)}
                    </div>
                  </div>
                  <div className="sd-admin-task-card__stats">
                    <span>{task.usage?.attempts ?? 0} attempts</span>
                    <span>{formatPercent(task.usage?.averageOverallPercent)} avg</span>
                    <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => editTask(task)}>編輯</button>
                    <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => toggleTaskActive(task)} disabled={savingTask}>{task.isActive === false ? '啟用' : '停用'}</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'attempts' ? (
      <div className="sd-admin-layout">
        <aside className="sd-admin-list">
          {loading ? (
            <div className="text-center py-4"><Spinner animation="border" size="sm" /> 載入中</div>
          ) : null}
          {!loading && attempts.length === 0 ? (
            <div className="text-muted small p-3">尚無口說診斷紀錄。學生送出錄音後會出現在這裡。</div>
          ) : null}
          {attempts.map((attempt) => {
            const active = attempt.attemptUid === selected?.attemptUid;
            const attemptScores = attempt.presentationScores || attempt.automatedScores?.presentationScores || {};
            return (
              <button
                type="button"
                key={attempt.attemptUid}
                className={`sd-admin-attempt${active ? ' sd-admin-attempt--active' : ''}`}
                onClick={() => setSelectedUid(attempt.attemptUid)}
              >
                <span className="sd-admin-attempt__score">{formatPercent(attemptScores.overallPercent)}</span>
                <span>
                  <strong>{attempt.task?.title || 'Untitled task'}</strong>
                  <small>{attempt.studentId || 'anonymous'} · {formatDate(attempt.submittedAt)} · {attempt.ratingCount || 0} rating(s)</small>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="sd-admin-detail">
          {!selected ? (
            <div className="text-muted p-4">請選擇一筆紀錄。</div>
          ) : (
            <>
              <div className="sd-admin-detail__top">
                <div>
                  <div className="sd-admin-kicker">{selected.task?.level} · {selected.task?.taskType}</div>
                  <h2>{selected.task?.title}</h2>
                  <p>{selected.task?.targetText}</p>
                  <div className="sd-admin-rating-status">
                    {selected.ratingStatus === 'double_rated' ? '已雙評' : selected.ratingStatus === 'single_rated' ? '已單評，建議補第二位老師' : '待老師評分'}
                  </div>
                  <button
                    className="btn btn-sm btn-outline-secondary mt-2"
                    type="button"
                    onClick={recomputeSelected}
                    disabled={recomputing}
                  >
                    {recomputing ? '重算中...' : '重新計算 alignment'}
                  </button>
                </div>
                <div className="sd-admin-big-score">
                  <strong>{formatPercent(scores.overallPercent)}</strong>
                  <span>overall</span>
                </div>
              </div>

              <div className="sd-admin-scores">
                <ScorePill label="Completion" value={scores.completionPercent} />
                <ScorePill label="Pronunciation" value={scores.pronunciationPercent} />
                <ScorePill label="Fluency" value={scores.fluencyPercent} />
                <ScorePill label="Pace" value={scores.pacePercent} />
                <ScorePill label="Pause control" value={scores.pauseControlPercent} />
                <ScorePill label="Task achievement" value={scores.taskAchievementPercent} />
                <ScorePill label="Idea development" value={scores.ideaDevelopmentPercent} />
              </div>

              <audio className="sd-admin-audio" controls src={mediaUrl(selected.audioUrl)}>
                <track kind="captions" />
              </audio>

              <div className="sd-admin-evidence-table">
                <div><span>Speech WPM</span><strong>{formatNumber(selected.features?.speechRateWpm)}</strong></div>
                <div><span>Articulation WPM</span><strong>{formatNumber(selected.features?.articulationRateWpm)}</strong></div>
                <div><span>Pause count</span><strong>{selected.features?.pauseCount ?? '--'}</strong></div>
                <div><span>Avg pause</span><strong>{formatNumber((selected.features?.averagePauseDurationMs || 0) / 1000)}s</strong></div>
                <div><span>Word acoustic</span><strong>{formatDecimal(selected.features?.wordAcousticEvidence?.summary?.averageWordAcousticScore)}</strong></div>
                <div><span>Low-conf words</span><strong>{selected.features?.wordAcousticEvidence?.summary?.lowConfidenceCount ?? '--'}</strong></div>
                <div><span>Phones</span><strong>{selected.features?.phonemeEvidence?.summary?.phoneCount ?? '--'}</strong></div>
                <div><span>Phone confidence</span><strong>{formatDecimal(selected.features?.phonemeEvidence?.summary?.averagePhoneConfidence)}</strong></div>
                <div><span>GOP status</span><strong>{pronunciationConfidenceStatus || '--'}</strong></div>
                <div><span>Alignment status</span><strong>{alignment?.status || '--'}</strong></div>
                <div><span>Lexical diversity</span><strong>{formatNumber(selected.features?.transcriptEvidence?.lexicalDiversity)}</strong></div>
                <div><span>Sophistication</span><strong>{formatNumber(selected.features?.transcriptEvidence?.lexicalSophistication)}</strong></div>
                <div><span>Fillers</span><strong>{selected.features?.transcriptEvidence?.fillerCount ?? 0}</strong></div>
                <div><span>Repetitions</span><strong>{selected.features?.transcriptEvidence?.repetitionCount ?? 0}</strong></div>
                <div><span>Task relevance</span><strong>{formatDecimal(selected.features?.constructedResponseEvidence?.taskRelevanceProxy)}</strong></div>
                <div><span>Idea development</span><strong>{formatDecimal(selected.features?.constructedResponseEvidence?.ideaDevelopmentProxy)}</strong></div>
              </div>
              <div className="text-muted small mt-2">
                Evidence status: word acoustic {wordAcousticStatus || '--'} · phoneme {phonemeStatus || '--'} · GOP {pronunciationConfidenceStatus || '--'} · constructed response {constructedStatus}
              </div>

              <div className="sd-admin-wordline">
                {wordResults.map((word) => (
                  <span
                    key={`${word.index}-${word.word}`}
                    className={`speaking-word speaking-word--${word.status}`}
                  >
                    {word.word}
                  </span>
                ))}
              </div>

              <div className="sd-admin-alignment-grid">
                <section>
                  <h3>Alignment words</h3>
                  {alignmentWords.length ? (
                    <div className="sd-admin-token-table">
                      {alignmentWords.slice(0, 80).map((word, index) => (
                        <span key={`${word.word}-${word.startMs}-${index}`}>
                          <strong>{word.word}</strong>
                          <small>{formatNumber(word.startMs)}-{formatNumber(word.endMs)}ms</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted small mb-0">尚未取得 word boundaries。</p>
                  )}
                </section>
                <section>
                  <h3>Phones</h3>
                  {alignmentPhones.length ? (
                    <div className="sd-admin-token-table sd-admin-token-table--phones">
                      {alignmentPhones.slice(0, 120).map((phone, index) => (
                        <span key={`${phone.phone}-${phone.startMs}-${index}`}>
                          <strong>{phone.phone}</strong>
                          <small>{formatNumber(phone.startMs)}-{formatNumber(phone.endMs)}ms</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted small mb-0">尚未取得 phone boundaries。若 MFA 模型未輸出 phones，這裡會維持空白。</p>
                  )}
                </section>
              </div>

              <div className="sd-admin-rating">
                <h3>老師 rubric 評分</h3>
                <div className="sd-admin-rating-grid">
                  {RUBRIC_FIELDS.map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <select
                        className="form-select"
                        value={rating[key]}
                        onChange={(event) => setRating((prev) => ({ ...prev, [key]: event.target.value }))}
                      >
                        <option value="">未評</option>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="sd-admin-comments">
                  <span>Comments</span>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={rating.comments}
                    onChange={(event) => setRating((prev) => ({ ...prev, comments: event.target.value }))}
                    placeholder="記錄發音、流利度、文法或後續教學建議"
                  />
                </label>
                <button className="btn btn-primary" type="button" onClick={saveRating} disabled={saving}>
                  {saving ? '儲存中...' : '儲存評分'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
      ) : null}
    </div>
  );
}

