const DATA = {
  svAll: 'data/sv_poi_shifted.geojson?v=20260925-crops',
  svNimman: 'data/sv_poi_clip_10m.geojson?v=20260929-category-standard',
  osmNimman: 'data/osm_poi_clip_10m.geojson',
  ggNimman: 'data/gg_poi_clip_10m.geojson',
  buffer: 'data/buffer_10m.geojson',
  road: 'data/road_nimman.geojson',
  municipality: 'data/municipality_boundary.geojson',
  kernelDensity: 'data/kernel_density_sv_poi_10m.png'
};

const COLORS = { sv: '#2563eb', osm: '#dc7928', gg: '#7856b8' };
const SOURCE_LABELS = { sv: 'Street View', osm: 'OpenStreetMap', gg: 'Google Places' };
const CATEGORY_INFO = {
  food_beverage: { th: 'อาหารและเครื่องดื่ม' },
  retail_commerce: { th: 'การค้าปลีกและร้านค้า' },
  personal_service_repair: { th: 'บริการส่วนบุคคลและงานซ่อม' },
  health: { th: 'สุขภาพและการแพทย์' },
  finance_insurance: { th: 'การเงินและประกันภัย' },
  education_religion: { th: 'การศึกษาและศาสนา' },
  office_professional: { th: 'สำนักงานและบริการวิชาชีพ' },
  tourism_culture: { th: 'ที่พัก การท่องเที่ยว และวัฒนธรรม' },
  sport_recreation: { th: 'กีฬาและนันทนาการ' },
  other: { th: 'อื่น ๆ' }
};
const CATEGORY_COLORS = {
  food_beverage: '#c96c1b',
  retail_commerce: '#2b6cb0',
  personal_service_repair: '#805ad5',
  health: '#c53030',
  finance_insurance: '#168a80',
  education_religion: '#8a5a00',
  office_professional: '#4a5568',
  tourism_culture: '#2f855a',
  sport_recreation: '#b83280',
  other: '#737373'
};
const cache = {};
const mapLayerControls = new WeakMap();
let svMap, densityMap, densityPoiLayer, compareLeafletMap, comparePoiLayerGroup, compareLeafletLayer, compareState, categoryChart, sourceChart, summaryReady = false;
let evidenceState;

