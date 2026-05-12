import { Calendar, Clock, FileText, Mail, Phone, Utensils } from 'lucide-react';
import type { ActivityType } from '@/lib/activities-api';

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  CALL: Phone,
  MEETING: Calendar,
  TASK: FileText,
  DEADLINE: Clock,
  EMAIL: Mail,
  LUNCH: Utensils,
};

const COLORS: Record<ActivityType, string> = {
  CALL: 'text-blue-500',
  MEETING: 'text-violet-500',
  TASK: 'text-amber-500',
  DEADLINE: 'text-red-500',
  EMAIL: 'text-cyan-500',
  LUNCH: 'text-emerald-500',
};

interface Props {
  type: ActivityType;
  className?: string;
}

export function ActivityTypeIcon({ type, className = 'h-4 w-4' }: Props) {
  const Icon = ICONS[type];
  return <Icon className={`${className} ${COLORS[type]}`} />;
}
