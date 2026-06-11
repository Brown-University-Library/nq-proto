import { getArticlesData } from "./get-articles-data.js";

let currentData, table;
let clusteredArticles = L.markerClusterGroup();

function buildTabulator(articleDataArray, map) {
  console.log("Building Tabulator with data:", articleDataArray);
  table = new Tabulator("#data-table", {
    data: articleDataArray,
    height: 1200,
    layout: "fitDataTable",
    resizableColumnFit: true,
    pagination: "local",
    paginationSize: 75,
    paginationCounter: "rows",
    placeholder: "No Data Set",
    //selectableRows: true,
    //rowHeader: { formatter: "rowSelection", titleFormatter: "rowSelection", headerSort: false, resizable: false, frozen: true, headerHozAlign: "center", hozAlign: "center", width: "2rem" },
    //downloadRowRange: "selected",
    autoColumns: true,
    autoColumnsDefinitions: function (definitions) {
      //definitions - array of column definition objects
      definitions.forEach((column) => {
        column.headerFilter = true; // add header filter to every column
        column.maxInitialWidth = 300; // controlling the width of columns onload
        if (column.field.match(/url/)) {
          column.formatter = "link"; // make the url column contents into working links
        }
        if (column.field.match(/title/)) {
          column.formatter = "html";
        }
        if (column.field.endsWith("MISSING") || column.field.match(/authorId/) ) {
          column.visible = false;
        }
      });

      return definitions;
    },
    // grabbed this function from https://tabulator.info/docs/6.3/menu#tooltips-cell
    columnDefaults:{
        tooltip:function(e, cell, onRendered){
            //e - mouseover event
            //cell - cell component
            //onRendered - onRendered callback registration function
            
            var el = document.createElement("div");
            //el.style.backgroundColor = "red";
            el.innerHTML = cell.getValue(); //return cells "value";
            
            return el; 
        },
    },
    //groupBy: ["signature"],
    groupStartOpen: true,
    initialSort: [{ column: "standardname", dir: "asc" }],
  });

  let sigButton = document.getElementById("group-sig");
  sigButton.addEventListener("click", (event) => {
    table.setGroupBy(false); //clear current grouping
    table.setGroupBy("signature");
  });

  let nameButton = document.getElementById("group-name");
  nameButton.addEventListener("click", (event) => {
    table.setGroupBy(false); //clear current grouping
    table.setGroupBy("standardname");
  });

  let seriesButton = document.getElementById("group-series");
  seriesButton.addEventListener("click", (event) => {
    table.setGroupBy(false); //clear current grouping
    table.setGroupBy(["series", "volume"]);
    table.setGroupStartOpen(false, false);
    table.setSort([
      { column: "series", dir: "asc" }, //sort by this first
      { column: "volume", dir: "asc" }, //then sort by this second
    ]);
  });

  let clearButton = document.getElementById("group-clear");
  clearButton.addEventListener("click", (event) => {
    table.setGroupBy(false); //clear current grouping
  });

  table.on("tableBuilt", function () {
    table.updateColumnDefinition("county", { title: "county/state" }); //change the title on the county column
    currentData = table.getData(""); //return currently filtered data
  });
  table.on("renderComplete", function () {
    // get active data when tabulator rebuilds
    currentData = table.getData("active"); //return currently filtered data
    // trigger map rebuild
    rebuildMarkers(map);
  });
}

function rebuildMarkers(map) {
  map.removeLayer(clusteredArticles); // Remove old markers
  clusteredArticles = L.markerClusterGroup(); // Create new (empty) marker layer instance

  for (var i = 0; i < currentData.length; i++) {
    const d = currentData[i];
    if (d.latitude.length > 0 && d.longitude.length > 0) {
      new L.marker([d.latitude, d.longitude])
        .bindPopup(
          `<p><a href="${d.url}">${d.title}</a></p>
          <p>Written by ${d.signature}  (${d.standardname}), published on ${d.date}.</p>
          <p>${d.town}, ${d.county}, ${d.country}</p>`
        )
        .addTo(clusteredArticles);
    }
  }

  clusteredArticles.addTo(map);
  let currentBounds = clusteredArticles.getBounds();
  map.flyToBounds(currentBounds);
}

function buildMap() {
  // create map
  let map = L.map("article-map").setView([51.505, -0.09], 6);
  L.tileLayer(
    "http://services.arcgisonline.com/arcgis/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 12,
      minZoom: 1,
      //attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  ).addTo(map);

  return map;
}

// main: load data and build table and map

function main() {
  const map = buildMap();
  getArticlesData().then((articleDataArray) => {
    buildTabulator(articleDataArray, map);
  });
}

main();
