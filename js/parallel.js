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
      const allLines = pcLinesG.selectAll(".pc-line");
      if (!selection) {
        // reset to base opacity when brush cleared
        allLines.attr("opacity", 0.05);
        return;
      }
      const [y0, y1] = selection;
      const dimKey = dim.key;
      allLines.each(function (d) {
        const val = +d[dimKey];
        const y = pcYScales[dimKey](val);
        const highlight = y >= y0 && y <= y1;
        // Stronger contrast: bright for selected, ultra-faint for others
        d3.select(this).attr("opacity", highlight ? 0.7 : 0.003);
      });
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
      // don’t let this bubble to panel click handler
      event.stopPropagation();
      pcLegendFilter =
        pcLegendFilter === "diabetic" ? null : "diabetic";
      updateParallelCoords(pcCurrentData);
      refreshLegendStyles();
    });
  }

  if (nonDiabSwatch) {
    nonDiabSwatch.addEventListener("click", (event) => {
      event.stopPropagation();
      pcLegendFilter =
        pcLegendFilter === "non-diabetic" ? null : "non-diabetic";
      updateParallelCoords(pcCurrentData);
      refreshLegendStyles();
    });
  }

  // ---- Click empty space on the PCP card to clear BOTH legend and brushes ----
  const parallelContainer = document.getElementById("parallel-container");
  if (parallelContainer) {
    parallelContainer.addEventListener("click", (event) => {
      const target = event.target;

      // Ignore clicks that originated inside the legend
      if (target.closest(".pc-legend")) return;

      // Only reset when clicking "blank-ish" areas:
      //  - the panel background
      //  - the SVG background (not a line/axis)
      //  - the caption area
      const resetAllowed =
        target.id === "parallel-container" ||
        target.id === "parallel" ||
        target.classList.contains("panel-caption");

      if (!resetAllowed) return;

      // 1) Clear legend filter
      pcLegendFilter = null;
      refreshLegendStyles();

      // 2) Clear all brushes (this also resets opacities via brush 'end' handler)
      axisBrushes.forEach(({ g, brush }) => {
        g.select(".brush").call(brush.move, null);
      });

      // 3) Redraw full set for PCP
      updateParallelCoords(pcCurrentData);
    });
  }

  // set initial styles
  refreshLegendStyles();
}

function updateParallelCoords(data) {
  if (!pcSvg) return;

  pcCurrentData = data;

  const maxLines = 20000; // you already sample in main.js; this is a secondary cap

  // Apply legend filter (PCP-only)
  let working = data;
  if (pcLegendFilter === "diabetic") {
    working = data.filter((d) => d.diabetes === 1);
  } else if (pcLegendFilter === "non-diabetic") {
    working = data.filter((d) => d.diabetes === 0);
  }

  // Make a shallow copy so we can sort without mutating original
  let sampled =
    working.length > maxLines ? working.slice(0, maxLines) : working.slice();

  // Sort so non-diabetic (0) are first, diabetic (1) last.
  // Since later DOM elements are drawn on top, this makes red lines sit above green ones.
  sampled.sort((a, b) => {
    const aVal = a.diabetes || 0;
    const bVal = b.diabetes || 0;
    return aVal - bVal;
  });

  // Clear existing lines so DOM order follows our sorted data
  pcLinesG.selectAll(".pc-line").remove();

  const lines = pcLinesG
    .selectAll(".pc-line")
    .data(sampled, (d, i) => d.__pc_id || (d.__pc_id = i + Math.random()));

  // Only an enter selection is needed because we removed old paths
  lines
    .enter()
    .append("path")
    .attr("class", "pc-line")
    .attr("stroke", (d) => (d.diabetes === 1 ? "#e74c3c" : "#2ecc71"))
    .attr("fill", "none")
    .attr("opacity", 0.05)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 0.7).raise();
      if (pcConfig?.showTooltip) {
        const html = `
          <strong>${d.gender}, age ${d.age}</strong><br/>
          State: ${d.location}<br/>
          Diabetes: ${d.diabetes === 1 ? "Yes" : "No"}<br/>
          BMI: ${d.bmi}<br/>
          HbA1c: ${d.hbA1c_level}<br/>
          Glucose: ${d.blood_glucose_level}
        `;
        pcConfig.showTooltip(html, event);
      }
    })
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.05);
      pcConfig?.hideTooltip && pcConfig.hideTooltip();
    })
    .attr("d", (d) => pcPathForRow(d));
}

function pcPathForRow(d) {
  const points = pcDimensions.map((dim) => {
    const v = +d[dim.key];
    return [pcXScale(dim.key), pcYScales[dim.key](v)];
  });
  return pcLine(points);
}
