// Process data storage
let processes = {
    A: { steps: [] },
    B: { steps: [] }
};

function addStep(process) {
    const stepsContainer = document.querySelector(`#process${process} .process-steps`);
    const stepCount = stepsContainer.children.length + 1;
    
    const newStep = document.createElement('div');
    newStep.className = 'step';
    newStep.dataset.step = stepCount;
    newStep.innerHTML = `
        <h3>Step ${stepCount}: <input type="text" placeholder="Process Name"></h3>
        <div class="input-group">
            <label>Energy Consumption (kWh):</label>
            <input type="number" step="0.1">
        </div>
        <div class="input-group">
            <label>Material Input (kg):</label>
            <input type="number" step="0.1">
        </div>
        <div class="input-group">
            <label>Emissions (kg CO₂):</label>
            <input type="number" step="0.1">
        </div>
    `;
    
    stepsContainer.appendChild(newStep);
}

function collectData(process) {
    const steps = document.querySelectorAll(`#process${process} .step`);
    return Array.from(steps).map(step => {
        return {
            name: step.querySelector('input[type="text"]').value,
            energy: parseFloat(step.querySelector('input[type="number"]:nth-of-type(1)').value) || 0,
            material: parseFloat(step.querySelector('input[type="number"]:nth-of-type(2)').value) || 0,
            emissions: parseFloat(step.querySelector('input[type="number"]:nth-of-type(3)').value) || 0
        };
    });
}

function compareProcesses() {
    processes.A.steps = collectData('A');
    processes.B.steps = collectData('B');
    
    const resultsContainer = document.getElementById('comparisonResults');
    resultsContainer.style.display = 'block';
    
    // Simple comparison example
    let comparisonHTML = '<h2>Comparison Results</h2>';
    
    // Add your comparison logic here
    // This could include total values comparison, step-by-step analysis, etc.
    
    resultsContainer.innerHTML = comparisonHTML;
}

function saveData() {
    // Add save functionality (localStorage or server connection)
    localStorage.setItem('lcaData', JSON.stringify(processes));
    alert('Data saved successfully!');
}

// Initialize with first step
window.onload = () => {
    addStep('A');
    addStep('B');
}; 