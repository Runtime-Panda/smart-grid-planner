import React, { useEffect, useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { formatIndianNumber } from '../utils/formatters';
import { 
  MAX_HOUSES, 
  MAX_FACTORIES_SMALL, 
  MAX_FACTORIES_MEDIUM, 
  MAX_FACTORIES_LARGE
} from '../constants/indiaGridConstants';

export default function InputPanel() {
  const { state, dispatch } = useGridStore();
  const { inputs, computed } = state;
  const [refExpanded, setRefExpanded] = useState(false);

  useEffect(() => {
    dispatch({ type: 'SET_COMPUTED' });
  }, [inputs, dispatch]);

  const handleInputChange = (field, value, max) => {
    let val = parseInt(value, 10);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > max) val = max;
    dispatch({ type: 'SET_INPUTS', payload: { ...inputs, [field]: val } });
  };

  const handleGenerate = () => {
    dispatch({ type: 'TRIGGER_GENERATE' });
  };

  const isPanelEmpty = inputs.numHouses === 0 && inputs.numSmall === 0 && inputs.numMedium === 0 && inputs.numLarge === 0;

  const capacityUsed = (
    (inputs.numHouses / MAX_HOUSES) * 0.5 +
    (inputs.numSmall / MAX_FACTORIES_SMALL) * 0.15 +
    (inputs.numMedium / MAX_FACTORIES_MEDIUM) * 0.2 +
    (inputs.numLarge / MAX_FACTORIES_LARGE) * 0.15
  ) * 100;

  let capacityColor = "bg-green-500";
  if (capacityUsed >= 60 && capacityUsed <= 80) capacityColor = "bg-amber-500";
  if (capacityUsed > 80) capacityColor = "bg-red-500";

  return (
    <div className="w-[380px] bg-gray-900 border-r border-gray-700 h-screen flex flex-col p-6 text-gray-200 shadow-2xl z-10 shrink-0 overflow-y-auto">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold text-[#FF9933]">Smart Grid Planner</h1>
        <p className="text-sm text-gray-400 mt-1">Power Distribution Planning Tool</p>
      </div>

      <div className="flex flex-col gap-5 flex-grow">
        {/* Residential Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold">Residential Units</span>
            <input 
              type="number"
              value={inputs.numHouses === 0 ? '' : inputs.numHouses}
              onChange={(e) => handleInputChange('numHouses', e.target.value, MAX_HOUSES)}
              className="w-24 bg-gray-800 text-white text-sm font-mono p-1 rounded border border-gray-700 text-right outline-none focus:border-[#FF9933]"
              placeholder="0"
            />
          </div>
          <input 
            type="range" 
            min="0" 
            max={MAX_HOUSES} 
            step="100"
            value={inputs.numHouses}
            onChange={(e) => handleInputChange('numHouses', e.target.value, MAX_HOUSES)}
            className="w-full accent-[#FF9933]"
          />
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>Est. Population: {formatIndianNumber(Math.round(inputs.numHouses * 2.8))}</span>
            <span>Residential Load: {(inputs.numHouses * 3.0 / 1000).toFixed(2)} MW</span>
          </div>
        </div>

        {/* Industrial Section */}
        <div>
          <h2 className="text-sm font-semibold mb-3 border-b border-gray-700 pb-1">Industrial Units</h2>
          
          {/* Small Factories */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <div>
                <div className="text-sm font-semibold">Small Factories</div>
                <div className="text-[11px] text-gray-400">500 kW each</div>
              </div>
              <input 
                type="number"
                value={inputs.numSmall === 0 ? '' : inputs.numSmall}
                onChange={(e) => handleInputChange('numSmall', e.target.value, MAX_FACTORIES_SMALL)}
                className="w-16 bg-gray-800 text-white text-sm font-mono p-1 rounded border border-gray-700 text-right outline-none focus:border-[#FF9933]"
                placeholder="0"
              />
            </div>
            <input 
              type="range" 
              min="0" 
              max={MAX_FACTORIES_SMALL} 
              step="1"
              value={inputs.numSmall}
              onChange={(e) => handleInputChange('numSmall', e.target.value, MAX_FACTORIES_SMALL)}
              className="w-full accent-[#FF9933]"
            />
          </div>

          {/* Medium Factories */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <div>
                <div className="text-sm font-semibold">Medium Factories</div>
                <div className="text-[11px] text-gray-400">1,000 kW each</div>
              </div>
              <input 
                type="number"
                value={inputs.numMedium === 0 ? '' : inputs.numMedium}
                onChange={(e) => handleInputChange('numMedium', e.target.value, MAX_FACTORIES_MEDIUM)}
                className="w-16 bg-gray-800 text-white text-sm font-mono p-1 rounded border border-gray-700 text-right outline-none focus:border-[#FF9933]"
                placeholder="0"
              />
            </div>
            <input 
              type="range" 
              min="0" 
              max={MAX_FACTORIES_MEDIUM} 
              step="1"
              value={inputs.numMedium}
              onChange={(e) => handleInputChange('numMedium', e.target.value, MAX_FACTORIES_MEDIUM)}
              className="w-full accent-[#FF9933]"
            />
          </div>

          {/* Large Factories */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <div>
                <div className="text-sm font-semibold">Large Factories</div>
                <div className="text-[11px] text-gray-400">2,000 kW each</div>
              </div>
              <input 
                type="number"
                value={inputs.numLarge === 0 ? '' : inputs.numLarge}
                onChange={(e) => handleInputChange('numLarge', e.target.value, MAX_FACTORIES_LARGE)}
                className="w-16 bg-gray-800 text-white text-sm font-mono p-1 rounded border border-gray-700 text-right outline-none focus:border-[#FF9933]"
                placeholder="0"
              />
            </div>
            <input 
              type="range" 
              min="0" 
              max={MAX_FACTORIES_LARGE} 
              step="1"
              value={inputs.numLarge}
              onChange={(e) => handleInputChange('numLarge', e.target.value, MAX_FACTORIES_LARGE)}
              className="w-full accent-[#FF9933]"
            />
          </div>
        </div>

        {/* Consumption Reference Box */}
        <div className="bg-[#111827] border border-[#2a3f5f] rounded-lg text-[11px]">
          <button 
            className="w-full p-2 text-left text-[#666] font-semibold flex justify-between items-center"
            onClick={() => setRefExpanded(!refExpanded)}
          >
            <span>ℹ Power Consumption Reference</span>
            <span>{refExpanded ? '▼' : '▶'}</span>
          </button>
          {refExpanded && (
            <div className="p-2 pt-0 text-gray-400 flex flex-col gap-1 border-t border-[#2a3f5f] mt-1 space-y-1">
              <div className="flex justify-between pt-1"><span>1 Small Factory</span><span>= 500 kW</span></div>
              <div className="flex justify-between"><span>1 Medium Factory</span><span>= 1,000 kW</span></div>
              <div className="flex justify-between"><span>1 Large Factory</span><span>= 2,000 kW</span></div>
              <div className="flex justify-between"><span>1 Household</span><span>= 1.5 kW avg / 3.0 kW peak</span></div>
            </div>
          )}
        </div>

        {/* Capacity Bar */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold">City Capacity Used: {capacityUsed.toFixed(1)}%</span>
          </div>
          <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${capacityColor} transition-all duration-300`} 
              style={{ width: `${Math.min(100, capacityUsed)}%` }}
            ></div>
          </div>
        </div>

        {/* Live Load Summary */}
        <div className="bg-gray-800 rounded-lg p-4 mb-2">
          <h3 className="text-xs uppercase text-gray-400 font-semibold mb-3 tracking-wider">Live Load Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Residential Load</span>
              <span className="font-mono text-white">{(computed.totalResidentialLoadKW / 1000).toFixed(2)} MW</span>
            </div>
            <div className="flex flex-col">
              <div className="flex justify-between items-center">
                <span>Industrial Load</span>
                <span className="font-mono text-white">{(computed.totalIndustrialLoadKW / 1000).toFixed(2)} MW</span>
              </div>
              <div className="text-[10px] text-gray-400 text-right mt-0.5">
                (Small: {computed.numSmallLoadMW} + Medium: {computed.numMediumLoadMW} + Large: {computed.numLargeLoadMW})
              </div>
            </div>
            <div className="border-t border-gray-700 my-2 pt-2 flex justify-between font-bold text-[#FF9933]">
              <span>Total Peak Load</span>
              <span className="font-mono">{(computed.totalPeakLoadMW).toFixed(2)} MW</span>
            </div>
            <div className="flex justify-between">
              <span>Est. Population</span>
              <span className="font-mono text-white">{formatIndianNumber(Math.round(inputs.numHouses * 2.8))}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-gray-700 mt-2">
              <span>Nuclear Headroom</span>
              <span className="font-mono">{computed.nuclearHeadroomPercent.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Thermal Headroom</span>
              <span className="font-mono">{computed.thermalHeadroomPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {computed.isOverCapacity && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 text-xs p-3 rounded-lg text-center font-medium shrink-0">
            Load exceeds grid capacity. Reduce inputs.
          </div>
        )}
      </div>

      <button 
        className={`w-full py-3 rounded-lg font-bold transition-all shrink-0 mt-4
          ${(isPanelEmpty || computed.isOverCapacity) 
            ? 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-400' 
            : 'bg-[#FF9933] text-gray-900 hover:bg-[#ffaa4d]'
          }
        `}
        disabled={isPanelEmpty || computed.isOverCapacity}
        onClick={handleGenerate}
      >
        Generate Grid Layout
      </button>
    </div>
  );
}
