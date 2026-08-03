import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import {
  PoButtonModule,
  PoChartModule,
  PoChartType,
  PoTagModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import type { PoChartSerie, PoTagType } from '@po-ui/ng-components';
import { forkJoin, finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { AiSettingsService } from '../../ai-settings.service';
import type {
  AiFeatureKey,
  AiSettings,
  AiUsageLog,
  AiUsageOverview,
} from '../../ai-settings.types';

interface FeatureToggleView {
  key: AiFeatureKey;
  label: string;
  enabled: boolean;
}

const FEATURE_LABELS: Record<AiFeatureKey, string> = {
  chat: 'Assistente conversacional',
  anomalies: 'Detecção de anomalias',
  reports: 'Relatórios mensais',
  ocr: 'OCR de cupons e notas',
  scoring: 'Scoring de motoristas',
};

const MICROS_PER_USD = 1_000_000;

@Component({
  selector: 'app-ai-settings-page',
  templateUrl: './ai-settings-page.html',
  styleUrl: './ai-settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PoButtonModule, PoChartModule, PoTagModule, PoWidgetModule],
})
export class AiSettingsPage {
  private readonly service = inject(AiSettingsService);
  private readonly notification = inject(NotificationService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly chartType = PoChartType.Column;

  settings: AiSettings | null = null;
  overview: AiUsageOverview | null = null;
  logs: AiUsageLog[] = [];
  toggles: FeatureToggleView[] = [];
  costSeries: PoChartSerie[] = [];
  loading = true;

  constructor() {
    forkJoin({
      settings: this.service.get(),
      overview: this.service.getUsageOverview(),
      logs: this.service.getLogs(),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: ({ settings, overview, logs }) => {
          this.settings = settings.data;
          this.overview = overview.data;
          this.logs = logs.data;
          this.toggles = (Object.keys(FEATURE_LABELS) as AiFeatureKey[]).map((key) => ({
            key,
            label: FEATURE_LABELS[key],
            enabled: settings.data.features[key],
          }));
          this.costSeries = [
            {
              label: 'Custo (US$)',
              data: overview.data.history.map((item) =>
                Number((item.costUsdMicros / MICROS_PER_USD).toFixed(2)),
              ),
            },
          ];
        },
        error: () => this.notification.error('Não foi possível carregar o painel de IA.'),
      });
  }

  get historyLabels(): string[] {
    return this.overview?.history.map((item) => item.period) ?? [];
  }

  get monthCostUsd(): string {
    const total =
      this.overview?.currentMonth.reduce((sum, item) => sum + item.costUsdMicros, 0) ?? 0;

    return (total / MICROS_PER_USD).toFixed(2);
  }

  get circuitBreakerTagType(): PoTagType {
    return (this.overview?.circuitBreaker.degraded ? 'danger' : 'success') as PoTagType;
  }

  get circuitBreakerLabel(): string {
    return this.overview?.circuitBreaker.degraded ? 'Degradado' : 'Normal';
  }

  toggleTagType(enabled: boolean): PoTagType {
    return (enabled ? 'success' : 'danger') as PoTagType;
  }

  costOf(item: { costUsdMicros: number }): string {
    return (item.costUsdMicros / MICROS_PER_USD).toFixed(2);
  }

  toggleFeature(toggle: FeatureToggleView): void {
    const next = !toggle.enabled;

    this.service.update({ features: { [toggle.key]: next } as AiSettings['features'] }).subscribe({
      next: (response) => {
        this.settings = response.data;
        toggle.enabled = response.data.features[toggle.key];
        this.notification.success(`${toggle.label} ${toggle.enabled ? 'ativada' : 'desativada'}.`);
        this.changeDetector.markForCheck();
      },
      error: () => this.notification.error('Não foi possível alterar a configuração.'),
    });
  }
}
