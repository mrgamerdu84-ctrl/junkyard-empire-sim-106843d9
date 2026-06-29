import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminConfig } from "./adminConfig";
import { getPedestrianPhotoUrls, listCustomVehicles, getCivilCarUrls, type CustomVehicleCategory } from "./gameAssets";
import { VehicleSvg, type VehicleSvgKind } from "./vehicles/VehicleSvgs";
import {
  initTrafficLights,
  getTrafficLights,
  getLightState,
  nowSeconds,
  type TrafficLight,
} from "./trafficLights";
import { getGameTime } from "./cityClock";
import { densityMult, isUltraLite, perfTier, reduceMotion, targetFps, trafficBudget } from "@/lib/perf";
import { buildRoadCache, getRoadPoint, hasRoadCache, type CachedRoad } from "./RoadCache";


// Dynamique : inclut les piétons custom uploadés via le panel admin.
// Recalculé à chaque appel — les composants qui en dépendent écoutent
// 'jce.customPedestrians.changed' pour re-render.
const getPedPhotoImages = () => getPedestrianPhotoUrls();

// Plus aucun path n'est interdit : toutes les routes de la map sont utilisées
// par le trafic civil, les courses taxi et les concurrents. On conserve
// l'export pour la compat avec TaxiTycoon (qui filtre via cet ensemble).
// Index 1 = petite arche tout en haut (y≈0-90) : off-screen en portrait,
// les voitures semblaient "voler". On l'exclut du trafic et on ne la
// dessine plus comme route (ci-dessous dans le rendu).
export const VILLAGE_PATHS = new Set<number>([1]);

// === SÉPARATION DES VOIES (code de la route) ===
// Demi-largeur d'une route ≈ 23 px. On place chaque véhicule à LANE_HALF px
// du centre, à DROITE de son sens de marche. Les véhicules en sens inverse
// se retrouvent donc de l'autre côté du centre → voies séparées strictes,
// plus aucun contre-sens visuel.
// Demi-largeur d'une route principale ≈ 23 px (stroke 46). Chaque voie
// tient ~11 px de chaque côté de l'axe → LANE_HALF=11 place les véhicules
// pile au milieu de leur voie, sans déborder sur la voie d'en face.
const LANE_HALF = 11;

/* eslint-disable prettier/prettier */

/* ============================================================
 * JUNKY CITY EMPIRE — overlay aligné sur citymap.jpg
 * IMPORTANT : le SVG utilise le même ratio que l'image 1920x1080.
 * Avec preserveAspectRatio="xMidYMid slice", les voitures restent
 * calées sur les routes même en mobile recadré.
 * ============================================================ */

