import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type TimerPhase = 'idle' | 'running' | 'paused' | 'done';

@Component({
  selector: 'app-timer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timer-shell">
      <div class="timer-meta">
        <span class="timer-dot" [class.is-running]="phase() === 'running'" [class.is-paused]="phase() === 'paused'"></span>
        <span>{{ label() }}</span>
      </div>
      <p class="timer-value"
         [class.is-running]="phase() === 'running'"
         [class.is-paused]="phase() === 'paused'">
        {{ formattedTime() }}
      </p>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .timer-shell {
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:0.45rem;
    }
    .timer-meta {
      display:flex;
      align-items:center;
      gap:0.5rem;
      font-size:0.68rem;
      letter-spacing:0.22em;
      text-transform:uppercase;
      color:#96A0AA;
      font-family:var(--font-body, inherit);
    }
    .timer-dot {
      width:0.5rem;
      height:0.5rem;
      border-radius:999px;
      background:rgba(255,255,255,0.22);
    }
    .timer-dot.is-running {
      background:#00FF88;
      box-shadow:0 0 18px rgba(0,255,136,0.45);
      animation:timerPulse 1.7s ease-in-out infinite;
    }
    .timer-dot.is-paused {
      background:#96A0AA;
    }
    .timer-value {
      margin:0;
      font-size:clamp(2.5rem, 8vw, 4.25rem);
      line-height:0.95;
      letter-spacing:-0.06em;
      color:#F5F7FA;
      font-family:var(--font-display, inherit);
      font-weight:700;
      text-align:center;
      transition:color 180ms ease, text-shadow 180ms ease;
    }
    .timer-value.is-running {
      color:#00FF88;
      text-shadow:0 0 28px rgba(0,255,136,0.18);
    }
    .timer-value.is-paused {
      color:#96A0AA;
    }
    @keyframes timerPulse {
      0%, 100% { opacity:1; transform:scale(1); }
      50% { opacity:0.45; transform:scale(0.88); }
    }
  `],
})
export class TimerComponent {
  elapsedSec = input(0);
  phase = input<TimerPhase>('idle');
  label = input('Tempo de caminhada');

  readonly formattedTime = computed(() => {
    const totalSeconds = Math.max(this.elapsedSec(), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });
}
