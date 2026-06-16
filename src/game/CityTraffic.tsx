import { useEffect, useState } from "react";

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
const ROADS = [
  "M 20 582 Q 39 567 46 554 Q 53 541 64 530 Q 74 520 87 510 Q 100 500 113 496 Q 126 492 139 490 Q 152 488 164 482 Q 177 477 190 472 Q 203 468 216 461 Q 228 454 228 442 Q 227 431 236 422 Q 245 413 258 412 Q 271 411 284 408 Q 296 406 309 402 Q 322 399 335 397 Q 348 395 361 390 Q 374 385 386 378 Q 398 371 408 361 Q 417 351 417 338 Q 417 325 428 324 Q 440 322 450 330 Q 459 338 470 339 Q 481 340 494 342 Q 506 344 514 357 Q 523 370 536 376 Q 549 382 562 378 Q 575 374 588 376 Q 601 377 614 380 Q 627 383 627 394 Q 627 404 614 417 Q 601 430 592 439 Q 584 448 574 454 Q 564 461 565 474 Q 566 487 574 500 Q 582 513 595 519 Q 608 525 621 538 Q 634 550 647 559 Q 660 568 673 567 Q 686 566 696 555 Q 706 544 719 547 Q 732 550 745 553 Q 758 556 771 556 Q 784 557 797 563 Q 810 569 820 558 Q 830 548 836 535 Q 842 522 846 510 Q 849 498 862 496 Q 875 493 888 492 Q 901 490 910 502 Q 920 513 933 512 Q 946 511 959 510 Q 972 510 985 506 Q 998 503 1011 499 Q 1024 495 1036 484 Q 1049 474 1062 461 Q 1075 448 1088 442 Q 1101 437 1114 435 Q 1127 433 1140 434 Q 1153 436 1166 437 Q 1179 438 1192 442 Q 1205 447 1218 448 Q 1231 449 1244 454 Q 1256 458 1269 456 Q 1282 454 1293 442 Q 1304 429 1316 424 Q 1329 420 1342 420 Q 1355 419 1368 416 Q 1381 414 1394 412 Q 1407 411 1420 412 Q 1433 414 1446 419 Q 1458 424 1471 428 Q 1484 432 1494 443 Q 1503 454 1516 467 Q 1529 480 1534 493 Q 1538 506 1538 519 Q 1539 532 1552 540 Q 1565 547 1577 550 Q 1589 554 1602 557 Q 1615 560 1627 559 Q 1639 558 1651 562 Q 1663 565 1670 578 Q 1676 591 1689 601 Q 1702 611 1715 608 Q 1728 605 1741 597 Q 1754 589 1767 588 Q 1780 587 1793 584 Q 1806 582 1819 578 Q 1832 575 1844 580 Q 1856 585 1869 587 Q 1882 589 1893 592 Q 1904 595 1910 608 Q 1915 621 1908 632 Q 1900 644 1890 656 Q 1879 669 1878 680 Q 1876 692 1876 704 Q 1877 716 1877 718 T 1877 720",
  "M 25 693 Q 51 707 64 708 Q 76 709 89 701 Q 102 693 115 694 Q 128 694 141 692 Q 154 690 167 690 Q 180 690 193 696 Q 206 703 214 690 Q 223 677 236 670 Q 248 664 261 662 Q 274 660 287 660 Q 300 659 310 654 Q 321 649 331 640 Q 341 632 354 631 Q 367 630 380 632 Q 393 634 406 634 Q 419 635 432 636 Q 445 637 458 637 Q 471 637 484 637 Q 497 637 506 648 Q 514 658 526 669 Q 538 680 551 676 Q 564 671 577 668 Q 590 665 602 670 Q 614 675 627 674 Q 640 673 653 670 Q 666 667 679 666 Q 692 666 705 666 Q 718 665 731 660 Q 744 655 754 642 Q 763 630 776 625 Q 789 620 802 607 Q 815 594 828 592 Q 841 591 854 584 Q 867 576 880 575 Q 893 574 906 575 Q 919 576 932 576 Q 945 576 958 576 Q 971 577 982 567 Q 994 557 1000 544 Q 1007 531 1008 518 Q 1009 505 1022 496 Q 1034 486 1047 474 Q 1060 463 1073 453 Q 1086 443 1099 438 Q 1112 433 1125 434 Q 1138 434 1151 436 Q 1164 437 1177 439 Q 1190 441 1203 444 Q 1216 448 1229 451 Q 1242 454 1254 455 Q 1267 456 1280 450 Q 1292 444 1303 434 Q 1314 423 1327 420 Q 1340 418 1353 418 Q 1366 418 1379 416 Q 1392 413 1405 409 Q 1418 405 1430 412 Q 1443 420 1456 422 Q 1469 425 1482 432 Q 1495 439 1504 452 Q 1514 465 1524 478 Q 1534 491 1536 504 Q 1537 517 1544 529 Q 1550 541 1563 545 Q 1576 549 1588 554 Q 1600 560 1613 560 Q 1626 561 1638 560 Q 1650 559 1658 568 Q 1666 576 1676 589 Q 1687 602 1700 606 Q 1713 611 1726 605 Q 1739 599 1752 593 Q 1765 587 1778 585 Q 1791 583 1804 582 Q 1817 581 1829 578 Q 1841 576 1854 582 Q 1867 587 1880 586 Q 1893 586 1901 596 Q 1909 606 1912 619 Q 1914 632 1902 643 Q 1890 654 1882 667 Q 1875 680 1878 690 Q 1881 701 1879 710 T 1877 720",
  "M 25 693 Q 51 707 64 708 Q 76 709 89 701 Q 102 693 115 694 Q 128 694 141 692 Q 154 690 167 690 Q 180 690 193 696 Q 206 703 214 690 Q 223 677 236 678 Q 249 679 262 692 Q 275 705 288 718 Q 301 731 311 742 Q 321 754 334 766 Q 347 778 360 776 Q 373 775 386 787 Q 399 799 410 809 Q 421 819 434 820 Q 447 822 460 824 Q 473 827 476 838 Q 479 849 491 860 Q 503 872 516 875 Q 529 878 542 880 Q 555 883 557 895 Q 559 907 571 918 Q 583 930 586 943 Q 589 956 602 969 Q 615 982 628 990 Q 641 997 654 995 Q 667 993 680 990 Q 693 987 706 984 Q 719 981 732 970 Q 745 960 756 950 Q 767 940 780 939 Q 793 938 806 934 Q 819 931 832 922 Q 844 912 854 905 Q 864 898 877 892 Q 890 885 902 878 Q 914 872 926 866 Q 938 861 951 852 Q 964 842 977 838 Q 990 834 1003 842 Q 1016 850 1020 863 Q 1024 876 1034 887 Q 1043 898 1056 900 Q 1069 902 1082 900 Q 1095 899 1108 899 Q 1121 899 1133 907 Q 1145 915 1158 918 Q 1170 921 1175 934 Q 1180 947 1193 953 Q 1206 959 1219 960 Q 1232 962 1243 974 Q 1254 985 1267 990 Q 1280 994 1293 1000 Q 1306 1005 1319 1008 Q 1332 1010 1345 1006 Q 1358 1001 1371 1004 Q 1384 1006 1397 1006 Q 1410 1006 1423 1008 Q 1436 1010 1449 1013 Q 1462 1016 1475 1018 Q 1488 1019 1501 1014 Q 1514 1008 1514 1021 Q 1515 1034 1504 1046 T 1492 1057",
  "M 1570 1070 Q 1544 1054 1536 1041 Q 1527 1028 1518 1018 Q 1508 1007 1495 1013 Q 1482 1019 1469 1016 Q 1456 1014 1443 1012 Q 1430 1009 1417 1008 Q 1404 1006 1391 1006 Q 1378 1006 1365 1003 Q 1352 1000 1339 1005 Q 1326 1010 1313 1008 Q 1300 1005 1287 998 Q 1274 991 1261 986 Q 1248 982 1237 971 Q 1226 960 1213 958 Q 1200 955 1189 948 Q 1178 941 1172 930 Q 1165 918 1152 916 Q 1139 914 1127 906 Q 1115 898 1102 900 Q 1089 901 1076 902 Q 1063 902 1050 898 Q 1037 893 1030 882 Q 1023 870 1016 857 Q 1010 844 997 840 Q 984 836 971 841 Q 958 846 945 854 Q 932 862 921 870 Q 910 877 897 882 Q 884 888 871 894 Q 858 900 848 909 Q 838 918 826 926 Q 813 935 800 937 Q 787 939 774 942 Q 761 945 750 956 Q 739 966 726 974 Q 713 983 700 986 Q 687 989 674 992 Q 661 995 648 996 Q 635 998 622 987 Q 609 976 597 963 Q 585 950 581 938 Q 577 925 567 913 Q 557 901 553 892 Q 549 883 536 880 Q 523 878 510 874 Q 497 869 487 856 Q 477 843 472 833 Q 467 823 454 822 Q 441 820 428 820 Q 415 819 404 806 Q 393 793 380 786 Q 367 778 354 775 Q 341 772 328 761 Q 315 750 305 738 Q 295 725 282 712 Q 269 699 256 686 Q 243 673 231 678 Q 219 683 210 692 Q 200 700 187 694 Q 174 689 161 690 Q 148 692 135 694 Q 122 696 109 698 Q 96 699 83 704 Q 70 710 58 706 Q 45 703 35 698 T 25 693",
  "M 1877 720 Q 1876 692 1878 680 Q 1879 669 1890 656 Q 1900 644 1908 632 Q 1915 621 1910 608 Q 1904 595 1893 592 Q 1882 589 1869 587 Q 1856 585 1844 580 Q 1832 575 1819 578 Q 1806 582 1793 584 Q 1780 587 1767 588 Q 1754 589 1741 597 Q 1728 605 1715 608 Q 1702 611 1689 601 Q 1676 591 1670 578 Q 1663 565 1651 562 Q 1639 558 1627 559 Q 1615 560 1602 557 Q 1589 554 1577 550 Q 1565 547 1552 540 Q 1539 532 1538 519 Q 1538 506 1534 493 Q 1529 480 1516 467 Q 1503 454 1494 443 Q 1484 432 1471 428 Q 1458 424 1446 419 Q 1433 414 1420 412 Q 1407 411 1394 412 Q 1381 414 1368 416 Q 1355 419 1342 420 Q 1329 420 1316 424 Q 1304 429 1293 442 Q 1282 454 1269 456 Q 1256 458 1244 454 Q 1231 449 1218 448 Q 1205 447 1192 442 Q 1179 438 1166 437 Q 1153 436 1140 434 Q 1127 433 1114 435 Q 1101 437 1088 442 Q 1075 448 1062 461 Q 1049 474 1036 484 Q 1024 495 1011 499 Q 998 503 985 506 Q 972 510 959 510 Q 946 511 933 512 Q 920 513 910 502 Q 901 490 888 492 Q 875 493 862 496 Q 849 498 846 510 Q 842 522 836 535 Q 830 548 820 558 Q 810 569 797 563 Q 784 557 771 556 Q 758 556 745 553 Q 732 550 719 547 Q 706 544 696 555 Q 686 566 673 567 Q 660 568 647 559 Q 634 550 621 538 Q 608 525 595 519 Q 582 513 574 500 Q 566 487 565 474 Q 564 461 574 454 Q 584 448 592 439 Q 601 430 614 417 Q 627 404 627 394 Q 627 383 614 380 Q 601 377 588 376 Q 575 374 562 378 Q 549 382 536 376 Q 523 370 514 357 Q 506 344 494 342 Q 481 340 470 339 Q 459 338 450 330 Q 440 322 428 324 Q 417 325 417 338 Q 417 351 408 361 Q 398 371 386 378 Q 374 385 361 390 Q 348 395 335 397 Q 322 399 309 402 Q 296 406 284 408 Q 271 411 258 412 Q 245 413 236 422 Q 227 431 228 442 Q 228 454 216 461 Q 203 468 190 472 Q 177 477 164 482 Q 152 488 139 490 Q 126 492 113 496 Q 100 500 87 510 Q 74 520 64 530 Q 53 541 46 554 Q 39 567 30 574 T 20 582",
];

