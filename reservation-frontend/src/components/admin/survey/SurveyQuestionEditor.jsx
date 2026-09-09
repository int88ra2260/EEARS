/**
 * 視覺化問卷編輯器
 * 讓管理員不需要編輯 JSON，直接用 UI 新增/編輯/排序題目
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

const QUESTION_TYPES = [
  { value: 'radio', label: '單選題', icon: '○' },
  { value: 'checkbox', label: '多選題', icon: '☑' },
  { value: 'likert', label: '量表題（1-5分）', icon: '★' },
  { value: 'text', label: '單行文字', icon: '—' },
  { value: 'textarea', label: '多行文字', icon: '≡' },
  { value: 'email', label: '電子郵件', icon: '@' },
];

const DEFAULT_LIKERT_SCALE = [1, 2, 3, 4, 5];

function generateQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function QuestionTypeIcon({ type }) {
  const found = QUESTION_TYPES.find((t) => t.value === type);
  return <span className="me-1">{found?.icon || '?'}</span>;
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
    const newOptions = options.filter((_, i) => i !== index);
    onChange(newOptions);
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
        <InputGroup size="sm" className="mb-1" key={idx}>
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
          >
            ↑
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => handleMoveOption(idx, 1)}
            disabled={idx === options.length - 1}
            title="下移"
          >
            ↓
          </Button>
          <Button
            variant="outline-danger"
            onClick={() => handleRemoveOption(idx)}
            disabled={options.length <= 1}
            title="刪除"
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

function QuestionItem({ question, index, total, onChange, onDelete, onMove }) {
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
          <Badge bg="light" text="dark" className="fw-normal">
            {index + 1}
          </Badge>
          <QuestionTypeIcon type={question.type} />
          <span className="flex-grow-1 text-truncate" style={{ maxWidth: '400px' }}>
            {question.label || '（未命名題目）'}
          </span>
          {question.required && (
            <Badge bg="danger" className="ms-auto">必填</Badge>
          )}
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
            <Form.Label className="small text-muted">題目 ID（進階）</Form.Label>
            <Form.Control
              value={question.id || ''}
              onChange={(e) => handleFieldChange('id', e.target.value)}
              placeholder="question_id"
              className="font-monospace small"
            />
          </Col>
          <Col md={6} className="d-flex align-items-end gap-3">
            <Form.Check
              type="switch"
              label="必填"
              checked={!!question.required}
              onChange={(e) => handleFieldChange('required', e.target.checked)}
            />
          </Col>
          {needsOptions && (
            <Col xs={12}>
              <OptionsEditor
                options={question.options || []}
                onChange={(opts) => handleFieldChange('options', opts)}
              />
            </Col>
          )}
          {question.type === 'likert' && (
            <Col xs={12}>
              <Form.Label className="small text-muted">量表範圍</Form.Label>
              <div className="d-flex gap-2 align-items-center">
                <span className="small text-muted">1（非常不同意）</span>
                <span className="mx-2">—</span>
                <span className="small text-muted">5（非常同意）</span>
              </div>
            </Col>
          )}
          <Col xs={12}>
            <div className="d-flex justify-content-between mt-2 pt-2 border-top">
              <div className="d-flex gap-1">
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

export default function SurveyQuestionEditor({ schema, onChange }) {
  const [activeKey, setActiveKey] = useState(null);

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
  }, [questions, handleQuestionsChange]);

  const handleMoveQuestion = useCallback((index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    handleQuestionsChange(newQuestions);
  }, [questions, handleQuestionsChange]);

  return (
    <div className="survey-question-editor">
      {/* 問卷基本資訊 */}
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
              <Form.Label className="small text-muted">問卷代碼（ID）</Form.Label>
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
                placeholder="問卷的說明文字，會顯示在問卷最上方"
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* 題目列表 */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white fw-semibold d-flex justify-content-between align-items-center">
          <span>題目列表（共 {questions.length} 題）</span>
        </Card.Header>
        <Card.Body className="p-2">
          {questions.length === 0 ? (
            <div className="text-center text-muted py-4">
              <div className="mb-2">尚未新增任何題目</div>
              <div className="small">點擊下方按鈕開始新增題目</div>
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
                />
              ))}
            </Accordion>
          )}

          {/* 新增題目按鈕 */}
          <div className="d-flex flex-wrap gap-2 mt-3 pt-3 border-top">
            <span className="small text-muted align-self-center me-2">新增題目：</span>
            {QUESTION_TYPES.map((t) => (
              <Button
                key={t.value}
                variant="outline-primary"
                size="sm"
                onClick={() => handleAddQuestion(t.value)}
              >
                {t.icon} {t.label}
              </Button>
            ))}
          </div>
        </Card.Body>
      </Card>

      {/* 統計資訊 */}
      <div className="d-flex gap-3 mt-3 small text-muted">
        <span>📝 共 {questions.length} 題</span>
        <span>✓ 必填 {questions.filter((q) => q.required).length} 題</span>
        <span>○ 單選 {questions.filter((q) => q.type === 'radio').length} 題</span>
        <span>☑ 多選 {questions.filter((q) => q.type === 'checkbox').length} 題</span>
        <span>★ 量表 {questions.filter((q) => q.type === 'likert').length} 題</span>
      </div>
    </div>
  );
}
