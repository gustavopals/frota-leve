✅ 6. Sistema de Gestão de Equipamentos / Frota Leve

Para donos de:

Caminhonetes de empresa

Vans

Pickup para entrega

Maquinário pequeno

Funcionalidades:

Manutenção preventiva

Controle de abastecimento

Checklist diário (motorista)

Notificações de vencimentos (IPVA, seguro, revisão)

No Paraná:

Tem MUITAS empresas familiares com frota pequena.

Perfeito, bora transformar essa ideia num SaaS de verdade 😎

Vou assumir:

* **Backend:** Node.js + **NestJS** + **TypeORM** + PostgreSQL
* **Frontend:** Angular (com módulos bem separados)
* **Modelo:** SaaS multi-tenant, com planos mensais e configurações por empresa/usuário.

---

## 0. Nome, conceito e personas

**Nome de trabalho:** *FrotaLeve* (depois você troca se quiser)

**Personas:**

* Dono de empresa pequena com 3–20 veículos.
* Gestor de frota (às vezes o próprio dono, às vezes alguém do administrativo).
* Motorista que só acessa via celular para checklist/abastecimento.

---

## 1. Módulos do sistema (MVP)

### 1.1. Administração / Conta

* Cadastro da empresa (tenant)
* Configurações gerais (moeda, fuso horário, fuso, formato de data, idioma)
* Plano de assinatura e billing (manual primeiro, depois gateway)

### 1.2. Usuários e Perfis

* Usuários com perfis:

  * **ADMIN_EMPRESA**
  * **GESTOR_FROTA**
  * **MOTORISTA**
* Controle de acesso por role + permissões configuráveis

### 1.3. Frota / Veículos

* Cadastro de veículos:

  * Placa, RENAVAM, modelo, ano, km atual, tipo (caminhonete, van, caminhão leve etc.)
* Situação: ativo, em manutenção, vendido, desativado

### 1.4. Manutenção Preventiva

* Tabela de **planos de manutenção**:

  * Por km (ex: troca de óleo a cada 10.000 km)
  * Por tempo (ex: revisão a cada 12 meses)
* Ordem de serviço:

  * Data, veículo, tipo de serviço, custo, oficina, notas
* Previsão de próximas manutenções (crons ou cálculo on-the-fly)

### 1.5. Abastecimentos

* Registro de abastecimento:

  * Data, veículo, motorista, posto, litros, valor total, km hodômetro
* Cálculo automático de consumo (km/l)

### 1.6. Checklist Diário

* Motorista preenche checklist rápido (PWA):

  * Pneus, luzes, freios, nível de óleo, avarias visuais etc.
* Empresa pode **configurar os itens do checklist** por tipo de veículo

### 1.7. Notificações / Alertas

* Vencimentos:

  * IPVA, licenciamento, seguro, manutenção programada
* Motivo de alerta:

  * Data se aproximando ou km atingido
* Canais configuráveis:

  * Email, WhatsApp (no futuro), push app

---

## 2. Modelo de dados (PostgreSQL)

### 2.1. Multi-tenancy (por linha)

Todas as tabelas “de negócio” têm `tenant_id` (empresa).

**Tabela tenants**