async function getData(key) {
  if (cache[key]) return cache[key];
  const response = await fetch(DATA[key]);
  if (!response.ok) throw new Error(`ไม่พบไฟล์ ${DATA[key]}`);
  cache[key] = await response.json();
  return cache[key];
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function listValue(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch (_) {}
  return String(value).split(/[;,|]/).map(v => v.trim()).filter(Boolean);
}

function popupHtml(properties) {
  const name = properties.poi_name || properties.poi_names || properties.name || 'ไม่ระบุชื่อ';
  const main = properties.category_std_th || properties.catmain_th || 'ไม่ระบุหมวดหลัก';
  const sub = properties.category_sub_th || properties.cat_sub_th || properties.category_sub || 'ไม่ระบุหมวดย่อย';
  const source = properties.source || 'sv';
  const sourceLabel = SOURCE_LABELS[source] || source;
  const crops = source === 'sv' ? listValue(properties.crop_urls) : [];
  const cropMarkup = source !== 'sv' ? '' : crops.length
    ? `<div class="popup-crops">${crops.map((url, index) => `<button class="evidence-image-button map-popup-image" type="button" data-image-url="${esc(url)}" data-image-caption="${esc(`ภาพป้าย ${index + 1} · ${name}`)}"><img src="${esc(url)}" alt="ภาพป้าย ${index + 1} ของ ${esc(name)}"></button>`).join('')}</div>`
    : '<div class="popup-empty">ยังไม่ได้เชื่อมรูปป้ายของจุดนี้</div>';
  return `<div class="popup-title">${esc(name)}</div><div class="popup-meta"><b>หมวดหลัก:</b> ${esc(main)}<br><b>หมวดย่อย:</b> ${esc(sub)}<br><b>แหล่งข้อมูล:</b> ${esc(sourceLabel)}<br><b>จุดภาพ:</b> ${esc(properties.point_id || properties.poi_id || '-')} ${properties.side ? `· ${esc(properties.side)}` : ''}${properties.poi_count ? `<br><b>จำนวน POI:</b> ${esc(properties.poi_count)}` : ''}</div>${cropMarkup}`;
}

function categoryKey(feature) {
  const p = feature.properties || feature || {};
  const raw = String(p.category_std || p.cat_std || 'other').split(/[;,|]/)[0].trim().toLowerCase();
  if (raw === 'health_medical') return 'health';
  return CATEGORY_INFO[raw] ? raw : 'other';
}

function categoryGlyph(key) {
  const glyphs = {
    food_beverage: '<path d="M9 7v4m-2-4v2.5a2 2 0 0 0 4 0V7m-2 4v9m7-9a2 2 0 0 0-2 2v1.5h4V13a2 2 0 0 0-2-2Zm0 3.5V20"/>',
    retail_commerce: '<path d="M8 10h12l1 9H7l1-9Zm3 0V8a3 3 0 0 1 6 0v2"/>',
    personal_service_repair: '<path d="M17.5 7.5a4 4 0 0 0-5.2 5.2l-5.5 5.5a1.4 1.4 0 0 0 2 2l5.5-5.5a4 4 0 0 0 5.2-5.2l-2.4 2.4-2-2 2.4-2.4Z"/>',
    health: '<path d="M12 7.5h4v3.5h3.5v4H16v3.5h-4V15h-3.5v-4H12z"/>',
    finance_insurance: '<path d="m7 11 7-4 7 4H7Zm1 1.5h12M9 12.5v5m3-5v5m4-5v5m3-5v5M7 19h14"/>',
    education_religion: '<path d="M14 9.5c-2-1.4-4.3-1.4-7-.2v9c2.7-1.2 5-.9 7 .5m0-9.3c2-1.4 4.3-1.4 7-.2v9c-2.7-1.2-5-.9-7 .5m0-9.3v9.3"/>',
    office_professional: '<rect x="7" y="10" width="14" height="10" rx="1.5"/><path d="M11 10V8h6v2m-10 4h14m-8 0v2h2v-2"/>',
    tourism_culture: '<path d="M7 19V9l7-3 7 3v10M10 19v-5h8v5M6 19h16"/>',
    sport_recreation: '<circle cx="14" cy="14" r="7"/><path d="m10 8.3 1.5 3.2-2.2 3.1 3.1 2.2 3.3-1.4 3.6 1.6m-3.7-9.8-.7 3.8 2.7 2.2"/>',
    other: '<path d="M10 10a4 4 0 1 1 6.6 3c-1.5 1.2-2.6 1.8-2.6 3.5m0 3v.1"/>'
  };
  return glyphs[key] || glyphs.other;
}

function markerSvg(source, key, size = 24, useSourceColor = false) {
  const fill = useSourceColor ? COLORS[source] || COLORS.sv : source === 'sv' ? CATEGORY_COLORS[key] || COLORS.sv : COLORS[source] || COLORS.sv;
  const height = Math.round(size * 36 / 28);
  return `<svg class="poi-symbol" data-category="${esc(key)}" data-source="${esc(source)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36" width="${size}" height="${height}" aria-hidden="true"><path d="M14 34.5S3 22.6 3 14.3a11 11 0 1 1 22 0c0 8.3-11 20.2-11 20.2Z" fill="${fill}" stroke="#fff" stroke-width="1.8"/><g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${categoryGlyph(key)}</g></svg>`;
}

function categoryLegendHtml(includeOther = false, useSourceColor = false) {
  return Object.entries(CATEGORY_INFO)
    .filter(([key]) => includeOther || key !== 'other')
    .map(([key, info]) => `<label class="symbol-legend-item"><input type="checkbox" data-category-toggle="${key}" checked><span class="symbol-legend-marker">${markerSvg('sv', key, 18, useSourceColor)}</span><span>${esc(info.th)}</span></label>`).join('');
}

function bindCategoryLegend(container, onChange) {
  container.querySelectorAll('[data-category-toggle]').forEach(toggle => {
    toggle.addEventListener('change', () => onChange(toggle.dataset.categoryToggle, toggle.checked));
  });
}

function pointLayer(feature, latlng, useSourceColor = false) {
  const source = feature.properties.source || 'sv';
  return L.marker(latlng, { icon: L.divIcon({ className: 'poi-marker', html: markerSvg(source, categoryKey(feature), 30, useSourceColor), iconSize: [30, 39], iconAnchor: [15, 37] }) });
}

function addGeoJson(map, geojson, withPopup = true) {
  const layer = L.geoJSON(geojson, {
    pointToLayer: pointLayer,
    onEachFeature: (feature, layerItem) => { if (withPopup) layerItem.bindPopup(popupHtml(feature.properties)); }
  }).addTo(map);
  return layer;
}

function addMapOverlay(map, layer, label) {
  layer.addTo(map);
  mapLayerControls.get(map)?.addOverlay(layer, label);
  return layer;
}

function baseMap(target) {
  const map = L.map(target, { zoomControl: false });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const esriTopoAttribution = 'Tiles &copy; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS and the GIS User Community';
  const esriImageryAttribution = 'Tiles &copy; Esri, Maxar, Earthstar Geographics and the GIS User Community';
  const esriDarkAttribution = 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors and the GIS user community';
  const baseLayers = {
    'ภูมิประเทศ · รายละเอียดพื้นที่': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: esriTopoAttribution }),
    'ภาพถ่ายดาวเทียม': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: esriImageryAttribution }),
    'มืด · เน้นจุด': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 16, attribution: esriDarkAttribution }),
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' })
  };
  baseLayers['ภูมิประเทศ · รายละเอียดพื้นที่'].addTo(map);
  const layerControl = L.control.layers(baseLayers, {}, { position: 'topright', collapsed: true }).addTo(map);
  mapLayerControls.set(map, layerControl);
  return map;
}

