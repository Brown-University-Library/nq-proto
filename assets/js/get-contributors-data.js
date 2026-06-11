import { getIdFromString } from "./join-data.js";

const CONTRIBUTORS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUtTYXmYEd1gh6K9XhEp-q1Oo9qp-vThZsG1SyDj0zQXTaqeOWKJo8CNj9FmCVI5y3i2XP19EBDSPt/pub?gid=0&single=true&output=csv";

async function processContributorsData(results) {
  let dataToFormat = JSON.parse(JSON.stringify(results.data));
  const italic = /_([^_]+)_/g,
    em = `<em>$1<\/em>`,
    underline = /\^([^\^]+)\^/gm,
    mark = `<mark>$1<\/mark>`,
    md = /\[([^\]]+)]\(([^)]+)\)/g,
    href = `<a href="$2">$1</a>`;

  // do something to create a new Object? ugh.
  // turn Markdown italics into HTML italics
  for (const [key, value] of Object.entries(dataToFormat)) {
    if (value.biography.length) {
      let bio = value.biography,
        hasEm = bio.match(italic);
      if (hasEm) {
        // don't just update bio variable
        value.biography = bio.replace(italic, em);
        //console.log(value.biography);
      }
    }
  }
  // turn Markdown emphasis into HTML highlights
  for (const [key, value] of Object.entries(dataToFormat)) {
    if (value.notes.length) {
      let note = value.notes,
        hasUnder = note.match(underline);
      if (hasUnder) {
        // don't just update note variable
        value.notes = note.replace(underline, mark);
        //console.log(value.notes);
      }
    }
  }

  // turn Markdown URLs into HTML
  for (const [key, value] of Object.entries(dataToFormat)) {
    if (value.biography.length) {
      let bio = value.biography,
        hasLink = bio.match(md);
      if (hasLink) {
        // don't just update bio variable
        value.biography = bio.replace(md, href);
        //console.log(value.biography);
      }
    }
  }

  // Reconcile multiple authors by splitting the row
  // THIS CAN PROBABLY BE ERASED, SINCE THE CONTRIBUTORS LIST SHOULD ONLY
  //  EVER HAVE ONE CONTRIBUTOR PER ROW

  const NAME_DELIMITER = /\s*;\s*/;

  dataToFormat = dataToFormat.reduce((newUnformattedData, row) => {
    const names = row["name in standard form"].split(NAME_DELIMITER);
    if (names.length > 1) {
      //console.log("SPLITTING AUTHORS:", names);
      newUnformattedData.concat(
        names.map((name) => ({ ...row, "name in standard form": name }))
      );
    } else {
      return newUnformattedData.concat(row);
    }
  }, []);

  // add ID to each contributor

  dataToFormat = await Promise.all(
    dataToFormat.map(async (row) => {
      const contributorId = await getIdFromString(row["name in standard form"]);
      return { ...row, authorId: contributorId };
    })
  );

  return dataToFormat;
}

export function getContributorsData() {
  return new Promise((resolve, reject) => {
    Papa.parse(CONTRIBUTORS_URL, {
      download: true,
      header: true,
      complete: async (articleData) => {
        try {
          const processedContributorData = await processContributorsData(articleData);
          resolve(processedContributorData);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
}
