#!/bin/bash

# Script para gerar APK no WSL e copiar para Windows
# Uso: ./build-apk.sh

set -e  # Para na primeira falha

echo "🔨 Building Angular app..."
npm run build

echo ""
echo "📦 Syncing Capacitor..."
npx cap sync android

echo ""
echo "🤖 Building Android APK..."
cd android

# Garante permissão de execução
chmod +x gradlew

# Build debug APK
./gradlew assembleDebug

echo ""
echo "✅ APK gerado com sucesso!"
echo ""

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    echo "📍 APK localizado em:"
    echo "   $(realpath $APK_PATH)"
    echo ""
    
    # Detecta usuário do Windows (pega o primeiro da pasta /mnt/c/Users/)
    WIN_USER=$(ls /mnt/c/Users/ | grep -v "Public\|Default\|All Users" | head -n1)
    
    if [ -n "$WIN_USER" ]; then
        WIN_DOWNLOADS="/mnt/c/Users/$WIN_USER/Downloads"
        
        if [ -d "$WIN_DOWNLOADS" ]; then
            cp "$APK_PATH" "$WIN_DOWNLOADS/frota-leve.apk"
            echo "📲 APK copiado para Windows Downloads:"
            echo "   C:\\Users\\$WIN_USER\\Downloads\\frota-leve.apk"
            echo ""
            echo "🎉 Agora você pode:"
            echo "   1. Conectar o celular no PC via USB"
            echo "   2. Transferir o arquivo frota-leve.apk para o celular"
            echo "   3. Instalar no celular"
        else
            echo "⚠️  Pasta Downloads não encontrada em /mnt/c/Users/$WIN_USER/Downloads"
            echo "   Copie manualmente de: $(realpath $APK_PATH)"
        fi
    else
        echo "⚠️  Usuário Windows não detectado automaticamente"
        echo "   Copie manualmente de: $(realpath $APK_PATH)"
        echo "   Para: /mnt/c/Users/SEU_USUARIO/Downloads/"
    fi
else
    echo "❌ APK não encontrado em $APK_PATH"
    exit 1
fi

echo ""
echo "📊 Tamanho do APK:"
ls -lh "$APK_PATH" | awk '{print "   "$5}'
