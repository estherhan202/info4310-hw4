// Load and process the data
document.addEventListener("DOMContentLoaded", function () {
  // Load the CSV file
  d3.csv("NFL Suspensions Data.csv")
    .then(function (rawData) {
      // Process the data
      const processedData = processData(rawData);

      // Create scatterplot visualization
      createScatterplot(processedData);

      // Setup interactive controls
      setupControls(processedData);
    })
    .catch(function (error) {
      console.error("Error loading the data:", error);
    });
});

// Process the raw data into the format needed for visualization
function processData(rawData) {
  // Clean and prepare the data
  const cleanedData = rawData
    .map((d) => {
      // Convert "Indef." to a value just beyond the highest actual suspension
      // The highest actual suspension in the dataset is 36 games
      const games = d.games === "Indef." ? 40 : parseInt(d.games);

      // Map category to our visualization categories
      let category, subCategory;

      if (d.category.includes("PEDs")) {
        category = "Drug Violations";
        subCategory = d.category.includes("repeated")
          ? "PEDs, more than once"
          : "PEDs";
      } else if (d.category.includes("Substance abuse")) {
        category = "Drug Violations";
        subCategory = d.category.includes("repeated")
          ? "Substance abuse, more than once"
          : "Substance abuse";
      } else if (d.category.includes("In-game violence")) {
        category = "Conduct Violations";
        subCategory = "In-game violence";
      } else if (d.category.includes("Personal conduct")) {
        category = "Conduct Violations";
        subCategory = "Personal conduct";
      } else {
        // Handle any other categories
        return null;
      }

      return {
        name: d.name,
        team: d.team,
        games: games,
        category: category,
        subCategory: subCategory,
        description: d.desc,
        year: d.year,
        source: d.source,
      };
    })
    .filter((d) => d !== null); // Remove any rows that didn't match our categories

  // Group data by category, subcategory, and games
  const groupedData = d3.group(
    cleanedData,
    (d) => d.category,
    (d) => d.subCategory,
    (d) => d.games
  );

  // Convert to format for visualization
  const result = [];

  // For each category
  for (const [category, subcategories] of groupedData.entries()) {
    // For each subcategory
    for (const [subCategory, gameGroups] of subcategories.entries()) {
      // Calculate total for this subcategory
      const subcategoryTotal = Array.from(gameGroups.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      );

      // For each game count
      for (const [games, players] of gameGroups.entries()) {
        result.push({
          category: category,
          subCategory: subCategory,
          games: games,
          count: players.length,
          percentage: players.length / subcategoryTotal,
          players: players, // Keep player details for tooltips
        });
      }
    }
  }

  return result;
}

// Set up interactive controls
function setupControls(data) {
  const controlPanel = d3.select(".control-panel");

  // Year range filter
  controlPanel.append("div").html(`
            <label>Year Range: </label>
            <select id="year-filter">
                <option value="all">All Years</option>
                <option value="2010-2014">2010-2014</option>
                <option value="2000-2009">2000-2009</option>
                <option value="1990-1999">1990-1999</option>
                <option value="1980-1989">1980-1989</option>
            </select>
        `);

  // Game length filter
  controlPanel.append("div").html(`
            <label>Suspension Length: </label>
            <select id="length-filter">
                <option value="all">All Lengths</option>
                <option value="short">Short (1-4 games)</option>
                <option value="medium">Medium (5-10 games)</option>
                <option value="long">Long (10+ games)</option>
            </select>
        `);

  // Extract all teams
  const allTeams = new Set();
  data.forEach((d) => {
    d.players.forEach((player) => {
      if (player.team) allTeams.add(player.team);
    });
  });

  // Team filter
  controlPanel.append("div").html(`
            <label>Team: </label>
            <select id="team-filter">
                <option value="all">All Teams</option>
                ${Array.from(allTeams)
                  .sort()
                  .map((team) => `<option value="${team}">${team}</option>`)
                  .join("")}
            </select>
        `);

  // Add event listeners for filters
  d3.select("#year-filter").on("change", function () {
    const yearRange = this.value;
    const lengthFilter = d3.select("#length-filter").property("value");
    const teamFilter = d3.select("#team-filter").property("value");
    const filteredData = filterData(data, yearRange, lengthFilter, teamFilter);
    createScatterplot(filteredData);
  });

  d3.select("#length-filter").on("change", function () {
    const lengthFilter = this.value;
    const yearRange = d3.select("#year-filter").property("value");
    const teamFilter = d3.select("#team-filter").property("value");
    const filteredData = filterData(data, yearRange, lengthFilter, teamFilter);
    createScatterplot(filteredData);
  });

  d3.select("#team-filter").on("change", function () {
    const teamFilter = this.value;
    const yearRange = d3.select("#year-filter").property("value");
    const lengthFilter = d3.select("#length-filter").property("value");
    const filteredData = filterData(data, yearRange, lengthFilter, teamFilter);
    createScatterplot(filteredData);
  });
}

