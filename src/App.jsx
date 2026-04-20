import React, { useEffect } from 'react';
import { GridProvider, useGridStore } from './store/gridStore';
import InputPanel from './components/InputPanel';
import CityDiagram from './components/CityDiagram';
import Dashboard from './components/Dashboard';
import FailureSimulator from './components/FailureSimulator';
import { computeZones } from './algorithms/zoningAlgo';
import { computeSubstations } from './algorithms/substationAlgo';

function GridSimulation() {
  const { state, dispatch } = useGridStore();

  useEffect(() => {
    if (state.triggerGenerate && state.triggerGenerate > 0) {
      const zonesData = computeZones(state.inputs);
      dispatch({ type: 'SET_ZONES', payload: zonesData });
      const subsData = computeSubstations(zonesData);
      dispatch({ type: 'SET_SUBSTATIONS', payload: subsData });
    }
  }, [state.triggerGenerate]);

  const isSimActive = state.simulation.nuclearOffline || state.simulation.thermalOffline;

  return (
    <div className="flex h-screen bg-[#111111] overflow-hidden text-gray-100 font-sans">
      <div className="w-[380px] flex-shrink-0 border-r border-[#2a3f5f]">
        <InputPanel />
      </div>

      <div className="flex-grow flex flex-col bg-[#111111] overflow-y-auto">

        {/* Simulation Mode Banner */}
        {isSimActive && (
          <div className="w-full bg-[#7f1d1d] text-white text-center text-[12px] py-2 px-4 font-medium tracking-wide flex-shrink-0">
            ⚠ SIMULATION MODE — Grid failure scenario active. Real grid data shown in dashboard below.
          </div>
        )}

        {/* City Diagram */}
        <div className="flex-shrink-0 flex items-center justify-center relative w-full h-[800px] min-h-[800px]">
          <CityDiagram
            zones={state.zones}
            substations={state.substations}
            simulationResult={state.simulationResult}
          />
        </div>

        {/* Failure Simulator Bar — always visible once grid is generated */}
        {state.substations && (
          <FailureSimulator
            substations={state.substations}
            simulation={state.simulation}
            onToggleNuclear={() => dispatch({ type: 'TOGGLE_NUCLEAR_OFFLINE' })}
            onToggleThermal={() => dispatch({ type: 'TOGGLE_THERMAL_OFFLINE' })}
            onReset={() => dispatch({ type: 'RESET_SIMULATION' })}
            onSimulationResult={(result) =>
              dispatch({ type: 'SET_SIMULATION_RESULT', payload: result })
            }
          />
        )}

        {/* Dashboard */}
        {state.substations && (
          <>
            <div className="relative flex py-8 items-center px-8">
              <div className="flex-grow border-t border-[#2a3f5f]"></div>
              <span className="flex-shrink-0 mx-4 text-[#FF9933] text-[13px] font-bold tracking-widest">
                GRID MANAGER DASHBOARD
              </span>
              <div className="flex-grow border-t border-[#2a3f5f]"></div>
            </div>
            <Dashboard
              zones={state.zones}
              substations={state.substations}
              computed={state.computed}
              inputs={state.inputs}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GridProvider>
      <GridSimulation />
    </GridProvider>
  );
}
