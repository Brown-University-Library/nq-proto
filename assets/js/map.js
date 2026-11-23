const geojson = "../markers.geojson";
let allGeoJsonData = null;

// Initialize map
var map = L.map("nq-map").setView([51.505, -0.09], 6);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 12,
  minZoom: 2,
}).addTo(map);

function onEachFeature(feature, layer) {
}

// Icon for standalone single markers (no Zoom button)
const singleMarkerIcon = L.divIcon({
  className: "custom-cluster-wrapper",
  html: `
    <div class="cluster-body cluster-no-zoom">
      <svg class="cluster-bg" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="44" fill="#437456"/>
        <text x="50" y="35" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-weight="bold" font-size="20">
          1
        </text>
      </svg>
      <button class="cluster-btn cluster-btn-url" data-url="https://brown.edu" title="Open Link">See results</button>
    </div>
  `,
  iconSize: [128, 128],
  iconAnchor: [64, 64],
});

// Initialize marker cluster group
var markers = L.markerClusterGroup({
  maxClusterRadius: 200,
  zoomToBoundsOnClick: false,
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: false,
  singleMarkerMode: false,
  iconCreateFunction: function(cluster) {
    const isAtMaxZoom = map.getZoom() >= map.getMaxZoom();
    const bounds = cluster.getBounds();
    // True if all points in this cluster share identical coordinates
    const hasIdenticalCoords = bounds.getNorthEast().equals(bounds.getSouthWest());

    const canZoomFurther = !isAtMaxZoom && !hasIdenticalCoords;
    const zoomButtonHtml = canZoomFurther
      ? `<button class="cluster-btn cluster-btn-zoom" title="Zoom to bounds">Zoom</button>`
      : "";

    const bodyClass = hasIdenticalCoords
      ? "cluster-body cluster-no-zoom"
      : "cluster-body";

    return L.divIcon({
      className: "custom-cluster-wrapper",
      html: `
        <div class="${bodyClass}">
          <svg class="cluster-bg" viewBox="0 0 100 100" width="100" height="100">
            <circle cx="50" cy="50" r="44" fill="#437456"/>
            <text x="50" y="35" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-weight="bold" font-size="20">
              ${cluster.getChildCount()}
            </text>
          </svg>
          ${zoomButtonHtml}
          <button class="cluster-btn cluster-btn-url" data-url="https://brown.edu" title="Open Link">See results</button>
        </div>
      `,
      iconSize: [128, 128],
      iconAnchor: [64, 64],
    });
  },
});

// Shared click handler for inner action buttons on both clusters and single markers
function handleMarkerButtonClick(a) {
  const originalEvent = a.originalEvent;
  const targetBtn = originalEvent.target.closest(".cluster-btn");

  if (!targetBtn) return;
  L.DomEvent.stopPropagation(originalEvent);

  if (targetBtn.classList.contains("cluster-btn-zoom") && typeof a.layer.getBounds === "function") {
    map.fitBounds(a.layer.getBounds(), {
      padding: [30, 30],
      maxZoom: map.getMaxZoom(),
    });
  }

  if (targetBtn.classList.contains("cluster-btn-url")) {
    const url = targetBtn.getAttribute("data-url");
    if (url) window.open(url, "_blank");
  }
}

markers.on("clusterclick", handleMarkerButtonClick);
markers.on("click", handleMarkerButtonClick);

map.addLayer(markers);

// Slider and date filter elements
const birthAfterInput = document.getElementById("birth-after");
const birthBeforeInput = document.getElementById("birth-before");
const outBirthAfter = document.getElementById("out-birth-after");
const outBirthBefore = document.getElementById("out-birth-before");

const deathAfterInput = document.getElementById("death-after");
const deathBeforeInput = document.getElementById("death-before");
const outDeathAfter = document.getElementById("out-death-after");
const outDeathBefore = document.getElementById("out-death-before");

const includeUnknownDatesCheckbox = document.getElementById("include-unknown-dates");

// Paint the active region between the two slider thumbs in #437456
function updateSliderTrack(minInput, maxInput) {
  if (!minInput || !maxInput) return;
  const track = minInput.parentElement.querySelector(".slider-track");
  if (!track) return;

  const minVal = parseInt(minInput.min, 10);
  const maxVal = parseInt(minInput.max, 10);
  const percent1 = ((parseInt(minInput.value, 10) - minVal) / (maxVal - minVal)) * 100;
  const percent2 = ((parseInt(maxInput.value, 10) - minVal) / (maxVal - minVal)) * 100;

  track.style.background = `linear-gradient(to right, #d3d3d3 ${percent1}%, #437456 ${percent1}%, #437456 ${percent2}%, #d3d3d3 ${percent2}%)`;
}

