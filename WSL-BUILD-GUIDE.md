# 📱 Build APK no WSL (Windows Subsystem for Linux)

## 🎯 Você está no WSL e quer gerar APK Android

Como o Android Studio está no Windows e você desenvolve no WSL, existem **3 formas** de trabalhar:

---

## ✅ **Método 1: Script Automático** (MAIS FÁCIL! 🚀)

Use o script que gera o APK e já copia para Downloads do Windows:

```bash
cd /opt/frota-leve/frontend
./build-apk.sh
```

**O script faz:**
1. ✅ Build do Angular em produção
2. ✅ Sync com Capacitor
3. ✅ Gera APK via Gradle
4. ✅ Copia automaticamente para `C:\Users\SEU_USUARIO\Downloads\frota-leve.apk`

Depois é só transferir o APK para o celular via USB!

---

## ✅ **Método 2: Gradle Manual (Linha de Comando)**

### Passo 1: Instale JDK no WSL

```bash
sudo apt update
sudo apt install openjdk-17-jdk
java -version
```

### Passo 2: Instale Android SDK Command Line Tools

```bash
# Baixe o SDK
cd ~
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
unzip commandlinetools-linux-9477386_latest.zip -d android-sdk

# Configure variáveis de ambiente
echo 'export ANDROID_HOME=$HOME/android-sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc

# Organize a estrutura de pastas
mkdir -p $ANDROID_HOME/cmdline-tools/latest
cd $ANDROID_HOME/cmdline-tools
mv bin lib latest/
cd latest
ls  # Deve mostrar: bin/ lib/

# Instale platform-tools e build-tools
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### Passo 3: Configure SDK no projeto

```bash
cd /opt/frota-leve/frontend/android
echo "sdk.dir=$HOME/android-sdk" > local.properties
```

### Passo 4: Build e gere APK

```bash
cd /opt/frota-leve/frontend
npm run build:mobile

cd android
chmod +x gradlew
./gradlew assembleDebug
```

### Passo 5: Copie APK para Windows

```bash
# Descubra seu usuário Windows
ls /mnt/c/Users/

# Copie o APK (substitua SEU_USUARIO)
cp app/build/outputs/apk/debug/app-debug.apk /mnt/c/Users/SEU_USUARIO/Downloads/frota-leve.apk
```

Agora acesse `C:\Users\SEU_USUARIO\Downloads\frota-leve.apk` no Windows!

---

## ✅ **Método 3: Android Studio no Windows (abrindo pasta WSL)**

### Passo 1: Obtenha caminho Windows da pasta android

```bash
cd /opt/frota-leve/frontend/android
wslpath -w $(pwd)
```

Isso retorna algo como:
```
\\wsl$\Ubuntu\opt\frota-leve\frontend\android
```

### Passo 2: Abra no Android Studio (Windows)

**Opção A - Via Explorer:**
1. Abra Windows Explorer (Win + E)
2. Cole na barra de endereços: `\\wsl$\Ubuntu\opt\frota-leve\frontend\android`
3. Arraste essa pasta para o Android Studio

**Opção B - Diretamente no Android Studio:**
1. Abra Android Studio no Windows
2. File → Open
3. Cole o caminho: `\\wsl$\Ubuntu\opt\frota-leve\frontend\android`
4. Clique em OK

### Passo 3: Build APK no Android Studio

1. Menu: Build → Build Bundle(s) / APK(s) → Build APK(s)
2. Aguarde a compilação (2-5 minutos)
3. APK gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`

### Passo 4: Instale no celular

**Via USB:**
1. Conecte celular via USB
2. Ative "Depuração USB" no celular
3. No Android Studio, clique no botão ▶️ (Run)

**Manual:**
1. Copie `app-debug.apk` para o celular
2. Abra o arquivo no celular e instale

---

## 🔧 Configurar variáveis de ambiente no Android Studio (Windows)

Se o Android Studio no Windows não encontrar o SDK do WSL, configure manualmente:

1. File → Settings → Appearance & Behavior → System Settings → Android SDK
2. Aponte para: `C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk`

---

## 🐛 Troubleshooting

### Erro: "SDK location not found"

**No WSL:**
```bash
cd /opt/frota-leve/frontend/android
echo "sdk.dir=$HOME/android-sdk" > local.properties
```

**No Windows (se usando Android Studio):**
Crie `android/local.properties`:
```
sdk.dir=C:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk
```

### Erro: "Gradle build failed" no WSL

```bash
cd /opt/frota-leve/frontend/android
./gradlew clean
./gradlew assembleDebug --stacktrace
```

### Erro: "Permission denied" ao executar gradlew

```bash
chmod +x /opt/frota-leve/frontend/android/gradlew
```

---

## 📊 Comparação dos Métodos

| Método | Vantagens | Desvantagens |
|--------|-----------|--------------|
| **Script Automático** | ✅ Mais rápido<br>✅ Um comando só<br>✅ Copia automático | ⚠️ Precisa configurar SDK |
| **Gradle Manual** | ✅ Total controle<br>✅ Sem GUI | ⚠️ Precisa instalar SDK<br>⚠️ Mais passos |
| **Android Studio** | ✅ Interface visual<br>✅ Debugger integrado | ⚠️ Mais pesado<br>⚠️ Precisa abrir no Windows |

---

## 🚀 Recomendação para WSL

**Para desenvolvimento rápido:**
```bash
./build-apk.sh
```

**Para debugging avançado:**
Use Android Studio no Windows abrindo `\\wsl$\Ubuntu\opt\frota-leve\frontend\android`

---

## 📱 Instalar APK no celular

### Via USB (ADB do Windows)

1. Instale ADB no Windows: https://developer.android.com/tools/releases/platform-tools
2. Conecte celular via USB
3. No PowerShell (Windows):
   ```powershell
   adb devices
   adb install C:\Users\SEU_USUARIO\Downloads\frota-leve.apk
   ```

### Manual

1. Transfira `frota-leve.apk` para o celular (Google Drive, Bluetooth, USB)
2. Abra o arquivo no celular
3. Permita "Instalar de fontes desconhecidas" se solicitado
4. Instale

---

## ✅ Próximos Passos

Depois de instalar o APK:

1. ✅ Teste login e navegação
2. ✅ Teste funcionalidades offline
3. ⬜ Implemente recursos nativos (câmera para checklist)
4. ⬜ Configure notificações locais
5. ⬜ Gere APK release assinado para publicar

---

**Pronto! Agora você consegue gerar APK mesmo no WSL! 🎉**