// Trajectoires auto-calibrées : extraites par squelettisation du masque
// asphalte de citymap.jpg (1920x1080), simplifiées en courbes quadratiques.
// Chaque path suit STRICTEMENT le bitume visible — aucune sortie sur
// chantiers, parkings, toits ou bâtiments.
export const ROADS = [
  "M 1917.0 46.0 C 1916.0 47.4 1914.1 50.2 1911.2 54.5 C 1908.4 58.8 1904.2 66.4 1899.8 71.5 C 1895.3 76.6 1890.2 81.1 1884.5 85.0 C 1878.8 88.9 1871.8 91.8 1865.5 95.0 C 1859.2 98.2 1852.8 101.4 1846.5 104.5 C 1840.2 107.6 1833.8 110.5 1827.5 113.5 C 1821.2 116.5 1815.0 119.6 1808.8 122.8 C 1802.5 125.9 1796.5 129.1 1790.2 132.2 C 1784.0 135.4 1777.8 138.6 1771.5 141.8 C 1765.2 144.9 1758.8 148.1 1752.5 151.2 C 1746.2 154.4 1739.8 157.6 1733.5 160.8 C 1727.2 163.9 1720.6 166.8 1714.5 170.2 C 1708.4 173.7 1702.6 177.3 1697.0 181.2 C 1691.4 185.2 1686.7 190.2 1681.0 193.8 C 1675.3 197.3 1669.2 200.2 1662.8 202.5 C 1656.3 204.8 1648.9 205.4 1642.2 207.5 C 1635.6 209.6 1629.1 212.1 1622.8 215.0 C 1616.4 217.9 1610.5 221.7 1604.2 225.0 C 1598.0 228.3 1591.8 231.7 1585.5 235.0 C 1579.2 238.3 1572.8 241.7 1566.5 245.0 C 1560.2 248.3 1553.8 251.5 1547.5 254.8 C 1541.2 258.0 1534.8 261.1 1528.5 264.2 C 1522.2 267.4 1515.8 270.6 1509.5 273.8 C 1503.2 276.9 1496.8 280.0 1490.5 283.2 C 1484.2 286.5 1478.0 289.7 1471.8 293.0 C 1465.5 296.3 1459.5 299.8 1453.2 303.0 C 1447.0 306.2 1440.8 309.4 1434.5 312.5 C 1428.2 315.6 1421.9 318.7 1415.5 321.5 C 1409.1 324.3 1402.7 327.0 1396.2 329.5 C 1389.8 332.0 1382.9 333.7 1376.8 336.5 C 1370.6 339.3 1364.8 342.5 1359.2 346.2 C 1353.8 350.0 1349.1 354.8 1343.8 358.8 C 1338.4 362.8 1332.8 366.6 1327.0 370.2 C 1321.2 373.9 1315.1 377.4 1309.0 380.8 C 1302.9 384.1 1296.8 387.4 1290.5 390.5 C 1284.2 393.6 1277.8 396.4 1271.5 399.5 C 1265.2 402.6 1259.0 405.8 1252.8 409.0 C 1246.5 412.2 1240.5 415.7 1234.2 419.0 C 1228.0 422.3 1221.8 425.7 1215.5 429.0 C 1209.2 432.3 1202.8 435.7 1196.5 439.0 C 1190.2 442.3 1183.8 445.5 1177.5 448.8 C 1171.2 452.0 1164.9 455.5 1158.5 458.2 C 1152.1 461.0 1145.6 463.2 1139.0 465.0 C 1132.4 466.8 1125.2 466.6 1119.0 469.0 C 1112.8 471.4 1107.0 474.8 1101.8 479.2 C 1096.5 483.7 1092.2 492.1 1087.2 495.8 C 1082.3 499.4 1077.2 501.1 1072.0 501.0 C 1066.8 500.9 1061.2 497.5 1056.0 495.0 C 1050.8 492.5 1045.6 489.4 1040.5 485.8 C 1035.4 482.1 1031.0 476.7 1025.5 473.2 C 1020.0 469.8 1013.9 467.2 1007.2 465.2 C 1000.6 463.3 993.0 462.7 985.8 461.8 C 978.5 460.8 971.2 460.2 963.8 459.8 C 956.3 459.3 948.8 459.4 941.2 459.2 C 933.8 459.1 926.2 459.0 918.8 459.0 C 911.2 459.0 903.7 458.8 896.2 459.0 C 888.8 459.2 881.5 459.8 874.2 460.5 C 867.0 461.2 859.3 461.6 852.8 463.5 C 846.2 465.4 840.2 468.2 834.8 472.0 C 829.3 475.8 825.2 481.4 820.2 486.0 C 815.3 490.6 810.2 495.1 805.0 499.5 C 799.8 503.9 793.4 507.5 789.0 512.5 C 784.6 517.5 781.1 523.2 778.5 529.5 C 775.9 535.8 776.2 544.2 773.5 550.5 C 770.8 556.8 767.0 562.4 762.2 567.2 C 757.5 572.1 750.1 575.2 744.8 579.8 C 739.4 584.2 734.6 589.1 730.2 594.2 C 725.9 599.4 723.2 605.9 718.8 610.8 C 714.3 615.6 709.2 619.9 703.5 623.5 C 697.8 627.1 690.8 629.4 684.5 632.5 C 678.2 635.6 671.8 638.8 665.5 642.0 C 659.2 645.2 652.8 648.7 646.5 652.0 C 640.2 655.3 633.8 658.7 627.5 662.0 C 621.2 665.3 614.7 668.5 608.5 672.0 C 602.3 675.5 596.2 679.0 590.2 682.8 C 584.3 686.5 578.8 690.8 572.8 694.2 C 566.8 697.8 560.6 700.9 554.2 703.8 C 547.9 706.6 541.2 708.8 534.8 711.2 C 528.2 713.8 521.8 716.2 515.2 718.8 C 508.8 721.2 502.2 723.6 495.8 726.2 C 489.3 728.9 482.9 731.6 476.5 734.5 C 470.1 737.4 463.8 740.5 457.5 743.5 C 451.2 746.5 444.8 749.6 438.5 752.8 C 432.2 755.9 425.8 759.0 419.5 762.2 C 413.2 765.5 407.0 768.7 400.8 772.0 C 394.5 775.3 388.4 778.7 382.2 782.0 C 376.1 785.3 369.9 788.7 363.8 792.0 C 357.6 795.3 351.5 798.7 345.2 802.0 C 339.0 805.3 332.8 808.5 326.5 811.8 C 320.2 815.0 313.8 818.1 307.5 821.2 C 301.2 824.4 295.1 827.5 289.0 830.5 C 282.9 833.5 277.0 836.4 271.0 839.5 C 265.0 842.6 259.0 845.8 253.0 849.0 C 247.0 852.2 241.1 855.7 235.0 859.0 C 228.9 862.3 222.8 865.5 216.5 868.8 C 210.2 872.0 203.8 875.0 197.5 878.2 C 191.2 881.5 185.0 884.7 178.8 888.0 C 172.5 891.3 166.5 894.7 160.2 898.0 C 154.0 901.3 147.8 904.5 141.5 907.8 C 135.2 911.0 128.8 914.0 122.5 917.2 C 116.2 920.5 110.0 923.7 103.8 927.0 C 97.5 930.3 91.4 933.6 85.2 937.0 C 79.1 940.4 72.9 943.8 66.8 947.2 C 60.6 950.7 54.1 954.0 48.2 957.8 C 42.4 961.5 36.8 965.4 31.5 969.5 C 26.2 973.6 20.6 978.5 16.5 982.5 C 12.4 986.5 9.2 990.2 7.0 993.5 C 4.8 996.8 4.0 1000.2 3.0 1002.5 C 2.0 1004.8 1.3 1006.2 1.0 1007.0",
  "M 759.0 1.0 C 757.4 1.7 754.2 3.1 749.5 5.2 C 744.8 7.4 735.8 10.0 730.5 13.8 C 725.2 17.5 721.0 22.0 717.8 27.5 C 714.5 33.0 713.6 40.2 711.2 46.5 C 708.9 52.8 706.3 58.9 703.5 65.0 C 700.7 71.1 698.2 78.9 694.5 83.0 C 690.8 87.1 686.2 89.2 681.0 89.5 C 675.8 89.8 668.2 86.6 663.0 84.5 C 657.8 82.4 653.5 79.9 650.0 77.0 C 646.5 74.1 644.0 71.0 642.0 67.0 C 640.0 63.0 638.7 58.3 638.0 53.0 C 637.3 47.7 637.0 40.4 638.0 35.0 C 639.0 29.6 640.9 24.9 643.8 20.8 C 646.6 16.6 652.0 13.1 655.2 10.2 C 658.5 7.4 661.2 5.2 663.2 3.8 C 665.3 2.2 666.6 1.9 667.8 1.2 C 668.9 0.6 669.6 0.2 670.0 0.0",
  "M 1898.0 1078.0 C 1896.3 1077.6 1892.9 1076.8 1887.8 1075.5 C 1882.6 1074.2 1874.1 1072.2 1867.2 1070.5 C 1860.4 1068.8 1853.6 1067.2 1846.8 1065.5 C 1839.9 1063.8 1833.1 1062.1 1826.2 1060.5 C 1819.4 1058.9 1812.5 1057.3 1805.5 1055.8 C 1798.5 1054.2 1791.4 1052.9 1784.5 1051.2 C 1777.6 1049.6 1770.8 1047.8 1764.0 1045.8 C 1757.2 1043.8 1750.5 1041.8 1744.0 1039.2 C 1737.5 1036.7 1731.2 1033.8 1725.0 1030.5 C 1718.8 1027.2 1713.0 1023.2 1707.0 1019.5 C 1701.0 1015.8 1695.0 1012.0 1689.0 1008.2 C 1683.0 1004.5 1677.0 1000.6 1671.0 996.8 C 1665.0 992.9 1659.0 989.1 1653.0 985.2 C 1647.0 981.4 1641.0 977.5 1635.0 973.8 C 1629.0 970.0 1623.0 966.2 1617.0 962.5 C 1611.0 958.8 1605.0 955.2 1599.0 951.5 C 1593.0 947.8 1587.0 944.2 1581.0 940.5 C 1575.0 936.8 1569.0 933.2 1563.0 929.5 C 1557.0 925.8 1550.9 922.2 1544.8 918.5 C 1538.6 914.8 1532.3 911.2 1526.2 907.5 C 1520.2 903.8 1514.2 900.2 1508.2 896.5 C 1502.3 892.8 1496.6 889.2 1490.8 885.5 C 1484.9 881.8 1479.0 878.0 1473.0 874.2 C 1467.0 870.5 1461.0 866.5 1455.0 862.8 C 1449.0 859.0 1442.9 855.2 1436.8 851.5 C 1430.6 847.8 1424.4 844.2 1418.2 840.5 C 1412.1 836.8 1406.0 833.2 1400.0 829.5 C 1394.0 825.8 1388.0 822.2 1382.0 818.5 C 1376.0 814.8 1369.9 811.2 1363.8 807.5 C 1357.6 803.8 1351.3 800.1 1345.2 796.5 C 1339.2 792.9 1333.2 789.3 1327.2 785.8 C 1321.3 782.2 1315.5 778.9 1309.8 775.2 C 1304.0 771.6 1298.5 767.8 1293.0 763.8 C 1287.5 759.8 1282.6 755.1 1277.0 751.2 C 1271.4 747.4 1265.6 743.9 1259.5 740.8 C 1253.4 737.6 1246.8 735.3 1240.5 732.2 C 1234.2 729.2 1228.1 725.8 1222.0 722.2 C 1215.9 718.7 1210.0 714.5 1204.0 710.8 C 1198.0 707.0 1192.0 703.3 1186.0 699.8 C 1180.0 696.2 1174.1 692.5 1168.0 689.2 C 1161.9 686.0 1155.6 683.1 1149.2 680.5 C 1142.9 677.9 1136.4 675.2 1129.8 673.5 C 1123.1 671.8 1116.4 670.8 1109.5 670.5 C 1102.6 670.2 1095.2 672.3 1088.5 671.5 C 1081.8 670.7 1075.5 668.8 1069.5 665.8 C 1063.5 662.7 1058.2 657.2 1052.5 653.2 C 1046.8 649.3 1040.9 645.5 1035.0 642.0 C 1029.1 638.5 1023.3 634.4 1017.0 632.0 C 1010.7 629.6 1004.1 628.2 997.2 627.8 C 990.4 627.3 983.0 629.0 975.8 629.2 C 968.5 629.5 961.3 629.5 954.0 629.2 C 946.7 629.0 939.3 628.3 932.0 627.8 C 924.7 627.2 917.3 626.6 910.0 626.0 C 902.7 625.4 895.3 624.7 888.0 624.0 C 880.7 623.3 873.5 622.7 866.2 622.0 C 859.0 621.3 851.6 619.4 844.8 620.0 C 837.9 620.6 831.4 622.4 825.2 625.5 C 819.1 628.6 813.6 634.7 807.8 638.5 C 801.9 642.3 796.0 645.5 790.0 648.2 C 784.0 651.0 778.1 652.4 772.0 654.8 C 765.9 657.1 759.8 659.6 753.5 662.2 C 747.2 664.9 740.8 667.8 734.5 670.8 C 728.2 673.7 721.8 676.7 715.5 679.8 C 709.2 682.8 702.8 686.1 696.5 689.2 C 690.2 692.4 683.8 695.6 677.5 698.8 C 671.2 701.9 664.8 705.0 658.5 708.2 C 652.2 711.5 646.0 714.7 639.8 718.0 C 633.5 721.3 627.4 724.7 621.2 728.0 C 615.1 731.3 608.9 734.7 602.8 738.0 C 596.6 741.3 590.5 744.7 584.2 748.0 C 578.0 751.3 571.8 754.5 565.5 757.8 C 559.2 761.0 553.1 764.7 546.5 767.2 C 539.9 769.8 533.1 771.7 526.0 773.0 C 518.9 774.3 510.9 773.5 504.0 775.0 C 497.1 776.5 490.7 779.0 484.8 782.2 C 478.8 785.5 473.8 790.8 468.2 794.8 C 462.7 798.8 457.0 802.6 451.2 806.2 C 445.5 809.9 439.6 813.2 433.8 816.8 C 427.9 820.2 422.0 823.8 416.0 827.2 C 410.0 830.8 404.0 834.3 398.0 837.8 C 392.0 841.2 385.9 844.6 379.8 848.0 C 373.6 851.4 367.5 854.7 361.2 858.0 C 355.0 861.3 348.8 864.7 342.5 868.0 C 336.2 871.3 329.8 874.7 323.5 878.0 C 317.2 881.3 310.8 884.5 304.5 887.8 C 298.2 891.0 291.9 894.3 285.5 897.2 C 279.1 900.2 272.6 903.0 266.0 905.5 C 259.4 908.0 252.4 909.7 246.0 912.5 C 239.6 915.3 233.5 918.5 227.8 922.2 C 222.0 926.0 217.0 930.8 211.2 934.8 C 205.5 938.7 199.6 942.3 193.5 945.8 C 187.4 949.2 180.8 952.0 174.5 955.2 C 168.2 958.5 162.0 961.7 155.8 965.0 C 149.5 968.3 143.5 971.7 137.2 975.0 C 131.0 978.3 124.8 981.5 118.5 984.8 C 112.2 988.0 105.8 991.0 99.5 994.2 C 93.2 997.5 87.0 1000.8 80.8 1004.2 C 74.5 1007.7 68.3 1011.2 62.2 1014.8 C 56.2 1018.3 50.2 1022.0 44.2 1025.8 C 38.3 1029.5 31.8 1033.0 26.8 1037.2 C 21.8 1041.5 17.6 1046.0 14.2 1051.0 C 10.9 1056.0 8.6 1063.0 6.8 1067.0 C 4.9 1071.0 3.6 1073.7 3.0 1075.0",
];