// Filter data based on user selection
function filterData(data, yearRange, lengthFilter, teamFilter = "all") {
  // Create a deep copy to avoid modifying original data
  let filteredData = JSON.parse(JSON.stringify(data));

  // Apply filters to the players array
  filteredData.forEach((d) => {
    if (yearRange !== "all") {
      const [startYear, endYear] = yearRange.split("-").map(Number);
      d.players = d.players.filter((player) => {
        // If year is a string, try to parse it as a number
        const playerYear = parseInt(player.year);
        // Check if year is within range, handling NaN values
        return (
          !isNaN(playerYear) && playerYear >= startYear && playerYear <= endYear
        );
      });
    }

    // Apply team filter
    if (teamFilter !== "all") {
      d.players = d.players.filter((player) => player.team === teamFilter);
    }
  });

  // Apply length filter
  if (lengthFilter !== "all") {
    if (lengthFilter === "short") {
      filteredData = filteredData.filter((d) => d.games >= 1 && d.games <= 4);
    } else if (lengthFilter === "medium") {
      filteredData = filteredData.filter((d) => d.games >= 5 && d.games <= 10);
    } else if (lengthFilter === "long") {
      filteredData = filteredData.filter((d) => d.games > 10);
    }
  }

  // Remove entries with no players after filtering
  filteredData = filteredData.filter((d) => d.players.length > 0);

  return filteredData;
}

// Create the scatterplot visualization with NFL styling
function createScatterplot(data) {
  // Clear visualization
  d3.select("#visualization").html("");

  // NFL color palette
  const nflColors = {
    primary: "#013369", // NFL navy blue
    secondary: "#D50A0A", // NFL red
    accent: "#FFB612", // NFL gold
    lightAccent: "#4F5155", // NFL gray
    background: "#F5F5F5", // Light background
    text: "#111111", // Dark text
  };

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

  // Add football field yard markers (subtle background lines)
  for (let i = 0; i <= width; i += width / 10) {
    svg
      .append("line")
      .attr("x1", i)
      .attr("y1", 0)
      .attr("x2", i)
      .attr("y2", height)
      .attr("stroke", "#DDDDDD")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");
  }

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
  const yDomain = [0, hasIndefinite ? 40 : maxYValue];

  const y = d3.scaleLinear().domain(yDomain).range([height, 0]);

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

  // Create evenly spaced y-axis ticks
  const yTickValues = [];
  for (let i = 0; i <= maxNumericGames; i += 4) {
    yTickValues.push(i);
  }

  // Add the indefinite tick if needed
  if (hasIndefinite) {
    yTickValues.push(40); // Ensure "Indef." is at the top
  }

  // Set the y-axis domain to cover 1 to 4
  const yDomainDynamic = [1, Math.max(4, maxNumericGames)];
  const yTickValuesDynamic = d3.range(1, Math.max(4, maxNumericGames) + 1);

  // Create scales
  const yDynamic = d3.scaleLinear().domain(yDomainDynamic).range([height, 0]);

  // Add y-axis with specified tick values
  svg
    .append("g")
    .attr("class", "y-axis")
    .call(
      d3
        .axisLeft(yDynamic)
        .tickValues(yTickValuesDynamic)
        .tickFormat((d) => d) // No special formatting needed
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
    .append("ellipse") // Use ellipse for football shape
    .attr("class", "point")
    .attr("cx", (d) => x(d.subCategory) + x.bandwidth() / 2)
    .attr("cy", (d) => y(d.games))
    .attr("rx", 8) // Fixed horizontal radius for all points
    .attr("ry", 5.6) // Fixed vertical radius for all points (0.7 ratio maintained)
    .attr("fill", (d) => color(d))
    .attr("opacity", 0.8)
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5)
    .attr(
      "transform",
      (d) =>
        `rotate(45, ${x(d.subCategory) + x.bandwidth() / 2}, ${y(d.games)})`
    ) // Rotate to look like a football
    .on("mouseover", function (event, d) {
      // Only show tooltip preview if no persistent panel is open
      if (!d3.select("#detail-panel").empty()) return;
      showAggregatedTooltip(event, d, this);
    })
    .on("mouseout", hideNFLTooltip)
    .on("click", function (event, d) {
      // First remove any existing detail panels
      d3.select("#detail-panel").remove();

      // Get the coordinates to position the panel
      const xPos = x(d.subCategory) + x.bandwidth() / 2;
      const yPos = y(d.games);

      // Create a more persistent panel for the clicked point
      showDetailPanel(d, svg, xPos, yPos, width, height);

      // Stop the event from propagating
      event.stopPropagation();
    });

  // Close detail panel when clicking elsewhere on the SVG
  svg.on("click", function () {
    d3.select("#detail-panel").remove();
  });

  // Add a count label to points with multiple players
  svg
    .selectAll(".count-label")
    .data(aggregatedData.filter((d) => d.count > 1))
    .enter()
    .append("text")
    .attr("class", "count-label")
    .attr("x", (d) => x(d.subCategory) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.games) + 4)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-size", "10px")
    .style("font-weight", "bold")
    .style("fill", "white")
    .style("pointer-events", "none")
    .text((d) => d.count);

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

