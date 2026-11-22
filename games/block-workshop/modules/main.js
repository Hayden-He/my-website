import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, EdgesGeometry, GridHelper, HemisphereLight, InstancedMesh,
  LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera,
  PlaneGeometry, Points, PointsMaterial, Raycaster, Scene, Vector2, Vector3, WebGLRenderer,
} from './vendor/three.min.js';
import {
  SIZE, MAX_HEIGHT, MATERIALS, BRIDGE_PLAN, bridgeProgress, canPlace, createPracticeWorld, hasBlock, placeBlock, removeBlock,
} from './world.js';
import { blockFinish, editFeedback } from './finishes.js';
import { bindProjects } from './project-panel.js';

const t = (key, params) => window.I18N.t(key, params);
const canvas = document.querySelector('#world');
const stage = canvas.parentElement;
const toolButtons = [...document.querySelectorAll('[data-tool]')];
const materialButtons = [...document.querySelectorAll('[data-material]')];
const turnButtons = [...document.querySelectorAll('[data-turn]')];
const overview = document.querySelector('#workshop-overview');
const viewButtons = [...turnButtons, overview];
const controls = [...toolButtons, ...materialButtons, ...viewButtons, ...document.querySelectorAll('.workshop-panel .workshop-actions button')];
const sound = document.querySelector('#workshop-sound');
const help = document.querySelector('#workshop-help');
const status = document.querySelector('#workshop-status');
const blueprint = document.querySelector('#workshop-blueprint');
const workshop = canvas.closest('.workshop');
const tip = document.querySelector('#workshop-gesture-tip');
const dismissTip = document.querySelector('#workshop-dismiss-tip');
const tipKey = 'game_tutorial_block-workshop_gestures';

for (const button of materialButtons) {
  button.style.setProperty('--material-color', MATERIALS[button.dataset.material]);
}

const gl = canvas.getContext('webgl2', { antialias: true });
if (gl) {
  start(new WebGLRenderer({ canvas, context: gl }));
} else {
  const message = document.querySelector('#graphics-error');
  const showError = () => { message.textContent = t('此设备暂无法运行 3D 场景。'); };
  for (const button of controls) button.disabled = true;
  canvas.hidden = true;
  status.hidden = true;
  message.hidden = false;
  showError();
  document.addEventListener('i18n:change', showError);
}