type VehicleKind = VehicleSvgKind;
type VehicleVariant = "black" | "red";

type CarSpec = {
  color: string;
  accent: string;
  duration: number;
  delay: number;
  pathIdx: number;
  flip?: boolean;
  scale?: number;
  kind: VehicleKind;
  variant?: VehicleVariant;
  imageUrl?: string;       // sprite uploadé (vue du ciel, nez ↑)
  category?: CustomVehicleCategory;
};

// Trafic civil par défaut VIDE — toutes les voitures qui roulent sont
// celles ajoutées par le joueur via le panel admin (📦⬇️ Import en lot).
// Voir buildCarsFromCustom() dans le composant ci-dessous.





// Anciennes voitures basées sur des photos remplacées par des SVG vectoriels
// vus du dessus (avant pointant vers le haut). Voir src/game/vehicles/VehicleSvgs.tsx.
// La taille effective des véhicules civils en viewBox 1920×1080 :
//   spec.scale (~0.6) × CIVIL_SCALE = ~36px (= taille du taxi joueur).
const CIVIL_SCALE = 1.5;

function Vehicle({
  kind,
  color,
  accent,
  scale = 1,
}: {
  kind: VehicleKind;
  color: string;
  accent: string;
  scale?: number;
  variant?: VehicleVariant;
  photoIdx?: number;
}) {
  return <VehicleSvg kind={kind} color={color} accent={accent} scale={scale * CIVIL_SCALE} />;
}





