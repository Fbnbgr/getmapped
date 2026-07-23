const mapSource = new ol.source.Vector();
const pointSource = new ol.source.Vector();

const mapLayer = new ol.layer.Vector({
  source: mapSource,
  // Große Kartenausschnitte zuerst zeichnen
  renderOrder: (featureA, featureB) => {
    const areaA = ol.extent.getArea(featureA.getGeometry().getExtent());
    const areaB = ol.extent.getArea(featureB.getGeometry().getExtent());
    return areaB - areaA; // absteigend: größte Fläche zuerst
  }
});

// Cluster-Source
const clusterSource = new ol.source.Cluster({
  distance: 1, // sehr klein -> nur (fast) exakt gleiche Koordinaten clustern
  source: pointSource
});

const pointLayer = new ol.layer.Vector({
  source: clusterSource
});

const map = new ol.Map({
  target: "map",
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    }),
    mapLayer,
    pointLayer
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([10, 20]),
    zoom: 2
  })
});

// Styles
const defaultMapStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: "rgba(0,0,255,1)", width: 2 }),
  fill: new ol.style.Fill({ color: "rgb(93, 93, 199, 0.5)" })
});

const hoverMapStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: "rgba(255,0,0,0.7)", width: 3 }),
  fill: new ol.style.Fill({ color: "rgba(175, 93, 93, 0.5)" })
});

const pinSvg = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="40" viewBox="0 0 24 40">
    <path d="M12 1a9 9 0 0 0-9 9c0 6.5 9 19 9 19s9-12.5 9-19a9 9 0 0 0-9-9z" fill="#d62728"/>
    <circle cx="12" cy="10" r="4" fill="white"/>
  </svg>
