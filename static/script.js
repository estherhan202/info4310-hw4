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

  // Filter the data for the year range 1990-1999
  const filteredData = flattenedData.filter(
    (d) => d.year >= 1990 && d.year <= 1999
  );

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

  // Add jitter function
  const jitter = (range, value) => {
    return d3.randomUniform(-range, range)();
  };

  // Add NFL-styled football data points
  svg
    .selectAll(".point")
    .data(flattenedData)
    .enter()
    .append("ellipse") // Use ellipse for football shape
    .attr("class", "point")
    .attr(
      "cx",
      (d) => x(d.subCategory) + x.bandwidth() / 2 + jitter(x.bandwidth() / 5, 0)
    )
    .attr("cy", (d) => y(d.games) + jitter(2, d.games))
    .attr("rx", 6) // Horizontal radius
    .attr("ry", 4) // Vertical radius (smaller to look like a football)
    .attr("fill", (d) => color(d))
    .attr("opacity", 0.8)
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5)
    .attr(
      "transform",
      (d) =>
        `rotate(45, ${
          x(d.subCategory) + x.bandwidth() / 2 + jitter(x.bandwidth() / 5, 0)
        }, ${y(d.games) + jitter(2, d.games)})`
    ) // Rotate to look like a football
    .on("mouseover", function (event, d) {
      showNFLTooltip(event, d, this);
    })
    .on("mouseout", hideNFLTooltip);

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

// Updated NFL-styled tooltip
function showNFLTooltip(event, d, element) {
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
    .attr("rx", 9)
    .attr("ry", 6)
    .attr("stroke", nflColors.accent)
    .attr("stroke-width", 2);

  // Create fancy NFL-styled tooltip
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
    .style("z-index", "1000");

  tooltip.transition().duration(200).style("opacity", 1);

  let details = d.description
    ? d.description
    : "No additional details available";

  tooltip
    .html(
      `
      <div style="border-bottom: 1px solid #ddd; margin-bottom: 8px; padding-bottom: 5px;">
        <span style="color: ${
          nflColors.primary
        }; font-weight: bold; font-size: 16px;">${d.name}</span>
        <span style="background-color: ${
          nflColors.lightAccent
        }; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px; font-size: 12px;">${
        d.team
      }</span>
      </div>
      <div style="margin-bottom: 6px;"><span style="font-weight: bold">Year:</span> ${
        d.year
      }</div>
      <div style="margin-bottom: 6px;"><span style="font-weight: bold">Violation:</span> ${
        d.subCategory
      }</div>
      <div style="margin-bottom: 6px;"><span style="font-weight: bold">Suspension:</span> 
        <span style="color: ${nflColors.secondary}; font-weight: bold">${
        d.games === 40 ? "Indefinite" : d.games + " games"
      }</span>
      </div>
      <div style="font-style: italic; font-size: 12px; color: #666; margin-top: 5px;">${details}</div>
    `
    )
    .style("left", event.pageX + 15 + "px")
    .style("top", event.pageY - 15 + "px");
}

function hideNFLTooltip() {
  d3.select(this)
    .attr("rx", 6)
    .attr("ry", 4)
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5);

  d3.selectAll(".tooltip").remove();
}
