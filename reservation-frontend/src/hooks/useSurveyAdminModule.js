import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAdminSurvey,
  createSurveyVersion,
  deleteAdminSurvey,
  deleteSurveyVersion,
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

function toastFail(toast, message) {
  if (typeof toast?.danger === 'function') toast.danger(message);
  else if (typeof toast?.error === 'function') toast.error(message);
  else if (typeof toast?.show === 'function') toast.show(message, 'danger');
}

export function useSurveyAdminModule({ token, canView, canPublish, role, toast, confirm }) {
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
      toastFail(toast, '請填寫問卷代碼與名稱');
      return;
    }
    setCreateSubmitting(true);
    try {
      await createAdminSurvey(token, payload);
      toast.success('問卷已建立');
      setShowCreate(false);
      await load();
    } catch (e) {
      toastFail(toast, e.message || '建立失敗');
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
      toastFail(toast, e.message || '建立草稿失敗');
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
    } catch {
      toastFail(toast, 'schema JSON 格式不正確，請修正後再儲存');
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
      toastFail(toast, e.message || '儲存失敗');
      setVersionsUi((s) => ({ ...s, saving: false }));
    }
  }, [versionsUi, token, toast, openVersions]);

  const publishVersion = useCallback(async (versionId) => {
    const survey = versionsUi.survey;
    if (!survey || !versionId) return;
    const ok = confirm
      ? await confirm({
        title: '確定要發布此版本？',
        description: '發布後會自動封存其他已發布版本，學生端將改看此版。',
        confirmText: '發布',
        cancelText: '取消',
        variant: 'danger',
      })
      : window.confirm('確定要發布此版本？發布後會自動封存其他 published 版本。');
    if (!ok) return;
    setVersionsUi((s) => ({ ...s, publishingVersionId: versionId }));
    try {
      await publishSurveyVersion(token, survey.id, versionId);
      toast.success('已發布');
      setVersionsUi((s) => ({ ...s, publishingVersionId: null }));
      await Promise.all([openVersions(survey), load()]);
    } catch (e) {
      toastFail(toast, e.message || '發布失敗');
      setVersionsUi((s) => ({ ...s, publishingVersionId: null }));
    }
  }, [versionsUi.survey, token, toast, openVersions, load, confirm]);

  const deleteVersion = useCallback(async (ver) => {
    const survey = versionsUi.survey;
    if (!survey || !ver?.id) return;
    if (ver.status === 'published' || survey.currentPublishedVersionId === ver.id) {
      toastFail(toast, '已發布版本不可刪除');
      return;
    }
    const ok = confirm
      ? await confirm({
        title: `刪除草稿 v${ver.versionNumber}？`,
        description: '此操作無法復原。',
        confirmText: '刪除',
        cancelText: '取消',
        variant: 'danger',
      })
      : window.confirm(`確定刪除草稿 v${ver.versionNumber}？`);
    if (!ok) return;
    setVersionsUi((s) => ({ ...s, saving: true }));
    try {
      await deleteSurveyVersion(token, survey.id, ver.id);
      toast.success(`已刪除草稿 v${ver.versionNumber}`);
      if (versionsUi.editing?.id === ver.id) {
        setVersionsUi((s) => ({ ...s, editing: null }));
      }
      await openVersions(survey);
    } catch (e) {
      toastFail(toast, e.message || '刪除版本失敗');
      setVersionsUi((s) => ({ ...s, saving: false }));
    }
  }, [versionsUi.survey, versionsUi.editing, token, toast, confirm, openVersions]);

  const deleteSurvey = useCallback(async (survey) => {
    if (!survey?.id) return;
    const hasResponses = Number(survey.responseCount || 0) > 0;
    const isArchived = survey.status === 'archived';
    const description = isArchived
      ? '此問卷已封存，將永久刪除主檔、版本與相關作答資料，無法復原。'
      : hasResponses
        ? '此問卷已有作答，將改為「封存」：停用規則、取消發布，資料保留。若要永久刪除請先封存後再刪一次。'
        : '將永久刪除此問卷與所有版本，無法復原。';
    const ok = confirm
      ? await confirm({
        title: isArchived || !hasResponses ? '確定永久刪除問卷？' : '確定封存問卷？',
        description: `${survey.name}（${survey.surveyKey}）\n${description}`,
        confirmText: isArchived || !hasResponses ? '永久刪除' : '封存',
        cancelText: '取消',
        variant: 'danger',
      })
      : window.confirm(`${description}\n\n${survey.name}`);
    if (!ok) return;
    try {
      const result = await deleteAdminSurvey(token, survey.id, {});
      if (result.mode === 'archived') {
        toast.success('問卷已封存');
      } else {
        toast.success('問卷已刪除');
      }
      if (versionsUi.survey?.id === survey.id) {
        closeVersions();
      }
      await load();
    } catch (e) {
      toastFail(toast, e.message || '刪除失敗');
    }
  }, [token, toast, confirm, load, versionsUi.survey, closeVersions]);

  const exportSurveyJson = useCallback(async (survey) => {
    if (!survey?.id) return;
    try {
      const blob = await exportSurveyJsonFile(token, survey.id, role || 'worker');
      const safeKey = String(survey.surveyKey || `survey_${survey.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadBlob(blob, `${safeKey}-package.json`);
      toast.success('已下載 JSON');
    } catch (e) {
      toastFail(toast, e.message || '匯出失敗');
    }
  }, [token, role, toast]);

  const copyPublicSurveyLink = useCallback(async (survey) => {
    if (!survey?.surveyKey) {
      toastFail(toast, '此問卷沒有問卷代碼，無法產生連結');
      return;
    }
    const path = `/survey/${survey.surveyKey}`;
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}${path}`
      : path;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt('請複製公開填答連結：', url);
      }
      toast.success('已複製公開填答連結');
    } catch (e) {
      window.prompt('請複製公開填答連結：', url);
    }
  }, [toast]);

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
    deleteVersion,
    deleteSurvey,
    exportSurveyJson,
    copyPublicSurveyLink,
    canPublish,
  };
}
