# Fluxo de dados de IA — LGPD

Documento de referência sobre **quais dados saem do Frota Leve para a Anthropic**,
com que finalidade e por quanto tempo. Atende à TASK 3.9.4 do ROADMAP.

Última revisão: 2026-08-03.

## 1. Quando há tráfego para a Anthropic

Nenhuma chamada acontece com `AI_ENABLED=false`. Com a flag ligada, apenas as
features abaixo enviam dados, e apenas para tenants cujo plano inclui IA
(`PLAN_LIMITS[plano].hasAI`) e que não desligaram a feature em `/settings/ai`.

| Feature                | Gatilho                                     | Modelo                                 |
| ---------------------- | ------------------------------------------- | -------------------------------------- |
| Assistente (chat)      | Ação do usuário                             | Haiku (roteamento) + Sonnet (resposta) |
| Explicação de anomalia | Job diário, só na criação da anomalia       | Haiku                                  |
| Relatório mensal       | Job dia 2, 06h UTC, e geração sob demanda   | Sonnet + Haiku (resumo)                |
| OCR de cupom/nota      | Ação do usuário                             | Haiku                                  |
| Recomendação de score  | Job semanal, só se o score mudou ≥ 5 pontos | Haiku                                  |

## 2. Dados enviados por feature

### Assistente conversacional

- Mensagem do usuário e histórico da sessão.
- Catálogo da frota do tenant: placas, marca, modelo, categoria, quilometragem.
- Resultados das tools acionadas (custos, abastecimentos, manutenções, multas).

### Explicação de anomalia

- Tipo, severidade e o objeto `evidence` do achado (números agregados).
- **Não** envia nome de motorista nem placa: a evidência carrega apenas IDs e métricas.

### Relatório mensal

- Agregados do período: custos por categoria, top 5 veículos por custo/km
  (**inclui placa**), consumo médio, contagem de manutenções e multas,
  mensagens das anomalias de severidade alta e comparativo com o mês anterior.

### OCR

- A **imagem** do cupom ou da nota fiscal, reduzida a no máximo 1568px.
- A imagem pode conter CNPJ do estabelecimento e, em nota fiscal, razão social.

### Scoring de motoristas

- **Nome do motorista**, score calculado, score anterior e as notas por pilar.

## 3. Dados que nunca são enviados

Removidos pelo `pii-redactor` antes do envio no fluxo de chat: CPF, CNH, e-mail,
telefone e CEP. Além disso, por construção:

- Senhas e hashes nunca entram em prompt.
- Chaves de API e segredos não trafegam em conteúdo de mensagem.
- Dados de outro tenant são impossíveis por construção: toda tool filtra por
  `tenantId` vindo do contexto do servidor, nunca do input do modelo
  (ver `apps/api/src/modules/ai/tools/prompt-injection.spec.ts`).

## 4. Retenção

**No Frota Leve:**

| Dado              | Onde            | Retenção                                                               |
| ----------------- | --------------- | ---------------------------------------------------------------------- |
| Mensagens do chat | `AIChatMessage` | Enquanto a sessão existir                                              |
| Log de chamadas   | `AIUsageLog`    | Indefinido — base de auditoria e billing                               |
| Relatórios        | `AIReport`      | Indefinido                                                             |
| Anomalias         | `AIAnomaly`     | Indefinido                                                             |
| Imagens de OCR    | —               | **Não persistidas.** Vivem em memória e são descartadas com a resposta |

**Na Anthropic:** o tráfego segue a política de retenção da conta corporativa
contratada. Quando a organização tiver retenção zero habilitada, nenhuma cópia
do prompt é mantida após o processamento.

> ⚠️ Ponto em aberto: o header `anthropic-disable-retention` citado no ROADMAP
> não é enviado hoje pelo `AiClient`. Antes de afirmar retenção zero em contrato
> ou em política de privacidade, confirmar a configuração de retenção da
> organização no console da Anthropic — é lá que ela é definida, não por
> requisição.

## 5. Direitos do titular

- **Acesso:** o log completo de chamadas do tenant está em `/settings/ai`.
- **Exclusão:** apagar o tenant remove em cascata `AIChatMessage`, `AIUsageLog`,
  `AIReport`, `AIAnomaly` e `DriverScore` (todos com `onDelete: Cascade`).
- **Oposição:** o OWNER pode desligar qualquer feature de IA em `/settings/ai`,
  e a plataforma inteira funciona com `AI_ENABLED=false`.

## 6. Pendências antes do go-live

- [ ] Confirmar a configuração de retenção da organização na Anthropic.
- [ ] Atualizar os termos de uso mencionando o processamento por IA e o
      subprocessador Anthropic.
- [ ] Incluir a Anthropic na lista de subprocessadores da política de privacidade.