async function initStreetView() {
  if (svMap) return;
  svMap = baseMap('svMap');
  const categoryLegend = document.getElementById('svCategoryLegend');
  categoryLegend.innerHTML = categoryLegendHtml();
  const visibleCategories = new Set(Object.keys(CATEGORY_INFO));
  bindCategoryLegend(categoryLegend, (key, visible) => {
    if (visible) visibleCategories.add(key);
    else visibleCategories.delete(key);
    draw();
  });
  const [data, municipality] = await Promise.all([getData('svAll'), getData('municipality')]);
  addMapOverlay(svMap, L.geoJSON(municipality, { style: { color: '#263f37', weight: 2, fillOpacity: 0 } }), 'ขอบเขตเทศบาล');
  const poiLayerGroup = L.layerGroup();
  addMapOverlay(svMap, poiLayerGroup, 'POI · Street View');
  const categories = [...new Set(data.features.map(f => f.properties.category_std_th || f.properties.catmain_th).filter(Boolean))].sort();
  const select = document.getElementById('svCategory');
  categories.forEach(category => select.add(new Option(category, category)));
  let layer;
  function draw() {
    if (layer) poiLayerGroup.removeLayer(layer);
    const query = document.getElementById('svSearch').value.toLowerCase();
    const category = select.value;
    const filtered = data.features.filter(feature => {
      const p = feature.properties;
      const name = String(p.poi_name || p.poi_names || '').toLowerCase();
      const main = p.category_std_th || p.catmain_th || '';
      return visibleCategories.has(categoryKey(feature)) && (!query || name.includes(query)) && (!category || main.includes(category));
    });
    layer = addGeoJson(poiLayerGroup, { type: 'FeatureCollection', features: filtered });
    document.getElementById('svCount').textContent = `แสดง ${filtered.length.toLocaleString()} จุด จาก ${data.features.length.toLocaleString()} จุด`;
    if (filtered.length) svMap.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 15 });
  }
  document.getElementById('svSearch').addEventListener('input', draw);
  select.addEventListener('change', draw);
  draw();
}

