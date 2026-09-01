document.addEventListener('DOMContentLoaded', () => {
  // 1. Select DOM elements across sections
  const searchForm = document.getElementById('people-search') ||
                     document.getElementById('article-search') || 
                     document.getElementById('pseud-search') || 
                     document.querySelector('form.search');
                     
  const searchResultsContainer = document.getElementById('search-results');
  const resultTemplate = document.getElementById('search-result');

  // Input fields (dual inputs for People, single input for Articles/Pseudonyms)
  const nameInput = document.getElementById('search-name');
  const detailsInput = document.getElementById('search-details');
  const singleInput = document.getElementById('search-input');

  if (!searchForm || !searchResultsContainer || !resultTemplate) {
    return;
  }

  let lunrIndex = null;
  let rawData = [];
  let isFetching = false;

  // 2. Fetch section-relative index lazily on focus or submit
  function ensureIndexLoaded() {
    if (lunrIndex || isFetching) return Promise.resolve();

    isFetching = true;
    
    return fetch('index.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        rawData = data;

        const isPeopleSection = rawData.length > 0 && 'description' in rawData[0];

        // 3. Initialize Lunr index with weighted fields
        lunrIndex = lunr(function () {
          this.ref('url');

          if (isPeopleSection) {
            this.field('name', { boost: 10 });
            this.field('altname', { boost: 8 });
            this.field('description', { boost: 5 });
            this.field('notes', { boost: 2 });
            this.field('biography', { boost: 1 });
          } else {
            this.field('name', { boost: 10 });
            this.field('url');
          }

          rawData.forEach(doc => {
            this.add(doc);
          });
        });
      })
      .catch(error => console.error('Error fetching search index:', error))
      .finally(() => {
        isFetching = false;
      });
  }

  // Pre-load index on focus of any search input field
  searchForm.querySelectorAll('input[type="search"]').forEach(input => {
    input.addEventListener('focus', ensureIndexLoaded);
  });

  // 4. Form Submission Handler using Lunr Query Builder
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    await ensureIndexLoaded();
    if (!lunrIndex) return;

    let results = [];

    try {
      // Dual-input mode (People section)
      if (nameInput || detailsInput) {
        // Normalize terms to lowercase for Lunr token pipeline compatibility
        const nameQuery = nameInput ? nameInput.value.trim().toLowerCase() : '';
        const detailsQuery = detailsInput ? detailsInput.value.trim().toLowerCase() : '';

        if (!nameQuery && !detailsQuery) {
          clearResults();
          return;
        }

        results = lunrIndex.query(q => {
          const bothFilled = nameQuery !== '' && detailsQuery !== '';
          const groupPresence = bothFilled ? lunr.Query.presence.MUST : lunr.Query.presence.OPTIONAL;

          // 1. Name Input: Matches name OR altname
          if (nameQuery) {
            const term = `${nameQuery}*`;
            
            q.clause({
              term: term,
              fields: ['name'],
              presence: groupPresence,
              wildcard: lunr.Query.wildcard.TRAILING
            });
            
            q.clause({
              term: term,
              fields: ['altname'],
              presence: groupPresence,
              wildcard: lunr.Query.wildcard.TRAILING
            });
          }

          // 2. Details Input: Matches description OR notes OR biography
          if (detailsQuery) {
            const term = `${detailsQuery}*`;
            const detailFields = ['description', 'notes', 'biography'];
            
            detailFields.forEach(field => {
              q.clause({
                term: term,
                fields: [field],
                presence: groupPresence,
                wildcard: lunr.Query.wildcard.TRAILING
              });
            });
          }
        });

      } 
      // Single-input mode (Articles & Pseudonyms sections)
      else if (singleInput) {
        // Lowercase query string so wildcard searches match lowercased index tokens
        const query = singleInput.value.trim().toLowerCase();
        if (!query) {
          clearResults();
          return;
        }
        results = lunrIndex.search(`${query}*`);
      }

      renderResults(results);
    } catch (err) {
      console.warn('Search query execution error:', err);
    }
  });

  // 5. Reset Button Event Listener
  searchForm.addEventListener('reset', () => {
    clearResults();
  });

  // 6. Render Matching Results
  function renderResults(results) {
    clearResults();

    if (results.length === 0) {
      const noResultsMsg = document.createElement('p');
      noResultsMsg.className = 'no-results';
      noResultsMsg.textContent = 'No matching results found.';
      searchResultsContainer.appendChild(noResultsMsg);
      return;
    }

    const dataMap = new Map(rawData.map(item => [item.url, item]));
    const fragment = document.createDocumentFragment();

    results.forEach(result => {
      const itemData = dataMap.get(result.ref);
      if (!itemData) return;

      const clone = resultTemplate.content.cloneNode(true);

      const link = clone.querySelector('a');
      link.href = itemData.url;
      link.textContent = itemData.name;

      fragment.appendChild(clone);
    });

    searchResultsContainer.appendChild(fragment);
  }

  function clearResults() {
    const dynamicResults = searchResultsContainer.querySelectorAll(':not(template)');
    dynamicResults.forEach(el => el.remove());
  }
});