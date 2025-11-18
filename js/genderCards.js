// js/genderCards.js

let genderCardsConfig;
let heartSvgGroup, hyperSvgGroup;

function createGenderCards(data, config) {
  genderCardsConfig = config;

  // Select the two SVGs from the Heart Disease & Hypertension card
  const heartSvg = d3.select("#heartGenderSvg");
  const hyperSvg = d3.select("#hyperGenderSvg");

  const width = heartSvg.node().clientWidth || 220;
  const height = heartSvg.node().clientHeight || 140;

  // Use a fixed viewBox so it scales nicely with the card
  heartSvg.attr("viewBox", `0 0 ${width} ${height}`);
  hyperSvg.attr("viewBox", `0 0 ${width} ${height}`);

  // A little padding inside each chart
  const margin = { top: 20, right: 10, bottom: 30, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  heartSvgGroup = heartSvg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  hyperSvgGroup = hyperSvg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Store basic layout so we can reuse in update
  genderCardsConfig._layout = { width, height, innerW, innerH, margin };

  updateGenderCards(data);
}

function updateGenderCards(data) {
  if (!heartSvgGroup || !hyperSvgGroup || !genderCardsConfig?._layout) return;

  const { innerW, innerH } = genderCardsConfig._layout;

  // Aggregate by gender
  const byGender = d3.rollup(
    data,
    (rows) => {
      const total = rows.length;
      const heartCount = rows.filter((d) => d.heart_disease === 1).length;
      const hyperCount = rows.filter((d) => d.hypertension === 1).length;

      return {
        total,
        heartCount,
        hyperCount,
        heartRate: total ? heartCount / total : 0,
        hyperRate: total ? hyperCount / total : 0
      };
    },
    (d) => d.gender
  );

  // Keep only Male / Female (drop "Other" and anything else)
  const genders = Array.from(byGender.keys())
    .filter((g) => g === "Male" || g === "Female")
    .sort();

  const heartStats = genders.map((g) => ({
    gender: g,
    ...byGender.get(g)
  }));
  const hyperStats = heartStats; // same objects, different field when reading

  const maxHeart = d3.max(heartStats, (d) => d.heartRate) || 0.01;
  const maxHyper = d3.max(hyperStats, (d) => d.hyperRate) || 0.01;
  const maxRate = Math.max(maxHeart, maxHyper);

  const x = d3
    .scaleBand()
    .domain(genders)
    .range([0, innerW])
    .padding(0.3);

  const y = d3
    .scaleLinear()
    .domain([0, maxRate])
    .nice()
    .range([innerH, 0]);

  const color = (g) =>
    g === "Male" ? "#4C78A8" : g === "Female" ? "#F28EBC" : "#999";

  // ----- Heart Disease chart -----
  heartSvgGroup.selectAll("*").remove(); // clear before redraw

  heartSvgGroup
    .append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", 9);

  heartSvgGroup
    .append("g")
    .call(
      d3
        .axisLeft(y)
        .ticks(4)
        .tickFormat((d) => `${(d * 100).toFixed(0)}%`)
    )
    .selectAll("text")
    .attr("font-size", 9);

  const heartBars = heartSvgGroup
    .selectAll("rect.heart-bar")
    .data(heartStats, (d) => d.gender);

  heartBars
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("class", "heart-bar")
          .attr("x", (d) => x(d.gender))
          .attr("width", x.bandwidth())
          .attr("y", innerH) // animate from bottom
          .attr("height", 0)
          .attr("fill", (d) => color(d.gender))
          .attr("cursor", "pointer")
          .on("click", (event, d) => {
            genderCardsConfig?.onGenderClick &&
              genderCardsConfig.onGenderClick(d.gender);
          })
          .on("mousemove", (event, d) => {
            const html = `
              <strong>${d.gender}</strong><br/>
              Heart disease: ${(d.heartRate * 100).toFixed(1)}%<br/>
              Cases: ${d.heartCount} / ${d.total}
            `;
            genderCardsConfig?.showTooltip &&
              genderCardsConfig.showTooltip(html, event);
          })
          .on("mouseout", () => {
            genderCardsConfig?.hideTooltip &&
              genderCardsConfig.hideTooltip();
          }),
      (update) => update,
      (exit) => exit.remove()
    )
    .transition()
    .duration(600)
    .attr("y", (d) => y(d.heartRate))
    .attr("height", (d) => innerH - y(d.heartRate));

  // Labels above bars
  heartSvgGroup
    .selectAll("text.heart-label")
    .data(heartStats, (d) => d.gender)
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "heart-label")
          .attr("text-anchor", "middle")
          .attr("font-size", 9),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("x", (d) => x(d.gender) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.heartRate) - 4)
    .text((d) => `${(d.heartRate * 100).toFixed(1)}%`);

  // ----- Hypertension chart -----
  hyperSvgGroup.selectAll("*").remove();

  hyperSvgGroup
    .append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", 9);

  hyperSvgGroup
    .append("g")
    .call(
      d3
        .axisLeft(y)
        .ticks(4)
        .tickFormat((d) => `${(d * 100).toFixed(0)}%`)
    )
    .selectAll("text")
    .attr("font-size", 9);

  const hyperBars = hyperSvgGroup
    .selectAll("rect.hyper-bar")
    .data(hyperStats, (d) => d.gender);

  hyperBars
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("class", "hyper-bar")
          .attr("x", (d) => x(d.gender))
          .attr("width", x.bandwidth())
          .attr("y", innerH)
          .attr("height", 0)
          .attr("fill", (d) => color(d.gender))
          .attr("cursor", "pointer")
          .on("click", (event, d) => {
            genderCardsConfig?.onGenderClick &&
              genderCardsConfig.onGenderClick(d.gender);
          })
          .on("mousemove", (event, d) => {
            const html = `
              <strong>${d.gender}</strong><br/>
              Hypertension: ${(d.hyperRate * 100).toFixed(1)}%<br/>
              Cases: ${d.hyperCount} / ${d.total}
            `;
            genderCardsConfig?.showTooltip &&
              genderCardsConfig.showTooltip(html, event);
          })
          .on("mouseout", () => {
            genderCardsConfig?.hideTooltip &&
              genderCardsConfig.hideTooltip();
          }),
      (update) => update,
      (exit) => exit.remove()
    )
    .transition()
    .duration(600)
    .attr("y", (d) => y(d.hyperRate))
    .attr("height", (d) => innerH - y(d.hyperRate));

  hyperSvgGroup
    .selectAll("text.hyper-label")
    .data(hyperStats, (d) => d.gender)
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "hyper-label")
          .attr("text-anchor", "middle")
          .attr("font-size", 9),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("x", (d) => x(d.gender) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.hyperRate) - 4)
    .text((d) => `${(d.hyperRate * 100).toFixed(1)}%`);
}
