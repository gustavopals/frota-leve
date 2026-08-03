# Runbook — incidentes de IA

Procedimentos operacionais para o módulo de IA. Atende à TASK 3.9.5.

## Sintomas rápidos

| Sintoma                                          | Vá para                                                   |
| ------------------------------------------------ | --------------------------------------------------------- |
| Custo disparou / conta da Anthropic assustou     | [Desabilitar IA](#1-desabilitar-a-ia-em-produção)         |
| Tenant não consegue usar IA e o plano está certo | [Quota travada](#3-quota-travada)                         |
| Relatório mensal não chegou                      | [Reprocessar relatório](#4-reprocessar-relatório-falho)   |
| Respostas ficaram piores de repente              | [Modo degradado](#2-modo-degradado)                       |
| `/metrics` não responde                          | A API está fora — trate como incidente de disponibilidade |

---

## 1. Desabilitar a IA em produção

Três níveis, do mais amplo para o mais cirúrgico. Escolha o menor que resolve.

### 1.1 Desligar tudo (kill switch global)

```bash
# Coolify / ambiente de produção
AI_ENABLED=false
```

Reinicie a API. Todas as rotas `/api/v1/ai/*` passam a responder como
indisponíveis, e os jobs de anomalia, relatório e scoring param de chamar a
Anthropic. **A detecção de anomalias continua rodando** — ela é determinística;
só o texto explicativo deixa de ser gerado.

### 1.2 Desligar uma feature para todos

Não há flag global por feature. Para cortar só uma, remova temporariamente o
`aiRouter.use(...)` correspondente em `apps/api/src/modules/ai/ai.routes.ts` e
faça o deploy. Prefira 1.1 ou 1.3 — este caminho exige release.

### 1.3 Desligar uma feature para um tenant

Pelo painel: `/settings/ai` como OWNER do tenant, botão "Desativar".

Direto no banco, se o painel não estiver acessível:

```sql
UPDATE tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{ai,features,chat}',
  'false'::jsonb,
  true
)
WHERE id = '<tenant_id>';
```

Troque `chat` por `anomalies`, `reports`, `ocr` ou `scoring`.

---

## 2. Modo degradado

Quando o custo global do dia passa de `AI_DAILY_COST_USD_LIMIT`, o
`AiCostGuardScheduler` liga `AI_DEGRADED=true` e **tudo passa a rodar no Haiku**
até o gasto voltar abaixo do limite. É esperado que as respostas fiquem mais
curtas e menos detalhadas nesse estado.

Verificar:

```bash
curl -s https://<api>/metrics | grep ai_cost_usd_micros_total
```

Ou pelo painel `/settings/ai`, cartão "Custo do mês" → tag do circuit breaker.

O guarda reavalia a cada 15 minutos e **desliga sozinho** quando o dia vira. Para
forçar a saída antes disso, suba o limite e reinicie:

```bash
AI_DAILY_COST_USD_LIMIT=200
```

> Não edite `AI_DEGRADED` na mão como solução permanente: o scheduler sobrescreve
> o valor na próxima avaliação.

---

## 3. Quota travada

Sintoma: tenant recebe `AI_QUOTA_EXCEEDED` mesmo com orçamento aparentemente
disponível. Costuma ser reserva de quota que não foi devolvida após uma queda do
processo no meio de uma chamada.

Diagnóstico:

```sql
SELECT tenant_id, period, tokens_used, tokens_reserved
FROM ai_tenant_quotas
WHERE tenant_id = '<tenant_id>'
ORDER BY period DESC
LIMIT 3;
```

Se `tokens_reserved` está alto e não há chamada em andamento, libere:

```sql
UPDATE ai_tenant_quotas
SET tokens_reserved = 0
WHERE tenant_id = '<tenant_id>' AND period = '<YYYY-MM>';
```

Confirme depois pelo painel `/settings/ai` ou por `GET /api/v1/ai/quota`.

---

## 4. Reprocessar relatório falho

O relatório é idempotente por `tenantId + period + kind`: um registro já
`GENERATED` **não** é reprocessado. Para forçar, remova o registro e dispare de novo.

```sql
-- 1. Confirme o estado
SELECT id, period, status, generated_at
FROM ai_reports
WHERE tenant_id = '<tenant_id>' AND period = '<YYYY-MM>';

-- 2. Apague o registro travado
DELETE FROM ai_reports
WHERE tenant_id = '<tenant_id>' AND period = '<YYYY-MM>' AND kind = 'MONTHLY';
```

Depois, gere sob demanda como OWNER:

```bash
curl -X POST https://<api>/api/v1/ai/reports/on-demand \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"period":"<YYYY-MM>"}'
```

Se o relatório sair sem narrativa (`dataSnapshot.degraded = true`), a Anthropic
falhou nas 3 tentativas ou a IA está desligada. O conteúdo tabular é válido e
tem as mesmas seções — reprocesse depois de resolver a causa.

### Relatório preso em PENDING

Significa que o processo morreu entre o `upsert` e a atualização final. Apague o
registro e gere de novo, como acima.

---

## 5. Contatos e limites

- Limite diário de custo: variável `AI_DAILY_COST_USD_LIMIT` (default US$ 50).
- Orçamento mensal por tenant: `AI_TENANT_MONTHLY_TOKEN_BUDGET_PRO` / `_ENT`.
- Rate limit por feature: `apps/api/src/middlewares/ai-rate-limiter.ts`.
- Métricas: `GET /metrics` (Prometheus).