async function initDensity() {
  if (densityMap) return;
  densityMap = baseMap('densityMap');
  const kernelBounds = [[18.7567426, 98.9471017], [18.8415526, 99.0293221]];
  addMapOverlay(densityMap, L.imageOverlay(DATA.kernelDensity, kernelBounds, { opacity: 0.82, interactive: false }), 'Kernel Density');
  const [road, municipality, poiData] = await Promise.all([getData('road'), getData('municipality'), getData('svAll')]);
  addMapOverlay(densityMap, L.geoJSON(road, { style: { color: '#4a5650', weight: 1.1, opacity: 0.7 } }), 'ถนนนิมมาน');
  addMapOverlay(densityMap, L.geoJSON(municipality, { style: { color: '#263f37', weight: 2.4, fillOpacity: 0 } }), 'ขอบเขตเทศบาล');
  densityPoiLayer = L.geoJSON(poiData, {
    pointToLayer: (_, latlng) => L.circleMarker(latlng, { radius: 3.4, color: '#ffffff', weight: 1, fillColor: COLORS.sv, fillOpacity: .92, opacity: .95 }),
    onEachFeature: (feature, layer) => layer.bindPopup(popupHtml(feature.properties))
  });
  addMapOverlay(densityMap, densityPoiLayer, 'POI · Street View');
  document.getElementById('densityPoiCount').textContent = `${poiData.features.length.toLocaleString()} จุด`;
  const densityPoiToggle = document.getElementById('densityPoiToggle');
  densityPoiLayer.on('add remove', () => { densityPoiToggle.checked = densityMap.hasLayer(densityPoiLayer); });
  densityPoiToggle.addEventListener('change', event => {
    if (event.target.checked) densityPoiLayer.addTo(densityMap);
    else densityMap.removeLayer(densityPoiLayer);
  });
  densityMap.fitBounds(kernelBounds, { padding: [24, 24] });
}

function compareFeatureName(feature) {
  const p = feature.properties || {};
  return p.poi_name || p.poi_names || p.name || 'ไม่ระบุชื่อ';
}

function compareFeatureCategory(feature) {
  const p = feature.properties || {};
  return p.category_std_th || p.catmain_th || 'ไม่ระบุประเภท';
}

function filteredCompareFeatures() {
  const query = document.getElementById('compareSearch').value.trim().toLowerCase();
  const category = document.getElementById('compareCategory').value;
  const enabledSources = new Set([
    document.getElementById('toggleSv').checked && 'sv',
    document.getElementById('toggleOsm').checked && 'osm',
    document.getElementById('toggleGg').checked && 'gg'
  ].filter(Boolean));
  return compareState.all.filter(feature => {
    const source = feature.properties?.source || 'sv';
    const name = compareFeatureName(feature).toLowerCase();
    const main = compareFeatureCategory(feature);
    return enabledSources.has(source) && compareState.visibleCategories.has(categoryKey(feature)) && (!query || name.includes(query)) && (!category || main === category);
  });
}

function drawCompareMarkers(features, fitBounds = false) {
  if (!compareLeafletMap) return;
  if (compareLeafletLayer) comparePoiLayerGroup.removeLayer(compareLeafletLayer);
  compareLeafletLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    pointToLayer: (feature, latlng) => pointLayer(feature, latlng, true),
    onEachFeature: (feature, layer) => layer.bindPopup(popupHtml(feature.properties))
  }).addTo(comparePoiLayerGroup);
  if (fitBounds && compareLeafletLayer.getLayers().length) {
    compareLeafletMap.fitBounds(compareLeafletLayer.getBounds(), { padding: [38, 38], maxZoom: 17 });
  }
}

