/**
 * 活動介紹 Modal：含活動類型 Tab 與各類型說明（EventInfoPanel 內容）
 * Tab 與 Job Talk 輪播 state 內聚於此，EventList 僅傳 show / onClose / initialTab / t
 * 樣式依賴父層 EventList.css（如 image-carousel-container）
 */
import React, { useState, useEffect, useCallback } from 'react';
import ActivityTypeTabs from './ActivityTypeTabs';
import IMAGES from '../../constants/imagePaths';

const TRANSITION_MS = 300;

export default function ActivityIntroModal({ show, onClose, initialTab, t }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'english-table');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 與父層 initialTab（如 /activities/:slug）同步，使從分類頁開啟時顯示對應 Tab
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const nextImage = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentImageIndex((prev) => (prev === IMAGES.jobTalk.length - 1 ? 0 : prev + 1));
    setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
  }, [isTransitioning]);

  const prevImage = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentImageIndex((prev) => (prev === 0 ? IMAGES.jobTalk.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
  }, [isTransitioning]);

  const goToImage = useCallback((index) => {
    if (isTransitioning || index === currentImageIndex) return;
    setIsTransitioning(true);
    setCurrentImageIndex(index);
    setTimeout(() => setIsTransitioning(false), TRANSITION_MS);
  }, [isTransitioning, currentImageIndex]);

  const handleTabChange = useCallback((tabName) => {
    setActiveTab(tabName);
    if (tabName === 'job-talk') setCurrentImageIndex(0);
  }, []);

  if (!show) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: 'block' }} role="dialog">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{t('activities.title')}</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <ActivityTypeTabs activeTab={activeTab} onTabChange={handleTabChange} t={t} />

              <div className="tab-content">
                {activeTab === 'english-table' && (
                  <div className="tab-pane show active">
                    <div className="row">
                      <div className="col-md-5">
                        <img
                          src={IMAGES.englishTable}
                          alt={t('activities.englishTable')}
                          className="img-fluid rounded mb-3"
                          style={{ maxHeight: '350px', objectFit: 'cover', width: '100%' }}
                        />
                      </div>
                      <div className="col-md-7">
                        <h5 className="text-primary mb-3">{t('activities.englishTable')}</h5>
                        <p className="text-muted mb-3" style={{ fontSize: '0.95rem' }}>{t('activities.etDesc')}</p>
                        <div className="mt-3">
                          <h6 className="text-success">★ {t('activities.etCourseColearning')}</h6>
                          <p className="text-muted mb-3" style={{ fontSize: '0.9rem' }}>{t('activities.etCourseColearningDesc')}</p>
                          <h6 className="text-success">★ {t('activities.etInternational')}</h6>
                          <p className="text-muted" style={{ fontSize: '0.9rem' }}>{t('activities.etInternationalDesc')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'english-club' && (
                  <div className="tab-pane show active">
                    <div className="row">
                      <div className="col-md-5">
                        <img
                          src={IMAGES.englishClub}
                          alt={t('activities.englishClub')}
                          className="img-fluid rounded mb-3"
                          style={{ maxHeight: '350px', objectFit: 'cover', width: '100%' }}
                        />
                      </div>
                      <div className="col-md-7">
                        <h5 className="text-primary mb-3">{t('activities.englishClub')}</h5>
                        <p className="text-muted mb-3" style={{ fontSize: '0.95rem' }}>{t('activities.ecDesc')}</p>
                        <div className="mt-3">
                          <h6 className="text-success">★ {t('activities.ecFeatures')}</h6>
                          <p className="text-muted" style={{ fontSize: '0.9rem' }}>{t('activities.ecFeaturesDesc')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'job-talk' && (
                  <div className="tab-pane show active">
                    <div className="row">
                      <div className="col-md-5 mb-4">
                        <div className="position-relative">
                          <div
                            className="image-carousel-container"
                            style={{
                              height: '350px',
                              backgroundColor: '#f8f9fa',
                              position: 'relative',
                              overflow: 'hidden',
                              borderRadius: '0.375rem',
                            }}
                          >
                            <img
                              src={IMAGES.jobTalk[currentImageIndex]}
                              alt={`${t('activities.jobTalk')} ${currentImageIndex + 1}`}
                              className={`img-fluid w-100 h-100 carousel-image ${isTransitioning ? 'transitioning' : 'loaded'}`}
                              style={{ objectFit: 'cover' }}
                              onError={(e) => { e.target.src = '/images/placeholder.jpg'; }}
                            />
                            <button
                              className="btn carousel-nav-btn position-absolute top-50 start-0 translate-middle-y ms-2"
                              onClick={prevImage}
                              disabled={isTransitioning}
                              style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                            >
                              <i className="fas fa-chevron-left" />
                            </button>
                            <button
                              className="btn carousel-nav-btn position-absolute top-50 end-0 translate-middle-y me-2"
                              onClick={nextImage}
                              disabled={isTransitioning}
                              style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                            >
                              <i className="fas fa-chevron-right" />
                            </button>
                          </div>
                          <div className="d-flex justify-content-center mt-3">
                            {IMAGES.jobTalk.map((_, index) => (
                              <button
                                key={index}
                                className={`carousel-indicator btn btn-sm rounded-circle me-1 ${index === currentImageIndex ? 'active' : 'btn-outline-secondary'}`}
                                onClick={() => goToImage(index)}
                                disabled={isTransitioning}
                                style={{ width: '12px', height: '12px', padding: '0' }}
                              />
                            ))}
                          </div>
                          <div className="text-center mt-2">
                            <span className="image-counter" style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                              {currentImageIndex + 1} / {IMAGES.jobTalk.length}{t('activities.photoCount') ? ` ${t('activities.photoCount')}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-7 activity-description">
                        <h5 className="text-primary mb-3">{t('activities.jobTalkFull')}</h5>
                        <p className="text-muted mb-3" style={{ fontSize: '0.95rem' }}>{t('activities.jtDesc')}</p>
                        <div className="mt-3">
                          <h6 className="text-success">★ {t('activities.jtFeatures')}</h6>
                          <p className="text-muted mb-3" style={{ fontSize: '0.9rem' }}>{t('activities.jtFeaturesDesc')}</p>
                          <h6 className="text-success">★ {t('activities.jtObjectives')}</h6>
                          <p className="text-muted" style={{ fontSize: '0.9rem' }}>{t('activities.jtObjectivesDesc')}</p>
                        </div>
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
