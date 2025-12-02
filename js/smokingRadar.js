// js/smokingRadar.js

let smokingRadarSvg, smokingRadarConfig, smokingCats;
let radarRadius, radarAngleScale, radarRadiusScale;

function createSmokingRadar(data, categories, config) {
  smokingRadarConfig = config;
  smokingCats = categories;

  const svg = d3.select("#smokingRadar");
  const width = svg.node().clientWidth || 260;
  const height = svg.node().clientHeight || 260;
  svg.attr("viewBox", [0, 0, width, height]);

  // Slightly shift upward to make room for caption under the chart
  smokingRadarSvg = svg
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2 - 6})`);

  // Increase padding to ensure labels don't get cropped
  radarRadius = Math.min(width, height) / 2 - 35;

  radarAngleScale = d3
    .scaleBand()
    .domain(smokingCats)
    .range([0, 2 * Math.PI]);

  // Click on empty space in the smoking card to CLEAR the smoking filter
  const container = document.getElementById("smoking-container");
  if (container && !container._smokingClearHandlerAttached) {
    container._smokingClearHandlerAttached = true;

    container.addEventListener("click", (event) => {
      const target = event.target;

      // Only treat clicks on "blank" areas or caption as reset:
      const resetAllowed =
        target.id === "smoking-container" ||
        target.id === "smokingRadar" ||
        target.classList.contains("panel-caption");

      if (!resetAllowed) return;

      if (
        typeof filters !== "undefined" &&
        filters.smoking != null &&
        typeof toggleFilter === "function"
      ) {
        // Passing the current value toggles it back to null
        toggleFilter("smoking", filters.smoking);
      }
    });
  }

  updateSmokingRadar(data);
}

function updateSmokingRadar(data) {
  if (!smokingRadarSvg) return;

  const diabetics = data.filter((d) => d.diabetes === 1);
  const nonDiabetics = data.filter((d) => d.diabetes === 0);

  const totalD = diabetics.length || 1;
  const totalN = nonDiabetics.length || 1;
  const totalAll = data.length || 1;

  const redVals = smokingCats.map((c) => {
    const n = diabetics.filter((d) => d.smoking_history === c).length;
    return n / totalD;
  });

  const greenVals = smokingCats.map((c) => {
    const n = nonDiabetics.filter((d) => d.smoking_history === c).length;
    return n / totalN;
  });

  // Combined distribution (all patients in current filtered dataset)
  const combinedVals = smokingCats.map((c) => {
    const n = data.filter((d) => d.smoking_history === c).length;
    return n / totalAll;
  });

  const maxVal = Math.max(
    0.001,
    d3.max([...redVals, ...greenVals, ...combinedVals])
  );

  radarRadiusScale = d3
    .scaleLinear()
    .domain([0, maxVal])
    .range([0, radarRadius]);

  // Current smoking-category filter (if any)
  const currentSmoking =
    typeof filters !== "undefined" ? filters.smoking : null;
  const smokingFilterActive = currentSmoking != null;

  // Background grid circles (25, 50, 75, 100% of max)
  const levels = [0.25, 0.5, 0.75, 1.0];

  const grid = smokingRadarSvg
    .selectAll("circle.radar-grid")
    .data(levels);

  grid
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "radar-grid")
          .attr("fill", "none"),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("r", (d) => radarRadiusScale(maxVal * d));

  // Axes + clickable label-buttons
  const axes = smokingRadarSvg
    .selectAll("g.radar-axis")
    .data(smokingCats, (d) => d);

  const axesMerged = axes
    .join(
      (enter) =>
        enter
          .append("g")
          .attr("class", "radar-axis")
          .on("click", (event, category) => {
            // Clicking label/axis toggles smoking filter
            event.stopPropagation();
            smokingRadarConfig?.onAxisClick &&
              smokingRadarConfig.onAxisClick(category);
          }),
      (update) => update,
      (exit) => exit.remove()
    );

  axesMerged.each(function (category) {
    const angle =
      radarAngleScale(category) + radarAngleScale.bandwidth() / 2;

    const xAxis = Math.cos(angle - Math.PI / 2) * radarRadius;
    const yAxis = Math.sin(angle - Math.PI / 2) * radarRadius;

    const g = d3.select(this);

    // Axis line
    g.selectAll("line.radar-axis-line")
      .data([category])
      .join("line")
      .attr("class", "radar-axis-line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", xAxis)
      .attr("y2", yAxis);

    // Label position (a bit outside the circle)
    const labelRadius = radarRadius * 1.08;
    const xLabel = Math.cos(angle - Math.PI / 2) * labelRadius;
    const yLabel = Math.sin(angle - Math.PI / 2) * labelRadius;

    const labelText = g
      .selectAll("text.radar-category-label")
      .data([category])
      .join("text")
      .attr("class", "radar-category-label")
      .attr("x", xLabel)
      .attr("y", yLabel)
      .attr("alignment-baseline", "middle")
      .text(category);

    // Adjust positioning for specific labels to prevent overlap
    if (category === "never") {
      labelText.attr("text-anchor", "end").attr("dx", -8);
    } else if (category === "current") {
      // Move 'current' label to the right
      labelText.attr("text-anchor", "start").attr("dx", 8);
    } else {
      labelText.attr("text-anchor", "middle");
    }

    // Add/Update a rounded rect behind label as a "button"
    const bb = labelText.node().getBBox();

    g.selectAll("rect.label-pill")
      .data([category])
      .join(
        (enter) =>
          enter
            .insert("rect", "text") // insert behind the text
            .attr("class", "label-pill"),
        (update) => update
      )
      .attr("x", bb.x - 6)
      .attr("y", bb.y - 4)
      .attr("width", bb.width + 12)
      .attr("height", bb.height + 8)
      .attr("rx", 10)
      .attr("ry", 10);
  });

  // Mark active axis (for styling in CSS)
  axesMerged.classed(
    "active-smoking-axis",
    (d) => d === currentSmoking
  );

  const lineRadial = d3
    .lineRadial()
    .curve(d3.curveLinearClosed)
    .angle((d) => d.angle)
    .radius((d) => d.radius);

  function makePoints(values) {
    return smokingCats.map((cat, i) => {
      const angle =
        radarAngleScale(cat) + radarAngleScale.bandwidth() / 2;
      return {
        category: cat,
        value: values[i],
        angle,
        radius: radarRadiusScale(values[i])
      };
    });
  }

  // Decide polygons:
  //  - No smoking filter: diabetic (red) + non-diabetic (green)
  //  - Smoking filter active: single neutral dark outline
  let polygonDefs;
  if (smokingFilterActive) {
    const combinedPoints = makePoints(combinedVals);
    polygonDefs = [
      {
        id: "combined",
        color: "#111",
        points: combinedPoints,
        label: "Patients"
      }
    ];
  } else {
    const redPoints = makePoints(redVals);
    const greenPoints = makePoints(greenVals);
    polygonDefs = [
      {
        id: "diab",
        color: "#e74c3c",
        points: redPoints,
        label: "Diabetic"
      },
      {
        id: "nod",
        color: "#2ecc71",
        points: greenPoints,
        label: "Non-diabetic"
      }
    ];
  }

  const polygons = smokingRadarSvg
    .selectAll("path.radar-poly")
    .data(polygonDefs, (d) => d.id);

  polygons
    .join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "radar-poly"),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("fill", (d) => (smokingFilterActive ? "none" : d.color))
    .attr("fill-opacity", smokingFilterActive ? 0 : 0.2)
    .attr("stroke", (d) => (smokingFilterActive ? "#111" : d.color))
    .attr("stroke-width", smokingFilterActive ? 2 : 1.2)
    .attr("d", (d) => lineRadial(d.points));

  // Small circles at vertices
  const vertexGroups = smokingRadarSvg
    .selectAll("g.radar-vertices")
    .data(polygonDefs, (d) => d.id);

  vertexGroups
    .join(
      (enter) => enter.append("g").attr("class", "radar-vertices"),
      (update) => update,
      (exit) => exit.remove()
    )
    .each(function (group) {
      const circles = d3
        .select(this)
        .selectAll("circle")
        .data(group.points, (p) => group.id + "-" + p.category);

      circles
        .join(
          (enter) =>
            enter.append("circle").attr("r", 2.8),
          (update) => update,
          (exit) => exit.remove()
        )
        .attr("fill", () => (smokingFilterActive ? "#111" : group.color))
        .attr("cx", (p) => Math.cos(p.angle - Math.PI / 2) * p.radius)
        .attr("cy", (p) => Math.sin(p.angle - Math.PI / 2) * p.radius)
        .on("mousemove", (event, p) => {
          const html = `<strong>${group.label}</strong><br/>${
            p.category
          }: ${(p.value * 100).toFixed(1)}%`;
          smokingRadarConfig?.showTooltip &&
            smokingRadarConfig.showTooltip(html, event);
        })
        .on("mouseout", () => {
          smokingRadarConfig?.hideTooltip &&
            smokingRadarConfig.hideTooltip();
        });
    });
}

/**
 * Highlight a single smoking category from a PCP click.
 * Passing null clears the highlight.
 */
function highlightSmokingFromPCP(category) {
  if (!smokingRadarSvg) return;
  smokingRadarSvg
    .selectAll("g.radar-axis")
    .classed("pcp-smoking-highlight", (d) => category && d === category);
}