type CarSpec = {
  color: string;
  accent: string;
  duration: number;
  delay: number;
  pathIdx: number;
  flip?: boolean;
  scale?: number;
};

const CARS: CarSpec[] = [
  { color: "#d83a2a", accent: "#7c1c10", duration: 24, delay: -2, pathIdx: 0, scale: 0.64 },
  { color: "#f5c542", accent: "#9c7a1c", duration: 27, delay: -11, pathIdx: 0, scale: 0.66 },
  { color: "#2b6ed8", accent: "#143f7c", duration: 23, delay: -8, pathIdx: 0, scale: 0.65 },
  { color: "#e8edf2", accent: "#8a8e94", duration: 25, delay: -17, pathIdx: 1, flip: true, scale: 0.62 },
  { color: "#12151a", accent: "#050607", duration: 28, delay: -6, pathIdx: 1, flip: true, scale: 0.62 },
  { color: "#3a8a48", accent: "#1c4a22", duration: 31, delay: -21, pathIdx: 2, scale: 0.6 },
  { color: "#d97a2a", accent: "#7a3a10", duration: 29, delay: -14, pathIdx: 2, scale: 0.62 },
  { color: "#b81c4a", accent: "#5c0a20", duration: 32, delay: -4, pathIdx: 3, flip: true, scale: 0.6 },
  { color: "#1a3a6a", accent: "#0a1c40", duration: 35, delay: -18, pathIdx: 3, flip: true, scale: 0.6 },
  { color: "#8f969e", accent: "#3a3e44", duration: 30, delay: -25, pathIdx: 0, flip: true, scale: 0.58 },
  { color: "#ff6b35", accent: "#8f2d10", duration: 34, delay: -13, pathIdx: 1, scale: 0.6 },
  { color: "#4ed6c5", accent: "#187266", duration: 33, delay: -22, pathIdx: 2, flip: true, scale: 0.58 },
];

