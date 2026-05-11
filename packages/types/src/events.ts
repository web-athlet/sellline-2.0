export interface PingPayload {
  msg: string;
  ts: number;
}

export interface PongPayload {
  msg: string;
  ts: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deal events — emitted by the API after every Deal mutation. Frontend uses
// these to apply React-Query setQueryData updates without re-fetching.
// ─────────────────────────────────────────────────────────────────────────────

export interface DealEventBase {
  ts: number;
  userId: string | null;
}

export interface DealCreatedEvent extends DealEventBase {
  dealId: string;
  pipelineId: string;
  stageId: string;
}

export interface DealUpdatedEvent extends DealEventBase {
  dealId: string;
  pipelineId: string;
}

export interface DealStageChangedEvent extends DealEventBase {
  dealId: string;
  pipelineId: string;
  oldStageId: string;
  newStageId: string;
  order: number;
}

export interface DealDeletedEvent extends DealEventBase {
  dealId: string;
  pipelineId: string;
}

export interface DealRotIndicatorEvent extends DealEventBase {
  dealId: string;
  pipelineId: string;
  rotIndicator: boolean;
}

export type DealEventName =
  | 'deal:created'
  | 'deal:updated'
  | 'deal:stage_changed'
  | 'deal:deleted'
  | 'deal:rot_indicator';

// ─────────────────────────────────────────────────────────────────────────────
// Pulse-Feed events — emitted per-user via user room after cache invalidation.
// ─────────────────────────────────────────────────────────────────────────────

export interface PulseFeedUpdatedEvent {
  userId: string;
  tab: 'followups' | 'missed' | 'opportunities' | null;
  ts: number;
}
