import { CampaignWizard } from '@/components/campaigns/CampaignWizard';

export default function NewCampaignPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="text-xl font-semibold text-slate-900">Neue Kampagne erstellen</h1>
        <p className="mt-0.5 text-sm text-slate-500">DSGVO-konformer 4-Schritt-Assistent</p>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <CampaignWizard />
      </div>
    </div>
  );
}
