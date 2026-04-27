import { Component, inject, signal, computed, output, OnInit } from '@angular/core';
import { CHECKIN_XP, CheckinService } from '../../../core/services/checkin.service';

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

@Component({
  selector: 'app-check-in-card',
  standalone: true,
  template: `
    <div class="relative overflow-hidden rounded-2xl border"
         [class]="checkin.todayChecked() ? 'border-primary/40 bg-primary-dim' : 'border-border bg-card-2'">

      <div class="absolute inset-0 bg-grid-lines bg-grid opacity-30 pointer-events-none"></div>
      @if (checkin.todayChecked()) {
        <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
      }

      <!-- Main row -->
      <div class="relative flex items-center justify-between gap-3 p-4">

        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
               [class]="checkin.todayChecked() ? 'bg-primary/20 border border-primary/30' : 'bg-card border border-border'">
            @if (checkin.todayChecked()) {
              <svg class="animate-check-pop" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            } @else {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            }
          </div>

          <div>
            <p class="text-[13px] font-body font-semibold" [class]="checkin.todayChecked() ? 'text-primary' : 'text-white'">
              {{ checkin.todayChecked() ? 'Check-in realizado!' : 'Check-in diário' }}
            </p>
            <p class="text-[11px] text-text-2 font-body mt-0.5">
              {{ checkin.todayChecked() ? 'Você garantiu +' + checkinXp + ' XP hoje 💪' : 'Marque presença, some +' + checkinXp + ' XP e mantenha seu streak' }}
            </p>
          </div>
        </div>

        <div class="flex flex-col items-end gap-2 shrink-0">
          <!-- Streak + calendar toggle -->
          <button (click)="showCalendar.set(!showCalendar())"
                  class="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1 hover:border-primary/40 transition-colors">
            <span class="text-[13px]">🔥</span>
            <span class="text-[12px] font-mono font-semibold text-white">{{ checkin.streak() }}</span>
            <span class="text-[10px] text-text-2 font-body">dias</span>
            <svg class="ml-0.5 transition-transform" [class.rotate-180]="showCalendar()"
                 width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2.5" stroke-linecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          <div class="flex flex-col items-end gap-1.5">
            <span class="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-body font-semibold text-primary">
              +{{ checkinXp }} XP
            </span>
            @if (!checkin.todayChecked()) {
              <button (click)="doCheckIn()"
                      [disabled]="busy()"
                      class="bg-primary text-bg text-[12px] font-body font-semibold px-4 py-1.5 rounded-lg hover:shadow-glow transition-all active:scale-95 disabled:opacity-50">
                {{ busy() ? '...' : 'Check-in' }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Week bar -->
      <div class="relative px-4 pb-4 flex gap-1.5">
        @for (day of weekDays(); track day.date) {
          <div class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full h-1 rounded-full overflow-hidden"
                 [class]="day.done ? 'bg-primary/20' : 'bg-border'">
              @if (day.done) {
                <div class="h-full bg-primary rounded-full animate-bar-grow" style="width:100%"></div>
              }
            </div>
            <span class="text-[9px] font-body"
                  [class]="day.today ? 'text-primary font-semibold' : 'text-text-2'">
              {{ day.short }}
            </span>
          </div>
        }
      </div>

      <!-- ── Calendar ── -->
      @if (showCalendar()) {
        <div class="border-t border-border px-4 pt-3 pb-4 animate-slide-up">

          <!-- Calendar header -->
          <div class="flex items-center justify-between mb-3">
            <button (click)="prevMonth()" class="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-text-2 hover:text-white transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="text-[13px] font-body font-semibold text-white">
              {{ MONTH_NAMES[calMonth() - 1] }} {{ calYear() }}
            </span>
            <button (click)="nextMonth()" [disabled]="isCurrentMonth()"
                    class="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-text-2 hover:text-white transition-colors disabled:opacity-30">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <!-- Day labels -->
          <div class="grid grid-cols-7 mb-1">
            @for (l of ['S','T','Q','Q','S','S','D']; track l + $index) {
              <div class="text-center text-[9px] font-body text-text-2 py-0.5">{{ l }}</div>
            }
          </div>

          <!-- Calendar grid -->
          <div class="grid grid-cols-7 gap-y-1">
            @for (cell of calendarCells(); track $index) {
              @if (cell === null) {
                <div></div>
              } @else {
                <div class="flex items-center justify-center">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-body transition-colors"
                       [class]="cellClass(cell)">
                    {{ cell.day }}
                  </div>
                </div>
              }
            }
          </div>

          <!-- Month stats -->
          <div class="mt-3 flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2">
            <div class="text-center">
              <p class="text-[16px] font-display font-bold text-primary">{{ monthStats().total }}</p>
              <p class="text-[9px] text-text-2 font-body">check-ins</p>
            </div>
            <div class="h-6 w-px bg-border"></div>
            <div class="text-center">
              <p class="text-[16px] font-display font-bold text-white">{{ monthStats().days }}</p>
              <p class="text-[9px] text-text-2 font-body">dias no mês</p>
            </div>
            <div class="h-6 w-px bg-border"></div>
            <div class="text-center">
              <p class="text-[16px] font-display font-bold text-white">{{ monthStats().pct }}%</p>
              <p class="text-[9px] text-text-2 font-body">frequência</p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CheckInCardComponent implements OnInit {
  readonly checkin = inject(CheckinService);
  readonly checkinXp = CHECKIN_XP;
  readonly MONTH_NAMES = MONTH_NAMES;

  onWalk = output<void>();

  showCalendar = signal(false);
  busy         = signal(false);

  // Calendar navigation
  private _now     = new Date();
  calYear  = signal(this._now.getFullYear());
  calMonth = signal(this._now.getMonth() + 1);

  ngOnInit(): void {
    this.checkin.loadYear(this._now.getFullYear());
  }

  async doCheckIn(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.checkin.checkIn();
    } catch (e) {
      console.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  weekDays = computed(() => this.checkin.weekDays());

  monthStats = computed(() => {
    const { total, days } = this.checkin.monthStats(this.calYear(), this.calMonth());
    return { total, days, pct: days ? Math.round((total / days) * 100) : 0 };
  });

  isCurrentMonth(): boolean {
    return this.calYear() === this._now.getFullYear() && this.calMonth() === this._now.getMonth() + 1;
  }

  prevMonth(): void {
    if (this.calMonth() === 1) { this.calYear.update(y => y - 1); this.calMonth.set(12); }
    else this.calMonth.update(m => m - 1);
  }

  nextMonth(): void {
    if (this.isCurrentMonth()) return;
    if (this.calMonth() === 12) { this.calYear.update(y => y + 1); this.calMonth.set(1); }
    else this.calMonth.update(m => m + 1);
  }

  calendarCells = computed(() => {
    const year  = this.calYear();
    const month = this.calMonth();
    const first = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const days  = new Date(year, month, 0).getDate();
    const today = `${this._now.getFullYear()}-${String(this._now.getMonth()+1).padStart(2,'0')}-${String(this._now.getDate()).padStart(2,'0')}`;

    // Shift so week starts on Monday (0=Mon … 6=Sun)
    const offset = (first + 6) % 7;
    const cells: ({ day: number; iso: string; done: boolean; today: boolean } | null)[] = [];

    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= days; d++) {
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ day: d, iso, done: this.checkin.dates().includes(iso), today: iso === today });
    }
    return cells;
  });

  cellClass(cell: { done: boolean; today: boolean }): string {
    if (cell.today && cell.done) return 'bg-primary text-bg font-bold';
    if (cell.today)              return 'border border-primary/60 text-primary font-semibold';
    if (cell.done)               return 'bg-primary/20 text-primary';
    return 'text-text-2';
  }
}
