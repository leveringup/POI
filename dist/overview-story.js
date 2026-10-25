(() => {
  const overview = document.getElementById('overview');
  const examplesRoot = document.getElementById('poiStoryExamples');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopQuery = window.matchMedia('(min-width: 851px)');
  const jsonUrl = new URL('data/poi-story-examples/story-examples.json', document.baseURI);

  if (!overview || !examplesRoot) return;

  let examplesLoaded = false;
  let pageActive = false;
  let stepObserver = null;

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[character]);
  }

  function imageUrl(path) {
    return new URL(path, jsonUrl).href;
  }

  function coordinate(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(6) : 'ไม่ระบุ';
  }

  function renderCrop(crop, example, index) {
    const isFeatured = index === example.featured_crop_index;

    return `<figure class="poi-story-crop"><img src="${escapeHtml(imageUrl(crop.image))}" alt="Crop ${index + 1} ของป้าย ${escapeHtml(example.title)}" loading="lazy"><figcaption><b>Crop ${index + 1}${isFeatured ? ' · ตัวอย่างหลัก' : ''}</b><span>ภาพตัดจากกรอบตรวจจับ</span></figcaption></figure>`;
  }

  function renderExample(example) {
    const crops = Array.isArray(example.crops) ? example.crops : [];
    const featuredIndex = Number.isInteger(example.featured_crop_index)
      && example.featured_crop_index >= 0
      && example.featured_crop_index < crops.length
      ? example.featured_crop_index
      : 0;
    const featuredCrop = crops[featuredIndex];
    const bounds = crops.map((crop, index) => {
      const box = crop.bbox_xyxy_normalized;
      if (!Array.isArray(box) || box.length !== 4 || box.some(value => !Number.isFinite(Number(value)))) return '';

      const [left, top, right, bottom] = box.map(value => Number(value) * 100);
      const featuredClass = index === featuredIndex ? ' class="is-featured"' : '';
      return `<rect${featuredClass} x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"></rect>`;
    }).join('');
    const cropMarkup = crops.map((crop, index) => renderCrop(crop, { ...example, featured_crop_index: featuredIndex }, index)).join('');
    const ocrMarkup = crops.map((crop, index) => {
      const text = crop.ocr_text?.trim() || 'ไม่พบข้อความ OCR ใน Crop นี้';
      return `<div class="poi-story-ocr-result"><b>Crop ${index + 1}</b><span>${escapeHtml(text)}</span></div>`;
    }).join('');
    const llmItems = Array.isArray(example.llm?.pois) ? example.llm.pois : [];
    const llmMarkup = llmItems.length
      ? llmItems.map(item => `<div class="poi-story-llm-item"><b>${escapeHtml(item.poi_name || 'ไม่ระบุชื่อ POI')}</b><span>${escapeHtml(item.category || 'ไม่ระบุหมวดหมู่')}</span></div>`).join('')
      : '<div class="poi-story-llm-item"><b>ไม่พบผล POI จาก LLM</b></div>';
    const before = example.position?.before || {};
    const after = example.position?.after || {};
    const date = escapeHtml(example.imagery_date || 'ไม่ระบุวันที่ภาพ');
    const original = imageUrl(example.original_image.src);
    const cropImage = featuredCrop ? imageUrl(featuredCrop.image) : '';
    const title = escapeHtml(example.title || `POI จุด ${example.point_id}`);
    const cropCount = crops.length;
    const inputText = example.llm?.input_text || 'ไม่มีข้อความ OCR สำหรับส่งต่อให้ LLM';
    const offset = Number(example.position?.offset_meters);
    const offsetLabel = Number.isFinite(offset) ? `${offset} เมตรโดยประมาณ` : 'ระยะเลื่อนไม่ระบุ';
    const stepData = [
      {
        stage: 'original',
        number: '01',
        title: 'ภาพ Street View',
        description: `ภาพต้นฉบับจุด ${escapeHtml(example.point_id)} · ฝั่ง ${escapeHtml(example.side || 'ไม่ระบุ')} · ภาพถ่าย ${date}`
      },
      {
        stage: 'detection',
        number: '02',
        title: 'YOLO ตรวจจับกรอบป้าย',
        description: `กรอบสีเขียวแสดงตำแหน่งป้ายที่ตรวจจับได้ ${cropCount} กรอบบนภาพต้นฉบับ กรอบเด่นใช้เชื่อมไปยังภาพ Crop ตัวอย่าง`
      },
      {
        stage: 'crop',
        number: '03',
        title: 'Crop ภาพบริเวณป้าย',
        description: `ตัดภาพย่อยจากกรอบที่ตรวจจับได้ ${cropCount} ภาพ เพื่อแยกบริเวณป้ายออกมาตรวจสอบ`
      },
      {
        stage: 'ocr',
        number: '04',
        title: 'อ่านข้อความด้วย OCR',
        description: 'อ่านข้อความจากภาพ Crop แต่ละภาพ ผลการอ่านอาจมีข้อความคลาดเคลื่อนหรือไม่พบข้อความ'
      },
      {
        stage: 'llm',
        number: '05',
        title: 'LLM จัดประเภทเบื้องต้น',
        description: `ข้อความที่ส่งให้ LLM: “${escapeHtml(inputText)}”`
      },
      {
        stage: 'position',
        number: '06',
        title: 'เลื่อนพิกัดตามทิศภาพ',
        description: `ปรับตำแหน่งเชิงประมาณ ${offsetLabel} ตาม heading ของภาพ ไม่ใช่พิกัดสำรวจภาคสนาม`
      }
    ];
    const stepsMarkup = stepData.map((step, index) => {
      let detail = '';
      if (step.stage === 'crop') detail = `<div class="poi-story-crops">${cropMarkup || '<p>ไม่มีภาพ Crop ในตัวอย่างนี้</p>'}</div>`;
      if (step.stage === 'ocr') detail = `<div class="poi-story-ocr-results">${ocrMarkup || '<p>ไม่มีผล OCR ในตัวอย่างนี้</p>'}</div>`;
      if (step.stage === 'llm') detail = `<div class="poi-story-llm-result">${llmMarkup}</div><p>ผลจากโมเดล ยังไม่ได้ยืนยันจากการสำรวจภาคสนาม</p>`;
      if (step.stage === 'position') {
        detail = `<div class="poi-story-position"><div class="poi-story-coordinate"><b>ก่อนเลื่อน</b><span>${coordinate(before.lat)}, ${coordinate(before.lon)}</span></div><div class="poi-story-coordinate"><b>หลังเลื่อน</b><span>${coordinate(after.lat)}, ${coordinate(after.lon)}</span></div><span class="poi-story-position-note">ระยะ ${escapeHtml(offsetLabel)} · heading ${escapeHtml(example.position?.heading_degrees ?? 'ไม่ระบุ')}°</span></div>`;
      }

      return `<section class="poi-story-step${index === 0 ? ' is-active' : ''}" data-story-stage="${step.stage}" aria-label="ขั้นตอน ${index + 1}: ${escapeHtml(step.title)}"><div class="poi-story-step-content"><span class="poi-story-step-number">${step.number} / 06</span><h3>${escapeHtml(step.title)}</h3><p>${step.description}</p>${detail}</div></section>`;
    }).join('');

    return `<article class="poi-story-example"><div class="poi-story-visual-column"><div class="poi-story-visual" data-stage="original"><img class="poi-story-original" src="${escapeHtml(original)}" alt="ภาพต้นฉบับ Street View ของ ${title} จุด ${escapeHtml(example.point_id)}" width="${escapeHtml(example.original_image.width)}" height="${escapeHtml(example.original_image.height)}" loading="lazy"><svg class="poi-story-detections" viewBox="0 0 100 100" role="img" aria-label="กรอบตรวจจับป้ายบนภาพต้นฉบับ">${bounds}</svg><span class="poi-story-stage-label">YOLO · DETECTION</span>${featuredCrop ? `<figure class="poi-story-feature-crop"><img src="${escapeHtml(cropImage)}" alt="ภาพ Crop ป้าย ${title}" loading="lazy"><figcaption>Crop ${featuredIndex + 1} · OCR: ${escapeHtml(featuredCrop.ocr_text?.trim() || 'ไม่พบข้อความ')}</figcaption></figure>` : ''}<span class="poi-story-photo-label">${title} · Street View ${date}</span></div></div><div class="poi-story-copy"><h3 class="poi-story-example-heading">จุด ${escapeHtml(example.point_id)} · ${title}</h3>${stepsMarkup}</div></article>`;
  }

  function setActiveStep(step) {
    const example = step.closest('.poi-story-example');
    const visual = example?.querySelector('.poi-story-visual');
    if (!example || !visual) return;

    example.querySelectorAll('.poi-story-step.is-active').forEach(item => item.classList.remove('is-active'));
    step.classList.add('is-active');
    visual.dataset.stage = step.dataset.storyStage;
  }

  function stopStoryEffect() {
    examplesRoot.classList.remove('is-enhanced');
    if (stepObserver) {
      stepObserver.disconnect();
      stepObserver = null;
    }
  }

  function updateStoryEffect() {
    stopStoryEffect();

    if (!pageActive || document.body.classList.contains('effects-paused') || motionPreference.matches || !desktopQuery.matches || !('IntersectionObserver' in window)) return;

    examplesRoot.classList.add('is-enhanced');
    stepObserver = new IntersectionObserver(entries => {
      const visibleSteps = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top + a.boundingClientRect.height / 2 - innerHeight / 2)
          - Math.abs(b.boundingClientRect.top + b.boundingClientRect.height / 2 - innerHeight / 2));

      if (visibleSteps[0]) setActiveStep(visibleSteps[0].target);
    }, { rootMargin: '-35% 0px -35% 0px', threshold: 0 });

    examplesRoot.querySelectorAll('.poi-story-step').forEach(step => stepObserver.observe(step));
  }

  async function loadExamples() {
    if (examplesLoaded) return;

    try {
      const response = await fetch(jsonUrl);
      if (!response.ok) throw new Error(`โหลดชุดตัวอย่างไม่สำเร็จ (${response.status})`);

      const data = await response.json();
      if (!Array.isArray(data.examples) || data.examples.length === 0) {
        throw new Error('ไม่พบรายการตัวอย่างใน story-examples.json');
      }

      examplesRoot.querySelectorAll('.poi-story-status, noscript').forEach(item => item.remove());
      examplesRoot.insertAdjacentHTML('beforeend', data.examples.map(renderExample).join(''));
      examplesRoot.setAttribute('aria-busy', 'false');
      examplesLoaded = true;
      updateStoryEffect();
    } catch (error) {
      console.error('โหลดตัวอย่างกระบวนการ POI ไม่สำเร็จ', error);
      const status = examplesRoot.querySelector('.poi-story-status') || document.createElement('p');
      status.className = 'poi-story-status';
      status.setAttribute('role', 'alert');
      status.textContent = 'โหลดตัวอย่างกระบวนการไม่สำเร็จ กรุณาตรวจสอบไฟล์ data/poi-story-examples/story-examples.json และลองเปิดหน้านี้ผ่านเว็บเซิร์ฟเวอร์อีกครั้ง';
      if (!status.isConnected) examplesRoot.replaceChildren(status);
      examplesRoot.setAttribute('aria-busy', 'false');
    }
  }

  function updatePageState() {
    pageActive = overview.classList.contains('active');
    if (pageActive) {
      loadExamples();
      updateStoryEffect();
    } else {
      stopStoryEffect();
    }
  }

  const pageObserver = new MutationObserver(updatePageState);
  pageObserver.observe(overview, { attributes: true, attributeFilter: ['class'] });
  motionPreference.addEventListener('change', updateStoryEffect);
  desktopQuery.addEventListener('change', updateStoryEffect);
  document.addEventListener('poi-motion-change', updateStoryEffect);
  updatePageState();
})();