function refreshCompare() {
  const features = filteredCompareFeatures();
  const counts = { sv: 0, osm: 0, gg: 0 };
  features.forEach(feature => { counts[feature.properties?.source || 'sv'] += 1; });
  document.getElementById('compareCount').innerHTML = `แสดงทั้งหมด ${features.length.toLocaleString()} จุด<br>Street View: ${counts.sv.toLocaleString()} จุด<br>OpenStreetMap: ${counts.osm.toLocaleString()} จุด<br>Google Places: ${counts.gg.toLocaleString()} จุด`;
  drawCompareMarkers(features);
}

async function initCompare() {
  if (compareState) return;
  const [sv, osm, gg, buffer, road, municipality, svAll] = await Promise.all([getData('svNimman'), getData('osmNimman'), getData('ggNimman'), getData('buffer'), getData('road'), getData('municipality'), getData('svAll')]);
  const imagesByPoiId = new Map(svAll.features.map(feature => [String(feature.properties?.poi_id), feature.properties?.crop_urls]));
  const svWithImages = {
    ...sv,
    features: sv.features.map(feature => {
      const cropUrls = imagesByPoiId.get(String(feature.properties?.poi_id));
      return cropUrls ? { ...feature, properties: { ...feature.properties, crop_urls: cropUrls } } : feature;
    })
  };
  compareState = { sv: svWithImages, osm, gg, buffer, road, municipality, visibleCategories: new Set(Object.keys(CATEGORY_INFO)), all: [...svWithImages.features, ...osm.features, ...gg.features] };
  const categorySelect = document.getElementById('compareCategory');
  const categoryLegend = document.getElementById('compareCategoryLegend');
  categoryLegend.innerHTML = categoryLegendHtml(true, true);
  bindCategoryLegend(categoryLegend, (key, visible) => {
    if (visible) compareState.visibleCategories.add(key);
    else compareState.visibleCategories.delete(key);
    refreshCompare();
  });
  [...new Set(compareState.all.map(compareFeatureCategory).filter(Boolean))].sort().forEach(category => categorySelect.add(new Option(category, category)));
  ['compareSearch', 'compareCategory', 'toggleSv', 'toggleOsm', 'toggleGg'].forEach(id => document.getElementById(id).addEventListener(id === 'compareSearch' ? 'input' : 'change', refreshCompare));
  refreshCompare();
  compareLeafletMap = baseMap('compareMap');
  const bufferLayer = addMapOverlay(compareLeafletMap, L.geoJSON(buffer, { style: { color: '#b5765b', weight: 1.5, fillColor: '#e2bd92', fillOpacity: .18 } }), 'ขอบเขต buffer 10 เมตร');
  addMapOverlay(compareLeafletMap, L.geoJSON(road, { style: { color: '#586660', weight: 2.5, opacity: .85 } }), 'ถนนนิมมาน');
  addMapOverlay(compareLeafletMap, L.geoJSON(municipality, { style: { color: '#748a7c', weight: 1.5, fillOpacity: 0 } }), 'ขอบเขตเทศบาล');
  comparePoiLayerGroup = L.layerGroup();
  addMapOverlay(compareLeafletMap, comparePoiLayerGroup, 'POI · ทั้ง 3 แหล่งข้อมูล');
  if (bufferLayer.getBounds().isValid()) compareLeafletMap.fitBounds(bufferLayer.getBounds(), { padding: [38, 38], maxZoom: 17 });
  drawCompareMarkers(filteredCompareFeatures());
}

