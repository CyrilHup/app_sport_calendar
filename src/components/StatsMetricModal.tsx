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

import { TrainingLoadStats } from '../services/statsEngine';
import { AthleteHeartRateZones } from '../services/heartRateZones';
import { ACWR_POLICY } from '../services/trainingModelConfig';

export type StatsMetricTopic = 'acwr' | 'banister' | 'aei' | null;

interface StatsMetricModalProps {
  topic: StatsMetricTopic;
  onClose: () => void;
  trainingLoad?: TrainingLoadStats;
  heartRateZones: AthleteHeartRateZones;
}

export const StatsMetricModal: React.FC<StatsMetricModalProps> = ({ topic, onClose, trainingLoad, heartRateZones }) => {
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
                {topic === 'acwr' && 'Ratio de charge mécanique ACWR'}
                {topic === 'banister' && 'Modèle Banister : Fitness, Fatigue & Forme'}
                {topic === 'aei' && 'Efficacité Aérobie & Fréquence Cardiaque'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {topic === 'acwr' && 'Indicateur descriptif de la charge de course, non diagnostic médical'}
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
              {/* Les deux mesures suivies par l'application */}
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px'
                }}
              >
                <div style={{ fontWeight: 800, color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={18} /> Charge mécanique de course et charge physiologique
                </div>
                <p style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                  L’application suit séparément les Km-Effort des sorties de course et la charge physiologique estimée. Ces mesures ne décrivent pas à elles seules votre capacité de récupération.
                </p>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  La fréquence cardiaque et la distance avec dénivelé représentent des aspects différents d’une séance. Le ratio ci-dessous utilise seulement les Km-Effort calculés pour les activités de course et de trail ; il ne prédit pas une blessure individuelle.
                </p>
              </div>

              {/* Formules utilisées dans l'application */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  📐 Calcul utilisé par l’application :
                </div>
                <div
                  style={{
                    background: '#090d16',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.86rem',
                    color: '#38bdf8',
                    textAlign: 'center',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    marginBottom: 8
                  }}
                >
                  1 Km-Effort = Distance (km) + Dénivelé Positif D+ (m) / 100
                </div>
                <div
                  style={{
                    background: '#090d16',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.86rem',
                    color: '#f59e0b',
                    textAlign: 'center',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                  }}
                >
                  ACWR Mécanique = Charge Aiguë (7j de Km-Effort) ÷ Charge Chronique Hebdo (Moy. 28j)
                </div>
              </div>

              {/* 🔍 VOTRE CALCUL EN DIRECT (VOS VALEURS RÉELLES) */}
              {trainingLoad && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(20, 27, 47, 0.95), rgba(14, 20, 36, 0.98))',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#38bdf8', fontSize: '0.92rem' }}>
                      <Activity size={16} />
                      <span>VOTRE CALCUL EN DIRECT (VOS VALEURS ACTUELLES)</span>
                    </div>
                    <span
                      style={{
                        background: trainingLoad.acwrStatus === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.2)' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'),
                        color: trainingLoad.acwrStatus === 'OPTIMAL' ? '#34d399' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? '#f87171' : '#fbbf24'),
                        border: `1px solid ${trainingLoad.acwrStatus === 'OPTIMAL' ? '#10b981' : (trainingLoad.acwrStatus === 'DANGER_HIGH_RISK' ? '#ef4444' : '#f59e0b')}`,
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontSize: '0.74rem',
                        fontWeight: 800
                      }}
                    >
                      Ratio : {trainingLoad.trailAcwrRatio} ({trainingLoad.acwrStatusLabel || 'En suivi'})
                    </span>
                  </div>

                  {/* Décomposition des 7 derniers jours */}
                  <div>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: 6, fontWeight: 700 }}>
                      1. Décomposition de vos séances sur la fenêtre glissante de 7 jours :
                    </div>
                    {trainingLoad.recentSessions7d && trainingLoad.recentSessions7d.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {trainingLoad.recentSessions7d.map((sess, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'rgba(0, 0, 0, 0.35)',
                              padding: '7px 10px',
                              borderRadius: 6,
                              borderLeft: sess.isMechanicalImpact ? '3px solid #38bdf8' : '3px solid #a78bfa',
                              fontSize: '0.75rem',
                              gap: 8,
                              flexWrap: 'wrap'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                {sess.date.slice(5)}
                              </span>
                              <strong style={{ color: '#ffffff' }}>{sess.name}</strong>
                              <span style={{ color: 'var(--text-secondary)' }}>({sess.durationMinutes}m)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: sess.isMechanicalImpact ? 'rgba(56, 189, 248, 0.15)' : 'rgba(167, 139, 250, 0.15)',
                                  color: sess.isMechanicalImpact ? '#38bdf8' : '#c4b5fd',
                                  fontWeight: 700
                                }}
                              >
                                {sess.isMechanicalImpact
                                  ? `${sess.mechanicalKmEffort ?? 0} Km-Effort (Chocs & D+)`
                                  : '0 Km-Effort (Calisthénie - Zéro choc)'}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                {sess.trimp} TRIMP cardio
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Aucune séance enregistrée sur les 7 derniers jours.
                      </div>
                    )}
                  </div>

                  {/* Calcul mathématique chiffré */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      fontSize: '0.78rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>• Charge Aiguë 7j (Somme des Km-Effort récents) :</span>
                      <strong style={{ color: '#38bdf8' }}>{trainingLoad.trailAcuteLoad7d} Km-Effort</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>• Charge Chronique Hebdo 28j (Moyenne sur 4 semaines) :</span>
                      <strong style={{ color: '#34d399' }}>{trainingLoad.trailChronicLoad28dWeeklyAvg} Km-Effort / sem</strong>
                    </div>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '3px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>• Résultat du Ratio ACWR Mécanique :</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent-orange)' }}>
                        {trainingLoad.trailAcuteLoad7d} ÷ {trainingLoad.trailChronicLoad28dWeeklyAvg} = {trainingLoad.trailAcwrRatio}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Effet différé des adaptations sur la charge mesurée */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.08))',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '10px',
                  padding: '14px 16px'
                }}
              >
                <div style={{ fontWeight: 800, color: '#34d399', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={16} /> Comment une adaptation peut-elle influencer la charge future ?
                </div>
                <p style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  Le bouton <strong>« Simplifier » / « Appliquer l'adaptation »</strong> modifie le plan futur. Il ne change pas les activités déjà effectuées ni l’ACWR affiché aujourd’hui.
                </p>
                <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
                  <li>
                    <strong style={{ color: '#ffffff' }}>1. Charge mécanique prévue :</strong>
                    <br />
                    Dans un exemple de plan, remplacer 8 km avec 450 m D+ (12,5 Km-Effort) par 5 km plats (5 Km-Effort) réduit la charge mécanique prévue de 7,5 Km-Effort.
                  </li>
                  <li>
                    <strong style={{ color: '#ffffff' }}>2. Activités réellement effectuées :</strong>
                    <br />
                    Le ratio est recalculé à partir des sorties enregistrées. Une séance future n’entre dans les fenêtres de 7 et 28 jours qu’une fois effectuée et synchronisée.
                  </li>
                  <li>
                    <strong style={{ color: '#ffffff' }}>3. Interprétation prudente :</strong>
                    <br />
                    Une adaptation peut limiter une hausse future du ratio, sans garantir une valeur cible ni prédire une blessure individuelle.
                  </li>
                </ol>
              </div>

              {/* Pourquoi dissocier Course vs Calisthénie / Force */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="var(--accent-green)" />
                  Pourquoi le renforcement est-il séparé de cet indicateur ?
                </div>
                <p style={{ margin: '0 0 8px 0' }}>
                  Ce ratio suit uniquement la charge mécanique estimée des activités de course et de trail en Km-Effort.
                </p>
                <p style={{ margin: 0 }}>
                  Le renforcement et la mobilité ne sont pas ajoutés à ce ratio. Cela ne signifie pas qu’ils sont sans fatigue ni sans risque ; ils restent pris en compte séparément dans la charge générale de l’application.
                </p>
              </div>

              {/* Zones de la politique de l'application */}
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
                  🎯 Zones d’interprétation configurées dans l’application :
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(56, 189, 248, 0.08)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                    <strong style={{ color: '#38bdf8', minWidth: '85px' }}>&lt; {ACWR_POLICY.underloadBelow}</strong>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Sous-charge : </strong>
                      Charge récente inférieure à la moyenne des quatre dernières semaines.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(16, 185, 129, 0.1)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                    <strong style={{ color: '#10b981', minWidth: '85px' }}>{ACWR_POLICY.underloadBelow} – {ACWR_POLICY.moderateAbove}</strong>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Sweet Spot (Zone Optimale) : </strong>
                      Plage de référence utilisée par les règles de l’application, sans garantie de sécurité individuelle.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(245, 158, 11, 0.1)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                    <strong style={{ color: '#f59e0b', minWidth: '85px' }}>{ACWR_POLICY.moderateAbove} – {ACWR_POLICY.highAbove}</strong>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Surcharge Modérée : </strong>
                      Progression rapide mais vigilance requise. Veillez au sommeil et à l'hydratation, surveillez les raideurs au réveil.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                    <strong style={{ color: '#ef4444', minWidth: '85px' }}>&gt; {ACWR_POLICY.highAbove}</strong>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Zone de Danger : </strong>
                      Hausse de charge récente relativement à la moyenne. Ce seuil déclenche une proposition d’adaptation, pas un diagnostic médical.
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

              {/* Vos valeurs actuelles Banister */}
              {trainingLoad && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(20, 27, 47, 0.95), rgba(14, 20, 36, 0.98))',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#c084fc', fontSize: '0.92rem' }}>
                      <Gauge size={16} />
                      <span>VOS VALEURS BANISTER ACTUELLES</span>
                    </div>
                    <span
                      style={{
                        background: 'rgba(168, 85, 247, 0.2)',
                        color: '#c084fc',
                        border: '1px solid #a855f7',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontSize: '0.74rem',
                        fontWeight: 800
                      }}
                    >
                      {trainingLoad.formLabel}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: 6, borderLeft: '3px solid var(--accent-blue)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>🔵 CTL (Fitness 42j)</div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--accent-blue)' }}>{trainingLoad.currentCtl}</div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Fondations cardiovasculaires</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: 6, borderLeft: '3px solid var(--accent-amber)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>🟠 ATL (Fatigue 7j)</div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--accent-amber)' }}>{trainingLoad.currentAtl}</div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Fatigue nerveuse & musculaire</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: 6, borderLeft: `3px solid ${trainingLoad.currentTsb >= 0 ? 'var(--accent-green)' : 'var(--accent-orange)'}` }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>🟢 TSB (Forme = CTL - ATL)</div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: trainingLoad.currentTsb >= 0 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                        {trainingLoad.currentTsb > 0 ? `+${trainingLoad.currentTsb}` : trainingLoad.currentTsb}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        {trainingLoad.currentTsb >= 0 ? 'Fraîcheur & Prêt à performer' : 'Surcharge productive'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                  Le rôle clé de la Zone 2 (&lt; {heartRateZones.zone2[1]} bpm)
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
