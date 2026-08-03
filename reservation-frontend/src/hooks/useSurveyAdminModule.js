import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAdminSurvey,
  createSurveyVersion,
  downloadBlob,
  exportSurveyJson as exportSurveyJsonFile,
  fetchAdminSurveys,
  fetchSurveyVersions,
  publishSurveyVersion,
  updateSurveyVersion,
} from '../services/surveyAdminApi';

const EMPTY_CREATE_FORM = {
  surveyKey: '',
  name: '',
  description: '',
  category: '',
  targetType: '',
};

const EMPTY_VERSIONS_UI = {
  show: false,
  survey: null,
  loading: false,
  error: '',
  rows: [],
  editing: null,
  schemaText: '',
  changeSummary: '',
  saving: false,
  publishingVersionId: null,
};

export function useSurveyAdminModule({ token, canView, canPublish, role, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [versionsUi, setVersionsUi] = useState(EMPTY_VERSIONS_UI);

  const load = useCallback(async () => {
    if (!token || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminSurveys(token);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, canView]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const t = String(q || '').trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => {
      const name = String(r.name || '').toLowerCase();
      const key = String(r.surveyKey || '').toLowerCase();
      return name.includes(t) || key.includes(t);
    });
  }, [rows, q]);

  const openCreate = useCallback(() => {
    setCreateForm(EMPTY_CREATE_FORM);
    setShowCreate(true);
  }, []);

  const closeCreate = useCallback(() => setShowCreate(false), []);

  const submitCreate = useCallback(async () => {
    const payload = {
      surveyKey: String(createForm.surveyKey || '').trim(),
      name: String(createForm.name || '').trim(),
      description: String(createForm.description || '').trim() || null,
      category: String(createForm.category || '').trim() || null,
      targetType: String(createForm.targetType || '').trim() || null,
    };
    if (!payload.surveyKey || !payload.name) {
      toast.danger('請填寫問卷代碼與名稱');
      return;
    }
    setCreateSubmitting(true);
    try {
      await createAdminSurvey(token, payload);
      toast.success('問卷已建立');
      setShowCreate(false);
      await load();
    } catch (e) {
      toast.danger(e.message || '建立失敗');
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, token, toast, load]);

  const openVersions = useCallback(async (survey) => {
    setVersionsUi({
      ...EMPTY_VERSIONS_UI,
      show: true,
      survey,
      loading: true,
    });
    try {
      const data = await fetchSurveyVersions(token, survey.id);
      setVersionsUi((s) => ({ ...s, loading: false, rows: Array.isArray(data) ? data : [] }));
    } catch (e) {
      setVersionsUi((s) => ({ ...s, loading: false, error: e.message || '載入版本失敗' }));
    }
  }, [token]);

  const closeVersions = useCallback(() => {
    setVersionsUi((s) => ({ ...s, show: false, editing: null }));
  }, []);

  const createDraftVersion = useCallback(async () => {
    const survey = versionsUi.survey;
    if (!survey) return;
    setVersionsUi((s) => ({ ...s, saving: true }));
    try {
      const data = await createSurveyVersion(token, survey.id, {});
      toast.success(`已建立草稿 v${data.versionNumber}`);
      await openVersions(survey);
    } catch (e) {
      toast.danger(e.message || '建立草稿失敗');
      setVersionsUi((s) => ({ ...s, saving: false }));
    }
  }, [versionsUi.survey, token, toast, openVersions]);

  const startEditVersion = useCallback((ver) => {
    if (ver?.status === 'published') {
      toast.info('已發布版本不可修改；請建立新草稿版本再調整。');
      return;
    }
    setVersionsUi((s) => ({
      ...s,
      editing: ver,
      schemaText: ver?.schemaJson ? JSON.stringify(ver.schemaJson, null, 2) : '',
      changeSummary: ver?.changeSummary || '',
    }));
  }, [toast]);

  const cancelEditVersion = useCallback(() => {
    setVersionsUi((s) => ({ ...s, editing: null }));
  }, []);

  const updateVersionsField = useCallback((key, value) => {
    setVersionsUi((s) => ({ ...s, [key]: value }));
  }, []);

  const saveVersion = useCallback(async () => {
    const survey = versionsUi.survey;
    const ver = versionsUi.editing;
    if (!survey || !ver) return;
    let schemaJson = null;
    try {
      schemaJson = versionsUi.schemaText ? JSON.parse(versionsUi.schemaText) : null;
    } catch (e) {
      toast.danger('schema JSON 格式不正確，請修正後再儲存');
      return;
    }
    setVersionsUi((s) => ({ ...s, saving: true }));
    try {
      await updateSurveyVersion(token, survey.id, ver.id, {
        schemaJson,
        changeSummary: versionsUi.changeSummary || null,
      });
      toast.success('版本已更新');
      await openVersions(survey);
    } catch (e) {
      toast.danger(e.message || '儲存失敗');
      setVersionsUi((s) => ({ ...s, saving: false }));
    }
  }, [versionsUi, token, toast, openVersions]);

  const publishVersion = useCallback(async (versionId) => {
    const survey = versionsUi.survey;
    if (!survey || !versionId) return;
    if (!window.confirm('確定要發布此版本？發布後會自動封存其他 published 版本。')) return;
    setVersionsUi((s) => ({ ...s, publishingVersionId: versionId }));
    try {
      await publishSurveyVersion(token, survey.id, versionId);
      toast.success('已發布');
      setVersionsUi((s) => ({ ...s, publishingVersionId: null }));
      await Promise.all([openVersions(survey), load()]);
    } catch (e) {
      toast.danger(e.message || '發布失敗');
      setVersionsUi((s) => ({ ...s, publishingVersionId: null }));
    }
  }, [versionsUi.survey, token, toast, openVersions, load]);

  const exportSurveyJson = useCallback(async (survey) => {
    if (!survey?.id) return;
    try {
      const blob = await exportSurveyJsonFile(token, survey.id, role || 'worker');
      const safeKey = String(survey.surveyKey || `survey_${survey.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadBlob(blob, `${safeKey}-package.json`);
      toast.success('已下載 JSON');
    } catch (e) {
      toast.danger(e.message || '匯出失敗');
    }
  }, [token, role, toast]);

  return {
    rows,
    loading,
    error,
    q,
    setQ,
    filteredRows,
    load,
    showCreate,
    createForm,
    setCreateForm,
    createSubmitting,
    openCreate,
    closeCreate,
    submitCreate,
    versionsUi,
    openVersions,
    closeVersions,
    createDraftVersion,
    startEditVersion,
    cancelEditVersion,
    updateVersionsField,
    saveVersion,
    publishVersion,
    exportSurveyJson,
    canPublish,
  };
}
