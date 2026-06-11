// Makes a hashed ID from a string (for table joins)

export async function getIdFromString(stringToHash) {

  if (!crypto.subtle) {
    throw new Error(
      `We use Web Crypto API to generate unique IDs for table joins, but crypto functionality needs the browser to be running in a secure context. 
      This means accessing the page via https:// or http://localhost — using 127.0.0.0 or 0.0.0.0 ain't gonna cut it.
      See https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts for more info.`
    );
  }

  const normalizedStringToHash = stringToHash.normalize("NFKC").trim(), // optional normalization
    data = new TextEncoder().encode(normalizedStringToHash),
    digest = await crypto.subtle.digest("SHA-256", data),
    bytes = new Uint8Array(digest).slice(0, 8); // 8 bytes = 64 bits

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Join contributors to articles by hashed name ID

export function joinContributorsToArticles(articlesArray, contributorsArray) {
  const contributorsById = contributorsArray.reduce((acc, contributor) => {
    acc[contributor.authorId] = contributor;
    return acc;
  }, {});

  return articlesArray.map((article) => {
    const contributor = contributorsById[article.authorId] || {};
    return { ...article, contributor };
  });
}

// Join articles to contributors by hashed name ID

export function joinArticlesToContributors(articlesArray, contributorsArray) {
  const articlesById = articlesArray.reduce((articlesByContributorId, article) => {
    if (!articlesByContributorId[article.authorId]) {
      articlesByContributorId[article.authorId] = [];
    }
    articlesByContributorId[article.authorId].push(article);
    return articlesByContributorId;
  }, {});

  const contributorsWithArticles = contributorsArray.map((contributor) => {
    const articles = articlesById[contributor.authorId] || [];
    //console.log("Joining contributor:", contributor.standardname, "with article info:", articles);
    if (articles.length > 1){
      //console.log("Multiple articles found for contributor:", contributor.standardname, "Articles:", articles);
    }     
    return { ...contributor, articles: articles };

  });

  return contributorsWithArticles;
}
