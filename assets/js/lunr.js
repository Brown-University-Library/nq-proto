document.addEventListener('DOMContentLoaded', () => {
  console.log('[Search System] Initializing search engine...');

  // ==========================================
  // 1. DOM Element Selectors & Fallback Injection
  // ==========================================
  const searchForm = document.getElementById('people-search') ||
                     document.getElementById('article-search') || 
                     document.getElementById('pseud-search') || 
                     document.querySelector('form.search');
                     
  if (!searchForm) {
    console.warn('[Search System] No compatible search form found on this page. Search initialization aborted.');
    return;
  }

  console.log('[Search System] Target search form detected:', searchForm.id || searchForm.className);

  // Find or dynamically inject the #search-results container
  let searchResultsContainer = document.getElementById('search-results');
  if (!searchResultsContainer) {
    console.log('[Search System] #search-results container not found in HTML. Creating container dynamically...');
    searchResultsContainer = document.createElement('div');
    searchResultsContainer.id = 'search-results';
    searchResultsContainer.setAttribute('aria-live', 'polite');
    searchForm.after(searchResultsContainer);
  }

  const nameInput = document.getElementById('search-name');
  const detailsInput = document.getElementById('search-details');
  const locationInput = document.getElementById('search-locations');
  const singleInput = document.getElementById('search-input');

  const birthAfterInput = document.getElementById('birth-after');
  const birthBeforeInput = document.getElementById('birth-before');
  const deathAfterInput = document.getElementById('death-after');
  const deathBeforeInput = document.getElementById('death-before');

  // Helper: Extract clean path without slashes (e.g. "nq-proto/people/a10926c4c9686279")
  function cleanPath(urlStr) {
    if (!urlStr) return '';
    let path = urlStr;
    try {
      path = new URL(urlStr, window.location.origin).pathname;
    } catch (e) {
      // Fallback for relative strings
    }
    return path.toLowerCase().replace(/^\/+|\/+$/g, '');
  }

  // Helper: Extract terminal ID or slug segment (e.g. "a10926c4c9686279")
  function extractId(urlStr) {
    const cleaned = cleanPath(urlStr);
    const parts = cleaned.split('/');
    return parts.length > 0 ? parts[parts.length - 1] : '';
  }

  // Helper: Extract safe year numbers from "1850", 1850, or "c. 1850"
  function parseYear(val) {
    if (val === null || val === undefined || val === '') return null;
    const match = String(val).match(/\d{3,4}/);
    return match ? parseInt(match[0], 10) : null;
  }

  // Helper: Render the count heading inside #search-results
  function updateCountDisplay(count, isFiltered = false) {
    if (!searchResultsContainer) return;
    searchResultsContainer.innerHTML = '';
    const heading = document.createElement('h2');
    heading.className = 'search-results-count';

    if (!isFiltered) {
      if (count === 1) {
        heading.textContent = '1 contributor.';
      } else {
        heading.textContent = `${count} contributors.`;
      }
    } else {
      if (count === 0) {
        heading.textContent = 'No matching results found.';
      } else if (count === 1) {
        heading.textContent = '1 matching contributor.';
      } else {
        heading.textContent = `${count} matching contributors.`;
      }
    }

    searchResultsContainer.appendChild(heading);
  }

  // Display initial total count on page load
  const initialItems = document.querySelectorAll('.listing ul li');
  updateCountDisplay(initialItems.length, false);

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

      if (maxVal - minVal < minGap) {
        if (e && e.target === minInput) {
          minInput.value = maxVal - minGap;
          minVal = parseInt(minInput.value, 10);
        } else {
          maxInput.value = minVal + minGap;
          maxVal = parseInt(maxInput.value, 10);
        }
      }

      if (outMin) outMin.textContent = minVal;
      if (outMax) outMax.textContent = maxVal;

      if (track) {
        const percent1 = ((minVal - sliderMin) / (sliderMax - sliderMin)) * 100;
        const percent2 = ((maxVal - sliderMin) / (sliderMax - sliderMin)) * 100;
        track.style.background = `linear-gradient(to right, #ddd ${percent1}%, #437456 ${percent1}%, #437456 ${percent2}%, #ddd ${percent2}%)`;
      }
    }

    minInput.addEventListener('input', (e) => {
      if (parseInt(minInput.value, 10) > sliderMax - 100) {
        minInput.style.zIndex = '5';
      } else {
        minInput.style.zIndex = '2';
      }
      updateValues(e);
    });

    maxInput.addEventListener('input', (e) => updateValues(e));
    updateValues();

    return { updateValues };
  }

  const birthSlider = setupDualSlider('birth-after', 'birth-before', 'out-birth-after', 'out-birth-before');
  const deathSlider = setupDualSlider('death-after', 'death-before', 'out-death-after', 'out-death-before');

  if (birthSlider || deathSlider) {
    console.log('[Search System] Dual-thumb range sliders initialized.');
  }

  // ==========================================
  // 3. Search Index Setup (Section-Aware)
  // ==========================================
  let lunrIndex = null;
  let rawData = [];
  let isFetching = false;

  function ensureIndexLoaded() {
    if (lunrIndex) return Promise.resolve();
    if (isFetching) {
      console.log('[Search System] Index fetch already in progress...');
      return Promise.resolve();
    }

    isFetching = true;

    // Resolve index.json relative to the current section path (e.g. /people/index.json)
    let sectionPath = window.location.pathname;
    if (!sectionPath.endsWith('/')) {
      sectionPath += '/';
    }
    const indexPath = sectionPath + 'index.json';

    console.log(`[Search System] Fetching section index from: "${indexPath}"`);
    
    return fetch(indexPath)
      .then(response => {
        if (!response.ok) {
          console.warn(`[Search System] Section index not found at "${indexPath}". Attempting fallback to "index.json"...`);
          return fetch('index.json');
        }
        return response;
      })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        rawData = data;
        console.log(`[Search System] Search index fetched successfully. Loaded ${rawData.length} record(s).`, rawData);

        const isPeopleSection = rawData.length > 0 && ('description' in rawData[0] || 'locations' in rawData[0] || 'gender' in rawData[0]);

        lunrIndex = lunr(function () {
          this.ref('url');

          if (isPeopleSection) {
            console.log('[Search System] Index schema: People section (indexing name, altname, locations, gender, description)');
            this.field('name', { boost: 10 });
            this.field('altname', { boost: 8 });
            this.field('locations', { boost: 7 });
            this.field('gender', { boost: 5 });
            this.field('description', { boost: 5 });
          } else {
            console.log('[Search System] Index schema: Standard section (indexing name, url)');
            this.field('name', { boost: 10 });
            this.field('url');
          }

          rawData.forEach(doc => this.add(doc));
        });

        console.log('[Search System] Lunr index built successfully.');
      })
      .catch(error => console.error('[Search System] Error fetching search index:', error))
      .finally(() => { isFetching = false; });
  }

  searchForm.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', ensureIndexLoaded);
  });

  // ==========================================
  // 4. Form Submit & Filter Handler
  // ==========================================
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.group('[Search Execution]');

    await ensureIndexLoaded();
    if (!rawData || rawData.length === 0) {
      console.warn('[Search System] Aborting search: rawData is empty or failed to load.');
      console.groupEnd();
      return;
    }

    // Parse date range input bounds
    const bAfterVal = birthAfterInput ? parseInt(birthAfterInput.value, 10) : null;
    const bBeforeVal = birthBeforeInput ? parseInt(birthBeforeInput.value, 10) : null;
    const dAfterVal = deathAfterInput ? parseInt(deathAfterInput.value, 10) : null;
    const dBeforeVal = deathBeforeInput ? parseInt(deathBeforeInput.value, 10) : null;

    const bMin = birthAfterInput ? parseInt(birthAfterInput.min, 10) : null;
    const bMax = birthBeforeInput ? parseInt(birthBeforeInput.max, 10) : null;
    const dMin = deathAfterInput ? parseInt(deathAfterInput.min, 10) : null;
    const dMax = deathBeforeInput ? parseInt(deathBeforeInput.max, 10) : null;

    // Check if user has explicitly moved range controls
    const bAfterActive = bAfterVal !== null && bMin !== null && bAfterVal > bMin;
    const bBeforeActive = bBeforeVal !== null && bMax !== null && bBeforeVal < bMax;
    const dAfterActive = dAfterVal !== null && dMin !== null && dAfterVal > dMin;
    const dBeforeActive = dBeforeVal !== null && dMax !== null && dBeforeVal < dMax;

    const hasDateFilters = bAfterActive || bBeforeActive || dAfterActive || dBeforeActive;

    // Extract text query inputs
    const nameQuery = nameInput ? nameInput.value.trim().toLowerCase() : '';
    const detailsQuery = detailsInput ? detailsInput.value.trim().toLowerCase() : '';
    const locationQuery = locationInput ? locationInput.value.trim().toLowerCase() : '';

    // Extract checked gender values (e.g., ['m'], ['f'], or ['unknown'])
    const checkedGenderNodes = searchForm.querySelectorAll('input.gender-checkbox:checked, input[name="gender"]:checked');
    const selectedGenders = Array.from(checkedGenderNodes).map(cb => cb.value.trim().toLowerCase());

    console.log('Query State:', {
      nameQuery,
      detailsQuery,
      locationQuery,
      selectedGenders,
      dateFiltersActive: {
        birthAfter: bAfterActive ? bAfterVal : false,
        birthBefore: bBeforeActive ? bBeforeVal : false,
        deathAfter: dAfterActive ? dAfterVal : false,
        deathBefore: dBeforeActive ? dBeforeVal : false
      }
    });

    if (!nameQuery && !detailsQuery && !locationQuery && selectedGenders.length === 0 && !hasDateFilters) {
      console.log('Form is completely empty. Resetting page visibility to default.');
      resetPageVisibility();
      console.groupEnd();
      return;
    }

    let candidateRefs = new Set();

    // 1. Candidate Selection (Lunr Query Builder API)
    if (nameQuery || detailsQuery || locationQuery || selectedGenders.length > 0) {
      try {
        const lunrMatches = lunrIndex.query(q => {
          if (nameQuery) {
            nameQuery.split(/\s+/).filter(Boolean).forEach(term => {
              q.term(term, { fields: ['name'], boost: 10, usePipeline: false });
              q.term(`${term}*`, { fields: ['name'], boost: 5, usePipeline: false });
              q.term(term, { fields: ['altname'], boost: 8, usePipeline: false });
              q.term(`${term}*`, { fields: ['altname'], boost: 4, usePipeline: false });
            });
          }

          if (locationQuery) {
            locationQuery.split(/\s+/).filter(Boolean).forEach(term => {
              q.term(term, { fields: ['locations'], boost: 10, usePipeline: false });
              q.term(`${term}*`, { fields: ['locations'], boost: 7, usePipeline: false });
              q.term(`*${term}*`, { fields: ['locations'], boost: 5, usePipeline: false });
            });
          }

          if (detailsQuery) {
            detailsQuery.split(/\s+/).filter(Boolean).forEach(term => {
              q.term(term, { fields: ['description'], boost: 5, usePipeline: false });
              q.term(`${term}*`, { fields: ['description'], boost: 3, usePipeline: false });
            });
          }

          if (selectedGenders.length > 0) {
            selectedGenders.forEach(genderTerm => {
              q.term(genderTerm, { fields: ['gender'], boost: 10, usePipeline: false });
            });
          }
        });

        console.log(`Lunr returned ${lunrMatches.length} match(es):`, lunrMatches);
        lunrMatches.forEach(res => candidateRefs.add(res.ref));

      } catch (err) {
        console.warn('Lunr query execution error, falling back to direct JSON array inspection:', err);
        
        const locTerm = locationQuery.toLowerCase();
        const nameTerm = nameQuery.toLowerCase();
        const detTerm = detailsQuery.toLowerCase();

        rawData.forEach(item => {
          const locMatch = !locTerm || (item.locations && item.locations.toLowerCase().includes(locTerm));
          const nameMatch = !nameTerm || (item.name && item.name.toLowerCase().includes(nameTerm)) || (item.altname && item.altname.toLowerCase().includes(nameTerm));
          const detMatch = !detTerm || (item.description && item.description.toLowerCase().includes(detTerm));
          
          const itemGender = (item.gender || '').toLowerCase();
          const genderMatch = selectedGenders.length === 0 || selectedGenders.includes(itemGender);

          if (locMatch && nameMatch && detMatch && genderMatch) {
            candidateRefs.add(item.url);
          }
        });
      }
    } else {
      console.log('No text or category queries present. Evaluating date range filters across all records.');
      rawData.forEach(item => candidateRefs.add(item.url));
    }

    console.log(`Candidate pool before exact post-filtering: ${candidateRefs.size} record(s).`);

    // 2. Exact Post-Filtering (Date Ranges & Strict Gender Checkboxes)
    const dataMap = new Map(rawData.map(item => [item.url, item]));
    const matchingPaths = new Set();
    const matchingIds = new Set();

    candidateRefs.forEach(ref => {
      const item = dataMap.get(ref);
      if (!item) return;

      // Strict Gender Exact Match Filter
      if (selectedGenders.length > 0) {
        const itemGender = (item.gender || '').toLowerCase();
        if (!selectedGenders.includes(itemGender)) return;
      }

      // Date Range Filters
      const birthYear = parseYear(item.birth);
      const deathYear = parseYear(item.death);

      if (bAfterActive && (birthYear === null || birthYear < bAfterVal)) return;
      if (bBeforeActive && (birthYear === null || birthYear > bBeforeVal)) return;
      if (dAfterActive && (deathYear === null || deathYear < dAfterVal)) return;
      if (dBeforeActive && (deathYear === null || deathYear > dBeforeVal)) return;

      matchingPaths.add(cleanPath(item.url));
      matchingIds.add(extractId(item.url));
    });

    console.log(`Final matching path set (${matchingPaths.size}):`, Array.from(matchingPaths));

    applyPageFilter(matchingPaths, matchingIds);
    console.groupEnd();
  });

  // ==========================================
  // 5. Form Reset Handler
  // ==========================================
  searchForm.addEventListener('reset', () => {
    console.log('[Search System] Form reset triggered.');
    resetPageVisibility();
    setTimeout(() => {
      if (birthSlider) birthSlider.updateValues();
      if (deathSlider) deathSlider.updateValues();
    }, 0);
  });

  // ==========================================
  // 6. Result Count & DOM Visibility Logic
  // ==========================================
  function applyPageFilter(matchingPaths, matchingIds) {
    const pageListItems = document.querySelectorAll('.listing ul li');
    const glossarySections = document.querySelectorAll('section[id^="letter-"], section.glossary-group, .listing');

    console.log(`[DOM Filter] Found ${pageListItems.length} candidate list item(s) under .listing ul li.`);

    let matchCount = 0;

    pageListItems.forEach(li => {
      const dataUrl = li.getAttribute('data-url');
      const anchor = li.querySelector('a');
      const hrefUrl = anchor ? anchor.getAttribute('href') : '';

      const cleanDataPath = cleanPath(dataUrl);
      const cleanHrefPath = cleanPath(hrefUrl);
      const dataId = extractId(dataUrl);
      const hrefId = extractId(hrefUrl);

      let isMatch = false;

      if ((cleanDataPath && matchingPaths.has(cleanDataPath)) ||
          (cleanHrefPath && matchingPaths.has(cleanHrefPath)) ||
          (dataId && matchingIds.has(dataId)) ||
          (hrefId && matchingIds.has(hrefId))) {
        isMatch = true;
      } else {
        matchingPaths.forEach(path => {
          if ((cleanDataPath && (cleanDataPath.endsWith(path) || path.endsWith(cleanDataPath))) ||
              (cleanHrefPath && (cleanHrefPath.endsWith(path) || path.endsWith(cleanHrefPath)))) {
            isMatch = true;
          }
        });
      }

      if (isMatch) {
        li.style.display = 'list-item';
        if (li.parentElement) {
          li.parentElement.style.display = '';
        }
        matchCount++;
      } else {
        li.style.display = 'none';
      }
    });

    console.log(`DOM filter complete: ${matchCount} of ${pageListItems.length} list items are visible.`);

    let hiddenSectionsCount = 0;
    glossarySections.forEach(section => {
      const visibleChildren = section.querySelectorAll('li:not([style*="display: none"])');
      if (visibleChildren.length > 0) {
        section.style.display = '';
      } else {
        section.style.display = 'none';
        hiddenSectionsCount++;
      }
    });

    if (glossarySections.length > 0) {
      console.log(`Glossary section visibility updated: ${hiddenSectionsCount} of ${glossarySections.length} section(s) hidden.`);
    }

    updateCountDisplay(matchCount, true);
  }

  function resetPageVisibility() {
    console.log('[Search System] Page visibility reset to show all items and sections.');
    const pageListItems = document.querySelectorAll('.listing ul li');
    const glossarySections = document.querySelectorAll('section[id^="letter-"], section.glossary-group, .listing');

    pageListItems.forEach(li => {
      li.style.display = '';
      if (li.parentElement) li.parentElement.style.display = '';
    });
    glossarySections.forEach(section => section.style.display = '');

    updateCountDisplay(pageListItems.length, false);
  }
});