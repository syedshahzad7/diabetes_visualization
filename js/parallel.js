// js/parallel.js

let pcSvg,
  pcLinesG,
  pcAxesG,
  pcInnerWidth,
  pcInnerHeight,
  pcXScale,
  pcYScales,
  pcDimensions,
  pcLine,
  pcConfig;

// store the most recent dataset passed to updateParallelCoords
let pcCurrentData = [];
// null = show both; "diabetic" = only diabetic; "non-diabetic" = only non-diabetic
let pcLegendFilter = null;

// ---- Global style knobs for PCP lines ----
let pcBaseOpacity = 0.05;        // default base opacity (will be updated dynamically)
let pcBaseStrokeWidth = 0.4;     // default base stroke width (dynamic)
const pcFadeOpacity = 0.02;      // opacity for non-hovered lines while hovering
const pcFadeStrokeWidth = 0.2;   // stroke width for non-hovered lines
const pcHoverOpacity = 1;        // hovered line opacity
const pcHoverStrokeWidth = 2.4;  // hovered line stroke width

// ---- NEW: Track brush state across axes ----
let pcActiveBrushSelections = {}; // { dimKey: [y0,y1] | null }
let pcBrushActive = false;

// Floating comparison panel (HTML)
let pcDetailPanel = null;

function ensurePcDetailPanel() {
  if (pcDetailPanel) return pcDetailPanel;

  pcDetailPanel = document.createElement("div");
  pcDetailPanel.id = "pc-detail-panel";
  pcDetailPanel.className = "pc-detail-panel";
  pcDetailPanel.style.display = "none";
  document.body.appendChild(pcDetailPanel);

  return pcDetailPanel;
}

function hidePcDetailPanel() {
  if (pcDetailPanel) {
    pcDetailPanel.style.display = "none";
  }
}

// ---- NEW: Helper that checks whether any brush is active ----
function updateBrushActiveFlag() {
  pcBrushActive = Object.values(pcActiveBrushSelections).some((s) => s != null);
}

// ---- NEW: Apply styling based on all active brushes ----
// This keeps brush styling stable and avoids hover overwriting it.
function applyActiveBrushStyling() {
  const allLines = pcLinesG.selectAll(".pc-line");

  updateBrushActiveFlag();

  if (!pcBrushActive) {
    // No active brushes => restore base style
    allLines
      .attr("opacity", pcBaseOpacity)
      .attr("stroke-width", pcBaseStrokeWidth);
    return;
  }

  // When brushes exist, a line must satisfy ALL active brush ranges
  allLines.each(function (d) {
    let keep = true;

    for (const dim of pcDimensions) {
      const sel = pcActiveBrushSelections[dim.key];
      if (!sel) continue;

      const val = +d[dim.key];
      const y = pcYScales[dim.key](val);
      const [y0, y1] = sel;

      if (!(y >= y0 && y <= y1)) {
        keep = false;
        break;
      }
    }

    d3.select(this)
      .attr("opacity", keep ? 0.7 : 0.003)
      .attr("stroke-width", keep ? 0.8 : 0.3);
  });
}