`);

const defaultPointStyle = new ol.style.Style({
  image: new ol.style.Icon({
    src: `data:image/svg+xml;charset=utf-8,${pinSvg}`,
    anchor: [0.5, 1],
    scale: 0.7
  })
});

const hoverPointStyle = new ol.style.Style({
  image: new ol.style.Icon({
    src: `data:image/svg+xml;charset=utf-8,${pinSvg}`,
    anchor: [0.5, 1],
    scale: 0.85
  })
});

function clusterStyle(feature) {
  const features = feature.get("features");
  const size = features.length;

  if (size === 1) {
    return defaultPointStyle;
  }

  return new ol.style.Style({
    image: new ol.style.Icon({
      src: `data:image/svg+xml;charset=utf-8,${pinSvg}`,
      anchor: [0.5, 1],
      scale: 0.9
    }),
    text: new ol.style.Text({
      text: String(size),
      fill: new ol.style.Fill({ color: "#fff" }),
      offsetY: -25,
      font: "bold 12px sans-serif"
    })
  });
}

function hoverClusterStyle(feature) {
  const features = feature.get("features");
  const size = features.length;

  if (size === 1) {
    return hoverPointStyle;
  }

  return new ol.style.Style({
    image: new ol.style.Icon({
      src: `data:image/svg+xml;charset=utf-8,${pinSvg}`,
      anchor: [0.5, 1],
      scale: 1.05
    }),
    text: new ol.style.Text({
      text: String(size),
      fill: new ol.style.Fill({ color: "#fff" }),
      offsetY: -30,
      font: "bold 13px sans-serif"
    })
  });
}

mapLayer.setStyle(defaultMapStyle);
pointLayer.setStyle(clusterStyle);

// Range Slider
const yearSlider = document.getElementById("year-slider");
const yearValueLabel = document.getElementById("year-value");
const toggleMaps = document.getElementById("toggle-maps");
const togglePoints = document.getElementById("toggle-points");

noUiSlider.create(yearSlider, {
  start: [1700, 2026],
  connect: true,
  step: 1,
  range: {
    min: 1500,
    max: 2026
  },
  tooltips: true,
  format: {
    to: value => Math.round(value),
    from: value => Number(value)
  }
});

// Alle Features zwischenspeichern (Rohdaten, unverändert)
let allMapFeatures = [];
let allPointFeatures = [];

function normalizeBoundingBox(west, ost, nord, sued) {
  const westValue = Number(west);
  const ostValue = Number(ost);
  const nordValue = Number(nord);
  const suedValue = Number(sued);

  if (![westValue, ostValue, nordValue, suedValue].every(Number.isFinite)) {
    return null;
  }

  const minX = Math.min(westValue, ostValue);
  const maxX = Math.max(westValue, ostValue);
  const minY = Math.min(suedValue, nordValue);
  const maxY = Math.max(suedValue, nordValue);

  return [minX, minY, maxX, maxY];
}

function isMeaningfulMapExtent(item) {
  const west = Number(item.west);
  const ost = Number(item.ost);
  const nord = Number(item.nord);
  const sued = Number(item.sued);

  if (![west, ost, nord, sued].every(Number.isFinite)) {
    return false;
  }

  const width = Math.abs(ost - west);
  const height = Math.abs(nord - sued);

  if (width <= 0 || height <= 0) {
    return false;
  }

  if (width >= 140 || height >= 100 || width * height >= 8000) {
    return false;
  }

  return true;
}

// Fetch + Features erzeugen
Promise.all([
  fetch("http://localhost:3000/api/maps").then(res => res.json()),
  fetch("http://localhost:3000/api/points").then(res => res.json())
])
  .then(([mapData, pointData]) => {
    console.log("Anzahl Karten vom Server:", mapData.length);
    console.log("Anzahl Punkte vom Server:", pointData.length);

    mapData.forEach(item => {
      if (!isMeaningfulMapExtent(item)) {
        return;
      }

      const normalizedExtent = normalizeBoundingBox(item.west, item.ost, item.nord, item.sued);
      if (!normalizedExtent) {
        return;
      }

      const extent = ol.proj.transformExtent(
        normalizedExtent,
        "EPSG:4326",
        "EPSG:3857"
      );

      const feature = new ol.Feature({
        geometry: ol.geom.Polygon.fromExtent(extent),
        titel: item.titel,
        jahr: item.jahr,
        idn: item.idn,
        massstab: item.massstab,
        kind: "map"
      });

      allMapFeatures.push(feature);
    });

    pointData.forEach(item => {
      const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([item.laengengrad, item.breitengrad])),
        titel: item.titel,
        idn: item.idn,
        kind: "point"
      });

      allPointFeatures.push(feature);
    });

    mapSource.addFeatures(allMapFeatures);
    pointSource.addFeatures(allPointFeatures);

    const extent = ol.extent.createEmpty();
    allMapFeatures.forEach(feature => ol.extent.extend(extent, feature.getGeometry().getExtent()));
    allPointFeatures.forEach(feature => ol.extent.extend(extent, feature.getGeometry().getExtent()));

    if (!ol.extent.isEmpty(extent)) {
      map.getView().fit(extent, { padding: [20, 20, 20, 20], maxZoom: 6 });
    }

    applyFilters();
  }).catch(err => console.error("Fehler beim Laden der Daten:", err));


// --- Filter Funktion ---
function applyFilters() {
    const filterText = document.getElementById("filter-input").value.toLowerCase();
    const sliderValues = yearSlider.noUiSlider.get().map(Number);
    const minYear = sliderValues[0];
    const maxYear = sliderValues[1];

    yearValueLabel.textContent = `${minYear} - ${maxYear}`;

    let visibleCount = 0;

    // Karten: Style-basiertes Ein-/Ausblenden bleibt wie bisher
    allMapFeatures.forEach(f => {
        const jahr = f.get("jahr");
        const titel = (f.get("titel") || "").toLowerCase();

        const visible =
          toggleMaps.checked &&
          jahr >= minYear &&
          jahr <= maxYear &&
          titel.includes(filterText);

        f.setStyle(visible ? null : new ol.style.Style(null));

        if (visible) visibleCount++;
    });

    // Punkte: Cluster-Source neu befüllen statt einzelner setStyle-Aufrufe,
    // da Clustering auf den tatsächlich in pointSource enthaltenen Features basiert.
    const visiblePointFeatures = allPointFeatures.filter(f => {
        const titel = (f.get("titel") || "").toLowerCase();
        return togglePoints.checked && titel.includes(filterText);
    });

    pointSource.clear();
    pointSource.addFeatures(visiblePointFeatures);
    visibleCount += visiblePointFeatures.length;

    // Counter aktualisieren
    document.getElementById("counter").textContent = `${visibleCount} / ${allMapFeatures.length + allPointFeatures.length}`;
}

// Eingabefelder für Jahr
const yearFromInput = document.getElementById("year-from");
const yearToInput = document.getElementById("year-to");

// Slider: reagiert auf Update
yearSlider.noUiSlider.on("update", function(values) {
  const minYear = Math.round(values[0]);
  const maxYear = Math.round(values[1]);
  yearFromInput.value = minYear;
  yearToInput.value = maxYear;
  applyFilters();
});

// Eingabefelder: reagieren auf Änderung
yearFromInput.addEventListener("change", function() {
  const minYear = parseInt(this.value) || 1500;
  const maxYear = parseInt(yearToInput.value) || 2026;
  if (minYear <= maxYear) {
    yearSlider.noUiSlider.set([minYear, maxYear]);
  }
});

yearToInput.addEventListener("change", function() {
  const minYear = parseInt(yearFromInput.value) || 1500;
  const maxYear = parseInt(this.value) || 2026;
  if (minYear <= maxYear) {
    yearSlider.noUiSlider.set([minYear, maxYear]);
  }
});

document.getElementById("filter-input").addEventListener("input", applyFilters);
toggleMaps.addEventListener("change", applyFilters);
togglePoints.addEventListener("change", applyFilters);

// Hover-Effekt
let hoveredFeature = null;

map.on("pointermove", function (evt) {
  if (evt.dragging) return;

  const feature = map.forEachFeatureAtPixel(
    evt.pixel,
    (candidate) => {
      const kind = candidate.get("kind");
      // Cluster-Features haben kein eigenes "kind" -> immer als Punkt behandeln
      if (kind === "map" && !toggleMaps.checked) {
        return null;
      }
      if (kind !== "map" && !togglePoints.checked) {
        return null;
      }
      return candidate;
    },
    { hitTolerance: 5 }
  );

  map.getTargetElement().style.cursor = feature ? "pointer" : "";

  if (hoveredFeature && hoveredFeature !== feature) {
    hoveredFeature.setStyle(hoveredFeature.get("kind") === "map" ? null : null);
  }

  if (feature && hoveredFeature !== feature) {
    feature.setStyle(feature.get("kind") === "map" ? hoverMapStyle : hoverClusterStyle(feature));
  }

  hoveredFeature = feature;
});

const popupElement = document.createElement("div");
popupElement.className = "popup";
popupElement.style.background = "white";
popupElement.style.padding = "5px";
popupElement.style.border = "1px solid black";
popupElement.style.borderRadius = "5px";

const overlay = new ol.Overlay({
  element: popupElement,
  positioning: "bottom-center",
  stopEvent: true,
  offset: [0, -10]
});

map.addOverlay(overlay);

function buildPopupContent(feature) {
  const clustered = feature.get("features");

  if (clustered && clustered.length > 1) {
    let content = `<strong>${clustered.length} Einträge an diesem Ort</strong><br><ul style="margin:4px 0; padding-left:16px;">`;
    clustered.forEach(f => {
      const props = f.getProperties();
      content += `<li><a href="https://katalog.skd.museum/Record/0-${props.idn}" target="_blank">${props.titel || "Ohne Titel"}</a></li>`;
    });
    content += `</ul>`;
    return content;
  }

  const props = (clustered ? clustered[0] : feature).getProperties();
  const title = props.titel || "Ohne Titel";
  const isPoint = clustered ? true : props.kind === "point";

  let content = `<strong>${title}</strong><br>`;

  if (isPoint) {
    const geom = clustered ? clustered[0].getGeometry() : props.geometry;
    const [lon, lat] = ol.proj.toLonLat(geom.getCoordinates());
    content += `Breitengrad: ${lat.toFixed(2)}<br>`;
    content += `Längengrad: ${lon.toFixed(2)}<br>`;
  } else {
    content += `Jahr: ${props.jahr}<br>`;
    content += `Maßstab: ${props.massstab}<br>`;
  }

  content += `<a href="https://katalog.skd.museum/Record/0-${props.idn}" target="_blank">Link zum Katalog</a>`;

  return content;
}

map.on("click", function (evt) {
  const feature = map.forEachFeatureAtPixel(
    evt.pixel,
    (candidate) => {
      const kind = candidate.get("kind");
      if (kind === "map" && !toggleMaps.checked) {
        return null;
      }
      if (kind !== "map" && !togglePoints.checked) {
        return null;
      }
      return candidate;
    },
    { hitTolerance: 5 }
  );

  if (feature) {
    popupElement.innerHTML = buildPopupContent(feature);
    overlay.setPosition(evt.coordinate);
  } else {
    overlay.setPosition(undefined);
  }
});