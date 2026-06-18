# Configuration GitHub Actions — Build & Upload APK

## 1. Créer le workflow

Dans ton repo Android (`mrgamerdu84-ctrl/junkyard-tycoon`), crée ce fichier :

```
.github/workflows/build.yml
```

Colle ce contenu :

```yaml
name: Build & Upload APK
on:
  push:
    branches: [main, master]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"
      - uses: gradle/actions/setup-gradle@v4
      - run: chmod +x ./gradlew
      - run: ./gradlew assembleDebug --no-daemon
      - name: Locate APK
        id: apk
        run: |
          APK=$(find app/build/outputs/apk/debug -name "*.apk" | head -n 1)
          echo "path=$APK" >> "$GITHUB_OUTPUT"
          echo "name=MyTaxiWorldTycoon-debug.apk" >> "$GITHUB_OUTPUT"
      - name: Upload APK
        env:
          UPLOAD_URL: ${{ secrets.UPLOAD_URL }}
          UPLOAD_TOKEN: ${{ secrets.UPLOAD_TOKEN }}
        run: |
          curl -X POST \
            -H "Authorization: Bearer $UPLOAD_TOKEN" \
            -H "Content-Type: application/vnd.android.package-archive" \
            --data-binary "@${{ steps.apk.outputs.path }}" \
            "$UPLOAD_URL?name=${{ steps.apk.outputs.name }}"
```

## 2. Ajouter les secrets GitHub

Va dans ton repo GitHub :

```
https://github.com/mrgamerdu84-ctrl/junkyard-tycoon/settings/secrets/actions
```

Clique sur **New repository secret** et ajoute ces 2 secrets :

| Nom | Valeur |
|-----|--------|
| `UPLOAD_URL` | `https://aljocjqlccsgfnqrsutx.supabase.co/functions/v1/upload-apk` |
| `UPLOAD_TOKEN` | *(la valeur exacte du token que tu as déjà)* |

> Le `UPLOAD_TOKEN` est la même valeur que côté Lovable Cloud secrets. Si tu ne l'as plus, demande-la dans le chat Lovable.

## 3. Pousser du code

```bash
git add .
git commit -m "Ajout workflow GitHub Actions"
git push origin main
```

Le workflow se déclenche **automatiquement** à chaque push sur `main`.

## 4. Vérifier

1. Va dans l'onglet **Actions** de ton repo GitHub
2. Tu verras le workflow "Build & Upload APK" tourner
3. Une fois terminé, l'APK est disponible sur la page `/download` de ton app Lovable

---

## Déclencher manuellement

Si tu veux lancer le workflow sans pousser de code :

1. Onglet **Actions** → **Build & Upload APK**
2. Clique **Run workflow** → **Run workflow**
