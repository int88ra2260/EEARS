import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, ButtonGroup } from 'react-bootstrap';
import {
  plainTextToEmailEditorHtml,
  sanitizeEmailTemplateHtml,
} from '../../../utils/sanitizeEmailTemplateHtml';
import './EmailTemplateRichTextEditor.css';

function ToolbarBtn({ active, disabled, onClick, children, title }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'primary' : 'outline-secondary'}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="email-rte-toolbar__btn"
    >
      {children}
    </Button>
  );
}

/**
 * 郵件模板精簡富文字：粗體／底線／文字顏色。
 * ref.insertText(str) 供插入 {{變數}}。
 */
const EmailTemplateRichTextEditor = forwardRef(function EmailTemplateRichTextEditor(
  {
    value,
    onChange,
    placeholder = '撰寫郵件正文…可用 {{變數名}}',
    disabled = false,
    resetKey = 'default',
  },
  ref
) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        italic: false,
      }),
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({ placeholder }),
    ],
    content: plainTextToEmailEditorHtml(value || ''),
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange?.(sanitizeEmailTemplateHtml(ed.getHTML()));
    },
  });

  useImperativeHandle(ref, () => ({
    insertText: (text) => {
      if (!editor || disabled) return;
      editor.chain().focus().insertContent(String(text || '')).run();
      onChange?.(sanitizeEmailTemplateHtml(editor.getHTML()));
    },
  }), [editor, disabled, onChange]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const next = plainTextToEmailEditorHtml(value || '');
    editor.commands.setContent(next, false);
    // 僅在 resetKey 變更時重載
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, resetKey]);

  if (!editor) {
    return <div className="email-rte email-rte--loading text-muted p-3">載入編輯器…</div>;
  }

  return (
    <div className={`email-rte ${disabled ? 'email-rte--disabled' : ''}`}>
      <div className="email-rte-toolbar" role="toolbar" aria-label="郵件文字格式">
        <ButtonGroup size="sm">
          <ToolbarBtn
            title="粗體"
            active={editor.isActive('bold')}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </ToolbarBtn>
          <ToolbarBtn
            title="底線"
            active={editor.isActive('underline')}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </ToolbarBtn>
        </ButtonGroup>

        <label className="email-rte-toolbar__color" title="文字顏色">
          <span className="visually-hidden">文字顏色</span>
          <input
            type="color"
            disabled={disabled}
            value={editor.getAttributes('textStyle').color || '#222222'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>

        <ToolbarBtn
          title="清除顏色"
          disabled={disabled}
          onClick={() => editor.chain().focus().unsetColor().run()}
        >
          清色
        </ToolbarBtn>
      </div>

      <EditorContent editor={editor} className="email-rte-surface" />
    </div>
  );
});

export default EmailTemplateRichTextEditor;
