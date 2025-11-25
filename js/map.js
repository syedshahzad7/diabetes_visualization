// js/map.js

let mapSvg,
  mapConfig,
  mapColorScale,
  mapPathGenerator,
  mapGeo;

function createMap(geojson, data, config) {
  mapConfig = config;
  mapGeo = geojson;

  const svg = d3.select("#map");
  const width = svg.node().clientWidth || 480;
  const height = svg.node().clientHeight || 280;

  // store layout so we can place the legend later
  mapConfig._layout = { width, height };

  svg.attr("viewBox", [0, 0, width, height]);

  mapSvg = svg.append("g");

  const projection = d3.geoAlbersUsa().fitSize([width, height], geojson);
  mapPathGenerator = d3.geoPath().projection(projection);

  mapSvg
    .append("g")
    .attr("class", "states")
    .selectAll("path")
    .data(geojson.features, (d) => d.properties.NAME)
    .join("path")
    .attr("class", "state")
    .attr("d", mapPathGenerator)
    .on("click", (event, d) => {
      d3.selectAll(".state").classed("selected", false);
      const cur = d3.select(event.currentTarget);
      // visually toggle selection
      cur.classed("selected", !cur.classed("selected"));
      mapConfig?.onStateClick && mapConfig.onStateClick(d.properties.NAME);
    });

  updateMap(data);
}

function updateMap(data) {
  if (!mapSvg || !mapGeo) return;

  const byState = d3.rollup(
    data,
    (v) => {
      const total = v.length;
      const diabetics = v.filter((d) => d.diabetes === 1);
      const diabCount = diabetics.length;
      const rate = total ? diabCount / total : 0;
      const meanHb = diabetics.length
        ? d3.mean(diabetics, (d) => d.hbA1c_level)
        : null;
      const meanBmi = diabetics.length
        ? d3.mean(diabetics, (d) => d.bmi)
        : null;
      return { total, diabCount, rate, meanHb, meanBmi };
    },
    (d) => d.location
  );

  // ---- Build a more sensitive color scale ----
  const rates = Array.from(byState.values(), (v) => v.rate).filter((r) => r > 0);

  let minRate = d3.min(rates) || 0;
  let maxRate = d3.max(rates) || 0.01;

  const gamma = 0.6; // <1 => more contrast for small differences

  if (minRate === maxRate) {
    // All states basically have the same prevalence
    mapColorScale = d3
      .scaleSequential((t) => d3.interpolateReds(0.15 + 0.85 * t))
      .domain([0, maxRate])
      .clamp(true);
  } else {
    // Map [minRate,maxRate] into the "middle–dark" portion of Reds
    mapColorScale = d3
      .scaleSequential((t) =>
        d3.interpolateReds(0.15 + 0.85 * Math.pow(t, gamma))
      )
      .domain([minRate, maxRate])
      .clamp(true);
  }

  // ---- Color states + tooltip ----
  mapSvg
    .selectAll("path.state")
    .attr("fill", (d) => {
      const s = byState.get(d.properties.NAME);
      if (!s || s.total === 0) return "#e0e0e0"; // light gray for no data
      return mapColorScale(s.rate);
    })
    .on("mousemove", (event, d) => {
      const s = byState.get(d.properties.NAME);
      let html = `<strong>${d.properties.NAME}</strong><br/>`;
      if (!s || s.total === 0) {
        html += "No records in sample";
      } else {
        html += `Diabetes prevalence: ${(s.rate * 100).toFixed(1)}%<br/>`;
        html += `Mean HbA1c (diabetic): ${
          s.meanHb ? s.meanHb.toFixed(2) : "NA"
        }<br/>`;
        html += `Mean BMI (diabetic): ${
          s.meanBmi ? s.meanBmi.toFixed(1) : "NA"
        }<br/>`;
        html += `N = ${s.total}`;
      }
      mapConfig?.showTooltip && mapConfig.showTooltip(html, event);
    })
    .on("mouseout", () => {
      mapConfig?.hideTooltip && mapConfig.hideTooltip();
    });

  // ---- Legend ----
  const svg = d3.select("#map");
  const { width, height } = mapConfig._layout || {
    width: svg.node().viewBox.baseVal.width,
    height: svg.node().viewBox.baseVal.height
  };

  const legendWidth = 170;
  const legendHeight = 10;
  const legendMarginRight = 24;
  const legendMarginBottom = 26;

  // gradient definition
  let defs = svg.select("defs");
  if (defs.empty()) defs = svg.append("defs");

  const gradientId = "mapLegendGradient";
  defs.select(`#${gradientId}`).remove();

  const gradient = defs
    .append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  // sample along domain to build smooth gradient
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rate = minRate + t * (maxRate - minRate);
    gradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", mapColorScale(rate));
  }

  // remove old legend
  svg.selectAll("g.map-legend").remove();

  const legendGroup = svg
    .append("g")
    .attr("class", "map-legend")
    .attr(
      "transform",
      `translate(${width - legendWidth - legendMarginRight},${
        height - legendMarginBottom
      })`
    );

  // gradient bar
  legendGroup
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", `url(#${gradientId})`)
    .attr("stroke", "#ccc")
    .attr("stroke-width", 0.4);

  // legend axis
  const legendScale = d3
    .scaleLinear()
    .domain([minRate, maxRate])
    .range([0, legendWidth]);

  const legendAxis = d3
    .axisBottom(legendScale)
    .ticks(4)
    .tickFormat((d) => `${(d * 100).toFixed(1)}%`);

  legendGroup
    .append("g")
    .attr("transform", `translate(0,${legendHeight})`)
    .call(legendAxis)
    .selectAll("text")
    .attr("font-size", 8);

  // legend label
  legendGroup
    .append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -4)
    .attr("text-anchor", "middle")
    .attr("font-size", 9)
    .text("Diabetes prevalence");
}
