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
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="glass-panel" style={{ padding: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Point de départ observé</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {runBaseline.runCount28d} courses et {runBaseline.runKm28d} km enregistrés sur 28 jours ; plus longue sortie sur 30 jours : {runBaseline.longestRunMinutes30d ?? 'inconnue'} min.
          Les séances des deux prochaines semaines sont ajustées à cet historique ; les phases lointaines restent des intentions à réévaluer.
        </p>
      </div>
      <div className="glass-panel" style={{ padding: 16 }}>
        <h3 style={{ marginBottom: 8 }}>3 séances de renforcement conseillées dans le calendrier, 4e facultative</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Le calendrier propose des jours et horaires de départ, déplaçables selon tes cours, ta fatigue et tes douleurs. Cette semaine, {strengthSessionsThisWeek} séance(s) sont reconnues ; {strengthSessionsLast28d} sur les 28 derniers jours.
          Si trois séances dépassent votre habitude récente, commencez par des formats courts et augmentez surtout selon la récupération réelle.
          Place la séance jambes quand tu peux récupérer avant la prochaine séance de côtes ou sortie longue ; évite de cumuler deux grosses sollicitations des jambes si la fatigue persiste.
          {context.isDeload || isTaper ? ' En décharge et à l’affûtage, conserve le rythme si tu le tolères, avec moins de séries et aucune nouvelle charge lourde.' : ''}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 8 }}>
          Le compteur dépend des activités enregistrées et de leur intitulé ; une séance non synchronisée peut manquer.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {strengthMenu.map((item, index) => (
          <div className="glass-panel" key={item.name} style={{ padding: 14 }}>
            <strong>{index + 1}. {item.name}</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5, marginTop: 6 }}>{item.plan}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Endurance : priorité à la course spécifique, options de salle</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Garde une séance de côtes contrôlée, un footing facile et une sortie longue adaptée au bloc et à tes sorties récentes. Le second footing du week-end reste facultatif, y compris en phase spécifique, et saute si les jambes sont douloureuses ou la récupération basse.
        </p>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 20, marginTop: 8 }}>
          <li><strong>Tapis incliné :</strong> alternative aux côtes extérieures quand l’appui est glissant ; ajuste la pente et la vitesse à l’effort perçu.</li>
          <li><strong>Vélo facile :</strong> alternative ponctuelle à un footing facile pour l’endurance avec moins d’impacts de course ; il ne remplace pas la pratique spécifique du trail.</li>
          <li><strong>Stairmaster :</strong> option de marche en montée ; commence court et progressif. Il ne prépare pas à lui seul les descentes techniques.</li>
        </ul>
      </div>

      <div className="glass-panel" style={{ padding: 16, borderColor: 'rgba(245, 158, 11, 0.35)' }}>
        <strong>Signal d’arrêt</strong>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 6 }}>
          Une douleur qui augmente, modifie la foulée, persiste après l’effort ou une fatigue inhabituelle appelle une réduction ou un arrêt de la séance et, si elle persiste, un avis clinique. Les scores Garmin et de charge ne remplacent pas ce signal.
        </p>
      </div>
    </div>
  );
};
