import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  type OnInit,
  inject,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { PoTagModule, type PoTagType, PoWidgetModule } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { AiScoringService } from '../../ai-scoring.service';
import type {
  DriverRecommendation,
  DriverScoreBreakdown,
  DriverScoreRecord,
} from '../../ai-scoring.types';

interface PillarView {
  key: keyof DriverScoreBreakdown;
  label: string;
  weight: number;
  value: number;
}

const PILLARS: Array<{ key: keyof DriverScoreBreakdown; label: string; weight: number }> = [
  { key: 'fuel', label: 'Combustível', weight: 25 },
  { key: 'fines', label: 'Multas', weight: 25 },
  { key: 'incidents', label: 'Sinistros', weight: 20 },
  { key: 'checklist', label: 'Checklist', weight: 15 },
  { key: 'vehicleCare', label: 'Cuidado com o veículo', weight: 15 },
];

/**
 * Aba "Score IA" do detalhe do motorista (TASK 3.7.5).
 *
 * Some sem alarde quando a API responde erro — o cadastro do motorista continua
 * utilizável sem o módulo de IA.
 */
@Component({
  selector: 'app-driver-score-panel',
  templateUrl: './driver-score-panel.html',
  styleUrl: './driver-score-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PoTagModule, PoWidgetModule],
})
export class DriverScorePanel implements OnInit {
  private readonly service = inject(AiScoringService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly driverId = input.required<string>();

  history: DriverScoreRecord[] = [];
  current: DriverScoreRecord | null = null;
  pillars: PillarView[] = [];
  recommendation: DriverRecommendation | null = null;
  loading = true;
  unavailable = false;

  ngOnInit(): void {
    this.service
      .getDriverHistory(this.driverId())
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.history = response.data;
          this.current = response.data[0] ?? null;
          this.pillars = this.buildPillars(this.current?.breakdown);
          this.recommendation = this.parseRecommendation(this.current?.recommendations);
        },
        error: () => {
          this.unavailable = true;
        },
      });
  }

  get scoreTagType(): PoTagType {
    const score = this.current?.score ?? 0;

    if (score >= 80) {
      return 'success' as PoTagType;
    }

    return score >= 60 ? ('warning' as PoTagType) : ('danger' as PoTagType);
  }

  private buildPillars(breakdown: DriverScoreBreakdown | undefined): PillarView[] {
    if (!breakdown) {
      return [];
    }

    return PILLARS.map((pillar) => ({ ...pillar, value: breakdown[pillar.key] ?? 0 }));
  }

  /** As recomendações vêm como JSON serializado; string vazia = IA não rodou. */
  private parseRecommendation(raw: string | undefined): DriverRecommendation | null {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as DriverRecommendation;
    } catch {
      return null;
    }
  }
}
