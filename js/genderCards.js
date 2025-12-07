// js/genderCards.js

let genderCardsConfig;
let heartSvgGroup, hyperSvgGroup;

// Cache last known stats for each gender so we can keep context bars visible
// even when the global gender filter reduces the dataset to one gender.
let lastGenderStatsCache = new Map(); // key: "Male"/"Female" -> stats object

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

  // Aggregate by gender from CURRENT incoming data (which may be filtered)
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

  // We ALWAYS want both bars present for context
  const genders = ["Female", "Male"];

  // If both genders exist in this incoming dataset, refresh cache
  const hasFemale = byGender.has("Female");
  const hasMale = byGender.has("Male");

  if (hasFemale && hasMale) {
    genders.forEach((g) => {
      const s = byGender.get(g);
      if (s) lastGenderStatsCache.set(g, { gender: g, ...s });
    });
  } else {
    // If only one gender is present, still update cache for that one
    genders.forEach((g) => {
      const s = byGender.get(g);
      if (s) lastGenderStatsCache.set(g, { gender: g, ...s });
    });
  }

  // Build display stats:
  // use current stats when available; otherwise fallback to cached stats;
  // otherwise show a graceful zero object.
  function getStat(g) {
    const cur = byGender.get(g);
    if (cur) return { gender: g, ...cur };

    const cached = lastGenderStatsCache.get(g);
    if (cached) return cached;

    return {
      gender: g,
      total: 0,
      heartCount: 0,
      hyperCount: 0,
      heartRate: 0,
      hyperRate: 0
    };
  }

  const heartStats = genders.map(getStat);
  const hyperStats = heartStats;

  const maxHeart = d3.max(heartStats, (d) => d.heartRate) || 0.01;
  const maxHyper = d3.max(hyperStats, (d) => d.hyperRate) || 0.01;
  const maxRate = Math.max(maxHeart, maxHyper) || 0.01;

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

  // Read current active gender filter (if any) from global filters
  const activeGender =
    typeof filters !== "undefined" ? filters.gender : null;

  // ----- Heart Disease chart -----
  heartSvgGroup.selectAll("*").remove();

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
          .attr("y", innerH)
          .attr("height", 0)
          .attr("fill", (d) => color(d.gender))
          .attr("cursor", "pointer")
          .on("click", (event, d) => {
            event.stopPropagation();
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
    .classed("pcp-gender-highlight", (d) => activeGender && d.gender === activeGender)
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
            event.stopPropagation();
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
    .classed("pcp-gender-highlight", (d) => activeGender && d.gender === activeGender)
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

/**
 * Highlight gender bars from a PCP click.
 * Passing null clears the highlight.
 *
 * We keep this function so PCP-driven highlighting still works.
 * It uses the same class as the gender filter highlight for consistency.
 */
function highlightGenderFromPCP(gender) {
  if (!heartSvgGroup || !hyperSvgGroup) return;

  heartSvgGroup
    .selectAll("rect.heart-bar")
    .classed("pcp-gender-highlight", (d) => gender && d.gender === gender);

  hyperSvgGroup
    .selectAll("rect.hyper-bar")
    .classed("pcp-gender-highlight", (d) => gender && d.gender === gender);
}
