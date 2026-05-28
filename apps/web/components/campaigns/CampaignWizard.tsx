'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { AiSubjectsPanel } from './AiSubjectsPanel';
import { CampaignEmailEditor } from './CampaignEmailEditor';
import {
  addCampaignContacts,
  campaignsKeys,
  createCampaign,
  getAiSubjects,
  sendCampaign,
  updateCampaign,
  type AiSubjectSuggestion,
} from '@/lib/campaigns-api';
import { apiFetch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  emails: string[];
  optIn: boolean;
  deletedAt: string | null;
}

interface PersonsResponse {
  data: Person[];
  meta: { total: number };
}

const STEPS = ['Vorlage', 'Empfänger', 'Editor', 'Senden'] as const;

// ─── Wizard ───────────────────────────────────────────────────────────────────

export function CampaignWizard() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p>Hallo {{firstName}},</p>');
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<AiSubjectSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForceSend, setIsForceSend] = useState(false);

  // ─── Persons query for recipient picker ──────────────────────────────────

  const personsQuery = useQuery({
    queryKey: ['persons-for-campaign', search],
    queryFn: () =>
      apiFetch<PersonsResponse>(
        `/api/v1/contacts?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
        { accessToken: token ?? undefined },
      ),
    enabled: step === 1 && Boolean(token),
    staleTime: 30_000,
  });

  const persons = personsQuery.data?.data ?? [];
  const nonOptIn = persons.filter((p) => selectedPersonIds.has(p.id) && !p.optIn);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () => createCampaign({ name: name || 'Neue Kampagne', subject, bodyHtml }, token),
    onSuccess: (camp) => {
      setCampaignId(camp.id);
      setStep(1);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const recipientsMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) return;
      const ids = Array.from(selectedPersonIds);
      if (ids.length > 0) await addCampaignContacts(campaignId, ids, token);
    },
    onSuccess: () => {
      setStep(2);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const editorMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) return;
      await updateCampaign(campaignId, { bodyHtml, subject }, token);
    },
    onSuccess: () => {
      setStep(3);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendCampaign(campaignId!, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsKeys.all() });
      router.push('/campaigns');
    },
    onError: (e: Error) => {
      const body = (e as { body?: { code?: string; message?: string } }).body;
      if (body?.code === 'DSGVO_VIOLATION') {
        setError(`DSGVO-Verletzung: ${body.message}`);
      } else {
        setError(e.message);
      }
    },
  });

  // ─── AI Subjects ──────────────────────────────────────────────────────────

  const handleGenerateAi = async () => {
    if (!campaignId) return;
    setAiLoading(true);
    try {
      const suggestions = await getAiSubjects(campaignId, token);
      setAiSuggestions(suggestions);
    } catch {
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleNext = () => {
    setError(null);
    if (step === 0) createMutation.mutate();
    else if (step === 1) recipientsMutation.mutate();
    else if (step === 2) editorMutation.mutate();
    else if (step === 3 && sendConfirmed) sendMutation.mutate();
  };

  const isLoading =
    createMutation.isPending ||
    recipientsMutation.isPending ||
    editorMutation.isPending ||
    sendMutation.isPending;

  const canNext =
    step === 0
      ? name.trim().length > 0 && subject.trim().length > 0
      : step === 1
        ? selectedPersonIds.size > 0
        : step === 2
          ? bodyHtml.trim().length > 0
          : sendConfirmed && (nonOptIn.length === 0 || isForceSend);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i < step
                  ? 'bg-indigo-600 text-white'
                  : i === step
                    ? 'border-2 border-indigo-600 text-indigo-600'
                    : 'border border-slate-300 text-slate-400'
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-sm ${i === step ? 'font-medium text-slate-900' : 'text-slate-400'}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="ml-2 h-px w-12 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {/* Step 0 — Template */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Kampagne einrichten</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700">Kampagnenname</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Sommer-Newsletter 2026"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Betreffzeile</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Betreff der E-Mail"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Step 1 — Recipients */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Empfänger auswählen</h2>
            <input
              type="text"
              placeholder="Kontakt suchen…"
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            {/* DSGVO warning */}
            {nonOptIn.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700">DSGVO-Warnung</p>
                  <p className="text-sm text-red-600">
                    {nonOptIn.length} von {selectedPersonIds.size} Empfängern haben kein Opt-in.
                    Versand ist DSGVO-rechtlich nicht zulässig.
                  </p>
                </div>
              </div>
            )}

            <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {personsQuery.isLoading && (
                <div className="py-8 text-center text-sm text-slate-400">Lädt…</div>
              )}
              {persons.map((person) => {
                const checked = selectedPersonIds.has(person.id);
                return (
                  <label
                    key={person.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-slate-50 ${
                      !person.optIn ? 'opacity-60' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedPersonIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(person.id);
                          else next.delete(person.id);
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    <span className="flex-1 text-sm">
                      {person.firstName} {person.lastName}
                      <span className="ml-2 text-slate-400">{person.emails[0] ?? ''}</span>
                    </span>
                    {!person.optIn && (
                      <span className="text-xs text-red-500 font-medium">Kein Opt-in</span>
                    )}
                  </label>
                );
              })}
            </div>
            <p className="text-sm text-slate-500">{selectedPersonIds.size} Empfänger ausgewählt</p>
          </div>
        )}

        {/* Step 2 — Email Editor */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">E-Mail gestalten</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700">Betreffzeile</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {campaignId && (
              <AiSubjectsPanel
                suggestions={aiSuggestions}
                isLoading={aiLoading}
                onSelect={(s) => setSubject(s)}
                onGenerate={() => void handleGenerateAi()}
              />
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">E-Mail-Inhalt</label>
              <CampaignEmailEditor value={bodyHtml} onChange={setBodyHtml} />
            </div>
          </div>
        )}

        {/* Step 3 — Send */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Versand bestätigen</h2>

            <div className="rounded-lg border border-slate-200 p-4 space-y-2 text-sm">
              <p>
                <span className="font-medium">Kampagne:</span> {name}
              </p>
              <p>
                <span className="font-medium">Betreff:</span> {subject}
              </p>
              <p>
                <span className="font-medium">Empfänger:</span> {selectedPersonIds.size}
              </p>
            </div>

            {nonOptIn.length > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  DSGVO-Verletzung: {nonOptIn.length} Empfänger ohne Opt-in
                </div>
                <p className="mt-1 text-xs text-red-600">
                  Der Versand ist rechtlich unzulässig. Entfernen Sie Empfänger ohne Opt-in.
                </p>
                <label className="mt-3 flex items-center gap-2 text-xs text-red-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isForceSend}
                    onChange={(e) => setIsForceSend(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="font-medium">
                    Als ADMIN: Versand trotzdem erzwingen (Audit-Log)
                  </span>
                </label>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendConfirmed}
                onChange={(e) => setSendConfirmed(e.target.checked)}
                disabled={nonOptIn.length > 0 && !isForceSend}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 disabled:opacity-50"
              />
              <span className="text-sm text-slate-700">
                Ich bestätige, dass alle Empfänger DSGVO-konform sind.
              </span>
            </label>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => (step > 0 ? setStep(step - 1) : router.push('/campaigns'))}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 0 ? 'Abbrechen' : 'Zurück'}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canNext || isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {step === STEPS.length - 1 ? (
            <>
              <Sparkles className="h-4 w-4" />
              Kampagne senden
            </>
          ) : (
            <>
              Weiter
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
