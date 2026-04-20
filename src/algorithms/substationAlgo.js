import {
  NUCLEAR_POSITION, THERMAL_POSITION,
  NUCLEAR_CAPACITY_MW, THERMAL_CAPACITY_MW,
  TRANSMISSION_VOLTAGE_KV, INDUSTRIAL_DIST_VOLTAGE_KV,
  SUBSTATION_COST_INDUSTRIAL, SUBSTATION_COST_RESIDENTIAL, SUBSTATION_COST_INTERCONNECT,
  CABLE_COST_PER_KM_HV, CABLE_COST_PER_KM_MV,
  LOSS_RATE_HV, LOSS_RATE_MV,
  ENERGY_COST_PER_MWH,
  CITY_RADIUS_KM
} from '../constants/indiaGridConstants';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Euclidean distance between two {x,y} points.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

/**
 * Weighted centroid of an array of objects that each have x, y and a weight key.
 * @param {Array<Object>} pts
 * @param {string} wKey - property name holding numeric weight
 * @returns {{x:number,y:number}}
 */
const weightedCentroid = (pts, wKey) => {
  let wx = 0, wy = 0, tw = 0;
  for (const p of pts) {
    wx += p.x * p[wKey];
    wy += p.y * p[wKey];
    tw += p[wKey];
  }
  if (tw === 0) return { x: 0, y: 0 };
  return { x: wx / tw, y: wy / tw };
};

/**
 * Clamp a position so it stays inside the city boundary (r < maxR).
 * @param {number} x
 * @param {number} y
 * @param {number} maxR
 * @returns {{x:number,y:number}}
 */
const clampToCity = (x, y, maxR) => {
  const r = Math.sqrt(x * x + y * y);
  if (r <= maxR) return { x, y };
  const scale = maxR / r;
  return { x: x * scale, y: y * scale };
};

/**
 * Very simple k-means (k=2) on an array of weighted items.
 * Returns two arrays of original items partitioned into two clusters.
 * @param {Array<Object>} items - objects with x,y properties
 * @returns {[Array<Object>, Array<Object>]}
 */
const kMeans2 = (items) => {
  if (items.length <= 1) return [items, []];

  // Initialise seeds: pick the two items farthest apart
  let maxD = -1, seedA = 0, seedB = 1;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const d = dist(items[i], items[j]);
      if (d > maxD) { maxD = d; seedA = i; seedB = j; }
    }
  }

  let cA = { x: items[seedA].x, y: items[seedA].y };
  let cB = { x: items[seedB].x, y: items[seedB].y };

  let assignA = [], assignB = [];

  for (let iter = 0; iter < 20; iter++) {
    assignA = []; assignB = [];
    for (const it of items) {
      if (dist(it, cA) <= dist(it, cB)) assignA.push(it);
      else assignB.push(it);
    }
    if (assignA.length === 0) { assignA.push(assignB.pop()); }
    if (assignB.length === 0) { assignB.push(assignA.pop()); }

    const newCA = { x: assignA.reduce((s, p) => s + p.x, 0) / assignA.length,
                    y: assignA.reduce((s, p) => s + p.y, 0) / assignA.length };
    const newCB = { x: assignB.reduce((s, p) => s + p.x, 0) / assignB.length,
                    y: assignB.reduce((s, p) => s + p.y, 0) / assignB.length };

    if (dist(newCA, cA) < 0.001 && dist(newCB, cB) < 0.001) break;
    cA = newCA;
    cB = newCB;
  }
  return [assignA, assignB];
};

/**
 * Calculate the transmission loss percentage for a cable of given length
 * using a per-10km loss rate.
 * @param {number} lengthKm
 * @param {number} lossRatePer10km
 * @returns {number} loss fraction (0-1)
 */
const cableLoss = (lengthKm, lossRatePer10km) => {
  return 1 - Math.pow(1 - lossRatePer10km, lengthKm / 10);
};

/**
 * Build a cable descriptor object.
 * @param {string} id
 * @param {string} fromId
 * @param {string} toId
 * @param {{x:number,y:number}} fromPos
 * @param {{x:number,y:number}} toPos
 * @param {number} voltageKV
 * @param {string} type - 'HV' | 'MV' | 'LV'
 * @returns {Object} cable descriptor
 */
