// Constants

const BASEMAP_SERVER_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const COUNTRY_ZOOM_LEVEL = 7; // Maximum Zoom level at which country icons are shown
const MARKER_VIEW_OVERRIDES = {
  England: {
    coords: [53.07387854356842, -1.4416566517139466],
    zoom: 6,
  },
};

const INIT_FOCUS_COORDS = [0,0],
  INIT_ZOOM = 0;

// Global variables

let forceClusterLayer = false;

// Returns a handler function for when a user clicks on a country icon

function getCountryClickHandler(map, country, group) {
  return () => {
    forceClusterLayer = true; // Change to cluster view regardless of Zoom level

    // If this country has a manual view override, then use it
    // Otherwise, let leaflet decide

    if (MARKER_VIEW_OVERRIDES[country]) {
      map.setView(
        MARKER_VIEW_OVERRIDES[country].coords,
        MARKER_VIEW_OVERRIDES[country].zoom,
      );
    } else {
      const coordinates = group.items
        .map(({ latitude, longitude }) => [
          parseFloat(latitude),
          parseFloat(longitude),
        ])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

      if (coordinates.length) {
        map.fitBounds(L.latLngBounds(coordinates));
        if (false && map.getZoom() <= COUNTRY_ZOOM_LEVEL) {
          map.setZoom(COUNTRY_ZOOM_LEVEL + 1);
        }
      }
    }
    map.fire("zoomend"); // Switch layers if necessary
  };
}

// Returns a handler for when a user click on the search database icon

function getSearchIconClickHandler(map, country, group) {
  return () => {
    event.stopPropagation();
    window.location.href = `https://www.google.com/search?q=${country}`; // TEMP: Just a stand-in
  };
}

// Create a layer for the country level, one marker per country

