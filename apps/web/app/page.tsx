'use client';

import { useState } from 'react';
import { cn } from '@nextgen/utils';
import { useSocket } from '@/hooks/use-socket';

export default function HomePage() {
  const { status, sendPing } = useSocket();
  const [msg, setMsg] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const handleSend = async () => {
    const sent = msg.trim() || 'hello';
    const startedAt = Date.now();
    try {
      const pong = await sendPing(sent);
      const rtt = Date.now() - startedAt;
      const line = `[${new Date().toLocaleTimeString()}] sent: "${sent}" → pong: "${pong.msg}" (RTT ${rtt}ms)`;
      setLog((prev) => [line, ...prev].slice(0, 20));
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown error';
      setLog((prev) =>
        [`[${new Date().toLocaleTimeString()}] FAILED: ${reason}`, ...prev].slice(0, 20),
      );
    }
  };

  const statusColor = {
    idle: 'bg-slate-300 text-slate-700',
    connecting: 'bg-amber-200 text-amber-800',
    connected: 'bg-emerald-200 text-emerald-800',
    error: 'bg-rose-200 text-rose-800',
  }[status];

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">NextGen CRM — WebSocket Echo Demo</h1>
        <span className={cn('px-3 py-1 rounded-full text-xs font-medium uppercase', statusColor)}>
          {status}
        </span>
      </header>

      <p className="text-sm text-slate-600">
        Session 0 Smoke-Test: Sende eine Ping-Nachricht an die NestJS-API auf Port 3001 und sieh die
        Antwort als Pong-Event.
      </p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <input
          className="flex-1 rounded border border-slate-300 px-3 py-2"
          placeholder='Nachricht (default: "hello")'
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          disabled={status !== 'connected'}
        >
          Send Ping
        </button>
      </form>

      <section className="rounded border border-slate-200 bg-white p-4 text-sm font-mono">
        <h2 className="mb-2 text-xs uppercase text-slate-500">Log</h2>
        {log.length === 0 ? (
          <p className="text-slate-400">Noch keine Pings gesendet.</p>
        ) : (
          <ul className="space-y-1">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