async function initSummary() {
  if (summaryReady) return;
  const [sv, osm, gg] = await Promise.all([getData('svNimman'), getData('osmNimman'), getData('ggNimman')]);
  const datasets = { sv: sv.features, osm: osm.features, gg: gg.features };
  const keys = Object.keys(CATEGORY_INFO);
  const labels = keys.map(key => CATEGORY_INFO[key].th);
  const totalsBySource = { sv: 0, osm: 0, gg: 0 };
  const values = { sv: Array(keys.length).fill(0), osm: Array(keys.length).fill(0), gg: Array(keys.length).fill(0) };
  Object.entries(datasets).forEach(([source, features]) => features.forEach(feature => {
    const index = keys.indexOf(categoryKey(feature));
    values[source][index] += 1;
    totalsBySource[source] += 1;
  }));
  const tableBody = document.querySelector('#summaryTable tbody');
  tableBody.innerHTML = keys.map((key, index) => {
    const total = values.sv[index] + values.osm[index] + values.gg[index];
    return `<tr><td>${esc(CATEGORY_INFO[key].th)}</td><td>${values.sv[index]}</td><td>${values.osm[index]}</td><td>${values.gg[index]}</td><td>${total}</td></tr>`;
  }).join('') + `<tr><td><b>รวม</b></td><td><b>${totalsBySource.sv}</b></td><td><b>${totalsBySource.osm}</b></td><td><b>${totalsBySource.gg}</b></td><td><b>${totalsBySource.sv + totalsBySource.osm + totalsBySource.gg}</b></td></tr>`;
  if (window.Chart) {
    categoryChart = new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Street View', data: values.sv, backgroundColor: COLORS.sv },
        { label: 'OpenStreetMap', data: values.osm, backgroundColor: COLORS.osm },
        { label: 'Google Places', data: values.gg, backgroundColor: COLORS.gg }
      ] },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: false, ticks: { maxRotation: 55, minRotation: 35 } }, y: { beginAtZero: true, title: { display: true, text: 'จำนวนจุด POI' }, ticks: { precision: 0 } } } }
    });
    sourceChart = new Chart(document.getElementById('sourceChart'), {
      type: 'doughnut',
      data: { labels: ['Street View', 'OpenStreetMap', 'Google Places'], datasets: [{ data: [totalsBySource.sv, totalsBySource.osm, totalsBySource.gg], backgroundColor: [COLORS.sv, COLORS.osm, COLORS.gg], borderColor: '#ffffff', borderWidth: 2 }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
  summaryReady = true;
}

function evidenceName(feature) {
  const p = feature.properties || {};
  return p.poi_name || p.poi_names || 'ไม่ระบุชื่อ';
}

function evidenceCategory(feature) {
  const p = feature.properties || {};
  return p.category_std_th || p.catmain_th || 'อื่น ๆ';
}

function openEvidenceLightbox(button) {
  const lightbox = document.getElementById('evidenceLightbox');
  const lightboxImage = document.getElementById('evidenceLightboxImage');
  const lightboxCaption = document.getElementById('evidenceLightboxCaption');
  lightboxImage.src = button.dataset.imageUrl;
  lightboxImage.alt = button.dataset.imageCaption;
  lightboxCaption.textContent = button.dataset.imageCaption;
  if (!lightbox.open) lightbox.showModal();
}

function renderEvidence() {
  const holder = document.getElementById('evidenceList');
  const query = document.getElementById('evidenceSearch').value.trim().toLowerCase();
  const category = document.getElementById('evidenceCategory').value;
  const imageFilter = document.getElementById('evidenceImageFilter').value;
  const filtered = evidenceState.features.filter(feature => {
    const hasImages = listValue(feature.properties?.crop_urls).length > 0;
    return (!query || evidenceName(feature).toLowerCase().includes(query))
      && (!category || evidenceCategory(feature) === category)
      && (imageFilter !== 'with-images' || hasImages);
  });
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  evidenceState.page = Math.min(evidenceState.page, pageCount - 1);
  const start = evidenceState.page * pageSize;
  const shown = filtered.slice(start, start + pageSize);
  document.getElementById('evidenceCount').textContent = `แสดง ${shown.length ? `${(start + 1).toLocaleString()}–${(start + shown.length).toLocaleString()}` : '0'} จาก ${filtered.length.toLocaleString()} จุด`;
  holder.innerHTML = shown.map(feature => {
    const p = feature.properties || {};
    const name = evidenceName(feature);
    const crops = listValue(p.crop_urls);
    const cropMarkup = crops.length
      ? `<div class="evidence-crops">${crops.map((url, index) => `<button class="evidence-image-button" type="button" data-image-url="${esc(url)}" data-image-caption="${esc(`ภาพป้าย ${index + 1} · ${name}`)}"><img src="${esc(url)}" alt="ภาพป้าย ${index + 1} ของ ${esc(name)}" loading="lazy"></button>`).join('')}</div>`
      : '<div class="crop-placeholder">ยังไม่พบภาพป้าย</div>';
    const imageNote = crops.length
      ? `<p class="evidence-image-note">พบภาพป้าย ${crops.length} ภาพ</p>`
      : '<p class="evidence-image-note">ยังไม่ได้เชื่อมรูปป้ายของจุดนี้</p>';
    const pointLabel = p.point_id || p.poi_id || '–';
    const [lon, lat] = feature.geometry?.coordinates || [];
    const mapUrl = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`
      : '';
    const mapLink = mapUrl ? `<a class="evidence-map-link" href="${mapUrl}" target="_blank" rel="noopener">⌖ ดูตำแหน่งใน Google Maps</a>` : '';
    return `<article class="evidence-card">${cropMarkup}<div class="evidence-card-head"><span>${esc(evidenceCategory(feature))}</span><small>จุดภาพ ${esc(pointLabel)}</small></div><h2>${esc(name)}</h2><p>${esc(p.category_sub_th || p.cat_sub_th || p.category_sub || 'ไม่ระบุหมวดย่อย')}</p>${imageNote}${mapLink}</article>`;
  }).join('') || '<div class="evidence-empty">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>';
  const pagination = document.getElementById('evidencePagination');
  pagination.hidden = filtered.length <= pageSize;
  document.getElementById('evidencePageLabel').textContent = `หน้า ${evidenceState.page + 1} / ${pageCount}`;
  document.getElementById('evidencePrev').disabled = evidenceState.page === 0;
  document.getElementById('evidenceNext').disabled = evidenceState.page >= pageCount - 1;
}

async function initEvidence() {
  if (evidenceState) return;
  const data = await getData('svAll');
  evidenceState = { features: data.features, page: 0 };
  const categories = [...new Set(data.features.map(evidenceCategory).filter(Boolean))].sort();
  const categorySelect = document.getElementById('evidenceCategory');
  categories.forEach(category => categorySelect.add(new Option(category, category)));
  const imageCount = data.features.reduce((total, feature) => total + listValue(feature.properties?.crop_urls).length, 0);
  document.getElementById('evidenceTotal').textContent = data.features.length.toLocaleString();
  document.getElementById('evidenceImages').textContent = imageCount.toLocaleString();
  ['evidenceSearch', 'evidenceCategory', 'evidenceImageFilter'].forEach(id => document.getElementById(id).addEventListener(id === 'evidenceSearch' ? 'input' : 'change', () => { evidenceState.page = 0; renderEvidence(); }));
  document.getElementById('evidencePrev').addEventListener('click', () => { evidenceState.page -= 1; renderEvidence(); });
  document.getElementById('evidenceNext').addEventListener('click', () => { evidenceState.page += 1; renderEvidence(); });
  renderEvidence();
}

async function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === pageId));
  document.querySelectorAll('#mainNav button').forEach(button => button.classList.toggle('active', button.dataset.page === pageId));
  if (pageId === 'streetview') await initStreetView();
  if (pageId === 'density') await initDensity();
  if (pageId === 'compare') await initCompare();
  if (pageId === 'summary') await initSummary();
  if (pageId === 'evidence') await initEvidence();
}

document.querySelectorAll('#mainNav button').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
document.querySelectorAll('.jump').forEach(button => button.addEventListener('click', () => showPage(button.dataset.go)));
document.addEventListener('click', event => {
  const button = event.target.closest('.evidence-image-button');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  openEvidenceLightbox(button);
});
document.getElementById('evidenceLightboxClose').addEventListener('click', () => document.getElementById('evidenceLightbox').close());
document.getElementById('evidenceLightbox').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });

(async () => {
  try {
    const data = await getData('svAll');
    document.querySelector('#overviewStats article:first-child b').textContent = data.features.length.toLocaleString();
  } catch (error) {
    document.querySelector('#overviewStats article:first-child b').textContent = '—';
  }
})();
