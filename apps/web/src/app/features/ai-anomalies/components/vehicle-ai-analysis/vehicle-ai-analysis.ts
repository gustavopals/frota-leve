import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  type OnInit,
  inject,
  input,
} from '@angular/core';
import { PoTagModule, type PoTagType, PoWidgetModule } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { AiAnomaliesService } from '../../ai-anomalies.service';
import type { AnomalyRecord } from '../../ai-anomalies.types';
import {
  formatAnomalyKind,
  formatAnomalySeverity,
  formatDetectedAt,
  getHealthScoreTagType,
  getSeverityTagType,
} from '../../ai-anomalies.utils';

interface AnalysisItem {
  id: string;
  kindLabel: string;
  severityLabel: string;
  severityTagType: PoTagType;
  message: string;
  detectedAtLabel: string;
}

/**
 * Seção "Análise IA" do detalhe do veículo: anomalias abertas + health score.
 *
 * Igual ao widget do dashboard, some sem alarde quando a API não responde —
 * a ficha do veículo continua utilizável sem o módulo de IA.
 */
@Component({
  selector: 'app-vehicle-ai-analysis',
  templateUrl: './vehicle-ai-analysis.html',
  styleUrl: './vehicle-ai-analysis.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PoTagModule, PoWidgetModule],
})
export class VehicleAiAnalysis implements OnInit {
  private readonly service = inject(AiAnomaliesService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly vehicleId = input.required<string>();

  items: AnalysisItem[] = [];
  healthScore = 100;
  healthScoreTagType: PoTagType = getHealthScoreTagType(100);
  loading = true;
  unavailable = false;

  ngOnInit(): void {
    this.service
      .getVehicleAnalysis(this.vehicleId())
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.healthScore = response.data.healthScore;
          this.healthScoreTagType = getHealthScoreTagType(response.data.healthScore);
          this.items = response.data.openAnomalies.map((record) => this.toItem(record));
        },
        error: () => {
          this.unavailable = true;
        },
      });
  }

  private toItem(record: AnomalyRecord): AnalysisItem {
    return {
      id: record.id,
      kindLabel: formatAnomalyKind(record.kind),
      severityLabel: formatAnomalySeverity(record.severity),
      severityTagType: getSeverityTagType(record.severity),
      message: record.message,
      detectedAtLabel: formatDetectedAt(record.detectedAt),
    };
  }
}
