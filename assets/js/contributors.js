import { getContributorsData } from "./get-contributors-data.js";
import { getArticlesData } from "./get-articles-data.js";
import { joinArticlesToContributors } from "./join-data.js";

const MIN_YEAR = 1800,
  MAX_YEAR = 2001;

function formatArticlesForDisplay(articles) {
  const convertNumberToOrdinal = (number) => {
    const suffix = ["th", "st", "nd", "rd"],
      v = number % 100;
    return (
      number +
      "<sup>" +
      (suffix[(v - 20) % 10] || suffix[v] || suffix[0]) +
      "</sup>"
    );
  };

  const articlesListing = articles.map((article) => {
    return `<a href="${article.url}" target="_blank">${article.title}</a> (as <em>${article.signature}</em>, ${convertNumberToOrdinal(article.series)} S. No.${article.volume}, p.${article.page}, ${article.date})`;
  });
  return articlesListing;
}

const minMaxFilterEditor = function (
  cell,
  onRendered,
  success,
  cancel,
  editorParams,
) {
  let dateRange_start, dateRange_end;
  let container = document.createElement("span");

  //create and style inputs
  dateRange_start = document.createElement("input");
  dateRange_start.setAttribute("type", "number");
  dateRange_start.setAttribute("placeholder", "Min");
  dateRange_start.setAttribute("min", "");
  dateRange_start.setAttribute("max", "");
  dateRange_start.style.padding = "4px";
  dateRange_start.style.width = "50%";
  dateRange_start.style.boxSizing = "border-box";

  dateRange_start.value = cell.getValue();

  function buildValues(WHO_CALLS) {
    //console.log("BuildValues called by", WHO_CALLS);
    success({
      start: dateRange_start.value ? parseInt(dateRange_start.value) : MIN_YEAR,
      end: dateRange_end.value ? parseInt(dateRange_end.value) : MAX_YEAR,
    });
  }

  dateRange_end = dateRange_start.cloneNode();
  dateRange_end.setAttribute("placeholder", "Max");

  // dateRange_start.addEventListener("change", buildValues);
  dateRange_start.addEventListener("change", () => {
    //console.log("Start date changed:", dateRange_start.value);
    buildValues("START DATE CHANGE");
  });

  dateRange_end.addEventListener("change", buildValues);

  container.appendChild(dateRange_start);
  container.appendChild(dateRange_end);

  return container;
};

//custom max min filter function
function minMaxFilterFunction(headerValue, rowValue, rowData, filterParams) {
  //headerValue - the value of the header filter element
  //rowValue - the value of the column in this row
  //rowData - the data for the row being filtered
  //filterParams - params object passed to the headerFilterFuncParams property

  if (rowValue) {
    const rowValueInt = parseInt(rowValue);
    const isWithinRange =
      rowValueInt >= headerValue.start && rowValueInt <= headerValue.end;

    //console.log("minMaxFilterFunction called", { headerValue, rowValue, isWithinRange });

    return isWithinRange;
  }

  // return true; //must return a boolean, true if it passes the filter.
}

function buildTabulator(joinedData) {
  let table = new Tabulator("#data-table", {
    data: joinedData,
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
        if (column.field.match(/biography/) || column.field.match(/notes/)) {
          column.formatter = "html";
        }
        if (column.field.match(/authorId/)) {
          column.visible = false;
          column.download = false;
        }
        if (column.field === "articles") {
          column.formatter = "array";
          column.formatterParams = {
            delimiter: "<br>",
            valueMap: function (articles) {
              const articlesListing = formatArticlesForDisplay(articles);
              return articlesListing;
            },
          };
        }
        if (column.field === "birth year" || column.field === "death year") {
          column.minWidth = 150;
          column.sorter = "number";
          column.headerFilter = minMaxFilterEditor;
          column.headerFilterFunc = minMaxFilterFunction;
        }
      });

      return definitions;
    },
    // grabbed this function from https://tabulator.info/docs/6.3/menu#tooltips-cell
    columnDefaults: {
      tooltip: function (e, cell, onRendered) {
        //e - mouseover event
        //cell - cell component
        //onRendered - onRendered callback registration function

        const el = document.createElement("div");
        el.innerHTML = cell.getElement().innerHTML; //return cells "value";
        return el;
      },
    },
    initialSort: [{ column: "name in standard form", dir: "asc" }],
  });

  //trigger download of data.csv file
document.getElementById("download-csv").addEventListener("click", function(){
    table.download("csv", "nq-data.csv");
});

//trigger download of data.xlsx file
document.getElementById("download-xlsx").addEventListener("click", function(){
    table.download("xlsx", "nq-data.xlsx", {sheetName:"My Data"});
});
}

// main: load data and build table

function main() {
  Promise.all([getContributorsData(), getArticlesData()])
    .then(([contributorsData, articlesData]) => {
      const joinedData = joinArticlesToContributors(
        articlesData,
        contributorsData,
      );
      buildTabulator(joinedData);
    })
    .catch((error) => {
      console.error("Error loading data:", error);
    });
}

main();
