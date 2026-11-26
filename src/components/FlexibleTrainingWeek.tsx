import React from 'react';
import { PeriodizationContext } from '../types/calendar';
import { recentRunBaseline } from '../services/trainingBaseline';

interface Props {
  context: PeriodizationContext;
  strengthSessionsThisWeek: number;
  strengthSessionsLast28d: number;
  runBaseline: ReturnType<typeof recentRunBaseline>;
}

const strengthMenu = [
  {
    name: 'Jambes et mollets',
    plan: 'Squat ou presse, charnière de hanche, fente/step-up et mollets. Démarrer avec une charge maîtrisée et 1–2 séries ; augmenter progressivement selon les séances réellement tolérées.'
  },
  {
    name: 'Haut du corps : poussée et tirage',
    plan: 'Pompes/dips adaptés, tractions ou tirage, gainage. Garder de la marge avant l’échec musculaire.'
  },
  {
    name: 'Tronc, équilibre et contrôle unilatéral',
    plan: 'Gainage anti-rotation, équilibre sur une jambe, step-down contrôlé et travail du pied. Ajuster l’amplitude si douleur.'
  },
  {
    name: '4e séance facultative',
    plan: 'Courte séance de calisthénie haut du corps ou technique, seulement si les jambes et la récupération restent bonnes.'
  }
];

export const FlexibleTrainingWeek: React.FC<Props> = ({ context, strengthSessionsThisWeek, strengthSessionsLast28d, runBaseline }) => {
  const isTaper = context.phase === 'AFFUTAGE' || context.phase === 'RACE_WEEK';

  return (
    <div className="qmt-flexible-week">
      <div className="glass-panel qmt-week-panel">
        <h3>Point de départ</h3>
        <p>
          {runBaseline.runCount28d} courses et {runBaseline.runKm28d} km enregistrés sur 28 jours ; plus longue sortie sur 30 jours : {runBaseline.longestRunMinutes30d ?? 'inconnue'} min.
          Les deux prochaines semaines tiennent compte de cet historique ; les phases suivantes restent à réévaluer.
        </p>
      </div>
      <div className="glass-panel qmt-week-panel">
        <h3>Renforcement : 3 séances prévues, 4e facultative</h3>
        <p>
          Les jours et horaires sont déplaçables selon tes cours, ta fatigue et tes douleurs. {strengthSessionsThisWeek} séance(s) reconnue(s) cette semaine ; {strengthSessionsLast28d} sur 28 jours.
          Si trois séances dépassent ton habitude, commence par des formats courts et ajuste selon la récupération. Place la séance jambes assez tôt pour récupérer avant les côtes ou la sortie longue.
          {context.isDeload || isTaper ? ' En décharge ou à l’affûtage, garde le rythme si tu le tolères avec moins de séries et sans nouvelle charge lourde.' : ''}
        </p>
        <p className="qmt-week-note">
          Le compteur dépend des activités enregistrées et de leur intitulé ; une séance non synchronisée peut manquer.
        </p>
      </div>

      <div className="qmt-week-menu">
        {strengthMenu.map(item => (
          <div className="glass-panel qmt-week-panel" key={item.name}>
            <strong>{item.name}</strong>
            <p>{item.plan}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel qmt-week-panel">
        <h3>Course et options cardio</h3>
        <p>
          Garde une séance de côtes contrôlée, un footing facile et une sortie longue adaptée au bloc et à tes sorties récentes. Le second footing du week-end reste facultatif, y compris en phase spécifique, et saute si les jambes sont douloureuses ou la récupération basse.
        </p>
        <ul>
          <li><strong>Tapis incliné :</strong> alternative aux côtes extérieures quand l’appui est glissant ; ajuste la pente et la vitesse à l’effort perçu.</li>
          <li><strong>Vélo facile :</strong> alternative ponctuelle à un footing facile pour l’endurance avec moins d’impacts de course ; il ne remplace pas la pratique spécifique du trail.</li>
          <li><strong>Stairmaster :</strong> option de marche en montée ; commence court et progressif. Il ne prépare pas à lui seul les descentes techniques.</li>
        </ul>
      </div>

      <div className="glass-panel qmt-week-panel qmt-week-caution">
        <strong>Douleur ou fatigue inhabituelle</strong>
        <p>
          Une douleur qui augmente, modifie la foulée, persiste après l’effort ou une fatigue inhabituelle appelle une réduction ou un arrêt de la séance et, si elle persiste, un avis clinique. Les scores Garmin et de charge ne remplacent pas ce signal.
        </p>
      </div>
    </div>
  );
};
