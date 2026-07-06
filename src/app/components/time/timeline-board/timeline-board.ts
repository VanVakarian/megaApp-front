import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TimeCatalogueService } from '@app/services/time/time-catalogue.service';
import { TimeDisplayPrefsService } from '@app/services/time/time-display-prefs.service';
import { TimeEntriesService } from '@app/services/time/time-entries.service';
import { TimeEntry, TimeTrack } from '@app/shared/time-types';
import { DropdownItem, VDropdown } from '@ui-kit/components/v-dropdown/v-dropdown';
import { SegmentLabel } from './segment-label/segment-label';

const MINUTES_PER_DAY = 1440;
const MIN_DURATION_MINUTES = 10;
const DEFAULT_DURATION_MINUTES = 60;
const INITIAL_VISIBLE_DAYS = 45;
const OLDER_DAYS_BATCH = 30;
const LOAD_OLDER_SCROLL_TOP_PX = 240;
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24] as const;

interface Segment {
  entry: TimeEntry;
  startMinute: number;
  endMinute: number;
  isTrueStart: boolean;
  isTrueEnd: boolean;
  startClock: string;
  endClock: string;
  durationLabel: string;
}

interface ActiveAdjustment {
  entryId: number;
  track: TimeTrack;
  startAbs: number;
  endAbs: number;
}

interface PreviewSlot {
  dayIso: string;
  track: TimeTrack;
  leftPct: number;
  widthPct: number;
}

interface PickerState {
  dayIso: string;
  track: TimeTrack;
  startMinute: number;
  endMinute: number;
  x: number;
  y: number;
}

interface DayLabel {
  weekday: string;
  month: string;
  day: string;
  year: string;
}

