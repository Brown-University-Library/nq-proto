import { getContributorsData } from "./get-contributors-data.js";

function buildTabulator(parsedData) { console.log("Building Tabulator with data:", parsedData);
  let table = new Tabulator("#data-table", {
    data: parsedData,
    height: 1200,
    layout: "fitDataTable",
    resizableColumnFit: true,
    pagination: "local",
    paginationSize: 100,
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
        if (column.field.match(/biography/) || column.field.match(/notes/) ) {
          column.formatter = "html";
        }
        if (column.field.match(/authorId/)) {
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
    //groupBy: ["name in standard form"],
    //groupStartOpen: true,
    initialSort: [{ column: "name in standard form", dir: "asc" }],
  });

  /*let sigButton = document.getElementById("group-sig");
    sigButton.addEventListener("click", (event) => {
        table.setGroupBy(false); //clear current grouping
        table.setGroupBy("signature");
    });
    
    let nameButton = document.getElementById("group-name");
    nameButton.addEventListener("click", (event) => {
        table.setGroupBy(false); //clear current grouping
        table.setGroupBy("name in standard form");
    });

    let seriesButton = document.getElementById("group-series");
    seriesButton.addEventListener("click", (event) => {
        table.setGroupBy(false); //clear current grouping
        table.setGroupBy(["series", "volume"]);
        table.setGroupStartOpen(false, false);
        table.setSort([
            {column:"series", dir:"asc"}, //sort by this first
            {column:"volume", dir:"asc"}, //then sort by this second
        ]);
    });

    let clearButton = document.getElementById("group-clear");
    clearButton.addEventListener("click", (event) => {
        table.setGroupBy(false); //clear current grouping
    });
    */
}

// main: load data and build table

function main() {
  getContributorsData().then((contributorsData) => {
    buildTabulator(contributorsData);
  });
}

main();