// === Piétons photos qui marchent sur les trottoirs ===
type PhotoPedSpec = {
  pathIdx: number;
  side: 1 | -1;
  speed: number;     // px/s
  startFrac: number; // 0..1
  imageIdx: number;
  scale: number;
};
const PHOTO_PEDS: PhotoPedSpec[] = [
  { pathIdx: 0, side: 1,  speed: 22, startFrac: 0.08, imageIdx: 0, scale: 0.55 },
  { pathIdx: 0, side: -1, speed: 18, startFrac: 0.22, imageIdx: 1, scale: 0.55 },
  { pathIdx: 0, side: 1,  speed: 20, startFrac: 0.42, imageIdx: 1, scale: 0.5 },
  { pathIdx: 0, side: -1, speed: 24, startFrac: 0.62, imageIdx: 0, scale: 0.55 },
  { pathIdx: 0, side: 1,  speed: 19, startFrac: 0.82, imageIdx: 0, scale: 0.5 },
  { pathIdx: 2, side: 1,  speed: 21, startFrac: 0.12, imageIdx: 1, scale: 0.55 },
  { pathIdx: 2, side: -1, speed: 23, startFrac: 0.34, imageIdx: 0, scale: 0.55 },
  { pathIdx: 2, side: 1,  speed: 18, startFrac: 0.56, imageIdx: 1, scale: 0.5 },
  { pathIdx: 2, side: -1, speed: 25, startFrac: 0.78, imageIdx: 1, scale: 0.55 },
];
// === Verrou de trottoir ===
// Distance perpendiculaire MINIMALE entre un piéton et l'axe de la route.
// La largeur visible d'une route ≈ 46 px ; on garde une marge confortable
// pour qu'AUCUN piéton ne puisse glisser sur la chaussée — même si une IA,
// une collision ou un futur effet tentait d'altérer sa position.
export const SIDEWALK_LOCK_OFFSET = 64;
// Les piétons photo marchent JUSTE à côté de la chaussée (stroke route = 46 → demi-largeur ≈ 23).
// Offset 42 = trottoir large, jamais sur la chaussée même en intersection.
const PHOTO_PED_OFFSET = 42;
const PHOTO_PED_MIN_OFFSET = 38; // jamais plus près de l'axe que ça (anti-glissement chaussée)
// Rayon autour d'un feu où le piéton doit respecter le passage piéton.
const PED_CROSSING_RADIUS = 44;


/** Verrouille une coordonnée XY sur le trottoir : si elle est plus proche
 *  de l'axe que `SIDEWALK_LOCK_OFFSET`, on la repousse vers `side`. */
export function lockToSidewalk(
  pathPoint: { x: number; y: number },
  tangent: { dx: number; dy: number },
  side: 1 | -1,
  x: number,
  y: number,
): { x: number; y: number } {
  const L = Math.hypot(tangent.dx, tangent.dy) || 1;
  const nx = -tangent.dy / L;
  const ny = tangent.dx / L;
  // Distance signée du point (x,y) à l'axe, projetée sur la normale `side`.
  const dist = ((x - pathPoint.x) * nx + (y - pathPoint.y) * ny) * side;
  if (dist >= SIDEWALK_LOCK_OFFSET) return { x, y };
  return {
    x: pathPoint.x + nx * SIDEWALK_LOCK_OFFSET * side,
    y: pathPoint.y + ny * SIDEWALK_LOCK_OFFSET * side,
  };
}