const makeCable = (id, fromId, toId, fromPos, toPos, voltageKV, type) => {
  const lengthKm = dist(fromPos, toPos);
  const lossRate = type === 'HV' ? LOSS_RATE_HV : (type === 'MV' ? LOSS_RATE_MV : LOSS_RATE_HV);
  const costPerKm = type === 'HV' ? CABLE_COST_PER_KM_HV : CABLE_COST_PER_KM_MV;
  return {
    id,
    fromId,
    toId,
    voltageKV,
    lengthKm: Math.round(lengthKm * 100) / 100,
    lossPercent: Math.round(cableLoss(lengthKm, lossRate) * 10000) / 100,
    costRupees: Math.round(lengthKm * costPerKm),
    type
  };
};

// ---------------------------------------------------------------------------
// Iterative cost-minimising substation placement
// ---------------------------------------------------------------------------

/**
 * Given a set of substations (each with their assigned items), cables to
 * a plant and to the interconnect, compute total infrastructure cost.
 * @param {Array<Object>} subs - substation descriptors
 * @param {{x:number,y:number}} plantPos - primary plant position
 * @param {{x:number,y:number}} icPos - interconnect position
 * @param {number} subCostEach - per-substation equipment cost
 * @param {string} hvOrMvRedundancy - cable type for redundancy link ('HV' | 'MV')
 * @returns {number} total cost
 */
const evalCost = (subs, plantPos, icPos, subCostEach, hvOrMvRedundancy) => {
  let total = 0;
  for (const s of subs) {
    total += subCostEach;
    // primary cable (HV)
    total += dist(s, plantPos) * CABLE_COST_PER_KM_HV;
    // redundancy cable
    const rCostPerKm = hvOrMvRedundancy === 'HV' ? CABLE_COST_PER_KM_HV : CABLE_COST_PER_KM_MV;
    total += dist(s, icPos) * rCostPerKm;
    // annual loss cost (rough 8760h estimate for first year)
    const primaryLoss = cableLoss(dist(s, plantPos), LOSS_RATE_HV);
    total += primaryLoss * s.loadMW * 8760 * ENERGY_COST_PER_MWH;
  }
  return total;
};

/**
 * Run the iterative split-if-cheaper optimisation loop.
 * @param {Array<Object>} items - factories or house clusters
 * @param {string} loadKey - 'sizekW' for factories, 'loadKW' for houses
 * @param {string} idKey - 'servedFactories' or 'servedClusters'
 * @param {{x:number,y:number}} centroid - starting centroid
 * @param {{x:number,y:number}} plantPos - primary plant position
 * @param {{x:number,y:number}} icPos - interconnect position
 * @param {number} maxCapMW - per-substation capacity cap
 * @param {number} maxSubs - hard limit on number of substations
 * @param {number} subCost - per-unit equipment cost
 * @param {string} hvOrMvRedundancy - 'HV' or 'MV'
 * @param {number} angleMinDeg - angle constraint lower bound (degrees)
 * @param {number} angleMaxDeg - angle constraint upper bound (degrees)
 * @returns {Array<Object>} array of substation descriptors
 */
