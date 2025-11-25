// js/raceRadial.js

let raceRadialSvg, raceRadialConfig, raceRadialColumns;

// Geometry parameters (computed once based on SVG size & number of races)
let raceMaxR, raceRingThickness, raceRingGap, raceBaseInnerRadius;

/**
 * Radial bar chart: one concentric arc per race, like the reference example.
 * All arcs start from a common baseline angle and sweep ~270°.
 * Longer bars are on the outer rings; shorter bars are near the center.
 * Labels are positioned to the left of each bar, horizontally aligned.
 */
function createRaceRadial(data, raceColumns, config) {
  raceRadialConfig = config;
  raceRadialColumns = raceColumns;

  const svg = d3.select("#raceRadial");
  const width = svg.node().clientWidth || 260;
  const height = svg.node().clientHeight || 260;

  // Extra padding so nothing touches the edges
  const padding = 20;

  // Max radius that comfortably fits in the panel
  raceMaxR = Math.min(width, height) / 2 - padding;
  raceMaxR *= 0.8; // shrink a bit more to avoid cropping

  const n = raceColumns.length;

  // ---- Geometry for concentric rings ----
  raceRingGap = 4;

  // LARGE inner radius so there is a big central hole
  raceBaseInnerRadius = raceMaxR * 0.45;

  raceRingThickness =
    (raceMaxR - raceBaseInnerRadius - (n - 1) * raceRingGap) / n;
  if (raceRingThickness < 6) raceRingThickness = 6;

  // Center in the middle of the panel
  const cx = width / 2;
  const cy = height / 2;

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  raceRadialSvg = svg
    .append("g")
    .attr("transform", `translate(${cx},${cy})`);

  updateRaceRadial(data);
}

function updateRaceRadial(data) {
  if (!raceRadialSvg) return;

  // --- Aggregate stats per race ---
  // Quantize rate to 0.1% so arcs and labels use the same value.
  let stats = raceRadialColumns.map((rc) => {
    const rows = data.filter((d) => +d[rc.key] === 1);
    const total = rows.length;
    const diabetics = rows.filter((d) => d.diabetes === 1).length;

    const rawRate = total ? diabetics / total : 0; // e.g. 0.08672
    const pct1 = Number((rawRate * 100).toFixed(1)); // e.g. 8.7
    const rate = pct1 / 100; // 0.087 (quantized)

    return {
      ...rc,
      total,
      diabetics,
      rate, // quantized rate used for geometry
      pct1  // one-decimal percent used for labels
    };
  });

  if (!stats.length) return;

  // number of rings
  const n = stats.length;

  // Sort races by prevalence so longest (max) goes on the outer ring
  stats.sort((a, b) => b.rate - a.rate);

  let [minRate, maxRate] = d3.extent(stats, (d) => d.rate);
  if (maxRate == null || maxRate === 0) {
    maxRate = 0.0001;
    minRate = 0;
  }
  if (minRate === maxRate) {
    // All equal – still give some span
    minRate = 0;
  }

  // Common baseline: start at the rightmost direction (3 o'clock)
  const baselineStart = 0;
  const totalSpan = Math.PI * 1.5; // 270 degrees, sweeping clockwise

  // Minimum visible arc + amplified variation
  const baseAngle = totalSpan / 6; // baseline for the smallest bar
  const angleScale = d3
    .scaleLinear()
    .domain([minRate, maxRate])
    .range([0, totalSpan - baseAngle]);

  const colorScale = d3.scaleOrdinal(d3.schemeSet2);
  const arcGen = d3.arc();

  // --- Background arcs (full span = maxRate) ---
  const bgArcs = raceRadialSvg
    .selectAll("path.radial-arc-bg")
    .data(stats, (d) => d.key);

  bgArcs
    .join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "radial-arc-bg")
          .attr("fill", "#f0f0f0")
          .attr("stroke", "#ddd")
          .attr("stroke-width", 0.5),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("d", (d, i) => {
      // i=0 (highest rate) on the outermost ring
      const ringIndex = i;
      const inner =
        raceBaseInnerRadius +
        (n - 1 - ringIndex) * (raceRingThickness + raceRingGap);
      const outer = inner + raceRingThickness;

      const startAngle = baselineStart;
      const endAngle = baselineStart + baseAngle + angleScale(maxRate);

      return arcGen({
        innerRadius: inner,
        outerRadius: outer,
        startAngle,
        endAngle
      });
    });

  // --- Data arcs (actual prevalence) ---
  const arcs = raceRadialSvg
    .selectAll("path.radial-arc")
    .data(stats, (d) => d.key);

  arcs
    .join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "radial-arc")
          .attr("stroke", "#444")
          .attr("stroke-width", 0.7)
          .attr("cursor", "pointer")
          .on("click", (event, d) => {
            raceRadialConfig?.onRaceClick &&
              raceRadialConfig.onRaceClick(d.key);
          })
          .on("mousemove", (event, d) => {
            const html = `
              <strong>${d.label}</strong><br/>
              Diabetes prevalence: ${d.pct1.toFixed(1)}%<br/>
              Diabetic: ${d.diabetics} / Total: ${d.total}
            `;
            raceRadialConfig?.showTooltip &&
              raceRadialConfig.showTooltip(html, event);
          })
          .on("mouseout", () => {
            raceRadialConfig?.hideTooltip &&
              raceRadialConfig.hideTooltip();
          }),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("fill", (d) => colorScale(d.key))
    .attr("d", (d, i) => {
      const ringIndex = i;
      const inner =
        raceBaseInnerRadius +
        (n - 1 - ringIndex) * (raceRingThickness + raceRingGap);
      const outer = inner + raceRingThickness;

      const startAngle = baselineStart;
      const endAngle = baselineStart + baseAngle + angleScale(d.rate);

      return arcGen({
        innerRadius: inner,
        outerRadius: outer,
        startAngle,
        endAngle
      });
    });

  // --- Labels: positioned to the left of each ring, horizontally aligned ---
  const labels = raceRadialSvg
    .selectAll("text.race-label")
    .data(stats, (d) => d.key);

  labels
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "race-label")
          .attr("text-anchor", "end")
          .attr("font-size", 9)
          .attr("alignment-baseline", "middle"),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("x", -raceMaxR + 27) 
    .attr("y", (d, i) => {
      // Middle radius of each ring, projected straight up (12 o'clock)
      const ringIndex = i;
      const inner =
        raceBaseInnerRadius +
        (n - 1 - ringIndex) * (raceRingThickness + raceRingGap);
      const outer = inner + raceRingThickness;
      return -(inner + outer) / 2;
    })
    .text((d) => `${d.label} ${d.pct1.toFixed(1)}%`);
}