// Function to show the aggregated tooltip with all player details
function showAggregatedTooltip(event, d, element) {
  // NFL color palette
  const nflColors = {
    primary: "#013369",
    secondary: "#D50A0A",
    accent: "#FFB612",
    lightAccent: "#4F5155",
    background: "#FFFFFF",
  };

  // Highlight the data point
  d3.select(element)
    .attr("rx", 8 * 1.2)
    .attr("ry", 5.6 * 1.2)
    .attr("stroke", nflColors.accent)
    .attr("stroke-width", 2);

  // Calculate position for tooltip to ensure it stays in viewport
  // and doesn't obscure the data point
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let tooltipX = event.pageX + 15;
  let tooltipY = event.pageY - 100;

  // If tooltip would go off the right edge, position to the left of cursor
  if (tooltipX + 320 > viewportWidth) {
    tooltipX = event.pageX - 320;
  }

  // If tooltip would go off the top, position below cursor
  if (tooltipY < 10) {
    tooltipY = event.pageY + 20;
  }

  // Create fancy NFL-styled tooltip with fixed dimensions
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("background-color", "white")
    .style("border", `2px solid ${nflColors.primary}`)
    .style("border-radius", "6px")
    .style("padding", "12px")
    .style("box-shadow", "0 4px 8px rgba(0,0,0,0.2)")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("z-index", "1000")
    .style("width", "300px") // Fixed width
    .style("height", "200px") // Fixed height
    .style("overflow-y", "auto"); // Enable scrolling

  tooltip.transition().duration(200).style("opacity", 1);

  // Create header for the aggregated tooltip
  let tooltipContent = `
    <div style="border-bottom: 2px solid ${
      nflColors.primary
    }; margin-bottom: 10px; padding-bottom: 5px; position: sticky; top: 0; background-color: white; z-index: 2;">
      <span style="color: ${
        nflColors.primary
      }; font-weight: bold; font-size: 16px;">
        ${d.count} Player${d.count > 1 ? "s" : ""} - ${
    d.games === 40 ? "Indefinite" : d.games + " game"
  } Suspension
      </span>
      <div style="font-size: 14px; margin-top: 5px;">Violation: ${
        d.subCategory
      }</div>
      <div style="font-size: 12px; margin-top: 5px; color: ${
        nflColors.secondary
      }; text-align: center; font-weight: bold; border: 1px dashed ${
    nflColors.accent
  }; padding: 3px; background-color: #f8f8f8;">
        Click on point for more details
      </div>
    </div>
  `;

  // Add a container for the scrollable content
  tooltipContent += `<div style="max-height: calc(100% - 80px); overflow-y: auto;">`;

  // Add details for each player in the aggregated point
  // Show just a preview - first 2 players only for the hover
  const previewPlayers = d.players.slice(0, 2);

  previewPlayers.forEach((player, index) => {
    let details = player.description
      ? player.description
      : "No additional details available";

    // Truncate description even further for the preview
    if (details.length > 50) {
      details = details.substring(0, 50) + "...";
    }

    tooltipContent += `
      <div style="margin-bottom: 10px; ${
        index > 0 ? "border-top: 1px dotted #ddd; padding-top: 8px;" : ""
      }">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; color: ${nflColors.primary};">${
      player.name
    }</span>
          <span style="background-color: ${
            nflColors.lightAccent
          }; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${
      player.team
    }</span>
        </div>
        <div style="font-size: 12px; margin-top: 4px;"><span style="font-weight: bold">Year:</span> ${
          player.year
        }</div>
        <div style="font-size: 12px; font-style: italic; color: #666; margin-top: 2px;">${details}</div>
      </div>
    `;
  });

  // Close the scrollable container
  tooltipContent += `</div>`;

  // Add a visual indicator if there are more players than shown in preview
  if (d.players.length > 2) {
    tooltipContent += `
      <div style="position: sticky; bottom: 0; background-color: white; text-align: center; font-size: 12px; color: ${
        nflColors.lightAccent
      }; padding-top: 5px; border-top: 1px dotted #ddd;">
        + ${d.count - 2} more player${
      d.count - 2 > 1 ? "s" : ""
    } (click for full details)
      </div>
    `;
  }

  tooltip
    .html(tooltipContent)
    .style("left", tooltipX + "px")
    .style("top", tooltipY + "px");
}

