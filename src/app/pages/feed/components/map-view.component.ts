import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, computed, effect, input } from '@angular/core';
import * as L from 'leaflet';
import { GeoPoint } from '../../../core/services/walk.service';

type MapPhase = 'preview' | 'active' | 'result';

@Component({
  selector: 'app-map-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map-frame" [style.height]="height()">
      <div #mapHost class="map-host"></div>

      @if (!hasData()) {
        <div class="map-overlay">
          <span class="map-overlay-icon">📍</span>
          <p class="map-overlay-title">{{ emptyTitle() }}</p>
          <p class="map-overlay-copy">{{ emptyCopy() }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display:block; min-height:0; }
    .map-frame {
      position:relative;
      overflow:hidden;
      border-radius:1.4rem;
      border:1px solid rgba(255,255,255,0.08);
      background:linear-gradient(180deg, rgba(7,11,15,0.94), rgba(10,17,23,1));
      min-height:15rem;
    }
    .map-host {
      width:100%;
      height:100%;
    }
    .map-overlay {
      position:absolute;
      left:0.85rem;
      right:0.85rem;
      bottom:0.85rem;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:0.4rem;
      border:1px solid rgba(255,255,255,0.08);
      border-radius:1rem;
      background:radial-gradient(circle at top, rgba(0,255,136,0.08), transparent 42%), rgba(7,11,15,0.82);
      backdrop-filter:blur(16px);
      -webkit-backdrop-filter:blur(16px);
      text-align:center;
      padding:0.95rem 1rem;
      pointer-events:none;
    }
    .map-overlay-icon { font-size:1.8rem; }
    .map-overlay-title {
      margin:0;
      font-size:0.95rem;
      font-family:var(--font-display, inherit);
      font-weight:700;
      color:#F5F7FA;
    }
    .map-overlay-copy {
      margin:0;
      max-width:18rem;
      font-size:0.78rem;
      line-height:1.45;
      color:#96A0AA;
      font-family:var(--font-body, inherit);
    }
  `],
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapHost') private mapHostRef?: ElementRef<HTMLDivElement>;

  phase = input<MapPhase>('preview');
  center = input<GeoPoint | null>(null);
  currentPosition = input<GeoPoint | null>(null);
  path = input<GeoPoint[]>([]);
  height = input('320px');
  emptyTitle = input('Localizando você');
  emptyCopy = input('Permita o GPS para ver o mapa e desenhar o trajeto em tempo real.');

  readonly hasData = computed(() => this.path().length > 0 || !!this.currentPosition() || !!this.center());

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private currentMarker: L.CircleMarker | null = null;
  private pathLine: L.Polyline | null = null;
  private startMarker: L.CircleMarker | null = null;
  private endMarker: L.CircleMarker | null = null;
  private ready = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      this.phase();
      this.center();
      this.currentPosition();
      this.path();
      queueMicrotask(() => this.syncMap());
    });
  }

  ngAfterViewInit(): void {
    const host = this.mapHostRef?.nativeElement;
    if (!host || this.map) return;

    this.map = L.map(host, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    }).setView([-23.5505, -46.6333], 13);

    this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });
    this.tileLayer.addTo(this.map);
    this.ready = true;
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize();
      this.syncMap();
    });
    this.resizeObserver.observe(host);
    this.syncMap();
    setTimeout(() => {
      this.map?.invalidateSize();
      this.syncMap();
    }, 0);
    setTimeout(() => {
      this.map?.invalidateSize();
      this.syncMap();
    }, 280);
  }


  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
  }

  private syncMap(): void {
    if (!this.ready || !this.map) return;

    const phase = this.phase();
    const path = this.path();
    const focus = this.currentPosition() ?? this.center() ?? path[path.length - 1] ?? null;

    this.syncPolyline(path);
    this.syncCurrentMarker(phase, focus);
    this.syncResultMarkers(phase, path);

    if (path.length >= 2 && phase === 'result') {
      this.map.fitBounds(L.latLngBounds(path.map(point => [point.lat, point.lng] as L.LatLngTuple)), {
        padding: [28, 28],
        animate: true,
      });
      return;
    }

    if (path.length >= 2 && phase === 'active') {
      const lastPoint = path[path.length - 1];
      this.map.panTo([lastPoint.lat, lastPoint.lng], { animate: true, duration: 0.6 });
      return;
    }

    if (focus) {
      this.map.setView([focus.lat, focus.lng], Math.max(this.map.getZoom(), 15), { animate: phase !== 'preview' });
    }
  }

  private syncPolyline(path: GeoPoint[]): void {
    if (!this.map) return;

    if (path.length >= 2) {
      const latLngs = path.map(point => [point.lat, point.lng] as L.LatLngTuple);
      if (!this.pathLine) {
        this.pathLine = L.polyline(latLngs, {
          color: '#00FF88',
          weight: 5,
          opacity: 0.88,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(this.map);
      } else {
        this.pathLine.setLatLngs(latLngs);
      }
      return;
    }

    this.pathLine?.remove();
    this.pathLine = null;
  }

  private syncCurrentMarker(phase: MapPhase, focus: GeoPoint | null): void {
    if (!this.map) return;

    if (!focus) {
      this.currentMarker?.remove();
      this.currentMarker = null;
      return;
    }

    if (!this.currentMarker) {
      this.currentMarker = L.circleMarker([focus.lat, focus.lng], {
        radius: 8,
        color: '#081017',
        weight: 3,
        fillColor: phase === 'result' ? '#F5F7FA' : '#00FF88',
        fillOpacity: 1,
      }).addTo(this.map);
    }

    this.currentMarker.setLatLng([focus.lat, focus.lng]);
    this.currentMarker.setStyle({ fillColor: phase === 'result' ? '#F5F7FA' : '#00FF88' });
  }

  private syncResultMarkers(phase: MapPhase, path: GeoPoint[]): void {
    if (!this.map) return;

    if (phase !== 'result' || path.length === 0) {
      this.startMarker?.remove();
      this.endMarker?.remove();
      this.startMarker = null;
      this.endMarker = null;
      return;
    }

    const start = path[0];
    const end = path[path.length - 1];

    if (!this.startMarker) {
      this.startMarker = L.circleMarker([start.lat, start.lng], {
        radius: 7,
        color: '#081017',
        weight: 2,
        fillColor: '#00FF88',
        fillOpacity: 1,
      }).addTo(this.map);
    }
    this.startMarker.setLatLng([start.lat, start.lng]);

    if (!this.endMarker) {
      this.endMarker = L.circleMarker([end.lat, end.lng], {
        radius: 7,
        color: '#081017',
        weight: 2,
        fillColor: '#FF667A',
        fillOpacity: 1,
      }).addTo(this.map);
    }
    this.endMarker.setLatLng([end.lat, end.lng]);
  }
}
