# ⚡ Quick Start - Frota Leve

## 🚀 Começar em 3 Minutos

### Opção 1: Automático (Recomendado)

```bash
cd /opt/frota-leve
./setup.sh
cd backend
npm run start:dev
```

### Opção 2: Manual

```bash
cd /opt/frota-leve

# 1. Subir banco de dados
docker-compose up -d

# 2. Instalar e configurar
cd backend
npm install
cp .env.example .env

# 3. Database setup
npx prisma generate
npx prisma migrate dev --name init
npm run seed

# 4. Iniciar
npm run start:dev
```

## 🌐 Acessar

- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/api
- **pgAdmin**: http://localhost:5050

## 🔐 Testar Login

**Swagger UI (mais fácil):**
1. Acesse http://localhost:3000/api
2. Clique em `POST /auth/login`
3. Click "Try it out"
4. Use: `admin@demo.com` / `admin123`
5. Copie o `access_token`
6. Clique em "Authorize" (cadeado) no topo
7. Cole o token e clique "Authorize"

**Ou via cURL:**

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}'

# Copie o access_token e use nas próximas chamadas
TOKEN="cole_o_token_aqui"

# Listar usuários
curl http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN"

# Info da empresa
curl http://localhost:3000/tenants/me \
  -H "Authorization: Bearer $TOKEN"
```

## 📊 Ver Dados no Banco

```bash
cd backend
npm run studio
```

Abre em http://localhost:5555

## 🎯 Próximo Passo

Implementar módulo de Veículos! Veja `NEXT-STEPS.md`

## 🆘 Problemas?

**Porta 3000 em uso:**
```bash
# Mudar porta no backend/.env
PORT=3001
```

**Porta 5432 em uso (outro PostgreSQL):**
```bash
# Mudar porta no docker-compose.yml
ports:
  - '5433:5432'

# E ajustar DATABASE_URL no backend/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/frota_leve?schema=public"
```

**Erro no Prisma:**
```bash
cd backend
rm -rf node_modules
npm install
npx prisma generate
```

**Reset completo do banco:**
```bash
cd backend
npx prisma migrate reset
npm run seed
```

## 📚 Documentos

- `README.md` - Visão geral
- `PROJECT-SUMMARY.md` - O que foi criado
- `NEXT-STEPS.md` - Roadmap completo
- `backend/README.md` - Docs da API

---

**Pronto! Agora é só desenvolver! 🎉**
