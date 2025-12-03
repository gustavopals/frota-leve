# 📱 Guia de Build do App Mobile - Frota Leve

## 🎯 Visão Geral

Este guia mostra como gerar APK Android do Frota Leve usando Capacitor.

---

## ✅ Pré-requisitos

### Obrigatórios para gerar APK:

1. **Java JDK 17** ou superior
   ```bash
   java -version
   ```
   Se não tiver, instale:
   - Ubuntu/Debian: `sudo apt install openjdk-17-jdk`
   - macOS: `brew install openjdk@17`

2. **Android Studio** (para gerar APK via GUI)
   - Download: https://developer.android.com/studio
   - Durante instalação, marque "Android SDK" e "Android SDK Platform"

3. **Android SDK Command Line Tools** (para build via terminal)
   ```bash
   # Após instalar Android Studio, configure:
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
   ```

4. **Gradle** (geralmente vem com Android Studio)
   ```bash
   gradle -v
   ```

---

## 🚀 Comandos Rápidos

### 1. Build para Mobile (pela primeira vez)

```bash
cd /opt/frota-leve/frontend
npm run build:mobile
```

**O que acontece:**
- Compila Angular em modo produção
- Gera arquivos otimizados em `dist/frontend/browser`
- Sincroniza com Capacitor (copia para pasta `android/`)
- Atualiza plugins nativos

---

### 2. Apenas Sincronizar (após mudanças no código)

```bash
npm run sync:android
```

Use quando só alterou código Angular e quer atualizar o app Android.

---

### 3. Abrir no Android Studio

```bash
npm run open:android
```

**Isso abre a pasta `android/` no Android Studio.**

---

## 📦 Gerar APK - Método 1: Android Studio (Recomendado)

### Passo a Passo:

1. **Build e abra o projeto:**
   ```bash
   cd /opt/frota-leve/frontend
   npm run build:mobile
   npm run open:android
   ```

2. **No Android Studio:**
   - Aguarde indexação do projeto (barra de progresso no canto inferior)
   - Menu: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`

3. **Aguarde compilação** (pode demorar 2-5 minutos na primeira vez)

4. **APK gerado em:**
   ```
   /opt/frota-leve/frontend/android/app/build/outputs/apk/debug/app-debug.apk
   ```

5. **Instalar no celular:**
   - Conecte o celular via USB
   - Ative "Depuração USB" nas Opções do Desenvolvedor
   - Clique no botão ▶️ (Run) no Android Studio
   - OU arraste o APK para o celular e instale manualmente

---

## 📦 Gerar APK - Método 2: Linha de Comando

### Para APK Debug (testes):

```bash
cd /opt/frota-leve/frontend/android
./gradlew assembleDebug
```

**APK gerado em:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Para APK Release (produção):

Primeiro, você precisa **gerar um keystore** (certificado):

```bash
keytool -genkey -v -keystore frota-leve.keystore -alias frotaleve -keyalg RSA -keysize 2048 -validity 10000
```

Depois, configure o `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("../../frota-leve.keystore")
            storePassword "sua-senha"
            keyAlias "frotaleve"
            keyPassword "sua-senha"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

Gere o APK assinado:

```bash
cd /opt/frota-leve/frontend/android
./gradlew assembleRelease
```

**APK release em:**
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 🔧 Configurações Importantes

### Ícone e Splash Screen

1. **Ícone:**
   - Adicione imagem PNG 1024x1024 em `frontend/public/icon.png`
   - Execute: `npx capacitor-assets generate`

2. **Splash Screen:**
   - Adicione imagem PNG 2732x2732 em `frontend/public/splash.png`
   - Configure em `capacitor.config.ts` (já feito)

### Permissões do App

Edite `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

## 📱 Testar no Celular

### Opção 1: USB Debugging

1. **Celular:**
   - Ative "Opções do Desenvolvedor" (toque 7x em "Número da versão" nas Configurações)
   - Ative "Depuração USB"
   - Conecte via USB

2. **Computador:**
   ```bash
   adb devices  # Verifica se celular foi reconhecido
   ```

3. **Instale:**
   ```bash
   cd /opt/frota-leve/frontend
   npm run run:android
   ```

### Opção 2: APK Manual

1. Copie o APK para o celular
2. Abra o arquivo e instale
3. Se der erro de "origem desconhecida", permita instalação de apps desconhecidos

---

## 🐛 Troubleshooting

### Erro: "ANDROID_HOME not set"

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Adicione ao `~/.bashrc` ou `~/.zshrc` para ser permanente.

### Erro: "Gradle build failed"

```bash
cd /opt/frota-leve/frontend/android
./gradlew clean
./gradlew assembleDebug
```

### Erro: "SDK location not found"

Crie `android/local.properties`:

```
sdk.dir=/home/seu-usuario/Android/Sdk
```

### App crasheia ao abrir

Verifique logs:

```bash
adb logcat | grep Capacitor
```

---

## 🌐 Conectar ao Backend em Produção

No `capacitor.config.ts`, você pode apontar para API de produção:

```typescript
const config: CapacitorConfig = {
  ...
  server: {
    url: 'https://api.frotaleve.com',  // Sua API
    cleartext: true
  }
};
```

**OU** no Angular (`environment.ts`):

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.frotaleve.com/api'
};
```

---

## 📊 Recursos Nativos Disponíveis

Já instalados e prontos para usar:

- ✅ **@capacitor/app** - Lifecycle do app
- ✅ **@capacitor/camera** - Tirar fotos (checklist, manutenção)
- ✅ **@capacitor/geolocation** - Localização (abastecimento)
- ✅ **@capacitor/preferences** - Storage local
- ✅ **@capacitor/local-notifications** - Notificações de lembrete
- ✅ **@capacitor/device** - Informações do dispositivo

### Exemplo: Usar Câmera

```typescript
import { Camera, CameraResultType } from '@capacitor/camera';

async takePicture() {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Base64
  });
  
  const imageBase64 = image.base64String;
  // Envie para o backend
}
```

---

## 🚀 Próximos Passos

1. ✅ Gerar APK debug
2. ✅ Testar no celular
3. ⬜ Implementar funcionalidades offline (IndexedDB)
4. ⬜ Adicionar splash screen personalizado
5. ⬜ Gerar keystore para produção
6. ⬜ Publicar na Google Play Store

---

## 📞 Comandos Essenciais - Resumo

```bash
# Build completo
npm run build:mobile

# Sincronizar após mudanças
npm run sync:android

# Abrir no Android Studio
npm run open:android

# Build e rodar direto no celular
npm run run:android

# Build manual (linha de comando)
cd android && ./gradlew assembleDebug
```

---

**Pronto! Agora você pode testar o Frota Leve como aplicativo Android! 🎉**
