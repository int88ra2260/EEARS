import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import useToast from '../../components/ui/useToast';
import {
  fetchLearningResourcesAdmin,
  createLearningResourceAdmin,
  updateLearningResourceAdmin,
  deleteLearningResourceAdmin,
  reorderLearningResourcesAdmin,
  fetchRegulationsFormsAdmin,
  createRegulationsGroupAdmin,
  updateRegulationsGroupAdmin,
  deleteRegulationsGroupAdmin,
  reorderRegulationsGroupsAdmin,
  createRegulationsItemAdmin,
  updateRegulationsItemAdmin,
  deleteRegulationsItemAdmin,
  reorderRegulationsItemsAdmin,
  uploadRegulationsFormsPdfAdmin,
  fetchScrollWorldTestSegmentsAdmin,
  updateScrollWorldTestSegmentAdmin,
  reorderScrollWorldTestSegmentsAdmin,
  fetchCourseGuideAdmin,
  createCourseGuideSectionAdmin,
  updateCourseGuideSectionAdmin,
  deleteCourseGuideSectionAdmin,
  reorderCourseGuideSectionsAdmin,
  createCourseGuideTopicAdmin,
  updateCourseGuideTopicAdmin,
  deleteCourseGuideTopicAdmin,
  reorderCourseGuideTopicsAdmin,
} from '../../services/pageContentAdminApi';
import './PageContentManagementPage.css';
import CourseGuideBlocksEditor from '../../components/courseGuide/CourseGuideBlocksEditor';
import './StudentContentHubPage.css';

function sortBySortOrder(items) {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0));
}

function moveInArray(ids, index, dir) {
  const next = [...ids];
  const ni = index + dir;
  if (ni < 0 || ni >= next.length) return null;
  const tmp = next[index];
  next[index] = next[ni];
  next[ni] = tmp;
  return next;
}

function countActive(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.isActive).length;
}

function Field({ label, children }) {
  return (
    <label className="d-block mb-2">
      <div className="page-content-admin__field-label">{label}</div>
      {children}
    </label>
  );
}

