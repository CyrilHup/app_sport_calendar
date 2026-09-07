import React, { useEffect, useState } from 'react';
import { fetchMontRoyalWeather, MontRoyalWeather } from '../services/weatherService';
import { ChevronDown, ChevronUp, Mountain, Sparkles, Wind } from 'lucide-react';

interface WeatherWidgetProps {
  compact?: boolean;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ compact }) => {
  const [weather, setWeather] = useState<MontRoyalWeather | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    fetchMontRoyalWeather().then(data => {
      if (isMounted) {
        setWeather(data);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading || !weather) {
    return null;
  }

  const cond = weather.trailCondition;

  if (compact) {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="chip-btn"
          style={{
            borderColor: cond.badgeColor,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 9px',
            fontSize: '0.72rem',
            background: 'rgba(255, 255, 255, 0.04)'
          }}
          title="Météo et praticabilité des sentiers du Mont-Royal"
        >
          <span>{weather.weatherEmoji}</span>
          <span>Mont-Royal {weather.currentTempC}°C</span>
          <span style={{ color: cond.badgeColor, fontWeight: 700 }}>• Sentiers {cond.status === 'OPTIMAL' ? 'Optimaux' : cond.status}</span>
        </button>

        {isExpanded && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 100,
              width: 'min(320px, 90vw)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: '0.82rem', color: '#fff' }}>Météo & Praticabilité Mont-Royal</strong>
              <button
                onClick={() => setIsExpanded(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{cond.advice}</p>
            <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>💨 {weather.windSpeedKmh} km/h</span>
              <span>🌅 Coucher {weather.sunsetStr}</span>
              <span>👟 {cond.gearRecommendation}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 14px',
        marginBottom: '10px',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Barre compacte supérieure */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.86rem', fontWeight: 700, color: '#fff' }}>
            <span style={{ fontSize: '1.1rem' }}>{weather.weatherEmoji}</span>
            <span>Mont-Royal : {weather.currentTempC}°C</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              (ressenti {weather.feelsLikeC}°C)
            </span>
          </div>

          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: 9999,
              background: `${cond.badgeColor}15`,
              color: cond.badgeColor,
              border: `1px solid ${cond.badgeColor}40`,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>{cond.headline}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Wind size={12} /> {weather.windSpeedKmh} km/h
          </span>
          <span>•</span>
          <span>Coucher {weather.sunsetStr}</span>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex'
            }}
            aria-label="Afficher les détails"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Tiroir déroulant Sentiers & Matériel */}
      {isExpanded && (
        <div
          style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '10px',
            fontSize: '0.78rem'
          }}
        >
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Mountain size={13} /> Sentiers & Terrain :
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {cond.advice}
            </p>
          </div>

          <div style={{ background: `${cond.badgeColor}08`, padding: '8px 12px', borderRadius: 'var(--radius-xs)', border: `1px solid ${cond.badgeColor}25` }}>
            <div style={{ fontWeight: 700, color: cond.badgeColor, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={13} /> Matériel Recommandé :
            </div>
            <p style={{ color: 'var(--text-primary)', lineHeight: 1.45 }}>
              {cond.gearRecommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
