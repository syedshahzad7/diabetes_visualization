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

function createParallelCoords(data, config) {
  pcConfig = config;

  const svg = d3.select("#parallel");

  // Use current width but cap height so the chart isn't huge
  const width = svg.node().clientWidth || 900;
  const height = 220; // <- smaller fixed height

  const margin = { top: 20, right: 20, bottom: 10, left: 40 };
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

  pcDimensions = [
    { key: "diabetes", label: "Outcome" },
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
    if (dim.key === "diabetes") {
      pcYScales[dim.key] = d3
        .scalePoint()
        .domain(["Non-diabetic", "Diabetic"])
        .range([pcInnerHeight, 0]);
    } else {
      pcYScales[dim.key] = d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => +d[dim.key]))
        .nice()
        .range([pcInnerHeight, 0]);
    }
  });

  pcLine = d3
    .line()
    .defined((d) => !isNaN(d[1]))
    .x((d) => d[0])
    .y((d) => d[1]);

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

    g.append("g")
      .attr("class", "pc-axis")
      .call(axis)
      .selectAll("text")
      .attr("font-size", 8); // smaller tick labels

    g.append("text")
      .attr("class", "axis-title")
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)   // smaller titles
      .attr("font-weight", 600)
      .text(dim.label);

    const brush = d3
      .brushY()
      .extent([
        [-10, 0],
        [10, pcInnerHeight]
      ])
      .on("brush end", brushed);

    g.append("g").attr("class", "brush").call(brush);

    function brushed({ selection }) {
      const allLines = pcLinesG.selectAll(".pc-line");
      if (!selection) {
        allLines.attr("opacity", 0.05);
        return;
      }
      const [y0, y1] = selection;
      const dimKey = dim.key;
      allLines.each(function (d) {
        let val;
        if (dimKey === "diabetes") {
          val = d.diabetes === 1 ? "Diabetic" : "Non-diabetic";
        } else {
          val = +d[dimKey];
        }
        const y = pcYScales[dimKey](val);
        const highlight = y >= y0 && y <= y1;
        d3.select(this).attr("opacity", highlight ? 0.4 : 0.01);
      });
    }
  });

  updateParallelCoords(data);
}

function updateParallelCoords(data) {
  if (!pcSvg) return;

  const maxLines = 20000; // you already set 2000 in main.js sampling, that's fine
  const sampled = data.length > maxLines ? data.slice(0, maxLines) : data;

  const lines = pcLinesG
    .selectAll(".pc-line")
    .data(sampled, (d, i) => d.__pc_id || (d.__pc_id = i + Math.random()));

  lines
    .join(
      (enter) =>
        enter
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
          .attr("d", (d) => pcPathForRow(d)),
      (update) => update.attr("d", (d) => pcPathForRow(d)),
      (exit) => exit.remove()
    );
}

function pcPathForRow(d) {
  const points = pcDimensions.map((dim) => {
    let v;
    if (dim.key === "diabetes") {
      v = d.diabetes === 1 ? "Diabetic" : "Non-diabetic";
    } else {
      v = +d[dim.key];
    }
    return [pcXScale(dim.key), pcYScales[dim.key](v)];
  });
  return pcLine(points);
}