function StatusSwitch({ value, onChange }) {
  return (
    <input
      type="checkbox"
      className="form-check-input"
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function SectionCard({ title, subtitle, stats, children }) {
  return (
    <section className="page-content-admin__section-card">
      <div className="page-content-admin__section-head">
        <div>
          <h3 className="page-content-admin__section-title">{title}</h3>
          {subtitle ? <p className="page-content-admin__section-subtitle mb-0">{subtitle}</p> : null}
        </div>
        {Array.isArray(stats) && stats.length ? (
          <div className="page-content-admin__stats">
            {stats.map((item) => (
              <div key={item.label} className="page-content-admin__stat">
                <div className="page-content-admin__stat-value">{item.value}</div>
                <div className="page-content-admin__stat-label">{item.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, hint }) {
  return (
    <div className="page-content-admin__empty">
      <div className="fw-semibold mb-1">{title}</div>
      {hint ? <div className="small text-muted">{hint}</div> : null}
    </div>
  );
}

function PreviewLink({ href, external = false, label = '預覽' }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="btn btn-sm btn-outline-dark"
    >
      {label}
    </a>
  );
}

const PAGE_PREVIEW_BY_TAB = {
  learning: {
    path: '/learning-resources',
    label: '學習資源',
    tips: [
      '左側改標題、連結與排序；右側可對照學生端畫面。',
      '關掉「啟用」後，該項目不會出現在前台。',
      '改完可按「重新整理預覽」，或開前台頁確認。',
    ],
  },
  regulations: {
    path: '/regulations-forms',
    label: '法規表單',
    tips: [
      '先選左側群組，再上傳 PDF 並填標題。',
      '可用「預覽 PDF」確認檔案是否正確。',
      '群組與項目的排序會影響前台順序。',
    ],
  },
  scrollWorld: {
    path: '/scrollworldtest',
    label: 'Scroll World',
    tips: [
      '這裡只改文字、按鈕標籤與連結；場景影片維持固定。',
      '停用段落後，前台導覽與畫面會一起隱藏該段。',
      '此頁較重，預覽載入可能需要幾秒。',
    ],
  },
  courseGuide: {
    path: '/course-guide',
    label: '修課說明',
    tips: [
      '左側選大章節，右側編輯學年度或細項。',
      '圖片來自媒體庫：可點縮圖挑選，或上傳後共用。',
      '也可到「媒體庫」任務集中管理、停用或刪除圖片。',
    ],
  },
};

function EditTips({ tips }) {
  if (!Array.isArray(tips) || !tips.length) return null;
  return (
    <div className="page-content-admin__tips">
      <div className="page-content-admin__tips-title">編輯提示</div>
      <ul className="page-content-admin__tips-list mb-0">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </div>
  );
}

function PublicPreviewPane({ path, label, refreshKey, onRefresh, onOpenExternal }) {
  const src = `${path}?adminPreview=${refreshKey}`;
  return (
    <div className="page-content-admin__preview-pane">
      <div className="page-content-admin__preview-toolbar">
        <div>
          <div className="page-content-admin__preview-title">前台預覽 · {label}</div>
          <div className="page-content-admin__preview-path">{path}</div>
        </div>
        <div className="page-content-admin__preview-actions">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onRefresh}>
            重新整理預覽
          </button>
          <button type="button" className="btn btn-sm btn-dark" onClick={onOpenExternal}>
            開前台頁
          </button>
        </div>
      </div>
      <div className="page-content-admin__preview-frame-wrap">
        <iframe
          key={refreshKey}
          title={`${label} 前台預覽`}
          src={src}
          className="page-content-admin__preview-frame"
        />
      </div>
    </div>
  );
}

export default function PageContentManagementPage({ embedded = false, forcedTab = null } = {}) {
  const { token } = useOutletContext();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState(forcedTab || 'learning');
  const [showSplitPreview, setShowSplitPreview] = useState(true);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  const [learning, setLearning] = useState(null);
  const [regulations, setRegulations] = useState(null);
  const [scrollWorld, setScrollWorld] = useState(null);
  const [courseGuide, setCourseGuide] = useState(null);

  const [loading, setLoading] = useState({
    learning: true,
    regulations: true,
    scrollWorld: true,
    courseGuide: true,
  });

  const [saving, setSaving] = useState(false);

  const bumpPreview = () => setPreviewRefreshKey((k) => k + 1);

  const refreshLearning = async () => {
    setLoading((s) => ({ ...s, learning: true }));
    try {
      const data = await fetchLearningResourcesAdmin(token);
      setLearning(data);
    } finally {
      setLoading((s) => ({ ...s, learning: false }));
    }
  };

  const refreshRegulations = async () => {
    setLoading((s) => ({ ...s, regulations: true }));
    try {
      const data = await fetchRegulationsFormsAdmin(token);
      setRegulations(data);
    } finally {
      setLoading((s) => ({ ...s, regulations: false }));
    }
  };

  const refreshScrollWorld = async () => {
    setLoading((s) => ({ ...s, scrollWorld: true }));
    try {
      const data = await fetchScrollWorldTestSegmentsAdmin(token);
      // backend returns {segments: [...]}
      setScrollWorld(data?.segments || []);
    } finally {
      setLoading((s) => ({ ...s, scrollWorld: false }));
    }
  };

  const refreshCourseGuide = async () => {
    setLoading((s) => ({ ...s, courseGuide: true }));
    try {
      const data = await fetchCourseGuideAdmin(token);
      setCourseGuide(data);
    } finally {
      setLoading((s) => ({ ...s, courseGuide: false }));
    }
  };

  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab);
  }, [forcedTab]);

  useEffect(() => {
    if (embedded && forcedTab) {
      if (forcedTab === 'learning') refreshLearning();
      else if (forcedTab === 'regulations') refreshRegulations();
      else if (forcedTab === 'scrollWorld') refreshScrollWorld();
      else if (forcedTab === 'courseGuide') refreshCourseGuide();
      return;
    }
    refreshLearning();
    refreshRegulations();
    refreshScrollWorld();
    refreshCourseGuide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, forcedTab]);

  const tabs = useMemo(
    () => [
      { id: 'learning', label: '學習資源', hint: '連結、標題、排序與啟用' },
      { id: 'regulations', label: '法規表單', hint: '群組與 PDF' },
      { id: 'scrollWorld', label: 'Scroll World', hint: '段落文字與按鈕' },
      { id: 'courseGuide', label: '修課說明', hint: '章節、學年度與圖文' },
    ],
    [],
  );

  const summaryCards = useMemo(
    () => [
      {
        id: 'learning',
        title: '學習資源',
        total: (learning?.sites?.length || 0) + (learning?.miniGames?.length || 0) + (learning?.guides?.length || 0),
        active:
          countActive(learning?.sites) + countActive(learning?.miniGames) + countActive(learning?.guides),
      },
      {
        id: 'regulations',
        title: '法規表單',
        total: (regulations?.groups?.length || 0) + (regulations?.groups || []).reduce((sum, g) => sum + (g?.items?.length || 0), 0),
        active:
          countActive(regulations?.groups) +
          (regulations?.groups || []).reduce((sum, g) => sum + countActive(g?.items), 0),
      },
      {
        id: 'scrollWorld',
        title: 'Scroll World',
        total: Array.isArray(scrollWorld) ? scrollWorld.length : 0,
        active: countActive(scrollWorld),
      },
      {
        id: 'courseGuide',
        title: '修課說明',
        total:
          (courseGuide?.sections?.length || 0) +
          (courseGuide?.sections || []).reduce((sum, s) => sum + (s?.topics?.length || 0), 0),
        active:
          countActive(courseGuide?.sections) +
          (courseGuide?.sections || []).reduce((sum, s) => sum + countActive(s?.topics), 0),
      },
    ],
    [learning, regulations, scrollWorld, courseGuide],
  );

  const upsertLearningItem = async (kind, payload) => {
    if (!payload?.id) {
      const created = await createLearningResourceAdmin(token, kind, payload);
      toast({ message: `已新增：${created?.href || ''}`, variant: 'success' });
      await refreshLearning();
      bumpPreview();
      return;
    }
    const updated = await updateLearningResourceAdmin(token, kind, payload.id, payload);
    toast({ message: `已更新：${updated?.href || ''}`, variant: 'success' });
    setLearning((cur) => {
      if (!cur) return cur;
      const key = kind === 'sites' ? 'sites' : kind === 'miniGames' ? 'miniGames' : 'guides';
      const list = cur[key] || [];
      return { ...cur, [key]: list.map((x) => (x.id === updated.id ? updated : x)) };
    });
    bumpPreview();
  };

  const reorderLearning = async (kind, ids) => {
    setSaving(true);
    try {
      await reorderLearningResourcesAdmin(token, kind, ids);
      await refreshLearning();
      toast({ message: '排序已更新', variant: 'success' });
      bumpPreview();
    } finally {
      setSaving(false);
    }
  };

  const deleteLearning = async (kind, id) => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm('確定刪除這筆內容？');
    if (!ok) return;
    setSaving(true);
    try {
      await deleteLearningResourceAdmin(token, kind, id);
      await refreshLearning();
      toast({ message: '已刪除', variant: 'success' });
      bumpPreview();
    } catch (e) {
      toast({ message: e?.message || '刪除失敗', variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const [regActiveGroupId, setRegActiveGroupId] = useState(null);
  const [cgActiveSectionId, setCgActiveSectionId] = useState(null);

  useEffect(() => {
    if (!regulations?.groups?.length) return;
    if (regActiveGroupId == null) setRegActiveGroupId(String(regulations.groups[0].id));
  }, [regActiveGroupId, regulations]);

  useEffect(() => {
    if (!courseGuide?.sections?.length) return;
    if (cgActiveSectionId == null) setCgActiveSectionId(String(courseGuide.sections[0].id));
  }, [cgActiveSectionId, courseGuide]);

  const regGroups = regulations?.groups || [];
  const regActiveGroup = regGroups.find((g) => String(g.id) === String(regActiveGroupId)) || null;
  const cgSections = courseGuide?.sections || [];
  const cgActiveSection = cgSections.find((s) => String(s.id) === String(cgActiveSectionId)) || null;

  const afterCourseGuideChange = async () => {
    await refreshCourseGuide();
    bumpPreview();
  };

  const saveScrollWorldSegment = async (sectionId, payload) => {
    setSaving(true);
    try {
      const updated = await updateScrollWorldTestSegmentAdmin(token, sectionId, payload);
      setScrollWorld((cur) => (Array.isArray(cur) ? cur.map((x) => (x.sectionId === sectionId ? updated : x)) : cur));
      toast({ message: '已更新段落', variant: 'success' });
      bumpPreview();
    } catch (e) {
      toast({ message: e?.message || '更新失敗', variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const reorderScrollWorld = async (sectionIds) => {
    setSaving(true);
    try {
      await reorderScrollWorldTestSegmentsAdmin(token, sectionIds);
      await refreshScrollWorld();
      toast({ message: '排序已更新', variant: 'success' });
      bumpPreview();
    } finally {
      setSaving(false);
    }
  };

  const previewMeta = PAGE_PREVIEW_BY_TAB[activeTab] || PAGE_PREVIEW_BY_TAB.learning;
  const openFrontPage = () => {
    window.open(previewMeta.path, '_blank', 'noopener,noreferrer');
  };

  const afterRegulationsChange = async () => {
    await refreshRegulations();
    bumpPreview();
  };

  return (
    <div
      className={`page-content-admin${embedded ? '' : ' container-fluid py-4'}${showSplitPreview ? ' page-content-admin--split' : ''}${embedded ? ' page-content-admin--embedded' : ''}`}
    >
      {embedded ? (
        <div className="d-flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            className={`btn btn-sm ${showSplitPreview ? 'btn-dark' : 'btn-outline-dark'}`}
            onClick={() => setShowSplitPreview((v) => !v)}
          >
            {showSplitPreview ? '關閉預覽' : '開啟預覽'}
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openFrontPage}>
            開前台頁 · {previewMeta.label}
          </button>
          {showSplitPreview ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={bumpPreview}>
              重新整理預覽
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="page-content-admin__hero mb-4">
            <div className="page-content-admin__hero-copy">
              <div className="page-content-admin__eyebrow">Page content workspace</div>
              <h2 className="h4 mb-2">頁面內容管理</h2>
              <p className="text-muted mb-0">
                以接近前台的方式編輯學生端內容：左側改文字／連結／PDF／排序，右側即時對照學生看到的頁面。
              </p>
            </div>
            <div className="page-content-admin__hero-note">
              <div className="small fw-semibold mb-1">編輯建議</div>
              <div className="small text-muted mb-2">
                開「分割視圖」邊改邊看；存檔後右側預覽會自動重整。也可用「開前台頁」在新分頁確認。
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${showSplitPreview ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setShowSplitPreview((v) => !v)}
                >
                  {showSplitPreview ? '關閉分割視圖' : '開啟分割視圖'}
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openFrontPage}>
                  開前台頁 · {previewMeta.label}
                </button>
                {showSplitPreview ? (
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={bumpPreview}>
                    重新整理預覽
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4 page-content-admin__summary-row">
            {summaryCards.map((card) => (
              <div key={card.id} className="col-12 col-sm-6 col-xl-3">
                <button
                  type="button"
                  className={`page-content-admin__summary-card ${activeTab === card.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(card.id)}
                >
                  <div className="page-content-admin__summary-title">{card.title}</div>
                  <div className="page-content-admin__summary-meta">
                    <strong>{card.total}</strong> 筆內容
                  </div>
                  <div className="page-content-admin__summary-meta">啟用中 {card.active} 筆</div>
                  <div className="page-content-admin__summary-link">
                    前台：{PAGE_PREVIEW_BY_TAB[card.id]?.path}
                  </div>
                </button>
              </div>
            ))}
          </div>

          <div className="page-content-admin__tabs mb-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`page-content-admin__tab ${activeTab === t.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <span className="fw-semibold">{t.label}</span>
                <small>{t.hint}</small>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="page-content-admin__workspace">
        <div className="page-content-admin__editor">
          <EditTips tips={previewMeta.tips} />

          {activeTab === 'learning' ? (
            <div>
              {loading.learning ? (
                <div>載入中…</div>
              ) : (
                <LearningResourcesEditor
                  learning={learning}
                  saving={saving}
                  onUpsert={(kind, payload) => upsertLearningItem(kind, payload)}
                  onDelete={deleteLearning}
                  onReorder={reorderLearning}
                />
              )}
            </div>
          ) : null}

          {activeTab === 'regulations' ? (
            <div>
              {loading.regulations ? (
                <div>載入中…</div>
              ) : (
                <RegulationsFormsEditor
                  groups={regGroups}
                  activeGroup={regActiveGroup}
                  setActiveGroupId={setRegActiveGroupId}
                  saving={saving}
                  onRefresh={afterRegulationsChange}
                  onCreateGroup={(payload) => createRegulationsGroupAdmin(token, payload).then(afterRegulationsChange)}
                  onUpdateGroup={(id, payload) => updateRegulationsGroupAdmin(token, id, payload).then(afterRegulationsChange)}
                  onDeleteGroup={(id) => deleteRegulationsGroupAdmin(token, id).then(afterRegulationsChange)}
                  onReorderGroups={(ids) => reorderRegulationsGroupsAdmin(token, ids).then(afterRegulationsChange)}
                  onCreateItem={async (payload) => {
                    const created = await createRegulationsItemAdmin(token, payload);
                    toast({ message: '已新增 PDF 項目', variant: 'success' });
                    await afterRegulationsChange();
                    return created;
                  }}
                  onUpdateItem={async (id, payload) => {
                    const updated = await updateRegulationsItemAdmin(token, id, payload);
                    toast({ message: '已更新項目', variant: 'success' });
                    await afterRegulationsChange();
                    return updated;
                  }}
                  onDeleteItem={async (id) => {
                    await deleteRegulationsItemAdmin(token, id);
                    toast({ message: '已刪除項目', variant: 'success' });
                    await afterRegulationsChange();
                  }}
                  onReorderItems={async (ids) => {
                    await reorderRegulationsItemsAdmin(token, ids);
                    await afterRegulationsChange();
                    toast({ message: '排序已更新', variant: 'success' });
                  }}
                  uploadPdf={(file) => uploadRegulationsFormsPdfAdmin(token, file)}
                />
              )}
            </div>
          ) : null}

          {activeTab === 'scrollWorld' ? (
            <div>
              {loading.scrollWorld ? (
                <div>載入中…</div>
              ) : (
                <ScrollWorldEditor
                  segments={Array.isArray(scrollWorld) ? sortBySortOrder(scrollWorld) : []}
                  saving={saving}
                  onSave={(sectionId, payload) => saveScrollWorldSegment(sectionId, payload)}
                  onReorder={(sectionIds) => reorderScrollWorld(sectionIds)}
                />
              )}
            </div>
          ) : null}

          {activeTab === 'courseGuide' ? (
            <div>
              {loading.courseGuide ? (
                <div>載入中…</div>
              ) : (
                <CourseGuideEditor
                  sections={cgSections}
                  activeSection={cgActiveSection}
                  setActiveSectionId={setCgActiveSectionId}
                  saving={saving}
                  onCreateSection={async (payload) => {
                    await createCourseGuideSectionAdmin(token, payload);
                    toast({ message: '已新增區塊', variant: 'success' });
                    await afterCourseGuideChange();
                  }}
                  onUpdateSection={async (id, payload) => {
                    await updateCourseGuideSectionAdmin(token, id, payload);
                    toast({ message: '已更新區塊', variant: 'success' });
                    await afterCourseGuideChange();
                  }}
                  onDeleteSection={async (id) => {
                    // eslint-disable-next-line no-alert
                    if (!window.confirm('確定刪除此區塊及其所有主題？')) return;
                    await deleteCourseGuideSectionAdmin(token, id);
                    setCgActiveSectionId(null);
                    toast({ message: '已刪除區塊', variant: 'success' });
                    await afterCourseGuideChange();
                  }}
                  onReorderSections={async (ids) => {
                    await reorderCourseGuideSectionsAdmin(token, ids);
                    toast({ message: '區塊排序已更新', variant: 'success' });
                    await afterCourseGuideChange();
                  }}
                  onCreateTopic={async (payload) => {
                    await createCourseGuideTopicAdmin(token, payload);
                    toast({ message: '已新增主題', variant: 'success' });
                    await afterCourseGuideChange();
                  }}
                  onUpdateTopic={async (id, payload) => {
                    await updateCourseGuideTopicAdmin(token, id, payload);
                    toast({ message: '已更新主題', variant: 'success' });
                    await afterCourseGuideChange();
                  }}
                  onDeleteTopic={async (id) => {
                    // eslint-disable-next-line no-alert
                    if (!window.confirm('確定刪除此主題？')) return;
                    await deleteCourseGuideTopicAdmin(token, id);
                    toast({ message: '已刪除主題', variant: 'success' });
                    await afterCourseGuideChange();
                  }}
                  onReorderTopics={async (ids) => {
                    await reorderCourseGuideTopicsAdmin(token, ids);
                    toast({ message: '主題排序已更新', variant: 'success' });
                    await afterCourseGuideChange();
                  }}
                />
              )}
            </div>
          ) : null}
        </div>

        {showSplitPreview ? (
          <PublicPreviewPane
            path={previewMeta.path}
            label={previewMeta.label}
            refreshKey={`${activeTab}-${previewRefreshKey}`}
            onRefresh={bumpPreview}
            onOpenExternal={openFrontPage}
          />
        ) : null}
      </div>
    </div>
  );
}

function LearningResourcesEditor({ learning, saving, onUpsert, onDelete, onReorder }) {
  const [newSite, setNewSite] = useState({
    titleZh: '',
    titleEn: '',
    introZh: '',
    introEn: '',
    tag: '',
    href: '',
    titleKey: '',
    introKey: 'learningResourcesPage.sitesCardLead',
    tagKey: 'learningResourcesPage.sitesTag',
    sortOrder: 0,
    isActive: true,
  });

  const [newMiniGame, setNewMiniGame] = useState({
    titleZh: '',
    titleEn: '',
    introZh: '',
    introEn: '',
    tag: '',
    href: '',
    isExternal: false,
    titleKey: '',
    introKey: '',
    sortOrder: 0,
    isActive: true,
  });

  const [newGuide, setNewGuide] = useState({
    titleZh: '',
    titleEn: '',
    introZh: '',
    introEn: '',
    tag: '',
    href: '',
    isExternal: false,
    titleKey: '',
    introKey: '',
    sortOrder: 0,
    isActive: true,
  });

  const sites = learning?.sites || [];
  const miniGames = learning?.miniGames || [];
  const guides = learning?.guides || [];

  const commonReorder = (kind, list, itemId, dir) => {
    const ordered = sortBySortOrder(list);
    const ids = ordered.map((x) => x.id);
    const idx = ids.indexOf(itemId);
    const next = moveInArray(ids, idx, dir);
    if (!next) return;
    onReorder(kind, next);
  };

  return (
    <div className="row g-4">
      <div className="col-12">
        <SectionCard
          title="學習網站"
          subtitle="適合放固定外部學習平台。支援中英標題、連結、標籤與啟用狀態。"
          stats={[
            { label: '總數', value: sites.length },
            { label: '啟用中', value: countActive(sites) },
          ]}
        >
        <div className="page-content-admin__composer mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-2">
              <Field label="標題（ZH）">
                <input className="form-control form-control-sm" value={newSite.titleZh} onChange={(e) => setNewSite((s) => ({ ...s, titleZh: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-2">
              <Field label="標題（EN）">
                <input className="form-control form-control-sm" value={newSite.titleEn} onChange={(e) => setNewSite((s) => ({ ...s, titleEn: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-3">
              <Field label="連結 href">
                <input className="form-control form-control-sm" value={newSite.href} onChange={(e) => setNewSite((s) => ({ ...s, href: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-2">
              <Field label="標籤 tag">
                <input className="form-control form-control-sm" value={newSite.tag} onChange={(e) => setNewSite((s) => ({ ...s, tag: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-1">
              <Field label="啟用">
                <StatusSwitch value={newSite.isActive} onChange={(v) => setNewSite((s) => ({ ...s, isActive: v }))} />
              </Field>
            </div>
            <div className="col-md-2">
              <button
                type="button"
                className="btn btn-primary btn-sm w-100"
                disabled={saving || !newSite.href.trim()}
                onClick={() => onUpsert('sites', newSite)}
              >
                新增
              </button>
            </div>
          </div>
        </div>

        {sites.length === 0 ? (
          <EmptyState title="還沒有學習網站" hint="先填上標題與 href，再按新增。" />
        ) : (
          <div className="table-responsive page-content-admin__table-wrap">
            <table className="table table-sm align-middle page-content-admin__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>標題(ZH)</th>
                  <th>標題(EN)</th>
                  <th>href</th>
                  <th>tag</th>
                  <th>啟用</th>
                  <th>排序</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortBySortOrder(sites).map((row, index) => (
                  <LearningSiteRow
                    key={row.id}
                    row={row}
                    saving={saving}
                    index={index}
                    onUpsert={(payload) => onUpsert('sites', payload)}
                    onDelete={() => onDelete('sites', row.id)}
                    onReorder={(dir) => commonReorder('sites', sites, row.id, dir)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        </SectionCard>
      </div>

      <div className="col-12">
        <SectionCard
          title="Mini Games"
          subtitle="適合管理小遊戲入口。可用翻譯 key 或直接寫文字，並標記內外部連結。"
          stats={[
            { label: '總數', value: miniGames.length },
            { label: '啟用中', value: countActive(miniGames) },
          ]}
        >
        <div className="page-content-admin__composer mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <Field label="標題 key（可選）">
                <input className="form-control form-control-sm" value={newMiniGame.titleKey} onChange={(e) => setNewMiniGame((s) => ({ ...s, titleKey: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-3">
              <Field label="intro key（可選）">
                <input className="form-control form-control-sm" value={newMiniGame.introKey} onChange={(e) => setNewMiniGame((s) => ({ ...s, introKey: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-3">
              <Field label="href/path">
                <input className="form-control form-control-sm" value={newMiniGame.href} onChange={(e) => setNewMiniGame((s) => ({ ...s, href: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-1">
              <Field label="外部">
                <StatusSwitch value={newMiniGame.isExternal} onChange={(v) => setNewMiniGame((s) => ({ ...s, isExternal: v }))} />
              </Field>
            </div>
            <div className="col-md-2">
              <button
                type="button"
                className="btn btn-primary btn-sm w-100"
                disabled={saving || !newMiniGame.href.trim()}
                onClick={() => onUpsert('miniGames', newMiniGame)}
              >
                新增
              </button>
            </div>
          </div>
        </div>

        {miniGames.length === 0 ? (
          <EmptyState title="還沒有 Mini Game 項目" hint="填入 href/path 後即可建立。" />
        ) : (
          <div className="table-responsive page-content-admin__table-wrap">
            <table className="table table-sm align-middle page-content-admin__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>tag</th>
                  <th>titleKey</th>
                  <th>href</th>
                  <th>外部</th>
                  <th>啟用</th>
                  <th>排序</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortBySortOrder(miniGames).map((row, index) => (
                  <LearningMiniGuideRow
                    key={row.id}
                    row={row}
                    saving={saving}
                    index={index}
                    onUpsert={(payload) => onUpsert('miniGames', payload)}
                    onDelete={() => onDelete('miniGames', row.id)}
                    onReorder={(dir) => commonReorder('miniGames', miniGames, row.id, dir)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        </SectionCard>
      </div>

      <div className="col-12">
        <SectionCard
          title="Learning Guides"
          subtitle="適合管理教學文章或導引頁連結，操作方式與 Mini Games 一致。"
          stats={[
            { label: '總數', value: guides.length },
            { label: '啟用中', value: countActive(guides) },
          ]}
        >
        <div className="page-content-admin__composer mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <Field label="標題 key（可選）">
                <input className="form-control form-control-sm" value={newGuide.titleKey} onChange={(e) => setNewGuide((s) => ({ ...s, titleKey: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-3">
              <Field label="intro key（可選）">
                <input className="form-control form-control-sm" value={newGuide.introKey} onChange={(e) => setNewGuide((s) => ({ ...s, introKey: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-3">
              <Field label="href/path">
                <input className="form-control form-control-sm" value={newGuide.href} onChange={(e) => setNewGuide((s) => ({ ...s, href: e.target.value }))} />
              </Field>
            </div>
            <div className="col-md-1">
              <Field label="外部">
                <StatusSwitch value={newGuide.isExternal} onChange={(v) => setNewGuide((s) => ({ ...s, isExternal: v }))} />
              </Field>
            </div>
            <div className="col-md-2">
              <button
                type="button"
                className="btn btn-primary btn-sm w-100"
                disabled={saving || !newGuide.href.trim()}
                onClick={() => onUpsert('guides', newGuide)}
              >
                新增
              </button>
            </div>
          </div>
        </div>

        {guides.length === 0 ? (
          <EmptyState title="還沒有 Learning Guide 項目" hint="填入 href/path 後即可建立。" />
        ) : (
          <div className="table-responsive page-content-admin__table-wrap">
            <table className="table table-sm align-middle page-content-admin__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>tag</th>
                  <th>titleKey</th>
                  <th>href</th>
                  <th>外部</th>
                  <th>啟用</th>
                  <th>排序</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortBySortOrder(guides).map((row, index) => (
                  <LearningMiniGuideRow
                    key={row.id}
                    row={row}
                    saving={saving}
                    index={index}
                    onUpsert={(payload) => onUpsert('guides', payload)}
                    onDelete={() => onDelete('guides', row.id)}
                    onReorder={(dir) => commonReorder('guides', guides, row.id, dir)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        </SectionCard>
      </div>
    </div>
  );
}

function LearningSiteRow({ row, onUpsert, onDelete, onReorder, saving, index }) {
  const [draft, setDraft] = useState(row);

  useEffect(() => {
    setDraft(row);
  }, [row]);

  const isDirty =
    JSON.stringify({
      titleZh: draft.titleZh || '',
      titleEn: draft.titleEn || '',
      href: draft.href || '',
      tag: draft.tag || '',
      isActive: !!draft.isActive,
    }) !==
    JSON.stringify({
      titleZh: row.titleZh || '',
      titleEn: row.titleEn || '',
      href: row.href || '',
      tag: row.tag || '',
      isActive: !!row.isActive,
    });

  return (
    <tr>
      <td className="text-muted">{index + 1}</td>
      <td>
        <input className="form-control form-control-sm" value={draft.titleZh || ''} onChange={(e) => setDraft((d) => ({ ...d, titleZh: e.target.value }))} />
      </td>
      <td>
        <input className="form-control form-control-sm" value={draft.titleEn || ''} onChange={(e) => setDraft((d) => ({ ...d, titleEn: e.target.value }))} />
      </td>
      <td>
        <input className="form-control form-control-sm" value={draft.href || ''} onChange={(e) => setDraft((d) => ({ ...d, href: e.target.value }))} />
      </td>
      <td>
        <input className="form-control form-control-sm" value={draft.tag || ''} onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))} />
      </td>
      <td>
        <StatusSwitch value={draft.isActive} onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} />
      </td>
      <td className="text-muted">{draft.sortOrder ?? 0}</td>
      <td className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onReorder(-1)} disabled={saving}>
          ↑
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onReorder(1)} disabled={saving}>
          ↓
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => onUpsert({ ...draft, sortOrder: draft.sortOrder ?? 0 })}>
          儲存
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" disabled={saving} onClick={onDelete}>
          刪除
        </button>
        <PreviewLink href={draft.href} external label="開啟" />
        {isDirty ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => setDraft(row)}>
            還原
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function LearningMiniGuideRow({ row, onUpsert, onDelete, onReorder, saving, index }) {
  const [draft, setDraft] = useState(row);

  useEffect(() => {
    setDraft(row);
  }, [row]);

  const isDirty =
    JSON.stringify({
      tag: draft.tag || '',
      titleKey: draft.titleKey || '',
      href: draft.href || '',
      isExternal: !!draft.isExternal,
      isActive: !!draft.isActive,
    }) !==
    JSON.stringify({
      tag: row.tag || '',
      titleKey: row.titleKey || '',
      href: row.href || '',
      isExternal: !!row.isExternal,
      isActive: !!row.isActive,
    });

  return (
    <tr>
      <td className="text-muted">{index + 1}</td>
      <td>
        <input className="form-control form-control-sm" value={draft.tag || ''} onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))} />
      </td>
      <td>
        <input className="form-control form-control-sm" value={draft.titleKey || ''} onChange={(e) => setDraft((d) => ({ ...d, titleKey: e.target.value }))} />
      </td>
      <td>
        <input className="form-control form-control-sm" value={draft.href || ''} onChange={(e) => setDraft((d) => ({ ...d, href: e.target.value }))} />
      </td>
      <td>
        <StatusSwitch value={draft.isExternal} onChange={(v) => setDraft((d) => ({ ...d, isExternal: v }))} />
      </td>
      <td>
        <StatusSwitch value={draft.isActive} onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} />
      </td>
      <td className="text-muted">{draft.sortOrder ?? 0}</td>
      <td className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onReorder(-1)} disabled={saving}>
          ↑
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onReorder(1)} disabled={saving}>
          ↓
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => onUpsert({ ...draft, sortOrder: draft.sortOrder ?? 0 })}>
          儲存
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" disabled={saving} onClick={onDelete}>
          刪除
        </button>
        <PreviewLink href={draft.href} external={draft.isExternal} label="預覽" />
        {isDirty ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => setDraft(row)}>
            還原
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function RegulationsFormsEditor({
  groups,
  activeGroup,
  setActiveGroupId,
  saving,
  onRefresh,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onReorderGroups,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  uploadPdf,
}) {
  const [groupDraft, setGroupDraft] = useState({ titleZh: '', titleEn: '', isActive: true });
  const [groupEdits, setGroupEdits] = useState({});

  const [itemDraft, setItemDraft] = useState({
    titleZh: '',
    titleEn: '',
    fileUrl: '',
    isActive: true,
    uploadFile: null,
  });

  useEffect(() => {
    setItemDraft({ titleZh: '', titleEn: '', fileUrl: '', isActive: true, uploadFile: null });
  }, [activeGroup?.id]);

  useEffect(() => {
    const next = {};
    (groups || []).forEach((g) => {
      next[g.id] = {
        titleZh: g.titleZh || '',
        titleEn: g.titleEn || '',
        isActive: !!g.isActive,
        sortOrder: g.sortOrder ?? 0,
      };
    });
    setGroupEdits(next);
  }, [groups]);

  const orderedGroupIds = useMemo(() => sortBySortOrder(groups).map((g) => g.id), [groups]);
  const orderedItems = useMemo(() => (activeGroup?.items ? sortBySortOrder(activeGroup.items) : []), [activeGroup]);

  const reorderGroup = (groupId, dir) => {
    const ids = orderedGroupIds;
    const idx = ids.indexOf(groupId);
    const next = moveInArray(ids, idx, dir);
    if (!next) return;
    onReorderGroups(next).catch(() => {});
  };

  const reorderItems = (itemId, dir) => {
    const ids = orderedItems.map((it) => it.id);
    const idx = ids.indexOf(itemId);
    const next = moveInArray(ids, idx, dir);
    if (!next) return;
    onReorderItems(next).catch(() => {});
  };

  const handleUpload = async () => {
    if (!itemDraft.uploadFile) return;
    const res = await uploadPdf(itemDraft.uploadFile);
    setItemDraft((d) => ({ ...d, fileUrl: res.fileUrl }));
  };

  return (
    <div className="row g-4">
      <div className="col-md-4">
        <SectionCard
          title="群組"
          subtitle="先建立群組，再把 PDF 掛進去。每個群組都可獨立排序與啟用。"
          stats={[
            { label: '群組數', value: groups.length },
            { label: '啟用中', value: countActive(groups) },
          ]}
        >

          <div className="mb-3">
            <Field label="新增群組（ZH）">
              <input className="form-control form-control-sm" value={groupDraft.titleZh} onChange={(e) => setGroupDraft((d) => ({ ...d, titleZh: e.target.value }))} />
            </Field>
            <Field label="新增群組（EN）">
              <input className="form-control form-control-sm" value={groupDraft.titleEn} onChange={(e) => setGroupDraft((d) => ({ ...d, titleEn: e.target.value }))} />
            </Field>
            <div className="d-flex align-items-center gap-3 mb-2">
              <span className="small text-muted">啟用</span>
              <StatusSwitch value={groupDraft.isActive} onChange={(v) => setGroupDraft((d) => ({ ...d, isActive: v }))} />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!groupDraft.titleZh.trim() && !groupDraft.titleEn.trim()}
              onClick={async () => {
                await onCreateGroup({ ...groupDraft, sortOrder: groups.length, isActive: groupDraft.isActive });
                setGroupDraft({ titleZh: '', titleEn: '', isActive: true });
              }}
            >
              新增群組
            </button>
          </div>

          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            {sortBySortOrder(groups).map((g, idx) => (
              <div key={g.id} className={`page-content-admin__group-card ${String(g.id) === String(activeGroup?.id) ? 'is-active' : ''}`}>
                <button type="button" className="page-content-admin__group-pick" onClick={() => setActiveGroupId(String(g.id))}>
                  <div className="fw-semibold">{g.titleZh || g.titleEn || '(未命名)'}</div>
                  <div className="small text-muted">#{g.id} / {g.items?.length || 0} 筆 PDF</div>
                </button>
                <div className="row g-2 mt-1">
                  <div className="col-12">
                    <input
                      className="form-control form-control-sm"
                      placeholder="群組標題（ZH）"
                      value={groupEdits[g.id]?.titleZh || ''}
                      onChange={(e) => setGroupEdits((cur) => ({ ...cur, [g.id]: { ...cur[g.id], titleZh: e.target.value } }))}
                    />
                  </div>
                  <div className="col-12">
                    <input
                      className="form-control form-control-sm"
                      placeholder="群組標題（EN）"
                      value={groupEdits[g.id]?.titleEn || ''}
                      onChange={(e) => setGroupEdits((cur) => ({ ...cur, [g.id]: { ...cur[g.id], titleEn: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                  <span className="small text-muted">啟用</span>
                  <StatusSwitch
                    value={groupEdits[g.id]?.isActive}
                    onChange={(v) => setGroupEdits((cur) => ({ ...cur, [g.id]: { ...cur[g.id], isActive: v } }))}
                  />
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => reorderGroup(g.id, -1)} disabled={saving || idx === 0}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => reorderGroup(g.id, 1)} disabled={saving || idx === orderedGroupIds.length - 1}>
                    ↓
                  </button>
                </div>
                <div className="d-flex gap-2 mt-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={saving}
                    onClick={() => {
                      const patch = groupEdits[g.id] || {};
                      onUpdateGroup(g.id, {
                        titleZh: patch.titleZh || '',
                        titleEn: patch.titleEn || '',
                        isActive: !!patch.isActive,
                        sortOrder: patch.sortOrder ?? g.sortOrder ?? 0,
                      });
                    }}
                  >
                    儲存
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={saving}
                    onClick={() => {
                      // eslint-disable-next-line no-alert
                      const ok = window.confirm('確定刪除這個群組？（會連同其 PDF 項目一起刪除）');
                      if (!ok) return;
                      onDeleteGroup(g.id);
                    }}
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="col-md-8">
        <SectionCard
          title="群組項目"
          subtitle="上傳 PDF 後會拿到 fileUrl；建立項目時可直接檢查連結是否正確。"
          stats={[
            { label: '目前群組', value: activeGroup ? 1 : 0 },
            { label: 'PDF 數', value: orderedItems.length },
          ]}
        >
          {activeGroup ? (
            <>
              <div className="page-content-admin__composer">
              <div className="row g-3 align-items-end">
                <div className="col-md-4">
                  <Field label="項目標題（ZH）">
                    <input className="form-control form-control-sm" value={itemDraft.titleZh} onChange={(e) => setItemDraft((d) => ({ ...d, titleZh: e.target.value }))} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="項目標題（EN）">
                    <input className="form-control form-control-sm" value={itemDraft.titleEn} onChange={(e) => setItemDraft((d) => ({ ...d, titleEn: e.target.value }))} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="PDF 上傳">
                    <input className="form-control form-control-sm" type="file" accept="application/pdf" onChange={(e) => setItemDraft((d) => ({ ...d, uploadFile: e.target.files?.[0] || null }))} />
                  </Field>
                  <button type="button" className="btn btn-outline-secondary btn-sm w-100 mb-2" onClick={handleUpload} disabled={saving || !itemDraft.uploadFile}>
                    上傳取得 fileUrl
                  </button>
                  {itemDraft.uploadFile ? <div className="small text-muted">{itemDraft.uploadFile.name}</div> : null}
                </div>
                <div className="col-12">
                  <Field label="fileUrl">
                    <input className="form-control form-control-sm" value={itemDraft.fileUrl} onChange={(e) => setItemDraft((d) => ({ ...d, fileUrl: e.target.value }))} />
                  </Field>
                </div>
                <div className="col-md-2 d-flex align-items-center gap-2">
                  <span className="small text-muted">啟用</span>
                  <StatusSwitch value={itemDraft.isActive} onChange={(v) => setItemDraft((d) => ({ ...d, isActive: v }))} />
                </div>
                <div className="col-md-4">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-100"
                    disabled={saving || !itemDraft.fileUrl.trim()}
                    onClick={async () => {
                      await onCreateItem({
                        groupId: activeGroup.id,
                        titleZh: itemDraft.titleZh,
                        titleEn: itemDraft.titleEn,
                        fileUrl: itemDraft.fileUrl,
                        sortOrder: orderedItems.length,
                        isActive: itemDraft.isActive,
                      });
                      setItemDraft({ titleZh: '', titleEn: '', fileUrl: '', isActive: true, uploadFile: null });
                      onRefresh?.();
                    }}
                  >
                    新增 PDF 項目
                  </button>
                </div>
              </div>
              </div>

              <div className="table-responsive mt-4 page-content-admin__table-wrap">
                <table className="table table-sm align-middle page-content-admin__table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>標題(ZH)</th>
                      <th>標題(EN)</th>
                      <th>fileUrl</th>
                      <th>啟用</th>
                      <th>排序</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedItems.map((it, idx) => (
                      <RegulationsItemRow
                        key={it.id}
                        row={it}
                        saving={saving}
                        index={idx}
                        onUpsert={(payload) => onUpdateItem(it.id, payload)}
                        onDelete={() => onDeleteItem(it.id)}
                        onReorder={(dir) => reorderItems(it.id, dir)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-muted">請先選擇群組</div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function RegulationsItemRow({ row, onUpsert, onDelete, onReorder, saving, index }) {
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);

  const isDirty =
    JSON.stringify({
      titleZh: draft.titleZh || '',
      titleEn: draft.titleEn || '',
      fileUrl: draft.fileUrl || '',
      isActive: !!draft.isActive,
    }) !==
    JSON.stringify({
      titleZh: row.titleZh || '',
      titleEn: row.titleEn || '',
      fileUrl: row.fileUrl || '',
      isActive: !!row.isActive,
    });

  return (
    <tr>
      <td className="text-muted">{index + 1}</td>
      <td>
        <input className="form-control form-control-sm" value={draft.titleZh || ''} onChange={(e) => setDraft((d) => ({ ...d, titleZh: e.target.value }))} />
      </td>
      <td>
        <input className="form-control form-control-sm" value={draft.titleEn || ''} onChange={(e) => setDraft((d) => ({ ...d, titleEn: e.target.value }))} />
      </td>
      <td>
        <input className="form-control form-control-sm" value={draft.fileUrl || ''} onChange={(e) => setDraft((d) => ({ ...d, fileUrl: e.target.value }))} />
      </td>
      <td>
        <StatusSwitch value={draft.isActive} onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} />
      </td>
      <td className="text-muted">{draft.sortOrder ?? 0}</td>
      <td className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onReorder(-1)} disabled={saving}>
          ↑
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onReorder(1)} disabled={saving}>
          ↓
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => onUpsert({ ...draft, sortOrder: draft.sortOrder ?? 0 })}>
          儲存
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" disabled={saving} onClick={onDelete}>
          刪除
        </button>
        <PreviewLink href={draft.fileUrl} external label="預覽 PDF" />
        {isDirty ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => setDraft(row)}>
            還原
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function ScrollWorldEditor({ segments, saving, onSave, onReorder }) {
  const [local, setLocal] = useState(segments);
  useEffect(() => setLocal(segments), [segments]);

  const ids = useMemo(() => segments.map((s) => s.sectionId), [segments]);

  const move = (sectionId, dir) => {
    const idx = ids.indexOf(sectionId);
    const next = moveInArray(ids, idx, dir);
    if (!next) return;
    onReorder(next);
  };

  return (
    <div className="row g-4">
      {local.map((seg, idx) => (
        <div className="col-12" key={seg.sectionId}>
          <SectionCard
            title={`${idx + 1}. ${seg.labelZh || seg.labelEn || seg.sectionId}`}
            subtitle={`sectionId: ${seg.sectionId}`}
            stats={[
              { label: '排序', value: idx + 1 },
              { label: '狀態', value: seg.isActive ? '顯示中' : '停用' },
            ]}
          >
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div />
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">啟用</span>
                <StatusSwitch
                  value={seg.isActive}
                  onChange={(v) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, isActive: v } : x)))}
                />
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => move(seg.sectionId, -1)} disabled={saving || idx === 0}>
                  ↑
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => move(seg.sectionId, 1)} disabled={saving || idx === ids.length - 1}>
                  ↓
                </button>
              </div>
            </div>

            <div className="row g-3 mt-2">
              <div className="col-md-3">
                <Field label="標籤（ZH）">
                  <input className="form-control form-control-sm" value={seg.labelZh || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, labelZh: e.target.value } : x)))} />
                </Field>
              </div>
              <div className="col-md-3">
                <Field label="標籤（EN）">
                  <input className="form-control form-control-sm" value={seg.labelEn || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, labelEn: e.target.value } : x)))} />
                </Field>
              </div>
              <div className="col-md-6">
                <Field label="標題（ZH/EN 目前同時可填）">
                  <input className="form-control form-control-sm mb-2" value={seg.titleZh || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, titleZh: e.target.value } : x)))} placeholder="titleZh" />
                  <input className="form-control form-control-sm" value={seg.titleEn || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, titleEn: e.target.value } : x)))} placeholder="titleEn" />
                </Field>
              </div>
              <div className="col-12">
                <Field label="內文（ZH/EN）">
                  <textarea className="form-control form-control-sm mb-2" rows={3} value={seg.bodyZh || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, bodyZh: e.target.value } : x)))} />
                  <textarea className="form-control form-control-sm" rows={3} value={seg.bodyEn || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, bodyEn: e.target.value } : x)))} />
                </Field>
              </div>
              <div className="col-md-4">
                <Field label="Primary CTA label（ZH）">
                  <input className="form-control form-control-sm" value={seg.primaryCtaLabelZh || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, primaryCtaLabelZh: e.target.value } : x)))} />
                </Field>
              </div>
              <div className="col-md-4">
                <Field label="Primary CTA label（EN）">
                  <input className="form-control form-control-sm" value={seg.primaryCtaLabelEn || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, primaryCtaLabelEn: e.target.value } : x)))} />
                </Field>
              </div>
              <div className="col-md-4">
                <Field label="Primary CTA href（可填內部/外部 URL）">
                  <input className="form-control form-control-sm" value={seg.primaryCtaHref || ''} onChange={(e) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, primaryCtaHref: e.target.value } : x)))} />
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <span className="small text-muted">外部</span>
                    <StatusSwitch value={seg.primaryCtaIsExternal} onChange={(v) => setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, primaryCtaIsExternal: v } : x)))} />
                  </div>
                </Field>
              </div>
              <div className="col-12">
                <div className="fw-semibold mb-2">Secondary CTA（可多筆）</div>
                <div className="d-flex flex-column gap-2">
                  {(seg.secondaryCtas || []).map((cta, ctaIndex) => (
                    <div key={`${cta.href || ''}-${ctaIndex}`} className="border rounded p-2">
                      <div className="row g-2 align-items-end">
                        <div className="col-md-4">
                          <Field label="labelZh">
                            <input
                              className="form-control form-control-sm"
                              value={cta.labelZh || ''}
                              onChange={(e) => {
                                const next = (seg.secondaryCtas || []).map((x, i) =>
                                  i === ctaIndex ? { ...x, labelZh: e.target.value } : x,
                                );
                                setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, secondaryCtas: next } : x)));
                              }}
                            />
                          </Field>
                        </div>
                        <div className="col-md-4">
                          <Field label="labelEn">
                            <input
                              className="form-control form-control-sm"
                              value={cta.labelEn || ''}
                              onChange={(e) => {
                                const next = (seg.secondaryCtas || []).map((x, i) =>
                                  i === ctaIndex ? { ...x, labelEn: e.target.value } : x,
                                );
                                setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, secondaryCtas: next } : x)));
                              }}
                            />
                          </Field>
                        </div>
                        <div className="col-md-3">
                          <Field label="href">
                            <input
                              className="form-control form-control-sm"
                              value={cta.href || ''}
                              onChange={(e) => {
                                const next = (seg.secondaryCtas || []).map((x, i) =>
                                  i === ctaIndex ? { ...x, href: e.target.value } : x,
                                );
                                setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, secondaryCtas: next } : x)));
                              }}
                            />
                          </Field>
                        </div>
                        <div className="col-md-1 d-flex align-items-center justify-content-center">
                          <div className="d-flex flex-column align-items-center gap-2">
                            <StatusSwitch
                              value={cta.isExternal}
                              onChange={(v) => {
                                const next = (seg.secondaryCtas || []).map((x, i) =>
                                  i === ctaIndex ? { ...x, isExternal: v } : x,
                                );
                                setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, secondaryCtas: next } : x)));
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => {
                                const next = (seg.secondaryCtas || []).filter((_, i) => i !== ctaIndex);
                                setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, secondaryCtas: next } : x)));
                              }}
                            >
                              刪
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm mt-3"
                  onClick={() => {
                    const next = [...(seg.secondaryCtas || [])];
                    next.push({ labelZh: '', labelEn: '', href: '', isExternal: false });
                    setLocal((cur) => cur.map((x) => (x.sectionId === seg.sectionId ? { ...x, secondaryCtas: next } : x)));
                  }}
                >
                  新增 Secondary CTA
                </button>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={saving}
                onClick={() => {
                  const payload = local.find((x) => x.sectionId === seg.sectionId);
                  onSave(seg.sectionId, {
                    labelZh: payload.labelZh,
                    labelEn: payload.labelEn,
                    titleZh: payload.titleZh,
                    titleEn: payload.titleEn,
                    bodyZh: payload.bodyZh,
                    bodyEn: payload.bodyEn,
                    primaryCtaLabelZh: payload.primaryCtaLabelZh,
                    primaryCtaLabelEn: payload.primaryCtaLabelEn,
                    primaryCtaHref: payload.primaryCtaHref,
                    primaryCtaIsExternal: payload.primaryCtaIsExternal,
                    secondaryCtas: payload.secondaryCtas || [],
                    isActive: payload.isActive,
                  });
                }}
              >
                儲存段落
              </button>
            </div>
          </SectionCard>
        </div>
      ))}
    </div>
  );
}

function slugifyKey(text) {
  const base = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `item-${Date.now()}`;
}

function CourseGuideEditor({
  sections,
  activeSection,
  setActiveSectionId,
  saving,
  onCreateSection,
  onUpdateSection,
  onDeleteSection,
  onReorderSections,
  onCreateTopic,
  onUpdateTopic,
  onDeleteTopic,
  onReorderTopics,
}) {
  const [sectionDraft, setSectionDraft] = useState({
    titleZh: '',
    titleEn: '',
    introZh: '',
    introEn: '',
    isActive: true,
    showAdvanced: false,
    sectionKey: '',
  });
  const [sectionEdits, setSectionEdits] = useState({});
  const [topicDraft, setTopicDraft] = useState({
    titleZh: '',
    titleEn: '',
    defaultOpen: false,
    isActive: true,
    blocks: [],
    showAdvanced: false,
    topicKey: '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const next = {};
    (sections || []).forEach((s) => {
      next[s.id] = {
        sectionKey: s.sectionKey || '',
        titleZh: s.titleZh || '',
        titleEn: s.titleEn || '',
        introZh: s.introZh || '',
        introEn: s.introEn || '',
        isActive: !!s.isActive,
      };
    });
    setSectionEdits(next);
  }, [sections]);

  useEffect(() => {
    setTopicDraft({
      titleZh: '',
      titleEn: '',
      defaultOpen: false,
      isActive: true,
      blocks: [],
      showAdvanced: false,
      topicKey: '',
    });
    setFormError('');
  }, [activeSection?.id]);

  const orderedSectionIds = useMemo(() => sortBySortOrder(sections).map((s) => s.id), [sections]);
  const orderedTopics = useMemo(
    () => (activeSection?.topics ? sortBySortOrder(activeSection.topics) : []),
    [activeSection],
  );

  const reorderSection = (sectionId, dir) => {
    const idx = orderedSectionIds.indexOf(sectionId);
    const next = moveInArray(orderedSectionIds, idx, dir);
    if (!next) return;
    onReorderSections(next).catch(() => {});
  };

  const reorderTopic = (topicId, dir) => {
    const ids = orderedTopics.map((t) => t.id);
    const idx = ids.indexOf(topicId);
    const next = moveInArray(ids, idx, dir);
    if (!next) return;
    onReorderTopics(next).catch(() => {});
  };

  return (
    <div className="row g-4">
      <div className="col-md-4">
        <SectionCard
          title="大章節"
          subtitle="對應前台左側大摺疊，例如修課說明、抵免、認證、歷程檔案。"
          stats={[
            { label: '章節數', value: sections.length },
            { label: '啟用中', value: countActive(sections) },
          ]}
        >
          <div className="mb-3">
            <Field label="章節標題（中文）">
              <input
                className="form-control form-control-sm"
                value={sectionDraft.titleZh}
                onChange={(e) => setSectionDraft((d) => ({ ...d, titleZh: e.target.value }))}
                placeholder="例如：抵免標準"
              />
            </Field>
            <Field label="章節標題（英文）">
              <input
                className="form-control form-control-sm"
                value={sectionDraft.titleEn}
                onChange={(e) => setSectionDraft((d) => ({ ...d, titleEn: e.target.value }))}
              />
            </Field>
            <div className="d-flex align-items-center gap-3 mb-2">
              <span className="small text-muted">啟用（關掉後學生看不到）</span>
              <StatusSwitch
                value={sectionDraft.isActive}
                onChange={(v) => setSectionDraft((d) => ({ ...d, isActive: v }))}
              />
            </div>
            <details className="mb-2">
              <summary className="small text-muted" style={{ cursor: 'pointer' }}>
                進階選項
              </summary>
              <Field label="系統識別碼（可留空自動產生）">
                <input
                  className="form-control form-control-sm"
                  value={sectionDraft.sectionKey}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, sectionKey: e.target.value }))}
                  placeholder="自動產生"
                />
              </Field>
            </details>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving || !sectionDraft.titleZh.trim()}
              onClick={async () => {
                const key = sectionDraft.sectionKey.trim() || slugifyKey(sectionDraft.titleZh);
                await onCreateSection({
                  ...sectionDraft,
                  sectionKey: key,
                  sortOrder: sections.length,
                });
                setSectionDraft({
                  titleZh: '',
                  titleEn: '',
                  introZh: '',
                  introEn: '',
                  isActive: true,
                  showAdvanced: false,
                  sectionKey: '',
                });
              }}
            >
              新增大章節
            </button>
          </div>

          <div style={{ maxHeight: 560, overflow: 'auto' }}>
            {sortBySortOrder(sections).map((s) => (
              <div
                key={s.id}
                className={`page-content-admin__group-card ${String(s.id) === String(activeSection?.id) ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className="page-content-admin__group-pick"
                  onClick={() => setActiveSectionId(String(s.id))}
                >
                  <div className="fw-semibold">{s.titleZh || s.titleEn || '（未命名）'}</div>
                  <div className="small text-muted">{s.topics?.length || 0} 個細項</div>
                </button>
                <div className="row g-2 mt-1">
                  <div className="col-12">
                    <input
                      className="form-control form-control-sm"
                      placeholder="標題（中文）"
                      value={sectionEdits[s.id]?.titleZh || ''}
                      onChange={(e) =>
                        setSectionEdits((cur) => ({ ...cur, [s.id]: { ...cur[s.id], titleZh: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="col-12">
                    <input
                      className="form-control form-control-sm"
                      placeholder="標題（英文）"
                      value={sectionEdits[s.id]?.titleEn || ''}
                      onChange={(e) =>
                        setSectionEdits((cur) => ({ ...cur, [s.id]: { ...cur[s.id], titleEn: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="col-12">
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="章節說明（中文，顯示在細項上方）"
                      value={sectionEdits[s.id]?.introZh || ''}
                      onChange={(e) =>
                        setSectionEdits((cur) => ({ ...cur, [s.id]: { ...cur[s.id], introZh: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="col-12">
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="章節說明（英文）"
                      value={sectionEdits[s.id]?.introEn || ''}
                      onChange={(e) =>
                        setSectionEdits((cur) => ({ ...cur, [s.id]: { ...cur[s.id], introEn: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="col-12 d-flex align-items-center gap-2 flex-wrap">
                    <StatusSwitch
                      value={!!sectionEdits[s.id]?.isActive}
                      onChange={(v) =>
                        setSectionEdits((cur) => ({ ...cur, [s.id]: { ...cur[s.id], isActive: v } }))
                      }
                    />
                    <span className="small text-muted">啟用</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={saving}
                      onClick={() => reorderSection(s.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={saving}
                      onClick={() => reorderSection(s.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={saving}
                      onClick={() => onUpdateSection(s.id, sectionEdits[s.id])}
                    >
                      儲存
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={saving}
                      onClick={() => onDeleteSection(s.id)}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="col-md-8">
        {!activeSection ? (
          <EmptyState title="請先選擇左側大章節" hint="點選或新增大章節後，即可新增學年度／細項與圖文。" />
        ) : (
          <SectionCard
            title={`細項 · ${activeSection.titleZh || '未命名'}`}
            subtitle="每個細項對應前台一個可展開列（例如某個學年度）。用下方表單編輯圖文。"
            stats={[
              { label: '細項數', value: orderedTopics.length },
              { label: '啟用中', value: countActive(orderedTopics) },
            ]}
          >
            {formError ? (
              <div className="alert alert-danger py-2 px-3 small" role="alert">
                {formError}
              </div>
            ) : null}

            <div className="page-content-admin__composer mb-3">
              <div className="row g-2">
                <div className="col-md-4">
                  <Field label="細項標題（中文）">
                    <input
                      className="form-control form-control-sm"
                      value={topicDraft.titleZh}
                      onChange={(e) => setTopicDraft((d) => ({ ...d, titleZh: e.target.value }))}
                      placeholder="例如：112-115 學年度入學生"
                    />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="細項標題（英文）">
                    <input
                      className="form-control form-control-sm"
                      value={topicDraft.titleEn}
                      onChange={(e) => setTopicDraft((d) => ({ ...d, titleEn: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="col-md-2">
                  <Field label="預設展開">
                    <StatusSwitch
                      value={topicDraft.defaultOpen}
                      onChange={(v) => setTopicDraft((d) => ({ ...d, defaultOpen: v }))}
                    />
                  </Field>
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-100"
                    disabled={saving || !topicDraft.titleZh.trim()}
                    onClick={async () => {
                      setFormError('');
                      await onCreateTopic({
                        sectionId: activeSection.id,
                        topicKey: topicDraft.topicKey.trim() || slugifyKey(topicDraft.titleZh),
                        titleZh: topicDraft.titleZh,
                        titleEn: topicDraft.titleEn,
                        defaultOpen: topicDraft.defaultOpen,
                        isActive: topicDraft.isActive,
                        blocks: Array.isArray(topicDraft.blocks) ? topicDraft.blocks : [],
                      });
                    }}
                  >
                    新增細項
                  </button>
                </div>
                <div className="col-12">
                  <details>
                    <summary className="small text-muted mb-2" style={{ cursor: 'pointer' }}>
                      進階：自訂識別碼
                    </summary>
                    <Field label="系統識別碼（可留空）">
                      <input
                        className="form-control form-control-sm"
                        value={topicDraft.topicKey}
                        onChange={(e) => setTopicDraft((d) => ({ ...d, topicKey: e.target.value }))}
                      />
                    </Field>
                  </details>
                </div>
                <div className="col-12">
                  <div className="small fw-semibold mb-2">細項內容（可先空白，之後再編）</div>
                  <CourseGuideBlocksEditor
                    value={topicDraft.blocks}
                    onChange={(blocks) => setTopicDraft((d) => ({ ...d, blocks }))}
                  />
                </div>
              </div>
            </div>

            {orderedTopics.length === 0 ? (
              <EmptyState title="此章節尚無細項" hint="新增學年度或細項後，可在下方用表單編輯圖文。" />
            ) : (
              <div className="d-flex flex-column gap-3">
                {orderedTopics.map((topic, index) => (
                  <CourseGuideTopicRow
                    key={topic.id}
                    topic={topic}
                    index={index}
                    saving={saving}
                    onSave={(payload) => onUpdateTopic(topic.id, payload)}
                    onDelete={() => onDeleteTopic(topic.id)}
                    onReorder={(dir) => reorderTopic(topic.id, dir)}
                    onError={setFormError}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function CourseGuideTopicRow({ topic, index, saving, onSave, onDelete, onReorder, onError }) {
  const [draft, setDraft] = useState(() => ({
    topicKey: topic.topicKey || '',
    titleZh: topic.titleZh || '',
    titleEn: topic.titleEn || '',
    defaultOpen: !!topic.defaultOpen,
    isActive: !!topic.isActive,
    blocks: Array.isArray(topic.blocks) ? topic.blocks : [],
  }));

  useEffect(() => {
    setDraft({
      topicKey: topic.topicKey || '',
      titleZh: topic.titleZh || '',
      titleEn: topic.titleEn || '',
      defaultOpen: !!topic.defaultOpen,
      isActive: !!topic.isActive,
      blocks: Array.isArray(topic.blocks) ? topic.blocks : [],
    });
  }, [topic]);

  return (
    <div className="page-content-admin__group-card">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div className="fw-semibold">
            #{index + 1} {topic.titleZh || '（未命名）'}
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => onReorder(-1)}>
            ↑
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => onReorder(1)}>
            ↓
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={saving}
            onClick={() => {
              onError?.('');
              onSave({
                topicKey: draft.topicKey || slugifyKey(draft.titleZh),
                titleZh: draft.titleZh,
                titleEn: draft.titleEn,
                defaultOpen: draft.defaultOpen,
                isActive: draft.isActive,
                blocks: Array.isArray(draft.blocks) ? draft.blocks : [],
              });
            }}
          >
            儲存
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" disabled={saving} onClick={onDelete}>
            刪除
          </button>
        </div>
      </div>
      <div className="row g-2">
        <div className="col-md-5">
          <Field label="標題（中文）">
            <input
              className="form-control form-control-sm"
              value={draft.titleZh}
              onChange={(e) => setDraft((d) => ({ ...d, titleZh: e.target.value }))}
            />
          </Field>
        </div>
        <div className="col-md-5">
          <Field label="標題（英文）">
            <input
              className="form-control form-control-sm"
              value={draft.titleEn}
              onChange={(e) => setDraft((d) => ({ ...d, titleEn: e.target.value }))}
            />
          </Field>
        </div>
        <div className="col-md-1">
          <Field label="預開">
            <StatusSwitch value={draft.defaultOpen} onChange={(v) => setDraft((d) => ({ ...d, defaultOpen: v }))} />
          </Field>
        </div>
        <div className="col-md-1">
          <Field label="啟用">
            <StatusSwitch value={draft.isActive} onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} />
          </Field>
        </div>
        <div className="col-12">
          <details className="mb-2">
            <summary className="small text-muted" style={{ cursor: 'pointer' }}>
              進階：系統識別碼
            </summary>
            <Field label="識別碼">
              <input
                className="form-control form-control-sm"
                value={draft.topicKey}
                onChange={(e) => setDraft((d) => ({ ...d, topicKey: e.target.value }))}
              />
            </Field>
          </details>
        </div>
        <div className="col-12">
          <div className="small fw-semibold mb-2">圖文內容</div>
          <CourseGuideBlocksEditor
            value={draft.blocks}
            onChange={(blocks) => setDraft((d) => ({ ...d, blocks }))}
          />
        </div>
      </div>
    </div>
  );
}

