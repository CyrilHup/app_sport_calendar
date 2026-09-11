export interface TrainingPhaseDetail {
  id: string;
  name: string;
  shortTitle: string;
  period: string;
  weeks: string;
  volumePct: string;
  focus: string;
  location: string;
  why: string;
  whatHappens: string[];
  keyWorkouts: { title: string; desc: string; metrics: string }[];
  nutritionStrategy: string;
  badge: string;
}

export interface AidStation {
  name: string;
  km: string;
  elevation: string;
  elevationGain: string;
  crew: string;
  dropBag: string;
  notes: string;
}

export const QMT_PHASES: TrainingPhaseDetail[] = [
  {
    id: 'ramp_up',
    name: '1. Reprise & Fondations (Post-Coupure Estivale)',
    shortTitle: 'Reprise & Tendons',
    period: '1er sept. – 20 sept. 2026',
    weeks: '3 Semaines (Semaines -18 à -16)',
    volumePct: '55% ➔ 75% ➔ 90%',
    focus: 'Adaptation tendineuse & réveil aérobie',
    location: 'Mont-Royal, Parc Maisonneuve & Gym ÉTS',
    why: 'Éviter impérativement les périostites et tendinopathies après la coupure. Les tendons et le collagène mettent 3 fois plus de temps à s\'adapter que le système cardiovasculaire. Aucun pic d\'intensité maximale.',
    whatHappens: [
      'Semaine 1 (55%) : Sortie de côte contrôlée 45 min, sortie longue trail 1h15, repos complet le dimanche.',
      'Semaine 2 (75%) : Progression graduelle du volume avec ajout d\'un footing aérobie le dimanche (40 min).',
      'Semaine 3 (90%) : Sortie trail weekend 1h50, 5 séances stabilisées avec renforcement calisthénie au Gym ÉTS.'
    ],
    keyWorkouts: [
      {
        title: 'Répétitions de Côtes D+ (Mont-Royal)',
        desc: 'Montées régulières en Zone 3/4 avec descentes marchées pour limiter les micro-lésions musculaires excentriques.',
        metrics: '45-55 min • +300-380m D+ • FC 165-175 bpm'
      },
      {
        title: 'Sortie Longue Weekend (Boucles Mont-Royal)',
        desc: 'Course aérobie continue sur sentiers terreux. Test de base du sac et des chaussures.',
        metrics: '1h15 - 1h50 • +400-500m D+ • FC < 155 bpm'
      },
      {
        title: 'Calisthénie & Gainage (Gym ÉTS)',
        desc: 'Tractions, dips, pompes et gainage hollow body pour stabiliser la colonne sous le portage du sac.',
        metrics: '45-60 min • Tonus postural'
      }
    ],
    nutritionStrategy: 'Hydratation de base : 500 mL d\'eau/heure. 30g de glucides/h sur les sorties du weekend pour habituer l\'estomac.',
    badge: 'Phase Actuelle'
  },
  {
    id: 'autumn_consolidation',
    name: '2. Consolidation Aérobie & Force Automnale',
    shortTitle: 'Base Aérobie & Force',
    period: '21 sept. – 20 déc. 2026',
    weeks: 'Session d\'automne ÉTS (13 Semaines)',
    volumePct: '85% Volume Régulier',
    focus: 'Endurance de base (Zone 2) & Robustesse articulaire',
    location: 'Mont-Royal, Escaliers & Gym ÉTS',
    why: 'Développer la densité mitochondriale dans les fibres lentes tout en gérant les examens de l\'ÉTS. L\'oxydation des lipides est optimale sous 155 bpm.',
    whatHappens: [
      'Rythme hebdomadaire stable de 5 séances calées autour des cours universitaires.',
      'Montées d\'escaliers au Mont-Royal (escalier de 200 marches) pour blinder les chevilles et les genoux.',
      'Sorties longues plafonnées à 2h15 pour éviter l\'immunosuppression pendant les périodes de mi-session.'
    ],
    keyWorkouts: [
      {
        title: 'Montées d\'Escaliers & Pente Forte (Mont-Royal)',
        desc: 'Tempo régulier en escaliers avec technique ultra (mains sur les cuisses), simulation de marche active en pente.',
        metrics: '60 min • +500m D+ • FC 168-180 bpm'
      },
      {
        title: 'Sortie Aérobie Fondamentale Zone 2',
        desc: 'Course en aisance respiratoire totale (respiration nasale). Enseigne aux muscles à brûler les graisses.',
        metrics: '50-60 min • Plat/vallonné • FC < 148 bpm'
      },
      {
        title: 'Renforcement Excentrique Quadriceps & Mollets',
        desc: 'Fentes bulgares, squats tempo lents, montées sur pointes de pieds avec charge.',
        metrics: '45 min • Résistance aux descentes'
      }
    ],
    nutritionStrategy: '40-50g de glucides/heure sur les sorties de plus de 90 min. Apport protéique élevé post-renforcement (1,6g/kg).',
    badge: 'Base Automne'
  },
  {
    id: 'winter_power',
    name: '3. Puissance Hivernale & Pente (Tapis & Musculation)',
    shortTitle: 'Puissance & D+ Hiver',
    period: '11 janv. – 21 févr. 2027',
    weeks: 'Semaines 1 à 6 (Hiver)',
    volumePct: '80% ➔ 95% (S4 Décharge 70%)',
    focus: 'Puissance ascensionnelle spécifique & Zéro risque de chute',
    location: 'Gym ÉTS (Tapis Incliné 15% D+) & Piste',
    why: 'La neige et le verglas montréalais rendent les intervalles de côte extérieurs risqués. Le tapis incliné à 12-15% supprime tout risque de glissade tout en développant la VAM et le souffle.',
    whatHappens: [
      'Intervalles au seuil sur tapis incliné : 12-15% de pente à 5,5 - 6,5 km/h.',
      'Travail lourd de la chaîne postérieure : soulevés de terre roumains, step-ups sur banc, fentes marchées.',
      'Semaine 4 en décharge obligatoire : volume réduit à 70% pour assimiler la charge musculaire.'
    ],
    keyWorkouts: [
      {
        title: 'Intervalles en Pente sur Tapis (Gym ÉTS)',
        desc: '15 min échauffement + 6x 3 min @ 15% de pente (Z4 FC 172-185 bpm) avec 2 min de récupération.',
        metrics: '55 min • +450m D+ simulé • VAM élevée'
      },
      {
        title: 'Musculation Lourde & Chaîne Postérieure',
        desc: 'Trap bar deadlifts, montées sur box lestées (40cm), descentes lentes sur une jambe.',
        metrics: '60 min • Recrutement de force max'
      },
      {
        title: 'Footing Long Aérobie Déneigé',
        desc: 'Appuis sûrs sur boucles plates déneigées au Parc Maisonneuve.',
        metrics: '1h45 - 2h15 • FC < 152 bpm'
      }
    ],
    nutritionStrategy: 'Électrolytes obligatoires même en intérieur en raison de la forte transpiration sur tapis. 50g glucides/h.',
    badge: 'Bloc Hiver'
  },
  {
    id: 'volume_wec',
    name: '4. Volume & Week-ends Chocs (WEC)',
    shortTitle: 'Volume & Chocs WEC',
    period: '22 févr. – 2 mai 2027',
    weeks: 'Semaines 7 à 16 (10 Semaines)',
    volumePct: '95% ➔ 115% (S8, S12, S16 Décharges)',
    focus: 'Résistance à la fatigue neuromusculaire & Cumul WEC',
    location: 'Mont-Royal & Massifs Régionaux',
    why: 'En ultra-trail, la victoire appartient aux jambes capables de continuer à avancer efficacement après 10 heures d\'effort. Les week-ends chocs (grosse sortie samedi + sortie sur fatigue dimanche) créent cette adaptation.',
    whatHappens: [
      'Sorties longues du samedi : de 2h30 jusqu\'à 4h30 sur terrain accidenté.',
      'Sorties du dimanche : 60 à 80 min courues strictement en Zone 2 sur des quadriceps déjà entamés.',
      'Test réel du sac de 5L avec flasques avant et matériel obligatoire au poids de course.'
    ],
    keyWorkouts: [
      {
        title: 'Choc Montagne du Samedi (WEC 1)',
        desc: 'Course continue en sentier technique avec marche active dans les fortes pentes. Test obligatoire du sac de 5L.',
        metrics: '3h00 - 4h30 • +800-1100m D+ • FC < 155 bpm'
      },
      {
        title: 'Footing Aérobie sur Fatigue (WEC 2)',
        desc: 'Course sur jambes lourdes. Reproduit fidèlement les sensations musculaires du 50e kilomètre du QMT.',
        metrics: '60-80 min • Sentiers roulants • FC < 148 bpm'
      },
      {
        title: 'Répétitions de Côtes au Mont-Royal',
        desc: 'Ascensions dynamiques avec technique des mains sur les genoux.',
        metrics: '60 min • +500m D+ • Zone 4 au seuil'
      }
    ],
    nutritionStrategy: 'Simulation stricte des conditions de course : 60g de glucides/h + 500-600 mL de liquide/h avec 450 mg de sodium.',
    badge: 'Volume WEC'
  },
  {
    id: 'mestachibo_peak',
    name: '5. Pic Spécifique & Canyon du Mestachibo',
    shortTitle: 'Spécifique Mestachibo',
    period: '3 mai – 6 juin 2027',
    weeks: 'Semaines 17 à 21 (5 Semaines)',
    volumePct: '110% ➔ 125% Volume Pic',
    focus: 'Passages rocheux extrêmes, rangement des bâtons & allure course',
    location: 'Sentiers Techniques de Montagne & Escaliers',
    why: 'Le sentier Mestachibo (KM 57 à 67 du QMT) est réputé pour ses dalles de granit glissantes, ses passerelles suspendues et ses échelles où les bâtons sont interdits. Ce bloc renforce la proprioception de cheville et le franchissement rocheux.',
    whatHappens: [
      'Sorties techniques avec transitions rapides (plier et ranger ses bâtons sur le sac 5L tout en courant).',
      'Exercices de proprioception sur une jambe pour prévenir toute entorse sur roche humide.',
      'Sortie longue pic : 5h00 avec sac de 5L rempli de tout le matériel obligatoire.'
    ],
    keyWorkouts: [
      {
        title: 'Terrain Rocheux Technique & Simulation Blocs',
        desc: 'Franchissement de racines, lits de rivières asséchés et lacets raides. Entraînement au portage des bâtons pliés.',
        metrics: '4h00 - 5h00 • +1200m D+ • Sac complet'
      },
      {
        title: 'Stabilité de Cheville & Agilité Dynamique',
        desc: 'Équilibre monopodal, pliométrie latérale, descentes lentes sur mollets et gainage anti-rotation.',
        metrics: '45 min • Prévention des blessures'
      },
      {
        title: 'Allure Spécifique Sentier Mestachibo',
        desc: 'Cadence élevée, foulée courte et vive sur terrain chaotique.',
        metrics: '75 min • +400m D+'
      }
    ],
    nutritionStrategy: '60 à 70g de glucides/h testés sous stress gastrique. Test d\'aliments solides (barres, gaufres, purées salées).',
    badge: 'Pic Spécifique'
  },
  {
    id: 'tapering',
    name: '6. Affûtage, Fraîcheur & Semaine de Course (QMT-80)',
    shortTitle: 'Affûtage & Course QMT',
    period: '7 juin – 3 juil. 2027',
    weeks: 'Semaines 22 à 24 (3 Semaines)',
    volumePct: '60% ➔ 40% ➔ 25%',
    focus: 'Surcompensation glycogénique & Fraîcheur neuromusculaire',
    location: 'Sentiers Souples & Récupération Active',
    why: 'Éliminer 80% de la fatigue accumulée tout en conservant 100% de la capacité aérobie et de la force. Arriver au Quai de Petite-Rivière avec des stocks de glycogène saturés et des fibres musculaires intactes.',
    whatHappens: [
      'Réduction drastique du volume : -40% en S22, -60% en S23 et -75% en semaine de course.',
      'Maintien de lignes droites vives de 20 secondes pour préserver la réactivité nerveuse.',
      'Protocole de recharge glucidique dans les 48 heures précédant le départ (8 à 10g de glucides/kg).'
    ],
    keyWorkouts: [
      {
        title: 'Footing d\'Affûtage avec Lignes Droites',
        desc: '35 min de footing très lent de décrassage + 4x 20s d\'accélérations progressives sur herbe plate.',
        metrics: '35 min • Pure fraîcheur'
      },
      {
        title: 'Dernière Vérification Sac de Course & Matériel',
        desc: 'Footing de 20 min avec le sac de 5L chargé de tout le matériel obligatoire pour valider l\'absence totale de ballotement.',
        metrics: '20 min • Validation matériel'
      },
      {
        title: '🏁 JOUR DE COURSE QMT-80 (Samedi 3 Juillet 2027)',
        desc: '77 km • +3 370m D+ • Petite-Rivière ➔ Massif ➔ Caps ➔ Saint-Tite ➔ Mestachibo ➔ Mont-Sainte-Anne.',
        metrics: '77 km • Limite 19h • Ligne d\'arrivée'
      }
    ],
    nutritionStrategy: 'Recharge glucidique de J-3 à J-1. Jour de course : 60g de glucides/h, 500-750 mL de liquide/h, capsules de sels.',
    badge: 'Semaine de Course'
  }
];

