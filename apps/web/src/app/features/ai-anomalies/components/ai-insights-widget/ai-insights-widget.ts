import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PoTagModule, type PoTagType, PoWidgetModule } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import { AiAnomaliesService } from '../../ai-anomalies.service';
import type { AnomalyRecord } from '../../ai-anomalies.types';
import {
  formatAnomalyKind,
  formatDetectedAt,
  getSeverityTagType,
  formatAnomalySeverity,
} from '../../ai-anomalies.utils';

interface InsightItem {
  id: string;
  kindLabel: string;
  severityLabel: string;
  severityTagType: PoTagType;
  message: string;
  detectedAtLabel: string;
}

/**
 * Widget "Insights IA" do dashboard: as 5 anomalias abertas mais graves.
 *
 * Falha em silêncio — o dashboard não pode quebrar porque a IA está desligada
 * ou o plano do tenant não inclui o módulo.
 */
@Component({
  selector: 'app-ai-insights-widget',
  templateUrl: './ai-insights-widget.html',
  styleUrl: './ai-insights-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PoTagModule, PoWidgetModule],
})
export class AiInsightsWidget {
  private readonly service = inject(AiAnomaliesService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  items: InsightItem[] = [];
  loading = true;
  unavailable = false;

  constructor() {
    this.service
      .listInsights()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.items = response.data.map((record) => this.toInsight(record));
        },
        error: () => {
          this.unavailable = true;
        },
      });
  }

  private toInsight(record: AnomalyRecord): InsightItem {
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
