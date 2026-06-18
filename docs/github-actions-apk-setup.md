# 🚀 Build automatique de l'APK (GitHub Actions)

Ce workflow compile **automatiquement** ton APK Android natif à chaque push,
puis le pousse dans le bucket `apks` de Lovable Cloud. La page `/download` du
jeu sert toujours le dernier APK : **aucun upload manuel quotidien**.

L'upload manuel reste possible via le panneau admin (5 taps sur le titre de
l'accueil) si tu dois corriger un bug en urgence depuis Android Studio.

---

## 📦 Où placer ce fichier

`.github/workflows/build-and-upload-apk.yml` doit aller dans le **repo
GitHub de ton projet Android Studio natif** — **pas** dans le repo de l'app
web Lovable.

Si ton projet Android Studio n'est pas encore sur GitHub :
1. Sur GitHub, crée un nouveau repo (`my-taxi-world-tycoon-android`).
2. Dans Android Studio : `VCS → Share Project on GitHub`.
3. Copie le dossier `.github/workflows/` de ce projet web dans le repo Android.

---

## 🔑 Secrets GitHub à ajouter

Dans ton repo Android sur GitHub :
**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valeur |
|---|---|
| `SUPABASE_URL` | L'URL Lovable Cloud (visible dans le `.env` de ton projet web Lovable : `VITE_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Sur Lovable Cloud cette clé n'est **pas exposée**. Pour automatiser l'upload, tu dois soit (a) utiliser un projet Supabase autonome, soit (b) créer une edge function publique qui accepte l'upload avec un token partagé. Voir section dédiée plus bas. |
| `KEYSTORE_BASE64` | Ton keystore release encodé en base64 — voir ci-dessous |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_ALIAS` | Alias de la clé |
| `KEY_PASSWORD` | Mot de passe de la clé |

### Encoder le keystore en base64

```bash
# macOS / Linux
base64 -i release.keystore | pbcopy   # macOS (copie dans le presse-papier)
base64 -w 0 release.keystore          # Linux (affichage)

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) | Set-Clipboard
```

Colle le résultat dans le secret `KEYSTORE_BASE64`.

---

## 🛠️ Configurer Gradle pour la signature

Dans `app/build.gradle` (ou `build.gradle.kts`), ajoute :

```groovy
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
            keyAlias System.getenv("KEY_ALIAS") ?: ""
            keyPassword System.getenv("KEY_PASSWORD") ?: ""
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## ⚠️ Cas Lovable Cloud : pas de service role key exposée

Lovable Cloud ne donne pas accès à `SUPABASE_SERVICE_ROLE_KEY`. Deux options :

### Option 1 — Edge function de réception (recommandée)
Crée une edge function publique dans le projet web Lovable, qui :
- vérifie un token partagé (`UPLOAD_TOKEN`, défini en secret runtime côté Lovable et en secret GitHub côté workflow),
- reçoit le fichier `.apk` en `multipart/form-data` ou `binary`,
- l'upload dans le bucket `apks` côté serveur (avec la service role key disponible automatiquement dans l'edge function).

Dans le workflow, remplace l'étape "Upload APK" par un POST vers
`https://<ton-projet>.lovable.app/api/public/upload-apk` avec l'en-tête
`Authorization: Bearer <UPLOAD_TOKEN>`.

Dis-moi si tu veux que je code cette edge function — c'est ~30 lignes.

### Option 2 — Bucket Supabase autonome
Crée un projet Supabase classique (gratuit), récupère sa `service_role_key`,
et utilise-le uniquement pour héberger les APK. La page `/download` doit
alors pointer vers ce projet (modifier `BUCKET` et le client storage).

---

## ✅ Vérifier que ça marche

1. Push n'importe quel commit sur la branche `main` du repo Android.
2. Onglet **Actions** sur GitHub → tu vois le job tourner (~5-10 min).
3. À la fin : le nouveau `MyTaxiWorldTycoon.apk` est dans le bucket.
4. Recharge `/download` dans le jeu → la date "Mise à jour" est à jour.

L'APK build est aussi téléchargeable depuis l'onglet **Actions → Artifacts**
en cas de pépin (utile pour debug).
