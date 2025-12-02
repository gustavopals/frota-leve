# 🎯 Próximos Passos - Frota Leve

## ✅ Já Implementado

### Backend (NestJS + Prisma)
- ✅ Estrutura de monorepo
- ✅ Docker Compose (PostgreSQL + pgAdmin)
- ✅ Schema Prisma completo com todas as tabelas
- ✅ Multi-tenancy (row-level)
- ✅ Autenticação JWT
- ✅ Módulos: Auth, Tenants, Users
- ✅ Guards e Decorators (Roles, TenantId, CurrentUser)
- ✅ Swagger documentation
- ✅ Seed com dados de exemplo

## 🚧 Próximos Módulos Backend

### 1. Vehicles (Gestão de Veículos)
**Prioridade: ALTA**

Endpoints:
- `GET /vehicles` - Listar veículos
- `POST /vehicles` - Cadastrar veículo
- `GET /vehicles/:id` - Obter veículo
- `PATCH /vehicles/:id` - Atualizar veículo
- `DELETE /vehicles/:id` - Remover veículo
- `PATCH /vehicles/:id/odometer` - Atualizar hodômetro

DTOs necessários:
- `CreateVehicleDto`
- `UpdateVehicleDto`
- `UpdateOdometerDto`

### 2. Maintenance (Manutenções)
**Prioridade: ALTA**

Endpoints:
- `GET /maintenance/plans` - Listar planos de manutenção
- `POST /maintenance/plans` - Criar plano
- `GET /maintenance` - Listar manutenções executadas
- `POST /maintenance` - Registrar manutenção
- `GET /maintenance/upcoming` - Próximas manutenções previstas

Features:
- Cálculo automático de próximas manutenções (km ou data)
- Notificações quando se aproxima do vencimento

### 3. Fuel (Abastecimentos)
**Prioridade: ALTA**

Endpoints:
- `GET /fuel` - Listar abastecimentos
- `POST /fuel` - Registrar abastecimento
- `GET /fuel/analytics` - Análise de consumo
- `GET /fuel/vehicle/:id` - Histórico por veículo

Features:
- Cálculo automático de km/l
- Gráficos de consumo
- Detecção de anomalias

### 4. Checklist (Checklists Diários)
**Prioridade: MÉDIA**

Endpoints:
- `GET /checklist/templates` - Listar templates
- `POST /checklist/templates` - Criar template
- `GET /checklist/submissions` - Listar checklists preenchidos
- `POST /checklist/submissions` - Submeter checklist
- `GET /checklist/vehicle/:id/latest` - Último checklist de um veículo

Features:
- Templates configuráveis por tipo de veículo
- Mobile-friendly para motoristas
- Upload de fotos (futuro)

### 5. Reminders (Lembretes e Notificações)
**Prioridade: MÉDIA**

Endpoints:
- `GET /reminders` - Listar lembretes
- `POST /reminders` - Criar lembrete
- `PATCH /reminders/:id/status` - Atualizar status
- `GET /reminders/pending` - Lembretes pendentes

Features:
- CRON para verificar vencimentos
- Email notifications
- WhatsApp (futuro)
- Push notifications (app mobile)

### 6. Reports (Relatórios)
**Prioridade: BAIXA**

Endpoints:
- `GET /reports/fleet-overview` - Visão geral da frota
- `GET /reports/maintenance-costs` - Custos de manutenção
- `GET /reports/fuel-consumption` - Consumo de combustível
- `GET /reports/vehicle/:id` - Relatório completo de um veículo

### 7. Billing (Assinaturas)
**Prioridade: MÉDIA (para lançamento SaaS)**

Endpoints:
- `GET /billing/subscription` - Assinatura atual
- `POST /billing/subscription/upgrade` - Upgrade de plano
- `GET /billing/invoices` - Faturas
- `POST /billing/webhook` - Webhook payment gateway

Integrações:
- Mercado Pago
- Stripe (internacional)

## 📱 Frontend Angular

### Páginas Principais

1. **Dashboard**
   - Cards: Total de veículos, manutenções pendentes, alertas
   - Gráfico de consumo de combustível
   - Lista de próximas manutenções

2. **Frota**
   - Lista de veículos com status
   - Filtros: tipo, status, placa
   - Ações: adicionar, editar, visualizar

3. **Manutenções**
   - Calendário de manutenções
   - Lista de planos preventivos
   - Histórico de serviços

4. **Abastecimentos**
   - Lista de abastecimentos
   - Gráficos de consumo
   - Comparativo entre veículos

5. **Checklist**
   - Templates de checklist
   - Submissões recentes
   - Alertas críticos

6. **Configurações**
   - Dados da empresa
   - Usuários
   - Preferências
   - Notificações

### Componentes Reutilizáveis

- `VehicleCard`
- `MaintenanceCalendar`
- `FuelChart`
- `ChecklistForm`
- `AlertBadge`
- `StatusPill`

## 📱 App Mobile (Capacitor)

### Funcionalidades Específicas Mobile

1. **Checklist Diário**
   - Interface simplificada
   - Fotos dos veículos
   - Geolocalização
   - Funciona offline

2. **Abastecimento Rápido**
   - Formulário otimizado
   - Foto do cupom fiscal
   - Scanner de QR Code (futuro)

3. **Notificações Push**
   - Alertas de manutenção
   - Lembretes de checklist
   - Comunicados da empresa

## 🗺️ Roadmap de Desenvolvimento

### Fase 1 - MVP (2-3 semanas)
- ✅ Setup inicial e autenticação
- ⬜ Módulo de Veículos
- ⬜ Módulo de Manutenções
- ⬜ Módulo de Abastecimentos
- ⬜ Dashboard básico (Angular)

### Fase 2 - Features Essenciais (2 semanas)
- ⬜ Módulo de Checklists
- ⬜ Módulo de Lembretes
- ⬜ Sistema de notificações por email
- ⬜ Relatórios básicos

### Fase 3 - Polimento (1-2 semanas)
- ⬜ Melhorias de UX/UI
- ⬜ Testes automatizados
- ⬜ Documentação completa
- ⬜ Performance optimization

### Fase 4 - Mobile App (1-2 semanas)
- ⬜ Setup Capacitor
- ⬜ Build Android
- ⬜ Build iOS
- ⬜ Offline support
- ⬜ Push notifications

### Fase 5 - SaaS (2 semanas)
- ⬜ Sistema de billing
- ⬜ Múltiplos planos
- ⬜ Integração com gateway de pagamento
- ⬜ Landing page

### Fase 6 - Deploy (1 semana)
- ⬜ Setup VPS
- ⬜ CI/CD (GitHub Actions)
- ⬜ Monitoramento
- ⬜ Backups automáticos

## 📚 Recursos Adicionais Futuros

- [ ] Integração com API de rastreamento veicular
- [ ] OCR para cupons de abastecimento
- [ ] Integração com WhatsApp Business
- [ ] Multi-idioma (i18n)
- [ ] Modo dark
- [ ] Exportação de relatórios (PDF, Excel)
- [ ] API pública para integrações
- [ ] Webhooks para eventos importantes

## 🎯 Começar Agora

**Para implementar o próximo módulo (Vehicles):**

```bash
cd backend/src
nest g module vehicles
nest g controller vehicles
nest g service vehicles
```

Criar DTOs:
- `src/vehicles/dto/create-vehicle.dto.ts`
- `src/vehicles/dto/update-vehicle.dto.ts`
- `src/vehicles/dto/update-odometer.dto.ts`

O schema Prisma já está pronto! 🎉
