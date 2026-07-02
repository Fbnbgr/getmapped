const mapSource = new ol.source.Vector();
const pointSource = new ol.source.Vector();

const mapLayer = new ol.layer.Vector({
  source: mapSource
});

const pointLayer = new ol.layer.Vector({
  source: pointSource
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

mapLayer.setStyle(defaultMapStyle);
pointLayer.setStyle(defaultPointStyle);

// Range Slider
const yearSlider = document.getElementById("year-slider");
const yearValueLabel = document.getElementById("year-value");

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

// Alle Features zwischenspeichern
let allMapFeatures = [];
let allPointFeatures = [];

// Fetch + Features erzeugen
Promise.all([
  fetch("http://localhost:3000/api/maps").then(res => res.json()),
  fetch("http://localhost:3000/api/points").then(res => res.json())
])
  .then(([mapData, pointData]) => {
    console.log("Anzahl Karten vom Server:", mapData.length);
    console.log("Anzahl Punkte vom Server:", pointData.length);

    mapData.forEach(item => {
      const extent = ol.proj.transformExtent(
        [item.west, item.sued, item.ost, item.nord],
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

    allMapFeatures.forEach(f => {
        const jahr = f.get("jahr");
        const titel = (f.get("titel") || "").toLowerCase();

        const visible =
          jahr >= minYear &&
          jahr <= maxYear &&
          titel.includes(filterText);

        f.setStyle(visible ? null : new ol.style.Style(null));

        if (visible) visibleCount++;
    });

    allPointFeatures.forEach(f => {
        const titel = (f.get("titel") || "").toLowerCase();
        const visible = titel.includes(filterText);

        f.setStyle(visible ? null : new ol.style.Style(null));

        if (visible) visibleCount++;
    });

    // Counter aktualisieren
    document.getElementById("counter").textContent = `${visibleCount} / ${allMapFeatures.length + allPointFeatures.length}`;
}

// Slider: reagiert auf Update
yearSlider.noUiSlider.on("update", applyFilters);

// Textinput: reagiert auf Eingabe
document.getElementById("filter-input").addEventListener("input", applyFilters);


// Hover-Effekt
let hoveredFeature = null;

map.on("pointermove", function (evt) {
  if (evt.dragging) return;

  const feature = map.forEachFeatureAtPixel(
    evt.pixel,
    (candidate) => candidate,
    { hitTolerance: 5 }
  );

  map.getTargetElement().style.cursor = feature ? "pointer" : "";

  if (hoveredFeature && hoveredFeature !== feature) {
    hoveredFeature.setStyle(null);
  }

  if (feature && hoveredFeature !== feature) {
    feature.setStyle(feature.get("kind") === "point" ? hoverPointStyle : hoverMapStyle);
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
  const props = feature.getProperties();
  const title = props.titel || "Ohne Titel";
  const isPoint = props.kind === "point";

  let content = `<strong>${title}</strong><br>`;

  if (isPoint) {
    const [lon, lat] = ol.proj.toLonLat(props.geometry.getCoordinates(), "EPSG:3857");
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
    (candidate) => candidate,
    { hitTolerance: 5 }
  );

  if (feature) {
    popupElement.innerHTML = buildPopupContent(feature);
    overlay.setPosition(evt.coordinate);
  } else {
    overlay.setPosition(undefined);
  }
});