const LAMPS: [number, number][] = [
  [420, 655], [600, 650], [805, 675], [1015, 680], [1240, 625], [1460, 560],
  [280, 855], [485, 805], [700, 790], [930, 795], [1160, 825], [1410, 860], [1645, 825],
  [645, 880], [682, 690], [1280, 880], [1275, 690],
];

function CarSVG({ color, accent, scale = 1 }: { color: string; accent: string; scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="8" rx="31" ry="14" fill="rgba(0,0,0,0.42)" />
      <path d="M -30 -10 C -24 -18 18 -18 28 -8 L 34 0 L 27 10 C 12 18 -20 17 -31 9 L -36 0 Z" fill={accent} opacity="0.95" />
      <path d="M -28 -12 C -18 -19 16 -18 28 -8 L 33 0 L 26 9 C 11 15 -18 15 -30 8 L -35 0 Z" fill={color} />
      <path d="M -10 -12 L 13 -11 C 19 -8 22 -4 23 0 C 20 5 16 8 10 10 L -12 10 C -18 7 -20 4 -21 0 C -20 -5 -17 -9 -10 -12 Z" fill="#101b2b" opacity="0.94" />
      <path d="M 12 -10 C 20 -8 25 -4 27 0 C 24 3 20 6 12 8 L 8 2 L 8 -6 Z" fill="#d8f2ff" opacity="0.34" />
      <path d="M -13 -10 C -20 -8 -24 -4 -25 0 C -23 4 -19 7 -13 8 L -9 3 L -9 -6 Z" fill="#d8f2ff" opacity="0.22" />
      <rect x="10" y="-18" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="10" y="13" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="-24" y="-17" width="12" height="5" rx="2" fill="#08090b" />
      <rect x="-24" y="12" width="12" height="5" rx="2" fill="#08090b" />
      <circle cx="33" cy="-5" r="2.2" fill="#fff7c0" />
      <circle cx="33" cy="5" r="2.2" fill="#fff7c0" />
      <circle cx="-32" cy="-5" r="2" fill="#ff3028" />
      <circle cx="-32" cy="5" r="2" fill="#ff3028" />
      <path d="M -3 -9 C 7 -10 17 -7 23 -2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.22" />
    </g>
  );
}

