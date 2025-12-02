#!/bin/bash

echo "🚗 Frota Leve - Setup Inicial"
echo "=============================="
echo ""

# Verificar se está na raiz do projeto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script na raiz do projeto!"
    exit 1
fi

echo "📦 Instalando dependências do workspace..."
npm install

echo ""
echo "📦 Instalando dependências do backend..."
cd backend
npm install

echo ""
echo "🐳 Subindo containers Docker (PostgreSQL + pgAdmin)..."
cd ..
docker-compose up -d

echo ""
echo "⏳ Aguardando PostgreSQL inicializar..."
sleep 5

echo ""
echo "🔧 Gerando Prisma Client..."
cd backend
npx prisma generate

echo ""
echo "📊 Executando migrations..."
npx prisma migrate dev --name init

echo ""
echo "🌱 Populando banco de dados com dados de exemplo..."
npm run seed

echo ""
echo "✅ Setup concluído com sucesso!"
echo ""
echo "📝 Próximos passos:"
echo "   1. cd backend && npm run start:dev (Iniciar API)"
echo "   2. Acesse http://localhost:3000/api (Swagger)"
echo "   3. Acesse http://localhost:5050 (pgAdmin)"
echo ""
echo "🔐 Credenciais de teste:"
echo "   Admin: admin@demo.com / admin123"
echo "   Motorista: motorista@demo.com / motorista123"
echo ""
echo "🗄️ pgAdmin:"
echo "   Email: admin@frotaleve.com / admin"
echo ""
