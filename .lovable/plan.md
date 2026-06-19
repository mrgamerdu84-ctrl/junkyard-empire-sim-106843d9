Plan de réparation

1. Restaurer le panel admin dans le jeu
- Rendre le bouton admin toujours visible en jeu, avec une position compatible mobile/encoche et un z-index au-dessus du HUD.
- Corriger le déverrouillage avec le mot de passe admin déjà fourni, en stockant seulement son hash dans le code.
- Faire en sorte que l’accès admin reste mémorisé localement, pour éviter qu’il “disparaisse” à chaque session.
- Garder le panneau dans le jeu, sans dépendre d’un écran Android Studio ou d’un compte non reconnu.

2. Remettre la voiture de police et les contrôles véhicules
- Rebrancher le vrai sprite `police-car-top.png` au lieu du taxi noir utilisé actuellement.
- Ajouter dans le panel admin un réglage “voitures de police” pour pouvoir remettre/retirer les voitures de police.
- Garder le réglage existant des véhicules civils et vérifier qu’il agit bien sur le trafic.
- Vérifier que les voitures ajoutées via les skins utilisent le bon sens de rotation sur la route.

3. Corriger l’orientation des voitures
- Centraliser la logique de rotation des sprites top-down : taxis, voitures civiles, police.
- Corriger les cas où un véhicule roule dans le sens inverse d’un chemin pour éviter qu’il avance “à reculons”.
- Contrôler visuellement en preview que la police, les taxis et les civils pointent vers leur direction de déplacement.

4. Réparer Android / GitHub Actions
- Corriger le workflow GitHub pour installer/configurer explicitement le SDK Android nécessaire avant `cap sync android` et la compilation Gradle.
- Rendre l’étape `cap sync android` plus fiable avec les dossiers requis et des sorties d’erreur plus lisibles.
- Vérifier la cohérence JDK/Gradle/Android SDK/Capacitor pour éviter les “introuvables” dans Android Studio.
- Garder le mode APK actuel qui charge l’app publiée en HTTPS, mais s’assurer que le stub web existe bien pour Capacitor.

5. Restaurer l’icône Android
- Vérifier les ressources `ic_launcher` et `ic_launcher_round`.
- Remettre une icône personnalisée du jeu dans les dossiers Android au lieu d’une icône par défaut ou cassée.
- Garder le nom d’application “Junky City Empire”.

6. Vérification finale
- Tester l’ouverture du jeu en preview.
- Tester l’apparition du bouton admin, l’ouverture du panel et les onglets véhicules/skins.
- Vérifier que la police apparaît et roule dans le bon sens.
- Vérifier que la configuration Android est complète pour la synchronisation GitHub/Android Studio.

Note : si GitHub échoue encore après ces corrections, il faudra le log complet de l’étape rouge, car le message actuel est tronqué.