function TowTruckSVG({ color, accent }: { color: string; accent: string }) {
  return (
    <g transform="scale(0.72)">
      <ellipse cx="0" cy="9" rx="44" ry="17" fill="rgba(0,0,0,0.46)" />
      <path d="M -45 -13 L 5 -17 L 12 15 L -42 16 Z" fill="#262b30" />
      <path d="M -38 -9 L -3 -11 L 1 10 L -35 11 Z" fill="#6b4a35" />
      <path d="M 8 -16 L 42 -12 L 46 11 L 12 16 Z" fill={color} />
      <path d="M 19 -12 L 39 -9 L 40 7 L 20 10 Z" fill="#0c1a2e" opacity="0.95" />
      <path d="M -2 -17 L -20 -30" stroke="#ffb22e" strokeWidth="5" strokeLinecap="round" />
      <circle cx="24" cy="-18" r="5" fill="#ffae00">
        <animate attributeName="opacity" values="1;0.25;1" dur="0.42s" repeatCount="indefinite" />
      </circle>
      <rect x="-31" y="-22" width="13" height="6" rx="2" fill="#07080a" />
      <rect x="-31" y="15" width="13" height="6" rx="2" fill="#07080a" />
      <rect x="18" y="-22" width="13" height="6" rx="2" fill="#07080a" />
      <rect x="18" y="15" width="13" height="6" rx="2" fill="#07080a" />
      <circle cx="46" cy="-5" r="2.8" fill="#fff7c0" />
      <circle cx="46" cy="6" r="2.8" fill="#fff7c0" />
      <line x1="13" y1="0" x2="42" y2="0" stroke={accent} strokeWidth="1.2" opacity="0.7" />
    </g>
  );
}

