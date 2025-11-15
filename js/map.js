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
      // We'll rely on main.js to know if filter is toggled off;
      // here just visually mark as selected
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

  const maxRate = d3.max(Array.from(byState.values(), (v) => v.rate)) || 0.01;

  mapColorScale = d3.scaleSequential(d3.interpolateReds).domain([0, maxRate]);

  mapSvg
    .selectAll("path.state")
    .attr("fill", (d) => {
      const s = byState.get(d.properties.NAME);
      return s ? mapColorScale(s.rate) : "#eee";
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
}
