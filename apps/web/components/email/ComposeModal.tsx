'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Loader2, Send, X } from 'lucide-react';
import { useState } from 'react';
import { sendEmail } from '@/lib/email-api';

interface Props {
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  threadId?: string;
  inReplyToMessageId?: string;
  onClose: () => void;
  onSent?: () => void;
}

export function ComposeModal({
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  threadId,
  inReplyToMessageId,
  onClose,
  onSent,
}: Props) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Nachricht schreiben…' })],
    content: defaultBody ? `<p>${defaultBody}</p>` : '',
    editorProps: {
      attributes: {
        class: 'min-h-[200px] p-3 text-sm focus:outline-none prose prose-sm max-w-none',
      },
    },
  });

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !editor) return;

    setIsSending(true);
    setError(null);

    try {
      await sendEmail({
        to: to
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        subject,
        bodyHtml: editor.getHTML(),
        threadId,
        inReplyToMessageId,
      });
      onSent?.();
      onClose();
    } catch {
      setError('Senden fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <span className="text-sm font-semibold text-gray-700">Neue E-Mail</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="border-b border-gray-200">
          <div className="flex items-center px-4 py-2 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-8 shrink-0">An</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="empfänger@beispiel.de"
              className="flex-1 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center px-4 py-2">
            <span className="text-xs text-gray-400 w-8 shrink-0">Betreff</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff"
              className="flex-1 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto max-h-64">
          <EditorContent editor={editor} />
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-t border-red-200">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 font-bold"
            >
              B
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 italic"
            >
              I
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100"
            >
              • Liste
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={isSending || !to.trim() || !subject.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Senden
          </button>
        </div>
      </div>
    </div>
  );
}