function createParallelCoords(data, config) {
  pcConfig = config;

  const svg = d3.select("#parallel");

  // Use current width but cap height so the chart isn't huge
  const width = svg.node().clientWidth || 900;
  const height = 220; // smaller fixed height

  // Slightly larger left margin so the first axis/title has room
  const margin = { top: 20, right: 20, bottom: 10, left: 80 };
  pcInnerWidth = width - margin.left - margin.right;
  pcInnerHeight = height - margin.top - margin.bottom;

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  // Root group
  pcSvg = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Separate groups so axes stay on top
  pcLinesG = pcSvg.append("g").attr("class", "pc-lines");
  pcAxesG = pcSvg.append("g").attr("class", "pc-axes");

  // Outcome axis removed — only numeric clinical measures.
  pcDimensions = [
    { key: "age", label: "Age" },
    { key: "bmi", label: "BMI" },
    { key: "hbA1c_level", label: "HbA1c" },
    { key: "blood_glucose_level", label: "Blood Glucose" }
  ];

  // Initialize brush tracking for each dimension
  pcActiveBrushSelections = {};
  pcDimensions.forEach((d) => (pcActiveBrushSelections[d.key] = null));
  pcBrushActive = false;

  pcXScale = d3
    .scalePoint()
    .domain(pcDimensions.map((d) => d.key))
    .range([0, pcInnerWidth]);

  pcYScales = {};
  pcDimensions.forEach((dim) => {
    pcYScales[dim.key] = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => +d[dim.key]))
      .nice()
      .range([pcInnerHeight, 0]);
  });

  pcLine = d3
    .line()
    .defined((d) => !isNaN(d[1]))
    .x((d) => d[0])
    .y((d) => d[1]);

  // We'll keep references to each axis brush so we can clear them later
  const axisBrushes = [];

  // ----- Axes -----
  const axisGroups = pcAxesG
    .selectAll(".dimension")
    .data(pcDimensions)
    .join("g")
    .attr("class", "dimension")
    .attr("transform", (d) => `translate(${pcXScale(d.key)},0)`);

  axisGroups.each(function (dim) {
    const g = d3.select(this);
    const scale = pcYScales[dim.key];
    const axis = d3.axisLeft(scale).ticks(4); // fewer ticks

    const axisG = g
      .append("g")
      .attr("class", "pc-axis")
      .call(axis);

    axisG.selectAll("text").attr("font-size", 8);

    const titleText = g
      .append("text")
      .attr("class", "axis-title")
      .attr("y", -10)
      .attr("font-size", 11) // smaller titles
      .attr("font-weight", 600)
      .text(dim.label);

    // Adjust text-anchor for Blood Glucose label to prevent cropping
    if (dim.key === "blood_glucose_level") {
      titleText.attr("text-anchor", "end").attr("dx", -5);
    } else {
      titleText.attr("text-anchor", "middle");
    }

    const brush = d3
      .brushY()
      .extent([
        [-10, 0],
        [10, pcInnerHeight]
      ])
      .on("brush end", brushed);

    g.append("g").attr("class", "brush").call(brush);

    // store for later clearing
    axisBrushes.push({ g, brush });

    function brushed({ selection }) {
      // Track selection for this dimension
      pcActiveBrushSelections[dim.key] = selection || null;

      // Apply styling based on ALL active brushes
      applyActiveBrushStyling();
    }
  });

  // first draw
  updateParallelCoords(data);

  // ---------- Legend interactivity (clickable dots) ----------
  pcCurrentData = data;

  const diabeticSwatch = document.querySelector(".pc-legend-diabetic");
  const nonDiabSwatch = document.querySelector(".pc-legend-nondiabetic");

  function refreshLegendStyles() {
    if (diabeticSwatch) {
      diabeticSwatch.style.cursor = "pointer";
      if (pcLegendFilter === "diabetic") {
        diabeticSwatch.style.transform = "scale(1.2)";
        diabeticSwatch.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.25)";
        diabeticSwatch.style.opacity = "1";
      } else {
        diabeticSwatch.style.transform = "scale(1)";
        diabeticSwatch.style.boxShadow = "none";
        diabeticSwatch.style.opacity =
          pcLegendFilter === null ? "1" : "0.3";
      }
    }
    if (nonDiabSwatch) {
      nonDiabSwatch.style.cursor = "pointer";
      if (pcLegendFilter === "non-diabetic") {
        nonDiabSwatch.style.transform = "scale(1.2)";
        nonDiabSwatch.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.25)";
        nonDiabSwatch.style.opacity = "1";
      } else {
        nonDiabSwatch.style.transform = "scale(1)";
        nonDiabSwatch.style.boxShadow = "none";
        nonDiabSwatch.style.opacity =
          pcLegendFilter === null ? "1" : "0.3";
      }
    }
  }

  if (diabeticSwatch) {
    diabeticSwatch.addEventListener("click", (event) => {
      event.stopPropagation();
      pcLegendFilter =
        pcLegendFilter === "diabetic" ? null : "diabetic";

      updateParallelCoords(pcCurrentData);
      refreshLegendStyles();
      hidePcDetailPanel();

      // Clear PCP-driven highlights when toggling legend
      if (typeof highlightMapStateFromPCP === "function") {
        highlightMapStateFromPCP(null);
      }
      if (typeof highlightSmokingFromPCP === "function") {
        highlightSmokingFromPCP(null);
      }
      if (typeof highlightGenderFromPCP === "function") {
        highlightGenderFromPCP(null);
      }

      // Re-apply brush styling if any brush exists
      applyActiveBrushStyling();
    });
  }

  if (nonDiabSwatch) {
    nonDiabSwatch.addEventListener("click", (event) => {
      event.stopPropagation();
      pcLegendFilter =
        pcLegendFilter === "non-diabetic" ? null : "non-diabetic";

      updateParallelCoords(pcCurrentData);
      refreshLegendStyles();
      hidePcDetailPanel();

      // Clear PCP-driven highlights when toggling legend
      if (typeof highlightMapStateFromPCP === "function") {
        highlightMapStateFromPCP(null);
      }
      if (typeof highlightSmokingFromPCP === "function") {
        highlightSmokingFromPCP(null);
      }
      if (typeof highlightGenderFromPCP === "function") {
        highlightGenderFromPCP(null);
      }

      // Re-apply brush styling if any brush exists
      applyActiveBrushStyling();
    });
  }

  // ---- Click empty space on the PCP card to clear BOTH legend and brushes ----
  const parallelContainer = document.getElementById("parallel-container");
  if (parallelContainer) {
    parallelContainer.addEventListener("click", (event) => {
      const target = event.target;

      // Ignore clicks that originated inside the legend
      if (target.closest(".pc-legend")) return;

      const resetAllowed =
        target.id === "parallel-container" ||
        target.id === "parallel" ||
        target.classList.contains("panel-caption");

      if (!resetAllowed) return;

      // 1) Clear legend filter
      pcLegendFilter = null;
      refreshLegendStyles();

      // 2) Clear all brushes
      axisBrushes.forEach(({ g, brush }) => {
        g.select(".brush").call(brush.move, null);
      });

      // 3) Clear brush tracking
      pcDimensions.forEach((d) => (pcActiveBrushSelections[d.key] = null));
      pcBrushActive = false;

      // 4) Redraw full set for PCP
      updateParallelCoords(pcCurrentData);

      // 5) Hide comparison panel, if open
      hidePcDetailPanel();

      // 6) Clear PCP-driven highlights in other charts
      if (typeof highlightMapStateFromPCP === "function") {
        highlightMapStateFromPCP(null);
      }
      if (typeof highlightSmokingFromPCP === "function") {
        highlightSmokingFromPCP(null);
      }
      if (typeof highlightGenderFromPCP === "function") {
        highlightGenderFromPCP(null);
      }
    });
  }

  // set initial styles
  refreshLegendStyles();
}

