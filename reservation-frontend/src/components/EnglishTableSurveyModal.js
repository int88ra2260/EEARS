// src/components/EnglishTableSurveyModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import DynamicSurveyModal from './DynamicSurveyModal';
import { fetchPublicSurvey } from '../services/surveyPublicApi';


export default function EnglishTableSurveyModal({
  show,
  onClose,
  onSurveyComplete,
  userInfo,
  surveyKey = 'english_table_feedback_114_1',
}) {
  const [surveyConfig, setSurveyConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSurveyConfig = async () => {
      if (!show) return;
      
      try {
        setLoading(true);
        setError('');
        
        const data = await fetchPublicSurvey(surveyKey);
        const config = data?.survey;
        const currentSemester = data?.meta?.currentSemester;

        setSurveyConfig({
          ...config,
          subtitle: currentSemester ? `目前學期：${currentSemester}` : '',
        });
      } catch (err) {
        setError('載入問卷配置失敗');
      } finally {
        setLoading(false);
      }
    };

    loadSurveyConfig();
  }, [show, surveyKey]);

  if (loading) {
    return (
      <Modal show={show} onHide={onClose} centered>
        <Modal.Body className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">載入中...</span>
          </div>
          <p>載入問卷中...</p>
        </Modal.Body>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal show={show} onHide={onClose} centered>
        <Modal.Body>
          <div className="alert alert-danger">
            <h5>載入失敗</h5>
            <p>{error}</p>
            <Button variant="secondary" onClick={onClose}>關閉</Button>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  if (!surveyConfig) {
    return null;
  }

  return (
    <DynamicSurveyModal
      show={show}
      onClose={onClose}
      onSurveyComplete={onSurveyComplete}
      userInfo={userInfo}
      surveyConfig={surveyConfig}
    />
  );
}
