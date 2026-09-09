/**
 * 視覺化問卷編輯器
 * 左側編輯題目、右側即時學生端預覽；仍可與 JSON 模式互通同一 schema。
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Accordion,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Row,
} from 'react-bootstrap';
import SurveyStudentPreview from './SurveyStudentPreview';
import './SurveyQuestionEditor.css';

const QUESTION_TYPES = [
  { value: 'radio', label: '單選題', icon: '○' },
  { value: 'checkbox', label: '多選題', icon: '☑' },
  { value: 'likert', label: '量表題（1-5）', icon: '★' },
  { value: 'text', label: '單行文字', icon: '—' },
  { value: 'textarea', label: '多行文字', icon: '≡' },
  { value: 'email', label: '電子郵件', icon: '@' },
];

const DEFAULT_LIKERT_SCALE = [1, 2, 3, 4, 5];

function generateQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function typeLabel(type) {
  return QUESTION_TYPES.find((t) => t.value === type)?.label || type || '未知';
}

function OptionsEditor({ options, onChange }) {
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange(newOptions);
  };

  const handleAddOption = () => {
    onChange([...options, `選項 ${options.length + 1}`]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 1) return;
    onChange(options.filter((_, i) => i !== index));
  };

  const handleMoveOption = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= options.length) return;
    const newOptions = [...options];
    [newOptions[index], newOptions[newIndex]] = [newOptions[newIndex], newOptions[index]];
    onChange(newOptions);
  };

  return (
    <div className="options-editor">
      <Form.Label className="small text-muted">選項</Form.Label>
      {options.map((opt, idx) => (
        <InputGroup size="sm" className="mb-1" key={`opt-${idx}`}>
          <InputGroup.Text className="bg-light">{idx + 1}</InputGroup.Text>
          <Form.Control
            value={opt}
            onChange={(e) => handleOptionChange(idx, e.target.value)}
            placeholder={`選項 ${idx + 1}`}
          />
          <Button
            variant="outline-secondary"
            onClick={() => handleMoveOption(idx, -1)}
            disabled={idx === 0}
            title="上移"
            aria-label={`上移選項 ${idx + 1}`}
          >
            ↑
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => handleMoveOption(idx, 1)}
            disabled={idx === options.length - 1}
            title="下移"
            aria-label={`下移選項 ${idx + 1}`}
          >
            ↓
          </Button>
          <Button
            variant="outline-danger"
            onClick={() => handleRemoveOption(idx)}
            disabled={options.length <= 1}
            title="刪除"
            aria-label={`刪除選項 ${idx + 1}`}
          >
            ✕
          </Button>
        </InputGroup>
      ))}
      <Button variant="outline-primary" size="sm" onClick={handleAddOption} className="mt-1">
        + 新增選項
      </Button>
    </div>
  );
}

function QuestionItem({ question, index, total, onChange, onDelete, onMove, onDuplicate }) {
  const needsOptions = question.type === 'radio' || question.type === 'checkbox';

  const handleFieldChange = (field, value) => {
    onChange({ ...question, [field]: value });
  };

  const handleTypeChange = (newType) => {
    const updated = { ...question, type: newType };
    if ((newType === 'radio' || newType === 'checkbox') && !updated.options?.length) {
      updated.options = ['選項 1', '選項 2', '選項 3'];
    }
    if (newType === 'likert' && !updated.scale?.length) {
      updated.scale = [...DEFAULT_LIKERT_SCALE];
    }
    onChange(updated);
  };

  return (
    <Accordion.Item eventKey={question.id}>
      <Accordion.Header>
        <div className="d-flex align-items-center gap-2 w-100 pe-3">
          <Badge bg="secondary" className="fw-normal">{index + 1}</Badge>
          <Badge bg="light" text="dark" className="fw-normal">
            {typeLabel(question.type)}
          </Badge>
          <span className="flex-grow-1 text-truncate" style={{ maxWidth: '320px' }}>
            {question.label || '（未命名題目）'}
          </span>
          {question.required ? <Badge bg="danger">必填</Badge> : null}
        </div>
      </Accordion.Header>
      <Accordion.Body className="bg-light">
        <Row className="g-2">
          <Col md={8}>
            <Form.Label className="small text-muted">題目文字</Form.Label>
            <Form.Control
              value={question.label || ''}
              onChange={(e) => handleFieldChange('label', e.target.value)}
              placeholder="請輸入題目內容"
            />
          </Col>
          <Col md={4}>
            <Form.Label className="small text-muted">題目類型</Form.Label>
            <Form.Select
              value={question.type || 'text'}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={6}>
            <Form.Label className="small text-muted">題目 ID（進階，作答 key）</Form.Label>
            <Form.Control
              value={question.id || ''}
              onChange={(e) => handleFieldChange('id', e.target.value.trim())}
              placeholder="question_id"
              className="font-monospace small"
            />
          </Col>
          <Col md={6} className="d-flex align-items-end">
            <Form.Check
              type="switch"
              id={`required-${question.id}`}
              label="必填"
              checked={!!question.required}
              onChange={(e) => handleFieldChange('required', e.target.checked)}
            />
          </Col>
          {needsOptions ? (
            <Col xs={12}>
              <OptionsEditor
                options={question.options || []}
                onChange={(opts) => handleFieldChange('options', opts)}
              />
            </Col>
          ) : null}
          {question.type === 'likert' ? (
            <Col xs={12}>
              <Form.Label className="small text-muted">量表範圍</Form.Label>
              <div className="small text-muted">固定 1（非常不同意）— 5（非常同意），與學生端一致</div>
            </Col>
          ) : null}
          <Col xs={12}>
            <div className="d-flex justify-content-between flex-wrap gap-2 mt-2 pt-2 border-top">
              <div className="d-flex gap-1 flex-wrap">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                >
                  ↑ 上移
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => onMove(index, 1)}
                  disabled={index === total - 1}
                >
                  ↓ 下移
                </Button>
                <Button variant="outline-primary" size="sm" onClick={() => onDuplicate(index)}>
                  複製此題
                </Button>
              </div>
              <Button variant="outline-danger" size="sm" onClick={() => onDelete(question.id)}>
                刪除此題
              </Button>
            </div>
          </Col>
        </Row>
      </Accordion.Body>
    </Accordion.Item>
  );
}

export default function SurveyQuestionEditor({ schema, onChange, showPreview = true }) {
  const [activeKey, setActiveKey] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const questions = useMemo(() => schema?.questions || [], [schema?.questions]);

  const handleSchemaFieldChange = useCallback((field, value) => {
    onChange({ ...schema, [field]: value });
  }, [schema, onChange]);

  const handleQuestionsChange = useCallback((newQuestions) => {
    onChange({ ...schema, questions: newQuestions });
  }, [schema, onChange]);

  const handleQuestionChange = useCallback((index, updatedQuestion) => {
    const newQuestions = [...questions];
    newQuestions[index] = updatedQuestion;
    handleQuestionsChange(newQuestions);
  }, [questions, handleQuestionsChange]);

  const handleAddQuestion = useCallback((type = 'radio') => {
    const newId = generateQuestionId();
    const newQuestion = {
      id: newId,
      type,
      label: '',
      required: false,
    };
    if (type === 'radio' || type === 'checkbox') {
      newQuestion.options = ['選項 1', '選項 2', '選項 3'];
    }
    if (type === 'likert') {
      newQuestion.scale = [...DEFAULT_LIKERT_SCALE];
    }
    handleQuestionsChange([...questions, newQuestion]);
    setActiveKey(newId);
  }, [questions, handleQuestionsChange]);

  const handleDeleteQuestion = useCallback((questionId) => {
    if (!window.confirm('確定要刪除此題目嗎？')) return;
    handleQuestionsChange(questions.filter((q) => q.id !== questionId));
    if (activeKey === questionId) setActiveKey(null);
  }, [questions, handleQuestionsChange, activeKey]);

  const handleMoveQuestion = useCallback((index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    handleQuestionsChange(newQuestions);
  }, [questions, handleQuestionsChange]);

  const handleDuplicateQuestion = useCallback((index) => {
    const source = questions[index];
    if (!source) return;
    const copy = {
      ...JSON.parse(JSON.stringify(source)),
      id: generateQuestionId(),
      label: source.label ? `${source.label}（副本）` : '',
    };
    const next = [...questions];
    next.splice(index + 1, 0, copy);
    handleQuestionsChange(next);
    setActiveKey(copy.id);
  }, [questions, handleQuestionsChange]);

  const editorPane = (
    <div className="survey-question-editor__edit-col">
      <Card className="border-0 shadow-sm mb-3">
        <Card.Header className="bg-white fw-semibold">問卷基本資訊</Card.Header>
        <Card.Body>
          <Row className="g-2">
            <Col md={6}>
              <Form.Label className="small text-muted">問卷標題</Form.Label>
              <Form.Control
                value={schema?.title || ''}
                onChange={(e) => handleSchemaFieldChange('title', e.target.value)}
                placeholder="例：English Table Feedback Questionnaire"
              />
            </Col>
            <Col md={6}>
              <Form.Label className="small text-muted">問卷代碼（schema id）</Form.Label>
              <Form.Control
                value={schema?.id || ''}
                onChange={(e) => handleSchemaFieldChange('id', e.target.value)}
                placeholder="例：english_table_feedback"
                className="font-monospace"
              />
            </Col>
            <Col xs={12}>
              <Form.Label className="small text-muted">問卷說明（可選）</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={schema?.description || ''}
                onChange={(e) => handleSchemaFieldChange('description', e.target.value)}
                placeholder="顯示在問卷最上方的說明文字"
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white fw-semibold d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>題目列表（共 {questions.length} 題）</span>
          {showPreview ? (
            <Button
              size="sm"
              variant="outline-secondary"
              className="d-lg-none"
              onClick={() => setPreviewOpen((v) => !v)}
            >
              {previewOpen ? '隱藏預覽' : '顯示預覽'}
            </Button>
          ) : null}
        </Card.Header>
        <Card.Body className="p-2">
          {questions.length === 0 ? (
            <div className="text-center text-muted py-4">
              <div className="mb-2">尚未新增任何題目</div>
              <div className="small">點擊下方題型按鈕開始建立問卷</div>
            </div>
          ) : (
            <Accordion activeKey={activeKey} onSelect={setActiveKey}>
              {questions.map((q, idx) => (
                <QuestionItem
                  key={q.id}
                  question={q}
                  index={idx}
                  total={questions.length}
                  onChange={(updated) => handleQuestionChange(idx, updated)}
                  onDelete={handleDeleteQuestion}
                  onMove={handleMoveQuestion}
                  onDuplicate={handleDuplicateQuestion}
                />
              ))}
            </Accordion>
          )}

          <div className="mt-3 pt-3 border-top">
            <div className="small text-muted mb-2">新增題目</div>
            <div className="d-flex flex-wrap gap-2">
              {QUESTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className="survey-question-editor__type-chip"
                  onClick={() => handleAddQuestion(t.value)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </Card.Body>
      </Card>

      <div className="d-flex flex-wrap gap-3 mt-3 small text-muted">
        <span>共 {questions.length} 題</span>
        <span>必填 {questions.filter((q) => q.required).length}</span>
        <span>單選 {questions.filter((q) => q.type === 'radio').length}</span>
        <span>多選 {questions.filter((q) => q.type === 'checkbox').length}</span>
        <span>量表 {questions.filter((q) => q.type === 'likert').length}</span>
      </div>
    </div>
  );

  if (!showPreview) {
    return <div className="survey-question-editor">{editorPane}</div>;
  }

  return (
    <div className="survey-question-editor">
      <div className={`survey-question-editor__layout${!previewOpen ? ' preview-collapsed' : ''}`}>
        {editorPane}
        {previewOpen ? (
          <div className="survey-question-editor__preview-col">
            <SurveyStudentPreview schema={schema} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
