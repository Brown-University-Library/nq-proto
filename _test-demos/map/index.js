import { initializeMap } from "../../assets/js/map.js";

async function loadJoinedData() {
  const response = await fetch("../../assets/joined_data.json");
  if (!response.ok) {
    throw new Error(`Failed to load map data: ${response.status}`);
  }

  return await response.json();
}

async function main() {
  const joinedData = await loadJoinedData().catch(console.error);
  const mapData = joinedData.reduce(
    (acc, author) => [...acc, ...author.articles],
    [],
  );
  initializeMap("nq-map", mapData);
}

main();
