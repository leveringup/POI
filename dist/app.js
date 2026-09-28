const DATA = {
  svAll: 'data/sv_poi_shifted.geojson?v=20260925-crops',
  svNimman: 'data/sv_poi_clip_10m.geojson',
  osmNimman: 'data/osm_poi_clip_10m.geojson',
  ggNimman: 'data/gg_poi_clip_10m.geojson',
  buffer: 'data/buffer_10m.geojson',
  road: 'data/road_nimman.geojson',
  municipality: 'data/municipality_boundary.geojson',
  kernelDensity: 'data/kernel_density_sv_poi_10m.png'
};

const COLORS = { sv: '#176b4e', osm: '#dc7928', gg: '#7856b8' };
const CATEGORY_INFO = {
  food_beverage: { th: 'อาหารและเครื่องดื่ม', shape: 'circle' },
  retail_commerce: { th: 'การค้าปลีกและร้านค้า', shape: 'square' },
  personal_service_repair: { th: 'บริการส่วนบุคคลและงานซ่อม', shape: 'diamond' },
  health: { th: 'สุขภาพและการแพทย์', shape: 'cross' },
  finance_insurance: { th: 'การเงินและประกันภัย', shape: 'hexagon' },
  education_religion: { th: 'การศึกษาและศาสนา', shape: 'triangle' },
  office_professional: { th: 'สำนักงานและบริการวิชาชีพ', shape: 'rounded' },
  tourism_culture: { th: 'ที่พัก การท่องเที่ยว และวัฒนธรรม', shape: 'star' },
  sport_recreation: { th: 'กีฬาและนันทนาการ', shape: 'pentagon' },
  other: { th: 'อื่น ๆ', shape: 'smallcircle' }
};
const cache = {};
let svMap, densityMap, densityPoiLayer, compareMap, compareState, categoryChart, sourceChart, summaryReady = false;
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
  const crops = listValue(properties.crop_urls);
  const cropMarkup = crops.length
    ? `<div class="popup-crops">${crops.map((url, index) => `<button class="evidence-image-button map-popup-image" type="button" data-image-url="${esc(url)}" data-image-caption="${esc(`ภาพป้าย ${index + 1} · ${name}`)}"><img src="${esc(url)}" alt="ภาพป้าย ${index + 1} ของ ${esc(name)}"></button>`).join('')}</div>`
    : '<div class="popup-empty">ยังไม่ได้เชื่อมรูปป้ายของจุดนี้</div>';
  return `<div class="popup-title">${esc(name)}</div><div class="popup-meta"><b>หมวดหลัก:</b> ${esc(main)}<br><b>หมวดย่อย:</b> ${esc(sub)}<br><b>แหล่งข้อมูล:</b> ${esc(properties.source || 'Street View')}<br><b>จุดภาพ:</b> ${esc(properties.point_id || properties.poi_id || '-')} ${properties.side ? `· ${esc(properties.side)}` : ''}${properties.poi_count ? `<br><b>จำนวน POI:</b> ${esc(properties.poi_count)}` : ''}</div>${cropMarkup}`;
}

function categoryKey(feature) {
  const p = feature.properties || feature || {};
  const raw = String(p.category_std || p.cat_std || 'other').split(/[;,|]/)[0].trim().toLowerCase();
  return CATEGORY_INFO[raw] ? raw : 'other';
}

function svgShape(shape) {
  const paths = {
    circle: '<circle cx="12" cy="12" r="8"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="1"/>',
    diamond: '<path d="M12 3 L21 12 L12 21 L3 12 Z"/>',
    cross: '<path d="M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z"/>',
    hexagon: '<path d="M8 3 H16 L21 8 V16 L16 21 H8 L3 16 V8 Z"/>',
    triangle: '<path d="M12 3 L22 21 H2 Z"/>',
    rounded: '<rect x="3" y="6" width="18" height="12" rx="5"/>',
    star: '<path d="M12 2.5 L14.9 8.4 L21.4 9.3 L16.7 13.9 L17.8 20.4 L12 17.3 L6.2 20.4 L7.3 13.9 L2.6 9.3 L9.1 8.4 Z"/>',
    pentagon: '<path d="M12 2.5 L21.5 9.4 L17.9 20.5 H6.1 L2.5 9.4 Z"/>',
    smallcircle: '<circle cx="12" cy="12" r="5.5"/>'
  };
  return paths[shape] || paths.smallcircle;
}

