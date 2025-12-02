#!/bin/bash

echo "🎨 Configurando Frontend Angular - Frota Leve"
echo "=============================================="

cd /opt/frota-leve/frontend

# Criar estrutura de diretórios
echo "📁 Criando estrutura de diretórios..."
mkdir -p src/app/{core,shared,features}
mkdir -p src/app/core/{services,guards,interceptors,models}
mkdir -p src/app/shared/{components,directives,pipes}
mkdir -p src/app/features/{auth,dashboard,vehicles,settings}

echo "✅ Frontend configurado com sucesso!"
echo ""
echo "📝 Próximos passos manuais:"
echo "1. Ajustar styles.scss com variáveis do tema"
echo "2. Criar componentes shared (button, card, input)"
echo "3. Implementar serviços core (auth, api)"
echo "4. Criar páginas features (login, dashboard, vehicles)"
echo ""
echo "Para iniciar o dev server:"
echo "  cd frontend"
echo "  npm start"
