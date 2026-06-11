
import { getIdFromString } from "./join-data.js";

const ARTICLES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUtTYXmYEd1gh6K9XhEp-q1Oo9qp-vThZsG1SyDj0zQXTaqeOWKJo8CNj9FmCVI5y3i2XP19EBDSPt/pub?gid=2073170733&single=true&output=csv";

async function processArticlesData(results) {
  let articleDataArray = JSON.parse(JSON.stringify(results.data));
  const subscript = /%([^_]+)\%/g,
    sub = `<sub>$1<\/sub>`;

  // turn percent symbols into <sub> HTML
  for (const [key, value] of Object.entries(articleDataArray)) {
    if (value.title.length) {
      let title = value.title,
        hasSubscript = title.match(subscript);
      if (hasSubscript) {
        // don't just update bio variable
        value.title = title.replace(subscript, sub);
        //console.log(value.biography);
      }
    }
  }

  // Reconcile multiple authors by splitting the row
  articleDataArray = articleDataArray.reduce(
    (newArticleDataArray, articleData) => {
      const names = articleData.standardname.split(/\s*;\s*/); // REMOVE SPACE
      if (names.length > 1) {
        //console.log("SPLITTING AUTHORS:", names);
        return newArticleDataArray.concat(
          names.map((name) => ({ ...articleData, standardname: name }))
        );
      } else {
        return newArticleDataArray.concat(articleData);
      }
    },
    []
  );

  // add author IDs to each article

  articleDataArray = await Promise.all(
    articleDataArray.map(async (articleData) => {
      const authorId = await getIdFromString(articleData.standardname);
      return { ...articleData, authorId };
    })
  );

  return articleDataArray;
}

export function getArticlesData() {
  return new Promise((resolve, reject) => {
    Papa.parse(ARTICLES_URL, {
      download: true,
      header: true,
      complete: async (articleData) => {
        try {
          const processedArticleData = await processArticlesData(articleData);
          resolve(processedArticleData);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
}
