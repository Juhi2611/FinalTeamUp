// =============================================================
// components/interviews/ProctoringAlert.tsx
// Visual alert overlay shown when proctoring detects violations
// =============================================================

import { AlertTriangle, Eye, Smartphone, Users } from 'lucide-react';
import { FaceProctoringWarning } from '@/hooks/useFaceProctoring';

interface Props {
  currentAlert: string | null;
  warningCount: number;
  maxWarnings: number;
  warnings: FaceProctoringWarning[];
  isLoaded: boolean;
}

const getIcon = (type: FaceProctoringWarning['type']) => {
  switch (type) {
    case 'looking_away': return <Eye className="w-5 h-5" />;
    case 'phone_detected': return <Smartphone className="w-5 h-5" />;
    case 'multiple_faces': return <Users className="w-5 h-5" />;
    default: return <AlertTriangle className="w-5 h-5" />;
  }
};

const ProctoringAlert = ({ currentAlert, warningCount, maxWarnings, warnings, isLoaded }: Props) => {
  return (
    <>
      {/* Warning counter badge */}
      {warningCount > 0 && (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          warningCount >= maxWarnings - 1
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          {warningCount}/{maxWarnings} violations
        </div>
      )}

      {/* Active alert banner */}
      {currentAlert && (
        <div
          style={{
            position: 'fixed',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(239, 68, 68, 0.95)',
            border: '2px solid rgba(239, 68, 68, 0.8)',
            borderRadius: 12,
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 24px rgba(239,68,68,0.4)',
            maxWidth: 480,
            backdropFilter: 'blur(8px)',
          }}
        >
          <AlertTriangle style={{ width: 20, height: 20, color: 'white', flexShrink: 0 }} />
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>
              ⚠️ Proctoring Violation ({warningCount}/{maxWarnings})
            </p>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, margin: '2px 0 0' }}>
              {currentAlert}
            </p>
          </div>
        </div>
      )}

      {/* AI detection status */}
      {isLoaded && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 10,
          color: '#4ade80',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          AI Monitoring
        </div>
      )}
    </>
  );
};

export default ProctoringAlert;