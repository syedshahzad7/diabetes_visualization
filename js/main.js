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

// MAIN LOAD
Promise.all([
  d3.csv("data/diabetes_dataset.csv", d3.autoType),
  d3.json("data/us-states.geojson")
]).then(([rows, geo]) => {
  fullData = rows;
  usGeo = geo;

  // Define which columns encode race in your CSV
  raceColumns = [
    { key: "race:AfricanAmerican", label: "African American" },
    { key: "race:Asian", label: "Asian" },
    { key: "race:Caucasian", label: "Caucasian" },
    { key: "race:Hispanic", label: "Hispanic" },
    { key: "race:Other", label: "Other" }
  ];

  // Smoking categories present in data
  smokingCategories = Array.from(
    new Set(fullData.map((d) => d.smoking_history))
  )
    .filter((d) => d !== null && d !== undefined && d !== "")
    .sort();

  console.log("Smoking categories found:", smokingCategories);

  // Initialize each visualization once
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