function getCountryLayer(map, mapData) {
  // Note that Map() is a JS data structure type, _not_ a Leaflet type
  const countriesRegistry = new Map();

  // Only include articles that have a country and valid coordinates

  const mapData_hasCountryCoords = mapData.filter(
    (article) =>
      article.country &&
      article.latitude &&
      article.longitude &&
      Number.isFinite(Number.parseFloat(article.latitude)) &&
      Number.isFinite(Number.parseFloat(article.longitude)),
  );

  // Iterate through articles; collect by country

  for (const article of mapData_hasCountryCoords) {
    const country = article.country.trim();

    // If not in registry, create a new group for it
    if (!countriesRegistry.has(country)) {
      countriesRegistry.set(country, {
        items: [],
        // bounds: L.latLngBounds([]),
        coords: { lat: [], lng: [] },
      });
    }

    const group = countriesRegistry.get(country);
    group.items.push(article);

    // Count every record, but only use valid coordinates for positioning.
    const latitude = Number.parseFloat(article.latitude);
    const longitude = Number.parseFloat(article.longitude);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      // group.bounds.extend([latitude, longitude]);
      group.coords.lat.push(latitude);
      group.coords.lng.push(longitude);
    }
  }

  const layer = L.layerGroup();

  for (const [country, group] of countriesRegistry) {
    // A country needs at least one valid location to appear on the map.

    const count = group.items.length;
    const width = Math.max(150, country.length * 9 + 32);
    const height = 70;

    // Modify this SVG to customize the country cluster icon.

    const temp_container = document.createElement("div");

    temp_container.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 100 100" width="128" height="128">

            <defs>
              <clipPath id="clip0_38004_2530">
                <rect width="24" height="23" fill="white"/>
              </clipPath>
            </defs>
            <g class="cluster-marker">
              <circle cx="50" cy="50" r="44" />

              <text x="50">
                <tspan x="50" y="39">${country}</tspan>
              </text>
              <g clip-path="url(#clip0_38004_2530)" 
                 class="details-icon"
                 transform="scale(0.5) translate(88 96)">
                <rect
                  width="24"
                  height="23"
                  pointer-events="all"
                />
                <path d="M8.23616 7.12458H0.885609C0.389668 7.12458 0 6.72678 0 6.22049C0 5.7142 0.389668 5.31641 0.885609 5.31641H8.23616C8.7321 5.31641 9.12177 5.7142 9.12177 6.22049C9.12177 6.72678 8.7321 7.12458 8.23616 7.12458Z" fill="white"/>
                <path d="M8.23616 12.4215H0.885609C0.389668 12.4215 0 12.0237 0 11.5174C0 11.0111 0.389668 10.6133 0.885609 10.6133H8.23616C8.7321 10.6133 9.12177 11.0111 9.12177 11.5174C9.12177 12.0237 8.7321 12.4215 8.23616 12.4215Z" fill="white"/>
                <path d="M8.23616 1.82575H0.885609C0.389668 1.82575 0 1.42796 0 0.921666C0 0.415377 0.389668 0.0175781 0.885609 0.0175781H8.23616C8.7321 0.0175781 9.12177 0.415377 9.12177 0.921666C9.12177 1.42796 8.7321 1.82575 8.23616 1.82575Z" fill="white"/>
                <path d="M23.0967 17.7027H0.885609C0.389668 17.7027 0 17.3049 0 16.7986C0 16.2923 0.389668 15.8945 0.885609 15.8945H23.0967C23.5926 15.8945 23.9823 16.2923 23.9823 16.7986C23.9823 17.3049 23.5926 17.7027 23.0967 17.7027Z" fill="white"/>
                <path d="M23.0967 22.9996H0.885609C0.389668 22.9996 0 22.6018 0 22.0955C0 21.5892 0.389668 21.1914 0.885609 21.1914H23.0967C23.5926 21.1914 23.9823 21.5892 23.9823 22.0955C23.9823 22.6018 23.5926 22.9996 23.0967 22.9996Z" fill="white"/>
                <path d="M23.2561 0H16.9329C16.2775 0 15.941 0.813679 16.4015 1.2838L18.9343 3.88758L12.1151 10.8491C11.7609 11.2107 11.7609 11.7712 12.1151 12.1329C12.2923 12.3137 12.5225 12.4041 12.7351 12.4041C12.9476 12.4041 13.1956 12.3137 13.355 12.1329L20.1742 5.17138L22.707 7.75708C23.1675 8.2272 23.9646 7.90173 23.9646 7.21462V0.759434C23.9646 0.343553 23.6281 0 23.2207 0H23.2561Z" fill="white"/>
              </g>
            </g>
          </svg>
        `;

    const svg = temp_container.firstElementChild;

    // Add click handlers for country bubbles

    svg
      .querySelector(".cluster-marker")
      .addEventListener(
        "click",
        getCountryClickHandler(map, country, group),
        false,
      );

    svg
      .querySelector("g.details-icon")
      .addEventListener(
        "click",
        getSearchIconClickHandler(map, country, group),
        true,
      );

    // Create Leaflet icon and embed the generated SVG

    const icon = L.divIcon({
      className: "country-summary-icon",
      html: svg,
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2],
    });

    // Calculate the median longitude and latitude for the country,
    // to avoid outliers skewing the position of the marker

    let countryMarkerLat, countryMarkerLon;

    if (MARKER_VIEW_OVERRIDES[country]) {
      [countryMarkerLat, countryMarkerLon] =
        MARKER_VIEW_OVERRIDES[country].coords;
    } else {
      countryMarkerLat = group.coords.lat.sort((a, b) => a - b)[
        Math.floor(group.coords.lat.length / 2)
      ];
      countryMarkerLon = group.coords.lng.sort((a, b) => a - b)[
        Math.floor(group.coords.lng.length / 2)
      ];
    }

    console.log(country, group);

    const marker = L.marker([countryMarkerLat, countryMarkerLon], {
      icon,
      title: `${country}: ${count} items`,
      country,
      items: group.items,
    });

    layer.addLayer(marker);
  }

  return layer;
}

// Create a layer for the region level, which uses clustering

function getClusterLayer(mapData) {
  const layer = L.markerClusterGroup();

  const markers = [];

  for (const item of mapData) {
    const latitude = Number.parseFloat(item.latitude);
    const longitude = Number.parseFloat(item.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      continue;
    }

    markers.push(
      L.marker([latitude, longitude], {
        title: item.standardname || item.markedname || "",
        item,
      }),
    );
  }

  layer.addLayers(markers);

  return layer;
}

// Handler for switching between layers based on zoom level

function initLayerSwitchHandler(map, countryLayer, clusterLayer) {
  let activeLayer = null;

  // Define a function to update the active layer
  // whenever the zoom level changes

  const onZoomChange = () => {
    const zoom = map.getZoom();
    let nextLayer;

    if (zoom <= COUNTRY_ZOOM_LEVEL && !forceClusterLayer) {
      nextLayer = countryLayer;
    } else {
      nextLayer = clusterLayer;
      forceClusterLayer = false;
    }

    // Keep the current layer if the zoom remains in its range;
    // otherwise, switch layers

    if (nextLayer !== activeLayer) {
      if (activeLayer) {
        map.removeLayer(activeLayer);
      }

      map.addLayer(nextLayer);
      activeLayer = nextLayer;
    }
  };

  // Register the zoom change handler to
  // update the active layer whenever the zoom level changes
  map.on("zoomend", onZoomChange);

  // Initialize the layer for the current zoom level
  onZoomChange();
}

// Main exported routine

function initializeMap(domElemId, mapData) {
  const map = L.map(domElemId).setView(
    INIT_FOCUS_COORDS,
    INIT_ZOOM,
  );

  const countryLayer = getCountryLayer(map, mapData);
  const clusterLayer = getClusterLayer(mapData);
  const tileLayer = L.tileLayer(BASEMAP_SERVER_URL, {
    maxZoom: 12,
    minZoom: 2,
  });

  tileLayer.addTo(map);
  countryLayer.addTo(map); // Initially show country layer

  initLayerSwitchHandler(map, countryLayer, clusterLayer);
}

export { initializeMap }
