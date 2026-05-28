'use client';

import { cn } from '@nextgen/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronDown, ChevronUp, CornerDownLeft, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import type { AISummary, EmailSummary, ThreadDetail } from '@/lib/email-api';
import { summarizeThread } from '@/lib/email-api';
import { AISummaryBanner } from './AISummaryBanner';
import { ComposeModal } from './ComposeModal';

interface Props {
  thread: ThreadDetail | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function ThreadView({ thread, isLoading, onRefresh }: Props) {
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLoadSummary = async () => {
    if (!thread) return;
    setAiLoading(true);
    try {
      const s = await summarizeThread(thread.threadId);
      setAiSummary(s);
    } catch {
      // summary unavailable
    } finally {
      setAiLoading(false);
    }
  };

  const handleDraftReply = (draft: string) => {
    setReplyDraft(draft);
    setShowCompose(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Laden…
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Mail className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">E-Mail auswählen</p>
      </div>
    );
  }

  const latestEmail = thread.emails[thread.emails.length - 1];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Thread header */}
      <div className="px-6 py-4 border-b border-gray-200 shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 truncate">
          {thread.emails[0]?.subject ?? '(kein Betreff)'}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">{thread.emails.length} E-Mail(s)</p>
      </div>

      {/* AI Summary */}
      <AISummaryBanner
        threadId={thread.threadId}
        emailCount={thread.emails.length}
        summary={aiSummary}
        isLoading={aiLoading}
        onLoad={handleLoadSummary}
        onDraftReply={handleDraftReply}
      />

      {/* Emails */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {thread.emails.map((email, idx) => {
          const isLast = idx === thread.emails.length - 1;
          const isExpanded = expandedIds.has(email.id) || isLast;

          return (
            <EmailCard
              key={email.id}
              email={email}
              isExpanded={isExpanded}
              onToggle={() => toggleExpanded(email.id)}
            />
          );
        })}
      </div>

      {/* Reply bar */}
      <div className="px-4 pb-4 shrink-0">
        <button
          onClick={() => {
            setReplyDraft(null);
            setShowCompose(true);
          }}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <CornerDownLeft className="h-4 w-4" />
          Antworten an {latestEmail?.fromAddress ?? ''}…
        </button>
      </div>

      {showCompose && (
        <ComposeModal
          defaultTo={latestEmail?.fromAddress ?? ''}
          defaultSubject={`Re: ${latestEmail?.subject ?? ''}`}
          defaultBody={replyDraft ?? undefined}
          threadId={thread.threadId}
          inReplyToMessageId={latestEmail?.id}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

function EmailCard({
  email,
  isExpanded,
  onToggle,
}: {
  email: EmailSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn('rounded-xl border border-gray-200 overflow-hidden', isExpanded && 'shadow-sm')}
    >
      {/* Email header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
            {email.fromAddress.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {email.isSent ? `An: ${email.toAddresses[0] ?? ''}` : email.fromAddress}
            </p>
            {!isExpanded && <p className="text-xs text-gray-400 truncate">{email.bodyPreview}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">
            {format(new Date(email.sentAt), 'dd.MM.yyyy HH:mm', { locale: de })}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Email body */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-400 mb-3 space-y-0.5">
            <div>
              <span className="font-medium">Von:</span> {email.fromAddress}
            </div>
            <div>
              <span className="font-medium">An:</span> {email.toAddresses.join(', ')}
            </div>
            {email.cc.length > 0 && (
              <div>
                <span className="font-medium">CC:</span> {email.cc.join(', ')}
              </div>
            )}
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-3">
            {email.bodyPreview}
            {email.bodyPreview.length === 200 && '…'}
          </div>
        </div>
      )}
    </div>
  );
}