function markerSvg(source, key, size = 24) {
  const fill = COLORS[source] || COLORS.sv;
  const shape = CATEGORY_INFO[key]?.shape || CATEGORY_INFO.other.shape;
  return `<svg class="poi-symbol" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><g fill="${fill}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">${svgShape(shape)}</g></svg>`;
}

function categoryLegendHtml() {
  return Object.entries(CATEGORY_INFO).map(([key, info]) => `<div class="symbol-legend-item">${markerSvg('sv', key, 18)}<span>${esc(info.th)}</span></div>`).join('');
}

function pointLayer(feature, latlng) {
  const source = feature.properties.source || 'sv';
  return L.marker(latlng, { icon: L.divIcon({ className: 'poi-marker', html: markerSvg(source, categoryKey(feature)), iconSize: [24, 24], iconAnchor: [12, 12] }) });
}

function addGeoJson(map, geojson, withPopup = true) {
  const layer = L.geoJSON(geojson, {
    pointToLayer: pointLayer,
    onEachFeature: (feature, layerItem) => { if (withPopup) layerItem.bindPopup(popupHtml(feature.properties)); }
  }).addTo(map);
  return layer;
}

function baseMap(target) {
  const map = L.map(target, { zoomControl: false });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
  return map;
}

async function initStreetView() {
  if (svMap) return;
  svMap = baseMap('svMap');
  document.getElementById('svCategoryLegend').innerHTML = categoryLegendHtml();
  const [data, municipality] = await Promise.all([getData('svAll'), getData('municipality')]);
  L.geoJSON(municipality, { style: { color: '#263f37', weight: 2, fillOpacity: 0 } }).addTo(svMap);
  const categories = [...new Set(data.features.map(f => f.properties.category_std_th || f.properties.catmain_th).filter(Boolean))].sort();
  const select = document.getElementById('svCategory');
  categories.forEach(category => select.add(new Option(category, category)));
  let layer;
  function draw() {
    if (layer) svMap.removeLayer(layer);
    const query = document.getElementById('svSearch').value.toLowerCase();
    const category = select.value;
    const filtered = data.features.filter(feature => {
      const p = feature.properties;
      const name = String(p.poi_name || p.poi_names || '').toLowerCase();
      const main = p.category_std_th || p.catmain_th || '';
      return (!query || name.includes(query)) && (!category || main.includes(category));
    });
    layer = addGeoJson(svMap, { type: 'FeatureCollection', features: filtered });
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
  L.imageOverlay(DATA.kernelDensity, kernelBounds, { opacity: 0.82, interactive: false }).addTo(densityMap);
  const [road, municipality, poiData] = await Promise.all([getData('road'), getData('municipality'), getData('svAll')]);
  L.geoJSON(road, { style: { color: '#4a5650', weight: 1.1, opacity: 0.7 } }).addTo(densityMap);
  L.geoJSON(municipality, { style: { color: '#263f37', weight: 2.4, fillOpacity: 0 } }).addTo(densityMap);
  densityPoiLayer = L.geoJSON(poiData, {
    pointToLayer: (_, latlng) => L.circleMarker(latlng, { radius: 3.4, color: '#ffffff', weight: 1, fillColor: '#176b4e', fillOpacity: .92, opacity: .95 }),
    onEachFeature: (feature, layer) => layer.bindPopup(popupHtml(feature.properties))
  }).addTo(densityMap);
  document.getElementById('densityPoiCount').textContent = `${poiData.features.length.toLocaleString()} จุด`;
  document.getElementById('densityPoiToggle').addEventListener('change', event => {
    if (event.target.checked) densityPoiLayer.addTo(densityMap);
    else densityMap.removeLayer(densityPoiLayer);
  });
  densityMap.fitBounds(kernelBounds, { padding: [24, 24] });
}

function loadGoogleMaps() {
  const key = window.APP_CONFIG?.googleMapsApiKey;
  if (!key) return Promise.reject(new Error('ยังไม่ได้ตั้งค่า Google Maps key'));
  if (window.google?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initGoogleMapsCallback`;
    script.async = true;
    script.onerror = reject;
    window.initGoogleMapsCallback = resolve;
    document.head.appendChild(script);
  });
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
    return enabledSources.has(source) && (!query || name.includes(query)) && (!category || main === category);
  });
}

function drawCompareMarkers(features, fitBounds = false) {
  if (!compareMap) return;
  compareState.markers.forEach(marker => marker.setMap(null));
  compareState.markers = [];
  const bounds = new google.maps.LatLngBounds();
  features.forEach(feature => {
    const [lon, lat] = feature.geometry.coordinates;
    const source = feature.properties?.source || 'sv';
    const marker = new google.maps.Marker({
      position: { lat, lng: lon },
      map: compareMap,
      title: compareFeatureName(feature),
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg(source, categoryKey(feature)))}`,
        scaledSize: new google.maps.Size(24, 24),
        anchor: new google.maps.Point(12, 12)
      }
    });
    const info = new google.maps.InfoWindow({ content: popupHtml(feature.properties) });
    marker.addListener('click', () => info.open({ map: compareMap, anchor: marker }));
    compareState.markers.push(marker);
    bounds.extend(marker.getPosition());
  });
  if (fitBounds && !bounds.isEmpty()) compareMap.fitBounds(bounds, 38);
}

