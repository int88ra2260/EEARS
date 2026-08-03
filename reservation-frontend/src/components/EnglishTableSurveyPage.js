// src/components/EnglishTableSurveyPage.js
import React, { useState, useEffect, useRef } from 'react';
import { Container, Button, Form, Alert, Card, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { submitEnglishTableSurvey } from '../services/surveyPublicApi';

// 年級選項
const GRADE_OPTIONS = [
  '一年級',
  '二年級', 
  '高年級(大三以上含碩博士)'
];

// 李克特量表選項
const LIKERT_OPTIONS = [
  { value: 1, label: '非常不同意' },
  { value: 2, label: '不同意' },
  { value: 3, label: '沒意見' },
  { value: 4, label: '同意' },
  { value: 5, label: '非常同意' }
];

// 問卷題目
const SURVEY_QUESTIONS = [
  { id: 'q1', text: '我能更流利地用英文談論我的個人經驗和意見。' },
  { id: 'q2', text: '我能對個人問題給出更詳細和有趣的回答。' },
  { id: 'q3', text: '我能更清晰及詳細地用英文描述圖片或視覺資訊。' },
  { id: 'q4', text: '我能用英文解釋圖片或圖表的意思或主要訊息。' },
  { id: 'q5', text: '我能在學術討論中更有效地表達和組織我的想法。' },
  { id: 'q6', text: '我能在討論中運用例子和解釋來支持我的意見。' },
  { id: 'q7', text: '我能將英文將課程主題與現實生活中的例子連結起來。' },
  { id: 'q8', text: '我現在比參加「ET」之前對說英文更有自信。' },
  { id: 'q9', text: '我說英文時比較不緊張或害怕犯錯。' },
  { id: 'q10', text: '我更願意在課堂上或在「ET」以外與他人用英文交談。' },
  { id: 'q11', text: '我有動力定期參加「ET」活動。' },
  { id: 'q12', text: '每天不同的主題和任務使我更有興趣參與。' },
  { id: 'q13', text: '我計劃未來繼續參加「ET」（或類似活動）。' },
  { id: 'q14', text: '我在討論中會用自己的話總結主要想法。' },
  { id: 'q15', text: '當我無法理解事情時，我會尋求澄清。' },
  { id: 'q16', text: '我會嘗試預測接下來可能會出現哪些問題或主題。' },
  { id: 'q17', text: '我會輪流發言，並讓別人先說完後我再回應。' },
  { id: 'q18', text: '這種由同儕主導、以討論為基礎的模式，幫助我更勇敢開口說英文。' },
  { id: 'q19', text: '「ET」氣氛佳且互動性強，使我說英文時感到很自在。' },
  { id: 'q20', text: '總體來說，「ET」對於提升我的英文口說技能是有益的。' }
];

export default function EnglishTableSurveyPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    studentEmail: '',
    grade: '',
    department: '',
    interviewEmail: ''
  });
  
  const [likertResponses, setLikertResponses] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // 用於滾動到錯誤位置的refs
  const refs = {
    studentId: useRef(),
    studentName: useRef(),
    studentEmail: useRef(),
    grade: useRef(),
    department: useRef(),
    q1: useRef()
  };

  useEffect(() => {
    // 從URL參數或localStorage獲取用戶資訊
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('studentId') || '';
    const studentName = urlParams.get('studentName') || '';
    const studentEmail = urlParams.get('studentEmail') || '';

    setFormData(prev => ({
      ...prev,
      studentId,
      studentName,
      studentEmail
    }));
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLikertChange = (questionId, value) => {
    setLikertResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const validateForm = () => {
    const errors = {};
    let firstErrorRef = null;

    // 檢查基本資料
    if (!formData.studentId.trim()) {
      errors.studentId = '請填寫學號';
      if (!firstErrorRef) firstErrorRef = refs.studentId;
    }
    
    if (!formData.studentName.trim()) {
      errors.studentName = '請填寫姓名';
      if (!firstErrorRef) firstErrorRef = refs.studentName;
    }
    
    if (!formData.studentEmail.trim()) {
      errors.studentEmail = '請填寫Email';
      if (!firstErrorRef) firstErrorRef = refs.studentEmail;
    }

    if (!formData.grade.trim()) {
      errors.grade = '請選擇年級';
      if (!firstErrorRef) firstErrorRef = refs.grade;
    }
    
    if (!formData.department.trim()) {
      errors.department = '請填寫科系';
      if (!firstErrorRef) firstErrorRef = refs.department;
    }

    // 檢查李克特量表問題
    for (const question of SURVEY_QUESTIONS) {
      if (!likertResponses[question.id]) {
        errors[question.id] = '請回答此題';
        if (!firstErrorRef) firstErrorRef = refs[question.id];
      }
    }

    // 檢查email格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.studentEmail && !emailRegex.test(formData.studentEmail)) {
      errors.studentEmail = 'Email格式不正確';
      if (!firstErrorRef) firstErrorRef = refs.studentEmail;
    }

    // 檢查聯絡信箱格式（如果提供）
    if (formData.interviewEmail.trim()) {
      if (!emailRegex.test(formData.interviewEmail)) {
        errors.interviewEmail = '聯絡信箱格式不正確';
        if (!firstErrorRef) firstErrorRef = refs.interviewEmail;
      }
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError('請完成所有必填項目');
      if (firstErrorRef) {
        firstErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const { ok, data } = await submitEnglishTableSurvey({
          studentId: formData.studentId,
          name: formData.studentName,
          email: formData.studentEmail,
          grade: formData.grade,
          department: formData.department,
          interviewEmail: formData.interviewEmail || null,
          ...likertResponses,
        });

      if (ok) {
        setSuccess('問卷已成功送出，謝謝您的寶貴意見！');
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setError(data.error || '問卷送出失敗，請稍後再試');
      }
    } catch (err) {
      setError('網路錯誤，請檢查連線後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const LikertQuestion = ({ question, questionRef }) => (
    <div 
      ref={questionRef} 
      className={`mb-4 p-3 rounded ${validationErrors[question.id] ? 'border border-danger bg-light' : 'border border-light'}`}
      style={{ 
        backgroundColor: validationErrors[question.id] ? '#fff5f5' : '#f8f9fa',
        borderColor: validationErrors[question.id] ? '#dc3545' : '#e9ecef',
        transition: 'all 0.3s ease'
      }}
    >
      <Form.Group>
        <Form.Label className={`fw-bold mb-3 ${validationErrors[question.id] ? 'text-danger' : 'text-dark'}`}>
          {question.text}
          {validationErrors[question.id] && <span className="text-danger ms-2">*</span>}
        </Form.Label>
        <div className="d-flex justify-content-between align-items-center">
          <span className="text-muted small">非常不同意</span>
          <div className="d-flex gap-1">
            {LIKERT_OPTIONS.map(option => (
              <Form.Check
                key={option.value}
                type="radio"
                inline
                label={option.value}
                name={question.id}
                value={option.value}
                checked={likertResponses[question.id] === option.value}
                onChange={() => handleLikertChange(question.id, option.value)}
                className="mx-1"
                style={{ 
                  backgroundColor: likertResponses[question.id] === option.value ? '#007bff' : 'transparent',
                  color: likertResponses[question.id] === option.value ? 'white' : 'inherit'
                }}
              />
            ))}
          </div>
          <span className="text-muted small">非常同意</span>
        </div>
        {validationErrors[question.id] && (
          <div className="text-danger small mt-2">
            {validationErrors[question.id]}
          </div>
        )}
      </Form.Group>
    </div>
  );

  return (
    <Container className="py-4">
      <Card className="shadow-lg">
        <Card.Header className="bg-primary text-white text-center">
          <h2 className="mb-0">
            <i className="fas fa-clipboard-list me-3"></i>English Table 回饋問卷
          </h2>
          <p className="mb-0 mt-2">English Table Feedback Questionnaire</p>
        </Card.Header>
        <Card.Body className="bg-light">
          <div className="mb-4 text-center">
            <p className="text-muted lead">
              基本資料（年級、科系）＋口語能力20題（1=非常不同意～5=非常同意）＋延伸題（留下聯絡信箱，若願意接受訪談）。
            </p>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          {/* 基本資料 */}
          <Card className="mb-4 border-primary">
            <Card.Header className="bg-primary text-white">
              <h5 className="mb-0">
                <i className="fas fa-user me-2"></i>基本資料
              </h5>
            </Card.Header>
            <Card.Body className="bg-light">
              <Row>
                <Col md={4} className="mb-3">
                  <div 
                    ref={refs.studentId}
                    className={`p-3 rounded ${validationErrors.studentId ? 'border border-danger' : 'border border-light'}`}
                    style={{ backgroundColor: validationErrors.studentId ? '#fff5f5' : 'white' }}
                  >
                    <Form.Label className={`fw-bold ${validationErrors.studentId ? 'text-danger' : 'text-dark'}`}>
                      學號 *
                      {validationErrors.studentId && <span className="text-danger ms-2">*</span>}
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.studentId}
                      onChange={(e) => handleInputChange('studentId', e.target.value)}
                      placeholder="請輸入學號"
                      className={validationErrors.studentId ? 'border-danger' : ''}
                    />
                    {validationErrors.studentId && (
                      <div className="text-danger small mt-1">{validationErrors.studentId}</div>
                    )}
                  </div>
                </Col>

                <Col md={4} className="mb-3">
                  <div 
                    ref={refs.studentName}
                    className={`p-3 rounded ${validationErrors.studentName ? 'border border-danger' : 'border border-light'}`}
                    style={{ backgroundColor: validationErrors.studentName ? '#fff5f5' : 'white' }}
                  >
                    <Form.Label className={`fw-bold ${validationErrors.studentName ? 'text-danger' : 'text-dark'}`}>
                      姓名 *
                      {validationErrors.studentName && <span className="text-danger ms-2">*</span>}
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.studentName}
                      onChange={(e) => handleInputChange('studentName', e.target.value)}
                      placeholder="請輸入姓名"
                      className={validationErrors.studentName ? 'border-danger' : ''}
                    />
                    {validationErrors.studentName && (
                      <div className="text-danger small mt-1">{validationErrors.studentName}</div>
                    )}
                  </div>
                </Col>

                <Col md={4} className="mb-3">
                  <div 
                    ref={refs.studentEmail}
                    className={`p-3 rounded ${validationErrors.studentEmail ? 'border border-danger' : 'border border-light'}`}
                    style={{ backgroundColor: validationErrors.studentEmail ? '#fff5f5' : 'white' }}
                  >
                    <Form.Label className={`fw-bold ${validationErrors.studentEmail ? 'text-danger' : 'text-dark'}`}>
                      Email *
                      {validationErrors.studentEmail && <span className="text-danger ms-2">*</span>}
                    </Form.Label>
                    <Form.Control
                      type="email"
                      value={formData.studentEmail}
                      onChange={(e) => handleInputChange('studentEmail', e.target.value)}
                      placeholder="請輸入Email"
                      className={validationErrors.studentEmail ? 'border-danger' : ''}
                    />
                    {validationErrors.studentEmail && (
                      <div className="text-danger small mt-1">{validationErrors.studentEmail}</div>
                    )}
                  </div>
                </Col>

                <Col md={6} className="mb-3">
                  <div 
                    ref={refs.grade}
                    className={`p-3 rounded ${validationErrors.grade ? 'border border-danger' : 'border border-light'}`}
                    style={{ backgroundColor: validationErrors.grade ? '#fff5f5' : 'white' }}
                  >
                    <Form.Label className={`fw-bold ${validationErrors.grade ? 'text-danger' : 'text-dark'}`}>
                      年級 *
                      {validationErrors.grade && <span className="text-danger ms-2">*</span>}
                    </Form.Label>
                    <Form.Select 
                      value={formData.grade} 
                      onChange={(e) => handleInputChange('grade', e.target.value)}
                      className={validationErrors.grade ? 'border-danger' : ''}
                    >
                      <option value="">-- 請選擇年級 --</option>
                      {GRADE_OPTIONS.map(grade => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </Form.Select>
                    {validationErrors.grade && (
                      <div className="text-danger small mt-1">{validationErrors.grade}</div>
                    )}
                  </div>
                </Col>

                <Col md={6} className="mb-3">
                  <div 
                    ref={refs.department}
                    className={`p-3 rounded ${validationErrors.department ? 'border border-danger' : 'border border-light'}`}
                    style={{ backgroundColor: validationErrors.department ? '#fff5f5' : 'white' }}
                  >
                    <Form.Label className={`fw-bold ${validationErrors.department ? 'text-danger' : 'text-dark'}`}>
                      科系（請填寫就讀科系）*
                      {validationErrors.department && <span className="text-danger ms-2">*</span>}
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="例如：資訊工程學系"
                      value={formData.department}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                      className={validationErrors.department ? 'border-danger' : ''}
                    />
                    {validationErrors.department && (
                      <div className="text-danger small mt-1">{validationErrors.department}</div>
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* 李克特量表問題 */}
          <Card className="mb-4 border-success">
            <Card.Header className="bg-success text-white">
              <h5 className="mb-0">
                <i className="fas fa-chart-bar me-2"></i>學習成效評估
              </h5>
              <p className="mb-0 mt-2 small">（1=非常不同意，2=不同意，3=沒意見，4=同意，5=非常同意）</p>
            </Card.Header>
            <Card.Body className="bg-light">
              {SURVEY_QUESTIONS.map((question, index) => (
                <LikertQuestion 
                  key={question.id}
                  question={question}
                  questionRef={refs[question.id]}
                />
              ))}
            </Card.Body>
          </Card>

          {/* 聯絡信箱 */}
          <Card className="mb-4 border-info">
            <Card.Header className="bg-info text-white">
              <h5 className="mb-0">
                <i className="fas fa-envelope me-2"></i>延伸問題
              </h5>
            </Card.Header>
            <Card.Body className="bg-light">
              <div 
                className={`p-3 rounded ${validationErrors.interviewEmail ? 'border border-danger' : 'border border-light'}`}
                style={{ backgroundColor: validationErrors.interviewEmail ? '#fff5f5' : 'white' }}
              >
                <Form.Group>
                  <Form.Label className={`fw-bold ${validationErrors.interviewEmail ? 'text-danger' : 'text-dark'}`}>
                    若願意接受 EMI 中心訪談，請留下聯絡信箱（選填）
                    {validationErrors.interviewEmail && <span className="text-danger ms-2">*</span>}
                  </Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="請輸入您的聯絡信箱"
                    value={formData.interviewEmail}
                    onChange={(e) => handleInputChange('interviewEmail', e.target.value)}
                    className={validationErrors.interviewEmail ? 'border-danger' : ''}
                  />
                  {validationErrors.interviewEmail && (
                    <div className="text-danger small mt-1">{validationErrors.interviewEmail}</div>
                  )}
                </Form.Group>
              </div>
            </Card.Body>
          </Card>

          <div className="d-flex justify-content-between mt-4">
            <Button 
              variant="outline-secondary" 
              size="lg"
              onClick={() => navigate('/')}
              className="px-4"
            >
              <i className="fas fa-home me-2"></i>返回首頁
            </Button>
            <Button 
              variant="success" 
              size="lg"
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="px-4"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin me-2"></i>送出中...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane me-2"></i>送出問卷
                </>
              )}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
