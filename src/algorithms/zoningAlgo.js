import { 
  FACTORY_SMALL_KW, FACTORY_MEDIUM_KW, FACTORY_LARGE_KW,
  HOUSE_PEAK_KW 
} from '../constants/indiaGridConstants';

/**
 * Validates and clamps a point to be within the allowed sector bounds.
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {number} rMin - Minimum radius
 * @param {number} rMax - Maximum radius
 * @param {number} angleMinDeg - Minimum angle bound
 * @param {number} angleMaxDeg - Maximum angle bound
 * @returns {Object} {x, y} clamped position
 */
const constrainPoint = (x, y, rMin, rMax, angleMinDeg, angleMaxDeg) => {
  let r = Math.sqrt(x*x + y*y);
  let theta = Math.atan2(y, x);
  if (theta < 0) theta += 2 * Math.PI;

  const aMin = angleMinDeg * Math.PI / 180;
  const aMax = angleMaxDeg * Math.PI / 180;

  let changed = false;

  if (r < rMin) { r = rMin; changed = true; }
  if (r > rMax) { r = rMax; changed = true; }

  let inBounds = false;
  if (aMin <= aMax) {
    inBounds = (theta >= aMin && theta <= aMax);
  } else {
    inBounds = (theta >= aMin || theta <= aMax);
  }

  if (!inBounds) {
    let dMin = Math.min(Math.abs(theta - aMin), Math.abs(theta + 2 * Math.PI - aMin), Math.abs(theta - 2 * Math.PI - aMin));
    let dMax = Math.min(Math.abs(theta - aMax), Math.abs(theta + 2 * Math.PI - aMax), Math.abs(theta - 2 * Math.PI - aMax));
    theta = dMin < dMax ? aMin : aMax;
    changed = true;
  }

  if (changed) {
    console.warn(`Validation clamped position from (${x.toFixed(2)}, ${y.toFixed(2)}) to valid sector boundaries.`);
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  }
  return { x, y };
};

/**
 * Computes all zones, handling geometries, clustering, bounding and loads.
 * @param {Object} inputs - Includes numHouses, numFactories, factorySize
 * @returns {Object} zonesData containing geometric layouts and capacities
 */
