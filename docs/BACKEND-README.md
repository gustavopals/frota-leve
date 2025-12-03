# Frota Leve - Backend API

API RESTful construída com NestJS, Prisma ORM e PostgreSQL para o sistema de gestão de frota leve.

## 🚀 Tecnologias

- **NestJS** v10 - Framework progressivo Node.js
- **Prisma ORM** v5 - Type-safe database client
- **PostgreSQL** 16 - Banco de dados relacional
- **JWT** - Autenticação stateless
- **Swagger** - Documentação automática da API
- **Class Validator** - Validação de DTOs
- **Bcrypt** - Hash de senhas

## 📋 Pré-requisitos

- Node.js >= 18.x
- npm ou yarn
- Docker e Docker Compose (para banco de dados)

## 🔧 Instalação

1. Entre no diretório do backend:
```bash
cd backend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env se necessário
```

4. Suba o banco de dados com Docker:
```bash
# Na raiz do projeto
cd ..
npm run docker:up
```

5. Execute as migrations:
```bash
npm run prisma:migrate
```

6. (Opcional) Popule o banco com dados de exemplo:
```bash
npm run seed
```

## 🏃 Executando

### Modo desenvolvimento
```bash
npm run start:dev
```

### Modo produção
```bash
npm run build
npm run start:prod
```

A API estará disponível em:
- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/api

## 📚 Documentação da API

Acesse `http://localhost:3000/api` para ver a documentação completa gerada automaticamente pelo Swagger.

### Endpoints Principais

#### Autenticação
- `POST /auth/register` - Registrar nova empresa e usuário admin
- `POST /auth/login` - Login

#### Tenants (Empresas)
- `GET /tenants/me` - Informações da empresa atual
- `GET /tenants/settings` - Configurações da empresa
- `PUT /tenants/settings` - Atualizar configurações

#### Usuários
- `GET /users` - Listar usuários
- `POST /users` - Criar usuário
- `GET /users/:id` - Obter usuário
- `PATCH /users/:id` - Atualizar usuário
- `DELETE /users/:id` - Remover usuário

## 🗄️ Prisma

### Comandos úteis

```bash
# Gerar Prisma Client
npm run prisma:generate

# Criar migration
npm run prisma:migrate

# Aplicar migrations em produção
npm run migrate:deploy

# Abrir Prisma Studio (GUI)
npm run studio

# Popular banco com dados de teste
npm run seed
```

## 🏗️ Estrutura do Projeto

```
src/
├── main.ts                 # Entry point da aplicação
├── app.module.ts           # Módulo raiz
├── config/                 # Configurações
│   ├── prisma.service.ts   # Serviço Prisma
│   └── prisma.module.ts    # Módulo Prisma
├── common/                 # Recursos compartilhados
│   ├── decorators/         # Decorators customizados
│   │   ├── current-user.decorator.ts
│   │   ├── tenant-id.decorator.ts
│   │   └── roles.decorator.ts
│   ├── guards/             # Guards de autorização
│   │   └── roles.guard.ts
│   └── dto/                # DTOs genéricos
│       └── pagination.dto.ts
├── auth/                   # Módulo de autenticação
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── jwt.strategy.ts
│   └── dto/
├── tenants/                # Módulo de empresas
│   ├── tenants.service.ts
│   ├── tenants.controller.ts
│   └── tenants.module.ts
└── users/                  # Módulo de usuários
    ├── users.service.ts
    ├── users.controller.ts
    ├── users.module.ts
    └── dto/
```

## 🔐 Autenticação e Autorização

### Multi-tenancy

O sistema implementa multi-tenancy por linha (row-level):
- Cada empresa (tenant) tem seus próprios dados isolados
- O `tenantId` é extraído do JWT e aplicado automaticamente
- Guards garantem que usuários só acessem dados de sua empresa

### Perfis de Usuário

```typescript
enum UserRole {
  ADMIN_EMPRESA    // Acesso total à empresa
  GESTOR_FROTA     // Gerencia frota e relatórios
  MOTORISTA        // Acesso limitado (checklist, abastecimento)
}
```

### Exemplo de Uso

```typescript
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN_EMPRESA, UserRole.GESTOR_FROTA)
async create(@TenantId() tenantId: string, @Body() dto: CreateDto) {
  // tenantId é extraído automaticamente do JWT
}
```

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e

# Coverage
npm run test:cov
```

## 🗃️ Dados de Demonstração

Após executar `npm run seed`, você terá:

**Empresa Demo:**
- Nome: Empresa Demo
- CNPJ: 12.345.678/0001-90

**Usuários:**
- Admin: `admin@demo.com` / `admin123`
- Motorista: `motorista@demo.com` / `motorista123`

**Veículos:**
- Hilux Prata 2020 (ABC-1234)
- Sprinter Branca 2019 (XYZ-9876)

**Outros:**
- Plano de manutenção (Troca de Óleo)
- Template de checklist diário
- Lembretes de IPVA e manutenção

## 🔨 Scripts Disponíveis

```bash
npm run start          # Iniciar em modo normal
npm run start:dev      # Modo desenvolvimento (watch)
npm run start:debug    # Modo debug
npm run build          # Build para produção
npm run lint           # Lint do código
npm run format         # Formatar código com Prettier
npm run prisma:migrate # Executar migrations
npm run studio         # Abrir Prisma Studio
npm run seed           # Popular banco de dados
```

## 🐳 Docker

O banco de dados roda em Docker. Para gerenciar:

```bash
# Subir containers (na raiz do projeto)
npm run docker:up

# Parar containers
npm run docker:down

# Ver logs
npm run docker:logs
```

## 🌐 Variáveis de Ambiente

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Application
NODE_ENV="development"
PORT=3000

# CORS
CORS_ORIGIN="http://localhost:4200"
```

## 📝 Próximos Passos

Módulos planejados para implementação:

- [ ] **Vehicles** - Gestão de veículos
- [ ] **Maintenance** - Manutenções preventivas
- [ ] **Fuel** - Controle de abastecimento
- [ ] **Checklist** - Checklists diários
- [ ] **Reminders** - Notificações e alertas
- [ ] **Billing** - Sistema de assinaturas
- [ ] **Reports** - Relatórios e dashboards

## 🚀 Deploy

### Preparação para produção

1. Configure as variáveis de ambiente de produção
2. Execute as migrations:
   ```bash
   npm run migrate:deploy
   ```
3. Build da aplicação:
   ```bash
   npm run build
   ```
4. Inicie em modo produção:
   ```bash
   npm run start:prod
   ```

### Recomendações para VPS

- Use PM2 para gerenciar o processo Node.js
- Configure Nginx como reverse proxy
- Use PostgreSQL gerenciado ou container com volumes persistentes
- Configure SSL/TLS (Let's Encrypt)
- Implemente rate limiting e CORS apropriado
- Configure logs e monitoramento

## 📄 Licença

MIT
