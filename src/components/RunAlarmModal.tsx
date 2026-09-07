import React, { useState, useEffect } from 'react';
import { Bell, Clock, X, Check, Trash2, Smartphone, AlertCircle } from 'lucide-react';
import { scheduleWorkoutAlarm, getActiveAlarms, cancelWorkoutAlarm, ScheduledAlarmItem } from '../services/mobileAlarmService';
import { isNative } from '../services/apiConfig';
import { triggerHapticFeedback } from '../services/hapticsService';

interface RunAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  workout: {
    id: string;
    title: string;
    date: Date | string;
    activityType?: string;
  } | null;
}

export const RunAlarmModal: React.FC<RunAlarmModalProps> = ({ isOpen, onClose, workout }) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(30);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [scheduledAlarms, setScheduledAlarms] = useState<ScheduledAlarmItem[]>([]);

  useEffect(() => {
    if (isOpen && workout) {
      setStatusMessage(null);
      loadAlarms();
    }
  }, [isOpen, workout]);

  const loadAlarms = async () => {
    const list = await getActiveAlarms();
    setScheduledAlarms(list.filter(a => a.workoutId === workout?.id));
  };

  if (!isOpen || !workout) return null;

  const workoutDate = new Date(workout.date);
  const formattedDate = !isNaN(workoutDate.getTime())
    ? workoutDate.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Date inconnue';
  const formattedTime = !isNaN(workoutDate.getTime())
    ? workoutDate.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--';

  const handleSetAlarm = async () => {
    setLoading(true);
    setStatusMessage(null);

    const res = await scheduleWorkoutAlarm({
      workoutId: workout.id,
      title: workout.title,
      workoutDate: workout.date,
      minutesBefore: selectedMinutes
    });

    setLoading(false);
    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message });
      await loadAlarms();
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  const handleCancelAlarm = async (id: number) => {
    await cancelWorkoutAlarm(id);
    await loadAlarms();
  };

  const presets = [
    { label: 'À l\'heure', value: 0 },
    { label: '15 min avant', value: 15 },
    { label: '30 min avant', value: 30 },
    { label: '1 h avant', value: 60 },
    { label: '2 h avant', value: 120 }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f172a] border border-slate-700/70 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-slate-100 flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Alarme & Rappel de Séance</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Smartphone size={12} className="text-blue-400" />
                {isNative() ? 'Android Native Notification' : 'Notification / Navigateur'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHapticFeedback('light');
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Workout Info Box */}
        <div className="bg-[#1e293b]/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="font-semibold text-white text-sm line-clamp-1">{workout.title}</div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>📅 {formattedDate}</span>
              <span>•</span>
              <span className="text-blue-300 font-medium">🕒 {formattedTime}</span>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
            {workout.activityType || 'RUN'}
          </span>
        </div>

        {/* Presets Selection */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
            Quand sonner l'alarme ?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {presets.map(p => (
              <button
                key={p.value}
                onClick={() => {
                  triggerHapticFeedback('light');
                  setSelectedMinutes(p.value);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all text-center ${
                  selectedMinutes === p.value
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm shadow-blue-500/20 font-bold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scheduled Alarms list for this workout */}
        {scheduledAlarms.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-2">
              <Check size={14} /> Alarmes actives pour cette séance :
            </span>
            <div className="flex flex-col gap-1.5">
              {scheduledAlarms.map(a => {
                const alarmTime = new Date(a.scheduledTime);
                const timeStr = !isNaN(alarmTime.getTime())
                  ? alarmTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={a.id} className="flex items-center justify-between text-xs bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                    <span className="text-slate-200">
                      Sonnerie à <strong className="text-white">{timeStr}</strong> ({a.minutesBefore}m avant)
                    </span>
                    <button
                      onClick={() => handleCancelAlarm(a.id)}
                      className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition"
                      title="Annuler"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feedback message */}
        {statusMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {statusMessage.type === 'success' ? <Check size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleSetAlarm}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
        >
          <Clock size={16} />
          {loading ? 'Programmation...' : `Activer le rappel (${selectedMinutes} min avant)`}
        </button>

      </div>
    </div>
  );
};
