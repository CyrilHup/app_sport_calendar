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
    weeks: '3 semaines de reprise (septembre 2026)',
    volumePct: '55% ➔ 75% ➔ 90%',
    focus: 'Adaptation tendineuse & réveil aérobie',
    location: 'Mont-Royal, Parc Maisonneuve & Gym ÉTS',
    why: 'Après une coupure, repartir de la charge réellement tolérée et augmenter progressivement les sollicitations de course. Suivre les douleurs et la récupération plutôt que supposer une vitesse universelle d\'adaptation des tissus.',
    whatHappens: [
      'Semaine 1 (55%) : Sortie de côte contrôlée 45 min, sortie longue trail 1h15, repos complet le dimanche.',
      'Semaine 2 : progression graduelle du volume ; footing du dimanche seulement si bien récupéré.',
      'Semaine 3 : consolider la sortie longue et les séances libres de renforcement selon les sorties réellement tolérées.'
    ],
    keyWorkouts: [
      {
        title: 'Répétitions de Côtes D+ (Mont-Royal)',
        desc: 'Montées régulières en Zone 3/4 avec descentes marchées pour limiter les micro-lésions musculaires excentriques.',
        metrics: '45-55 min indicatives • D+ progressif • effort contrôlé'
      },
      {
        title: 'Sortie Longue Weekend (Boucles Mont-Royal)',
        desc: 'Course aérobie continue sur sentiers terreux. Test de base du sac et des chaussures.',
        metrics: 'Durée ajustée au plus long effort récent • allure conversationnelle'
      },
      {
        title: 'Calisthénie & Gainage (Gym ÉTS)',
        desc: 'Tractions, dips, pompes et gainage hollow body pour stabiliser la colonne sous le portage du sac.',
        metrics: '45-60 min • Tonus postural'
      }
    ],
    nutritionStrategy: 'Sur les sorties longues, tester progressivement un apport en glucides et une boisson selon la soif, la chaleur et la tolérance digestive.',
    badge: 'Reprise'
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
    why: 'Construire une base aérobie à une intensité conversationnelle individualisée, compatible avec les cours et la récupération. Un seuil universel de 155 bpm ne définit pas la bonne intensité pour chaque séance.',
    whatHappens: [
      'Séances de course planifiées autour des cours ; trois séances de renforcement librement placées, quatrième facultative.',
      'Escaliers ou Stairmaster possibles pour travailler la montée, en augmentant progressivement la durée.',
      'Durée des sorties longues ajustée aux sorties déjà tolérées et à la récupération, surtout pendant les examens.'
    ],
    keyWorkouts: [
      {
        title: 'Montées d\'Escaliers & Pente Forte (Mont-Royal)',
        desc: 'Tempo régulier en escaliers avec technique ultra (mains sur les cuisses), simulation de marche active en pente.',
        metrics: 'Durée et D+ progressifs • montée contrôlée'
      },
      {
        title: 'Sortie Aérobie Fondamentale Zone 2',
        desc: 'Course à intensité conversationnelle ; alterner marche et course si nécessaire.',
        metrics: '50-60 min indicatives • Plat/vallonné • aisance respiratoire'
      },
      {
        title: 'Renforcement Excentrique Quadriceps & Mollets',
        desc: 'Fentes bulgares, squats tempo lents, montées sur pointes de pieds avec charge.',
        metrics: '45 min • Résistance aux descentes'
      }
    ],
    nutritionStrategy: 'Sur les sorties de plus de 90 min, tester des apports glucidiques réguliers et noter la tolérance. Prévoir une alimentation suffisante pour la récupération.',
    badge: 'Base Automne'
  },
  {
    id: 'winter_power',
    name: '3. Puissance Hivernale & Pente (Tapis & Musculation)',
    shortTitle: 'Puissance & D+ Hiver',
    period: '11 janv. – 21 févr. 2027',
    weeks: 'Semaines 1 à 6 (Hiver)',
    volumePct: '80% ➔ 95% (S4 Décharge 70%)',
    focus: 'Puissance ascensionnelle spécifique et appuis maîtrisés',
    location: 'Gym ÉTS (Tapis Incliné 15% D+) & Piste',
    why: 'Le tapis incliné permet de travailler la montée lorsque les appuis extérieurs sont glissants. Il évite cette exposition précise, sans supprimer tous les risques ni remplacer la technique de descente.',
    whatHappens: [
      'Intervalles sur tapis incliné : pente et vitesse ajustées à la technique et à l’effort perçu.',
      'Travail progressif de la chaîne postérieure : charnière de hanche, step-ups et fentes selon la maîtrise.',
      'Prévoir une semaine de charge réduite si la fatigue s’accumule ; adapter selon les données réelles.'
    ],
    keyWorkouts: [
      {
        title: 'Intervalles en Pente sur Tapis (Gym ÉTS)',
        desc: 'Échauffement progressif, répétitions en pente bien contrôlées et retour au calme. Ajuster les répétitions à la forme du jour.',
        metrics: 'Durée indicative • pente adaptée • sans D+ fictif'
      },
      {
        title: 'Musculation progressive & chaîne postérieure',
        desc: 'Trap bar deadlifts, montées sur box lestées (40cm), descentes lentes sur une jambe.',
        metrics: 'Séries et charge ajustées • technique prioritaire'
      },
      {
        title: 'Footing Long Aérobie Déneigé',
        desc: 'Appuis sûrs sur boucles plates déneigées au Parc Maisonneuve.',
        metrics: 'Durée ajustée à l’historique • effort facile'
      }
    ],
    nutritionStrategy: 'Sur tapis ou en salle, adapter boisson et glucides à la durée, à la chaleur et à la transpiration réelle ; les électrolytes ne sont pas systématiquement nécessaires.',
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
    why: 'Les sorties longues entraînent la durée, le ravitaillement et le terrain spécifique. Une seconde sortie sur fatigue peut être utile si la première a été bien tolérée ; elle reste facultative.',
    whatHappens: [
      'Sorties longues sur terrain varié : allonger seulement après tolérance vérifiée des étapes précédentes.',
      'Second footing du week-end facultatif, facile et supprimé si douleur, forte fatigue ou récupération basse.',
      'Test réel du sac de 5L avec flasques avant et matériel obligatoire au poids de course.'
    ],
    keyWorkouts: [
      {
        title: 'Choc Montagne du Samedi (WEC 1)',
        desc: 'Course continue en sentier technique avec marche active dans les fortes pentes. Test obligatoire du sac de 5L.',
        metrics: 'Pic de durée et de D+ conditionnel aux sorties précédentes bien tolérées'
      },
      {
        title: 'Footing Aérobie sur Fatigue (WEC 2)',
        desc: 'Deuxième sortie facultative à faible intensité, seulement après une première sortie bien récupérée.',
        metrics: 'Durée courte et facile • sentiers roulants'
      },
      {
        title: 'Répétitions de Côtes au Mont-Royal',
        desc: 'Ascensions dynamiques avec technique des mains sur les genoux.',
        metrics: 'Volume et D+ selon l’historique • effort contrôlé'
      }
    ],
    nutritionStrategy: 'Répéter le ravitaillement de course sur les longues sorties : quantité de glucides et de boisson progressivement testée, adaptée à la soif, au climat et à la tolérance.',
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
    why: 'Préparer progressivement les appuis, les descentes et la gestion du matériel sur terrain proche de la course, selon les règles et le parcours officiels à confirmer pour l\'édition visée.',
    whatHappens: [
      'Sorties techniques avec transitions rapides (plier et ranger ses bâtons sur le sac 5L tout en courant).',
      'Exercices de proprioception sur une jambe pour prévenir toute entorse sur roche humide.',
      'Sortie longue de pic seulement si les étapes précédentes ont été tolérées ; tester le matériel prévu pour la course.'
    ],
    keyWorkouts: [
      {
        title: 'Terrain Rocheux Technique & Simulation Blocs',
        desc: 'Franchissement de racines, lits de rivières asséchés et lacets raides. Entraînement au portage des bâtons pliés.',
        metrics: 'Durée et D+ individualisés • matériel de course testé'
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
    nutritionStrategy: 'Tester le plan glucidique visé pour la course et les aliments solides sur terrain spécifique ; éviter toute hausse brusque des quantités ou nouveaux produits le jour J.',
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
    why: 'Réduire le volume avant la course pour favoriser la fraîcheur, tout en gardant de brèves sollicitations familières si elles sont bien tolérées. Aucun pourcentage individuel de récupération ne peut être garanti.',
    whatHappens: [
      'Réduction drastique du volume : -40% en S22, -60% en S23 et -75% en semaine de course.',
      'Maintien de lignes droites vives de 20 secondes pour préserver la réactivité nerveuse.',
      'Finaliser avec un professionnel si nécessaire la stratégie alimentaire pré-course déjà testée à l’entraînement.'
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
    nutritionStrategy: 'Finaliser seulement un plan de ravitaillement déjà toléré à l’entraînement. Adapter les boissons aux conditions et éviter de boire au-delà de la soif ou des pertes estimées.',
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
  'Capacité de transporter au moins 1 litre d’eau',
  'Réserve d’aliments et de compléments énergétiques',
  'Couverture de survie de 1,4 m × 2,0 m minimum',
  'Téléphone cellulaire',
  'Bandage de compression auto-adhésif (3 pouces x 48 pouces / 7,5cm x 1,2m)',
  'Lampe frontale à partir de Saint-Tite-des-Caps et batterie de rechange',
  'Casquette ou foulard pour la protection solaire',
  'Épipen si allergie aux piqûres de guêpes ou aux aliments'
];
