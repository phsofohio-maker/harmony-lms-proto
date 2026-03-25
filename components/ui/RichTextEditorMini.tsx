import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Link as LinkIcon,
} from 'lucide-react';
import { cn } from '../../utils';

interface RichTextEditorMiniProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

function ToolbarButton({
  onClick,
  active = false,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'text-primary-700 bg-primary-50'
          : 'text-gray-500 hover:bg-gray-100'
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />;
}

export const RichTextEditorMini: React.FC<RichTextEditorMiniProps> = ({
  content,
  onChange,
  placeholder = 'Add a description...',
  className,
  rows = 3,
}) => {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const minHeight = `${rows * 24}px`;

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Typography,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(editor.getHTML());
      }, 300);
    },
  });

  // Sync content from parent when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  if (!editor) return null;

  const handleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div
      className={cn(
        'border border-gray-300 rounded-lg bg-white transition-colors',
        'focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500',
        className
      )}
    >
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-gray-50 rounded-t-lg px-2 py-1.5 flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" strokeWidth={1.75} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" strokeWidth={1.75} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={handleLink}
          active={editor.isActive('link')}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" strokeWidth={1.75} />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="tiptap-content p-3 outline-none"
        style={{ minHeight }}
      />
    </div>
  );
};