// Sync multi-range sliders, prevent thumbs from crossing, and update track fill
function setupDualSlider(minInput, maxInput, minOutput, maxOutput) {
  if (!minInput || !maxInput) return;

  minInput.addEventListener("input", () => {
    if (parseInt(minInput.value, 10) > parseInt(maxInput.value, 10)) {
      minInput.value = maxInput.value;
    }
    minOutput.textContent = minInput.value;
    updateSliderTrack(minInput, maxInput);
  });

  maxInput.addEventListener("input", () => {
    if (parseInt(maxInput.value, 10) < parseInt(minInput.value, 10)) {
      maxInput.value = minInput.value;
    }
    maxOutput.textContent = maxInput.value;
    updateSliderTrack(minInput, maxInput);
  });

  updateSliderTrack(minInput, maxInput);
}

setupDualSlider(birthAfterInput, birthBeforeInput, outBirthAfter, outBirthBefore);
setupDualSlider(deathAfterInput, deathBeforeInput, outDeathAfter, outDeathBefore);

// Helper to check if a feature year falls inside the active slider bounds
function matchesDateRange(rawYear, minInput, maxInput, includeUnknown) {
  const sliderMin = parseInt(minInput.value, 10);
  const sliderMax = parseInt(maxInput.value, 10);
  const defaultMin = parseInt(minInput.min, 10);
  const defaultMax = parseInt(maxInput.max, 10);

  const isDefaultRange = sliderMin === defaultMin && sliderMax === defaultMax;
  const yearMatch = String(rawYear ?? "").trim().match(/\d{4}/);

  // Feature has an empty ("") or missing year
  if (!yearMatch) {
    return isDefaultRange || includeUnknown;
  }

  // If the slider is at its full default span, allow all valid years
  if (isDefaultRange) return true;

  const year = parseInt(yearMatch[0], 10);
  return year >= sliderMin && year <= sliderMax;
}

// Render (or re-render) markers based on gender AND date range filters
function renderMarkers() {
  if (!allGeoJsonData) return;

  const checkedBoxes = Array.from(document.querySelectorAll(".gender-checkbox:checked"));
  const selectedGenders = checkedBoxes.map(cb => cb.value === "unknown" ? "" : cb.value);
  const includeUnknownDates = includeUnknownDatesCheckbox ? includeUnknownDatesCheckbox.checked : false;

  markers.clearLayers();

  var geoLayer = L.geoJSON(allGeoJsonData, {
    pointToLayer: function(feature, latlng) {
      return L.marker(latlng, { icon: singleMarkerIcon });
    },
    onEachFeature: onEachFeature,
    filter: function(feature) {
      const props = feature.properties || {};

      // 1. Gender filter
      if (selectedGenders.length > 0) {
        const featureGender = props.gender ?? "";
        if (!selectedGenders.includes(featureGender)) return false;
      }

      // 2. Birth year range filter
      if (birthAfterInput && birthBeforeInput) {
        if (!matchesDateRange(props.birth_year, birthAfterInput, birthBeforeInput, includeUnknownDates)) return false;
      }

      // 3. Death year range filter
      if (deathAfterInput && deathBeforeInput) {
        if (!matchesDateRange(props.death_year, deathAfterInput, deathBeforeInput, includeUnknownDates)) return false;
      }

      return true;
    }
  });

  markers.addLayer(geoLayer);
}

// Fetch data once and perform initial render
async function addGeoJson() {
  try {
    const response = await fetch(geojson);
    allGeoJsonData = await response.json();
    renderMarkers();
  } catch (error) {
    console.error("Error loading GeoJSON data:", error);
  }
}

// Attach form event listeners
const searchForm = document.getElementById("map-search");

if (searchForm) {
  searchForm.addEventListener("submit", function(e) {
    e.preventDefault();
    renderMarkers();
  });

  searchForm.addEventListener("reset", function() {
    setTimeout(() => {
      if (outBirthAfter && birthAfterInput) outBirthAfter.textContent = birthAfterInput.min;
      if (outBirthBefore && birthBeforeInput) outBirthBefore.textContent = birthBeforeInput.max;
      if (outDeathAfter && deathAfterInput) outDeathAfter.textContent = deathAfterInput.min;
      if (outDeathBefore && deathBeforeInput) outDeathBefore.textContent = deathBeforeInput.max;

      updateSliderTrack(birthAfterInput, birthBeforeInput);
      updateSliderTrack(deathAfterInput, deathBeforeInput);

      renderMarkers();
    }, 0);
  });
}

addGeoJson();