function refreshCompare() {
  const features = filteredCompareFeatures();
  const counts = { sv: 0, osm: 0, gg: 0 };
  features.forEach(feature => { counts[feature.properties?.source || 'sv'] += 1; });
  document.getElementById('compareCount').innerHTML = `แสดงทั้งหมด ${features.length.toLocaleString()} จุด<br>Street View: ${counts.sv.toLocaleString()} จุด<br>OpenStreetMap: ${counts.osm.toLocaleString()} จุด<br>Google Places: ${counts.gg.toLocaleString()} จุด`;
  const list = document.getElementById('compareList');
  const shown = features.slice(0, 30);
  list.innerHTML = shown.map(feature => `<div class="poi-row"><b>${esc(compareFeatureName(feature))}</b><span>${esc(compareFeatureCategory(feature))} · ${esc({ sv: 'Street View', osm: 'OpenStreetMap', gg: 'Google Places' }[feature.properties?.source] || '')}</span></div>`).join('') || '<div class="poi-list-note">ไม่พบ POI ตามเงื่อนไขที่เลือก</div>';
  if (features.length > shown.length) list.insertAdjacentHTML('beforeend', `<div class="poi-list-note">แสดง 30 รายการแรกจาก ${features.length.toLocaleString()} รายการ — จุดทั้งหมดอยู่บนแผนที่</div>`);
  drawCompareMarkers(features);
}

async function initCompare() {
  if (compareState) return;
  const [sv, osm, gg, buffer, road, municipality] = await Promise.all([getData('svNimman'), getData('osmNimman'), getData('ggNimman'), getData('buffer'), getData('road'), getData('municipality')]);
  compareState = { sv, osm, gg, buffer, road, municipality, all: [...sv.features, ...osm.features, ...gg.features], markers: [] };
  const categorySelect = document.getElementById('compareCategory');
  document.getElementById('compareCategoryLegend').innerHTML = categoryLegendHtml();
  [...new Set(compareState.all.map(compareFeatureCategory).filter(Boolean))].sort().forEach(category => categorySelect.add(new Option(category, category)));
  ['compareSearch', 'compareCategory', 'toggleSv', 'toggleOsm', 'toggleGg'].forEach(id => document.getElementById(id).addEventListener(id === 'compareSearch' ? 'input' : 'change', refreshCompare));
  refreshCompare();
  try {
    await loadGoogleMaps();
    document.getElementById('googleKeyMessage')?.remove();
    const first = compareState.all[0];
    if (!first) throw new Error('ไม่พบข้อมูลใน buffer');
    const [lon, lat] = first.geometry.coordinates;
    compareMap = new google.maps.Map(document.getElementById('compareMap'), { center: { lat, lng: lon }, zoom: 16, mapTypeControl: false, streetViewControl: false });
    const bufferLayer = new google.maps.Data({ map: compareMap });
    bufferLayer.addGeoJson(buffer);
    bufferLayer.setStyle({ fillColor: '#ef8abb', fillOpacity: .22, strokeColor: '#bf427e', strokeWeight: 1.5 });
    const roadLayer = new google.maps.Data({ map: compareMap });
    roadLayer.addGeoJson(road);
    roadLayer.setStyle({ strokeColor: '#343a38', strokeWeight: 3 });
    const municipalityLayer = new google.maps.Data({ map: compareMap });
    municipalityLayer.addGeoJson(municipality);
    municipalityLayer.setStyle({ fillOpacity: 0, strokeColor: '#263f37', strokeWeight: 2.2 });
    drawCompareMarkers(filteredCompareFeatures(), true);
  } catch (error) {
    document.getElementById('googleKeyMessage').innerHTML = '<h2>แสดงข้อมูลสรุปแล้ว</h2><p>เพิ่ม Google Maps JavaScript API key ใน <code>config.js</code> เพื่อแสดงจุด POI ทั้ง 3 แหล่งบนแผนที่เดียวกัน</p>';
  }
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
