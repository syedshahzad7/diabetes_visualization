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

  smokingRadarSvg = svg
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  // Use most of the panel (slight margin)
  radarRadius = Math.min(width, height) / 2 - 5;

  radarAngleScale = d3
    .scaleBand()
    .domain(smokingCats)
    .range([0, 2 * Math.PI]);

  updateSmokingRadar(data);
}

function updateSmokingRadar(data) {
  if (!smokingRadarSvg) return;

  const diabetics = data.filter((d) => d.diabetes === 1);
  const nonDiabetics = data.filter((d) => d.diabetes === 0);

  const totalD = diabetics.length || 1;
  const totalN = nonDiabetics.length || 1;

  const redVals = smokingCats.map((c) => {
    const n = diabetics.filter((d) => d.smoking_history === c).length;
    return n / totalD;
  });

  const greenVals = smokingCats.map((c) => {
    const n = nonDiabetics.filter((d) => d.smoking_history === c).length;
    return n / totalN;
  });

  const maxVal = Math.max(0.001, d3.max([...redVals, ...greenVals]));

  radarRadiusScale = d3
    .scaleLinear()
    .domain([0, maxVal])
    .range([0, radarRadius]);

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

  // Axes
  const axes = smokingRadarSvg
    .selectAll("g.radar-axis")
    .data(smokingCats, (d) => d);

  const axesEnter = axes
    .join(
      (enter) =>
        enter
          .append("g")
          .attr("class", "radar-axis")
          .on("click", (event, category) => {
            smokingRadarConfig?.onAxisClick &&
              smokingRadarConfig.onAxisClick(category);
          }),
      (update) => update,
      (exit) => exit.remove()
    );

  axesEnter.each(function (category) {
    const angle =
      radarAngleScale(category) + radarAngleScale.bandwidth() / 2;

    const xAxis = Math.cos(angle - Math.PI / 2) * radarRadius;
    const yAxis = Math.sin(angle - Math.PI / 2) * radarRadius;

    const g = d3.select(this);

    g.selectAll("line.radar-axis-line")
      .data([category])
      .join("line")
      .attr("class", "radar-axis-line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", xAxis)
      .attr("y2", yAxis);

    // Slightly pull labels inward (1.08) so top ones aren't clipped
    const labelRadius = radarRadius * 1.08;
    const xLabel = Math.cos(angle - Math.PI / 2) * labelRadius;
    const yLabel = Math.sin(angle - Math.PI / 2) * labelRadius;

    const labelText = g.selectAll("text.radar-category-label")
      .data([category])
      .join("text")
      .attr("class", "radar-category-label")
      .attr("x", xLabel)
      .attr("y", yLabel)
      .attr("alignment-baseline", "middle")
      .text(category);

    // Special adjustment for 'never' label to move it left
    if (category === "never") {
      labelText.attr("text-anchor", "end").attr("dx", -8);
    } else {
      labelText.attr("text-anchor", "middle");
    }
  });

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

  const redPoints = makePoints(redVals);
  const greenPoints = makePoints(greenVals);

  const polygons = smokingRadarSvg
    .selectAll("path.radar-poly")
    .data(
      [
        { id: "diab", color: "#e74c3c", points: redPoints },
        { id: "nod", color: "#2ecc71", points: greenPoints }
      ],
      (d) => d.id
    );

  polygons
    .join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "radar-poly")
          .attr("fill-opacity", 0.2)
          .attr("stroke-width", 1.2),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("fill", (d) => d.color)
    .attr("stroke", (d) => d.color)
    .attr("d", (d) => lineRadial(d.points));

  // Small circles at vertices
  const vertexGroups = smokingRadarSvg
    .selectAll("g.radar-vertices")
    .data(
      [
        { id: "diab", color: "#e74c3c", points: redPoints, label: "Diabetic" },
        {
          id: "nod",
          color: "#2ecc71",
          points: greenPoints,
          label: "Non-diabetic"
        }
      ],
      (d) => d.id
    );

  vertexGroups
    .join(
      (enter) => enter.append("g").attr("class", "radar-vertices"),
      (update) => update
    )
    .each(function (group) {
      const circles = d3
        .select(this)
        .selectAll("circle")
        .data(group.points, (p) => group.id + "-" + p.category);

      circles
        .join(
          (enter) =>
            enter
              .append("circle")
              .attr("r", 2.8)
              .attr("fill", group.color)
              .on("mousemove", (event, p) => {
                const html = `<strong>${group.label}</strong><br/>${p.category}: ${(p.value * 100).toFixed(
                  1
                )}%`;
                smokingRadarConfig?.showTooltip &&
                  smokingRadarConfig.showTooltip(html, event);
              })
              .on("mouseout", () => {
                smokingRadarConfig?.hideTooltip &&
                  smokingRadarConfig.hideTooltip();
              }),
          (update) => update,
          (exit) => exit.remove()
        )
        .attr("cx", (p) => Math.cos(p.angle - Math.PI / 2) * p.radius)
        .attr("cy", (p) => Math.sin(p.angle - Math.PI / 2) * p.radius);
    });
}