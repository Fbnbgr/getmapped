const vectorSource = new ol.source.Vector();

const vectorLayer = new ol.layer.Vector({
  source: vectorSource
});

const map = new ol.Map({
  target: "map",
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    }),
    vectorLayer
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([100, 51]),
    zoom: 4
  })
});

// Styles
const defaultStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: "rgba(0,0,255,1)", width: 2 }),
  fill: new ol.style.Fill({ color: "rgb(93, 93, 199, 0.5)" })
});

const hoverStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: "rgba(255,0,0,0.7)", width: 3 }),
  fill: new ol.style.Fill({ color: "rgba(175, 93, 93, 0.5)" })
});

vectorLayer.setStyle(defaultStyle);

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
let allFeatures = [];

// Fetch + Features erzeugen
fetch("http://localhost:3000/api/maps")
  .then(res => res.json())
  .then(data => {
    console.log("Anzahl Karten vom Server:", data.length);
    data.forEach(item => {
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
        massstab: item.massstab
      });

      allFeatures.push(feature);
    });

    vectorSource.addFeatures(allFeatures);
    applyFilters();
  }).catch(err => console.error("Fehler beim Laden der Karten:", err));


// --- Filter Funktion ---
function applyFilters() {
    const filterText = document.getElementById("filter-input").value.toLowerCase();
    const sliderValues = yearSlider.noUiSlider.get().map(Number);
    const minYear = sliderValues[0];
    const maxYear = sliderValues[1];

    yearValueLabel.textContent = `${minYear} - ${maxYear}`;

    let visibleCount = 0;

    allFeatures.forEach(f => {
        const jahr = f.get("jahr");
        const titel = f.get("titel").toLowerCase();

        const visible =
        jahr >= minYear &&
        jahr <= maxYear &&
        titel.includes(filterText);

        f.setStyle(visible ? null : new ol.style.Style(null));

        if (visible) visibleCount++;
    });

    // Counter aktualisieren
    document.getElementById("counter").textContent = `${visibleCount} / ${allFeatures.length}`;
}

// Slider: reagiert auf Update
yearSlider.noUiSlider.on("update", applyFilters);

// Textinput: reagiert auf Eingabe
document.getElementById("filter-input").addEventListener("input", applyFilters);


// Hover-Effekt
let hoveredFeature = null;

map.on("pointermove", function (evt) {
  if (evt.dragging) return;

  const feature = map.forEachFeatureAtPixel(evt.pixel, f => f, { hitTolerance: 5 });

  map.getTargetElement().style.cursor = feature ? "pointer" : "";

  if (hoveredFeature && hoveredFeature !== feature) {
    hoveredFeature.setStyle(null);
  }

  if (feature && hoveredFeature !== feature) {
    feature.setStyle(hoverStyle);
  }

  hoveredFeature = feature;

  const popup = document.createElement('div');
    popup.className = 'popup';
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
  stopEvent: false,
  offset: [0, -10]
});

map.addOverlay(overlay);

map.on("click", function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
  if (feature) {
    const props = feature.getProperties();
    popupElement.innerHTML = `
      <strong>${props.titel}</strong><br>
      Jahr: ${props.jahr}<br>
      Maßstab: ${props.massstab}<br>
      <a href="https://katalog.skd.museum/Record/0-${props.idn}" target="_blank">Link zum Katalog</a>
    `;
    overlay.setPosition(evt.coordinate);
  } else {
    overlay.setPosition(undefined); // Popup ausblenden
  }
});

