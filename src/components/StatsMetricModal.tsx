import React from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Gauge,
  Heart,
  HelpCircle,
  Info,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';

export type StatsMetricTopic = 'acwr' | 'banister' | 'aei' | null;

interface StatsMetricModalProps {
  topic: StatsMetricTopic;
  onClose: () => void;
}

export const StatsMetricModal: React.FC<StatsMetricModalProps> = ({ topic, onClose }) => {
  if (!topic) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 18, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #111827 0%, #0c1220 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  topic === 'acwr'
                    ? 'rgba(245, 158, 11, 0.18)'
                    : topic === 'banister'
                    ? 'rgba(168, 85, 247, 0.18)'
                    : 'rgba(56, 189, 248, 0.18)',
                color:
                  topic === 'acwr'
                    ? '#f59e0b'
                    : topic === 'banister'
                    ? '#a855f7'
                    : '#38bdf8'
              }}
            >
              {topic === 'acwr' && <ShieldAlert size={20} />}
              {topic === 'banister' && <Gauge size={20} />}
              {topic === 'aei' && <Heart size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                {topic === 'acwr' && 'Modèle ACWR & Prévention des Blessures'}
                {topic === 'banister' && 'Modèle Banister : Fitness, Fatigue & Forme'}
                {topic === 'aei' && 'Efficacité Aérobie & Fréquence Cardiaque'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {topic === 'acwr' && 'Recherche scientifique du Dr Tim Gabbett (British Journal of Sports Medicine)'}
                {topic === 'banister' && 'Modélisation impulsion-réponse à deux composantes (Dr Eric Banister)'}
                {topic === 'aei' && 'Indice AEI & volume d\'éjection systolique'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            padding: '22px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            fontSize: '0.84rem',
            lineHeight: 1.55,
            color: 'var(--text-secondary)'
          }}
        >
          {topic === 'acwr' && (
            <>
              {/* Le concept clé */}
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px'
                }}
              >
                <div style={{ fontWeight: 800, color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={16} /> Qu'est-ce que le ratio ACWR ?
                </div>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                  L'<strong>ACWR</strong> (<em>Acute:Chronic Workload Ratio</em>) compare ce que votre corps a encaissé récemment (les <strong>7 derniers jours</strong>) par rapport à ce à quoi vos tendons et muscles sont habitués (la moyenne des <strong>28 derniers jours</strong>).
                </p>
              </div>

              {/* La formule mathématique */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  📐 Formule mathématique exacte :
                </div>
                <div
                  style={{
                    background: '#090d16',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    color: '#38bdf8',
                    textAlign: 'center',
                    border: '1px solid rgba(56, 189, 248, 0.2)'
                  }}
                >
                  ACWR = Charge Aiguë (7j d'impacts Trail) / Charge Chronique Hebdo (28j)
                </div>
              </div>

              {/* Pourquoi modifier vos séances futures change ce ratio ? */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HelpCircle size={16} color="var(--primary)" />
                  Pourquoi modifier vos prochaines séances impacte le calcul ?
                </div>
                <p style={{ margin: '0 0 8px 0' }}>
                  L'ACWR fonctionne en <strong>fenêtre temporelle glissante</strong>. Dès que vous planifiez ou déplacez une séance sur le calendrier, l'application projette mathématiquement la charge des 7 jours à venir.
                </p>
                <p style={{ margin: 0 }}>
                  Cela vous permet d'<strong>anticiper un pic de charge dangereux avant même d'enfiler vos chaussures</strong>, et d'ajuster une sortie longue trop volumineuse si le ratio dépasse 1.5 !
                </p>
              </div>

              {/* Pourquoi dissocier Course vs Calisthénie / Force */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="var(--accent-green)" />
                  Pourquoi la calisthénie / renforcement est isolée du risque de blessure ?
                </div>
                <p style={{ margin: '0 0 8px 0' }}>
                  En trail, les blessures de surcharge (tendinite d'Achille, syndrome de l'essuie-glace, périostite) sont provoquées par les <strong>ondes de choc répétées et les freinages excentriques</strong> des pas de course.
                </p>
                <p style={{ margin: 0 }}>
                  Vos séances de <strong>calisthénie</strong> (tractions, dips, gainage) et de mobilité ne créent <strong>aucun impact articulaire au sol</strong>. Elles sont donc comptabilisées dans votre fatigue générale (Banister), mais <strong>exclues du ratio ACWR de blessure tendineuse</strong> pour éviter les fausses alertes.
                </p>
              </div>

              {/* Les 4 Zones de Gabbett */}
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
                  🎯 Les 4 Zones d'Interprétation :
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(56, 189, 248, 0.08)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                    <strong style={{ color: '#38bdf8', minWidth: '85px' }}>&lt; 0.8</strong>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Sous-charge : </strong>
                      Risque de désentraînement ou d'atrophie tendineuse. Les tendons perdent leur rigidité protectrice.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(16, 185, 129, 0.1)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                    <strong style={{ color: '#10b981', minWidth: '85px' }}>0.8 – 1.3</strong>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Sweet Spot (Zone Optimale) : </strong>
                      Surcompensation idéale. Le risque de blessure est inférieur à 5%. Votre corps s'adapte sans casser.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(245, 158, 11, 0.1)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                    <strong style={{ color: '#f59e0b', minWidth: '85px' }}>1.3 – 1.5</strong>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Surcharge Modérée : </strong>
                      Progression rapide mais vigilance requise. Veillez au sommeil et à l'hydratation, surveillez les raideurs au réveil.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                    <strong style={{ color: '#ef4444', minWidth: '85px' }}>&gt; 1.5</strong>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Zone de Danger : </strong>
                      Le risque de blessure est multiplié par 2 à 4. Réduisez immédiatement le kilométrage de la semaine.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {topic === 'banister' && (
            <>
              {/* Le concept clé */}
              <div
                style={{
                  background: 'rgba(168, 85, 247, 0.08)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px'
                }}
              >
                <div style={{ fontWeight: 800, color: '#a855f7', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={16} /> Le Modèle Impulsion-Réponse du Dr Eric Banister
                </div>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                  Chaque entraînement produit simultanément deux effets physiologiques opposés : il <strong>développe votre condition physique</strong> (Fitness) mais <strong>génère de la fatigue</strong> (Fatigue). Votre forme réelle est la différence entre les deux.
                </p>
              </div>

              {/* Les 3 piliers CTL / ATL / TSB */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '12px 16px', borderLeft: '3px solid var(--accent-blue)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '4px' }}>
                    🔵 CTL — Chronic Training Load (« Fitness » / Constante 42 jours)
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>
                    Moyenne mobile exponentielle de votre charge quotidienne sur les <strong>6 dernières semaines</strong>. Il représente vos fondations aérobies profondes, la capillarisation et le volume cardiaque. Il monte lentement et décroît lentement.
                  </p>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '12px 16px', borderLeft: '3px solid var(--accent-amber)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '4px' }}>
                    🟠 ATL — Acute Training Load (« Fatigue » / Constante 7 jours)
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>
                    Moyenne mobile exponentielle sur <strong>7 jours</strong>. Il grimpe immédiatement après une grosse sortie longue ou une séance intense de côtes, mais s'élimine rapidement après 2 à 3 jours calmes.
                  </p>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '12px 16px', borderLeft: '3px solid var(--accent-green)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-green)', marginBottom: '4px' }}>
                    🟢 TSB — Training Stress Balance (« Forme » = CTL - ATL)
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>
                    Votre équilibre de fraîcheur athlétique. Si l'ATL dépasse le CTL, le TSB est <strong>négatif</strong>.
                  </p>
                </div>
              </div>

              {/* Comment interpréter le TSB */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  📊 Comment interpréter votre score TSB :
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>
                    <strong style={{ color: 'var(--accent-orange)' }}>TSB entre -10 et -30 (Phase de surcharge productive) :</strong> C'est exactement là où vous devez être pendant vos semaines de bloc d'entraînement ! Vous construisez du fitness.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--accent-red)' }}>TSB &lt; -30 (Risque d'épuisement) :</strong> Fatigue nerveuse excessive. Un repos de 48-72h est vivement conseillé.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--accent-green)' }}>TSB positif (+5 à +20) (Fraîcheur & Affûtage) :</strong> Votre état optimal pour le jour du <strong>QMT-80</strong>. La fatigue s'est dissipée (ATL basse) alors que le fitness (CTL) reste au sommet !
                  </li>
                </ul>
              </div>

              {/* Pourquoi les séances futures impactent la courbe */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} color="var(--primary)" />
                  Pourquoi vos futures séances modifient les courbes ?
                </div>
                <p style={{ margin: 0 }}>
                  Le modèle Banister projette l'impact des séances enregistrées dans votre calendrier. Si vous planifiez votre semaine de décharge ou d'affûtage (tapering), vous verrez immédiatement la courbe de <strong>TSB remonter dans le positif</strong>, validant la date idéale de votre pic de forme !
                </p>
              </div>
            </>
          )}

          {topic === 'aei' && (
            <>
              {/* Le concept clé */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px'
                }}
              >
                <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Heart size={16} /> L'Indice d'Efficacité Aérobie (AEI)
                </div>
                <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                  L'<strong>AEI</strong> (<em>Aerobic Efficiency Index</em>) mesure la distance que vous parcourez pour <strong>chaque battement de votre cœur</strong>.
                </p>
              </div>

              {/* Formule */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  📐 Formule de calcul :
                </div>
                <div
                  style={{
                    background: '#090d16',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    color: 'var(--accent-green)',
                    textAlign: 'center',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}
                >
                  AEI = Vitesse de déplacement (m/min) / Fréquence Cardiaque Moyenne (bpm)
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                  Exemple : À 10 km/h (166 m/min) avec une FC de 145 bpm = <strong>1.15 m / battement</strong>.
                </div>
              </div>

              {/* Baisse de FC à allure égale */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingDown size={16} color="var(--accent-green)" />
                  Pourquoi une FC en baisse est une victoire majeure ?
                </div>
                <p style={{ margin: '0 0 8px 0' }}>
                  Lorsque vous observez que votre FC moyenne diminue sur des allures similaires, cela prouve deux adaptations physiologiques majeures :
                </p>
                <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>
                    <strong>Hypertrophie du ventricule gauche :</strong> Votre cœur éjecte plus de sang à chaque battement (volume d'éjection systolique accru).
                  </li>
                  <li>
                    <strong>Densité mitochondriale accrue :</strong> Vos fibres musculaires utilisent les lipides avec une économie d'oxygène accrue, économisant vos réserves de glycogène pour les 77 km du QMT.
                  </li>
                </ol>
              </div>

              {/* Importance de la Zone 2 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={16} color="var(--primary)" />
                  Le rôle clé de la Zone 2 (&lt; 155 bpm)
                </div>
                <p style={{ margin: 0 }}>
                  Consacrer au moins <strong>75% à 80%</strong> de vos kilomètres de course en Zone 2 d'endurance fondamentale est le seul moyen de maximiser l'AEI sans épuiser le système nerveux central.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
};