```sql
CREATE TABLE tenants (
  id              UUID PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  document        VARCHAR(50), -- CNPJ/CPF
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Tabela users**

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(50) NOT NULL, -- ADMIN_EMPRESA, GESTOR_FROTA, MOTORISTA
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Tabela vehicles**

```sql
CREATE TABLE vehicles (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(150) NOT NULL, -- "Hilux Prata"
  plate           VARCHAR(10) NOT NULL,
  renavam         VARCHAR(20),
  type            VARCHAR(50), -- pickup, van, utilitario...
  brand           VARCHAR(50),
  model           VARCHAR(50),
  year            SMALLINT,
  current_odometer NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, MAINTENANCE, SOLD, INACTIVE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Tabela maintenance_plans**

```sql
CREATE TABLE maintenance_plans (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  vehicle_type    VARCHAR(50), -- ou null para "geral"
  name            VARCHAR(150) NOT NULL,
  description     TEXT,
  interval_km     NUMERIC(10,2),
  interval_days   INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Tabela maintenances (executadas)**

```sql
CREATE TABLE maintenances (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
  maintenance_plan_id UUID REFERENCES maintenance_plans(id),
  date            DATE NOT NULL,
  odometer        NUMERIC(10,2),
  cost            NUMERIC(12,2),
  provider        VARCHAR(150),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Tabela fuel_logs**

```sql
CREATE TABLE fuel_logs (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
  driver_id       UUID REFERENCES users(id),
  date            DATE NOT NULL,
  station         VARCHAR(150),
  liters          NUMERIC(10,2) NOT NULL,
  total_value     NUMERIC(12,2) NOT NULL,
  odometer        NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Checklist (modelo + preenchimento)**

Modelo de checklist por empresa:

```sql
CREATE TABLE checklist_templates (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(150) NOT NULL,
  vehicle_type    VARCHAR(50),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_template_items (
  id              UUID PRIMARY KEY,
  template_id     UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  label           VARCHAR(150) NOT NULL,
  type            VARCHAR(30) NOT NULL, -- BOOLEAN, TEXT, NUMBER, SELECT
  config          JSONB, -- ex: opções de select
  sort_order      INTEGER NOT NULL DEFAULT 0
);
```

Checklist diário preenchido:

```sql
CREATE TABLE checklist_submissions (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  template_id     UUID NOT NULL REFERENCES checklist_templates(id),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
  driver_id       UUID NOT NULL REFERENCES users(id),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overall_status  VARCHAR(20) -- OK, ALERT, CRITICAL
);

CREATE TABLE checklist_answers (
  id              UUID PRIMARY KEY,
  submission_id   UUID NOT NULL REFERENCES checklist_submissions(id) ON DELETE CASCADE,
  template_item_id UUID NOT NULL REFERENCES checklist_template_items(id),
  value           TEXT NOT NULL
);
```

**Notificações / vencimentos**

```sql
CREATE TABLE reminders (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  vehicle_id      UUID REFERENCES vehicles(id),
  type            VARCHAR(50) NOT NULL, -- IPVA, LICENCIAMENTO, INSURANCE, MAINTENANCE
  due_date        DATE,
  due_odometer    NUMERIC(10,2),
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, DONE, DISMISSED
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Configurações (empresa/usuário)**

```sql
CREATE TABLE tenant_settings (
  tenant_id       UUID PRIMARY KEY REFERENCES tenants(id),
  preferences     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE user_settings (
  user_id         UUID PRIMARY KEY REFERENCES users(id),
  preferences     JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

---

## 3. Backend – Estrutura (NestJS + TypeORM)

### 3.1. Estrutura de pastas

```text
backend/
  src/
    main.ts
    app.module.ts
    config/
      config.module.ts
      config.service.ts
    common/
      guards/
      interceptors/
      filters/
      decorators/   # @CurrentUser(), @TenantId()
      dtos/
    auth/
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      jwt.strategy.ts
      auth.guard.ts
    tenants/
      tenants.module.ts
      tenants.service.ts
      tenants.entity.ts
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
      user.entity.ts
    vehicles/
      vehicles.module.ts
      vehicles.controller.ts
      vehicles.service.ts
      vehicle.entity.ts
    maintenance/
      maintenance.module.ts
      maintenance.controller.ts
      maintenance.service.ts
      maintenance-plan.entity.ts
      maintenance.entity.ts
    fuel/
      fuel.module.ts
      fuel.controller.ts
      fuel.service.ts
      fuel-log.entity.ts
    checklist/
      checklist.module.ts
      checklist.controller.ts
      checklist.service.ts
      checklist-template.entity.ts
      checklist-submission.entity.ts
    reminders/
      reminders.module.ts
      reminders.service.ts
      reminders.entity.ts
    billing/
      billing.module.ts
      billing.controller.ts
      billing.service.ts
      subscription.entity.ts
```

### 3.2. Multi-tenant via middleware/guard

* JWT contém `tenantId`.
* Guard injeta `tenantId` em `request`.
* Services SEMPRE filtram por `tenantId`.

Exemplo (pseudo):

```ts
// vehicles.service.ts
async findAllForTenant(tenantId: string) {
  return this.repo.find({ where: { tenantId } });
}
```

---

## 4. Frontend – Estrutura Angular

### 4.1. Módulos sugeridos

```text
frontend/
  src/app/
    core/
      interceptors/
        auth.interceptor.ts
        tenant.interceptor.ts
      guards/
        auth.guard.ts
      services/
        auth.service.ts
        current-user.service.ts
        settings.service.ts
      layout/
        main-layout.component.ts
    shared/
      components/
      directives/
      pipes/
      models/
    auth/
      login/
      register/
      forgot-password/
    dashboard/
      dashboard.module.ts
      pages/
        overview/
    tenants/
      account-settings/
    fleet/
      vehicles/
      maintenance/
      fuel/
      checklist/
    notifications/
      notifications.module.ts
    billing/
      billing.module.ts
    settings/
      preferences/
        company-preferences.component.ts
        user-preferences.component.ts
```

### 4.2. Configurações de preferência no frontend

Exemplos de coisas configuráveis:

* Idioma (pt-BR, en-US)
* Unidade de distância (km, milhas)
* Moeda (BRL, USD, EUR)
* Forma de alerta:

  * Email
  * WhatsApp (quando tiver)
  * Apenas dashboard
* Antecedência de alerta (ex: 10, 20, 30 dias antes do vencimento)
* Layout de checklist (quais campos aparecem para o motorista)

Fluxo:

* Tela de **Configurações da Empresa** → chama `tenant-settings` API.
* Tela de **Preferências do Usuário** → chama `user-settings` API.
* Frontend usa `SettingsService` que merge:

  * Defaults do sistema
  * Config da empresa
  * Preferences do usuário (sobrescrevem as anteriores)

---

## 5. SaaS / Assinatura

Para começar simples:

**Tabela subscriptions**

```sql
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  plan            VARCHAR(50) NOT NULL, -- BASIC, PRO, etc
  status          VARCHAR(20) NOT NULL, -- ACTIVE, INACTIVE, TRIAL
  started_at      TIMESTAMPTZ NOT NULL,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

* Fase 1: você controla as cobranças manualmente e seta `ACTIVE/INACTIVE`.
* Fase 2: integra com **Mercado Pago / Stripe / PagSeguro** e cria webhooks.

Guard global:

* Bloqueia acesso se `subscription.status != ACTIVE` (com grace period se quiser).

---

## 6. Configurabilidade (bem flexível)

Alguns exemplos práticos:

### 6.1. Config da empresa (`tenant_settings.preferences`)

```json
{
  "locale": "pt-BR",
  "timezone": "America/Sao_Paulo",
  "currency": "BRL",
  "distanceUnit": "km",
  "alertDaysBeforeDue": 15,
  "defaultChecklistTemplateId": "uuid_...",
  "notificationChannels": {
    "maintenance": ["email"],
    "documents": ["email"],
    "criticalChecklist": ["email"]
  }
}
```

### 6.2. Preferências do usuário (`user_settings.preferences`)

```json
{
  "dashboardWidgets": ["vehiclesStatus", "upcomingMaintenances", "alerts"],
  "notificationChannelsOverride": {
    "maintenance": ["email"],
    "documents": []
  },
  "language": "pt-BR"
}
```

Na API você sempre:

1. Carrega defaults do sistema.
2. Mescla com `tenant_settings`.
3. Mescla com `user_settings` (se existir).
4. Retorna isso pro frontend.

---

## 7. Próximos passos (bem objetivos)

Se você quiser, no próximo passo eu posso:

1. **Definir os endpoints da API** (rota por rota, com payload de request/response).
2. **Montar o `docker-compose.yml`** para levantar:

   * API NestJS
   * PostgreSQL
   * pgAdmin
3. **Montar estrutura inicial Angular** com rotas e módulos já criados.
4. Especificar a **tela inicial** (dashboard) com os cards e gráficos.

Se quiser, eu já começo te entregando:

* Lista de endpoints principais (REST)
* Exemplo de DTOs (TypeScript)
* Organização de guards e interceptors para multi-tenant e auth.


Sim! **É totalmente possível** pegar seu frontend Angular, empacotar via Webpack/CAPACITOR e gerar **APK (Android)** e **IPA (iOS)** — igual a um aplicativo nativo híbrido.

E para o seu sistema de Frota Leve, isso é **perfeito**, porque os motoristas podem usar o checklist pelo app, offline, tirar fotos etc.

A solução ideal hoje é:

# ✅ **Angular + Capacitor (atual padrão do Ionic Team)**

Não precisa usar Ionic Components.
Você usa **só Angular** + Capacitor.

---

# 🔥 Como funciona tecnicamente?

Você compila sua aplicação Angular:

```
ng build --prod
```

Isso gera uma pasta **dist/** contendo o HTML, CSS e JS — que são os arquivos do Webpack.

Depois o Capacitor pega essa pasta e **embala** dentro de um projeto nativo (Android Studio + Xcode).

---

# 🚀 Passo a Passo Completo

## 1. Instale o Capacitor no seu projeto Angular

Dentro da raiz:

```bash
npm install @capacitor/core @capacitor/cli
```

Depois inicialize:

```bash
npx cap init
```

Ele vai pedir:

* Nome do app
* ID do app (ex: com.frotaleve.app)

---

## 2. Configure a pasta de build Angular

No **capacitor.config.ts**:

```ts
export default {
  appId: 'com.frotaleve.app',
  appName: 'Frota Leve',
  webDir: 'dist/frota-leve',   // caminho da sua build angular
  bundledWebRuntime: false
};
```

---

## 3. Build Angular

Sempre antes de gerar o app nativo:

```bash
ng build --configuration=production
```

---

## 4. Copie para o Capacitor

```bash
npx cap copy
```

---

## 5. Adicione plataformas

### Android:

```bash
npx cap add android
```

### iOS:

```bash
npx cap add ios
```

---

## 6. Abrir no Android Studio

```bash
npx cap open android
```

Gera **APK, AAB** e pode publicar no Google Play.

---

## 7. Abrir no Xcode (macOS obrigatório)

```bash
npx cap open ios
```

Gera **IPA** e publica na App Store.

---

# 🎉 Recursos nativos que você pode usar facilmente

Com Capacitor, você tem plugins nativos:

### 📌 Checklists

* Fotos do veículo → `Camera`
* Geolocalização → `Geolocation`
* Offline storage → `Storage`
* Upload automático quando voltar internet
* Push notifications → `Push Notifications`

### 📌 Abastecimento

* Tirar foto do comprovante
* Ler QR Code do posto (se você quiser implementar)

### 📌 Manutenções

* Notificações nativas (Android/iOS)
* Agendamento local (local notifications)

---

# ⚙️ Plugins recomendados

```bash
npm install @capacitor/app
npm install @capacitor/device
npm install @capacitor/camera
npm install @capacitor/geolocation
npm install @capacitor/preferences
npm install @capacitor/local-notifications
```

E registre no `capacitor.config.ts` se precisar.

---

# 📦 Alternativa: Ionic + Capacitor

Se você quiser criar uma interface mais “parecida com app”, pode usar o **Ionic Angular**, que deixa tudo mais “nativo”.

Mas **não é obrigatório** — Angular puro já funciona 100%.

---

# 🧪 Funciona offline?

Sim!
Só usar:

* **IndexedDB**
* **SQLite (via plugin)**
* **Storage API do Capacitor**

Checklist offline fica perfeito:

* O motorista preenche
* Fica salvo local
* Quando voltar conexão → sincroniza com o backend

---

# 📱 Build automatizado

Você pode integrar com:

* GitHub Actions
* Fastlane
* AppFlow (da Ionic) – paga, mas facilita MUITO

---

# ❓ Quer que eu gere o template base do projeto?

Posso gerar exatamente:

* Estrutura Angular completa
* Estrutura do backend sincronizada com o app
* `capacitor.config.ts` pronto
* Script `build:mobile`
* Offline-first com IndexedDB
* Tela inicial do app com login, checklist e abastecimento

É só falar **“sim, quero o template”** que eu monto tudo.

