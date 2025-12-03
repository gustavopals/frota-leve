#!/bin/bash

# Script para padronizar cores CSS hard-coded para design tokens

echo "🎨 Padronizando design system em todos os componentes..."

# Cores de fundo
find src/app/features -name "*.html" -type f -exec sed -i 's/bg-white/bg-card/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/bg-gray-50/bg-muted/g' {} \;

# Cores de texto
find src/app/features -name "*.html" -type f -exec sed -i 's/text-gray-900/text-foreground/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/text-gray-700/text-foreground/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/text-gray-500/text-muted-foreground/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/text-gray-600/text-muted-foreground/g' {} \;

# Bordas
find src/app/features -name "*.html" -type f -exec sed -i 's/border-gray-300/border-input/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/border-gray-200/border-border/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/divide-gray-200/divide-border/g' {} \;

# Erros
find src/app/features -name "*.html" -type f -exec sed -i 's/text-red-600/text-destructive/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/bg-red-50/bg-destructive\/10/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/border-red-200/border-destructive/g' {} \;

# Links/Ações primárias
find src/app/features -name "*.html" -type f -exec sed -i 's/text-blue-600/text-primary/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/text-blue-700/text-primary/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/text-blue-900/text-primary\/80/g' {} \;

# Botões primários (azul/verde)
find src/app/features -name "*.html" -type f -exec sed -i 's/bg-blue-600 text-white rounded-lg hover:bg-blue-700/bg-primary text-primary-foreground rounded-md hover:bg-primary\/90/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/bg-green-600 text-white rounded-lg hover:bg-green-700/bg-primary text-primary-foreground rounded-md hover:bg-primary\/90/g' {} \;

# Hover states
find src/app/features -name "*.html" -type f -exec sed -i 's/hover:bg-gray-50/hover:bg-muted\/50/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/hover:bg-gray-100/hover:bg-accent/g' {} \;

# Focus states (remover focus: específicos)
find src/app/features -name "*.html" -type f -exec sed -i 's/focus:ring-2 focus:ring-blue-500 focus:border-transparent/focus:outline-none focus:ring-2 focus:ring-ring/g' {} \;
find src/app/features -name "*.html" -type f -exec sed -i 's/rounded-lg/rounded-md/g' {} \;

echo "✅ Padronização concluída!"
echo ""
echo "📋 Arquivos modificados:"
git status --short src/app/features/**/*.html | head -20
