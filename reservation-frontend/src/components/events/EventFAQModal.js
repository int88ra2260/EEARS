/**
 * 常見問題 FAQ Modal：取消預約、黑名單、活動規定三 Tab
 */
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ContentText from '../siteContent/ContentText';
import { FAQ_TABS } from '../../constants/eventsContentConfig';

export default function EventFAQModal({ show, onClose }) {
  const { t } = useLanguage();
  const [activeFAQTab, setActiveFAQTab] = useState('cancel');

  if (!show) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: 'block' }} role="dialog">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><ContentText k="faq.title" /></h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              <ul className="nav nav-tabs mb-3" id="faqTabs" role="tablist">
                {FAQ_TABS.map((tab) => (
                  <li key={tab.id} className="nav-item" role="presentation">
                    <button
                      className={`nav-link ${activeFAQTab === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveFAQTab(tab.id)}
                      type="button"
                    >
                      <ContentText k={tab.labelKey} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="tab-content">
                {activeFAQTab === 'cancel' && (
                  <div className="tab-pane show active">
                    <div className="mb-4">
                      <h6 className="text-primary mb-3">
                        <i className="fas fa-question-circle me-2" />
                        <ContentText k="faq.cancelQuestion" />
                      </h6>
                      <div className="alert alert-info" role="alert">
                        <strong>📝 <ContentText k="faq.cancelSteps" /></strong>
                        <ol className="mb-0 mt-2">
                          <li><ContentText k="faq.cancelStep1" /></li>
                          <li><ContentText k="faq.cancelStep2" /></li>
                          <li><ContentText k="faq.cancelStep3" /></li>
                          <li><ContentText k="faq.cancelStep4" /></li>
                          <li><ContentText k="faq.cancelStep5" /></li>
                        </ol>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-warning">
                          <i className="fas fa-exclamation-triangle me-2" />
                          <ContentText k="faq.importantReminder" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.cancelRemind1" /></li>
                          <li><ContentText k="faq.cancelRemind2" /></li>
                          <li><ContentText k="faq.cancelRemind3" /></li>
                          <li><ContentText k="faq.cancelRemind4" /></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {activeFAQTab === 'blacklist' && (
                  <div className="tab-pane show active">
                    <div className="mb-4">
                      <h6 className="text-primary mb-3">
                        <i className="fas fa-ban me-2" />
                        <ContentText k="faq.blacklistQuestion" />
                      </h6>
                      <div className="alert alert-warning" role="alert">
                        <strong>⚠️ <ContentText k="faq.blacklistMechanism" /></strong>
                        <p className="mb-0 mt-2"><ContentText k="faq.blacklistRule" /></p>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-danger">
                          <i className="fas fa-times-circle me-2" />
                          <ContentText k="faq.violationsInclude" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.violation1" /></li>
                          <li><ContentText k="faq.violation2" /></li>
                          <li><ContentText k="faq.violation3" /></li>
                        </ul>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-info">
                          <i className="fas fa-lightbulb me-2" />
                          <ContentText k="faq.blacklistImpact" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.impact1" /></li>
                          <li><ContentText k="faq.impact2" /></li>
                          <li><ContentText k="faq.impact3" /></li>
                          <li><ContentText k="faq.impact4" /></li>
                        </ul>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-success">
                          <i className="fas fa-check-circle me-2" />
                          <ContentText k="faq.howToAvoid" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.avoid1" /></li>
                          <li><ContentText k="faq.avoid2" /></li>
                          <li><ContentText k="faq.avoid3" /></li>
                          <li><ContentText k="faq.avoid4" /></li>
                          <li><ContentText k="faq.avoid5" /></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {activeFAQTab === 'rules' && (
                  <div className="tab-pane show active">
                    <div className="mb-4">
                      <h6 className="text-primary mb-3">
                        <i className="fas fa-gavel me-2" />
                        <ContentText k="faq.rulesTitle" />
                      </h6>
                      <div className="alert alert-danger" role="alert">
                        <strong>🚫 <ContentText k="faq.rulesImportant" /></strong>
                        <ul className="mb-0 mt-2">
                          <li><ContentText k="faq.ruleNoOnsite" /></li>
                          <li><ContentText k="faq.ruleNoStampService" /></li>
                          <li><ContentText k="faq.ruleNoLate5" /></li>
                        </ul>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-warning">
                          <i className="fas fa-calendar-times me-2" />
                          <ContentText k="faq.ruleNoOnsiteDetail" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.ruleNoOnsiteD1" /></li>
                          <li><ContentText k="faq.ruleNoOnsiteD2" /></li>
                          <li><ContentText k="faq.ruleNoOnsiteD3" /></li>
                          <li><ContentText k="faq.ruleNoOnsiteD4" /></li>
                        </ul>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-info">
                          <i className="fas fa-clock me-2" />
                          <ContentText k="faq.bookingWindowTitle" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.bookingWindowEt" /></li>
                          <li><ContentText k="faq.bookingWindowJt" /></li>
                          <li><ContentText k="faq.bookingWindowEc" /></li>
                          <li><ContentText k="faq.bookingWindowIf" /></li>
                          <li><ContentText k="faq.bookingWindowCutoff" /></li>
                        </ul>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-warning">
                          <i className="fas fa-stamp me-2" />
                          <ContentText k="faq.ruleNoStampDetail" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.ruleNoStampD1" /></li>
                          <li><ContentText k="faq.ruleNoStampD2" /></li>
                          <li><ContentText k="faq.ruleNoStampD3" /></li>
                          <li><ContentText k="faq.ruleNoStampD4" /></li>
                        </ul>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-warning">
                          <i className="fas fa-clock me-2" />
                          <ContentText k="faq.ruleLateDetail" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.ruleLateD1" /></li>
                          <li><ContentText k="faq.ruleLateD2" /></li>
                          <li><ContentText k="faq.ruleLateD3" /></li>
                          <li><ContentText k="faq.ruleLateD4" /></li>
                          <li><ContentText k="faq.ruleLateD5" /></li>
                        </ul>
                      </div>
                      <div className="mt-3">
                        <h6 className="text-info">
                          <i className="fas fa-list-check me-2" />
                          <ContentText k="faq.otherRules" />
                        </h6>
                        <ul className="text-muted">
                          <li><ContentText k="faq.otherR1" /></li>
                          <li><ContentText k="faq.otherR2" /></li>
                          <li><ContentText k="faq.otherR3" /></li>
                          <li><ContentText k="faq.otherR4" /></li>
                          <li><ContentText k="faq.otherR5" /></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                {t('home.gotIt')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
