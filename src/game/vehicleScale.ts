// Échelle visuelle commune appliquée aux véhicules pour qu'ils gardent une
// taille écran cohérente quel que soit le format du conteneur (téléphone
// portrait, paysage, plein écran). Mise à jour par TaxiTycoon via un
// ResizeObserver. Lue par les calques SVG imperatifs (CityTraffic,
// CityRivalTaxis, ArmoredTruck, EmergencyStations) à chaque frame.
let scale = 1;
export function setVehicleScale(s: number) { scale = s; }
export function getVehicleScale(): number { return scale; }
