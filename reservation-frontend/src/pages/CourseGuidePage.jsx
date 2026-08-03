import React, { useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import './CourseGuidePage.css';

const SOURCE_LINKS = [
  {
    label: '修課說明與入學門檻（總覽頁）',
    href: 'https://emicenter.siwan.nsysu.edu.tw/graduation-threshold',
  },
  {
    label: '以英語文測驗抵免課程資格（抵免標準）',
    href: 'https://emicenter.siwan.nsysu.edu.tw/graduation-threshold/1/2',
  },
  {
    label: '英語能力標準認證（認證說明）',
    href: 'https://emicenter.siwan.nsysu.edu.tw/graduation-threshold/1/4',
  },
  {
    label: '英語實踐歷程檔案（點數計算與申請）',
    href: 'https://emicenter.siwan.nsysu.edu.tw/graduation-threshold/1/5',
  },
];

const SECTION_DEFS = [
  {
    id: 'course-rules',
    title: '修課說明（依入學學年度）',
  },
  {
    id: 'credit-waiver',
    title: '英語文測驗抵免課程資格',
  },
  {
    id: 'certification',
    title: '英語能力標準認證',
  },
  {
    id: 'practice-portfolio',
    title: '英語實踐歷程檔案（100 點）',
  },
];

/**
 * 修課說明 — 整理版（對應 EMI graduation-threshold 官方內容）
 */
export default function CourseGuidePage() {
  const breadcrumbs = useMemo(
    () => [
      { label: '首頁', path: '/' },
      { label: '修課說明' },
    ],
    [],
  );

  // 預設全部收合
  const [openSections, setOpenSections] = useState(() => new Set());

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const openSection = (sectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`course-guide-trigger-${sectionId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const allExpanded = openSections.size === SECTION_DEFS.length;

  const expandAll = () => setOpenSections(new Set(SECTION_DEFS.map((s) => s.id)));
  const collapseAll = () => setOpenSections(new Set());

  return (
    <div className="course-guide-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        variant="editorial"
        title="修課說明"
        lead="依西灣學院官方 graduation-threshold 內容整理：修課方式、抵免標準、英語能力標準認證、以及英語實踐歷程檔案點數計算。"
      />

      <section className="course-guide-standard" aria-labelledby="course-guide-standard-title">
        <h2 id="course-guide-standard-title" className="course-guide-standard__title">
          【英文畢業標準：修課＋英檢】
        </h2>

        <div className="course-guide-standard__row">
          <div className="course-guide-standard__card">
            <div className="course-guide-standard__card-head">
              達中高級程度 共<span className="course-guide-standard__em">6</span>學分
            </div>
            <div className="course-guide-standard__card-body">
              <p>通識英文一堂 3學分</p>
              <span className="course-guide-standard__plus-sm" aria-hidden="true">+</span>
              <p>跨院EAP/ESP一堂 3學分</p>
            </div>
          </div>

          <span className="course-guide-standard__plus" aria-hidden="true">+</span>

          <div className="course-guide-standard__card">
            <div className="course-guide-standard__card-head">英語能力標準認證</div>
            <div className="course-guide-standard__card-body">
              <button
                type="button"
                className="course-guide-standard__link"
                onClick={() => openSection('certification')}
              >
                英文檢定成績
              </button>
              <p className="course-guide-standard__or">或</p>
              <button
                type="button"
                className="course-guide-standard__link"
                onClick={() => openSection('practice-portfolio')}
              >
                英語實踐歷程
                <span className="course-guide-standard__em">（集滿100點）</span>
              </button>
            </div>
          </div>
        </div>

        <div className="course-guide-standard__meta">
          <div className="course-guide-standard__defs">
            <p>
              學術英語: <span className="course-guide-standard__initial">E</span>nglish for{' '}
              <span className="course-guide-standard__initial">A</span>cademic{' '}
              <span className="course-guide-standard__initial">P</span>urpose
            </p>
            <p>
              專業英語: <span className="course-guide-standard__initial">E</span>nglish for{' '}
              <span className="course-guide-standard__initial">S</span>pecific{' '}
              <span className="course-guide-standard__initial">P</span>urpose
            </p>
          </div>
          <p className="course-guide-standard__note">*外文系學生另訂</p>
        </div>
      </section>

      <div className="course-guide-toolbar">
        <div className="course-guide-toolbar__left">
          <span className="course-guide-toolbar__chip" aria-hidden="true">
            官方摘要
          </span>
          <span className="course-guide-toolbar__text">
            共 {SECTION_DEFS.length} 大章節，預設全部收合
          </span>
        </div>

        <div className="course-guide-toolbar__actions">
          <button
            type="button"
            className="course-guide-toolbar__btn"
            onClick={expandAll}
            disabled={allExpanded}
          >
            全部展開
          </button>
          <button
            type="button"
            className="course-guide-toolbar__btn"
            onClick={collapseAll}
            disabled={openSections.size === 0}
          >
            全部收合
          </button>
        </div>
      </div>

      <div className="course-guide-accordion">
        {SECTION_DEFS.map((section) => {
          const isOpen = openSections.has(section.id);
          const panelId = `course-guide-panel-${section.id}`;
          const triggerId = `course-guide-trigger-${section.id}`;

          return (
            <section
              key={section.id}
              className={`course-guide-accordion-item${isOpen ? ' is-open' : ''}`}
            >
              <button
                type="button"
                id={triggerId}
                className="course-guide-accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleSection(section.id)}
              >
                <span className="course-guide-accordion-trigger__title">{section.title}</span>
                <span className="course-guide-accordion-trigger__icon" aria-hidden="true" />
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="course-guide-accordion-panel"
                aria-hidden={!isOpen}
              >
                <div className="course-guide-accordion-panel__inner">
                  {section.id === 'course-rules' ? (
                    <div className="course-guide-content">
                      <div className="course-guide-subcard course-guide-subcard--flush">
                        <p className="course-guide-p course-guide-p--muted">
                          依入學學年度展開查看。圖表取自官方畢業門檻說明，可點圖放大檢視。
                        </p>

                        <details className="course-guide-details" open>
                          <summary className="course-guide-details__summary">
                            112-115 學年度入學生
                          </summary>
                          <div className="course-guide-details__body">
                            <figure className="course-guide-figure">
                              <a
                                href="/images/course-guide/diagram-112-115.jpg"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src="/images/course-guide/diagram-112-115.jpg"
                                  alt="112-115 學年度大學部學生英語能力培育與檢核機制"
                                  loading="lazy"
                                />
                              </a>
                              <figcaption>112-115 學年度英語修課路徑與認證圖解</figcaption>
                            </figure>

                            <p className="course-guide-p">
                              入學後依英文分級，需修畢「語文素養：英語文」領域必修課程一門，
                              以及一門學術英文 EAP（English for Academic Purposes）或專業英文 ESP（English for Specific Purposes）跨院選修課程，並通過本校「英語文能力標準認證」，方得畢業。
                            </p>

                            <h4 className="course-guide-h4">英語文分級</h4>
                            <ul className="course-guide-ul">
                              <li>一般入學生：依學測、指考等英語成績分為初級、中級、中高級、高級。</li>
                              <li>轉學生：可依英檢成績申請分級變更，或申請分級變更考試；未辦理者自動分為初級。</li>
                            </ul>

                            <h4 className="course-guide-h4">各級修課方式</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>初級：先修初級通識英文（0 學分）→ 中級通識英文 → 中高級 EAP/ESP</li>
                              <li>中級：中級通識英文 → 中高級 EAP/ESP</li>
                              <li>中高級：中高級通識英文 → 高級 EAP/ESP</li>
                              <li>高級：高級 EAP/ESP</li>
                            </ul>

                            <div className="course-guide-callout">
                              <div className="course-guide-callout__title">注意事項（112-115）</div>
                              <ul className="course-guide-ul course-guide-ul--tight">
                                <li>必須先修通識英文，並於不同學期逐級修課。</li>
                                <li>開始修課之前，每位同學只有 1 次變更分級機會。</li>
                              </ul>
                            </div>

                            <h4 className="course-guide-h4">變更分級（1 次）</h4>
                            <p className="course-guide-p">
                              請攜帶「通識英語文課程分級變更學生申請表」及 2 年內多益成績單正本 + 影本至全英語卓越教學中心（圖資 10 樓西灣學院聯合辦公室）。
                            </p>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>變更為中級：TOEIC 550</li>
                              <li>變更為中高級：TOEIC 600</li>
                              <li>變更為高級：TOEIC 700</li>
                            </ul>
                            <p className="course-guide-p">
                              修課之後則無法再變更分級；在學期間僅得變更分級一次。本申請原則上僅受理於每學期開學前至初選階段為止，逾期概不受理。
                            </p>
                          </div>
                        </details>

                        <details className="course-guide-details">
                          <summary className="course-guide-details__summary">
                            111 學年度入學生
                          </summary>
                          <div className="course-guide-details__body">
                            <p className="course-guide-p">
                              依英文分級，需修畢「語文素養：英語文」領域必修課程（對應級數）一門，
                              以及一門學術英文 EAP 或專業英文 ESP 跨院選修課程，並通過本校「英語文能力標準認證」，方得畢業。
                            </p>

                            <h4 className="course-guide-h4">英語文分級與轉學生</h4>
                            <ul className="course-guide-ul">
                              <li>一般入學生：依學測、指考等英語成績分為初級、中級、中高級、高級。</li>
                              <li>
                                轉學生：可依英檢成績單進行分級變更，或向中心申請參加分級變更考試；未辦理者自動分為初級。
                              </li>
                            </ul>

                            <h4 className="course-guide-h4">各級修課方式</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>初級：英文初級（0 學分）→ 中級 EAP/ESP 或英文中級 → 中高級 EAP/ESP 或英文中高級</li>
                              <li>中級：中級 EAP/ESP 或英文中級 → 中高級英文或中高級 EAP/ESP</li>
                              <li>中高級：英文中高級或中高級 EAP/ESP → 高級 EAP/ESP</li>
                              <li>高級：高級 EAP/ESP</li>
                            </ul>

                            <div className="course-guide-callout">
                              <div className="course-guide-callout__title">注意事項（111）</div>
                              <ul className="course-guide-ul course-guide-ul--tight">
                                <li>
                                  分到初級的同學，必須先修習英文初級，通過之後才能修習中級和中高級的 EAP/ESP 及通識英文課程。
                                </li>
                              </ul>
                            </div>

                            <h4 className="course-guide-h4">變更分級（1 次）</h4>
                            <p className="course-guide-p">
                              請攜帶「通識英語文課程分級變更學生申請表」及 2 年內多益成績單正本 + 影本至全英語卓越教學中心（圖資 10 樓西灣學院聯合辦公室）。
                            </p>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>變更為中級：TOEIC 550</li>
                              <li>變更為中高級：TOEIC 600</li>
                              <li>變更為高級：TOEIC 700</li>
                            </ul>
                            <p className="course-guide-p">
                              修課之後則無法變更分級；在學期間僅得變更分級一次。本申請原則上僅受理於每學期開學前至初選階段為止，逾期概不受理。
                            </p>
                          </div>
                        </details>

                        <details className="course-guide-details">
                          <summary className="course-guide-details__summary">
                            110 學年度入學生（含以前）
                          </summary>
                          <div className="course-guide-details__body">
                            <figure className="course-guide-figure">
                              <a
                                href="/images/course-guide/diagram-110.png"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src="/images/course-guide/diagram-110.png"
                                  alt="110 學年度英語能力培育與檢核機制流程圖"
                                  loading="lazy"
                                />
                              </a>
                              <figcaption>110 學年度大學部學生英語能力培育與檢核機制</figcaption>
                            </figure>

                            <p className="course-guide-p">
                              入學後依英文分級，需修畢相應級數之「語文素養：英語文」領域必修課程，並通過本校「英語文能力標準認證」，方得畢業。
                            </p>

                            <h4 className="course-guide-h4">英語文分級</h4>
                            <ul className="course-guide-ul">
                              <li>一般入學生：依學測、指考等英語成績分為初級、中級、中高級、高級。</li>
                              <li>
                                轉學生（含繁星、特殊選材等非以學測、指考方式入學）：依開學第一週轉學生分級測驗結果分級；未參加者自動分為初級。
                              </li>
                            </ul>

                            <h4 className="course-guide-h4">各級修課方式</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>初級：先修英文初級（0 學分）→ 英文中級 + 英文中高級</li>
                              <li>中級：英文中級 + 英文中高級</li>
                              <li>中高級：英文中高級 + 英文高級</li>
                              <li>高級：英文高級</li>
                            </ul>

                            <div className="course-guide-callout">
                              <div className="course-guide-callout__title">注意事項（110）</div>
                              <ul className="course-guide-ul course-guide-ul--tight">
                                <li>
                                  分到初級的同學，必須先修習英文初級，通過之後才能修習其他相對應級別。
                                </li>
                              </ul>
                            </div>

                            <h4 className="course-guide-h4">變更分級（1 次）</h4>
                            <p className="course-guide-p">
                              請攜帶「通識英語文課程分級變更學生申請表」及 2 年內多益成績單正本 + 影本至全英語卓越教學中心（圖資 10 樓西灣學院聯合辦公室）。
                            </p>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>變更為中級：TOEIC 550</li>
                              <li>變更為中高級：TOEIC 600</li>
                              <li>變更為高級：TOEIC 700</li>
                            </ul>
                            <p className="course-guide-p">
                              修課之後則無法變更分級；在學期間僅得變更分級一次。本申請原則上僅受理於每學期開學前至初選階段為止，逾期概不受理。
                            </p>
                          </div>
                        </details>
                      </div>
                    </div>
                  ) : null}

                  {section.id === 'credit-waiver' ? (
                    <div className="course-guide-content">
                      <div className="course-guide-subcard course-guide-subcard--flush">
                        <p className="course-guide-p course-guide-p--muted">
                          以下抵免標準以官方 graduation-threshold/1/2 內容整理。外文系學生及非學士班之英語文修課／認證仍以各自規定為準。
                        </p>

                        <details className="course-guide-details" open>
                          <summary className="course-guide-details__summary">
                            113 學年度入學生（抵免標準）
                          </summary>
                          <div className="course-guide-details__body">
                            <h4 className="course-guide-h4">抵免標準</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>GEPT：中高級複試（含）以上</li>
                              <li>TOEFL ITP：527 分（含）以上</li>
                              <li>TOEFL iBT：71 分（含）以上</li>
                              <li>TOEIC（聽力與閱讀）：785 分（含）以上</li>
                              <li>TOEIC（口說與寫作）：310 分（含）以上</li>
                              <li>IELTS：5.5 級（含）以上</li>
                              <li>BESTEP：B2（含）以上</li>
                            </ul>

                            <h4 className="course-guide-h4">應備文件</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>「英語文課程」抵免學分申請表（113 學年度起入學生適用）</li>
                              <li>兩年內有效之測驗成績單正本（需達抵免標準）</li>
                              <li>測驗成績單影本</li>
                            </ul>

                            <h4 className="course-guide-h4">抵免手續</h4>
                            <p className="course-guide-p">
                              依每學期全英文卓越教學中心公告抵免時間，攜應備文件（共 3 張）至全英語卓越教學中心辦理。
                            </p>
                          </div>
                        </details>

                        <details className="course-guide-details">
                          <summary className="course-guide-details__summary">
                            112 學年度入學生（抵免標準）
                          </summary>
                          <div className="course-guide-details__body">
                            <h4 className="course-guide-h4">抵免標準</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>GEPT：中高級複試（含）以上</li>
                              <li>TOEFL ITP：527 分（含）以上</li>
                              <li>TOEFL iBT：71 分（含）以上</li>
                              <li>TOEIC（聽力與閱讀）：785 分（含）以上</li>
                              <li>TOEIC（口說與寫作）：310 分（含）以上</li>
                              <li>IELTS：5.5 級（含）以上</li>
                              <li>BESTEP：B2（含）以上</li>
                            </ul>

                            <h4 className="course-guide-h4">應備文件</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>「英語文課程」抵免學分申請表（112 學年度起入學生適用）</li>
                              <li>兩年內有效之測驗成績單正本（需達抵免標準）</li>
                              <li>測驗成績單影本</li>
                            </ul>

                            <h4 className="course-guide-h4">抵免手續</h4>
                            <p className="course-guide-p">
                              依每學期全英文卓越教學中心公告抵免時間，攜應備文件（共 3 張）至全英語卓越教學中心辦理。
                            </p>
                          </div>
                        </details>

                        <details className="course-guide-details">
                          <summary className="course-guide-details__summary">
                            111 學年度入學生（抵免標準）
                          </summary>
                          <div className="course-guide-details__body">
                            <h4 className="course-guide-h4">抵免範圍</h4>
                            <p className="course-guide-p">
                              得抵免英語文課程學分，並包含跨院 EAP 或跨院 ESP 學分。
                            </p>

                            <h4 className="course-guide-h4">抵免標準</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>GEPT：中高級複試（含）以上</li>
                              <li>TOEFL ITP：527 分（含）以上</li>
                              <li>TOEFL iBT：71 分（含）以上</li>
                              <li>TOEIC（聽力與閱讀）：785 分（含）以上</li>
                              <li>TOEIC（口說與寫作）：310 分（含）以上</li>
                              <li>IELTS：5.5 級（含）以上</li>
                              <li>BESTEP：B2（含）以上</li>
                            </ul>

                            <h4 className="course-guide-h4">應備文件</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>「英語文課程」抵免學分申請表（111 學年度入學生適用）</li>
                              <li>兩年內有效之測驗成績單正本（需達抵免標準）</li>
                              <li>測驗成績單影本</li>
                            </ul>

                            <h4 className="course-guide-h4">抵免手續</h4>
                            <p className="course-guide-p">
                              依每學期教務處公告抵免時間，攜應備文件（共 3 張）至全英語卓越教學中心辦理。
                            </p>
                          </div>
                        </details>

                        <details className="course-guide-details">
                          <summary className="course-guide-details__summary">
                            110 學年度入學生（抵免標準）
                          </summary>
                          <div className="course-guide-details__body">
                            <h4 className="course-guide-h4">抵免範圍</h4>
                            <p className="course-guide-p">
                              得抵免英語文課程學分，並包含跨院 EAP 或跨院 ESP 學分。
                            </p>

                            <h4 className="course-guide-h4">抵免標準</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>GEPT：中高級複試（含）以上</li>
                              <li>TOEFL ITP：527 分（含）以上</li>
                              <li>TOEFL iBT：71 分（含）以上</li>
                              <li>TOEIC（聽力與閱讀）：785 分（含）以上</li>
                              <li>TOEIC（口說與寫作）：310 分（含）以上</li>
                              <li>IELTS：5.5 級（含）以上</li>
                              <li>BESTEP：B2（含）以上</li>
                            </ul>

                            <h4 className="course-guide-h4">應備文件 / 抵免手續</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>同樣需：抵免學分申請表、兩年內成績單正本與影本（共 3 張）。</li>
                              <li>依每學期教務處公告抵免時間至全英語卓越教學中心辦理。</li>
                            </ul>
                          </div>
                        </details>

                        <details className="course-guide-details">
                          <summary className="course-guide-details__summary">
                            109 學年度入學生（抵免標準）
                          </summary>
                          <div className="course-guide-details__body">
                            <h4 className="course-guide-h4">抵免範圍</h4>
                            <p className="course-guide-p">
                              得抵免英語文課程學分，並包含跨院 EAP 或跨院 ESP 學分。
                            </p>

                            <h4 className="course-guide-h4">抵免標準</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>GEPT：中高級複試（含）以上</li>
                              <li>TOEFL ITP：527 分（含）以上</li>
                              <li>TOEFL iBT：71 分（含）以上</li>
                              <li>TOEIC（聽力與閱讀）：750 分（含）以上</li>
                              <li>TOEIC（口說與寫作）：300 分（含）以上</li>
                              <li>IELTS：5.5 級（含）以上</li>
                              <li>BESTEP：B2（含）以上</li>
                            </ul>

                            <h4 className="course-guide-h4">應備文件 / 抵免手續</h4>
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>同樣需：抵免學分申請表、兩年內成績單正本與影本（共 3 張）。</li>
                              <li>依每學期教務處公告抵免時間至全英語卓越教學中心辦理。</li>
                            </ul>
                          </div>
                        </details>
                      </div>
                    </div>
                  ) : null}

                  {section.id === 'certification' ? (
                    <div className="course-guide-content">
                      <div className="course-guide-subcard">
                        <p className="course-guide-p">
                          <strong>100 學年度起入學之學士班學生：</strong>達到英語文能力標準所列之規定，需先至本系統登錄英文檢定成績與列印認證程序單完成認證作業，並檢附英文檢定成績單正本、影本與認證程序單至西灣學院全英語卓越教學中心（圖資 10 樓）辦理。
                        </p>

                        <p className="course-guide-p">
                          <strong>以「實踐歷程檔案計畫」辦理認證：</strong>在表單中下拉選擇「檢定類別」，輸入所收集之點數（100 以上），並選擇申請當日；完成後，檢附認證程序單及「實踐歷程檔案護照」至全英語卓越教學中心（圖資 10 樓）辦理。
                        </p>

                        <div className="course-guide-callout">
                          <div className="course-guide-callout__title">辦理時間與提醒</div>
                          <ul className="course-guide-ul course-guide-ul--tight">
                            <li>受理期間：每學期週一至週五 09:00-17:00（12:00-13:30 休息）。</li>
                            <li>學年期請選擇「申請當學年當學期」，不是英檢通過的那個學期。</li>
                          </ul>
                        </div>

                        <p className="course-guide-p course-guide-p--muted">
                          系統入口與詳細認證方式請參考官方頁面（下方資料來源連結）。
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {section.id === 'practice-portfolio' ? (
                    <div className="course-guide-content">
                      <div className="course-guide-subcard">
                        <h3 className="course-guide-h3">實施辦法</h3>
                        <p className="course-guide-p">
                          參與「英語實踐歷程檔案」計畫之學生，於畢業前累計滿 <strong>100 點</strong>視同通過本校「英語文能力標準」。
                        </p>
                        <ul className="course-guide-ul">
                          <li>申請日期：每學期開學後一個月（詳細時間將於學期初公告）。</li>
                          <li>申請方式：報名開放期間填寫線上表單。</li>
                        </ul>

                        <h3 className="course-guide-h3">認證點數計算</h3>
                        <ol className="course-guide-ol">
                          <li>
                            參加本校自學園之英語小老師諮詢：此項目目前暫停認證。
                          </li>
                          <li>
                            於全英中心選讀指定書籍、繳交學習單：一次可獲得 <strong>2 點</strong>，上限 12 點。
                          </li>
                          <li>
                            英語自學軟體試卷（單項上限 20 點）。方式包含：
                            <ul className="course-guide-ul course-guide-ul--tight">
                              <li>紙本 Live CNN 試卷：完成一回得 2 點。</li>
                              <li>
                                Live ABC 網站：完成指定考試並達通過標準，一回得 2 點：
                                <a
                                  className="course-guide-a"
                                  href="http://140.117.214.42:8080/login/login_m.php"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Live ABC
                                </a>
                              </li>
                            </ul>
                          </li>
                          <li>
                            修讀本校以英語授課之講授類選修課程且成績及格：每門可獲得 <strong>60 點</strong>；此學分不得採計於學生應修畢業學分內。
                          </li>
                          <li>
                            參加校內外英語文相關競賽：憑參賽證明得 20 點；得獎者憑獎狀再加 30 點。
                          </li>
                          <li>
                            參加本校認可之校外英檢考試：繳交成績單得 20 點；若成績達多益 550 分以上，另加碼 20 點；只能採計一次。
                          </li>
                          <li>
                            參加全英中心舉辦之相關活動：單次得 5 點，最多 60 點。
                          </li>
                          <li>
                            參加各學院舉辦之英語學習角落（English Corner）活動：憑學院發放之證明每次得 5 點，上限 30 點。
                          </li>
                        </ol>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="course-guide-sources">
        <div className="course-guide-sources__title">資料來源（官方頁面）</div>
        <ul className="course-guide-sources__list">
          {SOURCE_LINKS.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
