import React from 'react';
import PropTypes from 'prop-types';
import { formatIndianNumber, formatRupeeAuto } from '../utils/formatters';
import { NUCLEAR_CAPACITY_MW, THERMAL_CAPACITY_MW, ENERGY_COST_PER_MWH } from '../constants/indiaGridConstants';

export default function Dashboard({ zones, substations, computed, inputs }) {
  if (!substations) return null;

  // --- Sec 1 Data ---
  const nuclearHeadroom = computed.nuclearHeadroomPercent;
  const thermalHeadroom = computed.thermalHeadroomPercent;
  
  const getHeadroomColor = (hr) => {
    if (hr >= 20) return 'text-[#22c55e]'; // green
    if (hr >= 5) return 'text-[#f59e0b]'; // amber
    return 'text-[#ef4444]'; // red
  };

  const indCount = substations.metadata.numIndustrial;
  const resCount = substations.metadata.numResidential;
  const icCount = substations.metadata.numInterconnect;

  const score = substations.redundancyScore;
  let scoreColor = '#ef4444'; // red
  if (score >= 80) scoreColor = '#22c55e';
  else if (score >= 50) scoreColor = '#f59e0b';
  
  const totalCapacity = NUCLEAR_CAPACITY_MW + THERMAL_CAPACITY_MW;
  const capacityUsed = ((computed.totalPeakLoadMW / totalCapacity) * 100).toFixed(1);
  let capColor = 'bg-[#22c55e]';
  let capTextColor = 'text-[#22c55e]';
  if (capacityUsed >= 90) { capColor = 'bg-[#ef4444]'; capTextColor = 'text-[#ef4444]'; }
  else if (capacityUsed >= 70) { capColor = 'bg-[#f59e0b]'; capTextColor = 'text-[#f59e0b]'; }

  // --- Sec 2 Data ---
  const { substationCostTotal, totalInfraCost, annualLossCostTotal } = substations.costSummary;
  const hvCables = substations.cables.filter(c => c.type === 'HV');
  const mvCables = substations.cables.filter(c => c.type === 'MV');
  const lvCables = substations.cables.filter(c => c.type === 'LV');

  const sumCost = (arr) => arr.reduce((s, c) => s + c.costRupees, 0);
  const hvCost = sumCost(hvCables);
  const mvCost = sumCost(mvCables);
  const lvCost = sumCost(lvCables); // if any

  const maintCost = totalInfraCost * 0.02;
  const totalAnnual = annualLossCostTotal + maintCost;
  const paybackYears = (totalInfraCost / totalAnnual).toFixed(1);

  // --- Sec 4 Data ---
  const sumLen = (arr) => arr.reduce((s, c) => s + c.lengthKm, 0);
  const hvLen = sumLen(hvCables);
  const mvLen = sumLen(mvCables);
  const lvLen = sumLen(lvCables);
  const totalLossRates = substations.cables.reduce((s, c) => s + c.lossPercent, 0);
  const avgLoss = (totalLossRates / substations.cables.length).toFixed(2);

  // Calculate annual loss cost per cable
  const cablesWithLossCost = substations.cables.map(c => {
    const toSub = substations.substations.find(s => s.id === c.toId);
    const loadMW = toSub ? toSub.loadMW : 0;
    const lossCost = (c.lossPercent / 100) * loadMW * 8760 * ENERGY_COST_PER_MWH;
    return { ...c, lossCost };
  });

  const sortedCables = [...cablesWithLossCost].sort((a, b) => b.lossCost - a.lossCost);
  const topCables = sortedCables.slice(0, 5);
  const highestLossCable = sortedCables[0];
  const maxLossValue = topCables.length > 0 ? topCables[0].lossCost : 1; // for scaling

  const totalFactories = 
    (inputs.numSmall || 0) + 
    (inputs.numMedium || 0) + 
    (inputs.numLarge || 0);

  return (
    <div className="bg-[#111111] p-8 text-gray-100 font-sans space-y-12">
      
      {/* SECTION 1 - Grid Overview */}
      <section>
        <h2 className="text-xl font-bold mb-6 flex items-center border-l-4 border-[#FF9933] pl-3 text-white">
          <span className="mr-2">⚡</span> Grid Overview
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          {/* Card 1: Peak Load */}
          <div className="bg-[#1a2332] p-4 rounded-lg flex flex-col justify-center border border-[#2a3f5f]">
            <div className="text-sm text-gray-400 mb-1">Total Peak Load</div>
            <div className="text-2xl font-bold text-[#FF9933]">{computed.totalPeakLoadMW.toFixed(2)} MW</div>
          </div>

          {/* Card 2: Nuclear Cap */}
          <div className="bg-[#1a2332] p-4 rounded-lg flex flex-col justify-center border border-[#2a3f5f]">
            <div className="text-sm text-gray-400 mb-1">Nuclear Capacity</div>
            <div className="text-2xl font-bold text-[#ef4444]">1000 MW</div>
            <div className={`text-xs mt-1 font-medium ${getHeadroomColor(nuclearHeadroom)}`}>
              Headroom: {nuclearHeadroom.toFixed(1)}%
            </div>
          </div>

          {/* Card 3: Thermal Cap */}
          <div className="bg-[#1a2332] p-4 rounded-lg flex flex-col justify-center border border-[#2a3f5f]">
            <div className="text-sm text-gray-400 mb-1">Thermal Capacity</div>
            <div className="text-2xl font-bold text-[#f59e0b]">600 MW</div>
            <div className={`text-xs mt-1 font-medium ${getHeadroomColor(thermalHeadroom)}`}>
              Headroom: {thermalHeadroom.toFixed(1)}%
            </div>
          </div>

          {/* Card 4: Substations */}
          <div className="bg-[#1a2332] p-4 rounded-lg flex flex-col justify-center border border-[#2a3f5f]">
            <div className="text-sm text-gray-400 mb-1">Total Substations</div>
            <div className="text-2xl font-bold text-[#a855f7]">{substations.metadata.totalSubstations} units</div>
            <div className="text-xs text-gray-400 mt-1">
              Ind: {indCount} | Res: {resCount} | IC: {icCount}
            </div>
          </div>

          {/* Card 5: Redundancy Score SVG */}
          <div className="bg-[#1a2332] p-4 rounded-lg flex items-center justify-between border border-[#2a3f5f]">
            <div>
              <div className="text-sm text-gray-400 mb-1">Redundancy</div>
              <div className="text-xs text-gray-400 mt-1">Score</div>
            </div>
            <div className="relative w-[60px] h-[60px]">
              <svg viewBox="0 0 80 80" className="absolute top-0 left-0">
                {/* Background Ring */}
                <circle cx="40" cy="40" r="30" fill="none" stroke="#2a3f5f" strokeWidth="6" />
                {/* Progress Ring */}
                <circle 
                  cx="40" cy="40" r="30" fill="none" stroke={scoreColor} strokeWidth="6"
                  strokeDasharray={`${(score / 100) * 188.49} 188.49`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: scoreColor }}>
                {score}
              </div>
            </div>
          </div>

          {/* Card 6: Capacity Used */}
          <div className="bg-[#1a2332] p-4 rounded-lg flex flex-col justify-center border border-[#2a3f5f]">
             <div className="text-sm text-gray-400 mb-1">City Capacity Used</div>
             <div className={`text-2xl font-bold ${capTextColor}`}>{capacityUsed}%</div>
             <div className="mt-1 flex flex-col">
               <div style={{ fontSize: '11px', color: '#999' }}>
                 {formatIndianNumber(inputs.numHouses)} houses | {totalFactories} factories
               </div>
               <div style={{ fontSize: '10px', color: '#666' }}>
                 S:{inputs.numSmall || 0} M:{inputs.numMedium || 0} L:{inputs.numLarge || 0}
               </div>
               <div style={{ fontSize: '11px', color: '#999' }}>
                 Est. Population: {formatIndianNumber(Math.round((inputs.numHouses || 0) * 2.8))}
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* Row Split: Section 2 & 3 */}
      <div className="flex flex-col xl:flex-row gap-8">
        
        {/* SECTION 2 - Cost Breakdown */}
        <section className="xl:w-1/3">
          <h2 className="text-xl font-bold mb-6 border-l-4 border-[#FF9933] pl-3 text-white">Infrastructure Cost Breakdown</h2>
          <div className="bg-[#1a2332] p-6 rounded-lg border border-[#2a3f5f] space-y-4 text-sm font-mono tracking-tight">
            <div className="flex justify-between">
              <span className="text-gray-400">Substation Equipment:</span>
              <span>{formatRupeeAuto(substationCostTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">HV Cable (132kV):</span>
              <span>{formatRupeeAuto(hvCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">MV Cable (33kV):</span>
              <span>{formatRupeeAuto(mvCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">LV Cable (11kV):</span>
              <span>{formatRupeeAuto(lvCost)}</span>
            </div>
            <hr className="border-[#2a3f5f] my-2" />
            <div className="flex justify-between font-bold text-[#FF9933] text-base">
              <span>Total Infrastructure:</span>
              <span>{formatRupeeAuto(totalInfraCost)}</span>
            </div>
            
            <div className="pt-4 font-bold text-white mb-2 font-sans">Annual Operating Costs:</div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Transmission Losses:</span>
              <span>{formatRupeeAuto(annualLossCostTotal)}/year</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Est. Maintenance (2%):</span>
              <span>{formatRupeeAuto(maintCost)}/year</span>
            </div>
            <hr className="border-[#2a3f5f] my-2" />
            <div className="flex justify-between font-bold text-[#f59e0b] text-base">
              <span>Total Annual Cost:</span>
              <span>{formatRupeeAuto(totalAnnual)}/year</span>
            </div>

            <div className="mt-6 p-3 bg-[#0d1117] rounded border border-[#2a3f5f] text-gray-300 font-sans text-xs italic">
              <span className="font-semibold text-white not-italic block mb-1">Payback Context:</span>
              "At current load, infrastructure cost equals {paybackYears} years of annual operating costs"
            </div>
          </div>
        </section>

        {/* SECTION 3 - Status Table */}
        <section className="xl:w-2/3">
          <h2 className="text-xl font-bold mb-6 border-l-4 border-[#FF9933] pl-3 text-white">Substation Status</h2>
          <div className="overflow-x-auto rounded-lg border border-[#2a3f5f] bg-[#0d1117]">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#1a2332] text-[#FF9933]">
                <tr>
                  <th className="px-4 py-3 font-semibold border-b border-[#2a3f5f]">ID</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#2a3f5f]">Type</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#2a3f5f]">Location</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#2a3f5f]">Capacity</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#2a3f5f]">Load</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#2a3f5f] w-32">Load%</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#2a3f5f]">Primary Feed</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#2a3f5f]">Status</th>
                </tr>
              </thead>
              <tbody>
                {substations.substations.map((s, i) => {
                  let badge = '';
                  let badgeColors = '';
                  if (s.type === 'industrial') { badge = 'IND'; badgeColors = 'bg-[#FF9933] text-white'; }
                  if (s.type === 'residential') { badge = 'RES'; badgeColors = 'bg-[#3b82f6] text-white'; }
                  if (s.type === 'interconnect') { badge = 'IC'; badgeColors = 'bg-[#a855f7] text-white'; }

                  let lprcColor = 'bg-[#22c55e]';
                  let status = '● Normal';
                  let statusColor = 'text-[#22c55e]';
                  if (s.loadPercent >= 100) { lprcColor = 'bg-[#ef4444]'; status = '● Critical'; statusColor = 'text-[#ef4444]'; }
                  else if (s.loadPercent >= 85) { lprcColor = 'bg-[#f59e0b]'; status = '● Caution'; statusColor = 'text-[#f59e0b]'; }
                  else if (s.loadPercent >= 70) { lprcColor = 'bg-[#f59e0b]'; }

                  return (
                    <tr key={s.id} className={`hover:bg-[#1a2332] transition-colors border-b border-[#1a2332] ${i % 2 === 1 ? 'bg-[#111827]' : 'bg-[#0d1117]'}`}>
                      <td className="px-4 py-3 font-mono text-gray-300">{s.id}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeColors}`}>{badge}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">X: {s.x.toFixed(1)}km, Y: {s.y.toFixed(1)}km</td>
                      <td className="px-4 py-3 text-gray-300">{s.capacityMW} MW</td>
                      <td className="px-4 py-3 font-medium text-white">{s.loadMW} MW</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#333] rounded overflow-hidden">
                             <div className={`h-full ${lprcColor}`} style={{ width: Math.min(s.loadPercent, 100) + '%' }}></div>
                          </div>
                          <span className="text-[#999] w-8">{s.loadPercent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{s.primaryPlant.replace('+',' & ')}</td>
                      <td className={`px-4 py-3 font-bold ${statusColor}`}>{status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* SECTION 4 - Cable Network Summary */}
      <section>
        <h2 className="text-xl font-bold mb-6 border-l-4 border-[#FF9933] pl-3 text-white">Cable Network Summary</h2>
        <div className="flex flex-col lg:flex-row gap-8 bg-[#1a2332] rounded-lg border border-[#2a3f5f] p-6">
          
          <div className="lg:w-1/2 space-y-4">
             <div className="flex justify-between items-end border-b border-[#2a3f5f] pb-2">
               <span className="text-gray-400 text-sm">Total Cable Length:</span>
               <span className="text-lg font-bold text-white">{formatIndianNumber(hvLen + mvLen + lvLen)} km</span>
             </div>
             
             <div className="space-y-2 text-sm text-gray-300">
               <div className="flex justify-between">
                 <span>HV Cables <span className="text-[#ef4444] text-[10px] ml-1">(132kV)</span>:</span>
                 <span className="font-mono">{formatIndianNumber(hvLen)} km <span className="text-gray-500">({hvCables.length} cables)</span></span>
               </div>
               <div className="flex justify-between">
                 <span>MV Cables <span className="text-[#f59e0b] text-[10px] ml-1">(33kV)</span>:</span>
                 <span className="font-mono">{formatIndianNumber(mvLen)} km <span className="text-gray-500">({mvCables.length} cables)</span></span>
               </div>
               <div className="flex justify-between">
                 <span>LV Cables <span className="text-[#22c55e] text-[10px] ml-1">(11kV)</span>:</span>
                 <span className="font-mono">{formatIndianNumber(lvLen)} km <span className="text-gray-500">({lvCables.length} cables)</span></span>
               </div>
             </div>

             <div className="mt-6 bg-[#0d1117] p-4 rounded border border-red-900/50">
               <div className="text-xs text-gray-400 mb-1">Highest Loss Cable:</div>
               <div className="text-sm font-bold text-[#FF9933] mb-1">{highestLossCable?.fromId} → {highestLossCable?.toId}</div>
               <div className="text-xs text-gray-300 flex justify-between">
                 <span>Loss: <span className="text-red-400">{highestLossCable?.lossPercent}%</span></span>
                 <span>Annual Cost: <span className="text-red-400">{formatRupeeAuto(highestLossCable?.lossCost)}</span></span>
               </div>
             </div>

             <div className="flex justify-between items-center bg-[#0d1117] p-3 rounded border border-[#2a3f5f]">
               <span className="text-sm text-gray-400">Average Loss Rate:</span>
               <span className="font-bold text-white">{avgLoss}%</span>
             </div>
          </div>

          <div className="lg:w-1/2 flex items-center justify-center">
             <div className="w-[400px] bg-[#0d1117] rounded-lg border border-[#2a3f5f] p-4">
               <div className="text-xs text-gray-400 mb-4 text-center">Top 5 Cables by Annual Loss Cost</div>
               <svg width="360" height="150" viewBox="0 0 360 150">
                  {topCables.map((c, i) => {
                     const barWidth = maxLossValue > 0 ? (c.lossCost / maxLossValue) * 140 : 0;
                     // Gradient proxy via linear scale representing red shift
                     const r = Math.min(255, 100 + (c.lossCost / maxLossValue) * 155);
                     const g = Math.max(50, 200 - (c.lossCost / maxLossValue) * 150);
                     const fillCol = `rgb(${r}, ${g}, 50)`;

                     return (
                       <g key={`bar-${i}`} transform={`translate(0, ${i * 28})`}>
                         <text x="0" y="14" fill="#999" fontSize="10">{c.fromId} → {c.toId}</text>
                         <rect x="150" y="4" width={barWidth} height="12" fill={fillCol} rx="2" />
                         <text x="360" y="14" fill="#fff" fontSize="10" textAnchor="end">{formatRupeeAuto(c.lossCost)}</text>
                       </g>
                     );
                  })}
               </svg>
             </div>
          </div>

        </div>
      </section>

      {/* Footer Info */}
      <div className="flex justify-between items-end pt-8 pb-4">
        <div className="text-[#666] text-[11px]">
          💡 Tip: Use browser print (Ctrl+P) to save this report as PDF
        </div>
        <div className="text-[#444] text-[10px]">
          Generated: {new Date().toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
          })}
        </div>
      </div>

    </div>
  );
}

Dashboard.propTypes = {
  zones: PropTypes.object,
  substations: PropTypes.object,
  computed: PropTypes.object,
  inputs: PropTypes.object
};
