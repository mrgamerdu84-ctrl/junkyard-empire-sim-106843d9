// Campagne narrative "La Renaissance de Taxi Co."
// Données statiques : 3 actes, 12 chapitres, épilogue.
// N'affecte AUCUN gameplay existant — c'est purement narratif + missions dédiées.

export type CampaignMission = {
  id: string;
  title: string;
  hint?: string;
};

export type CampaignChoice = {
  id: string;
  label: string;
  description: string;
};

export type CampaignChapter = {
  id: string;
  actId: "I" | "II" | "III" | "EPILOGUE";
  number: number;
  title: string;
  subtitle?: string;
  narrative: string[]; // paragraphes affichés au lancement du chapitre
  missions: CampaignMission[];
  // Un chapitre peut demander un choix pour se conclure
  choice?: {
    id: "chap6" | "chap11";
    prompt: string;
    options: CampaignChoice[];
  };
};

export type CampaignAct = {
  id: "I" | "II" | "III" | "EPILOGUE";
  title: string;
  tagline: string;
};

export const ACTS: CampaignAct[] = [
  { id: "I", title: "Acte I — La Renaissance", tagline: "Le retour aux sources." },
  { id: "II", title: "Acte II — L'Empire du Baron", tagline: "Chaque entreprise a un prix." },
  { id: "III", title: "Acte III — La Guerre des Empires", tagline: "L'heure des comptes." },
  { id: "EPILOGUE", title: "Épilogue — Un nouvel empire", tagline: "Mode Empire déverrouillé." },
];

