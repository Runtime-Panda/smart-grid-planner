import React, { useState, useRef } from 'react';
import { formatIndianNumber, formatCrore } from '../utils/formatters';

const SVG_SIZE = 900;
const SVG_CENTER = 450;
const SCALE = 20;

/**
 * Transforms mathematical coordinates (km from center) to SVG screen coordinates.
 * - Math origin (0,0) is center.
 * - Math +x is East, Math +y is North.
 * - SVG origin (0,0) is top-left.
 * - SVG +x is Right, SVG +y is Down.
 * @param {number} mathX - x coordinate in km
 * @param {number} mathY - y coordinate in km
 * @returns {{svgX: number, svgY: number}}
 */
const toSVG = (mathX, mathY) => {
  return {
    svgX: SVG_CENTER + mathX * SCALE,
    svgY: SVG_CENTER - mathY * SCALE
  };
};

export default function CityDiagram({ zones, substations, simulationResult }) {
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  if (!zones || !substations) {
    return (
      <div className="flex-grow flex items-center justify-center p-8 bg-[#111111] overflow-hidden text-gray-100 font-sans h-full">
         <div className="text-gray-500 text-lg font-medium">
           Click Generate Grid Layout to begin
         </div>
      </div>
    );
  }

  // Handle tooltip updates and container bounds checking
  const handleMouseMove = (e, data) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Position relative to viewport first
    let x = e.clientX + 15;
    let y = e.clientY + 15;

    // Boundary check within the container context
    // If within 200px of right edge of container, flip left
    if (rect.right - e.clientX < 220) {
      x = e.clientX - 220;
    }
    // If within 200px of bottom edge of container, flip up
    if (rect.bottom - e.clientY < 200) {
      y = e.clientY - 180;
    }

    setTooltipPos({ x, y });
    setTooltipData(data);
  };

  const handleMouseLeave = () => {
    setTooltipData(null);
  };

  const { cables } = substations;
  
  const hoveredSubstation = tooltipData && tooltipData.kind === 'substation' ? tooltipData.id : null;
  const hoveredCable = tooltipData && tooltipData.kind === 'cable' ? tooltipData.id : null;

  // Render SVG Layers
  return (
    <div 
      className="flex-grow bg-[#111111] relative overflow-hidden" 
      ref={containerRef}
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', overflowX: 'auto', padding: '20px 0' }}>
        <div className="relative" style={{ width: '100%', maxWidth: '900px' }}>
          <svg viewBox="0 0 900 900" style={{ maxWidth: '900px', width: '100%' }}>
          <defs>
            <style>{`
              @keyframes dash-flow {
                to { stroke-dashoffset: -12; }
              }
              @keyframes pulse-red {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.2; }
              }
              @keyframes glow-red {
                0%, 100% { filter: drop-shadow(0 0 4px #ef4444); }
                50% { filter: drop-shadow(0 0 14px #ef4444); }
              }
              @keyframes glow-amber {
                0%, 100% { filter: drop-shadow(0 0 4px #f59e0b); }
                50% { filter: drop-shadow(0 0 14px #f59e0b); }
              }
              @keyframes flow-HV {
                from { stroke-dashoffset: 20; }
                to { stroke-dashoffset: 0; }
              }
              @keyframes flow-MV {
                from { stroke-dashoffset: 20; }
                to { stroke-dashoffset: 0; }
              }
              @keyframes flow-LV {
                from { stroke-dashoffset: 20; }
                to { stroke-dashoffset: 0; }
              }
              .reroute-cable { animation: dash-flow 0.5s linear infinite; }
              .blackout-pulse { animation: pulse-red 1s ease-in-out infinite; }
              .overload-glow { animation: glow-red 1s ease-in-out infinite; }
            `}</style>
          </defs>
          
          {/* LAYER 1 — Background & Grid */}
          <rect width={SVG_SIZE} height={SVG_SIZE} fill="#0d1117" />
          {Array.from({ length: 46 }).map((_, i) => (
            <React.Fragment key={`grid-${i}`}>
              <line x1={0} y1={i * 20} x2={SVG_SIZE} y2={i * 20} stroke="#1a2332" strokeWidth="0.3" opacity="0.25" />
              <line x1={i * 20} y1={0} x2={i * 20} y2={SVG_SIZE} stroke="#1a2332" strokeWidth="0.3" opacity="0.25" />
            </React.Fragment>
          ))}

          {/* LAYER 2 — City Boundary */}
          <circle cx={SVG_CENTER} cy={SVG_CENTER} r="200" stroke="#2a3f5f" strokeWidth="2" fill="none" />
          <text x={SVG_CENTER} y="40" fill="#2a3f5f" fontSize="12" textAnchor="middle" opacity="0.8">
            City Boundary — 10km radius
          </text>

          {/* LAYER 3 — Zone Shading */}
          <path d="M 450 450 L 650 450 A 200 200 0 0 0 550 276.795 Z" fill="rgba(255, 153, 51, 0.06)" />
          <path d="M 450 450 L 550 276.795 A 200 200 0 1 0 650 450 Z" fill="rgba(59, 130, 246, 0.04)" />
          {/* Buffer zone strips */}
          <line x1="450" y1="450" x2="650" y2="450" stroke="#2a3f5f" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.15" />
          <line x1="450" y1="450" x2="550" y2="276.795" stroke="#2a3f5f" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.15" />

          {/* LAYER 4 — Zone Labels */}
          {(() => {
            const indLabel = toSVG(5, 3);
            const resLabel = toSVG(-3, -4);
            // Label on the buffer line (60 deg, halfway out -> r=5)
            const bufLabel = toSVG(5 * Math.cos(Math.PI/3), 5 * Math.sin(Math.PI/3));
            return (
              <>
                <text x={indLabel.svgX} y={indLabel.svgY} fill="#FF9933" fontSize="10" letterSpacing="2" opacity="0.45" textAnchor="middle">
                  INDUSTRIAL ZONE
                </text>
                <text x={resLabel.svgX} y={resLabel.svgY} fill="#3b82f6" fontSize="10" letterSpacing="2" opacity="0.45" textAnchor="middle">
                  RESIDENTIAL ZONE
                </text>
                <text x={bufLabel.svgX} y={bufLabel.svgY} fill="#666" fontSize="9" textAnchor="middle" transform={`rotate(-60 ${bufLabel.svgX} ${bufLabel.svgY})`} dy="-5">
                  BUFFER
                </text>
              </>
            );
          })()}

          {/* LAYER 5 — Cable Routes */}
          {cables.map(cable => {
            let fromPos, toPos;

            // Resolve From position
            if (cable.fromId === 'NUCLEAR') fromPos = toSVG(20, 0);
            else if (cable.fromId === 'THERMAL') fromPos = toSVG(0, 20);
            else {
              const fromSub = substations.substations.find(s => s.id === cable.fromId);
              fromPos = toSVG(fromSub.x, fromSub.y);
            }

            // Resolve To position
            const toSub = substations.substations.find(s => s.id === cable.toId);
            toPos = toSVG(toSub.x, toSub.y);

            // Style based on type
            let strokeColor = '#ef4444'; // default HV
            let strokeWidth = 3;
            let animDur = "1.5s";
            if (cable.type === 'MV') {
              strokeColor = '#f59e0b';
              strokeWidth = 2;
              animDur = "2.5s";
            } else if (cable.type === 'LV') {
              strokeColor = '#22c55e';
              strokeWidth = 1.5;
              animDur = "3.5s";
            }

            // Interactive state check
            const isHovered = hoveredCable === cable.id;
            const renderWidth = isHovered ? strokeWidth + 2 : strokeWidth;

            // Midpoint processing for label
            let midX = (fromPos.svgX + toPos.svgX) / 2;
            let midY = (fromPos.svgY + toPos.svgY) / 2;
            
            // Offset logic to avoid center substations (e.g. interconnect at SVG_CENTER)
            if (Math.abs(midX - SVG_CENTER) < 30 && Math.abs(midY - SVG_CENTER) < 30) {
                // Determine angle and push outward by 30px
                const ang = Math.atan2(toPos.svgY - fromPos.svgY, toPos.svgX - fromPos.svgX);
                const pushX = Math.sin(ang) * 40; // Perpendicular offset
                const pushY = -Math.cos(ang) * 40;
                midX += pushX;
                midY += pushY;
            }

            const labelStr = `${cable.voltageKV}kV | ${cable.lossPercent}%`;

            return (
              <g 
                key={cable.id}
                onMouseEnter={(e) => handleMouseMove(e, { kind: 'cable', ...cable })}
                onMouseMove={(e) => handleMouseMove(e, { kind: 'cable', ...cable })}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <line 
                  x1={fromPos.svgX} y1={fromPos.svgY} 
                  x2={toPos.svgX} y2={toPos.svgY}
                  stroke="transparent"
                  strokeWidth="12"
                  opacity="0"
                />
                <line 
                  x1={fromPos.svgX} y1={fromPos.svgY} 
                  x2={toPos.svgX} y2={toPos.svgY}
                  stroke={strokeColor}
                  strokeWidth={renderWidth}
                  opacity={0.8}
                />
                <line 
                  x1={fromPos.svgX} y1={fromPos.svgY} 
                  x2={toPos.svgX} y2={toPos.svgY}
                  stroke={strokeColor}
                  strokeWidth={renderWidth > 1 ? renderWidth - 1 : 1}
                  opacity={0.6}
                  strokeDasharray="6 14"
                  style={{ 
                    animation: `flow-${cable.type} ${
                      cable.type === 'HV' ? '1.5s' :
                      cable.type === 'MV' ? '2.5s' : '3.5s'
                    } linear infinite`
                  }}
                />
                
                {isHovered && (
                  <>
                    <rect 
                      x={midX - 30} y={midY - 6} 
                      width="60" height="12" 
                      fill="#0d1117" rx="2"
                      pointerEvents="none"
                    />
                    <text 
                      x={midX} y={midY + 3} 
                      fill={strokeColor} fontSize="8" 
                      textAnchor="middle" pointerEvents="none"
                    >
                      {labelStr}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* LAYER 6 — House Clusters */}
          {zones.residentialZone.houses.map(house => {
            const pos = toSVG(house.x, house.y);
            let r = 3;
            if (house.houseCount < 100) r = 2;
            else if (house.houseCount > 500) r = 4;
            return (
              <circle 
                key={house.id} 
                cx={pos.svgX} cy={pos.svgY} 
                r={r} fill="#3b82f6" opacity="0.35" pointerEvents="none" 
              />
            );
          })}

          {/* LAYER 7 — Factories */}
          {zones.industrialZone.factories.map(fact => {
            const pos = toSVG(fact.x, fact.y);
            let r = 5;
            let fill = '#FF9933';
            let opacity = '0.40';
            
            if (fact.sizeType === 'small') {
              r = 3; fill = '#FFB347'; opacity = '0.35';
            } else if (fact.sizeType === 'large') {
              r = 7; fill = '#FF6600'; opacity = '0.45';
            }

            return (
              <circle 
                key={fact.id} 
                cx={pos.svgX} cy={pos.svgY} 
                r={r} fill={fill} opacity={opacity} pointerEvents="none"
              />
            );
          })}

          {/* LAYER 7.5 — Substation Service Areas */}
          {substations.substations.map(sub => {
            const pos = toSVG(sub.x, sub.y);
            let radiusPx = 0;
            let strokeCol = '#FF9933';
            
            if (sub.type === 'interconnect') {
              radiusPx = 80;
              strokeCol = '#a855f7';
            } else if (sub.type === 'industrial') {
              strokeCol = '#FF9933';
              if (sub.servedFactories && sub.servedFactories.length > 0) {
                 const served = zones.industrialZone.factories.filter(f => sub.servedFactories.includes(f.id));
                 if (served.length > 0) {
                    const avgDist = served.reduce((sum, f) => sum + Math.sqrt((f.x - sub.x)**2 + (f.y - sub.y)**2), 0) / served.length;
                    radiusPx = avgDist * SCALE;
                 } else radiusPx = 40;
              } else radiusPx = 40;
            } else if (sub.type === 'residential') {
              strokeCol = '#3b82f6';
              if (sub.servedClusters && sub.servedClusters.length > 0) {
                 const served = zones.residentialZone.houses.filter(h => sub.servedClusters.includes(h.id));
                 if (served.length > 0) {
                    const avgDist = served.reduce((sum, h) => sum + Math.sqrt((h.x - sub.x)**2 + (h.y - sub.y)**2), 0) / served.length;
                    radiusPx = avgDist * SCALE;
                 } else radiusPx = 60;
              } else radiusPx = 60;
            }

            return (
              <circle 
                key={`sa-${sub.id}`}
                cx={pos.svgX} cy={pos.svgY} r={radiusPx}
                stroke={strokeCol} strokeWidth="1.5" strokeDasharray="8 4"
                fill="none" opacity="0.30" pointerEvents="none"
              />
            );
          })}

          {/* LAYER 8 — Power Plants */}
          {/* Nuclear Plant */}
          {(() => {
            const pos = toSVG(20, 0);
            return (
              <g transform={`translate(${pos.svgX}, ${pos.svgY})`}>
                <circle cx="0" cy="0" r="18" fill="#1a1a2e" stroke="#ef4444" strokeWidth="2" />
                <circle cx="0" cy="0" r="7" fill="#ef4444" />
                {/* 3 radiation arcs */}
                {[0, 120, 240].map(angle => (
                  <path key={angle} transform={`rotate(${angle})`} d="M 10 0 A 10 10 0 0 1 5 8.66 L 7.5 12.99 A 15 15 0 0 0 15 0 Z" fill="none" stroke="#ef4444" strokeWidth="2" />
                ))}
                <text x="0" y="32" fill="#ef4444" fontSize="10" textAnchor="middle" fontWeight="bold">☢ Nuclear</text>
                <text x="0" y="44" fill="#666" fontSize="8" textAnchor="middle">1000 MW</text>
              </g>
            );
          })()}

          {/* Thermal Plant */}
          {(() => {
            const pos = toSVG(0, 20);
            return (
              <g transform={`translate(${pos.svgX}, ${pos.svgY})`}>
                {/* Chimneys */}
                <rect x="-10" y="-20" width="5" height="10" fill="#f59e0b" />
                <rect x="5" y="-20" width="5" height="10" fill="#f59e0b" />
                {/* Smoke */}
                <circle cx="-7.5" cy="-25" r="3" fill="#444" />
                <circle cx="-4" cy="-30" r="2" fill="#444" />
                <circle cx="7.5" cy="-25" r="2" fill="#444" />
                {/* Main Body */}
                <rect x="-14" y="-10" width="28" height="18" fill="#1a1a2e" stroke="#f59e0b" strokeWidth="2" rx="2" />
                <text x="0" y="20" fill="#f59e0b" fontSize="10" textAnchor="middle" fontWeight="bold">⚡ Thermal</text>
                <text x="0" y="30" fill="#666" fontSize="8" textAnchor="middle">600 MW</text>
              </g>
            );
          })()}

          {/* LAYER 9 — Substations */}
          {substations.substations.map(sub => {
            const pos = toSVG(sub.x, sub.y);
            const loadStr = `${sub.loadPercent}%`;
            
            let loadColor = '#22c55e'; // green
            if (sub.loadPercent >= 90) loadColor = '#ef4444'; // red
            else if (sub.loadPercent >= 70) loadColor = '#f59e0b'; // amber

            const barWidth = 28;
            const fillWidth = Math.min((sub.loadPercent / 100) * barWidth, barWidth);

            const isIndustrial = sub.type === 'industrial';
            const isResidential = sub.type === 'residential';
            const isInterconnect = sub.type === 'interconnect';

            let mainStroke = '#FF9933';
            if (isResidential) mainStroke = '#3b82f6';
            if (isInterconnect) mainStroke = '#a855f7';

            const isHovered = hoveredSubstation === sub.id;

            return (
              <g 
                key={sub.id} 
                transform={`translate(${pos.svgX}, ${pos.svgY})`}
                onMouseEnter={(e) => handleMouseMove(e, { kind: 'substation', ...sub })}
                onMouseMove={(e) => handleMouseMove(e, { kind: 'substation', ...sub })}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                {/* ID Label (Hover Only) */}
                {isHovered && <text x="0" y="-18" fill="#999" fontSize="9" textAnchor="middle">{sub.id}</text>}
                
                {/* Shape rendering */}
                {isIndustrial && (
                  <>
                    <rect x="-12" y="-12" width="24" height="24" fill="#1a2332" stroke={mainStroke} strokeWidth="2" />
                    <text x="0" y="3" fill={mainStroke} fontSize="10" textAnchor="middle" fontWeight="bold">S</text>
                  </>
                )}
                
                {isResidential && (
                  <>
                    <circle cx="0" cy="0" r="14" fill="#1a2332" stroke={mainStroke} strokeWidth="2" />
                    <text x="0" y="3" fill={mainStroke} fontSize="10" textAnchor="middle" fontWeight="bold">R</text>
                  </>
                )}

                {isInterconnect && (
                  <g transform="rotate(45)">
                    <rect x="-10" y="-10" width="20" height="20" fill="#1a2332" stroke={mainStroke} strokeWidth="2.5" />
                    <text x="0" y="3" fill={mainStroke} fontSize="8" textAnchor="middle" fontWeight="bold" transform="rotate(-45)">IC</text>
                  </g>
                )}

                {/* Load Bar and Label (Hover Only) */}
                {isHovered && (
                  <>
                    <g transform="translate(-14, 16)">
                       <rect x="0" y="0" width={barWidth} height="4" fill="#333" />
                       <rect x="0" y="0" width={fillWidth} height="4" fill={loadColor} />
                    </g>
                    <text x="0" y="28" fill={mainStroke} fontSize="9" textAnchor="middle">{loadStr}</text>
                  </>
                )}
              </g>
            );
          })}

          {/* LAYER 10 — Legend */}
          <g transform="translate(710, 20)">
            <rect width="175" height="150" fill="rgba(13, 17, 23, 0.9)" stroke="#2a3f5f" strokeWidth="1" rx="4" />
            <text x="87.5" y="20" fill="#FF9933" fontSize="11" textAnchor="middle" fontWeight="bold">LEGEND</text>
            
            <g transform="translate(10, 40)">
              {/* Cables */}
              <line x1="0" y1="0" x2="20" y2="0" stroke="#ef4444" strokeWidth="3" />
              <text x="25" y="3" fill="#ccc" fontSize="9">132kV HV Transmission</text>
              <line x1="0" y1="15" x2="20" y2="15" stroke="#f59e0b" strokeWidth="2" />
              <text x="25" y="18" fill="#ccc" fontSize="9">33kV MV Distribution</text>
              <line x1="0" y1="30" x2="20" y2="30" stroke="#22c55e" strokeWidth="1.5" />
              <text x="25" y="33" fill="#ccc" fontSize="9">11kV LV Distribution</text>

              {/* Substations */}
              <rect x="5" y="45" width="10" height="10" fill="none" stroke="#FF9933" strokeWidth="1.5" />
              <text x="25" y="54" fill="#ccc" fontSize="9">Industrial Substation</text>
              <circle cx="10" cy="67" r="5" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="25" y="70" fill="#ccc" fontSize="9">Residential Substation</text>
              <g transform="translate(10, 83) rotate(45)"><rect x="-4" y="-4" width="8" height="8" fill="none" stroke="#a855f7" strokeWidth="1.5" /></g>
              <text x="25" y="86" fill="#ccc" fontSize="9">Interconnect Hub</text>

              {/* Plants */}
              <circle cx="10" cy="102" r="5" fill="#ef4444" />
              <text x="25" y="105" fill="#ccc" fontSize="9">Nuclear Plant (1000MW)</text>
              <rect x="6" y="115" width="8" height="8" fill="#f59e0b" />
              <text x="25" y="122" fill="#ccc" fontSize="9">Thermal Plant (600MW)</text>
            </g>
          </g>

          {/* LAYER 11 — Scale Bar */}
          <g transform="translate(30, 860)">
            <line x1="0" y1="0" x2="40" y2="0" stroke="#666" strokeWidth="1" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#666" strokeWidth="1" />
            <line x1="40" y1="-3" x2="40" y2="3" stroke="#666" strokeWidth="1" />
            <text x="20" y="12" fill="#666" fontSize="9" textAnchor="middle">2 km</text>
          </g>

          {/* LAYER 11.5 — North Arrow */}
          {(() => {
             const nx = SVG_SIZE - 45;
             const ny = SVG_SIZE - 70;
             return (
               <g>
                 <line x1={nx} y1={ny} x2={nx} y2={ny - 20} stroke="#666" strokeWidth="1" />
                 <polygon points={`${nx-5},${ny-15} ${nx+5},${ny-15} ${nx},${ny-25}`} fill="#666" />
                 <circle cx={nx} cy={ny} r="3" fill="none" stroke="#666" strokeWidth="1" />
                 <text x={nx} y={ny - 30} fill="#666" fontSize="9" textAnchor="middle">N</text>
               </g>
             );
          })()}

          {/* LAYER 12 — Simulation Overlays */}
          {simulationResult && (() => {
            const sim = simulationResult;
            const nuclearPos = toSVG(20, 0);
            const thermalPos = toSVG(0, 20);

            return (
              <g id="sim-overlays">

                {/* Dead / offline cables from offline plant */}
                {cables.map(cable => {
                  const isFromOfflinePlant =
                    (cable.fromId === 'NUCLEAR' && !sim.plantStatus.nuclear.online) ||
                    (cable.fromId === 'THERMAL' && !sim.plantStatus.thermal.online);
                  if (!isFromOfflinePlant) return null;
                  let fromPos;
                  if (cable.fromId === 'NUCLEAR') fromPos = toSVG(20, 0);
                  else fromPos = toSVG(0, 20);
                  const toSub = substations.substations.find(s => s.id === cable.toId);
                  if (!toSub) return null;
                  const toPos = toSVG(toSub.x, toSub.y);
                  const midX = (fromPos.svgX + toPos.svgX) / 2;
                  const midY = (fromPos.svgY + toPos.svgY) / 2;
                  return (
                    <g key={`dead-${cable.id}`}>
                      <line x1={fromPos.svgX} y1={fromPos.svgY} x2={toPos.svgX} y2={toPos.svgY}
                        stroke="#444" strokeWidth="2" opacity="0.4" />
                      <text x={midX} y={midY} fill="#555" fontSize="7" textAnchor="middle" pointerEvents="none">
                        DEAD
                      </text>
                    </g>
                  );
                })}

                {/* Rerouted cables (from interconnect to affected subs) */}
                {cables.map(cable => {
                  const isReroute =
                    sim.reroutedSubstations.includes(cable.toId) ||
                    sim.reroutedSubstations.includes(cable.fromId);
                  if (!isReroute) return null;
                  const isFromIC = substations.substations.find(s => s.id === cable.fromId && s.type === 'interconnect');
                  const isToRerouted = sim.reroutedSubstations.includes(cable.toId);
                  if (!isFromIC || !isToRerouted) return null;

                  let fromPos;
                  const fromSub = substations.substations.find(s => s.id === cable.fromId);
                  fromPos = fromSub ? toSVG(fromSub.x, fromSub.y) : toSVG(0, 0);
                  const toSub = substations.substations.find(s => s.id === cable.toId);
                  if (!toSub) return null;
                  const toPos = toSVG(toSub.x, toSub.y);
                  const midX = (fromPos.svgX + toPos.svgX) / 2;
                  const midY = (fromPos.svgY + toPos.svgY) / 2;

                  return (
                    <g key={`reroute-${cable.id}`}>
                      <line x1={fromPos.svgX} y1={fromPos.svgY} x2={toPos.svgX} y2={toPos.svgY}
                        stroke="#a855f7" strokeWidth="5"
                        strokeDasharray="8 4"
                        className="reroute-cable"
                        opacity="0.9"
                      />
                      <rect x={midX - 28} y={midY - 7} width="56" height="13" fill="#0d1117" rx="2" pointerEvents="none" />
                      <text x={midX} y={midY + 3} fill="#a855f7" fontSize="8" textAnchor="middle" fontWeight="bold" pointerEvents="none">
                        REROUTED
                      </text>
                    </g>
                  );
                })}

                {/* Blackout substation overlays */}
                {sim.blackoutSubstations.map(subId => {
                  const sub = substations.substations.find(s => s.id === subId);
                  if (!sub) return null;
                  const pos = toSVG(sub.x, sub.y);
                  return (
                    <g key={`blackout-${subId}`} transform={`translate(${pos.svgX}, ${pos.svgY})`}>
                      <circle cx="0" cy="0" r="20" fill="#111" opacity="0.75" className="blackout-pulse" />
                      <text x="0" y="5" fontSize="16" textAnchor="middle" fill="#ef4444" pointerEvents="none">⚠</text>
                    </g>
                  );
                })}

                {/* Overloaded substation glow */}
                {sim.overloadedSubstations.map(subId => {
                  const sub = substations.substations.find(s => s.id === subId);
                  if (!sub) return null;
                  const pos = toSVG(sub.x, sub.y);
                  return (
                    <g key={`overload-${subId}`} transform={`translate(${pos.svgX}, ${pos.svgY})`}>
                      <circle cx="0" cy="0" r="22" fill="none" stroke="#ef4444" strokeWidth="3"
                        className="overload-glow" opacity="0.9" />
                    </g>
                  );
                })}

                {/* Offline plant: grey out + red X + pulse ring — Nuclear */}
                {!sim.plantStatus.nuclear.online && (
                  <g transform={`translate(${nuclearPos.svgX}, ${nuclearPos.svgY})`}>
                    <circle cx="0" cy="0" r="22" fill="#111" opacity="0.6" />
                    <circle cx="0" cy="0" r="26" fill="none" stroke="#ef4444" strokeWidth="2"
                      className="blackout-pulse" />
                    <line x1="-14" y1="-14" x2="14" y2="14" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                    <line x1="14" y1="-14" x2="-14" y2="14" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                    <text x="0" y="44" fill="#ef4444" fontSize="9" textAnchor="middle" fontWeight="bold">OFFLINE</text>
                  </g>
                )}

                {/* Offline plant: grey out + amber X + pulse ring — Thermal */}
                {!sim.plantStatus.thermal.online && (
                  <g transform={`translate(${thermalPos.svgX}, ${thermalPos.svgY})`}>
                    <circle cx="0" cy="0" r="22" fill="#111" opacity="0.6" />
                    <circle cx="0" cy="0" r="26" fill="none" stroke="#f59e0b" strokeWidth="2"
                      className="blackout-pulse" />
                    <line x1="-14" y1="-14" x2="14" y2="14" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                    <line x1="14" y1="-14" x2="-14" y2="14" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                    <text x="0" y="50" fill="#f59e0b" fontSize="9" textAnchor="middle" fontWeight="bold">OFFLINE</text>
                  </g>
                )}

              </g>
            );
          })()}
          
        </svg>

        {/* HTML Tooltip Overlay Component */}
        {tooltipData && (
          <div 
            className="fixed z-50 bg-[#161b22] border border-[#FF9933] rounded shadow-lg p-3 text-white text-xs w-48 pointer-events-none"
            style={{ 
              left: tooltipPos.x, 
              top: tooltipPos.y,
            }}
          >
            {tooltipData.kind === 'substation' && (
              <div className="space-y-1">
                <div className="font-bold text-[#FF9933] mb-2">{tooltipData.id}</div>
                <div><span className="text-gray-400">Type:</span> <span className="capitalize">{tooltipData.type}</span></div>
                <div><span className="text-gray-400">Capacity:</span> {tooltipData.capacityMW} MW</div>
                <div><span className="text-gray-400">Load:</span> {tooltipData.loadMW} MW ({tooltipData.loadPercent}%)</div>
                <div><span className="text-gray-400">Primary:</span> <span className="capitalize">{tooltipData.primaryPlant}</span></div>
                <div><span className="text-gray-400">Cost:</span> {formatCrore(tooltipData.cost)}</div>
              </div>
            )}
            {tooltipData.kind === 'cable' && (
              <div className="space-y-1">
                <div className="font-bold text-[#FF9933] mb-2">{tooltipData.fromId} → {tooltipData.toId}</div>
                <div><span className="text-gray-400">Voltage:</span> {tooltipData.voltageKV} kV</div>
                <div><span className="text-gray-400">Length:</span> {formatIndianNumber(tooltipData.lengthKm)} km</div>
                <div><span className="text-gray-400">Loss:</span> {tooltipData.lossPercent}%</div>
                <div className="text-red-300 mt-1"><span className="text-gray-400">Annual Loss Cost:</span> {formatCrore(cableCostEstimate(tooltipData, substations.substations))}</div>
              </div>
            )}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}

// Quick helper to evaluate local exact loss cost for the tooltip rendering context
function cableCostEstimate(cableData, subsList) {
  const ENERGY_COST_MWH = 4500;
  const toSub = subsList.find(s => s.id === cableData.toId);
  const loadMW = toSub ? toSub.loadMW : 0;
  return Math.round((cableData.lossPercent / 100) * loadMW * 8760 * ENERGY_COST_MWH); 
}