function updateParallelCoords(data) {
  if (!pcSvg) return;

  pcCurrentData = data;

  const maxLines = 20000;

  // Apply legend filter (PCP-only)
  let working = data;
  if (pcLegendFilter === "diabetic") {
    working = data.filter((d) => d.diabetes === 1);
  } else if (pcLegendFilter === "non-diabetic") {
    working = data.filter((d) => d.diabetes === 0);
  }

  let sampled =
    working.length > maxLines ? working.slice(0, maxLines) : working.slice();

  // Sort so non-diabetic are drawn first, diabetic last (red on top)
  sampled.sort((a, b) => {
    const aVal = a.diabetes || 0;
    const bVal = b.diabetes || 0;
    return aVal - bVal;
  });

  // ---- Dynamic base style depending on how many lines are shown ----
  const n = sampled.length;
  if (n > 12000) {
    pcBaseOpacity = 0.03;
    pcBaseStrokeWidth = 0.3;
  } else if (n > 6000) {
    pcBaseOpacity = 0.05;
    pcBaseStrokeWidth = 0.4;
  } else if (n > 3000) {
    pcBaseOpacity = 0.08;
    pcBaseStrokeWidth = 0.5;
  } else if (n > 1000) {
    pcBaseOpacity = 0.12;
    pcBaseStrokeWidth = 0.7;
  } else {
    pcBaseOpacity = 0.2;
    pcBaseStrokeWidth = 1.0;
  }

  // Clear existing lines so DOM order follows our sorted data
  pcLinesG.selectAll(".pc-line").remove();

  const lines = pcLinesG
    .selectAll(".pc-line")
    .data(sampled, (d, i) => d.__pc_id || (d.__pc_id = i + Math.random()));

  function formatVal(v, decimals = 1) {
    if (v == null || isNaN(v)) return "NA";
    const num = +v;
    return num.toFixed(decimals);
  }

  function buildComparisonPanel(event, d) {
    const panel = ensurePcDetailPanel();

    const diabs = pcCurrentData.filter((r) => r.diabetes === 1);
    const nondiabs = pcCurrentData.filter((r) => r.diabetes === 0);

    const metricDefs = [
      { key: "age", label: "Age", decimals: 0, unit: "yrs" },
      { key: "bmi", label: "BMI", decimals: 1, unit: "" },
      { key: "hbA1c_level", label: "HbA1c", decimals: 2, unit: "" },
      {
        key: "blood_glucose_level",
        label: "Glucose",
        decimals: 0,
        unit: "mg/dL"
      }
    ];

    const means = { diabetic: {}, non: {} };

    metricDefs.forEach((m) => {
      means.diabetic[m.key] = diabs.length
        ? d3.mean(diabs, (r) => +r[m.key])
        : null;
      means.non[m.key] = nondiabs.length
        ? d3.mean(nondiabs, (r) => +r[m.key])
        : null;
    });

    const isDiab = d.diabetes === 1;
    const baseGroup = isDiab ? "diabetic" : "non";
    const baseLabel = isDiab ? "diabetic" : "non-diabetic";

    const metricRows = metricDefs
      .map((m) => {
        const val = d[m.key];
        const valStr = formatVal(val, m.decimals);
        const ref = means[baseGroup][m.key];
        const refStr = formatVal(ref, m.decimals);
        const unit = m.unit ? ` ${m.unit}` : "";

        if (m.key === "age") {
          return `
            <div class="pc-detail-metric-row">
              <div class="pc-detail-metric-name">${m.label}</div>
              <div class="pc-detail-metric-values">
                <span class="pc-detail-value">${valStr}${unit}</span>
                <span class="pc-detail-avg"> | ${baseLabel} avg ${refStr}${unit}</span>
              </div>
            </div>
          `;
        }

        let badgeText = "≈ group avg";
        let badgeClass = "neutral";

        if (
          ref != null &&
          !isNaN(ref) &&
          val != null &&
          !isNaN(val) &&
          ref !== 0
        ) {
          const pct = ((val - ref) / ref) * 100;
          const absPct = Math.abs(pct).toFixed(0);

          if (pct > 5) {
            badgeText = `↑ ${absPct}%`;
            badgeClass = "up";
          } else if (pct < -5) {
            badgeText = `↓ ${absPct}%`;
            badgeClass = "down";
          } else {
            badgeText = "≈ group avg";
            badgeClass = "neutral";
          }
        }

        return `
          <div class="pc-detail-metric-row">
            <div class="pc-detail-metric-name">${m.label}</div>
            <div class="pc-detail-metric-values">
              <span class="pc-detail-value">${valStr}${unit}</span>
              <span class="pc-detail-avg"> | ${baseLabel} avg ${refStr}${unit}</span>
              <span class="pc-detail-badge ${badgeClass}">${badgeText}</span>
            </div>
          </div>
        `;
      })
      .join("");

    const diagLabel = isDiab ? "Diabetic" : "Non-diabetic";

    panel.innerHTML = `
      <div class="pc-detail-header">
        <div>
          <div class="pc-detail-title">${d.gender || "Patient"}, age ${
      d.age ?? "NA"
    }</div>
          <div class="pc-detail-subtitle">
            ${diagLabel}${d.location ? ` • State: ${d.location}` : ""}
          </div>
        </div>
        <button type="button" class="pc-detail-close" aria-label="Close">×</button>
      </div>
      <div class="pc-detail-body">
        ${metricRows}
      </div>
    `;

    const closeBtn = panel.querySelector(".pc-detail-close");
    if (closeBtn) {
      closeBtn.onclick = () => {
        hidePcDetailPanel();

        if (typeof highlightMapStateFromPCP === "function") {
          highlightMapStateFromPCP(null);
        }
        if (typeof highlightSmokingFromPCP === "function") {
          highlightSmokingFromPCP(null);
        }
        if (typeof highlightGenderFromPCP === "function") {
          highlightGenderFromPCP(null);
        }
      };
    }

    const pageX = event.pageX;
    const pageY = event.pageY;

    panel.style.left = pageX + 12 + "px";
    panel.style.top = pageY + 12 + "px";
    panel.style.display = "block";
  }

  lines
    .enter()
    .append("path")
    .attr("class", "pc-line")
    .attr("stroke", (d) => (d.diabetes === 1 ? "#e74c3c" : "#2ecc71"))
    .attr("fill", "none")
    .attr("opacity", pcBaseOpacity)
    .attr("stroke-width", pcBaseStrokeWidth)

    // ---- UPDATED HOVER: disabled while brush is active ----
    .on("mouseover", function () {
      if (pcBrushActive) return;

      const thisNode = this;

      pcLinesG
        .selectAll(".pc-line")
        .filter(function () {
          return this !== thisNode;
        })
        .attr("opacity", pcFadeOpacity)
        .attr("stroke-width", pcFadeStrokeWidth);

      d3.select(this)
        .attr("opacity", pcHoverOpacity)
        .attr("stroke-width", pcHoverStrokeWidth)
        .raise();
    })
    .on("mouseout", function () {
      if (pcBrushActive) return;

      pcLinesG
        .selectAll(".pc-line")
        .attr("opacity", pcBaseOpacity)
        .attr("stroke-width", pcBaseStrokeWidth);
    })

    .on("click", function (event, d) {
      event.stopPropagation();
      pcConfig?.hideTooltip && pcConfig.hideTooltip();

      if (typeof highlightMapStateFromPCP === "function") {
        highlightMapStateFromPCP(d.location || null);
      }
      if (typeof highlightSmokingFromPCP === "function") {
        highlightSmokingFromPCP(d.smoking_history || null);
      }
      if (typeof highlightGenderFromPCP === "function") {
        highlightGenderFromPCP(d.gender || null);
      }

      buildComparisonPanel(event, d);
    })
    .attr("d", (d) => pcPathForRow(d));

  // ---- NEW: If a brush is active, re-apply its styling after redraw ----
  applyActiveBrushStyling();
}

function pcPathForRow(d) {
  const points = pcDimensions.map((dim) => {
    const v = +d[dim.key];
    return [pcXScale(dim.key), pcYScales[dim.key](v)];
  });
  return pcLine(points);
}
