// js/raceRadial.js

let raceRadialSvg, raceRadialConfig, raceRadialColumns;
let raceRadiusScale;

function createRaceRadial(data, raceColumns, config) {
  raceRadialConfig = config;
  raceRadialColumns = raceColumns;

  const svg = d3.select("#raceRadial");
  const width = svg.node().clientWidth || 260;
  const height = svg.node().clientHeight || 260;
  svg.attr("viewBox", [0, 0, width, height]);

  raceRadialSvg = svg
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  updateRaceRadial(data);
}

function updateRaceRadial(data) {
  if (!raceRadialSvg) return;

  const stats = raceRadialColumns.map((rc) => {
    const rows = data.filter((d) => +d[rc.key] === 1);
    const total = rows.length;
    const diabetics = rows.filter((d) => d.diabetes === 1).length;
    const rate = total ? diabetics / total : 0;
    return { ...rc, total, diabetics, rate };
  });

  const maxRate =
    d3.max(stats, (d) => d.rate) || 0.0001;

  const innerR = 40;
  const outerR = 100;

  raceRadiusScale = d3
    .scaleLinear()
    .domain([0, maxRate])
    .range([innerR, outerR]);

  const angleScale = d3
    .scaleBand()
    .domain(stats.map((d) => d.key))
    .range([0, 2 * Math.PI])
    .padding(0.1);

  const arcs = raceRadialSvg
    .selectAll("path.radial-arc")
    .data(stats, (d) => d.key);

  arcs
    .join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "radial-arc")
          .attr("fill", (d, i) => d3.schemeSet2[i % d3.schemeSet2.length])
          .attr("stroke", "#444")
          .attr("stroke-width", 0.4)
          .on("click", (event, d) => {
            raceRadialConfig?.onRaceClick &&
              raceRadialConfig.onRaceClick(d.key);
          })
          .on("mousemove", (event, d) => {
            const html = `
              <strong>${d.label}</strong><br/>
              Diabetes prevalence: ${(d.rate * 100).toFixed(1)}%<br/>
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
    .attr("d", (d) => {
      const a0 = angleScale(d.key);
      const a1 = a0 + angleScale.bandwidth();
      const r0 = innerR;
      const r1 = raceRadiusScale(d.rate);

      return d3.arc()({
        innerRadius: r0,
        outerRadius: r1,
        startAngle: a0,
        endAngle: a1
      });
    });

  // Labels
  const labels = raceRadialSvg
    .selectAll("text.race-label")
    .data(stats, (d) => d.key);

  labels
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "race-label")
          .attr("text-anchor", "middle")
          .attr("font-size", 9),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("transform", (d) => {
      const angle =
        angleScale(d.key) + angleScale.bandwidth() / 2;
      const r = outerR + 14;
      const x = Math.cos(angle - Math.PI / 2) * r;
      const y = Math.sin(angle - Math.PI / 2) * r;
      return `translate(${x},${y})`;
    })
    .text(
      (d) =>
        `${d.label} ${(d.rate * 100).toFixed(1)}%`
    );
}
