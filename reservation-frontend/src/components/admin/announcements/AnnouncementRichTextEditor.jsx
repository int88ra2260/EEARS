import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Button, ButtonGroup, Form } from 'react-bootstrap';
import SharedMediaLibraryModal from '../../media/SharedMediaLibraryModal';
import { FontSize } from './tiptapFontSize';
import {
  plainTextToAnnouncementHtml,
  sanitizeAnnouncementHtml,
} from '../../../utils/sanitizeAnnouncementHtml';
import './AnnouncementRichTextEditor.css';

const FONT_OPTIONS = [
  { label: '預設', value: '' },
  { label: '思源黑體', value: '"Noto Sans TC", "Source Han Sans TC", sans-serif' },
  { label: '思源宋體', value: '"Noto Serif TC", "Source Han Serif TC", serif' },
  { label: '標楷體', value: '"DFKai-SB", "BiauKai", "標楷體", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
];

const SIZE_OPTIONS = [
  { label: '字級', value: '' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
];

function ToolbarBtn({ active, disabled, onClick, children, title }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'primary' : 'outline-secondary'}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="ann-rte-toolbar__btn"
    >
      {children}
    </Button>
  );
}

/**
 * @param {object} props
 * @param {string} props.value
 * @param {(html: string) => void} props.onChange
 * @param {string} [props.token]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {string|number} [props.resetKey] — 變更時重載內容（載入／切換公告）
 */
export default function AnnouncementRichTextEditor({
  value,
  onChange,
  token,
  placeholder = '在此撰寫公告內容…',
  disabled = false,
  resetKey = 'default',
}) {
  const [mediaOpen, setMediaOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: 'ann-rte-image' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: plainTextToAnnouncementHtml(value || ''),
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange?.(sanitizeAnnouncementHtml(ed.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const next = plainTextToAnnouncementHtml(value || '');
    editor.commands.setContent(next, false);
    // 僅在 resetKey 變更時重載，避免打字被蓋掉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, resetKey]);

  if (!editor) {
    return <div className="ann-rte ann-rte--loading text-muted p-3">載入編輯器…</div>;
  }

  const setLink = () => {
    const prev = editor.getAttributes('link').href || 'https://';
    const url = window.prompt('超連結 URL', prev);
    if (url === null) return;
    const trimmed = String(url).trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  return (
    <div className={`ann-rte ${disabled ? 'ann-rte--disabled' : ''}`}>
      <div className="ann-rte-toolbar" role="toolbar" aria-label="文字格式">
        <Form.Select
          size="sm"
          className="ann-rte-toolbar__select"
          aria-label="字型"
          value={editor.getAttributes('textStyle').fontFamily || ''}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
          disabled={disabled}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Form.Select>

        <Form.Select
          size="sm"
          className="ann-rte-toolbar__select ann-rte-toolbar__select--size"
          aria-label="字級"
          value={editor.getAttributes('textStyle').fontSize || ''}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
          disabled={disabled}
        >
          {SIZE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Form.Select>

        <label className="ann-rte-toolbar__color" title="文字顏色">
          <span className="visually-hidden">文字顏色</span>
          <input
            type="color"
            disabled={disabled}
            value={editor.getAttributes('textStyle').color || '#1a1a1a'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>

        <label className="ann-rte-toolbar__color" title="網底／螢光">
          <span className="visually-hidden">網底</span>
          <input
            type="color"
            disabled={disabled}
            value={editor.getAttributes('highlight').color || '#fff59d'}
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
        </label>

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
            title="斜體"
            active={editor.isActive('italic')}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolbarBtn>
          <ToolbarBtn
            title="底線"
            active={editor.isActive('underline')}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </ToolbarBtn>
          <ToolbarBtn
            title="刪除線"
            active={editor.isActive('strike')}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </ToolbarBtn>
        </ButtonGroup>

        <ButtonGroup size="sm">
          <ToolbarBtn
            title="靠左"
            active={editor.isActive({ textAlign: 'left' })}
            disabled={disabled}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            左
          </ToolbarBtn>
          <ToolbarBtn
            title="置中"
            active={editor.isActive({ textAlign: 'center' })}
            disabled={disabled}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            中
          </ToolbarBtn>
          <ToolbarBtn
            title="靠右"
            active={editor.isActive({ textAlign: 'right' })}
            disabled={disabled}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            右
          </ToolbarBtn>
          <ToolbarBtn
            title="左右對齊"
            active={editor.isActive({ textAlign: 'justify' })}
            disabled={disabled}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          >
            齊
          </ToolbarBtn>
        </ButtonGroup>

        <ButtonGroup size="sm">
          <ToolbarBtn
            title="項目符號"
            active={editor.isActive('bulletList')}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • 清單
          </ToolbarBtn>
          <ToolbarBtn
            title="編號清單"
            active={editor.isActive('orderedList')}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. 清單
          </ToolbarBtn>
        </ButtonGroup>

        <ButtonGroup size="sm">
          <ToolbarBtn title="超連結" active={editor.isActive('link')} disabled={disabled} onClick={setLink}>
            連結
          </ToolbarBtn>
          <ToolbarBtn title="插入圖片" disabled={disabled || !token} onClick={() => setMediaOpen(true)}>
            圖片
          </ToolbarBtn>
          <ToolbarBtn
            title="插入表格"
            disabled={disabled}
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            表格
          </ToolbarBtn>
        </ButtonGroup>

        {editor.isActive('table') ? (
          <ButtonGroup size="sm">
            <ToolbarBtn disabled={disabled} onClick={() => editor.chain().focus().addColumnAfter().run()} title="加欄">
              +欄
            </ToolbarBtn>
            <ToolbarBtn disabled={disabled} onClick={() => editor.chain().focus().addRowAfter().run()} title="加列">
              +列
            </ToolbarBtn>
            <ToolbarBtn disabled={disabled} onClick={() => editor.chain().focus().deleteTable().run()} title="刪表格">
              刪表
            </ToolbarBtn>
          </ButtonGroup>
        ) : null}
      </div>

      <EditorContent editor={editor} className="ann-rte-surface" />

      <SharedMediaLibraryModal
        show={mediaOpen}
        onHide={() => setMediaOpen(false)}
        token={token}
        title="插入內文圖片"
        uploadScope="announcement"
        onSelect={(item) => {
          const src = item.url || item.urlPath || '';
          if (src) {
            editor.chain().focus().setImage({ src, alt: item.alt || '' }).run();
          }
          setMediaOpen(false);
        }}
      />
    </div>
  );
}
