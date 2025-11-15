// js/genderCards.js

let genderCardsConfig;
let heartSvg, hyperSvg;

function createGenderCards(data, config) {
  genderCardsConfig = config;

  heartSvg = d3.select("#heartByGender");
  hyperSvg = d3.select("#hyperByGender");

  const heartWidth = heartSvg.node().clientWidth || 260;
  const heartHeight = heartSvg.node().clientHeight || 90;
  heartSvg.attr("viewBox", [0, 0, heartWidth, heartHeight]);

  const hyperWidth = hyperSvg.node().clientWidth || 260;
  const hyperHeight = hyperSvg.node().clientHeight || 90;
  hyperSvg.attr("viewBox", [0, 0, hyperWidth, hyperHeight]);

  // add group for each
  heartSvg.append("g").attr("class", "bars");
  hyperSvg.append("g").attr("class", "bars");

  updateGenderCards(data);
}

function updateGenderCards(data) {
  if (!heartSvg || !hyperSvg) return;

  const genders = ["Male", "Female"];

  function computeRates(metric) {
    return genders.map((g) => {
      const rows = data.filter((d) => d.gender === g);
      const total = rows.length || 1;
      const positives = rows.filter((d) => d[metric] === 1).length;
      const rate = positives / total;
      return { gender: g, total, positives, rate };
    });
  }

  const heartStats = computeRates("heart_disease");
  const hyperStats = computeRates("hypertension");

  drawCardBars(heartSvg, heartStats, "Heart disease", genderCardsConfig);
  drawCardBars(hyperSvg, hyperStats, "Hypertension", genderCardsConfig);
}

function drawCardBars(svg, stats, label, config) {
  const width = svg.viewBox.baseVal.width;
  const height = svg.viewBox.baseVal.height;

  const margin = { top: 4, right: 8, bottom: 12, left: 8 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const x = d3
    .scaleBand()
    .domain(stats.map((d) => d.gender))
    .range([0, innerW])
    .padding(0.35);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(stats, (d) => d.rate) || 0.01])
    .nice()
    .range([innerH, 0]);

  const g = svg.select("g.bars").attr(
    "transform",
    `translate(${margin.left},${margin.top})`
  );

  const bars = g
    .selectAll("rect.gender-bar")
    .data(stats, (d) => d.gender);

  bars
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("class", (d) =>
            "gender-bar " +
            (d.gender === "Male" ? "male" : "female")
          )
          .attr("x", (d) => x(d.gender))
          .attr("width", x.bandwidth())
          .on("click", (event, d) => {
            config?.onGenderClick && config.onGenderClick(d.gender);
          })
          .on("mousemove", (event, d) => {
            const html = `<strong>${label}</strong><br/>${d.gender}: ${(d.rate * 100).toFixed(
              1
            )}%<br/>${d.positives} / ${d.total}`;
            config?.showTooltip &&
              config.showTooltip(html, event);
          })
          .on("mouseout", () => {
            config?.hideTooltip && config.hideTooltip();
          }),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("y", (d) => y(d.rate))
    .attr("height", (d) => innerH - y(d.rate));

  // % labels above bars
  const labels = g
    .selectAll("text.bar-label")
    .data(stats, (d) => d.gender);

  labels
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "bar-label")
          .attr("text-anchor", "middle")
          .attr("font-size", 9),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("x", (d) => x(d.gender) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.rate) - 2)
    .text((d) => (d.rate * 100).toFixed(1) + "%");
}
