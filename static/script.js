import { processData, setupControls } from "./helpers.js";

// Load and process the data
const nflSuspensionsVisualization = async function () {
  try {
    const rawData = await d3.csv("NFL Suspensions Data.csv");
    const processedData = processData(rawData);
    createScatterplot(processedData);
    setupControls(processedData);
  } catch (error) {
    console.error("Error in NFL suspensions visualization:", error);
  }
};

// Immediately invoke the function
nflSuspensionsVisualization();

// Create the scatterplot visualization with NFL styling
function createScatterplot(data) {
  // Clear visualization
  d3.select("#visualization").html("");

  // NFL color palette
  const nflColors = {
    primary: "#013369",
    secondary: "#D50A0A",
    accent: "#FFB612",
    lightAccent: "#4F5155",
    background: "#FFFFFF",
  };

  // Fixed values in variables at the top:
  const pointSize = 6;
  const tooltipWidth = 300;
  const tooltipHeight = 200;

  // Set dimensions with increased margins
  const margin = { top: 80, right: 200, bottom: 120, left: 90 };
  const width = 1000 - margin.left - margin.right;
  const height = 650 - margin.top - margin.bottom;

  // Create a container with NFL styling
  const container = d3
    .select("#visualization")
    .append("div")
    .style("background-color", nflColors.background)
    .style("border-radius", "8px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("border", `2px solid ${nflColors.primary}`)
    .style("padding", "15px")
    .style("position", "relative");

  // Create SVG with larger size
  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Add NFL-styled title
  svg
    .append("text")
    .attr("class", "chart-title")
    .attr("x", width / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .style("font-size", "24px")
    .style("font-weight", "bold")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("fill", nflColors.primary)
    .text("NFL SUSPENSION SEVERITY BY OFFENSE TYPE");

  // Remove ALL lines in the SVG
  svg.selectAll("line").remove();

  // If the lines are paths instead of line elements
  svg
    .selectAll("path")
    .filter(function () {
      const style = window.getComputedStyle(this);
      return style.strokeDasharray && style.strokeDasharray !== "none";
    })
    .remove();

  // Remove the football yard markers if they exist
  svg.selectAll("line[stroke-dasharray='3,3']").remove();

  // Remove any grid lines with class
  svg.selectAll(".grid-lines").remove();

  // If there are any other specific grid lines, you can remove them too
  svg.selectAll(".gridlines").remove();

  // Flatten data to get individual suspension records
  const flattenedData = [];
  data.forEach((d) => {
    d.players.forEach((player) => {
      flattenedData.push({
        name: player.name,
        team: player.team,
        games: d.games,
        category: d.category,
        subCategory: d.subCategory,
        description: player.description,
        year: player.year,
        source: player.source,
      });
    });
  });

  // Now we can add the subtitle with the player count
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -15)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-style", "italic")
    .style("fill", nflColors.lightAccent)
    .text(
      `Analysis of ${flattenedData.length} player suspensions across violation categories`
    );

  // Rest of your data processing code...
  const offenseTypes = Array.from(
    new Set(flattenedData.map((d) => d.subCategory))
  );

  const numericSuspensions = flattenedData.filter((d) => d.games < 40);
  const maxNumericGames =
    numericSuspensions.length > 0
      ? d3.max(numericSuspensions, (d) => d.games)
      : 0;

  const hasIndefinite = flattenedData.some((d) => d.games === 40);

  // Create scales
  const x = d3.scaleBand().domain(offenseTypes).range([0, width]).padding(0.4);

  // Set up y-scale with evenly spaced ticks
  const maxYValue = Math.ceil(maxNumericGames / 4) * 4;
  // Create the y-scale with a domain that includes indefinite values properly
  const yDomain = [0, hasIndefinite ? 40 : maxYValue];

  // Define colors based on violation category with NFL colors
  const color = (d) =>
    d.category === "Drug Violations" ? nflColors.secondary : nflColors.primary;

  // Add x-axis with NFL styling
  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("text-anchor", "end")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("font-weight", "bold")
    .style("fill", nflColors.lightAccent)
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-40)");

  // Create evenly spaced y-axis ticks with NO skips
  const yTickValues = [];
  for (let i = 0; i <= maxNumericGames; i += 1) {
    yTickValues.push(i);
  }

  // Add the indefinite tick if needed
  if (hasIndefinite) {
    yTickValues.push(40); // Ensure "Indef." is at the top
  }

  // Find the highest actual numeric suspension length
  const highestNumeric = d3.max(numericSuspensions, (d) => d.games);

  // Create a cleaned up y-axis domain and ticks
  // Show EVERY tick mark without skips
  const cleanedTickValues = [];
  for (let i = 0; i <= highestNumeric; i += 1) {
    cleanedTickValues.push(i);
  }

  // Add the indefinite value as the final tick
  if (hasIndefinite) {
    cleanedTickValues.push(40);
  }

  // Create the y-scale with a domain that includes indefinite values properly
  const y = d3
    .scaleLinear()
    .domain([0, hasIndefinite ? 40 : highestNumeric])
    .range([height, 0]);

  // Add y-axis with specified tick values and custom formatting
  svg
    .append("g")
    .attr("class", "y-axis")
    .call(
      d3
        .axisLeft(y)
        .tickValues(cleanedTickValues)
        .tickFormat((d) => (d === 40 ? "Indef." : d))
    )
    .selectAll("text")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("font-weight", "bold")
    .style("fill", nflColors.lightAccent);

  // Style the axes
  svg
    .selectAll(".domain")
    .attr("stroke", nflColors.lightAccent)
    .attr("stroke-width", 2);

  svg
    .selectAll(".tick line")
    .attr("stroke", nflColors.lightAccent)
    .attr("stroke-width", 1);

  // Add axis labels with NFL styling
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 80)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("fill", nflColors.primary)
    .text("TYPE OF OFFENSE");

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("fill", nflColors.primary)
    .text("LENGTH OF SUSPENSION (GAMES)");

  // Comprehensive removal of ALL gridlines
  // Place this after creating axes but before adding data points

  // Remove any previously added grid containers
  svg.selectAll(".grid-container").remove();

  // Remove all grid lines by class
  svg.selectAll(".x-grid-line, .y-grid-line, .grid-line").remove();

  // Remove all lines that might be grid lines but don't have the specific classes
  svg
    .selectAll("line")
    .filter(function () {
      // Keep axis lines but remove everything else
      const parent = this.parentNode;
      return !(
        parent.classList.contains("tick") ||
        parent.classList.contains("x-axis") ||
        parent.classList.contains("y-axis")
      );
    })
    .remove();

  // Add CSS to prevent any future grid lines from appearing
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    .grid-line, .x-grid-line, .y-grid-line { 
      display: none !important; 
    }
  `;
  document.head.appendChild(styleElement);

  // If there are path-based grid lines
  svg
    .selectAll("path")
    .filter(function () {
      return (
        this.getAttribute("class") &&
        this.getAttribute("class").includes("grid")
      );
    })
    .remove();

  // GROUP DATA POINTS BY SUB-CATEGORY AND GAMES (Y-AXIS VALUES)
  const aggregatedData = [];

  // Group by subCategory and games
  const nestedData = d3.group(
    flattenedData,
    (d) => d.subCategory,
    (d) => d.games
  );

  // Convert nested data to aggregated format
  for (const [subCategory, gamesMap] of nestedData) {
    for (const [games, players] of gamesMap) {
      // Calculate dominant category (most frequent among these players)
      const categoryCount = {};
      players.forEach((p) => {
        categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
      });
      const dominantCategory = Object.entries(categoryCount).sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      aggregatedData.push({
        subCategory: subCategory,
        games: games,
        count: players.length,
        players: players,
        category: dominantCategory,
      });
    }
  }

  // Add aggregated NFL-styled football data points
  svg
    .selectAll(".point")
    .data(aggregatedData)
    .enter()
    .append("ellipse")
    .attr("class", "point")
    .attr("cx", function (d) {
      return x(d.subCategory) + x.bandwidth() / 2;
    })
    .attr("cy", function (d) {
      return y(d.games);
    })
    .attr("rx", pointSize)
    .attr("ry", pointSize * 0.7)
    .attr("fill", function (d) {
      return color(d);
    })
    .attr("opacity", 0.8)
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5)
    .attr("transform", function (d) {
      return (
        "rotate(45, " +
        (x(d.subCategory) + x.bandwidth() / 2) +
        ", " +
        y(d.games) +
        ")"
      );
    })
    .on("mouseover", function (event, d) {
      // Highlight the point
      d3.select(this).attr("stroke", nflColors.accent).attr("stroke-width", 2);

      // Create a simple tooltip
      const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ddd")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("box-shadow", "0 2px 10px rgba(0,0,0,0.1)")
        .style("width", "250px")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .style("opacity", 0);

      // Add tooltip title
      tooltip
        .append("div")
        .style("font-weight", "bold")
        .style("font-size", "14px")
        .style("margin-bottom", "5px")
        .text(
          d.games === 40
            ? "Indefinite Suspension"
            : d.games + " Game Suspension"
        );

      // Add violation type
      tooltip
        .append("div")
        .style("font-size", "13px")
        .style("margin-bottom", "8px")
        .text("Violation: " + d.subCategory);

      // Add player count
      tooltip
        .append("div")
        .style("font-size", "13px")
        .style("margin-bottom", "10px")
        .text("Players affected: " + d.count);

      // Add click instruction
      tooltip
        .append("div")
        .style("color", "#D50A0A")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("text-align", "center")
        .style("padding", "3px")
        .style("border", "1px dashed #FFB612")
        .style("background", "#f8f8f8")
        .style("margin-bottom", "8px")
        .text("Click for detailed player information");

      // Position tooltip
      tooltip
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 30 + "px");

      // Fade in tooltip
      tooltip.transition().duration(200).style("opacity", 1);
    })
    .on("mouseout", function () {
      // Reset point style
      d3.select(this).attr("stroke", "#333").attr("stroke-width", 0.5);

      // Remove tooltip
      d3.selectAll(".tooltip").remove();
    })
    .on("click", function (event, d) {
      // Remove tooltips
      d3.selectAll(".tooltip").remove();

      // Remove existing detail panels
      d3.select("#detail-panel").remove();
      d3.select("#panel-connector").remove();

      // Show detail panel
      const xPos = x(d.subCategory) + x.bandwidth() / 2;
      const yPos = y(d.games);
      showDetailPanel(d, svg, xPos, yPos, width, height);

      event.stopPropagation();
    });

  // Close detail panel when clicking elsewhere on the SVG
  svg.on("click", function () {
    d3.select("#detail-panel").remove();
    d3.select("#panel-connector").remove();
  });

  // Add a count label to points with multiple players
  svg
    .selectAll(".count-label")
    .data(
      aggregatedData.filter(function (d) {
        return d.count > 1;
      })
    )
    .enter()
    .append("text")
    .attr("class", "count-label")
    .attr("x", function (d) {
      return x(d.subCategory) + x.bandwidth() / 2;
    })
    .attr("y", function (d) {
      return y(d.games) + 4;
    })
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-size", "10px")
    .style("font-weight", "bold")
    .style("fill", "white")
    .style("pointer-events", "none")
    .text(function (d) {
      return d.count;
    });

  // Add NFL-themed legend
  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width + 20}, 50)`);

  // Background for legend with NFL styling
  legend
    .append("rect")
    .attr("x", -10)
    .attr("y", -15)
    .attr("width", 170)
    .attr("height", 100)
    .attr("fill", "white")
    .attr("stroke", nflColors.primary)
    .attr("stroke-width", 2)
    .attr("rx", 8);

  // Legend title
  legend
    .append("text")
    .attr("x", 75)
    .attr("y", 10)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .style("font-size", "14px")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("fill", nflColors.primary)
    .text("VIOLATION TYPE");

  // Legend for Drug Violations
  legend
    .append("ellipse")
    .attr("cx", 20)
    .attr("cy", 40)
    .attr("rx", 6)
    .attr("ry", 4)
    .attr("fill", nflColors.secondary)
    .attr("transform", "rotate(45, 20, 40)");

  legend
    .append("text")
    .attr("x", 40)
    .attr("y", 45)
    .text("Drug Violations")
    .style("font-size", "13px")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("fill", nflColors.lightAccent);

  // Legend for Conduct Violations
  legend
    .append("ellipse")
    .attr("cx", 20)
    .attr("cy", 70)
    .attr("rx", 6)
    .attr("ry", 4)
    .attr("fill", nflColors.primary)
    .attr("transform", "rotate(45, 20, 70)");

  legend
    .append("text")
    .attr("x", 40)
    .attr("y", 75)
    .text("Conduct Violations")
    .style("font-size", "13px")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("fill", nflColors.lightAccent);
}

