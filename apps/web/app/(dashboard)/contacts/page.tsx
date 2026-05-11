'use client';

import { GitMerge, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ContactFilters } from '../../../components/contacts/ContactFilters';
import { ContactsTable } from '../../../components/contacts/ContactsTable';
import { Pagination } from '../../../components/contacts/Pagination';
import {
  deleteContact,
  getContacts,
  type ContactListItem,
  type ContactSortField,
  type PaginatedMeta,
} from '../../../lib/contacts-api';

export default function ContactsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 25, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<ContactSortField | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getContacts({
        page,
        limit,
        search: debouncedSearch || undefined,
        sort,
        accessToken: token,
      });
      setContacts(res.data);
      setMeta(res.meta);
      setSelected(new Set());
    } catch {
      setError('Kontakte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sort, token]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  // Reset to page 1 when filter/sort/limit changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort, limit]);

  const handleSelectToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id)),
    );
  }, [contacts]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Kontakt wirklich löschen?')) return;
      try {
        await deleteContact(id, token);
        await fetchContacts();
      } catch {
        alert('Löschen fehlgeschlagen.');
      }
    },
    [token, fetchContacts],
  );

  const handleBulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} Kontakte wirklich löschen?`)) return;
    try {
      await Promise.all([...selected].map((id) => deleteContact(id, token)));
      await fetchContacts();
    } catch {
      alert('Bulk-Löschen fehlgeschlagen.');
    }
  }, [selected, token, fetchContacts]);

  const handleBulkExport = useCallback(() => {
    const rows = contacts.filter((c) => selected.has(c.id));
    const header = 'Vorname,Nachname,E-Mail,Telefon,Organisation';
    const lines = rows.map((c) =>
      [c.firstName, c.lastName, c.emails[0] ?? '', c.phones[0] ?? '', c.org?.name ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kontakte.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [contacts, selected]);

  const selectedCount = useMemo(() => selected.size, [selected]);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kontakte</h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-slate-500">
              {meta.total.toLocaleString('de-DE')} Kontakte gesamt
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/contacts/duplicates"
            className="flex items-center gap-2 rounded-button border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <GitMerge className="h-4 w-4" />
            Duplikate prüfen
          </Link>
          <button
            className="flex items-center gap-2 rounded-button bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-400"
            onClick={() => alert('Neuer Kontakt — Modal folgt in Session 5')}
          >
            <Plus className="h-4 w-4" />
            Neuer Kontakt
          </button>
        </div>
      </div>

      {/* Filters */}
      <ContactFilters
        search={search}
        onSearchChange={setSearch}
        limit={limit}
        onLimitChange={setLimit}
        selectedCount={selectedCount}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
      />

      {/* Error */}
      {error && (
        <div
          className="rounded-button border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Table */}
      <ContactsTable
        contacts={contacts}
        sort={sort}
        onSortChange={setSort}
        selected={selected}
        onSelectToggle={handleSelectToggle}
        onSelectAll={handleSelectAll}
        onDelete={handleDelete}
        loading={loading}
      />

      {/* Pagination */}
      <Pagination
        page={meta.page}
        pages={meta.pages}
        total={meta.total}
        limit={meta.limit}
        onPageChange={setPage}
      />
    </div>
  );
}