function Lamp({ x, y, night }: { x: number; y: number; night: number }) {
  const lit = night > 0.32;
  return (
    <g transform={`translate(${x},${y})`}>
      {lit && (
        <circle r="46" fill="#ffd66a" opacity={night * 0.28}>
          <animate attributeName="opacity" values={`${night * 0.2};${night * 0.36};${night * 0.2}`} dur="3s" repeatCount="indefinite" />
        </circle>
      )}
      <path d="M 0 30 L 0 0 L -18 -7" stroke="#191b1f" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="-20" cy="-7" r="6" fill={lit ? "#fff5b0" : "#4f5148"} />
      {lit && <circle cx="-20" cy="-7" r="12" fill="#ffd66a" opacity="0.35" />}
    </g>
  );
}

export default function CityTraffic() {
  const [night, setNight] = useState(0.25);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = (performance.now() % 180000) / 180000;
      const daylight = Math.max(0, Math.sin(t * Math.PI * 2));
      setNight(0.18 + (1 - daylight) * 0.72);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
    >
      <defs>
        {ROADS.map((d, i) => (
          <path key={i} id={`jce-road-${i}`} d={d} />
        ))}
        <filter id="jce-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <g opacity="0.12">
        {ROADS.map((d, i) => (
          <path key={i} d={d} stroke="#0b0d10" strokeWidth={i >= 4 ? 34 : 46} fill="none" strokeLinecap="round" />
        ))}
        {ROADS.slice(0, 4).map((d, i) => (
          <path key={`dash-${i}`} d={d} stroke="#f6d56a" strokeWidth="2.4" strokeDasharray="18 18" fill="none" opacity="0.72" />
        ))}
      </g>

      <g filter="url(#jce-soft-shadow)">
        {LAMPS.map(([x, y], i) => (
          <Lamp key={i} x={x} y={y} night={night} />
        ))}
      </g>

      {CARS.map((car, i) => (
        <g key={i} filter="url(#jce-soft-shadow)">
          <CarSVG color={car.color} accent={car.accent} scale={car.scale} />
          <animateMotion
            dur={`${car.duration}s`}
            begin={`${car.delay}s`}
            repeatCount="indefinite"
            rotate="auto"
            keyPoints={car.flip ? "1;0" : "0;1"}
            keyTimes="0;1"
          >
            <mpath href={`#jce-road-${car.pathIdx}`} />
          </animateMotion>
        </g>
      ))}

      <g filter="url(#jce-soft-shadow)">
        <TowTruckSVG color="#ff8800" accent="#7a3a00" />
        <animateMotion dur="34s" begin="-4s" repeatCount="indefinite" rotate="auto">
        <mpath href="#jce-road-0" />
        </animateMotion>
      </g>
      <g filter="url(#jce-soft-shadow)">
        <TowTruckSVG color="#f5c542" accent="#7a5a10" />
        <animateMotion dur="38s" begin="-19s" repeatCount="indefinite" rotate="auto" keyPoints="1;0" keyTimes="0;1">
          <mpath href="#jce-road-1" />
        </animateMotion>
      </g>

      <rect width="1920" height="1080" fill="#0a1530" opacity={night * 0.25} pointerEvents="none" />
    </svg>
  );
}