function PhotoPedestrians({ pathRefs }: { pathRefs: React.MutableRefObject<(SVGPathElement | null)[]> }) {
  const nodes = useRef<(SVGGElement | null)[]>([]);
  const pedSpecs = isUltraLite() ? [] : (perfTier() === "low" ? PHOTO_PEDS.slice(0, 3) : PHOTO_PEDS);
  // Rotation aléatoire des sprites parmi tous ceux dispos (défaut + custom admin).
  const [pool, setPool] = useState<string[]>(() => getPedPhotoImages());
  useEffect(() => {
    const onChange = () => setPool(getPedPhotoImages());
    window.addEventListener("jce.customPedestrians.changed", onChange);
    return () => window.removeEventListener("jce.customPedestrians.changed", onChange);
  }, []);
  useEffect(() => {
    const lens = pathRefs.current.map(p => p ? p.getTotalLength() : 0);
    if (lens.some(l => l <= 1)) return;
    if (pedSpecs.length === 0) return;
    const states = pedSpecs.map(spec => ({
      spec,
      pathLen: lens[spec.pathIdx],
      s: spec.startFrac * lens[spec.pathIdx],
    }));
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const tSec = nowSeconds();
      const lights = getTrafficLights();
      for (let i = 0; i < states.length; i++) {
        const st = states[i];
        const node = nodes.current[i];
        const path = pathRefs.current[st.spec.pathIdx];
        if (!path || !node) continue;
        // Position courante pour décider d'un éventuel arrêt au passage piéton.
        const cur = path.getPointAtLength(st.s);
        // Cherche un feu à proximité : si le feu PIÉTON est rouge (= feu voiture vert/orange),
        // on bloque le piéton AU BORD du passage (il n'entre pas sur la chaussée).
        let blocked = false;
        for (const l of lights) {
          const dx0 = l.x - cur.x;
          const dy0 = l.y - cur.y;
          if (dx0 * dx0 + dy0 * dy0 < PED_CROSSING_RADIUS * PED_CROSSING_RADIUS) {
            const carState = getLightState(l, tSec);
            // Feu piéton vert UNIQUEMENT quand le feu voiture est rouge.
            if (carState !== "red") { blocked = true; break; }
          }
        }
        if (!blocked) {
          st.s = (st.s + st.spec.speed * dt) % st.pathLen;
        }
        const p = blocked ? cur : path.getPointAtLength(st.s);
        // CULLING : hors viewport SVG (avec marge) → skip getPointAtLength d'appoint + DOM write.
        if (p.x < -200 || p.x > 2120 || p.y < -200 || p.y > 1280) continue;
        const p2 = path.getPointAtLength(Math.min(st.pathLen, st.s + 1));
        const dx = p2.x - p.x, dy = p2.y - p.y;
        const L = Math.hypot(dx, dy) || 1;
        // perpendiculaire = trottoir
        const nx = -dy / L * PHOTO_PED_OFFSET * st.spec.side;
        const ny =  dx / L * PHOTO_PED_OFFSET * st.spec.side;
        // angle de marche (le sprite top-down tourne dans la direction du mouvement)
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        // 🔒 Verrou trottoir local (offset piéton, pas celui des clients taxi)
        // Clamp la distance perpendiculaire à PHOTO_PED_MIN_OFFSET minimum.
        let px = p.x + nx;
        let py = p.y + ny;
        const nUnitX = -dy / L;
        const nUnitY = dx / L;
        const signedDist = ((px - p.x) * nUnitX + (py - p.y) * nUnitY) * st.spec.side;
        if (signedDist < PHOTO_PED_MIN_OFFSET) {
          px = p.x + nUnitX * PHOTO_PED_MIN_OFFSET * st.spec.side;
          py = p.y + nUnitY * PHOTO_PED_MIN_OFFSET * st.spec.side;
        }
        node.setAttribute(
          "transform",
          `translate(${px.toFixed(2)},${py.toFixed(2)}) rotate(${ang.toFixed(2)})`,
        );
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pathRefs, pedSpecs.length]);
  if (pedSpecs.length === 0) return null;
  return (
    <g pointerEvents="none">
      {pedSpecs.map((spec, i) => {
        // Sprites top-down ~36px (vue du ciel), rotation = sens de marche
        const S = 36 * spec.scale;
        return (
          <g key={i} ref={el => { nodes.current[i] = el; }}>
            <ellipse cx="0" cy={S * 0.2} rx={S * 0.35} ry={S * 0.18} fill="rgba(0,0,0,0.45)" />
            {/* +90° : sprite top-down "tête au nord", parent applique rotate(angle) basé sur +x */}
            <g transform="rotate(90)">
              <image
                href={pool[(spec.imageIdx + i) % Math.max(1, pool.length)] ?? pool[0]}
                x={-S / 2}
                y={-S / 2}
                width={S}
                height={S}
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}

// Lampadaires retirés à la demande du joueur.



type PedSpec = {
  pathIdx: number;
  duration: number;
  delay: number;
  side: 1 | -1;   // trottoir gauche/droite
  flip?: boolean;
  shirt: string;
  pants: string;
  skin: string;
  scale?: number;
};

const PEDESTRIANS: PedSpec[] = [
  { pathIdx: 0, duration: 140, delay: -10, side:  1, shirt: "#e94e4e", pants: "#2a2f38", skin: "#f1c79b", scale: 0.85 },
  { pathIdx: 0, duration: 160, delay: -55, side: -1, shirt: "#3b82f6", pants: "#1f2937", skin: "#c89372", flip: true, scale: 0.9 },
  { pathIdx: 0, duration: 180, delay: -90, side:  1, shirt: "#fbbf24", pants: "#374151", skin: "#e8b48a", scale: 0.8 },
  { pathIdx: 0, duration: 150, delay: -130,side: -1, shirt: "#10b981", pants: "#111827", skin: "#a06c44", flip: true, scale: 0.88 },
  // Path 1 retiré (voir VILLAGE_PATHS) — pas de piétons sur la route off-screen
  { pathIdx: 2, duration: 165, delay: -10, side:  1, shirt: "#a855f7", pants: "#1f2937", skin: "#f0c8a0", scale: 0.82 },
  { pathIdx: 0, duration: 195, delay: -200, side: -1, shirt: "#ec4899", pants: "#0f172a", skin: "#d4a37a", flip: true, scale: 0.86 },
  { pathIdx: 2, duration: 170, delay: -20, side:  1, shirt: "#f97316", pants: "#1e293b", skin: "#c89372", scale: 0.85 },
  { pathIdx: 2, duration: 190, delay: -75, side: -1, shirt: "#06b6d4", pants: "#1f2937", skin: "#e8b48a", flip: true, scale: 0.9 },
  { pathIdx: 2, duration: 155, delay: -120,side:  1, shirt: "#ffffff", pants: "#0b1220", skin: "#a06c44", scale: 0.83 },
  { pathIdx: 2, duration: 200, delay: -170,side: -1, shirt: "#facc15", pants: "#374151", skin: "#f1c79b", flip: true, scale: 0.88 },
];
void PEDESTRIANS; void PedestrianSVG;


// Largeur d'asphalte visible sur la carte ≈ 28-34px (stroke). On place
// les piétons à 34px du centre du path => clairement sur le trottoir,
// jamais sur la chaussée, même côté contre-voie.
export const SIDEWALK_OFFSET = 34;

function PedestrianSVG({ shirt, pants, skin, side, scale = 1 }: { shirt: string; pants: string; skin: string; side: -1 | 0 | 1; scale?: number }) {
  // Offset Y dans le repère local = perpendiculaire au sens de marche (rotate="auto").
  // side ∈ {-1, 0, 1} : 0 = au centre (utilisé pour la traversée piétonne).
  const oy = side === 0 ? 0 : side * SIDEWALK_OFFSET;
  return (
    <g transform={`translate(0,${oy}) scale(${scale})`}>
      <ellipse cx="0" cy="6" rx="4.5" ry="1.6" fill="rgba(0,0,0,0.5)" />
      {/* jambes (animation marche) */}
      <g>
        <rect x="-2.4" y="0" width="2" height="6" rx="0.6" fill={pants}>
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0;0 -1;0 0" dur="0.6s" repeatCount="indefinite" />
        </rect>
        <rect x="0.4" y="0" width="2" height="6" rx="0.6" fill={pants}>
          <animateTransform attributeName="transform" type="translate" values="0 -1;0 0;0 -1;0 0;0 -1" dur="0.6s" repeatCount="indefinite" />
        </rect>
      </g>
      {/* torse */}
      <path d="M -3.2 -5 Q 0 -7 3.2 -5 L 2.6 1 L -2.6 1 Z" fill={shirt} stroke="rgba(0,0,0,0.4)" strokeWidth="0.4" />
      {/* bras */}
      <rect x="-4.2" y="-4" width="1.4" height="4.5" rx="0.5" fill={shirt}>
        <animateTransform attributeName="transform" type="rotate" values="-10;15;-10" dur="0.6s" repeatCount="indefinite" />
      </rect>
      <rect x="2.8" y="-4" width="1.4" height="4.5" rx="0.5" fill={shirt}>
        <animateTransform attributeName="transform" type="rotate" values="15;-10;15" dur="0.6s" repeatCount="indefinite" />
      </rect>
      {/* tête */}
      <circle cx="0" cy="-8" r="2.4" fill={skin} stroke="rgba(0,0,0,0.5)" strokeWidth="0.4" />
      <path d="M -2.4 -9.2 Q 0 -11 2.4 -9.2 L 2.2 -8 L -2.2 -8 Z" fill="#1f2937" />
    </g>
  );
}

type CarState = {
  spec: CarSpec;
  pathLen: number;
  baseSpeed: number;   // px/s à allure libre
  s: number;           // progression linéaire le long du path (px), repère "avant"
  speed: number;       // px/s instantanée
  laneKey: string;     // pathIdx + sens -> regroupe les véhicules qui peuvent se gêner
  node: SVGGElement | null;
  visible?: boolean;             // CULLING : dans le viewport visible (+ marge)
};

// Catégories autorisées dans le trafic libre : uniquement les civils & véhicules
// de service. Police / ambulance / pompiers ne roulent QUE sur intervention
// (cf. EmergencyStations + InterventionDispatcher) → ils restent à leur QG
// le reste du temps.
const TRAFFIC_CATEGORIES: CustomVehicleCategory[] = [
  "civil", "service",
];

function buildCarsFromCustom(count?: number): CarSpec[] {
  const customs = listCustomVehicles().filter(v => TRAFFIC_CATEGORIES.includes(v.category));
  // Paths autorisés : tout sauf "village".
  const allowedPaths: number[] = [];
  for (let i = 0; i < ROADS.length; i++) if (!VILLAGE_PATHS.has(i)) allowedPaths.push(i);

  // Pool d'URLs disponibles : assets civils par défaut + customs roulants.
  // Permet d'avoir du trafic même sans uploads, et boucle modulo si N > pool.length.
  const civilUrls = getCivilCarUrls();
  type Entry = { url: string; category: CustomVehicleCategory };
  const pool: Entry[] = [
    ...civilUrls.map((url): Entry => ({ url, category: "civil" })),
    ...customs.map((v): Entry => ({ url: v.url, category: v.category })),
  ];
  if (pool.length === 0) return [];


  const N = Math.max(0, count ?? pool.length);
  const out: CarSpec[] = [];
  for (let i = 0; i < N; i++) {
    const entry = pool[i % pool.length];
    const pathIdx = allowedPaths[i % allowedPaths.length];
    const flip = (i % 2) === 1;
    const isHeavy = entry.category === "firetruck" || entry.category === "service" || entry.category === "ambulance";
    const baseDur = isHeavy ? 18 : 14;
    const duration = baseDur + (i % 5) * 0.6;
    out.push({
      kind: "sedan",
      color: "#888",
      accent: "#111",
      duration,
      delay: -i * 4,
      pathIdx,
      flip,
      scale: 0.6,
      imageUrl: entry.url,
      category: entry.category,
    });
  }
  return out;
}


export default function CityTraffic() {
  const [night, setNight] = useState(0.25);
  const [lightsTick, setLightsTick] = useState(0);
  const tier = perfTier();
  const reducedFx = reduceMotion();
  const admin = useAdminConfig();
  const [customTick, setCustomTick] = useState(0);
  // Re-render quand le joueur ajoute/supprime un véhicule custom.
  useEffect(() => {
    const onChange = () => setCustomTick(t => t + 1);
    window.addEventListener("jce.customVehicles.changed", onChange);
    return () => window.removeEventListener("jce.customVehicles.changed", onChange);
  }, []);
  // Trafic civil réactivé avec un budget agressivement limité par perfTier.
  // Le bug réel qui faisait ramer (setState pendant le rendu) a été corrigé ;
  // on peut donc remettre quelques civils et piétons.
  void admin;
  const desiredCars = isUltraLite() ? 4 : tier === "low" ? 8 : tier === "mid" ? 14 : 22;
  const carBudget = trafficBudget(desiredCars);
  const activeCars = useMemo<CarSpec[]>(() => buildCarsFromCustom(carBudget), [carBudget, customTick]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const carNodes = useRef<(SVGGElement | null)[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Viewport visible en coordonnées SVG (avec preserveAspectRatio="xMidYMid slice").
  // Recalculé sur resize. Marge de 200 px pour pré-activer les véhicules qui entrent.
  const visibleRect = useRef<{ minX: number; minY: number; maxX: number; maxY: number }>({
    minX: -9999, minY: -9999, maxX: 9999, maxY: 9999,
  });
  useEffect(() => {
    const recompute = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const VB_W = 1920, VB_H = 1080;
      const containerRatio = r.width / r.height;
      const vbRatio = VB_W / VB_H;
      let visW: number, visH: number;
      if (containerRatio > vbRatio) {
        // largeur entièrement visible, hauteur slicée
        visW = VB_W;
        visH = VB_W / containerRatio;
      } else {
        // hauteur entièrement visible, largeur slicée
        visH = VB_H;
        visW = VB_H * containerRatio;
      }
      const cx = VB_W / 2, cy = VB_H / 2;
      const margin = 220;
      visibleRect.current = {
        minX: cx - visW / 2 - margin,
        minY: cy - visH / 2 - margin,
        maxX: cx + visW / 2 + margin,
        maxY: cy + visH / 2 + margin,
      };
    };
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
    };
  }, []);
  const [lights, setLights] = useState<TrafficLight[]>([]);


  // Radars retirés à la demande du joueur.


  // Cycle jour/nuit 300s (5 minutes). Démarre en plein jour.
  // PERF : on n'a pas besoin de 60 setState/s pour la nuit ; un rafraîchissement
  // toutes les 250 ms est totalement invisible à l'œil et libère le main thread.
  useEffect(() => {
    let last = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      if (now - last < 240) return;
      last = now;
      const t = (now % 300000) / 300000;
      const daylight = Math.max(0, Math.sin(t * Math.PI * 2 + Math.PI / 2));
      setNight(0.1 + (1 - daylight) * 0.6);
      setLightsTick(v => (v + 1) % 1000000);
    }, tier === "ultra" || tier === "low" ? 1000 : 500);
    return () => window.clearInterval(id);
  }, []);



  // Boucle de trafic : positions JS pilotées avec freinage progressif.
  useEffect(() => {
    // Mesurer les longueurs réelles des paths.
    const lens = pathRefs.current.map((p: SVGPathElement | null) => (p ? p.getTotalLength() : 1));
    if (lens.some((l: number) => l <= 1)) return;

    // Initialise les feux rouges (singleton partagé avec TaxiTycoon).
    initTrafficLights(pathRefs.current, lens);
    setLights(getTrafficLights());

    // Paths autorisés pour le trafic civil : tout sauf village.
    const civilAllowed: number[] = [];
    for (let i = 0; i < pathRefs.current.length; i++) {
      if (!VILLAGE_PATHS.has(i)) civilAllowed.push(i);
    }
    // Round-robin strict pour garantir une distribution équilibrée sur toutes les routes
    // (sinon la route du haut, plus courte, reste souvent vide visuellement).
    let pickCursor = Math.floor(Math.random() * Math.max(1, civilAllowed.length));
    const pickPath = () => {
      const p = civilAllowed[pickCursor % civilAllowed.length];
      pickCursor++;
      return p;
    };
    // Rerolle path + sens + durée à chaque tour pour casser la régularité.
    // Trafic civil : conduite tranquille (durée allongée, peu de variation) — pas agressif.
    const rerollSpec = (spec: CarSpec): CarSpec => {
      const newPath = pickPath();
      const baseDur = Math.max(10, spec.duration);
      // 0.9× à 1.2× → voitures rapides (~10–18s par tour de path)
      const dur = baseDur * (0.9 + Math.random() * 0.3);
      return {
        ...spec,
        pathIdx: newPath,
        flip: Math.random() < 0.5,
        duration: dur,
      };
    };

    const states: CarState[] = activeCars.map((rawSpec, i) => {
      // Init aléatoire : chaque voiture civile prend un path/dir/durée tirés au sort
      const spec = rerollSpec(rawSpec);
      const pathLen = lens[spec.pathIdx];
      const baseSpeed = pathLen / spec.duration; // px/s
      return {
        spec,
        pathLen,
        baseSpeed,
        s: Math.random() * pathLen,
        speed: baseSpeed,
        laneKey: `${spec.pathIdx}:${spec.flip ? "r" : "f"}`,
        node: carNodes.current[i],
      };
    });

    // Radars retirés : noop pour préserver l'API d'appel dans la boucle.
    const checkRadars = (_st: CarState, _prev: number) => {};


    let last = performance.now();
    let raf = 0;
    // 30 fps suffit largement pour du trafic vu de haut, ça divise le coût CPU
    // par 2 sur les smartphones d'entrée de gamme (Xiaomi, Redmi, etc.).
    const MIN_FRAME = 1000 / targetFps();
    let lastDensityCheck = 0;
    let activeCount = states.length;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (now - last < MIN_FRAME) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (now - lastDensityCheck > 4000) {
        lastDensityCheck = now;
        const gt = getGameTime();
        // Beaucoup de monde le jour, trafic très réduit la nuit.
        const ratio = Math.max(0.12, Math.min(1, gt.density / 1.2));
        // densityMult ramène l'effectif sur appareils low-end (≈35%).
        activeCount = Math.max(1, Math.round(states.length * ratio * densityMult()));
      }


      const vr = visibleRect.current;
      for (let i = 0; i < states.length; i++) {
        const st = states[i];
        const path = pathRefs.current[st.spec.pathIdx];
        const densityVisible = i < activeCount;
        if (!path || !densityVisible) {
          st.visible = false;
          if (st.node) st.node.setAttribute("opacity", "0");
          continue;
        }
        const fwd = st.spec.flip ? st.pathLen - st.s : st.s;
        const p = path.getPointAtLength(fwd);
        // CULLING : hors viewport (+ marge) → pas de DOM write, mais la voiture continue d'avancer.
        st.visible = p.x >= vr.minX && p.x <= vr.maxX && p.y >= vr.minY && p.y <= vr.maxY;
        if (st.node) st.node.setAttribute("opacity", st.visible ? "1" : "0");
        st.speed = st.baseSpeed;
      }

      // Spacing pass : on garde une distance min entre voitures d'une même voie.
      // Évite que les voitures se collent / se traversent visuellement.
      const MIN_GAP = 70;
      const BRAKE_GAP = 140;
      const lanesMap = new Map<string, CarState[]>();
      for (const st of states) {
        if (!st.visible) continue;
        const arr = lanesMap.get(st.laneKey);
        if (arr) arr.push(st); else lanesMap.set(st.laneKey, [st]);
      }
      for (const arr of lanesMap.values()) {
        if (arr.length < 2) continue;
        arr.sort((a, b) => a.s - b.s);
        for (let i = 0; i < arr.length; i++) {
          const me = arr[i];
          const next = arr[(i + 1) % arr.length];
          let gap = next.s - me.s;
          if (gap <= 0) gap += me.pathLen;
          if (gap < MIN_GAP) me.speed = 0;
          else if (gap < BRAKE_GAP) {
            const k = (gap - MIN_GAP) / (BRAKE_GAP - MIN_GAP);
            me.speed = me.baseSpeed * k;
          }
        }
      }


      let needsRebuild = false;
      for (const st of states) {
        const node = st.node;
        if (!node) continue;
        // ===== Trafic normal =====
        const prev = st.s;
        st.s += st.speed * dt;
        // En bout de path → demi-tour sur place (inversion du sens), pas de saut
        // à l'autre extrémité de la carte.
        if (st.s >= st.pathLen) {
          st.s = st.pathLen;
          st.spec = { ...st.spec, flip: !st.spec.flip };
          const newKey = `${st.spec.pathIdx}:${st.spec.flip ? "r" : "f"}`;
          if (newKey !== st.laneKey) {
            st.laneKey = newKey;
            needsRebuild = true;
          }
          st.s = 0; // repart depuis l'autre bout, mais visuellement c'est le même point (demi-tour)
        } else if (prev > st.s) {
          st.s = st.s % st.pathLen;
        }
        // CULLING : hors-écran → on n'a pas besoin de calculer la tangente ni
        // d'écrire dans le DOM. La voiture continue d'avancer (st.s) à
        // baseSpeed et sera remise à jour visuellement dès qu'elle réapparaît.
        if (!st.visible) {
          checkRadars(st, prev);
          continue;
        }
        const path = pathRefs.current[st.spec.pathIdx];
        if (!path) continue;
        const lenForward = st.spec.flip ? st.pathLen - st.s : st.s;
        const p = path.getPointAtLength(lenForward);
        const p2 = path.getPointAtLength(Math.min(st.pathLen, lenForward + (st.spec.flip ? -1 : 1)));
        const tdx = p2.x - p.x, tdy = p2.y - p.y;
        const L = Math.hypot(tdx, tdy) || 1;
        const ang = (Math.atan2(tdy, tdx) * 180) / Math.PI;
        // Lane offset toujours à droite DANS LE SENS DE MARCHE : oncoming
        // traffic roule sur l'autre voie, et les véhicules ne se croisent
        // jamais au milieu de la chaussée (rond-points compris).
        const side = st.spec.flip ? -1 : 1;
        const ox = (-tdy / L) * LANE_HALF * side;
        const oy = (tdx / L) * LANE_HALF * side;
        node.setAttribute("transform", `translate(${(p.x + ox).toFixed(2)},${(p.y + oy).toFixed(2)}) rotate(${ang.toFixed(2)})`);
        checkRadars(st, prev);
      }
      void needsRebuild;
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [activeCars]);


  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
    >
      <defs>
        {ROADS.map((d, i) => (
          <path
            key={i}
            id={`jce-road-${i}`}
            d={d}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
          />
        ))}
        <filter id="jce-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <g opacity="0.12">
        {ROADS.map((d, i) => (
          VILLAGE_PATHS.has(i) ? null : (
            <path key={i} d={d} stroke="#0b0d10" strokeWidth={i >= 4 ? 34 : 46} fill="none" strokeLinecap="round" />
          )
        ))}
        {ROADS.slice(0, 4).map((d, i) => (
          VILLAGE_PATHS.has(i) ? null : (
            <path key={`dash-${i}`} d={d} stroke="#f6d56a" strokeWidth="2.4" strokeDasharray="18 18" fill="none" opacity="0.72" />
          )
        ))}
      </g>





      {activeCars.map((car, i) => {
        // Sprite uploadé : image vue du ciel, nez vers ↑.
        // Le moteur calcule rotate(angle) à partir de la tangente (atan2 → 0° = est).
        // On compense avec un rotate(90) interne pour que "haut de l'image" = sens de marche.
        const SPRITE_SIZE = 48 * (car.scale ?? 0.6) * CIVIL_SCALE;
        return (
          <g
            key={i}
            ref={(el) => {
              carNodes.current[i] = el;
            }}
          >
            {car.imageUrl ? (
              <g transform="rotate(90)">
                
                <image
                  href={car.imageUrl}
                  x={-SPRITE_SIZE / 2}
                  y={-SPRITE_SIZE / 2}
                  width={SPRITE_SIZE}
                  height={SPRITE_SIZE}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            ) : (
              <Vehicle kind={car.kind} color={car.color} accent={car.accent} scale={car.scale} variant={car.variant} photoIdx={i} />
            )}
          </g>
        );
      })}
      {/* Piétons réactivés — désactivés uniquement en mode ultra-lite */}
      {!isUltraLite() && <PhotoPedestrians pathRefs={pathRefs} />}


      {/* Piétons cartoon SVG retirés — remplacés par les sprites top-down (PhotoPedestrians) */}


      {/* Feux rouges aux intersections + feux piétons synchronisés */}
      {lights.map((l) => {
        // lightsTick force le re-render à chaque frame pour animer la couleur
        void lightsTick;
        const st = getLightState(l, nowSeconds());
        const red = st === "red", orange = st === "orange", green = st === "green";
        // Feu piéton : vert uniquement quand le feu voiture est rouge.
        const pedGreen = red;
        void pedGreen;
        return (
          <g key={`tl-${l.id}`} transform={`translate(${l.x},${l.y}) scale(1.6)`} pointerEvents="none">
            <ellipse cx="0" cy="14" rx="14" ry="4" fill="rgba(0,0,0,0.45)" />
            <rect x="-7" y="-22" width="14" height="36" rx="3" fill="#0e1217" stroke="#000" strokeWidth="1" />
            <circle cx="0" cy="-14" r="3.4" fill={red ? "#ff2a2a" : "#2a0808"} opacity={red ? 1 : 0.4}>
              {red && !reducedFx && <animate attributeName="r" values="3.4;4.2;3.4" dur="1s" repeatCount="indefinite" />}
            </circle>
            <circle cx="0" cy="-4"  r="3.4" fill={orange ? "#ffb020" : "#2a1a00"} opacity={orange ? 1 : 0.4} />
            <circle cx="0" cy="6"   r="3.4" fill={green ? "#22e36a" : "#0a2a14"} opacity={green ? 1 : 0.4} />
            {/* halo lumineux la nuit */}
            {night > 0.4 && (
              <circle cx="0" cy={red ? -14 : orange ? -4 : 6} r="10"
                fill={red ? "#ff2a2a" : orange ? "#ffb020" : "#22e36a"}
                opacity={night * 0.35} />
            )}
            {/* Feu piéton — retiré en ultra-léger pour réduire les nœuds SVG */}
            {!reducedFx && <g transform="translate(18,-4)">
              {/* Boîtier noir */}
              <rect x="-7" y="-13" width="14" height="26" rx="2.5" fill="#0a0c10" stroke="#000" strokeWidth="0.8" />
              {/* Écran rouge (ne pas marcher) */}
              <rect x="-5.5" y="-11.5" width="11" height="11" rx="1.2" fill={pedGreen ? "#2a0808" : "#1a0303"} />
              {/* Écran vert (marcher) */}
              <rect x="-5.5" y="0.5" width="11" height="11" rx="1.2" fill={pedGreen ? "#062a14" : "#06160c"} />
              {pedGreen ? (
                // ▶ MARCHE : silhouette "walking man" verte, animée
                <g fill="#22e36a" transform="translate(0,6)">
                  <circle cx="0" cy="-4.5" r="1.3" />
                  {/* Torse incliné */}
                  <rect x="-1" y="-3.2" width="2" height="3.6" rx="0.5" transform="rotate(-8)" />
                  {/* Bras */}
                  <rect x="-2.6" y="-2.6" width="1.1" height="2.6" rx="0.4" transform="rotate(-35 -2 -1.3)" />
                  <rect x="1.5" y="-2.6" width="1.1" height="2.6" rx="0.4" transform="rotate(30 2 -1.3)" />
                  {/* Jambes en mouvement */}
                  <rect x="-1.6" y="0.2" width="1.3" height="3.4" rx="0.4" transform="rotate(-20 -1 1.9)">
                    <animateTransform attributeName="transform" type="rotate" values="-25 -1 1.9;0 -1 1.9;-25 -1 1.9" dur="0.6s" repeatCount="indefinite" />
                  </rect>
                  <rect x="0.3" y="0.2" width="1.3" height="3.4" rx="0.4" transform="rotate(25 1 1.9)">
                    <animateTransform attributeName="transform" type="rotate" values="25 1 1.9;0 1 1.9;25 1 1.9" dur="0.6s" repeatCount="indefinite" />
                  </rect>
                  {night > 0.4 && <circle r="7" fill="#22e36a" opacity={night * 0.45} />}
                </g>
              ) : (
                // ✋ NE PAS MARCHER : main rouge levée (style US "DON'T WALK")
                <g fill="#ff2a2a" transform="translate(0,-6)">
                  {/* Paume */}
                  <path d="M -3 -1 Q -3 -4.2 0 -4.2 Q 3 -4.2 3 -1 L 3 2.6 Q 3 4 1.6 4 L -1.6 4 Q -3 4 -3 2.6 Z" />
                  {/* Poignet */}
                  <rect x="-1.6" y="3.4" width="3.2" height="2" rx="0.5" />
                  {/* Doigts (4 traits) */}
                  <rect x="-2.4" y="-4.2" width="0.9" height="2.4" rx="0.3" />
                  <rect x="-1.2" y="-4.8" width="0.9" height="3" rx="0.3" />
                  <rect x="0.3" y="-4.8" width="0.9" height="3" rx="0.3" />
                  <rect x="1.5" y="-4.2" width="0.9" height="2.4" rx="0.3" />
                  {night > 0.4 && <circle r="7" fill="#ff2a2a" opacity={night * 0.4} />}
                </g>
              )}
            </g>}
            {/* Passages piétons (zébras) aux 4 côtés de l'intersection */}
            {!reducedFx && <g opacity="0.65" pointerEvents="none">
              {/* Sud */}
              {[-12, -6, 0, 6, 12].map((ox) => (
                <rect key={`s${ox}`} x={ox - 1.5} y={20} width="3" height="14" fill="#f4f4f4" rx="0.5" />
              ))}
              {/* Nord */}
              {[-12, -6, 0, 6, 12].map((ox) => (
                <rect key={`n${ox}`} x={ox - 1.5} y={-34} width="3" height="14" fill="#f4f4f4" rx="0.5" />
              ))}
              {/* Est */}
              {[-12, -6, 0, 6, 12].map((oy) => (
                <rect key={`e${oy}`} x={20} y={oy - 1.5} width="14" height="3" fill="#f4f4f4" rx="0.5" />
              ))}
              {/* Ouest */}
              {[-12, -6, 0, 6, 12].map((oy) => (
                <rect key={`w${oy}`} x={-34} y={oy - 1.5} width="14" height="3" fill="#f4f4f4" rx="0.5" />
              ))}
            </g>}
          </g>
        );
      })}

      {/* Plus aucun piéton ne marche/traverse sur la chaussée — exigence joueur. */}

      {/* Radars retirés à la demande du joueur. */}


      <rect width="1920" height="1080" fill="#0a1530" opacity={Math.max(0, (night - 0.15)) * 0.55} pointerEvents="none" />
    </svg>
  );
}