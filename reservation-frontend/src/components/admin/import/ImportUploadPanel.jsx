import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';

/**
 * 通用匯入上傳面板（P12 骨架）。
 * 不直接呼叫 API；由父層提供 onSubmit。
 *
 * @param {{
 *   title: string,
 *   description?: React.ReactNode,
 *   acceptedFileTypes?: string,
 *   selectedFile?: File|null,
 *   onFileChange?: (file: File|null, event?: React.ChangeEvent<HTMLInputElement>) => void,
 *   onSubmit?: (event: React.FormEvent<HTMLFormElement>, file: File|null) => void|Promise<void>,
 *   isSubmitting?: boolean,
 *   submitLabel?: string,
 *   disabled?: boolean,
 *   notice?: React.ReactNode,
 *   children?: React.ReactNode,
 *   className?: string,
 *   variant?: 'default' | 'minimal'
 * }} props
 */
export default function ImportUploadPanel({
  title,
  description = '',
  acceptedFileTypes = '.xlsx,.xls',
  selectedFile = null,
  onFileChange,
  onSubmit,
  isSubmitting = false,
  submitLabel = '開始匯入',
  disabled = false,
  notice = '',
  children = null,
  className = '',
  variant = 'default',
}) {
  const panelDisabled = disabled || isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onSubmit) return;
    await onSubmit(event, selectedFile || null);
  };

  const handleInputChange = (event) => {
    const file = event?.target?.files?.[0] || null;
    if (onFileChange) onFileChange(file, event);
  };

  const isMinimal = variant === 'minimal';
  const cardClass = [
    'import-upload-panel',
    isMinimal ? 'import-upload-panel--minimal' : 'border-0 shadow-sm',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Card className={cardClass}>
      <Card.Body>
        {isMinimal ? null : (
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
            <div>
              <h6 className="mb-1">{title}</h6>
              {description ? <div className="small text-muted">{description}</div> : null}
            </div>
          </div>
        )}

        {notice ? (
          isMinimal ? (
            <div className="import-upload-panel__notice">{notice}</div>
          ) : (
            <Alert variant="info" className="py-2 small">
              {notice}
            </Alert>
          )
        ) : null}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="small mb-1">選擇檔案</Form.Label>
            <Form.Control
              type="file"
              accept={acceptedFileTypes}
              onChange={handleInputChange}
              disabled={panelDisabled}
            />
            <Form.Text className="text-muted">
              支援格式：{acceptedFileTypes}
              {selectedFile ? `；已選擇：${selectedFile.name}` : ''}
            </Form.Text>
          </Form.Group>

          {children ? <div className="mb-3">{children}</div> : null}

          <div className="d-flex flex-wrap align-items-center gap-2">
            <Button type="submit" variant="primary" disabled={panelDisabled || !selectedFile}>
              {isSubmitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  處理中...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
