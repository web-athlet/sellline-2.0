import { Eye, Link2, MailOpen, Users, UserX } from 'lucide-react';
import type { Campaign } from '@/lib/campaigns-api';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function CampaignStats({ campaign }: { campaign: Campaign }) {
  const openRate =
    campaign.totalRecipients > 0
      ? ((campaign.openCount / campaign.totalRecipients) * 100).toFixed(1)
      : '0.0';
  const clickRate =
    campaign.totalRecipients > 0
      ? ((campaign.clickCount / campaign.totalRecipients) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        icon={<Users className="h-4 w-4" />}
        label="Empfänger"
        value={campaign.totalRecipients}
      />
      <StatCard
        icon={<MailOpen className="h-4 w-4" />}
        label="Geöffnet"
        value={campaign.openCount}
        sub={`${openRate}%`}
      />
      <StatCard
        icon={<Link2 className="h-4 w-4" />}
        label="Geklickt"
        value={campaign.clickCount}
        sub={`${clickRate}%`}
      />
      <StatCard
        icon={<UserX className="h-4 w-4" />}
        label="Abgemeldet"
        value={campaign.unsubCount}
      />
      <StatCard icon={<Eye className="h-4 w-4" />} label="Bounced" value={campaign.bounceCount} />
    </div>
  );
}
