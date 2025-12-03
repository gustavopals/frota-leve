# 🚗 Frota Leve - Sistema de Gestão de Frota

Sistema SaaS multi-tenant para gestão de frotas leves (caminhonetes, vans, pickups e maquinário pequeno).

## 🏗️ Arquitetura

**Monorepo Structure:**
- `backend/` - API NestJS + Prisma + PostgreSQL
- `frontend/` - Angular 18 + Tailwind CSS + Capacitor
- `scripts/` - Scripts de automação (.sh)
- `docs/` - Documentação do projeto (.md)

## 🚀 Tecnologias

### Backend
- **NestJS** - Framework Node.js progressivo
- **Prisma ORM** - Type-safe database client
- **PostgreSQL** - Banco de dados relacional
- **JWT** - Autenticação stateless
- **Class Validator** - Validação de DTOs
- **Swagger** - Documentação automática da API

### Frontend
- **Angular 18** - Framework TypeScript
- **Tailwind CSS** - Utility-first CSS
- **Capacitor** - Mobile app wrapper (Android/iOS)
- **Chart.js** - Gráficos e visualizações
- **Lucide Icons** - Ícones modernos

### Infraestrutura
- **Docker Compose** - Orquestração de containers
- **pgAdmin** - Interface de gerenciamento do PostgreSQL

## 📋 Pré-requisitos

- Node.js >= 18.x
- Docker e Docker Compose
- npm ou yarn
- (Opcional) Java 21 para build Android

## 🔧 Instalação

### Opção 1: Setup Automático (Recomendado)

```bash
git clone <repository-url>
cd frota-leve
./scripts/setup.sh
```

O script irá:
- ✅ Instalar todas as dependências
- ✅ Subir containers Docker
- ✅ Executar migrations do Prisma
- ✅ Popular banco com dados de exemplo

### Opção 2: Setup Manual

1. Clone o repositório:
```bash
git clone <repository-url>
cd frota-leve
```

2. Instale as dependências:
```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

3. Suba os containers Docker (PostgreSQL + pgAdmin):
```bash
npm run docker:up
```

4. Configure as variáveis de ambiente:
```bash
cd backend
cp .env.example .env
# Edite o arquivo .env conforme necessário
```

5. Execute as migrations do Prisma:
```bash
npm run prisma:migrate
```

6. (Opcional) Popule o banco com dados de teste:
```bash
npm run seed
```

7. Inicie o backend e frontend:
```bash
npm run backend    # Terminal 1
npm run frontend   # Terminal 2
```

## 🐳 Docker

### Serviços disponíveis:

- **PostgreSQL**: `localhost:5432`
  - Database: `frota_leve`
  - User: `postgres`
  - Password: `postgres`

- **pgAdmin**: `http://localhost:5050`
  - Email: `admin@frotaleve.com`
  - Password: `admin`

### Comandos úteis:

```bash
# Subir todos os containers
npm run docker:up

# Parar containers
npm run docker:down

# Ver logs
npm run docker:logs

# Acessar Prisma Studio
npm run prisma:studio
```

## 📂 Estrutura do Projeto

```
frota-leve/
├── backend/              # API NestJS
│   ├── prisma/          # Schema e migrations
│   └── src/             # Código fonte
├── frontend/            # App Angular
│   ├── src/app/         # Componentes e serviços
│   └── android/         # Build mobile Android
├── scripts/             # Scripts de automação
│   ├── setup.sh
│   ├── build-apk.sh
│   └── standardize-design.sh
├── docs/                # Documentação
│   ├── QUICK-START.md
│   ├── PROJECT-SUMMARY.md
│   ├── FRONTEND-GUIDE.md
│   ├── DESIGN-SYSTEM.md
│   ├── MOBILE-BUILD.md
│   └── WSL-BUILD-GUIDE.md
├── docker-compose.yml
└── package.json
```

## 🔐 Multi-tenancy

O sistema implementa multi-tenancy por linha (row-level), onde:
- Todas as tabelas possuem `tenantId`
- Guards garantem isolamento de dados
- JWT contém o `tenantId` do usuário

## 🎯 Funcionalidades (MVP)

- ✅ Autenticação JWT
- ✅ Multi-tenant por linha
- ✅ Cadastro de veículos
- ✅ Manutenção preventiva
- ✅ Controle de abastecimento
- ✅ Checklist diário configurável
- ✅ Design system padronizado
- ✅ Build mobile Android (APK)
- 🔄 Notificações de vencimentos (em desenvolvimento)
- 🔄 Billing/assinatura (planejado)

## 📱 Mobile (Capacitor)

O frontend Angular é empacotado com **Capacitor** para gerar apps nativos:

```bash
cd frontend
npm run build:mobile   # Build otimizado
npm run sync:android   # Sincroniza código
./scripts/build-apk.sh # Gera APK
```

Consulte `docs/MOBILE-BUILD.md` para instruções detalhadas.

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
npm run backend              # Inicia backend em modo dev
npm run frontend             # Inicia frontend (http://localhost:4200)

# Docker
npm run docker:up            # Sube containers
npm run docker:down          # Para containers
npm run docker:logs          # Exibe logs

# Prisma
npm run prisma:migrate       # Executa migrations
npm run prisma:studio        # Abre Prisma Studio

# Formatação
npm run format               # Formata código com Prettier
```

## 🌐 API Endpoints

- `POST /auth/login` - Login
- `POST /auth/register` - Registro de empresa
- `GET /vehicles` - Listar veículos
- `POST /vehicles` - Cadastrar veículo
- `GET /maintenance` - Listar manutenções
- `POST /fuel-logs` - Registrar abastecimento
- `POST /checklist` - Submeter checklist
- `GET /reminders` - Alertas pendentes

Documentação completa em: `http://localhost:3000/api` (Swagger)

## 📚 Documentação

Consulte a pasta `docs/` para guias detalhados:

- **[QUICK-START.md](docs/QUICK-START.md)** - Início rápido
- **[PROJECT-SUMMARY.md](docs/PROJECT-SUMMARY.md)** - Visão geral do projeto
- **[FRONTEND-GUIDE.md](docs/FRONTEND-GUIDE.md)** - Guia completo do frontend
- **[DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)** - Sistema de design
- **[MOBILE-BUILD.md](docs/MOBILE-BUILD.md)** - Build mobile Android
- **[WSL-BUILD-GUIDE.md](docs/WSL-BUILD-GUIDE.md)** - Build em WSL

## 📄 Licença

MIT

## 👨‍💻 Desenvolvido por

**PalsCorp © 2025**

Sistema desenvolvido para empresas paranaenses com frotas pequenas (3-20 veículos).