@Component({
  selector: 'timeline-board',
  templateUrl: './timeline-board.html',
  styleUrl: './timeline-board.scss',
  imports: [VDropdown, NgTemplateOutlet, SegmentLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineBoard {
  public readonly snapMinutesInput = input<number>(15);

  protected readonly Track = TimeTrack;
  protected readonly hourTicks = HOUR_TICKS;

  private readonly timelineScrollElem = viewChild<ElementRef<HTMLDivElement>>('timelineScrollElem');
  private readonly injector = inject(Injector);
  private readonly timeEntriesService = inject(TimeEntriesService);
  private readonly timeCatalogueService = inject(TimeCatalogueService);
  protected readonly timeDisplayPrefsService = inject(TimeDisplayPrefsService);

  protected readonly isLoaded$$ = computed(() => this.timeEntriesService.isLoaded$$());
  private readonly todayDayNumber = this.dayIsoToDayNumber(this.todayIso());
  private readonly currentYear = new Date().getFullYear();
  protected readonly visibleStartDayNumber$$ = signal(this.todayDayNumber - INITIAL_VISIBLE_DAYS + 1);

  protected readonly days$$ = computed<string[]>(() => {
    const days: string[] = [];
    for (let dayNumber = this.visibleStartDayNumber$$(); dayNumber <= this.todayDayNumber; dayNumber++) {
      days.push(this.dayNumberToDayIso(dayNumber));
    }
    return days;
  });

  protected readonly shouldShowYearColumn$$ = computed(() => {
    const startYear = new Date(this.visibleStartDayNumber$$() * 86_400_000).getFullYear();
    return startYear !== this.currentYear;
  });

  protected readonly activeAdjustment$$ = signal<ActiveAdjustment | null>(null);
  protected readonly previewSlot$$ = signal<PreviewSlot | null>(null);
  protected readonly pickerState$$ = signal<PickerState | null>(null);
  protected readonly isInitialScrollReady$$ = signal(false);

  private hasScrolledToInitialBottom = false;
  private isPrependingDays = false;
  private readonly initialBottomScrollEffect$$ = effect(() => {
    if (!this.isLoaded$$() || this.hasScrolledToInitialBottom) return;
    this.scrollToBottomAfterRender();
  });

  protected readonly activityItems$$ = computed<DropdownItem[]>(() => {
    const recentIds = this.timeCatalogueService.recentActivityIds$$();
    const activities = this.timeCatalogueService.activities$$().filter((activity) => !activity.isArchived);
    const byId = new Map(activities.map((activity) => [activity.id, activity]));
    const ordered = [...recentIds.map((id) => byId.get(id)).filter((activity) => !!activity), ...activities];
    const seen = new Set<number>();
    const result: DropdownItem[] = [];
    for (const activity of ordered) {
      if (!activity || seen.has(activity.id)) continue;
      seen.add(activity.id);
      result.push({ value: String(activity.id), label: activity.name });
    }
    return result;
  });

  protected dayLabel(dayIso: string): DayLabel {
    const [year, month, day] = dayIso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return {
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      day: String(day),
      year: String(year),
    };
  }

  protected hourLeftPct(hour: number): number {
    return (hour / 24) * 100;
  }

  protected segmentsFor(dayIso: string, track: TimeTrack): Segment[] {
    const index = this.timeEntriesService.entriesByDay$$();
    const adjustment = this.activeAdjustment$$();
    const dayNumber = this.dayIsoToDayNumber(dayIso);
    const dayAbsBase = dayNumber * MINUTES_PER_DAY;
    const segments: Segment[] = [];

    const ownLanes = index.get(dayIso);
    for (const entry of ownLanes?.[track] ?? []) {
      if (adjustment?.entryId === entry.id) continue;
      const crossesMidnight = entry.endAt.slice(0, 10) !== dayIso;
      segments.push({
        entry,
        startMinute: this.minutesOfDay(entry.startAt),
        endMinute: crossesMidnight ? MINUTES_PER_DAY : this.minutesOfDay(entry.endAt),
        isTrueStart: true,
        isTrueEnd: !crossesMidnight,
        startClock: this.formatClock(entry.startAt),
        endClock: this.formatClock(entry.endAt),
        durationLabel: this.durationLabel(this.toAbsoluteMinutes(entry.startAt), this.toAbsoluteMinutes(entry.endAt)),
      });
    }

    const previousDayIso = this.dayNumberToDayIso(dayNumber - 1);
    const previousLanes = index.get(previousDayIso);
    for (const entry of previousLanes?.[track] ?? []) {
      if (adjustment?.entryId === entry.id) continue;
      if (entry.endAt.slice(0, 10) !== dayIso) continue;
      segments.push({
        entry,
        startMinute: 0,
        endMinute: this.minutesOfDay(entry.endAt),
        isTrueStart: false,
        isTrueEnd: true,
        startClock: this.formatClock(entry.startAt),
        endClock: this.formatClock(entry.endAt),
        durationLabel: this.durationLabel(this.toAbsoluteMinutes(entry.startAt), this.toAbsoluteMinutes(entry.endAt)),
      });
    }

    if (adjustment && adjustment.track === track) {
      const entry = this.timeEntriesService.entries$$().find((candidate) => candidate.id === adjustment.entryId);
      const segStart = Math.max(adjustment.startAbs, dayAbsBase);
      const segEnd = Math.min(adjustment.endAbs, dayAbsBase + MINUTES_PER_DAY);
      if (entry && segStart < segEnd) {
        segments.push({
          entry,
          startMinute: segStart - dayAbsBase,
          endMinute: segEnd - dayAbsBase,
          isTrueStart: segStart === adjustment.startAbs,
          isTrueEnd: segEnd === adjustment.endAbs,
          startClock: this.clockFromAbsMinutes(adjustment.startAbs),
          endClock: this.clockFromAbsMinutes(adjustment.endAbs),
          durationLabel: this.durationLabel(adjustment.startAbs, adjustment.endAbs),
        });
      }
    }

    return segments.sort((a, b) => a.startMinute - b.startMinute);
  }

  protected segmentStyle(segment: Segment): Record<string, string> {
    return {
      left: `${(segment.startMinute / MINUTES_PER_DAY) * 100}%`,
      width: `${((segment.endMinute - segment.startMinute) / MINUTES_PER_DAY) * 100}%`,
    };
  }

  protected activityName(activityId: number): string {
    return this.timeCatalogueService.activities$$().find((activity) => activity.id === activityId)?.name ?? '…';
  }

  protected activityColor(activityId: number): string {
    const activity = this.timeCatalogueService.activities$$().find((item) => item.id === activityId);
    if (!activity) return '#868E96';
    const categories = this.timeCatalogueService.categories$$();
    const activityCategories = activity.categoryIds.map((id) => categories.find((category) => category.id === id));
    const areaCategory = activityCategories.find((category) => category?.kind === 'area' && category.color);
    const anyCategory = activityCategories.find((category) => category?.color);
    return areaCategory?.color ?? anyCategory?.color ?? '#868E96';
  }

  protected onSegmentPointerDown(event: PointerEvent, entry: TimeEntry): void {
    const target = event.target as HTMLElement;
    if (target.closest('.handle') || target.closest('.seg-delete')) return;
    this.startMove(event, entry);
  }

  protected onHandlePointerDown(event: PointerEvent, entry: TimeEntry, side: 'left' | 'right'): void {
    event.stopPropagation();
    this.startResize(event, entry, side);
  }

  protected deleteEntry(entry: TimeEntry): void {
    this.timeEntriesService.deleteEntry(entry.id);
  }

  protected onTimelineScroll(event: Event): void {
    const scrollEl = event.currentTarget as HTMLDivElement;
    if (scrollEl.scrollTop > LOAD_OLDER_SCROLL_TOP_PX || this.isPrependingDays) return;
    this.prependOlderDays(scrollEl);
  }

  private startMove(event: PointerEvent, entry: TimeEntry): void {
    event.preventDefault();
    const laneEl = (event.currentTarget as HTMLElement).closest('.lane') as HTMLElement;
    const laneRect = laneEl.getBoundingClientRect();
    const startClientX = event.clientX;
    const originDayNumber = this.dayIsoToDayNumber(entry.startAt.slice(0, 10));
    const originStartAbs = this.toAbsoluteMinutes(entry.startAt);
    const originEndAbs = this.toAbsoluteMinutes(entry.endAt);
    const duration = originEndAbs - originStartAbs;
    let lockedTrack = entry.track;
    let moved = false;

    this.activeAdjustment$$.set({
      entryId: entry.id,
      track: entry.track,
      startAbs: originStartAbs,
      endAbs: originEndAbs,
    });

    const onMove = (moveEvent: PointerEvent) => {
      moved = true;
      const dxMinutes = ((moveEvent.clientX - startClientX) / laneRect.width) * MINUTES_PER_DAY;

      let rowDeltaMinutes = 0;
      const hoverLaneEl = (
        document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null
      )?.closest('.lane') as HTMLElement | null;
      if (hoverLaneEl?.dataset['dayIso']) {
        if (moveEvent.shiftKey) lockedTrack = (hoverLaneEl.dataset['track'] as TimeTrack) ?? lockedTrack;
        const hoverDayNumber = this.dayIsoToDayNumber(hoverLaneEl.dataset['dayIso']!);
        rowDeltaMinutes = (hoverDayNumber - originDayNumber) * MINUTES_PER_DAY;
      }

      const candidateStart = this.snapValue(originStartAbs + rowDeltaMinutes + dxMinutes);
      const constrainedStart = this.constrainMoveStart(candidateStart, duration, lockedTrack, entry.id);
      this.activeAdjustment$$.set({
        entryId: entry.id,
        track: lockedTrack,
        startAbs: constrainedStart,
        endAbs: constrainedStart + duration,
      });
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const adjustment = this.activeAdjustment$$();
      this.activeAdjustment$$.set(null);
      if (!moved || !adjustment) return;
      this.timeEntriesService.updateEntry(entry.id, {
        activityId: entry.activityId,
        track: adjustment.track,
        startAt: this.fromAbsoluteMinutes(adjustment.startAbs),
        endAt: this.fromAbsoluteMinutes(adjustment.endAbs),
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  private startResize(event: PointerEvent, entry: TimeEntry, side: 'left' | 'right'): void {
    event.preventDefault();
    const laneEl = (event.currentTarget as HTMLElement).closest('.lane') as HTMLElement;
    const laneRect = laneEl.getBoundingClientRect();
    const startClientX = event.clientX;
    const originStartAbs = this.toAbsoluteMinutes(entry.startAt);
    const originEndAbs = this.toAbsoluteMinutes(entry.endAt);
    let moved = false;

    let lower = -Infinity;
    let upper = Infinity;
    for (const other of this.timeEntriesService.entries$$()) {
      if (other.track !== entry.track || other.id === entry.id) continue;
      const otherStart = this.toAbsoluteMinutes(other.startAt);
      const otherEnd = this.toAbsoluteMinutes(other.endAt);
      if (otherEnd <= originStartAbs) lower = Math.max(lower, otherEnd);
      if (otherStart >= originEndAbs) upper = Math.min(upper, otherStart);
    }

    this.activeAdjustment$$.set({
      entryId: entry.id,
      track: entry.track,
      startAbs: originStartAbs,
      endAbs: originEndAbs,
    });

    const onMove = (moveEvent: PointerEvent) => {
      moved = true;
      const dxMinutes = ((moveEvent.clientX - startClientX) / laneRect.width) * MINUTES_PER_DAY;
      if (side === 'left') {
        const candidateStart = this.snapValue(originStartAbs + dxMinutes);
        const newStart = Math.max(lower, Math.min(candidateStart, originEndAbs - MIN_DURATION_MINUTES));
        this.activeAdjustment$$.set({
          entryId: entry.id,
          track: entry.track,
          startAbs: newStart,
          endAbs: originEndAbs,
        });
      } else {
        const candidateEnd = this.snapValue(originEndAbs + dxMinutes);
        const newEnd = Math.min(upper, Math.max(candidateEnd, originStartAbs + MIN_DURATION_MINUTES));
        this.activeAdjustment$$.set({
          entryId: entry.id,
          track: entry.track,
          startAbs: originStartAbs,
          endAbs: newEnd,
        });
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const adjustment = this.activeAdjustment$$();
      this.activeAdjustment$$.set(null);
      if (!moved || !adjustment) return;
      this.timeEntriesService.updateEntry(entry.id, {
        activityId: entry.activityId,
        track: entry.track,
        startAt: this.fromAbsoluteMinutes(adjustment.startAbs),
        endAt: this.fromAbsoluteMinutes(adjustment.endAbs),
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  protected onLaneMouseMove(event: MouseEvent, dayIso: string, track: TimeTrack): void {
    if (this.activeAdjustment$$()) {
      this.previewSlot$$.set(null);
      return;
    }
    const laneRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const rawMinute = ((event.clientX - laneRect.left) / laneRect.width) * MINUTES_PER_DAY;
    const slot = this.findGapSlot(dayIso, track, rawMinute);
    if (!slot) {
      this.previewSlot$$.set(null);
      return;
    }
    this.previewSlot$$.set({
      dayIso,
      track,
      leftPct: (slot.start / MINUTES_PER_DAY) * 100,
      widthPct: ((slot.end - slot.start) / MINUTES_PER_DAY) * 100,
    });
  }

  protected onLaneMouseLeave(): void {
    this.previewSlot$$.set(null);
  }

  protected onLaneClick(event: MouseEvent, dayIso: string, track: TimeTrack): void {
    if ((event.target as HTMLElement).closest('.seg')) return;
    const laneRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const rawMinute = ((event.clientX - laneRect.left) / laneRect.width) * MINUTES_PER_DAY;
    const slot = this.findGapSlot(dayIso, track, rawMinute);
    if (!slot) return;

    this.pickerState$$.set({
      dayIso,
      track,
      startMinute: slot.start,
      endMinute: slot.end,
      x: event.clientX,
      y: event.clientY,
    });
  }

  protected onActivityPicked(item: DropdownItem | null): void {
    const picker = this.pickerState$$();
    this.pickerState$$.set(null);
    if (!picker || !item) return;

    const dayAbsBase = this.dayIsoToDayNumber(picker.dayIso) * MINUTES_PER_DAY;
    this.timeEntriesService.createEntry({
      activityId: Number(item.value),
      track: picker.track,
      startAt: this.fromAbsoluteMinutes(dayAbsBase + picker.startMinute),
      endAt: this.fromAbsoluteMinutes(dayAbsBase + picker.endMinute),
    });
  }

  protected closePicker(): void {
    this.pickerState$$.set(null);
  }

  private findGapSlot(dayIso: string, track: TimeTrack, rawMinute: number): { start: number; end: number } | null {
    const dayAbsBase = this.dayIsoToDayNumber(dayIso) * MINUTES_PER_DAY;
    const trackEntries = this.timeEntriesService
      .entries$$()
      .filter((entry) => entry.track === track)
      .map((entry) => ({ start: this.toAbsoluteMinutes(entry.startAt), end: this.toAbsoluteMinutes(entry.endAt) }));

    const rawAbs = dayAbsBase + rawMinute;
    if (trackEntries.some((range) => rawAbs >= range.start && rawAbs < range.end)) return null;

    let gapStart = dayAbsBase;
    let gapEnd = dayAbsBase + MINUTES_PER_DAY;
    for (const range of trackEntries) {
      if (range.end <= rawAbs && range.end > gapStart) gapStart = range.end;
      if (range.start >= rawAbs && range.start < gapEnd) gapEnd = range.start;
    }

    const duration = Math.min(DEFAULT_DURATION_MINUTES, gapEnd - gapStart);
    if (duration < MIN_DURATION_MINUTES) return null;

    const snappedCenter = this.snapValue(rawAbs);
    const start = Math.max(gapStart, Math.min(snappedCenter, gapEnd - duration));
    return { start: start - dayAbsBase, end: start - dayAbsBase + duration };
  }

  private constrainMoveStart(candidateStart: number, duration: number, track: TimeTrack, excludeId: number): number {
    let lower = -Infinity;
    let upper = Infinity;
    const center = candidateStart + duration / 2;

    for (const entry of this.timeEntriesService.entries$$()) {
      if (entry.track !== track || entry.id === excludeId) continue;
      const start = this.toAbsoluteMinutes(entry.startAt);
      const end = this.toAbsoluteMinutes(entry.endAt);
      const mid = (start + end) / 2;
      if (center < mid) {
        upper = Math.min(upper, start - duration);
      } else {
        lower = Math.max(lower, end);
      }
    }

    if (lower > upper) return candidateStart;
    return Math.max(lower, Math.min(candidateStart, upper));
  }

  private prependOlderDays(scrollEl: HTMLDivElement): void {
    this.isPrependingDays = true;
    const previousScrollHeight = scrollEl.scrollHeight;
    const previousScrollTop = scrollEl.scrollTop;
    this.visibleStartDayNumber$$.update((dayNumber) => dayNumber - OLDER_DAYS_BATCH);

    afterNextRender(
      {
        write: () => {
          scrollEl.scrollTop = scrollEl.scrollHeight - previousScrollHeight + previousScrollTop;
          this.isPrependingDays = false;
        },
      },
      { injector: this.injector },
    );
  }

  private scrollToBottomAfterRender(): void {
    this.hasScrolledToInitialBottom = true;
    afterNextRender(
      {
        write: () => {
          const scrollEl = this.timelineScrollElem()?.nativeElement;
          if (!scrollEl) {
            this.hasScrolledToInitialBottom = false;
            return;
          }
          scrollEl.scrollTop = scrollEl.scrollHeight;
          this.isInitialScrollReady$$.set(true);
        },
      },
      { injector: this.injector },
    );
  }

  private snapValue(absMinutes: number): number {
    const snap = this.snapMinutesInput();
    if (!snap) return Math.round(absMinutes);
    return Math.round(absMinutes / snap) * snap;
  }

  private minutesOfDay(iso: string): number {
    const [hours, minutes] = iso.slice(11, 16).split(':').map(Number);
    return hours * 60 + minutes;
  }

  private toAbsoluteMinutes(iso: string): number {
    return this.dayIsoToDayNumber(iso.slice(0, 10)) * MINUTES_PER_DAY + this.minutesOfDay(iso);
  }

  private fromAbsoluteMinutes(absMinutes: number): string {
    const dayNumber = Math.floor(absMinutes / MINUTES_PER_DAY);
    const minutesOfDay = Math.round(absMinutes - dayNumber * MINUTES_PER_DAY);
    const hours = Math.floor(minutesOfDay / 60);
    const minutes = minutesOfDay % 60;
    return `${this.dayNumberToDayIso(dayNumber)}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }

  private formatClock(iso: string): string {
    return iso.slice(11, 16);
  }

  private clockFromAbsMinutes(absMinutes: number): string {
    const minutesOfDay = ((Math.round(absMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const hours = Math.floor(minutesOfDay / 60);
    const minutes = minutesOfDay % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private durationLabel(startAbs: number, endAbs: number): string {
    const totalMinutes = Math.round(endAbs - startAbs);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  private dayIsoToDayNumber(dayIso: string): number {
    const [year, month, day] = dayIso.split('-').map(Number);
    return Math.round(new Date(year, month - 1, day).getTime() / 86_400_000);
  }

  private dayNumberToDayIso(dayNumber: number): string {
    const date = new Date(dayNumber * 86_400_000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
