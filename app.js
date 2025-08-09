// Process data storage and catalog-driven UI
let processes = {
  A: { name: 'Process A', steps: [] },
  B: { name: 'Process B', steps: [] },
};

// Simple in-memory catalog of known processes with defaults and calculators (kWh per kg product)
const processCatalog = {
  Calcination: {
    key: 'calcination',
    inputs: [
      { name: 'temperatureC', label: 'Temperature (°C)', type: 'number', step: '1', placeholder: 'e.g., 800' },
      { name: 'durationH', label: 'Duration (hours)', type: 'number', step: '0.1', placeholder: 'e.g., 2' },
      { name: 'massKg', label: 'Batch mass (kg product)', type: 'number', step: '0.1', placeholder: 'e.g., 1' },
      { name: 'furnaceEfficiency', label: 'Furnace efficiency (0-1)', type: 'number', step: '0.05', placeholder: '0.6', defaultValue: 0.6 },
    ],
    defaults: { temperatureC: 800, durationH: 2, massKg: 1 },
    energyKWh: ({ temperatureC, durationH, massKg, ambientC, furnaceEfficiency = 0.6 }) => {
      // Simplified model: Q = m * Cp * ΔT + standby; Cp (ceria) ~ 0.46 kJ/kgK; add 20% overhead; divide by efficiency.
      const cp_kJ_per_kgK = 0.46;
      const deltaT = Math.max(0, (Number(temperatureC) || 0) - (Number(ambientC) || 25));
      const sensible_kJ = (Number(massKg) || 0) * cp_kJ_per_kgK * deltaT;
      const sensible_kWh = sensible_kJ / 3600; // 1 kWh = 3600 kJ
      const standby_kWh = 1.2 * (Number(durationH) || 0); // 1.2 kW typical furnace baseline draw per hour (example)
      const gross_kWh = (sensible_kWh + standby_kWh) * 1.2; // overhead
      const eff = Math.min(0.95, Math.max(0.2, Number(furnaceEfficiency) || 0.6));
      return gross_kWh / eff;
    },
    waterKg: () => 0,
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
  Hydrothermal: {
    key: 'hydrothermal',
    inputs: [
      { name: 'temperatureC', label: 'Temperature (°C)', type: 'number', step: '1', placeholder: 'e.g., 180' },
      { name: 'durationH', label: 'Duration (hours)', type: 'number', step: '0.1', placeholder: 'e.g., 12' },
      { name: 'waterToProduct', label: 'Water:Product mass ratio', type: 'number', step: '0.1', placeholder: 'e.g., 20' },
      { name: 'massKg', label: 'Product mass (kg)', type: 'number', step: '0.1', placeholder: 'e.g., 1' },
      { name: 'autoclaveLossW', label: 'Autoclave heat loss (W)', type: 'number', step: '10', placeholder: 'e.g., 200' },
    ],
    defaults: { temperatureC: 180, durationH: 12, waterToProduct: 20, massKg: 1, autoclaveLossW: 200 },
    energyKWh: ({ temperatureC, durationH, waterToProduct, massKg, ambientC, autoclaveLossW }) => {
      // Approx: heat water to T, Cp_water ~ 4.18 kJ/kgK; water mass = ratio * product mass; add vessel losses.
      const cp_water_kJ_per_kgK = 4.18;
      const deltaT = Math.max(0, (Number(temperatureC) || 0) - (Number(ambientC) || 25));
      const waterMassKg = (Number(waterToProduct) || 0) * (Number(massKg) || 0);
      const sensible_kJ = waterMassKg * cp_water_kJ_per_kgK * deltaT;
      const sensible_kWh = sensible_kJ / 3600;
      const loss_kWh = ((Number(autoclaveLossW) || 0) / 1000) * (Number(durationH) || 0);
      // Add 10% overhead for system inefficiencies
      return (sensible_kWh + loss_kWh) * 1.1;
    },
    waterKg: ({ waterToProduct, massKg }) => (Number(waterToProduct) || 0) * (Number(massKg) || 0),
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
  Milling: {
    key: 'milling',
    inputs: [
      { name: 'powerKW', label: 'Mill power (kW)', type: 'number', step: '0.1', placeholder: 'e.g., 2.5' },
      { name: 'durationH', label: 'Duration (hours)', type: 'number', step: '0.1', placeholder: 'e.g., 4' },
      { name: 'massKg', label: 'Batch mass (kg product)', type: 'number', step: '0.1', placeholder: 'e.g., 1' },
      { name: 'efficiency', label: 'Drive/system efficiency (0-1)', type: 'number', step: '0.05', placeholder: '0.75', defaultValue: 0.75 },
    ],
    defaults: { powerKW: 2.5, durationH: 4, massKg: 1 },
    energyKWh: ({ powerKW, durationH, efficiency = 0.75 }) => {
      const eff = Math.min(0.95, Math.max(0.3, Number(efficiency) || 0.75));
      return (Number(powerKW) || 0) * (Number(durationH) || 0) / eff;
    },
    waterKg: () => 0,
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
  Sonication: {
    key: 'sonication',
    inputs: [
      { name: 'powerKW', label: 'Ultrasonic power (kW)', type: 'number', step: '0.05', placeholder: 'e.g., 0.5' },
      { name: 'durationH', label: 'Duration (hours)', type: 'number', step: '0.1', placeholder: 'e.g., 1.5' },
    ],
    defaults: { powerKW: 0.5, durationH: 1.5 },
    energyKWh: ({ powerKW, durationH }) => (Number(powerKW) || 0) * (Number(durationH) || 0),
    waterKg: () => 0,
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
  Centrifuge: {
    key: 'centrifuge',
    inputs: [
      { name: 'powerKW', label: 'Centrifuge power (kW)', type: 'number', step: '0.1', placeholder: 'e.g., 1.2' },
      { name: 'durationH', label: 'Duration (hours)', type: 'number', step: '0.1', placeholder: 'e.g., 0.5' },
    ],
    defaults: { powerKW: 1.2, durationH: 0.5 },
    energyKWh: ({ powerKW, durationH }) => (Number(powerKW) || 0) * (Number(durationH) || 0),
    waterKg: () => 0,
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
  Filtration: {
    key: 'filtration',
    inputs: [
      { name: 'pressureBar', label: 'Pressure (bar)', type: 'number', step: '0.1', placeholder: 'e.g., 2' },
      { name: 'flowLph', label: 'Flow (L/h)', type: 'number', step: '1', placeholder: 'e.g., 200' },
      { name: 'durationH', label: 'Duration (hours)', type: 'number', step: '0.1', placeholder: 'e.g., 1' },
    ],
    defaults: { pressureBar: 2, flowLph: 200, durationH: 1 },
    energyKWh: ({ pressureBar, flowLph, durationH }) => {
      // Rough: pump power ~ k * pressure * flow. Use k ~ 0.0003 (kW per (bar*L/h)).
      const k = 0.0003;
      const powerKW = k * (Number(pressureBar) || 0) * (Number(flowLph) || 0);
      return powerKW * (Number(durationH) || 0);
    },
    waterKg: () => 0,
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
  Drying: {
    key: 'drying',
    inputs: [
      { name: 'temperatureC', label: 'Temperature (°C)', type: 'number', step: '1', placeholder: 'e.g., 120' },
      { name: 'durationH', label: 'Duration (hours)', type: 'number', step: '0.1', placeholder: 'e.g., 3' },
      { name: 'waterRemovedKg', label: 'Water removed (kg)', type: 'number', step: '0.1', placeholder: 'e.g., 0.2' },
    ],
    defaults: { temperatureC: 120, durationH: 3, waterRemovedKg: 0.2 },
    energyKWh: ({ temperatureC, durationH, waterRemovedKg, ambientC }) => {
      // Heat water from ambient to temp + latent heat. Cp_water 4.18 kJ/kgK; L_vap ~ 2257 kJ/kg.
      const cp = 4.18;
      const deltaT = Math.max(0, (Number(temperatureC) || 0) - (Number(ambientC) || 25));
      const sensible = (Number(waterRemovedKg) || 0) * cp * deltaT; // kJ
      const latent = (Number(waterRemovedKg) || 0) * 2257; // kJ
      return (sensible + latent) / 3600 * 1.15; // kWh with 15% overhead
    },
    waterKg: ({ waterRemovedKg }) => -(Number(waterRemovedKg) || 0),
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
  Washing: {
    key: 'washing',
    inputs: [
      { name: 'waterPerKg', label: 'Water usage (kg per kg product)', type: 'number', step: '0.1', placeholder: 'e.g., 5' },
      { name: 'massKg', label: 'Product mass (kg)', type: 'number', step: '0.1', placeholder: 'e.g., 1' },
    ],
    defaults: { waterPerKg: 5, massKg: 1 },
    energyKWh: ({ waterPerKg, massKg }) => 0.02 * (Number(waterPerKg) || 0) * (Number(massKg) || 0), // pumping/mixing small
    waterKg: ({ waterPerKg, massKg }) => (Number(waterPerKg) || 0) * (Number(massKg) || 0),
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
  Annealing: {
    key: 'annealing',
    inputs: [
      { name: 'temperatureC', label: 'Temperature (°C)', type: 'number', step: '1', placeholder: 'e.g., 600' },
      { name: 'durationH', label: 'Duration (hours)', type: 'number', step: '0.1', placeholder: 'e.g., 1' },
      { name: 'massKg', label: 'Batch mass (kg product)', type: 'number', step: '0.1', placeholder: 'e.g., 1' },
    ],
    defaults: { temperatureC: 600, durationH: 1, massKg: 1 },
    energyKWh: ({ temperatureC, durationH, massKg, ambientC }) => {
      // Similar to calcination but lighter: no overhead/efficiency terms for simplicity
      const cp_kJ_per_kgK = 0.46;
      const deltaT = Math.max(0, (Number(temperatureC) || 0) - (Number(ambientC) || 25));
      const sensible_kJ = (Number(massKg) || 0) * cp_kJ_per_kgK * deltaT;
      const sensible_kWh = sensible_kJ / 3600;
      const baseline_kWh = 0.8 * (Number(durationH) || 0);
      return (sensible_kWh + baseline_kWh) * 1.1;
    },
    waterKg: () => 0,
    emissionsKgCO2: ({ gridFactor, energyKWh }) => energyKWh * (Number(gridFactor) || 0.45),
  },
};

// ---------- Impact factors DB (materials, waters) ----------
const IMPACT_DB_KEY = 'impactDbV2';
let impactDb = {
  electricity: [
    // GWP, ADP, WaterUse, AP, FETP per kWh (example placeholders)
    { name: 'Electricity, medium voltage (GLO)', GWP: 0.45, ADP: 0.12, WaterUse: 0.02, AP: 0.001, FETP: 0.0001 },
    { name: 'Electricity, medium voltage (US)', GWP: 0.38, ADP: 0.10, WaterUse: 0.015, AP: 0.0009, FETP: 0.00009 },
    { name: 'Electricity, medium voltage (EU)', GWP: 0.30, ADP: 0.09, WaterUse: 0.012, AP: 0.0007, FETP: 0.00008 },
  ],
  chemicals: [
    // Per kg — full inlined set (formerly provided via CSV)
    { name: 'Cerium carbonate (Ce2(CO3)3)', GWP: 4.5, ADP: 0.7, WaterUse: 2.1, AP: 0.03, FETP: 0.001 },
    { name: 'Cerium nitrate (Ce(NO3)3)', GWP: 6.5, ADP: 0.9, WaterUse: 2.6, AP: 0.04, FETP: 0.0012 },
    { name: 'Ammonium hydroxide (NH4OH)', GWP: 1.2, ADP: 0.2, WaterUse: 0.4, AP: 0.01, FETP: 0.0003 },
    { name: 'Nitric acid (HNO3)', GWP: 1.9, ADP: 0.25, WaterUse: 0.5, AP: 0.02, FETP: 0.0004 },
    { name: 'Ethanol', GWP: 1.7, ADP: 0.21, WaterUse: 1.1, AP: 0.015, FETP: 0.00035 },
    { name: 'Isopropanol (IPA)', GWP: 1.8, ADP: 0.22, WaterUse: 1.0, AP: 0.016, FETP: 0.00033 },
    { name: 'Acetone', GWP: 1.6, ADP: 0.2, WaterUse: 0.9, AP: 0.014, FETP: 0.00031 },
    { name: 'Polyethylene glycol (PEG)', GWP: 2.3, ADP: 0.3, WaterUse: 1.4, AP: 0.02, FETP: 0.0004 },
    { name: 'Polyvinylpyrrolidone (PVP)', GWP: 3.1, ADP: 0.4, WaterUse: 1.8, AP: 0.03, FETP: 0.0005 },
    { name: 'Sodium hydroxide (NaOH)', GWP: 2.1, ADP: 0.3, WaterUse: 0.8, AP: 0.02, FETP: 0.0004 },
    { name: 'Hydrochloric acid (HCl)', GWP: 1.5, ADP: 0.2, WaterUse: 0.7, AP: 0.015, FETP: 0.00035 },
    { name: 'Sulfuric acid (H2SO4)', GWP: 1.7, ADP: 0.22, WaterUse: 0.8, AP: 0.018, FETP: 0.00036 },
    { name: 'Ammonium nitrate', GWP: 2.2, ADP: 0.28, WaterUse: 0.9, AP: 0.022, FETP: 0.00042 },
    { name: 'Citric acid', GWP: 1.1, ADP: 0.15, WaterUse: 0.6, AP: 0.01, FETP: 0.00025 },
    { name: 'Urea', GWP: 1.3, ADP: 0.18, WaterUse: 0.7, AP: 0.012, FETP: 0.00027 },
    { name: 'Ammonia (NH3)', GWP: 2.8, ADP: 0.35, WaterUse: 1.0, AP: 0.03, FETP: 0.00045 },
    { name: 'Toluene', GWP: 2.0, ADP: 0.27, WaterUse: 1.2, AP: 0.02, FETP: 0.00038 },
    { name: 'Xylene', GWP: 2.1, ADP: 0.28, WaterUse: 1.2, AP: 0.021, FETP: 0.00039 },
    { name: 'Acetic acid', GWP: 1.4, ADP: 0.19, WaterUse: 0.8, AP: 0.013, FETP: 0.0003 },
    { name: 'Sodium chloride (NaCl)', GWP: 0.6, ADP: 0.08, WaterUse: 0.3, AP: 0.006, FETP: 0.0001 },
    { name: 'Aluminum nitrate', GWP: 3.2, ADP: 0.42, WaterUse: 1.5, AP: 0.032, FETP: 0.00052 },
    { name: 'Zirconium nitrate', GWP: 3.4, ADP: 0.44, WaterUse: 1.6, AP: 0.034, FETP: 0.00054 },
  ],
  waters: [
    // Per liter
    { name: 'DI water', GWP: 0.0003, ADP: 0.00005, WaterUse: 1, AP: 0.00001, FETP: 0.000001 },
    { name: 'Ultra-pure water (UPW)', GWP: 0.001, ADP: 0.0001, WaterUse: 1, AP: 0.00002, FETP: 0.000002 },
    { name: 'Tap water', GWP: 0.0002, ADP: 0.00003, WaterUse: 1, AP: 0.000008, FETP: 0.000001 },
  ],
};

// Keep a deep copy of defaults to recover if storage is malformed or reset
const DEFAULT_IMPACT_DB = JSON.parse(JSON.stringify(impactDb));

// CSV bootstrap removed — factors are now fully inlined in this file

function normalizeImpactDb(db) {
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const norm = { electricity: [], chemicals: [], waters: [] };
  if (Array.isArray(db?.electricity)) {
    norm.electricity = db.electricity.map(e => ({
      name: e.name || '',
      GWP: toNum(e.GWP ?? e.co2ePerKWh),
      ADP: toNum(e.ADP),
      WaterUse: toNum(e.WaterUse),
      AP: toNum(e.AP),
      FETP: toNum(e.FETP),
    })).filter(x => x.name);
  }
  if (Array.isArray(db?.chemicals)) {
    norm.chemicals = db.chemicals.map(c => ({
      name: c.name || '',
      GWP: toNum(c.GWP ?? c.co2ePerKg),
      ADP: toNum(c.ADP),
      WaterUse: toNum(c.WaterUse),
      AP: toNum(c.AP),
      FETP: toNum(c.FETP),
    })).filter(x => x.name);
  }
  if (Array.isArray(db?.waters)) {
    norm.waters = db.waters.map(w => ({
      name: w.name || '',
      GWP: toNum(w.GWP ?? w.co2ePerL),
      ADP: toNum(w.ADP),
      WaterUse: toNum(w.WaterUse),
      AP: toNum(w.AP),
      FETP: toNum(w.FETP),
    })).filter(x => x.name);
  }
  // Fallback to defaults if any category is missing/empty
  if (!norm.electricity.length) norm.electricity = JSON.parse(JSON.stringify(DEFAULT_IMPACT_DB.electricity));
  if (!norm.chemicals.length) norm.chemicals = JSON.parse(JSON.stringify(DEFAULT_IMPACT_DB.chemicals));
  if (!norm.waters.length) norm.waters = JSON.parse(JSON.stringify(DEFAULT_IMPACT_DB.waters));
  return norm;
}

async function loadImpactDb() {
  try {
    const raw = localStorage.getItem(IMPACT_DB_KEY);
    if (raw) {
      const saved = normalizeImpactDb(JSON.parse(raw));
      const mergeByName = (primary, fallback) => {
        const seen = new Set();
        const result = [];
        primary.forEach(it => { if (it && it.name && !seen.has(it.name)) { seen.add(it.name); result.push(it); } });
        fallback.forEach(it => { if (it && it.name && !seen.has(it.name)) { seen.add(it.name); result.push(it); } });
        return result;
      };
      impactDb = {
        electricity: mergeByName(saved.electricity || [], DEFAULT_IMPACT_DB.electricity),
        chemicals: mergeByName(saved.chemicals || [], DEFAULT_IMPACT_DB.chemicals),
        waters: mergeByName(saved.waters || [], DEFAULT_IMPACT_DB.waters),
      };
      return;
    }
  } catch (_) { /* noop */ }
  // No saved DB — use inlined defaults
  impactDb = JSON.parse(JSON.stringify(DEFAULT_IMPACT_DB));
}
function saveImpactDb() {
  localStorage.setItem(IMPACT_DB_KEY, JSON.stringify(impactDb));
  renderImpactDbTables();
}
async function resetImpactDb() {
  localStorage.removeItem(IMPACT_DB_KEY);
  impactDb = JSON.parse(JSON.stringify(DEFAULT_IMPACT_DB));
  saveImpactDb();
}
function renderImpactDbTables() {
  const chemTable = document.getElementById('chemicalsTable');
  const watersTable = document.getElementById('watersTable');
  const elecSelect = document.getElementById('electricityDataset');
  if (chemTable) {
    chemTable.innerHTML = '';
    impactDb.chemicals.forEach((c, idx) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input type="text" value="${c.name}" placeholder="Chemical name" />
        <input type="number" step="0.0001" value="${c.GWP}" placeholder="GWP per kg" />
        <button class="danger" type="button">✕</button>
      `;
      const [nameInput, valInput, delBtn] = row.querySelectorAll('input,button');
      nameInput.addEventListener('input', () => { impactDb.chemicals[idx].name = nameInput.value; saveImpactDb(); });
      valInput.addEventListener('input', () => { impactDb.chemicals[idx].GWP = Number(valInput.value) || 0; saveImpactDb(); });
      delBtn.addEventListener('click', () => { impactDb.chemicals.splice(idx, 1); saveImpactDb(); renderImpactDbTables(); });
      chemTable.appendChild(row);
    });
  }
  if (watersTable) {
    watersTable.innerHTML = '';
    impactDb.waters.forEach((w, idx) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input type="text" value="${w.name}" placeholder="Water type" />
        <input type="number" step="0.0001" value="${w.GWP}" placeholder="GWP per liter" />
        <button class="danger" type="button">✕</button>
      `;
      const [nameInput, valInput, delBtn] = row.querySelectorAll('input,button');
      nameInput.addEventListener('input', () => { impactDb.waters[idx].name = nameInput.value; saveImpactDb(); });
      valInput.addEventListener('input', () => { impactDb.waters[idx].GWP = Number(valInput.value) || 0; saveImpactDb(); });
      delBtn.addEventListener('click', () => { impactDb.waters.splice(idx, 1); saveImpactDb(); renderImpactDbTables(); });
      watersTable.appendChild(row);
    });
  }
  if (elecSelect) {
    const elecs = Array.isArray(impactDb.electricity) ? impactDb.electricity : [];
    elecSelect.innerHTML = elecs.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
    const saved = localStorage.getItem('selectedElectricityDataset');
    if (saved && elecs.find(e => e.name === saved)) {
      elecSelect.value = saved;
    }
    // Prevent duplicate listeners
    elecSelect.onchange = () => {
      localStorage.setItem('selectedElectricityDataset', elecSelect.value);
      // Recompute outputs when electricity changes
      document.querySelectorAll('.process-steps .step').forEach(step => {
        const procSel = step.querySelector('.process-select');
        if (procSel && procSel.value) {
          computeStepOutputs(step, procSel.value);
        }
      });
      // Refresh charts if visible
      if (document.getElementById('comparisonResults').style.display === 'block') {
        renderVisualizations();
      }
    };
  }
}
function addChemicalRow() {
  impactDb.chemicals.push({ name: '', GWP: 0, ADP: 0, WaterUse: 0, AP: 0, FETP: 0 });
  renderImpactDbTables();
}
function addWaterRow() {
  impactDb.waters.push({ name: '', GWP: 0, ADP: 0, WaterUse: 0, AP: 0, FETP: 0 });
  renderImpactDbTables();
}
function toggleDbPanel() {
  const panel = document.getElementById('dbPanel');
  if (panel) panel.hidden = !panel.hidden;
}

// Import/export removed; edit factors in the UI or code

function buildProcessOptions() {
  return Object.keys(processCatalog)
    .map(name => `<option value="${name}">${name}</option>`) 
    .join('');
}

function renderStepForm(stepEl, processName) {
  const spec = processCatalog[processName];
  if (!spec) return;
  const inputsMarkup = spec.inputs.map(input => {
    const val = input.defaultValue ?? spec.defaults[input.name] ?? '';
    return `
      <div>
        <label>${input.label}</label>
        <input name="${input.name}" type="${input.type}" step="${input.step}" placeholder="${input.placeholder || ''}" value="${val}" />
      </div>
    `;
  }).join('');

  stepEl.querySelector('.dynamic-fields').innerHTML = `
    <details open>
      <summary>Parameters</summary>
      <div class="row-3">${inputsMarkup}</div>
    </details>
    <details>
      <summary>Materials & Solvents</summary>
      <div class="materials-editor">
        <div class="rows"></div>
        <div class="inline" style="gap:8px; margin-top:8px">
          <button type="button" class="ghost add-chem">Add chemical</button>
          <button type="button" class="ghost add-water">Add water</button>
        </div>
      </div>
    </details>
    <details open>
      <summary>Step outputs</summary>
      <div class="row-3">
        <div>
          <label>Energy (kWh)</label>
          <input name="energy" type="number" step="0.01" readonly />
        </div>
        <div>
          <label>Water (kg)</label>
          <input name="water" type="number" step="0.01" readonly />
        </div>
        <div>
          <label>Emissions (kg CO₂e)</label>
          <input name="emissions" type="number" step="0.01" readonly />
        </div>
      </div>
    </details>
  `;

  // Attach listeners to recompute on change
  const onChange = () => computeStepOutputs(stepEl, processName);
  stepEl.querySelectorAll('input').forEach(i => i.addEventListener('input', onChange));
  // Materials editor handlers
  const rowsContainer = stepEl.querySelector('.materials-editor .rows');
  const rebuildOptions = () => {
    return {
      chemicals: impactDb.chemicals.map(c => `<option value="${c.name}">${c.name}</option>`).join(''),
      waters: impactDb.waters.map(w => `<option value="${w.name}">${w.name}</option>`).join(''),
    };
  };
  const addChemRow = () => {
    const opts = rebuildOptions();
    const row = document.createElement('div');
    row.className = 'row material-row';
    row.innerHTML = `
      <select class="chem-name"><option value="">Select chemical</option>${opts.chemicals}</select>
      <input class="chem-amount" type="number" step="0.01" placeholder="Amount (kg)" />
      <button class="danger" type="button">✕</button>
    `;
    row.querySelector('.danger').addEventListener('click', () => { row.remove(); computeStepOutputs(stepEl, processName); });
    row.querySelectorAll('select,input').forEach(el => el.addEventListener('input', () => computeStepOutputs(stepEl, processName)));
    rowsContainer.appendChild(row);
  };
  const addWaterRow = () => {
    const opts = rebuildOptions();
    const row = document.createElement('div');
    row.className = 'row water-row';
    row.innerHTML = `
      <select class="water-name"><option value="">Select water type</option>${opts.waters}</select>
      <input class="water-amount" type="number" step="0.01" placeholder="Volume (L)" />
      <button class="danger" type="button">✕</button>
    `;
    row.querySelector('.danger').addEventListener('click', () => { row.remove(); computeStepOutputs(stepEl, processName); });
    row.querySelectorAll('select,input').forEach(el => el.addEventListener('input', () => computeStepOutputs(stepEl, processName)));
    rowsContainer.appendChild(row);
  };
  stepEl.querySelector('.add-chem').addEventListener('click', addChemRow);
  stepEl.querySelector('.add-water').addEventListener('click', addWaterRow);

  computeStepOutputs(stepEl, processName);
}

function computeStepOutputs(stepEl, processName) {
  const spec = processCatalog[processName];
  if (!spec) return;
  const gridFactor = 0; // not used; we take electricity impacts only from local dataset
  const ambientC = Number(document.getElementById('ambientTemp')?.value) || 25;
  const values = { gridFactor, ambientC };
  stepEl.querySelectorAll('input[name]').forEach(input => {
    const name = input.getAttribute('name');
    values[name] = Number(input.value);
  });
  const energyKWh = spec.energyKWh(values) || 0;
  let waterKg = spec.waterKg(values) || 0;

  // Materials & waters CO2e contribution
  let materialCo2e = 0;
  let waterCo2e = 0;
  const matRows = stepEl.querySelectorAll('.material-row');
  matRows.forEach(row => {
    const name = row.querySelector('.chem-name')?.value || '';
    const amt = Number(row.querySelector('.chem-amount')?.value) || 0;
    const indicator = document.getElementById('impactIndicator')?.value || 'GWP';
    let factor = impactDb.chemicals.find(c => c.name === name)?.[indicator] || 0;
    materialCo2e += amt * factor;
  });
  const waterRows = stepEl.querySelectorAll('.water-row');
  waterRows.forEach(row => {
    const name = row.querySelector('.water-name')?.value || '';
    const vol = Number(row.querySelector('.water-amount')?.value) || 0; // liters
    const indicator = document.getElementById('impactIndicator')?.value || 'GWP';
    let factor = impactDb.waters.find(w => w.name === name)?.[indicator] || 0;
    waterCo2e += vol * factor;
    // add solvent water to water mass metric (1 L ≈ 1 kg)
    waterKg += vol;
  });

  // Electricity impacts per indicator (local only)
  const indicator = 'GWP';
  let energyImpact = 0;
  const ds = document.getElementById('electricityDataset');
  const elecs = Array.isArray(impactDb.electricity) ? impactDb.electricity : [];
  const dsName = ds?.value || (elecs[0] && elecs[0].name) || '';
  const elecFactor = elecs.find(e => e.name === dsName)?.[indicator] || 0;
  energyImpact = elecFactor * energyKWh;
  const emissions = energyImpact + materialCo2e + waterCo2e;
  // Persist breakdown on the element for later collection/visuals
  stepEl.dataset.energyCo2e = String(Math.max(0, energyImpact));
  stepEl.dataset.materialCo2e = String(Math.max(0, materialCo2e));
  stepEl.dataset.waterCo2e = String(Math.max(0, waterCo2e));
  stepEl.querySelector('input[name="energy"]').value = (Math.round(energyKWh * 100) / 100).toString();
  stepEl.querySelector('input[name="water"]').value = (Math.round(waterKg * 100) / 100).toString();
  stepEl.querySelector('input[name="emissions"]').value = (Math.round(emissions * 100) / 100).toString();
}

function addStep(process) {
  const stepsContainer = document.querySelector(`#process${process} .process-steps`);
  const stepCount = stepsContainer.children.length + 1;
  const step = document.createElement('div');
  step.className = 'step';
  step.dataset.step = String(stepCount);
  step.innerHTML = `
    <div class="row">
      <div>
        <label>Known process</label>
        <select class="process-select">
          <option value="" disabled selected>Select a process</option>
          ${buildProcessOptions()}
        </select>
      </div>
      <div>
        <label>Custom label</label>
        <input class="custom-label" type="text" placeholder="Optional label (e.g., Reactor #2)" />
      </div>
      <div class="inline right">
        <button class="danger" type="button">Remove</button>
      </div>
    </div>
    <div class="dynamic-fields"></div>
  `;

  step.querySelector('.danger').addEventListener('click', () => {
    step.remove();
  });

  const select = step.querySelector('.process-select');
  select.addEventListener('change', (e) => {
    const name = select.value;
    renderStepForm(step, name);
  });

  stepsContainer.appendChild(step);
}

function collectData(process) {
    const steps = document.querySelectorAll(`#process${process} .step`);
  const nameInput = document.querySelector(`.process-name-input[data-proc="${process}"]`);
  const processName = nameInput?.value?.trim() || (process === 'A' ? 'Process A' : 'Process B');
  processes[process].name = processName;
    return Array.from(steps).map(step => {
    const select = step.querySelector('.process-select');
    const processName = select?.value || 'Custom';
    const customLabel = step.querySelector('.custom-label')?.value || '';
    const inputs = {};
    step.querySelectorAll('.dynamic-fields input[name]').forEach(i => {
      const n = i.getAttribute('name');
      inputs[n] = Number(i.value);
    });
    const energy = Number(step.querySelector('input[name="energy"]')?.value) || 0;
    const water = Number(step.querySelector('input[name="water"]')?.value) || 0;
    const emissions = Number(step.querySelector('input[name="emissions"]')?.value) || 0;
    const emissionsEnergy = Number(step.dataset.energyCo2e || 0);
    const emissionsMaterials = Number(step.dataset.materialCo2e || 0);
    const emissionsWater = Number(step.dataset.waterCo2e || 0);
    return { name: processName, label: customLabel, inputs, energy, water, emissions, emissionsEnergy, emissionsMaterials, emissionsWater };
  });
}

function compareProcesses() {
    processes.A.steps = collectData('A');
    processes.B.steps = collectData('B');
    
    const resultsContainer = document.getElementById('comparisonResults');
    resultsContainer.style.display = 'block';
    
  const totals = (steps) => steps.reduce((acc, s) => {
    acc.energy += Number(s.energy) || 0;
    acc.water += Number(s.water) || 0;
    acc.emissions += Number(s.emissions) || 0;
    return acc;
  }, { energy: 0, water: 0, emissions: 0 });

  const totalsA = totals(processes.A.steps);
  const totalsB = totals(processes.B.steps);

  const diff = {
    energy: totalsA.energy - totalsB.energy,
    water: totalsA.water - totalsB.water,
    emissions: totalsA.emissions - totalsB.emissions,
  };

  const format = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString();

  let comparisonHTML = `
    <h2>Comparison Results</h2>
    <table class="results-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>${processes.A.name}</th>
          <th>${processes.B.name}</th>
          <th>Difference (A - B)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Energy (kWh)</td>
          <td>${format(totalsA.energy)}</td>
          <td>${format(totalsB.energy)}</td>
          <td>${format(diff.energy)}</td>
        </tr>
        <tr>
          <td>Water (kg)</td>
          <td>${format(totalsA.water)}</td>
          <td>${format(totalsB.water)}</td>
          <td>${format(diff.water)}</td>
        </tr>
        <tr>
          <td>Emissions (kg CO₂)</td>
          <td>${format(totalsA.emissions)}</td>
          <td>${format(totalsB.emissions)}</td>
          <td>${format(diff.emissions)}</td>
        </tr>
      </tbody>
    </table>
  `;

  // Steps detail
  const renderSteps = (label, steps) => `
    <div class="steps-list">
      <h3>${label} Steps</h3>
      <ol>
        ${steps.map(s => `<li><strong>${s.name}</strong>${s.label ? ` — ${s.label}` : ''} — E: ${format(s.energy)} kWh, W: ${format(s.water)} kg, CO₂: ${format(s.emissions)} kg</li>`).join('')}
      </ol>
    </div>
  `;

  comparisonHTML += `
    <div class="steps-wrapper">
      ${renderSteps(processes.A.name, processes.A.steps)}
      ${renderSteps(processes.B.name, processes.B.steps)}
    </div>
  `;
    
    resultsContainer.innerHTML = comparisonHTML;

  // Render charts after comparison
  renderVisualizations();
}

function saveData() {
    localStorage.setItem('lcaData', JSON.stringify(processes));
  alert('Scenario saved locally.');
}

function resetAll() {
  document.querySelectorAll('.process-steps').forEach(c => c.innerHTML = '');
  processes = { A: { steps: [] }, B: { steps: [] } };
  document.getElementById('comparisonResults').style.display = 'none';
}

// Initialize minimal UI
window.onload = async () => {
  // Start with one empty step per side
  await loadImpactDb();
  renderImpactDbTables();
  addStep('A');
  addStep('B');
};

// ---------- Visualization (ECharts) and PDF Export ----------
function dataForCharts() {
  const a = processes.A.steps;
  const b = processes.B.steps;
  const metric = (s, key) => s.reduce((sum, x) => sum + (Number(x[key]) || 0), 0);
  const totalsA = {
    energy: metric(a, 'energy'), water: metric(a, 'water'), emissions: metric(a, 'emissions'),
    emissionsEnergy: metric(a, 'emissionsEnergy'), emissionsMaterials: metric(a, 'emissionsMaterials'), emissionsWater: metric(a, 'emissionsWater')
  };
  const totalsB = {
    energy: metric(b, 'energy'), water: metric(b, 'water'), emissions: metric(b, 'emissions'),
    emissionsEnergy: metric(b, 'emissionsEnergy'), emissionsMaterials: metric(b, 'emissionsMaterials'), emissionsWater: metric(b, 'emissionsWater')
  };
  return { a, b, totalsA, totalsB };
}

function renderVisualizations() {
  const { a, b, totalsA, totalsB } = dataForCharts();
  const format = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // Bars: grouped totals (stacked emissions components)
  const barsEl = document.getElementById('barsChart');
  if (barsEl && window.echarts) {
    const chart = echarts.init(barsEl);
    chart.setOption({
      darkMode: true,
      tooltip: { trigger: 'axis' },
      legend: { data: [processes.A.name, processes.B.name, 'Emissions — Energy', 'Emissions — Materials', 'Emissions — Water'] },
      xAxis: { type: 'category', data: ['Energy (kWh)', 'Water (kg)', 'Emissions (kg CO₂e)'] },
      yAxis: { type: 'value' },
      series: [
        { name: processes.A.name, type: 'bar', stack: 'totals', data: [format(totalsA.energy), format(totalsA.water), 0], itemStyle: { opacity: 0.9 } },
        { name: processes.B.name, type: 'bar', stack: 'totals', data: [format(totalsB.energy), format(totalsB.water), 0], itemStyle: { opacity: 0.9 } },
        { name: 'Emissions — Energy', type: 'bar', stack: 'A-emi', data: [0, 0, format(totalsA.emissionsEnergy + totalsB.emissionsEnergy)], itemStyle: { color: '#6aa6ff' } },
        { name: 'Emissions — Materials', type: 'bar', stack: 'A-emi', data: [0, 0, format(totalsA.emissionsMaterials + totalsB.emissionsMaterials)], itemStyle: { color: '#2cd498' } },
        { name: 'Emissions — Water', type: 'bar', stack: 'A-emi', data: [0, 0, format(totalsA.emissionsWater + totalsB.emissionsWater)], itemStyle: { color: '#ff6a7d' } }
      ]
    });
  }

  // Heatmap: steps by selected metric (energy/water/emissions total only)
  const heatmapEl = document.getElementById('heatmapChart');
  if (heatmapEl && window.echarts) {
    const rows = ['A', 'B'];
    const cols = [];
    const matrixIndex = {};
    const addCol = (label) => {
      if (!(label in matrixIndex)) { matrixIndex[label] = cols.length; cols.push(label); }
      return matrixIndex[label];
    };
    a.forEach((s, i) => { addCol(`A-${i+1} ${s.name}`); });
    b.forEach((s, i) => { addCol(`B-${i+1} ${s.name}`); });
    // Build data [x, y, value] using selection
    const values = [];
    const heatmapMetric = document.getElementById('heatmapMetric')?.value || 'energy';
    const pick = (s) => {
      switch (heatmapMetric) {
        case 'water': return s.water;
        case 'emissions': return s.emissions;
        case 'energy':
        default: return s.energy;
      }
    };
    cols.forEach((label, x) => {
      if (label.startsWith('A-')) {
        const idx = parseInt(label.split('-')[1]) - 1;
        const s = a[idx];
        if (s) values.push([x, 0, format(pick(s))]);
      } else {
        const idx = parseInt(label.split('-')[1]) - 1;
        const s = b[idx];
        if (s) values.push([x, 1, format(pick(s))]);
      }
    });
    const chart = echarts.init(heatmapEl);
    chart.setOption({
      darkMode: true,
      tooltip: { position: 'top' },
      grid: { height: '60%', top: '10%' },
      xAxis: { type: 'category', data: cols, splitArea: { show: true } },
      yAxis: { type: 'category', data: rows, splitArea: { show: true } },
      visualMap: { min: 0, max: Math.max(...values.map(v => v[2]), 1), calculable: true, orient: 'horizontal', left: 'center', bottom: '5%' },
      series: [{ name: 'Heatmap', type: 'heatmap', data: values, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
    });
  }

  // Sunburst: hierarchy Process -> Step -> Metric contributions
  const sunburstEl = document.getElementById('sunburstChart');
  if (sunburstEl && window.echarts) {
    const metricKey = document.getElementById('sunburstMetric')?.value || 'energy';
    const toNode = (label, steps) => ({
      name: label,
      children: steps.map((s, i) => {
        const base = { name: `${label}-${i+1} ${s.name}` };
        if (metricKey === 'emissions') {
          return {
            ...base,
            value: format(s.emissions),
            children: [
              { name: 'Energy CO₂e', value: format(s.emissionsEnergy) },
              { name: 'Materials CO₂e', value: format(s.emissionsMaterials) },
              { name: 'Water CO₂e', value: format(s.emissionsWater) },
            ]
          };
        }
        return { ...base, value: format(s[metricKey]) };
      })
    });
    const data = [toNode(processes.A.name, a), toNode(processes.B.name, b)];
    const chart = echarts.init(sunburstEl);
    chart.setOption({
      darkMode: true,
      series: {
        type: 'sunburst',
        data,
        radius: [0, '90%'],
        sort: null,
        emphasis: { focus: 'ancestor' },
        levels: [
          {},
          { r0: '0%', r: '30%', label: { rotate: 0 } },
          { r0: '30%', r: '60%' },
          { r0: '60%', r: '90%' }
        ]
      },
      tooltip: { formatter: (p) => `${p.name}: ${format(p.value)}` }
    });
  }

  // Sankey: Steps -> Process -> Total (emissions breakdown)
  const sankeyBreakEl = document.getElementById('sankeyBreakdownChart');
  if (sankeyBreakEl && window.echarts) {
    const nodes = [];
    const links = [];
    const addNode = (name) => { if (!nodes.find(n => n.name === name)) nodes.push({ name }); };

    const totalNode = 'Total Emissions';
    addNode(totalNode);

    const procNodes = [`${processes.A.name} Emissions`, `${processes.B.name} Emissions`];
    procNodes.forEach(addNode);

    const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    const totalAE = sum(a, 'emissions');
    const totalBE = sum(b, 'emissions');

    // Process -> Total
    links.push({ source: `${processes.A.name} Emissions`, target: totalNode, value: format(totalAE) });
    links.push({ source: `${processes.B.name} Emissions`, target: totalNode, value: format(totalBE) });

    // Steps components -> Process
    const addStepComponent = (procName, s, idx, label, value) => {
      const node = `${procName}-${idx} ${s.name} (${label})`;
      addNode(node);
      links.push({ source: node, target: `${procName} Emissions`, value: format(value) });
    };
    a.forEach((s, i) => {
      addStepComponent(processes.A.name, s, i+1, 'Energy', s.emissionsEnergy || 0);
      addStepComponent(processes.A.name, s, i+1, 'Materials', s.emissionsMaterials || 0);
      addStepComponent(processes.A.name, s, i+1, 'Water', s.emissionsWater || 0);
    });
    b.forEach((s, i) => {
      addStepComponent(processes.B.name, s, i+1, 'Energy', s.emissionsEnergy || 0);
      addStepComponent(processes.B.name, s, i+1, 'Materials', s.emissionsMaterials || 0);
      addStepComponent(processes.B.name, s, i+1, 'Water', s.emissionsWater || 0);
    });

    const chart = echarts.init(sankeyBreakEl);
    chart.setOption({
      darkMode: true,
      tooltip: { trigger: 'item', triggerOn: 'mousemove' },
      series: [{
        type: 'sankey',
        data: nodes,
        links,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5 },
        nodeAlign: 'left'
      }]
    });
  }

  // Sankey: Sources -> Process -> Steps (emissions sources)
  const sankeySourceEl = document.getElementById('sankeySourceChart');
  if (sankeySourceEl && window.echarts) {
    const nodes = [];
    const links = [];
    const addNode = (name) => { if (!nodes.find(n => n.name === name)) nodes.push({ name }); };

    const sources = ['Grid Electricity', 'Upstream Materials', 'Upstream Water'];
    const procNodes = [processes.A.name, processes.B.name];
    [...sources, ...procNodes].forEach(addNode);

    const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    const totalsSrcA = { grid: sum(a, 'emissionsEnergy'), mats: sum(a, 'emissionsMaterials'), water: sum(a, 'emissionsWater') };
    const totalsSrcB = { grid: sum(b, 'emissionsEnergy'), mats: sum(b, 'emissionsMaterials'), water: sum(b, 'emissionsWater') };
    links.push({ source: 'Grid Electricity', target: processes.A.name, value: format(totalsSrcA.grid) });
    links.push({ source: 'Upstream Materials', target: processes.A.name, value: format(totalsSrcA.mats) });
    links.push({ source: 'Upstream Water', target: processes.A.name, value: format(totalsSrcA.water) });
    links.push({ source: 'Grid Electricity', target: processes.B.name, value: format(totalsSrcB.grid) });
    links.push({ source: 'Upstream Materials', target: processes.B.name, value: format(totalsSrcB.mats) });
    links.push({ source: 'Upstream Water', target: processes.B.name, value: format(totalsSrcB.water) });

    a.forEach((s, i) => {
      const stepNode = `${processes.A.name}-${i+1} ${s.name}`;
      addNode(stepNode);
      if (s.emissionsEnergy) links.push({ source: processes.A.name, target: stepNode, value: format(s.emissionsEnergy) });
      if (s.emissionsMaterials) links.push({ source: processes.A.name, target: stepNode, value: format(s.emissionsMaterials) });
      if (s.emissionsWater) links.push({ source: processes.A.name, target: stepNode, value: format(s.emissionsWater) });
    });
    b.forEach((s, i) => {
      const stepNode = `${processes.B.name}-${i+1} ${s.name}`;
      addNode(stepNode);
      if (s.emissionsEnergy) links.push({ source: processes.B.name, target: stepNode, value: format(s.emissionsEnergy) });
      if (s.emissionsMaterials) links.push({ source: processes.B.name, target: stepNode, value: format(s.emissionsMaterials) });
      if (s.emissionsWater) links.push({ source: processes.B.name, target: stepNode, value: format(s.emissionsWater) });
    });

    const chart = echarts.init(sankeySourceEl);
    chart.setOption({
      darkMode: true,
      tooltip: { trigger: 'item', triggerOn: 'mousemove' },
      series: [{
        type: 'sankey',
        data: nodes,
        links,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5 },
        nodeAlign: 'left'
      }]
    });
  }

  // Impact callout: identify top contributing step across metrics
  const allSteps = [
    ...a.map((s, i) => ({ process: processes.A.name, index: i+1, ...s })),
    ...b.map((s, i) => ({ process: processes.B.name, index: i+1, ...s })),
  ];
  const byEnergy = [...allSteps].sort((x, y) => (y.energy || 0) - (x.energy || 0))[0];
  const byWater = [...allSteps].sort((x, y) => (y.water || 0) - (x.water || 0))[0];
  const byCO2 = [...allSteps].sort((x, y) => (y.emissions || 0) - (x.emissions || 0))[0];
  const impact = document.getElementById('impactCallout');
  if (impact) {
    const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString();
    impact.innerHTML = `
      <div>
        <strong>Most impactful steps</strong> — focus optimization here:
        <ul>
          <li>Energy: ${byEnergy ? `${byEnergy.process}-${byEnergy.index} ${byEnergy.name} (${fmt(byEnergy.energy)} kWh)` : '—'}</li>
          <li>Water: ${byWater ? `${byWater.process}-${byWater.index} ${byWater.name} (${fmt(byWater.water)} kg)` : '—'}</li>
          <li>Emissions: ${byCO2 ? `${byCO2.process}-${byCO2.index} ${byCO2.name} (${fmt(byCO2.emissions)} kg CO₂)` : '—'}</li>
        </ul>
      </div>
    `;
  }
}

async function exportPDF() {
  const section = document.querySelector('main.container');
  if (!section) return;
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { alert('PDF library not loaded'); return; }
  // Increase scale for sharper PDF
  const canvas = await html2canvas(section, { scale: 2, backgroundColor: '#0b1020' });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  // Fit image to page keeping aspect
  const imgWidth = pageWidth - 40;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const y = Math.max(20, (pageHeight - imgHeight) / 2);
  pdf.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);
  pdf.save('lca-comparison.pdf');
}