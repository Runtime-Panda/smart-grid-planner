import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

// ---------------------------------------------------------------------------
// SIMULATION LOGIC — pure functions, no side effects
// ---------------------------------------------------------------------------

function computeSimulation(substationsData, nuclearOffline, thermalOffline) {
  if (!substationsData) return null;

  const subs = substationsData.substations;
  const cables = substationsData.cables;

  // Both offline — total grid failure
  if (nuclearOffline && thermalOffline) {
    const allIds = subs.map(s => s.id);
    return {
      affectedSubstations: allIds,
      reroutedSubstations: [],
      blackoutSubstations: allIds,
      overloadedSubstations: [],
      totalReroutedMW: 0,
      blackoutRiskLevel: 'CRITICAL',
      totalGridFailure: true,
      interconnectNewLoadMW: 0,
      interconnectNewLoadPercent: 0,
      plantStatus: {
        nuclear: { online: false, loadMW: 0, headroom: 0 },
        thermal: { online: false, loadMW: 0, headroom: 0 }
      },
      zoneImpact: {
        industrialAffected: true,
        residentialAffected: true,
        percentCityAffected: 100
      }
    };
  }

  // Determine which primary feed is lost
  const lostPrimary = nuclearOffline ? 'nuclear' : 'thermal';
  const survivingCapacity = nuclearOffline ? 600 : 1000; // thermal : nuclear

  // Find the interconnect substation
  const interconnect = subs.find(s => s.type === 'interconnect');
  const icCapacityMW = interconnect ? interconnect.capacityMW : 400;
  let icCurrentLoadMW = interconnect ? interconnect.loadMW : 0;

  // Step 1 — identify affected substations
  const affectedSubs = subs.filter(s => s.primaryPlant === lostPrimary);
  const affectedIds = affectedSubs.map(s => s.id);

  const reroutedIds = [];
  const blackoutIds = [];
  let totalReroutedMW = 0;

  // Step 2 — attempt rerouting via interconnect
  for (const sub of affectedSubs) {
    const hasICConnection = cables.some(
      c => (c.fromId === interconnect?.id && c.toId === sub.id) ||
           (c.toId === interconnect?.id && c.fromId === sub.id)
    );
    if (hasICConnection && interconnect) {
      icCurrentLoadMW += sub.loadMW;
      totalReroutedMW += sub.loadMW;
      reroutedIds.push(sub.id);
    } else {
      blackoutIds.push(sub.id);
    }
  }

  // Step 3 — check interconnect capacity
  const icLoadPercent = icCapacityMW > 0
    ? Math.min(Math.round((icCurrentLoadMW / icCapacityMW) * 10000) / 100, 100)
    : 0;

  const overloadedIds = [];
  if (interconnect && icCurrentLoadMW > icCapacityMW) {
    overloadedIds.push(interconnect.id);
  }

  // Step 4 — check surviving plant overload
  const survivingLoad = icCurrentLoadMW + subs
    .filter(s => s.primaryPlant !== lostPrimary && s.type !== 'interconnect')
    .reduce((sum, s) => sum + s.loadMW, 0);
  const survivingOverloaded = survivingLoad > survivingCapacity;

  // Determine blackout risk
  let blackoutRiskLevel = 'LOW';
  if (blackoutIds.length > 0 || survivingOverloaded) {
    blackoutRiskLevel = 'CRITICAL';
  } else if (overloadedIds.length > 0 || icLoadPercent >= 90) {
    blackoutRiskLevel = 'HIGH';
  } else if (icLoadPercent >= 70) {
    blackoutRiskLevel = 'MEDIUM';
  }

  // Zone impact
  const industrialAffected = lostPrimary === 'nuclear';
  const residentialAffected = lostPrimary === 'thermal';
  const totalSubs = subs.length;
  const percentCityAffected = totalSubs > 0
    ? Math.round((affectedSubs.length / totalSubs) * 100)
    : 0;

  return {
    affectedSubstations: affectedIds,
    reroutedSubstations: reroutedIds,
    blackoutSubstations: blackoutIds,
    overloadedSubstations: overloadedIds,
    totalReroutedMW: Math.round(totalReroutedMW * 100) / 100,
    blackoutRiskLevel,
    totalGridFailure: false,
    interconnectNewLoadMW: Math.round(icCurrentLoadMW * 100) / 100,
    interconnectNewLoadPercent: icLoadPercent,
    plantStatus: {
      nuclear: {
        online: !nuclearOffline,
        loadMW: nuclearOffline ? 0 : 1000 - (Math.max(0, 1000 - survivingLoad)),
        headroom: nuclearOffline ? 0 : Math.max(0, ((1000 - survivingLoad) / 1000) * 100)
      },
      thermal: {
        online: !thermalOffline,
        loadMW: thermalOffline ? 0 : 600 - (Math.max(0, 600 - survivingLoad)),
        headroom: thermalOffline ? 0 : Math.max(0, ((600 - survivingLoad) / 600) * 100)
      }
    },
    zoneImpact: {
      industrialAffected,
      residentialAffected,
      percentCityAffected
    }
  };
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function FailureSimulator({
  substations,
  simulation,
  onToggleNuclear,
  onToggleThermal,
  onReset,
  onSimulationResult
}) {
  const { nuclearOffline, thermalOffline } = simulation;
  const isSimActive = nuclearOffline || thermalOffline;

  // Recompute whenever toggles change
  useEffect(() => {
    if (!substations) return;
    if (!isSimActive) {
      onSimulationResult(null);
      return;
    }
    const result = computeSimulation(substations, nuclearOffline, thermalOffline);
    onSimulationResult(result);
  }, [nuclearOffline, thermalOffline, substations]);

  const simResult = isSimActive && substations
    ? computeSimulation(substations, nuclearOffline, thermalOffline)
    : null;

  const riskColor = {
    LOW: 'text-[#22c55e]',
    MEDIUM: 'text-[#f59e0b]',
    HIGH: 'text-[#ef4444]',
    CRITICAL: 'text-[#ef4444]'
  };

  return (
    <>
      <style>{`
        @keyframes pulse-btn-red {
          0%, 100% { box-shadow: 0 0 4px #ef4444; }
          50% { box-shadow: 0 0 16px #ef4444, 0 0 32px #ef444460; }
        }
        @keyframes pulse-btn-amber {
          0%, 100% { box-shadow: 0 0 4px #f59e0b; }
          50% { box-shadow: 0 0 16px #f59e0b, 0 0 32px #f59e0b60; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .nuclear-offline-btn { animation: pulse-btn-red 1.2s ease-in-out infinite; }
        .thermal-offline-btn { animation: pulse-btn-amber 1.2s ease-in-out infinite; }
        .pulse-dot { animation: pulse-dot 0.8s ease-in-out infinite; }
      `}</style>

      <div className="w-full bg-[#0d1117] border-t border-b border-[#2a3f5f] px-6 py-4 flex flex-wrap items-center justify-between gap-4">

        {/* ── LEFT: Controls ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[#FF9933] text-[13px] font-bold tracking-wide whitespace-nowrap">
            ⚡ Failure Simulation
          </span>

          {/* Nuclear toggle */}
          <button
            onClick={onToggleNuclear}
            disabled={!substations}
            className={[
              'px-4 py-2 rounded border-2 text-sm font-semibold transition-all duration-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              nuclearOffline
                ? 'bg-[#ef4444] border-[#ef4444] text-white nuclear-offline-btn'
                : 'bg-[#1a2332] border-[#ef4444] text-[#ef4444]'
            ].join(' ')}
          >
            ☢ Nuclear — {nuclearOffline ? 'OFFLINE' : 'ONLINE'}
          </button>

          {/* Thermal toggle */}
          <button
            onClick={onToggleThermal}
            disabled={!substations}
            className={[
              'px-4 py-2 rounded border-2 text-sm font-semibold transition-all duration-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              thermalOffline
                ? 'bg-[#f59e0b] border-[#f59e0b] text-white thermal-offline-btn'
                : 'bg-[#1a2332] border-[#f59e0b] text-[#f59e0b]'
            ].join(' ')}
          >
            ⚡ Thermal — {thermalOffline ? 'OFFLINE' : 'ONLINE'}
          </button>

          {/* Reset button — only visible when sim active */}
          {isSimActive && (
            <button
              onClick={onReset}
              className="px-4 py-2 rounded bg-[#22c55e] text-white text-sm font-semibold hover:bg-[#16a34a] transition-colors"
            >
              ↺ Restore All
            </button>
          )}
        </div>

        {/* ── RIGHT: Status summary ────────────────────────────────── */}
        {isSimActive && simResult && (
          <div className="flex flex-wrap items-center gap-6">

            {/* Badge */}
            <div className="flex items-center gap-2">
              <span className="pulse-dot text-[#ef4444] text-lg">●</span>
              <span className="text-[#ef4444] text-xs font-bold tracking-widest uppercase">
                Simulation Active
              </span>
            </div>

            {simResult.totalGridFailure ? (
              <span className="text-[#ef4444] font-bold text-sm animate-pulse">
                ⚠ TOTAL GRID FAILURE
              </span>
            ) : (
              <>
                <StatChip label="Zones Affected" value={simResult.zoneImpact.percentCityAffected + '%'} />
                <StatChip label="Load Rerouted" value={simResult.totalReroutedMW + ' MW'} />
                <StatChip label="Overloaded Subs" value={simResult.overloadedSubstations.length} />
                <div className="text-xs text-gray-400">
                  Blackout Risk:{' '}
                  <span className={`font-bold ${riskColor[simResult.blackoutRiskLevel] || 'text-white'}`}>
                    {simResult.blackoutRiskLevel}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-gray-400 text-[10px] uppercase tracking-wide">{label}</span>
      <span className="text-white text-sm font-bold">{value}</span>
    </div>
  );
}

FailureSimulator.propTypes = {
  substations: PropTypes.object,
  simulation: PropTypes.shape({
    nuclearOffline: PropTypes.bool.isRequired,
    thermalOffline: PropTypes.bool.isRequired
  }).isRequired,
  onToggleNuclear: PropTypes.func.isRequired,
  onToggleThermal: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  onSimulationResult: PropTypes.func.isRequired
};