const optimiseSubstations = (
  items, loadKey, idKey,
  centroid, plantPos, icPos,
  maxCapMW, maxSubs, subCost,
  hvOrMvRedundancy,
  angleMinDeg, angleMaxDeg
) => {
  if (items.length === 0) return [];

  const clampPos = (pos) => clampToCity(pos.x, pos.y, CITY_RADIUS_KM - 1);

  // Build initial single substation
  const buildSub = (assigned) => {
    const wc = assigned.length > 0
      ? { x: assigned.reduce((s, p) => s + p.x, 0) / assigned.length,
          y: assigned.reduce((s, p) => s + p.y, 0) / assigned.length }
      : { x: centroid.x, y: centroid.y };
    const pos = clampPos(wc);
    const loadMW = assigned.reduce((s, p) => s + p[loadKey], 0) / 1000;
    return {
      ...pos,
      loadMW,
      assigned
    };
  };

  // Start with one substation at the centroid holding all items
  let currentSubs = [buildSub(items)];

  // Iterative split loop
  let changed = true;
  while (changed && currentSubs.length < maxSubs) {
    changed = false;

    // Force-split any overloaded substations first
    let newSubs = [];
    for (const sub of currentSubs) {
      if (sub.loadMW > maxCapMW && sub.assigned.length > 1 && newSubs.length + currentSubs.length < maxSubs + currentSubs.length) {
        const [a, b] = kMeans2(sub.assigned);
        newSubs.push(buildSub(a));
        newSubs.push(buildSub(b));
        changed = true;
      } else {
        newSubs.push(sub);
      }
    }
    if (changed) { currentSubs = newSubs; continue; }

    // Cost-optimisation split: find the heaviest loaded sub and try splitting it
    const currentCost = evalCost(currentSubs, plantPos, icPos, subCost, hvOrMvRedundancy);

    let bestImprovement = 0;
    let bestCandidate = null;
    let bestIdx = -1;

    for (let i = 0; i < currentSubs.length; i++) {
      if (currentSubs[i].assigned.length <= 1) continue;
      const [a, b] = kMeans2(currentSubs[i].assigned);
      const candidate = [...currentSubs.slice(0, i), buildSub(a), buildSub(b), ...currentSubs.slice(i + 1)];
      const candidateCost = evalCost(candidate, plantPos, icPos, subCost, hvOrMvRedundancy);
      const improvement = currentCost - candidateCost;
      if (improvement > bestImprovement) {
        bestImprovement = improvement;
        bestCandidate = candidate;
        bestIdx = i;
      }
    }

    if (bestCandidate && bestImprovement > 0) {
      currentSubs = bestCandidate;
      changed = true;
    }
  }

  return currentSubs;
};

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Computes optimal substation placement, cable routing, and cost analysis
 * for the power grid based on zone data from Phase 2.
 *
 * @param {Object} zonesData - The full zonesData object returned by computeZones()
 * @param {Object} zonesData.industrialZone - Industrial zone with factories array
 * @param {Object} zonesData.residentialZone - Residential zone with houses array
 * @param {Object} zonesData.metadata - Metadata including centroids and load totals
 * @returns {Object} substationsData - Full substation placement, cables, and costs
 */
