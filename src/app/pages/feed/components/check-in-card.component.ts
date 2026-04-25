import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-check-in-card',
  standalone: true,
  template: `
    <div class="relative overflow-hidden rounded-2xl border p-4"
         [class]="checkedIn() ? 'border-primary/40 bg-primary-dim' : 'border-border bg-card-2'">

      <!-- Background grid decoration -->
      <div class="absolute inset-0 bg-grid-lines bg-grid opacity-30 pointer-events-none"></div>

      <!-- Glow if checked in -->
      @if (checkedIn()) {
        <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
      }

      <div class="relative flex items-center justify-between gap-3">

        <!-- Left: icon + text -->
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
               [class]="checkedIn() ? 'bg-primary/20 border border-primary/30' : 'bg-card border border-border'">
            @if (checkedIn()) {
              <svg class="animate-check-pop" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            } @else {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8896A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            }
          </div>

          <div>
            <p class="text-[13px] font-body font-semibold" [class]="checkedIn() ? 'text-primary' : 'text-white'">
              {{ checkedIn() ? 'Check-in realizado!' : 'Check-in diário' }}
            </p>
            <p class="text-[11px] text-text-2 font-body mt-0.5">
              {{ checkedIn() ? 'Você marcou presença hoje 💪' : 'Marque presença e mantenha seu streak' }}
            </p>
          </div>
        </div>

        <!-- Streak badge + button -->
        <div class="flex flex-col items-end gap-2 shrink-0">
          <div class="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1">
            <span class="text-[13px]">🔥</span>
            <span class="text-[12px] font-mono font-semibold text-white">7</span>
            <span class="text-[10px] text-text-2 font-body">dias</span>
          </div>

          @if (!checkedIn()) {
            <button
              (click)="onCheckIn.emit()"
              class="bg-primary text-bg text-[12px] font-body font-semibold px-4 py-1.5 rounded-lg hover:shadow-glow transition-all active:scale-95"
            >
              Check-in
            </button>
          }
        </div>
      </div>

      <!-- Progress bar weekdays -->
      <div class="relative mt-4 flex gap-1.5">
        @for (day of weekDays; track day.label; let i = $index) {
          <div class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full h-1 rounded-full overflow-hidden"
                 [class]="day.done ? 'bg-primary/20' : 'bg-border'">
              @if (day.done) {
                <div class="h-full bg-primary rounded-full animate-bar-grow" [style.width]="'100%'"></div>
              }
            </div>
            <span class="text-[9px] font-body" [class]="day.today ? 'text-primary font-semibold' : (day.done ? 'text-text-2' : 'text-border-2')">
              {{ day.label }}
            </span>
          </div>
        }
      </div>
    </div>
  `,
})
export class CheckInCardComponent {
  checkedIn = input<boolean>(false);
  onCheckIn = output<void>();

  weekDays = [
    { label: 'S', done: true, today: false },
    { label: 'T', done: true, today: false },
    { label: 'Q', done: true, today: false },
    { label: 'Q', done: true, today: false },
    { label: 'S', done: true, today: false },
    { label: 'S', done: false, today: false },
    { label: 'D', done: false, today: true },
  ];
}
