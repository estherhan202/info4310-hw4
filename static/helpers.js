// Function to process the raw data into the format needed for visualization
export function processData(rawData) {
  // Clean and prepare the data
  const cleanedData = rawData
    .map((d) => {
      const games = d.games === "Indef." ? 40 : parseInt(d.games);
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
    .filter((d) => d !== null);

  // Group data by category, subcategory, and games
  const groupedData = d3.group(
    cleanedData,
    (d) => d.category,
    (d) => d.subCategory,
    (d) => d.games
  );
  const result = [];

  for (const [category, subcategories] of groupedData.entries()) {
    for (const [subCategory, gameGroups] of subcategories.entries()) {
      const subcategoryTotal = Array.from(gameGroups.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      for (const [games, players] of gameGroups.entries()) {
        result.push({
          category: category,
          subCategory: subCategory,
          games: games,
          count: players.length,
          percentage: players.length / subcategoryTotal,
          players: players,
        });
      }
    }
  }

  return result;
}

// Function to set up interactive controls
export function setupControls(data) {
  const controlPanel = d3.select(".control-panel");

  // Year range filter
  const yearFilterContainer = controlPanel.append("div");
  yearFilterContainer.append("label").text("Year Range: ");

  const yearSelect = yearFilterContainer
    .append("select")
    .attr("id", "year-filter");
  yearSelect
    .selectAll("option")
    .data(["all", "2010-2014", "2000-2009", "1990-1999", "1980-1989"])
    .enter()
    .append("option")
    .attr("value", (d) => d)
    .text((d) => (d === "all" ? "All Years" : d));

  // Game length filter
  const lengthFilterContainer = controlPanel.append("div");
  lengthFilterContainer.append("label").text("Suspension Length: ");

  const lengthSelect = lengthFilterContainer
    .append("select")
    .attr("id", "length-filter");
  lengthSelect
    .selectAll("option")
    .data([
      { value: "all", text: "All Lengths" },
      { value: "short", text: "Short (1-4 games)" },
      { value: "medium", text: "Medium (5-10 games)" },
      { value: "long", text: "Long (10+ games)" },
    ])
    .enter()
    .append("option")
    .attr("value", (d) => d.value)
    .text((d) => d.text);

  // Extract all teams
  const allTeams = new Set();
  data.forEach((d) => {
    d.players.forEach((player) => {
      if (player.team) allTeams.add(player.team);
    });
  });

  // Team filter
  const teamFilterContainer = controlPanel.append("div");
  teamFilterContainer.append("label").text("Team: ");

  const teamSelect = teamFilterContainer
    .append("select")
    .attr("id", "team-filter");
  teamSelect
    .selectAll("option")
    .data([
      { value: "all", text: "All Teams" },
      ...Array.from(allTeams)
        .sort()
        .map((team) => ({ value: team, text: team })),
    ])
    .enter()
    .append("option")
    .attr("value", (d) => d.value)
    .text((d) => d.text);

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
