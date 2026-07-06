export const TimeTrack = {
  Primary: 'primary',
  Secondary: 'secondary',
} as const;
export type TimeTrack = (typeof TimeTrack)[keyof typeof TimeTrack];

export const TimeCategoryKind = {
  Area: 'area',
} as const;
export type TimeCategoryKind = (typeof TimeCategoryKind)[keyof typeof TimeCategoryKind];

export const TimeImpact = {
  Useful: 'useful',
  Neutral: 'neutral',
  Wasteful: 'wasteful',
} as const;
export type TimeImpact = (typeof TimeImpact)[keyof typeof TimeImpact];

export const TimeScreenView = {
  Entry: 'entry',
  Stats: 'stats',
} as const;
export type TimeScreenView = (typeof TimeScreenView)[keyof typeof TimeScreenView];

export interface TimeActivity {
  id: number;
  name: string;
  isArchived: boolean;
  categoryIds: number[];
  createdAt: string;
}

export interface TimeCategory {
  id: number;
  name: string;
  kind: TimeCategoryKind | string | null;
  color: string | null;
  impact: TimeImpact | null;
  createdAt: string;
}

export interface TimeEntry {
  id: number;
  activityId: number;
  track: TimeTrack;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeActivityInput {
  name: string;
  isArchived: boolean;
  categoryIds: number[];
}

export interface TimeCategoryInput {
  name: string;
  kind: string | null;
  color: string | null;
  impact: TimeImpact | null;
}

export interface TimeEntryInput {
  activityId: number;
  track: TimeTrack;
  startAt: string;
  endAt: string;
}
