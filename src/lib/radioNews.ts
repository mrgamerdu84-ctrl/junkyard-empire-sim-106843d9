// Petites brèves diffusées par la "Radio Junky Empire Taxi" du taxi.
// Chaque news est fournie en plusieurs langues. La radio choisit la bonne
// version selon la préférence joueur (localStorage "mttw.lang").

export type RadioNews = {
  fr: string;
  en: string;
};

const EVENT = "jce:radio-news";

export function pushNews(news: RadioNews) {
  try {
    window.dispatchEvent(new CustomEvent<RadioNews>(EVENT, { detail: news }));
  } catch {
    // SSR / pas de window — ignore
  }
}

export const RADIO_NEWS_EVENT = EVENT;

// Jingle de bienvenue (joué à l'ouverture de la radio infos)
export const WELCOME_JINGLE: RadioNews = {
  fr: "Bienvenue dans la radio Junky Empire Taxi, votre radio préférée au volant !",
  en: "Welcome to Junky Empire Taxi Radio, your favorite radio behind the wheel!",
};

// Brèves d'ambiance — météo, événements de la ville, animations.
// Le DJ alterne entre ces brèves quand il ne se passe rien.
export const AMBIENT_NEWS: RadioNews[] = [
  {
    fr: "Vous écoutez Junky Empire Taxi, la radio qui roule avec vous !",
    en: "You're listening to Junky Empire Taxi, the radio that rides with you!",
  },
  {
    fr: "Météo du jour : grand ciel bleu sur toute la ville, parfait pour enchaîner les courses.",
    en: "Today's weather: clear blue skies over the city, perfect for back-to-back rides.",
  },
  {
    fr: "Info circulation : trafic fluide en centre-ville, attention aux radars sur l'avenue principale.",
    en: "Traffic update: smooth flow downtown, watch out for speed cameras on the main avenue.",
  },
  {
    fr: "Événement de l'été : grand festival en plein air ce week-end, attendez-vous à beaucoup de clients !",
    en: "Summer event: big open-air festival this weekend, expect lots of fares!",
  },
  {
    fr: "Bulletin météo : nuit étoilée cette nuit, idéale pour les courses de nuit bien payées.",
    en: "Weather report: starry night tonight, perfect for well-paid night rides.",
  },
  {
    fr: "Côté vie locale : le maire annonce des travaux de rénovation grâce à la caisse de la ville.",
    en: "Local news: the mayor announces renovation works funded by the city treasury.",
  },
  {
    fr: "Conseil prudence : bouclez votre ceinture, respectez les feux, et évitez les radars.",
    en: "Safety tip: buckle up, respect the lights, and avoid the cameras.",
  },
  {
    fr: "Météo : averses possibles en fin d'après-midi, prudence sur la chaussée mouillée.",
    en: "Weather: scattered showers expected late afternoon, careful on wet roads.",
  },
  {
    fr: "Événement : marché de nuit ce soir près du port, beaucoup de monde à transporter.",
    en: "Event: night market tonight near the harbor, lots of people to drive around.",
  },
  {
    fr: "Bonne course à tous les chauffeurs, et roulez prudemment.",
    en: "Have a great shift drivers, and drive safely.",
  },
  {
    fr: "Été en ville : températures douces et soleil généreux, les terrasses sont pleines.",
    en: "Summer in the city: mild temperatures and bright sun, terraces are packed.",
  },
  {
    fr: "Flash info : la compagnie rivale tente de débaucher nos clients, restons vigilants !",
    en: "News flash: the rival company is trying to poach our riders, stay sharp!",
  },
];