function hideNFLTooltip() {
  // For regular non-aggregated points
  if (d3.select(this).datum().count === undefined) {
    d3.select(this)
      .attr("rx", 6)
      .attr("ry", 4)
      .attr("stroke", "#333")
      .attr("stroke-width", 0.5);
  } else {
    // For aggregated points, reset to original scaled size
    const d = d3.select(this).datum();
    d3.select(this)
      .attr("rx", 8)
      .attr("ry", 5.6)
      .attr("stroke", "#333")
      .attr("stroke-width", 0.5);
  }

  d3.selectAll(".tooltip").remove();
}

// Function to show detailed panel when a point is clicked
function showDetailPanel(d, svg, xPos, yPos, width, height) {
  // NFL color palette
  const nflColors = {
    primary: "#013369",
    secondary: "#D50A0A",
    accent: "#FFB612",
    lightAccent: "#4F5155",
    background: "#FFFFFF",
  };

  // Determine panel position - try to keep it within the visualization area
  // Position to the right of the point by default, but if too close to the right edge,
  // position to the left
  const panelWidth = 350;
  const panelHeight = Math.min(400, d.count * 80 + 100); // Scale with number of players but cap at 400px

  // Improved positioning logic to ensure the panel is well-positioned
  // Start by trying to position to the right of the point
  let anchorX = xPos + 30;

  // Check if panel would go off the right edge and adjust
  if (anchorX + panelWidth > width) {
    // Try positioning to the left instead
    anchorX = xPos - panelWidth - 30;

    // If still off screen (left side), center it as best we can
    if (anchorX < 10) {
      anchorX = Math.max(10, (width - panelWidth) / 2);
    }
  }

  // Calculate vertical position - try to center on the point
  let anchorY = yPos - panelHeight / 2;

  // Make sure it doesn't go off the top
  if (anchorY < 10) {
    anchorY = 10;
  }

  // Make sure it doesn't go off the bottom
  if (anchorY + panelHeight > height - 10) {
    anchorY = height - panelHeight - 10;
  }

  // If still not fitting well, prioritize making it fully visible
  anchorY = Math.max(10, Math.min(height - panelHeight - 10, anchorY));

  // Create a panel group
  const panel = svg
    .append("g")
    .attr("id", "detail-panel")
    .attr("transform", `translate(${anchorX}, ${anchorY})`)
    .style("cursor", "default");

  // Add a subtle drop shadow for the panel (SVG filter)
  const defs = svg.append("defs");

  // Define a drop shadow filter
  const filter = defs
    .append("filter")
    .attr("id", "drop-shadow")
    .attr("x", "-20%")
    .attr("y", "-20%")
    .attr("width", "140%")
    .attr("height", "140%");

  // Add the shadow components
  filter
    .append("feGaussianBlur")
    .attr("in", "SourceAlpha")
    .attr("stdDeviation", 3)
    .attr("result", "blur");

  filter
    .append("feOffset")
    .attr("in", "blur")
    .attr("dx", 2)
    .attr("dy", 2)
    .attr("result", "offsetBlur");

  const feComponentTransfer = filter
    .append("feComponentTransfer")
    .attr("in", "offsetBlur")
    .attr("result", "offsetBlur");

  feComponentTransfer
    .append("feFuncA")
    .attr("type", "linear")
    .attr("slope", 0.5);

  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "offsetBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // Panel background with border and shadow
  panel
    .append("rect")
    .attr("width", panelWidth)
    .attr("height", panelHeight)
    .attr("fill", "white")
    .attr("stroke", nflColors.primary)
    .attr("stroke-width", 2)
    .attr("rx", 8)
    .style("filter", "url(#drop-shadow)");

  // Panel header
  const header = panel.append("g");

  // Header background
  header
    .append("rect")
    .attr("width", panelWidth)
    .attr("height", 50)
    .attr("fill", nflColors.primary)
    .attr("rx", 8)
    .attr("ry", 0);

  // Fix the top corners to be rounded but bottom corners square
  header
    .append("rect")
    .attr("width", panelWidth)
    .attr("height", 30)
    .attr("y", 25)
    .attr("fill", nflColors.primary);

  // Title
  header
    .append("text")
    .attr("x", 15)
    .attr("y", 30)
    .attr("fill", "white")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .text(
      `${d.count} Player${d.count > 1 ? "s" : ""} - ${
        d.games === 40 ? "Indefinite" : d.games + " game"
      } Suspension`
    );

  // Subtitle
  header
    .append("text")
    .attr("x", 15)
    .attr("y", 45)
    .attr("fill", nflColors.accent)
    .style("font-size", "14px")
    .style("font-family", "Helvetica, Arial, sans-serif")
    .text(`Violation: ${d.subCategory}`);

  // Close button
  const closeButton = header
    .append("g")
    .attr("transform", `translate(${panelWidth - 30}, 15)`)
    .style("cursor", "pointer")
    .on("click", function (event) {
      // Remove the filter definition when closing
      defs.remove();
      d3.select("#detail-panel").remove();
      event.stopPropagation(); // Prevent event from propagating to SVG
    });

  closeButton
    .append("circle")
    .attr("r", 10)
    .attr("fill", "white")
    .attr("opacity", 0.3);

  closeButton
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", ".3em")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .attr("fill", "white")
    .text("×");

  // Create a scrollable content area within the panel
  const contentG = panel.append("g").attr("transform", "translate(0, 50)");

  // Generate a unique ID for this clip path to avoid conflicts
  const clipId = `content-clip-${Date.now()}`;

  // Define the clipPath for the content area
  contentG
    .append("clipPath")
    .attr("id", clipId)
    .append("rect")
    .attr("width", panelWidth)
    .attr("height", panelHeight - 50);

  const content = contentG.append("g").attr("clip-path", `url(#${clipId})`);

  // Create scrollable content with player details
  const playerList = content.append("g");

  // Add each player detail
  d.players.forEach((player, i) => {
    const playerCard = playerList
      .append("g")
      .attr("transform", `translate(10, ${i * 80})`);

    // Player card background with alternating colors for better readability
    playerCard
      .append("rect")
      .attr("width", panelWidth - 20)
      .attr("height", 75)
      .attr("rx", 4)
      .attr("fill", i % 2 === 0 ? "#f9f9f9" : "#f1f1f1");

    // Player name
    playerCard
      .append("text")
      .attr("x", 10)
      .attr("y", 20)
      .style("font-weight", "bold")
      .style("font-size", "14px")
      .style("font-family", "Helvetica, Arial, sans-serif")
      .style("fill", nflColors.primary)
      .text(player.name);

    // Team and year
    playerCard
      .append("text")
      .attr("x", 10)
      .attr("y", 40)
      .style("font-size", "12px")
      .style("font-family", "Helvetica, Arial, sans-serif")
      .style("fill", nflColors.lightAccent)
      .text(`Team: ${player.team} | Year: ${player.year}`);

    // Description (truncate if too long)
    const description = player.description || "No additional details available";
    const truncatedDesc =
      description.length > 70
        ? description.substring(0, 70) + "..."
        : description;

    playerCard
      .append("text")
      .attr("x", 10)
      .attr("y", 60)
      .style("font-size", "12px")
      .style("font-style", "italic")
      .style("font-family", "Helvetica, Arial, sans-serif")
      .style("fill", "#666")
      .text(truncatedDesc);
  });

  // Add a transparent rect to capture mouse events and implement scrolling
  const scrollArea = panel
    .append("rect")
    .attr("width", panelWidth)
    .attr("height", panelHeight)
    .attr("fill", "transparent")
    .style("cursor", "default");

  // Scrolling functionality - track mouse wheel events to scroll content
  let contentHeight = d.players.length * 80;
  let scrollTop = 0;
  const maxScroll = Math.max(0, contentHeight - (panelHeight - 70));

  scrollArea.on("wheel", function (event) {
    // Prevent default scroll behavior
    event.preventDefault();

    // Update scroll position
    scrollTop = Math.min(Math.max(0, scrollTop + event.deltaY), maxScroll);

    // Update content position
    playerList.attr("transform", `translate(10, ${-scrollTop})`);
  });

  // Add scroll indicators if content is scrollable
  if (contentHeight > panelHeight - 70) {
    // Add scroll indicator at the bottom of visible content
    panel
      .append("text")
      .attr("x", panelWidth / 2)
      .attr("y", panelHeight - 15)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-family", "Helvetica, Arial, sans-serif")
      .style("fill", nflColors.lightAccent)
      .text("Scroll for more");

    // Add a subtle shadow at the bottom to indicate more content
    panel
      .append("rect")
      .attr("x", 0)
      .attr("y", panelHeight - 30)
      .attr("width", panelWidth)
      .attr("height", 15)
      .attr("fill", "white")
      .attr("opacity", 0.3)
      .attr("rx", 0);
  }

  // Add a visual indicator connecting the detail panel to the data point
  // to make it clearer which point the panel is associated with
  let connectorStartX, connectorStartY, connectorEndX, connectorEndY;

  // Determine if panel is to the right or left of the point
  if (anchorX > xPos) {
    // Panel is to the right
    connectorStartX = xPos + 8;
    connectorEndX = anchorX;
  } else {
    // Panel is to the left
    connectorStartX = xPos - 8;
    connectorEndX = anchorX + panelWidth;
  }

  connectorStartY = yPos;
  connectorEndY = anchorY + panelHeight / 2;

  // Add the connector line
  svg
    .append("path")
    .attr("id", "panel-connector")
    .attr(
      "d",
      `M ${connectorStartX} ${connectorStartY} L ${connectorEndX} ${connectorEndY}`
    )
    .attr("stroke", nflColors.lightAccent)
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "3,3")
    .attr("opacity", 0.6);

  // Make sure the connector is removed when the panel is closed
  closeButton.on("click", function (event) {
    d3.select("#panel-connector").remove();
    defs.remove(); // Remove filter definitions
    d3.select("#detail-panel").remove();
    event.stopPropagation();
  });

  // Also remove connector when clicking elsewhere
  svg.on("click", function () {
    d3.select("#panel-connector").remove();
    defs.remove(); // Remove filter definitions
    d3.select("#detail-panel").remove();
  });
}
