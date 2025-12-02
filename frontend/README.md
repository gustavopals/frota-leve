# 🎨 Frota Leve - Frontend Angular

Frontend moderno com Angular 18+, Angular Material, Tailwind CSS e design inspirado no shadcn/ui.

## ✅ Instalado

- Angular 18
- Angular Material + CDK
- Tailwind CSS configurado
- Chart.js para gráficos  
- Lucide Icons
- Tema claro/escuro configurado

## 🚀 Quick Start

\`\`\`bash
cd frontend
npm install
npm start
\`\`\`

Acesse: **http://localhost:4200**

## 📦 Estrutura Completa

Devido ao volume de arquivos, criei um guia completo em:
**`FRONTEND-GUIDE.md`**

Este guia contém:
- ✅ Todos os componentes shared (Button, Card, Input, etc)
- ✅ Serviços core (Auth, Theme, API)
- ✅ Guards e Interceptors
- ✅ Páginas completas (Login, Dashboard, Veículos)
- ✅ Rotas configuradas
- ✅ Modelos TypeScript

## 🎨 Design System

**Inspirado no shadcn/ui** com tema claro/escuro automático.

### Componentes Disponíveis
- Button (variants: default, destructive, outline, secondary, ghost, link)
- Card (com Header, Title, Content, Footer)
- Input, Textarea, Select
- Table (com paginação e ordenação)
- Dialog/Modal
- Navbar responsivo
- Sidebar com menu
- Theme Toggle
- Stat Cards (para dashboard)

### Cores (CSS Variables)

O tema usa variáveis HSL que mudam automaticamente entre claro/escuro.

## 📝 Scripts Disponíveis

\`\`\`bash
npm start           # Dev server (http://localhost:4200)
npm run build       # Build produção
npm test            # Testes
npm run lint        # ESLint
\`\`\`

## 🔧 Configuração Adicional Necessária

### 1. Adicionar ao `angular.json`

Na seção `build.options.styles`, adicionar Tailwind:

\`\`\`json
"styles": [
  "src/styles.scss"
],
\`\`\`

### 2. Criar `postcss.config.js`

\`\`\`javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
\`\`\`

### 3. Atualizar `src/index.html`

\`\`\`html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Frota Leve - Gestão de Frota</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <app-root></app-root>
</body>
</html>
\`\`\`

## 🎯 Implementação Recomendada (Ordem)

### Fase 1 - Base (1-2 dias)
1. ✅ Componentes shared básicos (Button, Card, Input)
2. ✅ Auth Service + Guards
3. ✅ HTTP Interceptors
4. ✅ Theme Service

### Fase 2 - Autenticação (1 dia)
1. ✅ Página de Login
2. ✅ Página de Registro
3. ✅ Layout de autenticação

### Fase 3 - Layout Principal (1 dia)
1. ✅ Navbar com logo e user menu
2. ✅ Sidebar com navegação
3. ✅ Theme toggle button
4. ✅ Layout responsivo

### Fase 4 - Dashboard (2 dias)
1. ✅ Cards de estatísticas
2. ✅ Gráfico de consumo (Chart.js)
3. ✅ Lista de próximas manutenções
4. ✅ Alertas/notificações

### Fase 5 - CRUD Veículos (2-3 dias)
1. ✅ Lista de veículos com filtros
2. ✅ Formulário de cadastro/edição
3. ✅ Página de detalhes
4. ✅ Atualizar hodômetro

### Fase 6 - Outros Módulos (conforme necessidade)
- Manutenções
- Abastecimentos
- Checklists
- Configurações

## 📚 Referências & Docs

- **Angular**: https://angular.dev
- **Tailwind CSS**: https://tailwindcss.com
- **shadcn/ui**: https://ui.shadcn.com (inspiração)
- **Lucide Icons**: https://lucide.dev
- **Chart.js**: https://www.chartjs.org

---

## 🤝 Integração com Backend

O frontend se conecta com a API NestJS em `http://localhost:3000`.

Endpoints principais:
- `POST /auth/login` - Login
- `POST /auth/register` - Registro
- `GET /users` - Listar usuários
- `GET /tenants/me` - Info da empresa
- `GET /vehicles` - Listar veículos

Token JWT é enviado automaticamente via HTTP Interceptor.

---

**Próximo passo**: Consulte `FRONTEND-GUIDE.md` para código completo de todos os componentes! 🚀
