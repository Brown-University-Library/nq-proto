document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DOM Element Selectors
  // ==========================================
  const searchForm = document.getElementById('people-search') ||
                     document.getElementById('article-search') || 
                     document.getElementById('pseud-search') || 
                     document.querySelector('form.search');
                     
  const searchResultsContainer = document.getElementById('search-results');
  const resultTemplate = document.getElementById('search-result');

  // Text Inputs
  const nameInput = document.getElementById('search-name');
  const detailsInput = document.getElementById('search-details');
  const singleInput = document.getElementById('search-input');

  // Multi-Range Inputs
  const birthAfterInput = document.getElementById('birth-after');
  const birthBeforeInput = document.getElementById('birth-before');
  const deathAfterInput = document.getElementById('death-after');
  const deathBeforeInput = document.getElementById('death-before');

  if (!searchForm || !searchResultsContainer || !resultTemplate) {
    return;
  }

  // ==========================================
  // 2. Dual-Thumb Slider Controller
  // ==========================================
  function setupDualSlider(minInputId, maxInputId, outMinId, outMaxId, minGap = 1) {
    const minInput = document.getElementById(minInputId);
    const maxInput = document.getElementById(maxInputId);
    const outMin = document.getElementById(outMinId);
    const outMax = document.getElementById(outMaxId);

    if (!minInput || !maxInput) return null;

    const track = minInput.parentElement ? minInput.parentElement.querySelector('.slider-track') : null;
    const sliderMax = parseInt(minInput.max, 10);
    const sliderMin = parseInt(minInput.min, 10);

    function updateValues(e) {
      let minVal = parseInt(minInput.value, 10);
      let maxVal = parseInt(maxInput.value, 10);

      // Enforce min/max gap bounds so thumbs don't cross each other
      if (maxVal - minVal < minGap) {
        if (e && e.target === minInput) {
          minInput.value = maxVal - minGap;
          minVal = parseInt(minInput.value, 10);
        } else {
          maxInput.value = minVal + minGap;
          maxVal = parseInt(maxInput.value, 10);
        }
      }

      // Update <output> text nodes
      if (outMin) outMin.textContent = minVal;
      if (outMax) outMax.textContent = maxVal;

      // Update linear gradient track color highlight
      if (track) {
        const percent1 = ((minVal - sliderMin) / (sliderMax - sliderMin)) * 100;
        const percent2 = ((maxVal - sliderMin) / (sliderMax - sliderMin)) * 100;
        track.style.background = `linear-gradient(to right, #ddd ${percent1}%, #0066cc ${percent1}%, #0066cc ${percent2}%, #ddd ${percent2}%)`;
      }
    }

    // Dynamic z-index handling when thumbs overlap at upper boundary
    minInput.addEventListener('input', (e) => {
      if (parseInt(minInput.value, 10) > sliderMax - 100) {
        minInput.style.zIndex = '5';
      } else {
        minInput.style.zIndex = '2';
      }
      updateValues(e);
    });

    maxInput.addEventListener('input', (e) => {
      updateValues(e);
    });

    // Initial pass on bind
    updateValues();

    return { updateValues };
  }

  // Initialize Dual Sliders
  const birthSlider = setupDualSlider('birth-after', 'birth-before', 'out-birth-after', 'out-birth-before');
  const deathSlider = setupDualSlider('death-after', 'death-before', 'out-death-after', 'out-death-before');

  // ==========================================
  // 3. Lunr Search Index Setup
  // ==========================================
  let lunrIndex = null;
  let rawData = [];
  let isFetching = false;

  function ensureIndexLoaded() {
    if (lunrIndex || isFetching) return Promise.resolve();

    isFetching = true;
    
    return fetch('index.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        rawData = data;
        const isPeopleSection = rawData.length > 0 && 'description' in rawData[0];

        lunrIndex = lunr(function () {
          this.ref('url');

          if (isPeopleSection) {
            this.field('name', { boost: 10 });
            this.field('altname', { boost: 8 });
            this.field('description', { boost: 5 });
          } else {
            this.field('name', { boost: 10 });
            this.field('url');
          }

          rawData.forEach(doc => this.add(doc));
        });
      })
      .catch(error => console.error('Error fetching search index:', error))
      .finally(() => { isFetching = false; });
  }

  // Pre-load search index when user focuses any input
  searchForm.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', ensureIndexLoaded);
  });

  // ==========================================
  // 4. Form Submit & Date Range Filtering
  // ==========================================
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    await ensureIndexLoaded();
    if (!lunrIndex) return;

    let lunrResults = [];

    // Parse current slider positions
    const bAfter = birthAfterInput ? parseInt(birthAfterInput.value, 10) : null;
    const bBefore = birthBeforeInput ? parseInt(birthBeforeInput.value, 10) : null;
    const dAfter = deathAfterInput ? parseInt(deathAfterInput.value, 10) : null;
    const dBefore = deathBeforeInput ? parseInt(deathBeforeInput.value, 10) : null;

    // Detect if sliders have been adjusted away from extreme minimum or maximum bounds
    const bAfterActive = bAfter !== null && birthAfterInput && bAfter > parseInt(birthAfterInput.min, 10);
    const bBeforeActive = bBefore !== null && birthBeforeInput && bBefore < parseInt(birthBeforeInput.max, 10);
    const dAfterActive = dAfter !== null && deathAfterInput && dAfter > parseInt(deathAfterInput.min, 10);
    const dBeforeActive = dBefore !== null && deathBeforeInput && dBefore < parseInt(deathBeforeInput.max, 10);

    const hasDateFilters = bAfterActive || bBeforeActive || dAfterActive || dBeforeActive;

    try {
      if (nameInput || detailsInput) {
        const nameQuery = nameInput ? nameInput.value.trim().toLowerCase() : '';
        const detailsQuery = detailsInput ? detailsInput.value.trim().toLowerCase() : '';

        if (!nameQuery && !detailsQuery && !hasDateFilters) {
          clearResults();
          return;
        }

        // 1. Text Search Execution via Lunr
        if (nameQuery || detailsQuery) {
          lunrResults = lunrIndex.query(q => {
            const bothFilled = nameQuery !== '' && detailsQuery !== '';
            const groupPresence = bothFilled ? lunr.Query.presence.MUST : lunr.Query.presence.OPTIONAL;

            if (nameQuery) {
              const term = `${nameQuery}*`;
              q.clause({ term: term, fields: ['name'], presence: groupPresence, wildcard: lunr.Query.wildcard.TRAILING });
              q.clause({ term: term, fields: ['altname'], presence: groupPresence, wildcard: lunr.Query.wildcard.TRAILING });
            }

            if (detailsQuery) {
              const term = `${detailsQuery}*`;
              ['description'].forEach(field => {
                q.clause({ term: term, fields: [field], presence: groupPresence, wildcard: lunr.Query.wildcard.TRAILING });
              });
            }
          });
        } else {
          // If search is executed with ONLY date bounds and NO text queries, match against all records
          lunrResults = rawData.map(item => ({ ref: item.url }));
        }

      } else if (singleInput) {
        const query = singleInput.value.trim().toLowerCase();
        if (!query) {
          clearResults();
          return;
        }
        lunrResults = lunrIndex.search(`${query}*`);
      }

      // 2. Post-Filter Lunr Matches against Date Ranges
      const dataMap = new Map(rawData.map(item => [item.url, item]));

      const filteredResults = lunrResults.filter(result => {
        const item = dataMap.get(result.ref);
        if (!item) return false;

        const birthYear = item.birth ? parseInt(item.birth, 10) : null;
        const deathYear = item.death ? parseInt(item.death, 10) : null;

        if (bAfterActive && (birthYear === null || birthYear < bAfter)) return false;
        if (bBeforeActive && (birthYear === null || birthYear > bBefore)) return false;
        if (dAfterActive && (deathYear === null || deathYear < dAfter)) return false;
        if (dBeforeActive && (deathYear === null || deathYear > dBefore)) return false;

        return true;
      });

      renderResults(filteredResults);

    } catch (err) {
      console.warn('Search execution error:', err);
    }
  });

  // ==========================================
  // 5. Form Reset Handler
  // ==========================================
  searchForm.addEventListener('reset', () => {
    clearResults();
    setTimeout(() => {
      if (birthSlider) birthSlider.updateValues();
      if (deathSlider) deathSlider.updateValues();
    }, 0);
  });

  // ==========================================
  // 6. Result Rendering & DOM Helpers
  // ==========================================
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

      let titleText = itemData.name;
      if (itemData.birth || itemData.death) {
        const b = itemData.birth || '?';
        const d = itemData.death || '';
        titleText += d ? ` (${b}–${d})` : ` (${b})`;
      }

      link.textContent = titleText;
      fragment.appendChild(clone);
    });

    searchResultsContainer.appendChild(fragment);
  }

  function clearResults() {
    const dynamicResults = searchResultsContainer.querySelectorAll(':not(template)');
    dynamicResults.forEach(el => el.remove());
  }
});