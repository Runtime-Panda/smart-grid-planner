import React, { createContext, useReducer, useContext } from 'react';
import { 
  FACTORY_SMALL_KW, FACTORY_MEDIUM_KW, FACTORY_LARGE_KW,
  HOUSE_PEAK_KW, NUCLEAR_CAPACITY_MW, THERMAL_CAPACITY_MW
} from '../constants/indiaGridConstants';

const initialState = {
  inputs: {
    numHouses: 0,
    numSmall: 0,
    numMedium: 0,
    numLarge: 0
  },
  computed: {
    totalResidentialLoadKW: 0,
    totalIndustrialLoadKW: 0,
    totalPeakLoadMW: 0,
    nuclearHeadroomPercent: 0,
    thermalHeadroomPercent: 0,
    isOverCapacity: false,
    numSmallLoadMW: "0.00",
    numMediumLoadMW: "0.00",
    numLargeLoadMW: "0.00"
  },
  zones: null,
  substations: null,
  cables: null,
  simulation: {
    nuclearOffline: false,
    thermalOffline: false
  },
  simulationResult: null
};

const GridContext = createContext(initialState);

const gridReducer = (state, action) => {
  switch (action.type) {
    case 'SET_INPUTS': {
      return {
        ...state,
        inputs: action.payload
      };
    }
    case 'SET_COMPUTED': {
      const { numHouses, numSmall, numMedium, numLarge } = state.inputs;
      
      const totalResidentialLoadKW = numHouses * HOUSE_PEAK_KW;
      
      const numSmallLoadKW = numSmall * FACTORY_SMALL_KW;
      const numMediumLoadKW = numMedium * FACTORY_MEDIUM_KW;
      const numLargeLoadKW = numLarge * FACTORY_LARGE_KW;
      
      const totalIndustrialLoadKW = numSmallLoadKW + numMediumLoadKW + numLargeLoadKW;
      const totalPeakLoadMW = (totalResidentialLoadKW + totalIndustrialLoadKW) / 1000;

      const totalCapacityMW = (!state.simulation.nuclearOffline ? NUCLEAR_CAPACITY_MW : 0) + 
                              (!state.simulation.thermalOffline ? THERMAL_CAPACITY_MW : 0);
      
      const isOverCapacity = totalPeakLoadMW > totalCapacityMW;

      const nH = !state.simulation.nuclearOffline ? Math.max(0, 100 - (totalPeakLoadMW / NUCLEAR_CAPACITY_MW) * 100) : 0;
      const tH = !state.simulation.thermalOffline ? Math.max(0, 100 - (totalPeakLoadMW / THERMAL_CAPACITY_MW) * 100) : 0;

      return {
        ...state,
        computed: {
          totalResidentialLoadKW,
          totalIndustrialLoadKW,
          totalPeakLoadMW,
          nuclearHeadroomPercent: isFinite(nH) ? nH : 0,
          thermalHeadroomPercent: isFinite(tH) ? tH : 0,
          isOverCapacity,
          numSmallLoadMW: (numSmallLoadKW / 1000).toFixed(2),
          numMediumLoadMW: (numMediumLoadKW / 1000).toFixed(2),
          numLargeLoadMW: (numLargeLoadKW / 1000).toFixed(2)
        }
      };
    }
    case 'SET_ZONES':
      return { ...state, zones: action.payload };
    case 'SET_SUBSTATIONS':
      return { ...state, substations: action.payload };
    case 'SET_CABLES':
      return { ...state, cables: action.payload };
    case 'TOGGLE_NUCLEAR_OFFLINE':
      return { 
        ...state, 
        simulation: { 
          ...state.simulation, 
          nuclearOffline: !state.simulation.nuclearOffline 
        } 
      };
    case 'TOGGLE_THERMAL_OFFLINE':
      return { 
        ...state, 
        simulation: { 
          ...state.simulation, 
          thermalOffline: !state.simulation.thermalOffline 
        } 
      };
    case 'SET_SIMULATION_RESULT':
      return { ...state, simulationResult: action.payload };
    case 'RESET_SIMULATION':
      return {
        ...state,
        simulation: { nuclearOffline: false, thermalOffline: false },
        simulationResult: null
      };
    case 'TRIGGER_GENERATE':
      return {
        ...state,
        triggerGenerate: (state.triggerGenerate || 0) + 1
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

export const GridProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gridReducer, initialState);
  return React.createElement(
    GridContext.Provider,
    { value: { state, dispatch } },
    children
  );
};

export const useGridStore = () => useContext(GridContext);