export const CHAPTERS: CampaignChapter[] = [
  // ---------- ACTE I ----------
  {
    id: "ch1",
    actId: "I",
    number: 1,
    title: "Le Retour",
    subtitle: "Rachat du dépôt familial",
    narrative: [
      "Après plusieurs années loin de la ville, tu franchis à nouveau les grilles rouillées de l'entrepôt familial.",
      "L'odeur d'huile, la poussière sur les fenêtres… et dans un coin, le dernier taxi jaune de Taxi Co., recouvert d'une bâche.",
      "Sur le bureau du père, un carnet noir. Il est temps de remettre l'entreprise sur pied.",
    ],
    missions: [
      { id: "m1a", title: "Prendre possession du dépôt", hint: "Entrer dans l'entrepôt familial." },
      { id: "m1b", title: "Nettoyer la cour", hint: "Dégager les caisses et débris." },
      { id: "m1c", title: "Réparer le taxi de ton père", hint: "Le vieux Ford jaune." },
      { id: "m1d", title: "Effectuer la première course", hint: "Un client attend déjà au coin de la rue." },
    ],
  },
  {
    id: "ch2",
    actId: "I",
    number: 2,
    title: "La Reconstruction",
    subtitle: "Marcel revient au garage",
    narrative: [
      "Marcel, ancien mécano de ton père, pousse la porte du dépôt. « J'ai toujours su que tu reviendrais. »",
      "Ensemble, vous allez rendre à l'atelier son ancienne splendeur.",
    ],
    missions: [
      { id: "m2a", title: "Réparer le portail" },
      { id: "m2b", title: "Rétablir l'électricité" },
      { id: "m2c", title: "Rénover le premier atelier" },
      { id: "m2d", title: "Acheter un deuxième taxi" },
    ],
  },
  {
    id: "ch3",
    actId: "I",
    number: 3,
    title: "Les Premiers Indices",
    subtitle: "La cassette et la clé B-12",
    narrative: [
      "Les anciens du quartier parlent à voix basse du passé de Taxi Co.",
      "Dans un tiroir du bureau : une cassette audio de ton père. Et une clé étrange gravée « B-12 ».",
    ],
    missions: [
      { id: "m3a", title: "Retrouver la cassette" },
      { id: "m3b", title: "Explorer le bureau du père" },
      { id: "m3c", title: "Découvrir la clé B-12" },
    ],
  },
  {
    id: "ch4",
    actId: "I",
    number: 4,
    title: "L'Invitation",
    subtitle: "Le Baron t'a remarqué",
    narrative: [
      "Une enveloppe noire scellée à la cire rouge est glissée sous la porte du dépôt.",
      "« Le Baron souhaite te rencontrer. »",
    ],
    missions: [
      { id: "m4a", title: "Lire la lettre du Baron" },
      { id: "m4b", title: "Décider : accepter ou repousser le rendez-vous" },
      { id: "m4c", title: "Continuer à développer Taxi Co." },
    ],
  },

  // ---------- ACTE II ----------
  {
    id: "ch5",
    actId: "II",
    number: 5,
    title: "La Rencontre",
    subtitle: "Face au Baron",
    narrative: [
      "Un restaurant discret, éclairé aux bougies. Le Baron t'attend, un verre à la main.",
      "« Chaque entreprise a un prix, mon ami. Voyons quel est le tien. »",
    ],
    missions: [
      { id: "m5a", title: "Se rendre au rendez-vous" },
      { id: "m5b", title: "Dialoguer avec le Baron" },
      { id: "m5c", title: "Faire un premier choix" },
    ],
  },
  {
    id: "ch6",
    actId: "II",
    number: 6,
    title: "Les Contrats",
    subtitle: "Réputation en jeu",
    narrative: [
      "Des propositions arrivent : livraisons légitimes, mais aussi des « courses spéciales » à ne poser aucune question.",
      "Chaque signature façonne la réputation de Taxi Co.",
    ],
    missions: [
      { id: "m6a", title: "Signer ou refuser les contrats" },
      { id: "m6b", title: "Développer Taxi Co." },
      { id: "m6c", title: "Gérer la réputation" },
    ],
    choice: {
      id: "chap6",
      prompt: "Quelle voie choisis-tu pour Taxi Co. ?",
      options: [
        { id: "honnete", label: "Rester intègre", description: "Refuser les contrats douteux. Croissance lente mais réputation solide." },
        { id: "opportuniste", label: "Jouer sur les deux tableaux", description: "Accepter quelques contrats gris. Argent rapide, risques accrus." },
        { id: "corrompu", label: "S'allier au Baron", description: "Signer tout. Fortune assurée, mais l'ombre s'installe." },
      ],
    },
  },
  {
    id: "ch7",
    actId: "II",
    number: 7,
    title: "Les Premières Menaces",
    subtitle: "Sabotages et pressions",
    narrative: [
      "Un taxi retrouvé pneus crevés. Un autre incendié devant le dépôt.",
      "Deux chauffeurs remettent leur démission le même jour, la peur dans les yeux.",
    ],
    missions: [
      { id: "m7a", title: "Réparer les véhicules sabotés" },
      { id: "m7b", title: "Rassurer les chauffeurs" },
      { id: "m7c", title: "Renforcer la sécurité du dépôt" },
    ],
  },
  {
    id: "ch8",
    actId: "II",
    number: 8,
    title: "Le Secret du dépôt B-12",
    subtitle: "Ce que le père cachait",
    narrative: [
      "La clé B-12 ouvre un vieux hangar oublié du côté des docks.",
      "À l'intérieur : des cartons de documents, des photos… et un dossier au nom du Baron.",
    ],
    missions: [
      { id: "m8a", title: "Ouvrir le dépôt B-12" },
      { id: "m8b", title: "Explorer les lieux" },
      { id: "m8c", title: "Récupérer les dossiers" },
    ],
  },

  // ---------- ACTE III ----------
  {
    id: "ch9",
    actId: "III",
    number: 9,
    title: "Les Trahisons",
    subtitle: "Un ami de la famille",
    narrative: [
      "En croisant les documents, un nom revient : celui d'un ancien associé du père, présent à tous les enterrements, à tous les anniversaires.",
      "Il a trahi Taxi Co. de l'intérieur.",
    ],
    missions: [
      { id: "m9a", title: "Identifier le traître" },
      { id: "m9b", title: "Choisir : justice ou pardon" },
    ],
  },
  {
    id: "ch10",
    actId: "III",
    number: 10,
    title: "Le Dossier du Père",
    subtitle: "Un réseau qui dépasse la ville",
    narrative: [
      "Les preuves impliquent conseillers municipaux, chefs de police et hommes d'affaires.",
      "Un journaliste indépendant accepte de te rencontrer — mais quelqu'un pourrait vouloir enterrer l'affaire avant.",
    ],
    missions: [
      { id: "m10a", title: "Rassembler toutes les preuves" },
      { id: "m10b", title: "Rencontrer le journaliste" },
      { id: "m10c", title: "Protéger les documents" },
    ],
  },
  {
    id: "ch11",
    actId: "III",
    number: 11,
    title: "Le Choix",
    subtitle: "Trois issues possibles",
    narrative: [
      "L'étau se resserre. Tu tiens dans ta main de quoi faire trembler la ville — ou de quoi la protéger en silence.",
      "Quelle sera ta décision ?",
    ],
    missions: [
      { id: "m11a", title: "Prendre une décision définitive" },
    ],
    choice: {
      id: "chap11",
      prompt: "Comment vas-tu conclure cette guerre ?",
      options: [
        { id: "autorites", label: "Collaborer avec les autorités", description: "Tout révéler. Le Baron est arrêté publiquement." },
        { id: "seul", label: "Régler le conflit seul", description: "Affronter le Baron sans intermédiaire. Le prix est lourd." },
        { id: "silence", label: "Sauver l'entreprise sans tout révéler", description: "Négocier dans l'ombre. Taxi Co. survit, la vérité s'endort." },
      ],
    },
  },
  {
    id: "ch12",
    actId: "III",
    number: 12,
    title: "Le Baron",
    subtitle: "Face-à-face final",
    narrative: [
      "Sur les toits du vieux port, le vent siffle. Le Baron te fait face, calme, presque amusé.",
      "L'issue dépend de tout ce que tu as fait jusqu'ici.",
    ],
    missions: [
      { id: "m12a", title: "Confronter le Baron" },
      { id: "m12b", title: "Déterminer l'avenir de Taxi Co." },
    ],
  },

  // ---------- ÉPILOGUE ----------
  {
    id: "epilogue",
    actId: "EPILOGUE",
    number: 13,
    title: "Un nouvel empire",
    subtitle: "Mode Empire déverrouillé",
    narrative: [
      "La poussière retombe sur la ville. Taxi Co. est désormais un nom que l'on prononce avec respect.",
      "Un nouveau mode s'ouvre à toi : le Mode Empire. Achète de nouveaux dépôts, étends ta flotte, déploie VTC, limousines, navettes aéroport et minibus.",
      "L'histoire continue — et cette fois, tu tiens le volant.",
    ],
    missions: [
      { id: "mEa", title: "Acheter un nouveau dépôt (Mode Empire)" },
      { id: "mEb", title: "Recruter une deuxième équipe" },
      { id: "mEc", title: "Débloquer un véhicule spécial" },
    ],
  },
];

export function getChapter(id: string) {
  return CHAPTERS.find((c) => c.id === id);
}

export function getChapterByIndex(i: number) {
  return CHAPTERS[i];
}