function start(renderer) {
  let blocks;
  let practice = null;
  const scene = new Scene();
  scene.background = new Color('#c4d8e8');
  const camera = new OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  const defaultAngle = Math.PI / 4;
  const defaultElevation = Math.atan2(12.5, 13 * Math.SQRT2);
  const distance = SIZE * 1.8;
  const elevationLimit = Math.PI / 2 - 0.025;
  const homeFocus = new Vector3(0, 3, 0);
  const focus = homeFocus.clone();
  const offset = new Vector3();
  const beforeZoom = new Vector3();
  const afterZoom = new Vector3();
  const quarterTurn = Math.PI / 2;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let angle = defaultAngle;
  let elevation = defaultElevation;
  let turnTarget = angle;
  let turnFrame = null;
  let tool = 'place';
  let material = 'grass';
  let blocked = false;
  let gesture = null;
  const contacts = new Map();
  let contextLost = false;
  let redrawFrame = 0;

  scene.add(new HemisphereLight('#f8fbff', '#729291', 2));
  const sunlight = new DirectionalLight('#fff4d9', 2.15);
  sunlight.position.set(4, 9, 6);
  scene.add(sunlight);

  const baseGeometry = new BoxGeometry(SIZE + 0.18, 0.6, SIZE + 0.18);
  const base = new Mesh(baseGeometry, new MeshStandardMaterial({ color: '#435f61' }));
  base.position.y = -0.32;
  scene.add(base);
  const edge = new LineSegments(new EdgesGeometry(baseGeometry), new LineBasicMaterial({ color: '#557a83' }));
  edge.position.copy(base.position);
  scene.add(edge);

  const undersideRail = new BoxGeometry(SIZE + 0.18, 0.4, 0.23);
  const undersideMaterial = new MeshStandardMaterial({ color: '#365860', roughness: 0.9 });
  const undersideRails = [];
  for (let side = 0; side < 4; side += 1) {
    const rail = new Mesh(undersideRail, undersideMaterial);
    rail.rotation.y = side * quarterTurn;
    const radius = SIZE / 2 + 0.13;
    rail.position.set(Math.sin(rail.rotation.y) * radius, -0.42, Math.cos(rail.rotation.y) * radius);
    rail.visible = false;
    undersideRails.push(rail);
    scene.add(rail);
  }

  const floor = new Mesh(new PlaneGeometry(SIZE, SIZE), new MeshStandardMaterial({ color: '#9bb2a4' }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const majorGrid = new GridHelper(SIZE, SIZE / 4, '#516568', '#617b79');
  majorGrid.position.y = 0.005;
  majorGrid.material.transparent = true;
  majorGrid.material.depthWrite = false;
  scene.add(majorGrid);
  const grid = new GridHelper(SIZE, SIZE, '#596f72', '#6f8986');
  grid.position.y = 0.008;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  const cube = new BoxGeometry(1, 1, 1);
  const blueprintGeometry = new BoxGeometry(0.97, 0.97, 0.97);
  const blueprintEdges = new EdgesGeometry(blueprintGeometry);
  const guideFill = new MeshBasicMaterial({ color: '#7bceef', transparent: true, opacity: 0.27, depthWrite: false });
  const guideLines = new LineBasicMaterial({ color: '#214a70', transparent: true, opacity: 0.82, depthWrite: false });
  const guides = BRIDGE_PLAN.map((cell) => {
    const mesh = new Mesh(blueprintGeometry, guideFill);
    const edges = new LineSegments(blueprintEdges, guideLines);
    mesh.position.set(cell.x - SIZE / 2 + 0.5, cell.y + 0.5, cell.z - SIZE / 2 + 0.5);
    mesh.renderOrder = 1;
    edges.renderOrder = 2;
    mesh.add(edges);
    scene.add(mesh);
    return { cell, mesh };
  });
  const instances = new Map();
  const pickable = [];
  for (const name of Object.keys(MATERIALS)) {
    const mesh = new InstancedMesh(cube, blockFinish(name), SIZE * SIZE * MAX_HEIGHT);
    mesh.frustumCulled = false;
    mesh.count = 0;
    const cells = [];
    mesh.userData.cells = cells;
    instances.set(name, { mesh, cells });
    pickable.push(mesh);
    scene.add(mesh);
  }
  const outline = new LineSegments(new EdgesGeometry(new BoxGeometry(1.03, 1.03, 1.03)),
    new LineBasicMaterial({ color: '#143b5d', depthTest: false }));
  outline.renderOrder = 2;
  outline.visible = false;
  scene.add(outline);

  const chips = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0 }));
  const chipPositions = new BufferAttribute(new Float32Array(chips.length * 3), 3);
  const chipGeometry = new BufferGeometry();
  chipGeometry.setAttribute('position', chipPositions);
  const chipMaterial = new PointsMaterial({ size: 0.13, transparent: true, depthWrite: false });
  const keyboardPoint = new Vector2(0.5, 0.5);
  const debris = new Points(chipGeometry, chipMaterial);
  debris.frustumCulled = false;
  debris.visible = false;
  scene.add(debris);
  let debrisFrame = 0;

  function showDebris(cell, name, removing) {
    if (reducedMotion.matches) return;
    cancelAnimationFrame(debrisFrame);
    const start = performance.now();
    const duration = name === 'diamond' && !removing ? 135 : removing ? 260 : 170;
    debris.position.set(cell.x - SIZE / 2 + 0.5, cell.y + (removing ? 0.52 : 0.98), cell.z - SIZE / 2 + 0.5);
    chipMaterial.color.set(MATERIALS[name]).lerp(new Color('#ffffff'), name === 'gold' || name === 'diamond' ? 0.62 : 0.27);
    chipMaterial.size = name === 'sand' ? 0.08 : removing ? 0.17 : 0.12;
    for (const [index, chip] of chips.entries()) {
      const angle = Math.PI * 2 * index / chips.length;
      const speed = removing ? 0.72 : 0.48;
      chip.x = Math.cos(angle) * speed;
      chip.y = 0.36 + Math.random() * 0.42;
      chip.z = Math.sin(angle) * speed;
      chipPositions.setXYZ(index, 0, 0.03, 0);
    }
    chipPositions.needsUpdate = true;
    chipMaterial.opacity = 0.86;
    debris.visible = true;
    function frame(now) {
      const progress = Math.max(0, (now - start) / duration);
      if (progress >= 1 || contextLost) {
        debris.visible = false;
        draw();
        return;
      }
      for (const [index, chip] of chips.entries()) {
        chipPositions.setXYZ(index, chip.x * progress, chip.y * progress - progress * progress * 0.65, chip.z * progress);
      }
      chipPositions.needsUpdate = true;
      chipMaterial.opacity = 0.86 * (1 - progress);
      draw();
      debrisFrame = requestAnimationFrame(frame);
    }
    debrisFrame = requestAnimationFrame(frame);
  }

  const matrix = new Matrix4();
  const ray = new Raycaster();
  const pointer = new Vector2();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  function draw() {
    if (!contextLost) renderer.render(scene, camera);
  }

  function syncBlocks(changedMaterial) {
    const targets = changedMaterial ? [instances.get(changedMaterial)] : instances.values();
    for (const { cells } of targets) cells.length = 0;
    for (const cell of blocks.values()) {
      if (changedMaterial && cell.material !== changedMaterial) continue;
      const { mesh, cells } = instances.get(cell.material);
      matrix.makeTranslation(cell.x - SIZE / 2 + 0.5, cell.y + 0.5, cell.z - SIZE / 2 + 0.5);
      mesh.setMatrixAt(cells.length, matrix);
      cells.push(cell);
    }
    const changed = changedMaterial ? [instances.get(changedMaterial)] : instances.values();
    for (const { mesh, cells } of changed) {
      mesh.count = cells.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = null;
    }
    renderBlueprint();
  }

  function renderBlueprint() {
    const progress = practice ? bridgeProgress(blocks) : null;
    for (const { cell, mesh } of guides) {
      mesh.visible = Boolean(progress?.step?.cells.includes(cell) && !hasBlock(blocks, cell));
    }
    if (!progress) return;
    const total = BRIDGE_PLAN.length;
    const completed = progress.placed === total && progress.clear;
    blueprint.toggleAttribute('data-complete', completed);
    let text = completed ? t('小桥完成！') : t('拆掉桥面下多余的方块。');
    if (progress.step) {
      text = t('{step}（{placed}/{total}）', { step: t(progress.step.prompt), placed: progress.placed, total });
    }
    if (blueprint.textContent !== text) blueprint.textContent = text;
  }

  function updateView() {
    const radius = distance * Math.cos(elevation);
    offset.set(Math.sin(angle) * radius, distance * Math.sin(elevation), Math.cos(angle) * radius);
    camera.position.copy(focus).add(offset);
    camera.lookAt(focus);
    const fromBelow = elevation < 0;
    base.visible = floor.visible = grid.visible = !fromBelow;
    majorGrid.material.opacity = fromBelow ? 0.19 : 1;
    majorGrid.position.y = fromBelow ? -0.62 : 0.005;
    for (const rail of undersideRails) rail.visible = fromBelow;
    grid.material.opacity = Math.min(0.55, 0.27 + (camera.zoom - 1) * 0.14);
    outline.visible = false;
    draw();
  }

  function pointOnView(target, x, y, bounds) {
    return target.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2, 0)
      .unproject(camera);
  }

  function zoomAt(scale, from, to = from) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !Number.isFinite(scale)) return;
    pointOnView(beforeZoom, from.x, from.y, bounds);
    camera.zoom = Math.max(0.85, Math.min(8, camera.zoom * scale));
    camera.updateProjectionMatrix();
    pointOnView(afterZoom, to.x, to.y, bounds);
    focus.add(beforeZoom.sub(afterZoom));
    focus.x = Math.max(-SIZE / 2, Math.min(SIZE / 2, focus.x));
    focus.y = Math.max(-1, Math.min(MAX_HEIGHT + 1, focus.y));
    focus.z = Math.max(-SIZE / 2, Math.min(SIZE / 2, focus.z));
    updateView();
  }

  function finishTurn() {
    turnFrame = null;
    angle = turnTarget % (Math.PI * 2);
    for (const button of viewButtons) button.removeAttribute('aria-disabled');
  }

  function turn(direction) {
    if (contextLost || turnFrame !== null) return;
    clearContacts();
    turnTarget = angle - direction * quarterTurn;
    if (reducedMotion.matches) {
      finishTurn();
      updateView();
      return;
    }

    const from = angle;
    const started = performance.now();
    for (const button of viewButtons) button.setAttribute('aria-disabled', 'true');
    function frame(now) {
      const progress = Math.min(1, Math.max(0, (now - started) / 300));
      if (progress === 1) {
        finishTurn();
      } else {
        const eased = progress * progress * (3 - 2 * progress);
        angle = from + (turnTarget - from) * eased;
        turnFrame = requestAnimationFrame(frame);
      }
      updateView();
    }
    turnFrame = requestAnimationFrame(frame);
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    if (contextLost || !width || !height) return;
    const aspect = width / height;
    const overview = SIZE * 0.76;
    const halfHeight = Math.max(SIZE * 0.65, overview / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    updateView();
  }

  function renderStatus() {
    status.textContent = blocked ? t('这里不能放置方块。')
      : tool === 'remove' ? t('点方块将它拆除。') : t('点地面或方块表面放置。');
  }

  function floorIndex(coordinate) {
    return Math.max(0, Math.min(SIZE - 1, Math.floor(coordinate + SIZE / 2)));
  }

  function pick(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    pointer.set(x * 2 - 1, 1 - y * 2);
    ray.setFromCamera(pointer, camera);
    const [blockHit] = ray.intersectObjects(pickable, false);
    const [groundHit] = floor.visible && tool === 'place' ? ray.intersectObject(floor, false) : [];
    const hit = !blockHit || (groundHit && groundHit.distance < blockHit.distance) ? groundHit : blockHit;
    if (!hit) return null;
    if (hit.object === floor) {
      return tool === 'place' ? { x: floorIndex(hit.point.x), y: 0, z: floorIndex(hit.point.z) } : null;
    }
    const cell = hit.object.userData.cells[hit.instanceId];
    if (tool === 'remove') return cell;
    const normal = hit.face.normal;
    return { x: cell.x + normal.x, y: cell.y + normal.y, z: cell.z + normal.z };
  }

  function preview(event) {
    const cell = pick(event);
    outline.visible = Boolean(cell && (tool === 'remove' || canPlace(blocks, cell)));
    if (outline.visible) outline.position.set(cell.x - SIZE / 2 + 0.5, cell.y + 0.5, cell.z - SIZE / 2 + 0.5);
    draw();
  }

  function movedTooFar(event) {
    return Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10;
  }

  function hidePreview() {
    if (!outline.visible) return;
    outline.visible = false;
    draw();
  }

  function cancelGesture() {
    gesture = null;
    hidePreview();
  }

  function clearContacts() {
    contacts.clear();
    cancelGesture();
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && gesture?.pointerType === 'touch' && gesture.id !== event.pointerId) {
      cancelGesture();
    }
  }, { capture: true });

  canvas.addEventListener('pointerdown', (event) => {
    if (contextLost || turnFrame !== null || event.button !== 0 || contacts.size >= 2) return;
    if (!event.isPrimary && (event.pointerType !== 'touch' || contacts.size === 0)) return;
    const point = { x: event.clientX, y: event.clientY, pointerType: event.pointerType };
    if (contacts.size && (point.pointerType !== 'touch' || contacts.values().next().value.pointerType !== 'touch')) return;
    contacts.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);
    if (contacts.size === 1) {
      gesture = { id: event.pointerId, ...point };
      preview(event);
    } else {
      cancelGesture();
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (contextLost || turnFrame !== null) return;
    const previous = contacts.get(event.pointerId);
    if (!previous) {
      if (event.pointerType === 'mouse' && event.buttons === 0) preview(event);
      return;
    }
    const next = { x: event.clientX, y: event.clientY, pointerType: previous.pointerType };
    contacts.set(event.pointerId, next);
    if (contacts.size === 2) {
      const other = [...contacts.entries()].find(([id]) => id !== event.pointerId)[1];
      const length = Math.hypot(previous.x - other.x, previous.y - other.y);
      if (length < 1) return;
      zoomAt(Math.hypot(next.x - other.x, next.y - other.y) / length,
        { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 },
        { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 });
      return;
    }
    if (gesture && !movedTooFar(event)) return;
    gesture = null;
    angle = (angle - (next.x - previous.x) * 0.012) % (Math.PI * 2);
    elevation = Math.max(-elevationLimit, Math.min(elevationLimit, elevation + (next.y - previous.y) * 0.01));
    updateView();
  });
  function edit(cell) {
    if (!cell) return;
    const removing = tool === 'remove';
    const name = removing ? cell.material : material;
    const changed = removing ? removeBlock(blocks, cell) : placeBlock(blocks, cell, name);
    blocked = tool === 'place' && !changed;
    if (changed) {
      syncBlocks(name);
      if (!practice) projects.edited();
      editFeedback(name, removing);
      showDebris(cell, name, removing);
    }
    renderStatus();
  }

  canvas.addEventListener('pointerup', (event) => {
    contacts.delete(event.pointerId);
    if (gesture?.id !== event.pointerId) return;
    const cell = movedTooFar(event) ? null : pick(event);
    gesture = null;
    edit(cell);
    outline.visible = false;
    draw();
  });
  function cancelPointer(event) {
    contacts.delete(event.pointerId);
    if (gesture?.id === event.pointerId) cancelGesture();
  }
  canvas.addEventListener('keydown', (event) => {
    if (contextLost || turnFrame !== null || event.ctrlKey || event.metaKey || event.altKey) return;
    const dx = Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft');
    const dy = Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp');
    const bounds = canvas.getBoundingClientRect();
    const point = {
      x: bounds.left + keyboardPoint.x * bounds.width,
      y: bounds.top + keyboardPoint.y * bounds.height,
    };
    if (dx || dy) {
      if (event.shiftKey) {
        angle = (angle - dx * 0.12) % (Math.PI * 2);
        elevation = Math.max(-elevationLimit, Math.min(elevationLimit, elevation + dy * 0.1));
        updateView();
      } else {
        const step = Math.max(3, bounds.width * camera.zoom / ((camera.right - camera.left) * 3));
        keyboardPoint.x = Math.max(0.01, Math.min(0.99, keyboardPoint.x + dx * step / bounds.width));
        keyboardPoint.y = Math.max(0.01, Math.min(0.99, keyboardPoint.y + dy * step / bounds.height));
        point.x = bounds.left + keyboardPoint.x * bounds.width;
        point.y = bounds.top + keyboardPoint.y * bounds.height;
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (!event.repeat) edit(pick({ clientX: point.x, clientY: point.y }));
    } else if (['+', '=', '-'].includes(event.key)) {
      zoomAt(event.key === '-' ? 1 / 1.2 : 1.2, point);
    } else {
      return;
    }
    event.preventDefault();
    preview({ clientX: point.x, clientY: point.y });
  });
  canvas.addEventListener('blur', hidePreview);
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('lostpointercapture', cancelPointer);
  canvas.addEventListener('pointerleave', hidePreview);
  canvas.addEventListener('wheel', (event) => {
    if (contextLost || turnFrame !== null || event.ctrlKey) return;
    event.preventDefault();
    cancelGesture();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    zoomAt(Math.exp(-delta * 0.0015), { x: event.clientX, y: event.clientY });
  }, { passive: false });

  // Three.js 先恢复渲染资源，应用随后重画当前场景。
  canvas.addEventListener('webglcontextlost', () => {
    contextLost = true;
    cancelAnimationFrame(redrawFrame);
    cancelAnimationFrame(debrisFrame);
    debris.visible = false;
    if (turnFrame !== null) {
      cancelAnimationFrame(turnFrame);
      finishTurn();
    }
    clearContacts();
    for (const button of controls) button.disabled = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    redrawFrame = requestAnimationFrame(() => {
      contextLost = false;
      resize();
      for (const button of controls) button.disabled = false;
    });
  });

  for (const button of toolButtons) {
    button.addEventListener('click', () => {
      tool = button.dataset.tool;
      blocked = false;
      for (const control of toolButtons) control.setAttribute('aria-pressed', String(control === button));
      renderStatus();
    });
  }
  for (const button of materialButtons) {
    button.addEventListener('click', () => {
      material = button.dataset.material;
      for (const control of materialButtons) control.setAttribute('aria-pressed', String(control === button));
    });
  }
  for (const button of turnButtons) {
    button.addEventListener('click', () => turn(Number(button.dataset.turn)));
  }
  function resetView() {
    if (turnFrame !== null) {
      cancelAnimationFrame(turnFrame);
      finishTurn();
    }
    clearContacts();
    focus.copy(homeFocus);
    angle = defaultAngle;
    elevation = defaultElevation;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    updateView();
  }

  overview.addEventListener('click', () => { if (!contextLost) resetView(); });
  function updateHelp() {
    const active = Boolean(practice);
    workshop.toggleAttribute('data-tutorial', active);
    help.setAttribute('aria-pressed', String(active));
    help.dataset.i18n = active ? '退出教学' : '教学';
    help.dataset.i18nAttr = active ? 'aria-label:退出教学' : 'aria-label:小桥教学';
    help.setAttribute('aria-label', t(active ? '退出教学' : '小桥教学'));
    help.textContent = t(help.dataset.i18n);
    blueprint.hidden = !active;
  }

  try { tip.hidden = localStorage.getItem(tipKey) === '1'; } catch { tip.hidden = false; }
  dismissTip.addEventListener('click', (event) => {
    tip.hidden = true;
    if (practice) practice.tipHidden = true;
    try { localStorage.setItem(tipKey, '1'); } catch {}
    if (event.detail === 0) canvas.focus({ preventScroll: true });
  });

  help.addEventListener('click', () => {
    if (turnFrame !== null) return;
    clearContacts();
    cancelAnimationFrame(debrisFrame);
    debris.visible = false;
    if (practice) {
      blocks = practice.blocks;
      focus.copy(practice.focus);
      angle = practice.angle;
      elevation = practice.elevation;
      camera.zoom = practice.zoom;
      tip.hidden = practice.tipHidden;
      practice = null;
    } else {
      practice = { blocks, focus: focus.clone(), angle, elevation, zoom: camera.zoom, tipHidden: tip.hidden };
      blocks = createPracticeWorld();
      focus.set(-0.5, 1.25, 2);
      angle = defaultAngle;
      elevation = defaultElevation;
      camera.zoom = 2;
      tip.hidden = false;
    }
    blocked = false;
    camera.updateProjectionMatrix();
    updateHelp();
    syncBlocks();
    renderStatus();
    updateView();
  });

  function renderSound() {
    const enabled = window.SiteData.getSound();
    sound.setAttribute('aria-pressed', String(enabled));
    sound.textContent = t('音效');
    sound.setAttribute('aria-label', t(enabled ? '音效已开启，点击关闭' : '音效已关闭，点击开启'));
  }
  sound.addEventListener('click', () => {
    window.SiteData.setSound(!window.SiteData.getSound());
    renderSound();
  });
  renderSound();

  window.GameKit.bindMobileLayout('block-workshop', document.querySelector('#workshop-immersive'), clearContacts,
    { portraitOnly: true, onRender(immersive) {
      const button = document.querySelector('#workshop-immersive');
      button.setAttribute('aria-label', t(immersive ? '退出沉浸' : '沉浸模式'));
      button.dataset.i18nAttr = immersive ? 'aria-label:退出沉浸' : 'aria-label:沉浸模式';
      button.dataset.i18n = immersive ? '退出' : '沉浸';
      button.textContent = t(button.dataset.i18n);
    } });

  const projects = bindProjects((nextBlocks) => {
    blocks = nextBlocks;
    blocked = false;
    syncBlocks();
    renderStatus();
    resetView();
  });
  blocks = projects.blocks;

  document.addEventListener('i18n:change', () => {
    renderStatus();
    renderBlueprint();
    updateHelp();
    renderSound();
  });
  syncBlocks();
  resize();
  new ResizeObserver(resize).observe(stage);
}