export const QMT_AID_STATIONS: AidStation[] = [
  {
    name: 'Départ — Quai de Petite-Rivière',
    km: 'KM 0',
    elevation: '0 m',
    elevationGain: '0 m',
    crew: 'Assistance autorisée',
    dropBag: 'Non',
    notes: 'Départ au bord du fleuve Saint-Laurent. Navette obligatoire à 3h30 AM au Mont-Sainte-Anne.'
  },
  {
    name: 'R1 — Le Massif de Charlevoix',
    km: 'KM 14,5',
    elevation: '721 m',
    elevationGain: '+750 m',
    crew: 'Assistance autorisée',
    dropBag: 'Non',
    notes: 'Fin de la terrible ascension initiale mer-sommet. Premier plein d\'eau et de ravitaillement.'
  },
  {
    name: 'R2 — Cap du Salut',
    km: 'KM 30,0',
    elevation: '573 m',
    elevationGain: '+1 350 m',
    crew: 'Isolé (Aucune assistance)',
    dropBag: 'Non',
    notes: 'Sentier des Caps, falaises côtières. Zone 100% sauvage en autonomie complète.'
  },
  {
    name: 'R3 — Cap Gribane',
    km: 'KM 44,0',
    elevation: '568 m',
    elevationGain: '+1 950 m',
    crew: 'Isolé (Aucune assistance)',
    dropBag: 'Non',
    notes: 'Dalles de granit glissantes et racines denses. Bien faire le plein d\'eau avant les 13 km vers Saint-Tite.'
  },
  {
    name: 'R4 — Saint-Tite-des-Caps',
    km: 'KM 57,0',
    elevation: '327 m',
    elevationGain: '+2 400 m',
    crew: 'Assistance autorisée',
    dropBag: 'SAC DE DÉLESTAGE (Drop Bag)',
    notes: 'POSTE CHARNIÈRE. Contrôle obligatoire de la lampe frontale. Manger solide, changer de chaussettes et plier ses bâtons.'
  },
  {
    name: 'R5 — Sentier Mestachibo',
    km: 'KM 67,0',
    elevation: '137 m',
    elevationGain: '+2 750 m',
    crew: 'Isolé (Aucune assistance)',
    dropBag: 'Non',
    notes: 'Gorges de la rivière, ponts suspendus, chaos rocheux. ⚠️ BÂTONS STRICTEMENT INTERDITS (doivent être rangés).'
  },
  {
    name: 'Arrivée — Mont-Sainte-Anne',
    km: 'KM 77,0',
    elevation: '177 m',
    elevationGain: '+3 370 m',
    crew: 'Arche d\'Arrivée',
    dropBag: 'Retour des sacs',
    notes: 'Montée finale sur les flancs du MSA, passage sur la crête et descente vers l\'arche d\'arrivée. Barrière : 19h.'
  }
];

export const QMT_MANDATORY_GEAR_ITEMS = [
  'Capacité minimale d’eau de 1,0 Litre (2 flasques 500 mL)',
  'Couverture de survie officielle (1,4 m x 2,0 m minimum)',
  'Sifflet de sécurité intégré au sac ou attaché',
  'Téléphone cellulaire chargé (enregistrer le numéro d’urgence QMT)',
  'Bandage de compression auto-adhésif (3 pouces x 48 pouces / 7,5cm x 1,2m)',
  'Lampe frontale (300+ lm) + batterie de rechange (exigée dès Saint-Tite)',
  'Gobelet réutilisable ou Ecocup (aucun verre jetable aux ravitos)',
  'Casquette, bandeau ou buff pour protection solaire',
  'Réserve alimentaire énergétique (gels, barres pour 3-4h d’autonomie)',
  'Épipen (obligatoire seulement si allergies connues guêpes/aliments)'
];
