'use client';

import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  CheckSquare,
  DollarSign,
  History,
  Mail,
  Phone,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  getContact,
  getContactTimeline,
  type ActivityDetail,
  type ContactDetail,
  type DealSummary,
  type TimelineItem,
} from '../../../../lib/contacts-api';

type Tab = 'overview' | 'deals' | 'activities' | 'emails' | 'timeline';

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'overview', label: 'Übersicht', Icon: CheckSquare },
  { id: 'deals', label: 'Deals', Icon: DollarSign },
  { id: 'activities', label: 'Aktivitäten', Icon: Activity },
  { id: 'emails', label: 'E-Mails', Icon: Mail },
  { id: 'timeline', label: 'Timeline', Icon: History },
];

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [c, t] = await Promise.all([
          getContact(params.id, token),
          getContactTimeline(params.id, token),
        ]);
        setContact(c);
        setTimeline(t.data);
      } catch {
        setError('Kontakt konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id, token]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400" role="status">
        Lade Kontakt…
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="p-8 text-red-600" role="alert">
        {error ?? 'Kontakt nicht gefunden.'}
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const initials = `${contact.firstName[0] ?? ''}${contact.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Header */}
      <div className="border-b border-slate-200 bg-surface px-6 py-5">
        <Link
          href="/contacts"
          className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Kontakte
        </Link>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
            {contact.org && (
              <Link
                href={`/organizations/${contact.org.id}`}
                className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
              >
                <Building2 className="h-3 w-3" />
                {contact.org.name}
              </Link>
            )}
          </div>
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            {contact.phones[0] && (
              <a
                href={`tel:${contact.phones[0]}`}
                className="flex items-center gap-1 rounded-button border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                <Phone className="h-4 w-4" /> Anrufen
              </a>
            )}
            {contact.emails[0] && (
              <a
                href={`mailto:${contact.emails[0]}`}
                className="flex items-center gap-1 rounded-button border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                <Mail className="h-4 w-4" /> E-Mail
              </a>
            )}
            <button className="flex items-center gap-1 rounded-button border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">
              <Calendar className="h-4 w-4" /> Meeting
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-surface px-6">
        <nav className="-mb-px flex gap-6" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                activeTab === id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && <OverviewTab contact={contact} />}
        {activeTab === 'deals' && <DealsTab deals={contact.dealParticipations} />}
        {activeTab === 'activities' && <ActivitiesTab activities={contact.activities} />}
        {activeTab === 'emails' && (
          <div className="text-sm text-slate-500">E-Mails werden in Session 11 verknüpft.</div>
        )}
        {activeTab === 'timeline' && <TimelineTab items={timeline} />}
      </div>
    </div>
  );
}

function OverviewTab({ contact }: { contact: ContactDetail }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="rounded-card border border-slate-200 p-4">
        <h2 className="mb-3 font-semibold text-slate-800">Kontaktdaten</h2>
        <dl className="space-y-2 text-sm">
          {contact.emails.map((e) => (
            <div key={e} className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-400">E-Mail</dt>
              <dd>
                <a href={`mailto:${e}`} className="text-indigo-600 hover:underline">
                  {e}
                </a>
              </dd>
            </div>
          ))}
          {contact.phones.map((p) => (
            <div key={p} className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-400">Telefon</dt>
              <dd>
                <a href={`tel:${p}`} className="hover:underline">
                  {p}
                </a>
              </dd>
            </div>
          ))}
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-400">Opt-in</dt>
            <dd>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${contact.optIn ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
              >
                {contact.optIn ? 'Ja' : 'Nein'}
              </span>
            </dd>
          </div>
          {contact.notes && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-400">Notizen</dt>
              <dd className="whitespace-pre-wrap text-slate-700">{contact.notes}</dd>
            </div>
          )}
        </dl>
      </section>
      <section className="rounded-card border border-slate-200 p-4">
        <h2 className="mb-3 font-semibold text-slate-800">Details</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-400">Erstellt</dt>
            <dd>{new Date(contact.createdAt).toLocaleDateString('de-DE')}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-400">Geändert</dt>
            <dd>{new Date(contact.updatedAt).toLocaleDateString('de-DE')}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-400">Deals</dt>
            <dd>{contact.dealParticipations.length}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function DealsTab({ deals }: { deals: DealSummary[] }) {
  if (deals.length === 0) return <p className="text-sm text-slate-500">Keine Deals.</p>;
  return (
    <div className="space-y-3">
      {deals.map((deal) => (
        <div
          key={deal.id}
          className="flex items-center justify-between rounded-card border border-slate-200 px-4 py-3"
        >
          <div>
            <Link
              href={`/deals/${deal.id}`}
              className="font-medium text-slate-900 hover:text-indigo-600 hover:underline"
            >
              {deal.title}
            </Link>
            <p className="text-xs text-slate-400">{deal.stage.name}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-800">
              {Number(deal.value).toLocaleString('de-DE', {
                style: 'currency',
                currency: deal.currency,
              })}
            </p>
            <span
              className={`text-xs font-medium ${deal.wonAt ? 'text-green-600' : deal.closedAt ? 'text-slate-500' : 'text-indigo-600'}`}
            >
              {deal.wonAt ? 'Gewonnen' : deal.closedAt ? 'Abgeschlossen' : 'Offen'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivitiesTab({ activities }: { activities: ActivityDetail[] }) {
  if (activities.length === 0) return <p className="text-sm text-slate-500">Keine Aktivitäten.</p>;
  return (
    <div className="space-y-3">
      {activities.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-3 rounded-card border px-4 py-3 ${a.done ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}
        >
          <span
            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${a.done ? 'bg-green-400' : 'bg-indigo-500'}`}
          />
          <div className="flex-1">
            <p className="font-medium text-slate-900">{a.subject}</p>
            <div className="flex gap-3 text-xs text-slate-400">
              <span>{a.type}</span>
              {a.dueDate && <span>{new Date(a.dueDate).toLocaleDateString('de-DE')}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineTab({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">Keine Timeline-Einträge.</p>;

  return (
    <ol className="relative border-l border-slate-200 space-y-6 ml-4">
      {items.map((item) => {
        const date = item._type === 'email' ? item.sentAt : (item.dueDate ?? item.createdAt);
        return (
          <li key={item.id} className="ml-6">
            <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white border-2 border-slate-300">
              {item._type === 'email' ? (
                <Mail className="h-2.5 w-2.5 text-slate-500" />
              ) : (
                <Activity className="h-2.5 w-2.5 text-indigo-500" />
              )}
            </span>
            <p className="font-medium text-slate-900 text-sm">{item.subject}</p>
            {item._type === 'email' && item.fromAddress && (
              <p className="text-xs text-slate-400">Von: {item.fromAddress}</p>
            )}
            {date && (
              <time className="text-xs text-slate-400">
                {new Date(date).toLocaleString('de-DE')}
              </time>
            )}
          </li>
        );
      })}
    </ol>
  );
}
