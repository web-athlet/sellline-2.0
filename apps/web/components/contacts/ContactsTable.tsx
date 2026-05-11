'use client';

import { ArrowUpDown, Building2, ChevronDown, ChevronUp, Mail, Phone, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback } from 'react';
import type { ContactListItem, ContactSortField } from '../../lib/contacts-api';

interface Props {
  contacts: ContactListItem[];
  sort: ContactSortField | undefined;
  onSortChange: (field: ContactSortField) => void;
  selected: Set<string>;
  onSelectToggle: (id: string) => void;
  onSelectAll: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

type SortableColumn = {
  key: string;
  label: string;
  asc: ContactSortField;
  desc: ContactSortField;
};

const COLUMNS: SortableColumn[] = [
  { key: 'name', label: 'Name', asc: 'name', desc: '-name' },
  { key: 'org', label: 'Organisation', asc: 'org', desc: '-org' },
  { key: 'email', label: 'E-Mail', asc: 'name', desc: 'name' },
  { key: 'phone', label: 'Telefon', asc: 'name', desc: 'name' },
  { key: 'deals', label: 'Offene Deals', asc: 'deals', desc: '-deals' },
  { key: 'closedDeals', label: 'Abg. Deals', asc: 'deals', desc: '-deals' },
  { key: 'nextActivity', label: 'Nächste Aktivität', asc: 'createdAt', desc: '-createdAt' },
  { key: 'owner', label: 'Besitzer', asc: 'name', desc: '-name' },
];

function SortIcon({ col, sort }: { col: SortableColumn; sort: ContactSortField | undefined }) {
  if (sort === col.asc) return <ChevronUp className="ml-1 inline h-3 w-3" />;
  if (sort === col.desc) return <ChevronDown className="ml-1 inline h-3 w-3" />;
  return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
}

export function ContactsTable({
  contacts,
  sort,
  onSortChange,
  selected,
  onSelectToggle,
  onSelectAll,
  onDelete,
  loading,
}: Props) {
  const handleSortClick = useCallback(
    (col: SortableColumn) => {
      onSortChange(sort === col.asc ? col.desc : col.asc);
    },
    [sort, onSortChange],
  );

  const allSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400" role="status">
        <span>Lade Kontakte…</span>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400">
        Keine Kontakte gefunden.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-slate-200 bg-surface shadow-card">
      <table className="min-w-full divide-y divide-slate-200 text-sm" data-testid="contacts-table">
        <thead className="bg-slate-50">
          <tr>
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                aria-label="Alle auswählen"
                className="rounded border-slate-300"
              />
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left font-medium text-slate-500 hover:text-slate-800"
                onClick={() => handleSortClick(col)}
              >
                {col.label}
                <SortIcon col={col} sort={sort} />
              </th>
            ))}
            <th className="w-12 px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              selected={selected.has(contact.id)}
              onSelectToggle={onSelectToggle}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactRow({
  contact,
  selected,
  onSelectToggle,
  onDelete,
}: {
  contact: ContactListItem;
  selected: boolean;
  onSelectToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const fullName = `${contact.firstName} ${contact.lastName}`;
  const initials = `${contact.firstName[0] ?? ''}${contact.lastName[0] ?? ''}`.toUpperCase();

  return (
    <tr className={`group transition-colors hover:bg-slate-50 ${selected ? 'bg-indigo-50' : ''}`}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelectToggle(contact.id)}
          aria-label={`${fullName} auswählen`}
          className="rounded border-slate-300"
        />
      </td>

      {/* Name */}
      <td className="px-4 py-3">
        <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2 hover:underline">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
            {initials}
          </span>
          <span className="font-medium text-slate-900">{fullName}</span>
        </Link>
      </td>

      {/* Org */}
      <td className="px-4 py-3">
        {contact.org ? (
          <Link
            href={`/organizations/${contact.org.id}`}
            className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 hover:underline"
          >
            <Building2 className="h-3 w-3" />
            {contact.org.name}
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Email */}
      <td className="px-4 py-3">
        {contact.emails[0] ? (
          <a
            href={`mailto:${contact.emails[0]}`}
            className="flex items-center gap-1 text-slate-600 hover:text-indigo-600"
          >
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[180px]">{contact.emails[0]}</span>
          </a>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Phone */}
      <td className="px-4 py-3">
        {contact.phones[0] ? (
          <a
            href={`tel:${contact.phones[0]}`}
            className="flex items-center gap-1 text-slate-600 hover:text-indigo-600"
          >
            <Phone className="h-3 w-3 shrink-0" />
            {contact.phones[0]}
          </a>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Open Deals */}
      <td className="px-4 py-3 text-center">
        {contact.openDeals > 0 ? (
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {contact.openDeals}
          </span>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>

      {/* Closed Deals */}
      <td className="px-4 py-3 text-center">
        {contact.closedDeals > 0 ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            {contact.closedDeals}
          </span>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>

      {/* Next Activity */}
      <td className="px-4 py-3">
        {contact.nextActivity ? (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-700">
              {contact.nextActivity.subject}
            </span>
            {contact.nextActivity.dueDate && (
              <span className="text-xs text-slate-400">
                {new Date(contact.nextActivity.dueDate).toLocaleDateString('de-DE')}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Owner */}
      <td className="px-4 py-3 text-slate-500 text-xs">
        {contact.ownerId ? (
          <span className="truncate max-w-[80px] block" title={contact.ownerId}>
            {contact.ownerId.slice(0, 8)}…
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onDelete(contact.id)}
          aria-label={`${fullName} löschen`}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
