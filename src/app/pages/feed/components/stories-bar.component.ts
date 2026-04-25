import { Component } from '@angular/core';

interface Story {
  name: string;
  initial: string;
  color: string;
  active: boolean;
}

@Component({
  selector: 'app-stories-bar',
  standalone: true,
  template: `
    <div class="mt-3 overflow-x-auto scrollbar-none">
      <div class="flex gap-3 px-4" style="width: max-content">

        <!-- Add story -->
        <div class="flex flex-col items-center gap-1.5">
          <div class="w-14 h-14 rounded-full bg-card-2 border-2 border-dashed border-border-2 flex items-center justify-center text-text-2 hover:border-primary hover:text-primary transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <span class="text-[10px] text-text-2 font-body">Seu treino</span>
        </div>

        @for (story of stories; track story.name) {
          <div class="flex flex-col items-center gap-1.5 cursor-pointer">
            <div class="p-[2px] rounded-full" [style]="story.active ? 'background: linear-gradient(135deg, #00FF88, #00C2FF)' : 'background: #1A2535'">
              <div class="w-13 h-13 rounded-full flex items-center justify-center text-sm font-display font-bold border-2 border-bg"
                   [style]="'background:' + story.color + '; width:52px; height:52px'">
                {{ story.initial }}
              </div>
            </div>
            <span class="text-[10px] font-body" [class]="story.active ? 'text-white' : 'text-text-2'">{{ story.name }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class StoriesBarComponent {
  stories: Story[] = [
    { name: 'André', initial: 'A', color: 'linear-gradient(135deg,#00FF8840,#00C2FF30)', active: true },
    { name: 'Mariana', initial: 'M', color: 'linear-gradient(135deg,#FF3D5A30,#FF6B4A30)', active: true },
    { name: 'Gabriel', initial: 'G', color: 'linear-gradient(135deg,#7C3AED30,#00C2FF30)', active: false },
    { name: 'Lucas', initial: 'L', color: 'linear-gradient(135deg,#F59E0B30,#EF444430)', active: true },
    { name: 'Julia', initial: 'J', color: 'linear-gradient(135deg,#10B98130,#00FF8830)', active: false },
    { name: 'Pedro', initial: 'P', color: 'linear-gradient(135deg,#3B82F630,#7C3AED30)', active: false },
  ];
}