export const computeSubstations = (zonesData) => {
  const factories = zonesData.industrialZone.factories;
  
  const totalIndustrialLoadKW = factories.reduce((sum, f) => sum + (f.sizekW || 0), 0);
  console.log("Factories received:", factories.length);
  console.log("Total industrial load:", totalIndustrialLoadKW, "kW");

  const houses = zonesData.residentialZone.houses;
  const indCentroid = zonesData.metadata.industrialZoneCentroid;
  const resCentroid = zonesData.metadata.residentialZoneCentroid;

  const icPos = { x: 0, y: 0 };

  // -----------------------------------------------------------------------
  // STEP 1 -- Mandatory Interconnect Substation at city center
  // -----------------------------------------------------------------------
  const interconnect = {
    id: 'SUB-IC-001',
    type: 'interconnect',
    x: 0,
    y: 0,
    capacityMW: 400,
    loadMW: 0,
    loadPercent: 0,
    primaryPlant: 'both',
    cost: SUBSTATION_COST_INTERCONNECT,
    servedFactories: [],
    servedClusters: []
  };

  // -----------------------------------------------------------------------
  // STEP 2 -- Industrial Substations
  // -----------------------------------------------------------------------
  const indRaw = optimiseSubstations(
    factories, 'sizekW', 'servedFactories',
    indCentroid, NUCLEAR_POSITION, icPos,
    200, 6, SUBSTATION_COST_INDUSTRIAL,
    'HV', -15, 75
  );

  const indSubs = indRaw.map((s, idx) => ({
    id: `SUB-IND-${String(idx + 1).padStart(3, '0')}`,
    type: 'industrial',
    x: Math.round(s.x * 100) / 100,
    y: Math.round(s.y * 100) / 100,
    capacityMW: 200,
    loadMW: Math.round(s.loadMW * 100) / 100,
    loadPercent: Math.min(Math.round((s.loadMW / 200) * 10000) / 100, 100),
    primaryPlant: 'nuclear',
    cost: SUBSTATION_COST_INDUSTRIAL,
    servedFactories: s.assigned.map(f => f.id),
    servedClusters: []
  }));

  // -----------------------------------------------------------------------
  // STEP 3 -- Residential Substations
  // -----------------------------------------------------------------------
  const resRaw = optimiseSubstations(
    houses, 'loadKW', 'servedClusters',
    resCentroid, THERMAL_POSITION, icPos,
    150, 8, SUBSTATION_COST_RESIDENTIAL,
    'MV', 60, 360
  );

  const resSubs = resRaw.map((s, idx) => ({
    id: `SUB-RES-${String(idx + 1).padStart(3, '0')}`,
    type: 'residential',
    x: Math.round(s.x * 100) / 100,
    y: Math.round(s.y * 100) / 100,
    capacityMW: 150,
    loadMW: Math.round(s.loadMW * 100) / 100,
    loadPercent: Math.min(Math.round((s.loadMW / 150) * 10000) / 100, 100),
    primaryPlant: 'thermal',
    cost: SUBSTATION_COST_RESIDENTIAL,
    servedFactories: [],
    servedClusters: s.assigned.map(h => h.id)
  }));

  // Mark the first residential substation as dual-feed emergency hub
  if (resSubs.length > 0) {
    resSubs[0].primaryPlant = 'thermal+interconnect';
  }

  // -----------------------------------------------------------------------
  // STEP 4 -- Assign loads (nearest substation assignment)
  //
  // The optimisation loop already partitioned items, but we re-verify here
  // with a nearest-neighbour pass for correctness.
  // -----------------------------------------------------------------------

  // Re-assign factories to nearest industrial substation
  if (indSubs.length > 0) {
    for (const sub of indSubs) { sub.servedFactories = []; sub.loadMW = 0; }
    for (const f of factories) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < indSubs.length; i++) {
        const d = dist(f, indSubs[i]);
        if (d < bestD) { bestD = d; best = i; }
      }
      indSubs[best].servedFactories.push(f.id);
      indSubs[best].loadMW += f.sizekW / 1000;
    }
    for (const sub of indSubs) {
      sub.loadMW = Math.round(sub.loadMW * 100) / 100;
      sub.loadPercent = Math.min(Math.round((sub.loadMW / sub.capacityMW) * 10000) / 100, 100);
    }
  }

  // Re-assign house clusters to nearest residential substation
  if (resSubs.length > 0) {
    for (const sub of resSubs) { sub.servedClusters = []; sub.loadMW = 0; }
    for (const h of houses) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < resSubs.length; i++) {
        const d = dist(h, resSubs[i]);
        if (d < bestD) { bestD = d; best = i; }
      }
      resSubs[best].servedClusters.push(h.id);
      resSubs[best].loadMW += h.loadKW / 1000;
    }
    for (const sub of resSubs) {
      sub.loadMW = Math.round(sub.loadMW * 100) / 100;
      sub.loadPercent = Math.min(Math.round((sub.loadMW / sub.capacityMW) * 10000) / 100, 100);
    }
  }

  // Update interconnect load (sum of everything for emergency capacity reference)
  interconnect.loadMW = Math.round(
    (zonesData.metadata.totalIndustrialLoadKW + zonesData.metadata.totalResidentialLoadKW) / 1000 * 100
  ) / 100;
  interconnect.loadPercent = Math.min(Math.round((interconnect.loadMW / interconnect.capacityMW) * 10000) / 100, 100);

  // -----------------------------------------------------------------------
  // STEP 5 -- Generate Cables
  // -----------------------------------------------------------------------
  const allSubstations = [interconnect, ...indSubs, ...resSubs];

  const cables = [];
  let cabIdx = 1;

  // Interconnect cables: Nuclear -> IC  and  Thermal -> IC
  cables.push(makeCable(
    `CAB${String(cabIdx++).padStart(3, '0')}`,
    'NUCLEAR', 'SUB-IC-001',
    NUCLEAR_POSITION, icPos,
    TRANSMISSION_VOLTAGE_KV, 'HV'
  ));
  cables.push(makeCable(
    `CAB${String(cabIdx++).padStart(3, '0')}`,
    'THERMAL', 'SUB-IC-001',
    THERMAL_POSITION, icPos,
    TRANSMISSION_VOLTAGE_KV, 'HV'
  ));

  // Industrial substation cables
  for (const sub of indSubs) {
    const subPos = { x: sub.x, y: sub.y };
    // Primary: Nuclear -> Industrial Sub (HV 132kV)
    cables.push(makeCable(
      `CAB${String(cabIdx++).padStart(3, '0')}`,
      'NUCLEAR', sub.id,
      NUCLEAR_POSITION, subPos,
      TRANSMISSION_VOLTAGE_KV, 'HV'
    ));
    // Redundancy: Interconnect -> Industrial Sub (HV 132kV)
    cables.push(makeCable(
      `CAB${String(cabIdx++).padStart(3, '0')}`,
      'SUB-IC-001', sub.id,
      icPos, subPos,
      TRANSMISSION_VOLTAGE_KV, 'HV'
    ));
  }

  // Residential substation cables
  for (const sub of resSubs) {
    const subPos = { x: sub.x, y: sub.y };
    // Primary: Thermal -> Residential Sub (HV 132kV)
    cables.push(makeCable(
      `CAB${String(cabIdx++).padStart(3, '0')}`,
      'THERMAL', sub.id,
      THERMAL_POSITION, subPos,
      TRANSMISSION_VOLTAGE_KV, 'HV'
    ));
    // Redundancy: Interconnect -> Residential Sub (MV 33kV)
    cables.push(makeCable(
      `CAB${String(cabIdx++).padStart(3, '0')}`,
      'SUB-IC-001', sub.id,
      icPos, subPos,
      INDUSTRIAL_DIST_VOLTAGE_KV, 'MV'
    ));
  }

  // -----------------------------------------------------------------------
  // STEP 6 -- Cost Summary
  // -----------------------------------------------------------------------
  const substationCostTotal = allSubstations.reduce((s, sub) => s + sub.cost, 0);
  const cableCostTotal = cables.reduce((s, c) => s + c.costRupees, 0);
  const totalCableKm = cables.reduce((s, c) => s + c.lengthKm, 0);

  // Annual loss cost: sum of (loss fraction * load MW * 8760h * cost per MWh) for each cable
  let annualLossCostTotal = 0;
  for (const c of cables) {
    // Find the substation this cable feeds to estimate load on that cable
    const toSub = allSubstations.find(s => s.id === c.toId);
    const loadMW = toSub ? toSub.loadMW : 0;
    const lossFrac = c.lossPercent / 100;
    annualLossCostTotal += lossFrac * loadMW * 8760 * ENERGY_COST_PER_MWH;
  }
  annualLossCostTotal = Math.round(annualLossCostTotal);

  const totalInfraCost = substationCostTotal + cableCostTotal;
  const totalAnnualCost = annualLossCostTotal;

  // -----------------------------------------------------------------------
  // STEP 7 -- Redundancy Score
  //
  // Score based on: every substation has a secondary feed (via IC),
  // and the IC itself has dual-plant feed. Full marks = 100.
  // Deductions: overcapacity on any sub, missing redundancy links.
  // -----------------------------------------------------------------------
  let redundancyScore = 100;

  // Check all industrial subs have IC redundancy cable
  for (const sub of indSubs) {
    const hasRedundancy = cables.some(c => c.fromId === 'SUB-IC-001' && c.toId === sub.id);
    if (!hasRedundancy) redundancyScore -= 10;
    if (sub.loadPercent > 100) redundancyScore -= 5;
  }

  // Check all residential subs have IC redundancy cable
  for (const sub of resSubs) {
    const hasRedundancy = cables.some(c => c.fromId === 'SUB-IC-001' && c.toId === sub.id);
    if (!hasRedundancy) redundancyScore -= 10;
    if (sub.loadPercent > 100) redundancyScore -= 5;
  }

  // Check IC has dual-plant feed
  const icHasNuclear = cables.some(c => c.fromId === 'NUCLEAR' && c.toId === 'SUB-IC-001');
  const icHasThermal = cables.some(c => c.fromId === 'THERMAL' && c.toId === 'SUB-IC-001');
  if (!icHasNuclear) redundancyScore -= 15;
  if (!icHasThermal) redundancyScore -= 15;

  // Check at least one residential sub has dual feed
  const hasDualFeedRes = resSubs.some(s => s.primaryPlant === 'thermal+interconnect');
  if (!hasDualFeedRes && resSubs.length > 0) redundancyScore -= 10;

  redundancyScore = Math.max(0, Math.min(100, redundancyScore));

  return {
    substations: allSubstations,
    cables,
    costSummary: {
      substationCostTotal,
      cableCostTotal,
      annualLossCostTotal,
      totalInfraCost,
      totalAnnualCost
    },
    redundancyScore,
    metadata: {
      numIndustrial: indSubs.length,
      numResidential: resSubs.length,
      numInterconnect: 1,
      totalSubstations: allSubstations.length,
      totalCableKm: Math.round(totalCableKm * 100) / 100
    }
  };
};
