// js/main.js

// Global filters that other views set
const filters = {
  state: null,
  raceKey: null, // e.g. "race:Asian"
  smoking: null,
  gender: null
};

let fullData = [];
let smokingCategories = [];
let raceColumns = null;
let usGeo = null;

// Shared tooltip
const tooltip = d3
  .select("#tooltip")
  .style("opacity", 0);

function showTooltip(html, event) {
  tooltip
    .style("opacity", 1)
    .html(html)
    .style("left", event.pageX + 12 + "px")
    .style("top", event.pageY + 12 + "px");
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

// ----- Reset dashboard button -----
// (script is loaded at the end of <body>, so DOM elements already exist)
const resetBtn = document.getElementById("reset-btn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    // Easiest way to fully clear all filters, brushes, selections, etc.
    window.location.reload();
  });
}

// Toggle helper (click again to clear)
function toggleFilter(key, value) {
  filters[key] = filters[key] === value ? null : value;
  applyFilters();
}

// Apply filters to full data and refresh all views
function applyFilters() {
  const filtered = fullData.filter((d) => {
    if (filters.state && d.location !== filters.state) return false;
    if (filters.gender && d.gender !== filters.gender) return false;
    if (filters.smoking && d.smoking_history !== filters.smoking) return false;

    if (filters.raceKey) {
      if (+d[filters.raceKey] !== 1) return false;
    }
    return true;
  });

  updateParallelCoords(filtered);
  updateMap(filtered);
  updateRaceRadial(filtered);
  updateSmokingRadar(filtered);
  updateGenderCards(filtered);

  console.log("Current filter state:", filters, "rows:", filtered.length);
}

// Deterministic "random" score based on index (for reproducible sampling)
function deterministicScore(i) {
  // Simple hash based on sine; deterministic across reloads
  const x = Math.sin((i + 1) * 7919) * 10000;
  return x - Math.floor(x);
}

// MAIN LOAD
Promise.all([
  d3.csv("data/diabetes_dataset.csv", d3.autoType),
  d3.json("data/us-states.geojson")
]).then(([rows, geo]) => {
  usGeo = geo;

  // Split dataset into diabetics and non-diabetics
  const diabetics = rows.filter((d) => d.diabetes === 1);
  const nonDiabetics = rows.filter((d) => d.diabetes === 0);

  console.log("Total rows:", rows.length);
  console.log("Diabetics:", diabetics.length, "Non-diabetics:", nonDiabetics.length);

  // Target: keep all diabetic records, and sample the same number of non-diabetics (up to 8500)
  const targetDiab = Math.min(diabetics.length, 8500);
  const targetNonDiab = Math.min(nonDiabetics.length, targetDiab);

  // (Optional) if diabetics > target, you could also sample diabetics;
  // here we keep all diabetics if <= 8500, which matches your dataset.
  const keptDiabetics = diabetics.slice(0, targetDiab);

  // Deterministically sample non-diabetic records
  const nonDWithScore = nonDiabetics.map((d, i) => ({
    d,
    score: deterministicScore(i)
  }));

  nonDWithScore.sort((a, b) => a.score - b.score);

  const sampledNonDiabetics = nonDWithScore
    .slice(0, targetNonDiab)
    .map((o) => o.d);

  // Balanced dataset used by all visualizations
  fullData = keptDiabetics.concat(sampledNonDiabetics);

  console.log("Balanced fullData size:", fullData.length);
  console.log(
    "Balanced diabetics:",
    fullData.filter((d) => d.diabetes === 1).length,
    "Balanced non-diabetics:",
    fullData.filter((d) => d.diabetes === 0).length
  );

  // Define which columns encode race in your CSV
  raceColumns = [
    { key: "race:AfricanAmerican", label: "African American" },
    { key: "race:Asian", label: "Asian" },
    { key: "race:Caucasian", label: "Caucasian" },
    { key: "race:Hispanic", label: "Hispanic" },
    { key: "race:Other", label: "Other" }
  ];

  // Smoking categories present in *balanced* data
  smokingCategories = Array.from(
    new Set(fullData.map((d) => d.smoking_history))
  )
    .filter((d) => d !== null && d !== undefined && d !== "")
    .sort();

  console.log("Smoking categories found:", smokingCategories);

  // Initialize each visualization once, using the balanced fullData
  createParallelCoords(fullData, {
    showTooltip,
    hideTooltip
  });

  createMap(usGeo, fullData, {
    showTooltip,
    hideTooltip,
    onStateClick: (stateName) => toggleFilter("state", stateName)
  });

  createRaceRadial(fullData, raceColumns, {
    showTooltip,
    hideTooltip,
    onRaceClick: (raceKey) => toggleFilter("raceKey", raceKey)
  });

  createSmokingRadar(fullData, smokingCategories, {
    showTooltip,
    hideTooltip,
    onAxisClick: (category) => toggleFilter("smoking", category)
  });

  createGenderCards(fullData, {
    showTooltip,
    hideTooltip,
    onGenderClick: (gender) => toggleFilter("gender", gender)
  });

  // First draw (no filters)
  applyFilters();
});
