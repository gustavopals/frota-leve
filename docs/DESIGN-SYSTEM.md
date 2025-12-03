# 🎨 Design System - Frota Leve

## Cores e Tokens CSS

O sistema usa **Tailwind CSS** com variáveis CSS personalizadas definidas em `styles.scss`.

### Tokens Principais

```css
/* Cores de fundo */
bg-background      /* Fundo principal da página */
bg-card            /* Fundo de cards e containers */
bg-muted           /* Fundo de elementos secundários */
bg-accent          /* Fundo de hover states */

/* Cores de texto */
text-foreground    /* Texto principal */
text-muted-foreground  /* Texto secundário/hints */

/* Cores de borda */
border-input       /* Bordas de inputs */
border-border      /* Bordas gerais */

/* Cores de ação */
bg-primary         /* Botão primário */
text-primary-foreground  /* Texto em botão primário */
bg-destructive     /* Ações destrutivas (deletar) */
text-destructive   /* Texto de erros */

/* Cores de foco */
ring              /* Ring de foco em inputs */
```

---

## 📦 Componentes Padronizados

### 1. Cabeçalho de Página

```html
<div class="flex justify-between items-center mb-6">
  <div>
    <h1 class="text-3xl font-bold">Título da Página</h1>
    <p class="text-muted-foreground">Descrição da página</p>
  </div>
  <div class="flex gap-3">
    <!-- Botões de ação -->
  </div>
</div>
```

### 2. Botão Primário

```html
<button 
  class="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
>
  Texto do Botão
</button>
```

### 3. Botão Secundário

```html
<button 
  class="inline-flex items-center justify-center rounded-md font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
>
  Texto do Botão
</button>
```

### 4. Botão Destrutivo (Delete)

```html
<button 
  class="text-destructive hover:text-destructive/80"
>
  Excluir
</button>
```

### 5. Link de Ação

```html
<a 
  routerLink="/caminho"
  class="text-primary hover:text-primary/80"
>
  Editar
</a>
```

### 6. Card/Container

```html
<div class="bg-card rounded-lg border p-6">
  <!-- Conteúdo -->
</div>
```

### 7. Formulário - Campo de Input

```html
<div>
  <label for="campo" class="block text-sm font-medium mb-2">
    Label do Campo *
  </label>
  <input
    id="campo"
    type="text"
    formControlName="campo"
    class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
    placeholder="Placeholder"
  />
  @if (form.get('campo')?.invalid && form.get('campo')?.touched) {
    <p class="mt-1 text-sm text-destructive">Mensagem de erro</p>
  }
</div>
```

### 8. Formulário - Select

```html
<div>
  <label for="campo" class="block text-sm font-medium mb-2">
    Label do Campo *
  </label>
  <select
    id="campo"
    formControlName="campo"
    class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
  >
    <option value="">Selecione uma opção</option>
    @for (item of items(); track item.id) {
      <option [value]="item.id">{{ item.name }}</option>
    }
  </select>
</div>
```

### 9. Estado de Carregamento

```html
@if (loading()) {
  <div class="flex justify-center p-12">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
}
```

### 10. Estado de Erro

```html
@if (error()) {
  <div class="bg-destructive/10 border border-destructive rounded-lg p-4">
    <p class="text-destructive">{{ error() }}</p>
  </div>
}
```

### 11. Estado Vazio (Empty State)

```html
@if (items().length === 0) {
  <div class="bg-card rounded-lg border p-12 text-center">
    <p class="text-muted-foreground text-lg mb-4">Nenhum item cadastrado</p>
    <a
      routerLink="/novo"
      class="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2"
    >
      Cadastrar Primeiro Item
    </a>
  </div>
}
```

### 12. Tabela

```html
<div class="bg-card rounded-lg border overflow-hidden">
  <table class="min-w-full divide-y divide-border">
    <thead class="bg-muted">
      <tr>
        <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Coluna
        </th>
      </tr>
    </thead>
    <tbody class="bg-card divide-y divide-border">
      @for (item of items(); track item.id) {
        <tr class="hover:bg-muted/50">
          <td class="px-6 py-4 whitespace-nowrap text-sm">
            {{ item.value }}
          </td>
        </tr>
      }
    </tbody>
  </table>
</div>
```

### 13. Badge de Status

```html
<!-- Ativo/Sucesso -->
<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
  Ativo
</span>

<!-- Inativo/Neutro -->
<span class="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
  Inativo
</span>

<!-- Alerta/Aviso -->
<span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
  Alerta
</span>

<!-- Crítico/Erro -->
<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
  Crítico
</span>
```

### 14. Grid de Cards

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  @for (item of items(); track item.id) {
    <div class="bg-card rounded-lg border hover:shadow-lg transition-shadow p-6">
      <!-- Conteúdo do card -->
    </div>
  }
</div>
```

---

## 🚫 **O QUE NÃO USAR**

### ❌ Cores Hard-Coded (Evitar!)

```html
<!-- ERRADO -->
<div class="bg-white text-gray-900 border-gray-300">
<div class="bg-blue-600 text-white">
<p class="text-red-600">Erro</p>

<!-- CORRETO -->
<div class="bg-card text-foreground border-border">
<div class="bg-primary text-primary-foreground">
<p class="text-destructive">Erro</p>
```

### ❌ Classes Utilitárias Específicas (Evitar!)

```html
<!-- ERRADO -->
<button class="px-4 py-2 bg-blue-600 rounded-lg">

<!-- CORRETO (usar padrão de botão) -->
<button class="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
```

---

## 📏 Espaçamentos Padrão

```css
/* Padding de containers */
p-6          /* Padding de cards e forms */
p-12         /* Padding de empty states */

/* Gaps entre elementos */
gap-3        /* Entre botões */
gap-4        /* Entre cards */
gap-6        /* Entre campos de formulário */

/* Margins */
mb-2         /* Entre label e input */
mb-4         /* Entre seções pequenas */
mb-6         /* Entre seções principais */
mt-6         /* Antes de botões de ação */
```

---

## 🎯 Regras de Consistência

1. **Sempre use tokens CSS** (`bg-card`, `text-foreground`) ao invés de cores hard-coded
2. **Botões primários** para ações principais (salvar, criar)
3. **Botões secundários** para ações alternativas (cancelar, voltar)
4. **Títulos de página** sempre `text-3xl font-bold`
5. **Subtítulos** sempre `text-muted-foreground`
6. **Tabelas** com `bg-card`, `border`, `bg-muted` no header
7. **Empty states** centralizados com ícone/emoji e botão de ação
8. **Loading states** com spinner circular centralizado
9. **Mensagens de erro** com `text-destructive` e fundo `bg-destructive/10`
10. **Grid responsivo** sempre `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

## ✅ Checklist de Revisão

Antes de commitar um componente HTML, verifique:

- [ ] Usa `bg-card` ao invés de `bg-white`?
- [ ] Usa `text-foreground` ao invés de `text-gray-900`?
- [ ] Usa `text-muted-foreground` ao invés de `text-gray-500`?
- [ ] Usa `border-input`/`border-border` ao invés de `border-gray-300`?
- [ ] Botões seguem o padrão (`inline-flex items-center...`)?
- [ ] Formulários usam `focus:ring-2 focus:ring-ring`?
- [ ] Erros usam `text-destructive`?
- [ ] Links de ação usam `text-primary hover:text-primary/80`?
- [ ] Título de página é `text-3xl font-bold`?
- [ ] Tem subtítulo `text-muted-foreground`?

---

**Com esse design system, todo o app fica consistente e suporta tema claro/escuro automaticamente! 🎨✨**