// Function to show detail panel for a point when clicked
function showDetailPanel(d, svg, xPos, yPos, width, height) {
  // NFL color palette
  const nflColors = {
    primary: "#013369", // NFL navy blue
    secondary: "#D50A0A", // NFL red
    accent: "#FFB612", // NFL gold
    lightAccent: "#4F5155", // NFL gray
    background: "#FFFFFF", // Light background
    text: "#111111", // Dark text
  };

  // Calculate panel position
  // Place the panel in a sensible location based on the point's position
  let panelX, panelY, connectorPath;
  const panelWidth = 300;
  const panelHeight = Math.min(350, 130 + d.players.length * 60);

  // Panel on the right if point is on the left side
  if (xPos < width / 2) {
    panelX = xPos + 30;
    connectorPath = `M${xPos},${yPos} L${panelX},${yPos + 20}`;
  } else {
    // Panel on the left if point is on the right side
    panelX = xPos - panelWidth - 30;
    connectorPath = `M${xPos},${yPos} L${panelX + panelWidth},${yPos + 20}`;
  }

  // Panel below if point is in the upper half
  if (yPos < height / 2) {
    panelY = yPos + 20;
  } else {
    // Panel above if point is in the lower half
    panelY = yPos - panelHeight - 20;
    // Update connector path
    if (xPos < width / 2) {
      connectorPath = `M${xPos},${yPos} L${panelX},${panelY + panelHeight}`;
    } else {
      connectorPath = `M${xPos},${yPos} L${panelX + panelWidth},${
        panelY + panelHeight
      }`;
    }
  }

  // Create connector line from point to panel
  svg
    .append("path")
    .attr("id", "panel-connector")
    .attr("d", connectorPath)
    .attr("stroke", nflColors.lightAccent)
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4,3")
    .attr("fill", "none");

  // Create the detail panel
  const detailPanel = svg
    .append("g")
    .attr("id", "detail-panel")
    .attr("transform", `translate(${panelX}, ${panelY})`);

  // Panel background
  detailPanel
    .append("rect")
    .attr("width", panelWidth)
    .attr("height", panelHeight)
    .attr("fill", "white")
    .attr("stroke", nflColors.primary)
    .attr("stroke-width", 2)
    .attr("rx", 8)
    .attr("ry", 8);

  // Panel header background
  detailPanel
    .append("rect")
    .attr("width", panelWidth)
    .attr("height", 50)
    .attr("fill", nflColors.primary)
    .attr("rx", 8)
    .attr("ry", 8)
    .attr("y", 0);

  // Fix rounded corners on header
  detailPanel
    .append("rect")
    .attr("width", panelWidth)
    .attr("height", 25)
    .attr("fill", nflColors.primary)
    .attr("y", 25);

  // Header title
  detailPanel
    .append("text")
    .attr("x", 15)
    .attr("y", 25)
    .text(
      `${d.count} Player${d.count > 1 ? "s" : ""} - ${
        d.games === 40 ? "Indefinite" : d.games + " game"
      } Suspension`
    )
    .attr("fill", "white")
    .attr("font-size", "14px")
    .attr("font-weight", "bold");

  // Violation type
  detailPanel
    .append("text")
    .attr("x", 15)
    .attr("y", 45)
    .text(`Violation: ${d.subCategory}`)
    .attr("fill", nflColors.accent)
    .attr("font-size", "12px");

  // Close button (X)
  const closeBtn = detailPanel
    .append("g")
    .attr("class", "close-btn")
    .attr("transform", `translate(${panelWidth - 30}, 25)`)
    .style("cursor", "pointer");

  closeBtn
    .append("circle")
    .attr("r", 12)
    .attr("fill", "rgba(255, 255, 255, 0.2)");

  closeBtn
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("fill", "white")
    .attr("font-size", "16px")
    .attr("font-weight", "bold")
    .text("×");

  closeBtn.on("click", function (event) {
    d3.select("#detail-panel").remove();
    d3.select("#panel-connector").remove();
    event.stopPropagation();
  });

  // Add player list
  const playerList = detailPanel
    .append("g")
    .attr("class", "player-list")
    .attr("transform", "translate(0, 60)");

  // Create a clipping path for the player list area
  detailPanel
    .append("defs")
    .append("clipPath")
    .attr("id", "player-list-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", panelWidth)
    .attr("height", panelHeight - 70);

  // Apply the clipping path to the player list
  playerList.attr("clip-path", "url(#player-list-clip)");

  // Add each player
  d.players.forEach((player, i) => {
    const playerGroup = playerList
      .append("g")
      .attr("transform", `translate(10, ${i * 60})`)
      .attr("class", "player-item");

    // Background for this player (alternating colors)
    playerGroup
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", panelWidth - 20)
      .attr("height", 55)
      .attr("fill", i % 2 === 0 ? "#f8f8f8" : "#f0f0f0")
      .attr("rx", 4)
      .attr("ry", 4);

    // Player name
    playerGroup
      .append("text")
      .attr("x", 10)
      .attr("y", 20)
      .text(player.name)
      .attr("fill", nflColors.primary)
      .attr("font-size", "14px")
      .attr("font-weight", "bold");

    // Team and year
    playerGroup
      .append("text")
      .attr("x", 10)
      .attr("y", 35)
      .text(`Team: ${player.team} | Year: ${player.year}`)
      .attr("fill", nflColors.lightAccent)
      .attr("font-size", "12px");

    // Description (if available)
    playerGroup
      .append("text")
      .attr("x", 10)
      .attr("y", 50)
      .text(player.description || "No additional details available")
      .attr("fill", "#666")
      .attr("font-size", "11px")
      .attr("font-style", "italic");
  });

  // If there are many players, add a scrollbar suggestion
  if (d.players.length > 5) {
    detailPanel
      .append("text")
      .attr("x", panelWidth - 90)
      .attr("y", panelHeight - 10)
      .text("More players above/below")
      .attr("fill", nflColors.secondary)
      .attr("font-size", "10px")
      .attr("font-style", "italic");
  }
}

// Your Yelp style:
d3.select("#element").style("display", "block").style("color", "#333");

// For tooltip/detail panel closing:
d3.select("body").on("click", function (event) {
  const target = event.target;
  if (!d3.select("#detail-panel").node().contains(target)) {
    d3.select("#detail-panel").remove();
    d3.select("#panel-connector").remove();
  }
});
// Match your selection pattern:
// Update the selection state and visuals in a clear sequence
function selectPoint(element, d) {
  // First clear previous selections
  d3.selectAll(".point").classed("selected", false);

  // Then update new selection
  d3.select(element).classed("selected", true);

  // Update related UI elements
  updateDetailPanel(d);
}
