import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { formatCurrency } from '@frota-leve/shared/src/utils/format.utils';
import type { PoPageAction } from '@po-ui/ng-components';
import {
  PoButtonModule,
  PoPageModule,
  PoTagModule,
  PoWidgetModule,
  PoTagType,
} from '@po-ui/ng-components';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification';
import { DocumentsService } from '../../documents.service';
import type {
  DocumentPriorityItem,
  DocumentRecord,
  DocumentTone,
  DocumentTypeCardSummary,
  PendingDocumentsResponse,
} from '../../documents.types';
import {
  buildDocumentTypeCards,
  buildPriorityItems,
  createEmptyPendingDocumentsResponse,
  formatDocumentDate,
  formatDocumentDateTime,
} from '../../documents.utils';

type DocumentsHeroMetric = {
  label: string;
  value: string;
  tone: DocumentTone;
};

type DocumentsMetricCard = {
  title: string;
  value: number;
  helper: string;
  tone: DocumentTone;
};

@Component({
  selector: 'app-documents-page',
  imports: [PoPageModule, PoWidgetModule, PoTagModule, PoButtonModule],
  templateUrl: './documents-page.html',
  styleUrl: './documents-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly documentsService = inject(DocumentsService);
  private readonly notificationService = inject(NotificationService);

  documents: DocumentRecord[] = [];
  pending: PendingDocumentsResponse = createEmptyPendingDocumentsResponse();
  heroMetrics: DocumentsHeroMetric[] = [];
  metricCards: DocumentsMetricCard[] = [];
  typeCards: DocumentTypeCardSummary[] = [];
  priorityItems: DocumentPriorityItem[] = [];
  isLoading = false;
  hasLoadError = false;
  hasLoadedOnce = false;

  constructor() {
    this.rebuildViewModel();
    this.loadPanel();
  }

  protected get pageSubtitle(): string {
    return 'Cards por tipo com semaforo de risco e leitura rapida da fila de renovacoes.';
  }

  protected get pageActions(): PoPageAction[] {
    return [
      {
        label: this.isLoading ? 'Atualizando...' : 'Atualizar painel',
        disabled: this.isLoading,
        action: () => {
          this.reload();
        },
      },
    ];
  }

  protected get heroTitle(): string {
    if (!this.hasLoadedOnce) {
      return 'Radar de documentos da operacao';
    }

    if (this.documents.length === 0) {
      return 'Nenhum documento foi monitorado ainda';
    }

    if (this.expiredDocumentsCount > 0) {
      return `${this.expiredDocumentsCount} documentos ja estao vencidos`;
    }

    if (this.pending.summary.upTo30Days > 0) {
      return `${this.pending.summary.upTo30Days} documentos vencem em ate 30 dias`;
    }

    return 'Semaforo verde para os tipos cadastrados';
  }

  protected get heroDescription(): string {
    if (!this.hasLoadedOnce) {
      return 'O painel consolida vencimentos, tipos documentais e itens prioritarios assim que a primeira leitura termina.';
    }

    if (this.documents.length === 0) {
      return 'Cadastre IPVA, licenciamento, seguro, CNH e outros documentos para destravar o radar de vencimentos.';
    }

    if (this.expiredDocumentsCount > 0) {
      return 'Os cards vermelhos assumem o pior status do tipo e ajudam a priorizar renovacao por impacto imediato.';
    }

    if (this.pending.summary.upTo30Days > 0) {
      return 'Os cards amarelos concentram os tipos com renovacoes dentro da janela mais curta de atencao.';
    }

    return 'Todos os tipos monitorados estao em dia neste momento, com a proxima janela ja organizada no painel.';
  }

  protected get lastSyncLabel(): string {
    if (this.isLoading && this.hasLoadedOnce) {
      return 'Atualizando painel';
    }

    return formatDocumentDateTime(this.pending.generatedAt);
  }

  protected get expiredDocumentsCount(): number {
    return this.documents.filter((document) => document.status === 'EXPIRED').length;
  }

  protected get totalTrackedCost(): number {
    return this.documents.reduce((total, document) => total + (document.cost ?? 0), 0);
  }

  protected reload(): void {
    this.loadPanel();
  }

  protected formatCurrency(value: number): string {
    return formatCurrency(value);
  }

  protected formatDate(value: string): string {
    return formatDocumentDate(value);
  }

  protected getTagType(tone: DocumentTone): PoTagType {
    switch (tone) {
      case 'danger':
        return PoTagType.Danger;
      case 'warning':
        return PoTagType.Warning;
      case 'success':
        return PoTagType.Success;
      default:
        return PoTagType.Neutral;
    }
  }

  private loadPanel(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.hasLoadError = false;

    forkJoin({
      documents: this.documentsService.listAll(),
      pending: this.documentsService.getPending(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: ({ documents, pending }) => {
          this.documents = documents;
          this.pending = pending;
          this.hasLoadedOnce = true;
          this.hasLoadError = false;
          this.rebuildViewModel();
        },
        error: () => {
          this.hasLoadError = true;
          this.notificationService.error('Nao foi possivel carregar o painel de documentos.');
        },
      });
  }

  private rebuildViewModel(): void {
    this.typeCards = buildDocumentTypeCards(this.documents);
    this.priorityItems = buildPriorityItems(this.documents, this.pending).slice(0, 8);
    this.heroMetrics = this.buildHeroMetrics();
    this.metricCards = this.buildMetricCards();
  }

  private buildHeroMetrics(): DocumentsHeroMetric[] {
    return [
      {
        label: 'documentos',
        value: String(this.documents.length),
        tone: 'neutral',
      },
      {
        label: 'tipos monitorados',
        value: String(this.typeCards.length),
        tone: this.typeCards.length > 0 ? 'success' : 'neutral',
      },
      {
        label: 'ate 30 dias',
        value: String(this.pending.summary.upTo30Days),
        tone: this.pending.summary.upTo30Days > 0 ? 'warning' : 'success',
      },
      {
        label: 'vencidos',
        value: String(this.expiredDocumentsCount),
        tone: this.expiredDocumentsCount > 0 ? 'danger' : 'success',
      },
    ];
  }

  private buildMetricCards(): DocumentsMetricCard[] {
    return [
      {
        title: 'Ate 30 dias',
        value: this.pending.summary.upTo30Days,
        helper: 'renovacoes no horizonte imediato',
        tone: this.pending.summary.upTo30Days > 0 ? 'danger' : 'success',
      },
      {
        title: 'Ate 60 dias',
        value: this.pending.summary.upTo60Days,
        helper: 'acumulado do proximo ciclo',
        tone:
          this.pending.summary.upTo60Days > this.pending.summary.upTo30Days ? 'warning' : 'success',
      },
      {
        title: 'Ate 90 dias',
        value: this.pending.summary.upTo90Days,
        helper: 'base total da janela prevista',
        tone:
          this.pending.summary.upTo90Days > this.pending.summary.upTo60Days ? 'neutral' : 'success',
      },
      {
        title: 'Vencidos',
        value: this.expiredDocumentsCount,
        helper: 'itens ja fora de prazo',
        tone: this.expiredDocumentsCount > 0 ? 'danger' : 'success',
      },
    ];
  }
}
