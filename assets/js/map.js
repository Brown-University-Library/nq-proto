const geojson = "../markers.geojson";
// Initialize map
var map = L.map("nq-map").setView([51.505, -0.09], 6);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 12,
  minZoom: 2,
}).addTo(map);


// Define popup binding function for individual features
function onEachFeature(feature, layer) {
}

// Initialize marker cluster group with custom sub-icon markup
var markers = L.markerClusterGroup({
  maxClusterRadius: 200,
  zoomToBoundsOnClick: false, // Handled manually via inner button
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: false,
  singleMarkerMode: true,
  iconCreateFunction: function(cluster) {
    return L.divIcon({
      className: "custom-cluster-wrapper",
      html: `
        <div class="cluster-body">
          <svg class="cluster-bg" viewBox="0 0 100 100" width="100" height="100">
            <circle cx="50" cy="50" r="44" fill="#437456"/>
            <text x="50" y="35" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-weight="bold" font-size="20">
              ${cluster.getChildCount()}
            </text>
          </svg>

          <!-- Action Button 1: Zoom to Bounds -->
          <button class="cluster-btn cluster-btn-zoom" title="Zoom to bounds">
            Zoom
          </button>

          <!-- Action Button 2: Open External URL -->
          <button class="cluster-btn cluster-btn-url" data-url="https://brown.edu" title="Open Link">
            See results
          </button>
        </div>
      `,
      iconSize: [128, 128],
      iconAnchor: [64, 64],
    });
  },
});

// Event delegation for clicks on inner action buttons
markers.on("click", function (a) {
  const originalEvent = a.originalEvent;
  const targetBtn = originalEvent.target.closest(".cluster-btn");

  if (!targetBtn) return; // Standard click on cluster body (ignored or standard popup)

  // Prevent Leaflet from triggering parent cluster events
  L.DomEvent.stopPropagation(originalEvent);

  // Handle Zoom Button
  if (targetBtn.classList.contains("cluster-btn-zoom")) {
    a.layer.zoomToBounds({ padding: [20, 20] });
  }

  // Handle URL Button
  if (targetBtn.classList.contains("cluster-btn-url")) {
    const url = targetBtn.getAttribute("data-url");
    if (url) {
      window.open(url, "_blank");
    }
  }
});

// Add marker cluster group to map
map.addLayer(markers);

// Fetch data and populate GeoJSON features
async function addGeoJson() {
  try {
    const response = await fetch(geojson);
    const data = await response.json();

    var geoLayer = L.geoJSON(data, {
      onEachFeature: onEachFeature,
    });

    markers.addLayer(geoLayer);
  } catch (error) {
    console.error("Error loading GeoJSON data:", error);
  }
}

addGeoJson();