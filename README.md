## CMP Slurry Manufacturing — LCA Modeler

A single‑page web app to build and compare two process chains (A vs B) for CMP slurry manufacturing. It estimates per‑step energy (kWh), water (kg), and total impact (kg CO₂e) using engineering models and a small inlined database of impact factors (electricity, chemicals, water).

### Highlights
- **Process templates**: Calcination, Hydrothermal, Milling, Sonication, Centrifuge, Filtration, Drying, Washing, Annealing.
- **Per‑step calculators**: Each template defines inputs and an energy model. Water and emissions are derived from user inputs and chosen impact factors.
- **Materials & solvents editor**: Add chemicals and water per step; totals roll up automatically.
- **Electricity datasets**: Switch among predefined electricity mixes (GLO, US, EU).
- **Comparison & visuals**: Tables plus ECharts visuals (Bars, Heatmap, Sunburst, two Sankeys).
- **PDF export**: Save the current screen as a PDF via html2canvas + jsPDF.
- **Local persistence**: Scenarios and edited impact factors persist in `localStorage`.

---

## Quick start

You can open the app directly or serve it locally.

- Open `index.html` in a modern browser (Chrome, Edge, Safari, Firefox).
- Optional (recommended): run a tiny static server for cleaner local testing.
  - Python 3: `python3 -m http.server 5500`
  - Node (http-server): `npx http-server -p 5500`
  - Visit `http://localhost:5500/index.html`

No build step is required. All logic is in plain JS and the ECharts/HTML2Canvas/jsPDF libraries are loaded via CDN.

---

## Project structure
- `index.html`: Markup and control surfaces (ambient temp, electricity datasets, compare/reset, visualization controls, PDF export, Impact Factors panel).
- `styles.css`: Visual layout and theme.
- `app.js`: Application logic (process catalog, impact computations, persistence, rendering, charts, export).

---

## Core concepts

### Data model (in memory + localStorage)
- `impactDb` (in `app.js`):
  - `electricity`: array of datasets with per‑kWh factors `{ name, GWP, ADP, WaterUse, AP, FETP }`.
  - `chemicals`: array with per‑kg factors `{ name, GWP, ADP, WaterUse, AP, FETP }`.
  - `waters`: array with per‑liter factors `{ name, GWP, ADP, WaterUse, AP, FETP }`.
- Persisted under `localStorage` key `impactDbV2`.
- Selected electricity dataset is stored under `localStorage:selectedElectricityDataset`.
- User scenarios (steps) can be saved to `localStorage:lcaData` via the “Save Scenario” button.

On first run, the app uses the fully inlined defaults in `app.js`. If existing saved data is found, it is normalized and merged with defaults (by name), so you never lose newly added defaults.

### Process catalog
Defined in `app.js` as `processCatalog`. Each entry contains:
- `key`: stable id
- `inputs`: UI fields (name, label, type, step, placeholder, defaultValue)
- `defaults`: default values
- `energyKWh(values)`: function that returns energy consumption
- `waterKg(values)`: function that returns water mass contribution

Energy is converted to emissions via the selected electricity dataset. Materials and solvent impacts are computed from the `impactDb` selections you add in each step.

### Step rendering and recomputation
- Adding a step creates a form with template inputs, a materials & solvents editor, and read‑only outputs.
- Any change (parameters, materials, water) triggers `computeStepOutputs(...)`, which:
  - Calculates `energyKWh`, `waterKg`
  - Computes materials and water impacts from `impactDb`
  - Multiplies energy by the selected electricity factor (default indicator: `GWP`)
  - Writes `energy`, `water`, `emissions` into the UI and stores a breakdown on the DOM element for charts.

### Comparison & Visualizations
Press “Compare Processes” to generate the comparison table and render charts. Visuals include:
- Bars (totals), Heatmap (per‑step), Sunburst (hierarchy), Sankey (breakdown) and Sankey (sources).

### Export
“Export PDF” snapshots the visible content using `html2canvas` and outputs a landscape PDF via `jsPDF`.

---

## Editing the Impact Factors

Open the “Impact Factors” panel and edit the tables:
- Add/delete rows for chemicals and water types
- Adjust numeric factor values (GWP et al.)

Click “Save Impact Factors” to persist edits. “Reset to Defaults” restores the inlined dataset from `app.js`.

Indicators used:
- Chemicals/Water: The code supports multiple indicators (`GWP`, `ADP`, `WaterUse`, `AP`, `FETP`). Computations default to `GWP` unless a UI selector is added.
- Electricity: Same indicators are available; `GWP` is used for energy‑derived emissions.

---

## Extending the app

### Add a new process template
1. Open `app.js` and find `processCatalog`.
2. Add a new entry with `inputs`, `defaults`, `energyKWh(values)`, and `waterKg(values)`.
3. The process will automatically appear in the “Known process” select for new steps.

Guidelines:
- Keep energy models clear and documented.
- Use guard clauses and convert inputs with `Number(...)`.
- Prefer multi‑line, readable code; avoid compact one‑liners for complex math.

### Add new default impact factors
- Update the inlined `impactDb` in `app.js` (arrays for `electricity`, `chemicals`, `waters`).
- Ensure each object includes all indicators you want to use.
- After updating, click “Reset to Defaults” in the UI to reload the new defaults into `localStorage`.

### Adding UI for indicator selection (optional)
- There are hooks in `computeStepOutputs` to read an element with id `impactIndicator`.
- To let users switch the indicator (e.g., `ADP` or `WaterUse`), add a select with id `impactIndicator` in `index.html` and style it in `styles.css`.

---

## Troubleshooting
- **No output updating**: Ensure you’ve selected a process in a step and adjusted inputs. Check the browser console for errors.
- **Electricity dropdown empty**: Click “Reset to Defaults” to restore inlined electricity datasets.
- **Old or partial data**: Use “Reset to Defaults” or manually clear `localStorage` keys: `impactDbV2`, `selectedElectricityDataset`, `lcaData`.
- **PDF looks low‑res**: Export scales the canvas by 2×; zoom the browser out slightly to fit more on screen before exporting.

---

## Tech notes
- Plain JS/DOM (no build tools). External libraries via CDN:
  - ECharts 5, html2canvas 1.4, jsPDF 2.5
- Persistence via `localStorage` with schema normalization/merge on load.
- Charts are recreated on demand; they don’t mutate the data model.

---

## Roadmap ideas
- Per‑indicator selector in the UI (GWP/ADP/WaterUse/AP/FETP).
- Import/Export of scenarios and factors as JSON.
- More process templates and calibrated energy/water models.
- Validation messages for out‑of‑range input values.
- Unit tests for `energyKWh`/`waterKg` models.

---

## License
For demonstration purposes only. Formulas are simplified; validate against your plant data before production use.