export const computeZones = (inputs) => {
  const { numHouses, numSmall = 0, numMedium = 0, numLarge = 0 } = inputs;
  
  const totalFactories = numSmall + numMedium + numLarge;

  const bufferHalfWidth = 0.75;
  
  // 1. Buffer Zone Polygon Generation
  // 0 degree ray
  const poly0 = [
    { x: 0, y: -bufferHalfWidth },
    { x: 10, y: -bufferHalfWidth },
    { x: 10, y: bufferHalfWidth },
    { x: 0, y: bufferHalfWidth }
  ];
  
  // 60 degree ray
  const rad60 = 60 * Math.PI / 180;
  const u60 = { x: Math.cos(rad60), y: Math.sin(rad60) };
  const n60 = { x: -Math.sin(rad60), y: Math.cos(rad60) };
  const poly60 = [
    { x: bufferHalfWidth * n60.x, y: bufferHalfWidth * n60.y },
    { x: 10 * u60.x + bufferHalfWidth * n60.x, y: 10 * u60.y + bufferHalfWidth * n60.y },
    { x: 10 * u60.x - bufferHalfWidth * n60.x, y: 10 * u60.y - bufferHalfWidth * n60.y },
    { x: -bufferHalfWidth * n60.x, y: -bufferHalfWidth * n60.y }
  ];

  // 2. Factory Placement
  const factories = [];
  if (totalFactories > 0) {
    let d = 0.5;
    while (d >= 0.2) {
      let tempCount = 0;
      for (let r = 3; r <= 8; r += d) {
        const offsetAng = Math.asin(bufferHalfWidth / r);
        const thetaMin = offsetAng;
        const thetaMax = rad60 - offsetAng;
        if (thetaMin < thetaMax) {
          tempCount += Math.floor((r * (thetaMax - thetaMin)) / d) + 1;
        }
      }
      if (tempCount >= totalFactories) break;
      d -= 0.05;
    }
    d = Math.max(0.2, d);

    const batchDefs = [];
    for (let i = 0; i < numSmall; i++) batchDefs.push({ sizekW: FACTORY_SMALL_KW, sizeType: 'small' });
    for (let i = 0; i < numMedium; i++) batchDefs.push({ sizekW: FACTORY_MEDIUM_KW, sizeType: 'medium' });
    for (let i = 0; i < numLarge; i++) batchDefs.push({ sizekW: FACTORY_LARGE_KW, sizeType: 'large' });

    let currentFactories = 0;
    outerLoop:
    for (let r = 3; r <= 8; r += d) {
      const offsetAng = Math.asin(bufferHalfWidth / r);
      let thetaMin = offsetAng;
      let thetaMax = rad60 - offsetAng;
      if (thetaMin >= thetaMax) continue;
      
      const arcLen = r * (thetaMax - thetaMin);
      const spots = Math.floor(arcLen / d) + 1;
      const angleStep = spots > 1 ? (thetaMax - thetaMin) / (spots - 1) : 0;
      
      for (let s = 0; s < spots; s++) {
        if (currentFactories >= totalFactories) break outerLoop;
        
        let theta = thetaMin + s * angleStep;
        if (Number.isNaN(theta)) theta = (thetaMin + thetaMax)/2;

        let x = r * Math.cos(theta);
        let y = r * Math.sin(theta);
        
        const constrained = constrainPoint(x, y, 3, 8, 0, 60);
        
        const def = batchDefs[currentFactories];
        
        factories.push({
          id: `F${String(currentFactories + 1).padStart(3, '0')}`,
          x: constrained.x,
          y: constrained.y,
          sizekW: def.sizekW,
          sizeType: def.sizeType,
          type: 'factory'
        });
        currentFactories++;
      }
    }
  }

  // 3. Residential Clustering
  let houses = [];
  if (numHouses > 0) {
    let candidates = [];
    const cellSize = 20 / 24;
    for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 24; j++) {
            let cx = -10 + (i + 0.5) * cellSize;
            let cy = -10 + (j + 0.5) * cellSize;
            let r = Math.sqrt(cx*cx + cy*cy);
            if (r >= 1 && r <= 9) {
                let theta = Math.atan2(cy, cx);
                if (theta < 0) theta += 2 * Math.PI;
                if (theta >= rad60 && theta < 2 * Math.PI) {
                    const dist60 = r * Math.sin(theta - rad60);
                    const dist0 = -cy;
                    let safe0 = true;
                    if (theta > 1.5 * Math.PI) safe0 = Math.abs(cy) >= bufferHalfWidth;
                    let safe60 = true;
                    if (theta < rad60 + Math.PI/2) safe60 = dist60 >= bufferHalfWidth;

                    if (safe0 && safe60) {
                        candidates.push({ x: cx, y: cy });
                    }
                }
            }
        }
    }

    if (candidates.length > 500) {
       const filtered = [];
       const step = candidates.length / 500;
       for (let c = 0; c < 500; c++) {
           filtered.push(candidates[Math.floor(c * step)]);
       }
       candidates = filtered;
    }

    if (candidates.length > 0) {
        let baseCount = Math.floor(numHouses / candidates.length);
        let remainder = numHouses % candidates.length;

        houses = candidates.map((c, idx) => {
            const hCount = baseCount + (idx < remainder ? 1 : 0);
            const constrained = constrainPoint(c.x, c.y, 1, 9, 60, 360);
            return {
                id: `H${String(idx + 1).padStart(3, '0')}`,
                x: constrained.x,
                y: constrained.y,
                houseCount: hCount,
                loadKW: hCount * HOUSE_PEAK_KW,
                type: 'houseCluster'
            };
        }).filter(h => h.houseCount > 0);
    }
  }

  // 4. Centroids Calcs
  const getCentroid = (points, weightKey) => {
      let wx = 0, wy = 0, totalW = 0;
      for (const p of points) {
          wx += p.x * p[weightKey];
          wy += p.y * p[weightKey];
          totalW += p[weightKey];
      }
      if (totalW === 0) return { x: 0, y: 0 };
      return { x: wx / totalW, y: wy / totalW };
  };

  const indCentroid = getCentroid(factories, 'sizekW');
  const resCentroid = getCentroid(houses, 'loadKW');

  const totalIndLoad = factories.reduce((sum, f) => sum + f.sizekW, 0);
  const totalResLoad = houses.reduce((sum, h) => sum + h.loadKW, 0);

  return {
    industrialZone: {
      startAngleDeg: 0,
      endAngleDeg: 60,
      centerPoint: indCentroid,
      factories
    },
    residentialZone: {
      startAngleDeg: 60,
      endAngleDeg: 360,
      centerPoint: resCentroid,
      houses
    },
    bufferZone: {
      points: [poly0, poly60]
    },
    cityBoundary: {
      radius: 10,
      center: { x: 0, y: 0 }
    },
    metadata: {
      totalResidentialLoadKW: totalResLoad,
      totalIndustrialLoadKW: totalIndLoad,
      totalPeakLoadMW: (totalIndLoad + totalResLoad) / 1000,
      industrialZoneCentroid: indCentroid,
      residentialZoneCentroid: resCentroid
    }
  };
};
