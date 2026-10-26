document.addEventListener('DOMContentLoaded', () => {
  console.log('[Search System] Initializing hybrid Lunr + Items.js search engine...');

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

  // Find or dynamically inject the #count container
  let searchResultsContainer = document.getElementById('count');
  if (!searchResultsContainer) {
    console.log('[Search System] #count container not found in HTML. Creating container dynamically...');
    searchResultsContainer = document.createElement('div');
    searchResultsContainer.id = 'count';
    searchResultsContainer.setAttribute('aria-live', 'polite');
    searchForm.after(searchResultsContainer);
  }

  // Find or dynamically inject the #terms container
  let termsContainer = document.getElementById('terms');
  if (!termsContainer) {
    termsContainer = document.createElement('div');
    termsContainer.id = 'terms';
    termsContainer.className = 'search-summary-statement';
    termsContainer.setAttribute('aria-live', 'polite');
    searchResultsContainer.after(termsContainer);
  }

  const nameInput = document.getElementById('search-name');
  const detailsInput = document.getElementById('search-details');
  const locationInput = document.getElementById('search-locations');
  const countrySelect = document.getElementById('search-country');
  const singleInput = document.getElementById('search-input');

  // People Date Inputs
  const birthAfterInput = document.getElementById('birth-after');
  const birthBeforeInput = document.getElementById('birth-before');
  const deathAfterInput = document.getElementById('death-after');
  const deathBeforeInput = document.getElementById('death-before');

  // Pseudonym Active Date Inputs
  const activeAfterInput = document.getElementById('active-after');
  const activeBeforeInput = document.getElementById('active-before');

  // Helper: Normalize strings or arrays safely into lowercased string
  function normalizeString(val) {
    if (!val) return '';
    if (Array.isArray(val)) return val.join(' ').toLowerCase();
    return String(val).toLowerCase();
  }

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

  // Helper: Extract safe year numbers
  function parseYear(val) {
    if (val === null || val === undefined || val === '') return null;
    const match = String(val).match(/\d{3,4}/);
    return match ? parseInt(match[0], 10) : null;
  }

  // Helper: Parse active dates ("1870" or "1870 - 1883") into numeric start and end
  function parseActiveSpan(val) {
    if (!val) return { active_start: null, active_end: null };
    const matches = String(val).match(/\d{3,4}/g);
    if (!matches || matches.length === 0) return { active_start: null, active_end: null };

    if (matches.length === 1) {
      const yr = parseInt(matches[0], 10);
      return { active_start: yr, active_end: yr };
    }

    const start = parseInt(matches[0], 10);
    const end = parseInt(matches[1], 10);
    return { active_start: Math.min(start, end), active_end: Math.max(start, end) };
  }

  // Helper: Render primary count heading inside #count
  function updateCountDisplay(count, isFiltered = false) {
    if (!searchResultsContainer) return;
    searchResultsContainer.innerHTML = '';
    const heading = document.createElement('h2');
    heading.className = 'search-results-count';

    if (!isFiltered) {
      heading.textContent = count === 1 ? '1 item.' : `${count} items.`;
    } else {
      if (count === 0) {
        heading.textContent = 'No matching results found.';
      } else if (count === 1) {
        heading.textContent = '1 matching item.';
      } else {
        heading.textContent = `${count} matching items.`;
      }
    }

    searchResultsContainer.appendChild(heading);
  }

  // Helper: Format active parameters into readable $terms string
  function getFormattedTerms(filterState) {
    const activeTerms = [];

    if (filterState.nameQuery) activeTerms.push(`"${filterState.nameQuery}"`);
    if (filterState.locationQuery) activeTerms.push(`location "${filterState.locationQuery}"`);
    if (filterState.selectedCountry) activeTerms.push(`country "${filterState.selectedCountry}"`);
    if (filterState.detailsQuery) activeTerms.push(`description "${filterState.detailsQuery}"`);

    if (filterState.selectedGenders && filterState.selectedGenders.length > 0) {
      activeTerms.push(`gender (${filterState.selectedGenders.join(', ').toUpperCase()})`);
    }

    const dateParts = [];
    if (filterState.dateFiltersActive.birthAfter) dateParts.push(`born after ${filterState.dateFiltersActive.birthAfter}`);
    if (filterState.dateFiltersActive.birthBefore) dateParts.push(`born before ${filterState.dateFiltersActive.birthBefore}`);
    if (filterState.dateFiltersActive.deathAfter) dateParts.push(`died after ${filterState.dateFiltersActive.deathAfter}`);
    if (filterState.dateFiltersActive.deathBefore) dateParts.push(`died before ${filterState.dateFiltersActive.deathBefore}`);

    if (filterState.activeDatesActive.activeAfter) dateParts.push(`active after ${filterState.activeDatesActive.activeAfter}`);
    if (filterState.activeDatesActive.activeBefore) dateParts.push(`active before ${filterState.activeDatesActive.activeBefore}`);

    if (dateParts.length > 0) {
      activeTerms.push(dateParts.join(' and '));
    }

    if (activeTerms.length === 0) return '';
    if (activeTerms.length === 1) return activeTerms[0];
    if (activeTerms.length === 2) return `${activeTerms[0]} and ${activeTerms[1]}`;

    return `${activeTerms.slice(0, -1).join(', ')}, and ${activeTerms[activeTerms.length - 1]}`;
  }

  // Helper: Render secondary dynamic "Your search for $terms..." statement inside #terms
  function updateTermsSummaryDisplay(count, filterState) {
    if (!termsContainer) return;

    const termsStr = getFormattedTerms(filterState);
    if (!termsStr) {
      termsContainer.innerHTML = '';
      return;
    }

    const itemText = count === 1 ? 'item' : 'items';
    termsContainer.innerHTML = `<p class="summary-line">Your search for <strong>${termsStr}</strong> found <strong>${count}</strong> ${itemText}.</p>`;
  }

  // Display initial total count on page load
  const initialItems = document.querySelectorAll('.listing ul li');
  updateCountDisplay(initialItems.length, false);

  // ==========================================
  // 2A. Dual-Thumb Slider Controller
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
  const activeSlider = setupDualSlider('active-after', 'active-before', 'out-active-after', 'out-active-before');

  if (birthSlider || deathSlider || activeSlider) {
    console.log('[Search System] Dual-thumb range sliders initialized.');
  }

  // ==========================================
  // 2B. Uppercase Letter Anchor Navigation Handler
  // ==========================================
  const alphabetSelect = document.getElementById('alphabet-select');
  if (alphabetSelect) {
    alphabetSelect.addEventListener('change', (e) => {
      const targetHash = e.target.value;
      if (!targetHash) return;

      const rawId = targetHash.replace(/^#/, '');

      const targetSection = document.getElementById(rawId) || 
                            document.querySelector(`[id="${CSS.escape(rawId)}"]`);

      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, null, targetHash);
        console.log(`[Alphabet Nav] Jumped to section: #${rawId}`);
      } else {
        console.warn(`[Alphabet Nav] Target section "#${rawId}" not found in DOM.`);
      }
    });
  }

  // ==========================================
  // 3. Search Engine Setup (Lunr.js + Items.js)
  // ==========================================
  let lunrIndex = null;
  let itemsjsInstance = null;
  let rawData = [];
  let isFetching = false;

  function ensureIndexLoaded() {
    if (lunrIndex && itemsjsInstance) return Promise.resolve();
    if (isFetching) {
      console.log('[Search System] Index fetch already in progress...');
      return Promise.resolve();
    }

    isFetching = true;

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
        // Pre-process raw data to enrich with numeric fields for Items.js range filters
        rawData = data.map(item => {
          const birthYr = parseYear(item.birth);
          const deathYr = parseYear(item.death);
          const activeSpan = parseActiveSpan(item.active);

          // Convert space/comma-delimited countries into arrays for Items.js facets
          let countryArray = [];
          if (Array.isArray(item.country)) {
            countryArray = item.country.map(c => String(c).trim()).filter(Boolean);
          } else if (item.country) {
            countryArray = String(item.country).split(/\s+/).map(c => c.trim()).filter(Boolean);
          }

          return {
            ...item,
            birth_num: birthYr,
            death_num: deathYr,
            active_start: activeSpan.active_start,
            active_end: activeSpan.active_end,
            country_facet: countryArray,
            gender_facet: item.gender ? [String(item.gender).trim().toLowerCase()] : []
          };
        });

        console.log(`[Search System] Loaded and enriched ${rawData.length} record(s).`, rawData);

        const hasPeopleFields = rawData.length > 0 && ('description' in rawData[0] || 'locations' in rawData[0] || 'gender' in rawData[0] || 'country' in rawData[0]);
        const hasPseudonymFields = rawData.length > 0 && ('active' in rawData[0]);

        // A. Build Lunr.js Index for Text Search
        lunrIndex = lunr(function () {
          this.ref('url');

          if (hasPeopleFields) {
            console.log('[Search System] Lunr Schema: People section');
            this.field('name', { boost: 10 });
            this.field('altname', { boost: 8 });
            this.field('locations', { boost: 7 });
            this.field('country', { boost: 7 });
            this.field('gender', { boost: 5 });
            this.field('description', { boost: 5 });
          } else if (hasPseudonymFields) {
            console.log('[Search System] Lunr Schema: Pseudonym section');
            this.field('name', { boost: 10 });
            this.field('active', { boost: 5 });
            this.field('url');
          } else {
            console.log('[Search System] Lunr Schema: Standard section');
            this.field('name', { boost: 10 });
            this.field('url');
          }

          rawData.forEach(doc => {
            const docCopy = { ...doc };
            if (Array.isArray(docCopy.country)) {
              docCopy.country = docCopy.country.join(' ');
            }
            this.add(docCopy);
          });
        });

        // B. Build Items.js Instance for Gender, Country, and Lifespan Ranges
        itemsjsInstance = itemsjs(rawData, {
          native_search_enabled: false,
          aggregations: {
            country_facet: {
              title: 'Country',
              size: 50,
              conjunction: false
            },
            gender_facet: {
              title: 'Gender',
              size: 10,
              conjunction: false
            },
            birth_num: {
              title: 'Birth Year',
              type: 'range'
            },
            death_num: {
              title: 'Death Year',
              type: 'range'
            },
            active_start: {
              title: 'Active Start Year',
              type: 'range'
            },
            active_end: {
              title: 'Active End Year',
              type: 'range'
            }
          }
        });

        console.log('[Search System] Lunr.js and Items.js engines built successfully.');
      })
      .catch(error => console.error('[Search System] Error fetching search index:', error))
      .finally(() => { isFetching = false; });
  }

  // Pre-load search index when focusing inputs inside search form
  searchForm.querySelectorAll('input, select').forEach(control => {
    control.addEventListener('focus', ensureIndexLoaded);
  });

  // ==========================================
  // 4. Form Submit & Combined Search Engine
  // ==========================================
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.group('[Search Execution]');

    await ensureIndexLoaded();
    if (!rawData || rawData.length === 0 || !itemsjsInstance) {
      console.warn('[Search System] Aborting search: rawData is empty or engines failed to load.');
      console.groupEnd();
      return;
    }

    // Parse People date range input bounds
    const bAfterVal = birthAfterInput ? parseInt(birthAfterInput.value, 10) : null;
    const bBeforeVal = birthBeforeInput ? parseInt(birthBeforeInput.value, 10) : null;
    const dAfterVal = deathAfterInput ? parseInt(deathAfterInput.value, 10) : null;
    const dBeforeVal = deathBeforeInput ? parseInt(deathBeforeInput.value, 10) : null;

    const bMin = birthAfterInput ? parseInt(birthAfterInput.min, 10) : null;
    const bMax = birthBeforeInput ? parseInt(birthBeforeInput.max, 10) : null;
    const dMin = deathAfterInput ? parseInt(deathAfterInput.min, 10) : null;
    const dMax = deathBeforeInput ? parseInt(deathBeforeInput.max, 10) : null;

    const bAfterActive = bAfterVal !== null && bMin !== null && bAfterVal > bMin;
    const bBeforeActive = bBeforeVal !== null && bMax !== null && bBeforeVal < bMax;
    const dAfterActive = dAfterVal !== null && dMin !== null && dAfterVal > dMin;
    const dBeforeActive = dBeforeVal !== null && dMax !== null && dBeforeVal < dMax;

    const hasPeopleDateFilters = bAfterActive || bBeforeActive || dAfterActive || dBeforeActive;

    // Parse Pseudonym active date range bounds
    const actAfterVal = activeAfterInput ? parseInt(activeAfterInput.value, 10) : null;
    const actBeforeVal = activeBeforeInput ? parseInt(activeBeforeInput.value, 10) : null;
    const actMin = activeAfterInput ? parseInt(activeAfterInput.min, 10) : null;
    const actMax = activeBeforeInput ? parseInt(activeBeforeInput.max, 10) : null;

    const actAfterActive = actAfterVal !== null && actMin !== null && actAfterVal > actMin;
    const actBeforeActive = actBeforeVal !== null && actMax !== null && actBeforeVal < actMax;

    const hasActiveDateFilters = actAfterActive || actBeforeActive;

    // Extract text and dropdown query inputs
    const nameQuery = nameInput ? nameInput.value.trim().toLowerCase() : (singleInput ? singleInput.value.trim().toLowerCase() : '');
    const detailsQuery = detailsInput ? detailsInput.value.trim().toLowerCase() : '';
    const locationQuery = locationInput ? locationInput.value.trim().toLowerCase() : '';
    const selectedCountry = countrySelect ? countrySelect.value.trim() : '';

    // Extract checked gender values
    const checkedGenderNodes = searchForm.querySelectorAll('input.gender-checkbox:checked, input[name="gender"]:checked');
    const selectedGenders = Array.from(checkedGenderNodes).map(cb => cb.value.trim().toLowerCase());

    const filterState = {
      nameQuery,
      detailsQuery,
      locationQuery,
      selectedCountry,
      selectedGenders,
      dateFiltersActive: {
        birthAfter: bAfterActive ? bAfterVal : false,
        birthBefore: bBeforeActive ? bBeforeVal : false,
        deathAfter: dAfterActive ? dAfterVal : false,
        deathBefore: dBeforeActive ? dBeforeVal : false
      },
      activeDatesActive: {
        activeAfter: actAfterActive ? actAfterVal : false,
        activeBefore: actBeforeActive ? actBeforeVal : false
      }
    };

    console.log('Query State:', filterState);

    const hasTextQuery = nameQuery || detailsQuery || locationQuery;

    if (!hasTextQuery && !selectedCountry && selectedGenders.length === 0 && !hasPeopleDateFilters && !hasActiveDateFilters) {
      console.log('Form is completely empty. Resetting page visibility to default.');
      resetPageVisibility();
      console.groupEnd();
      return;
    }

    // STEP 1: Lunr.js Full-Text Search Execution
    let lunrMatchedUrls = null;

    if (hasTextQuery) {
      try {
        const lunrMatches = lunrIndex.query(q => {
          if (nameQuery) {
            nameQuery.split(/\s+/).filter(Boolean).forEach(term => {
              q.term(term, { fields: ['name'], boost: 10, usePipeline: false });
              q.term(`${term}*`, { fields: ['name'], boost: 5, usePipeline: false });
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
        });

        lunrMatchedUrls = new Set(lunrMatches.map(res => res.ref));
        console.log(`Lunr.js text query returned ${lunrMatchedUrls.size} candidate match(es).`);

      } catch (err) {
        console.warn('Lunr.js execution error, bypassing text candidate filter:', err);
      }
    }

    // STEP 2: Items.js Facet and Range Query Construction
    const itemsFilters = {};

    if (selectedCountry) {
      itemsFilters.country_facet = [selectedCountry];
    }

    if (selectedGenders.length > 0) {
      itemsFilters.gender_facet = selectedGenders;
    }

    // People Birth / Death Numeric Ranges
    if (bAfterActive || bBeforeActive) {
      itemsFilters.birth_num = {
        gte: bAfterActive ? bAfterVal : bMin,
        lte: bBeforeActive ? bBeforeVal : bMax
      };
    }

    if (dAfterActive || dBeforeActive) {
      itemsFilters.death_num = {
        gte: dAfterActive ? dAfterVal : dMin,
        lte: dBeforeActive ? dBeforeVal : dMax
      };
    }

    // Pseudonym Active Date Range Overlap Evaluation
    if (hasActiveDateFilters) {
      const filterMin = actAfterActive ? actAfterVal : actMin;
      const filterMax = actBeforeActive ? actBeforeVal : actMax;

      itemsFilters.active_end = { gte: filterMin };
      itemsFilters.active_start = { lte: filterMax };
    }

    // STEP 3: Execute Items.js Search Pass
    const itemsjsResult = itemsjsInstance.search({
      per_page: rawData.length,
      filters: itemsFilters
    });

    console.log(`Items.js filter query returned ${itemsjsResult.data.items.length} item(s):`, itemsjsResult);

    // STEP 4: Intersect Lunr.js Text Candidates with Items.js Results
    const matchingPaths = new Set();
    const matchingIds = new Set();

    itemsjsResult.data.items.forEach(item => {
      // If Lunr ran a text query, ensure item URL is in the Lunr candidate set
      if (lunrMatchedUrls && !lunrMatchedUrls.has(item.url)) {
        return;
      }

      matchingPaths.add(cleanPath(item.url));
      matchingIds.add(extractId(item.url));
    });

    console.log(`Final combined matching path set (${matchingPaths.size}):`, Array.from(matchingPaths));

    applyPageFilter(matchingPaths, matchingIds, filterState);
    console.groupEnd();
  });

  // ==========================================
  // 5. Form Reset Handler
  // ==========================================
  searchForm.addEventListener('reset', () => {
    console.log('[Search System] Form reset triggered.');
    resetPageVisibility();
    if (alphabetSelect) alphabetSelect.selectedIndex = 0;
    setTimeout(() => {
      if (birthSlider) birthSlider.updateValues();
      if (deathSlider) deathSlider.updateValues();
      if (activeSlider) activeSlider.updateValues();
    }, 0);
  });

  // ==========================================
  // 6. Result Count & DOM Visibility Logic
  // ==========================================
  function applyPageFilter(matchingPaths, matchingIds, filterState = null) {
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

    // Update primary count heading AND secondary terms summary line in #terms
    updateCountDisplay(matchCount, true);
    if (filterState) {
      updateTermsSummaryDisplay(matchCount, filterState);
    }
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
    if (termsContainer) {
      termsContainer.innerHTML = '';
    }
  }
});