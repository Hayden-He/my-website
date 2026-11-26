import { deleteProject, listProjects, readProject, readSession, rememberSession, renameProject, saveProject } from './projects.js';
import { TEMPLATES, createTemplateWorld, createWorld } from './world.js';

const t = (key, params) => (window.I18N ? window.I18N.t(key, params) : key);

export function bindProjects(replaceWorld, { onClear } = {}) {
  const library = document.querySelector('#workshop-library');
  const naming = document.querySelector('#workshop-naming');
  const namingTitle = document.querySelector('#workshop-naming-title');
  const saveNote = document.querySelector('#workshop-save-note');
  const list = document.querySelector('#workshop-projects');
  const templateList = document.querySelector('#workshop-templates');
  const form = document.querySelector('#workshop-naming-form');
  const input = document.querySelector('#workshop-name');
  const nameError = document.querySelector('#workshop-name-error');
  const status = document.querySelector('#workshop-save-status');
  const clear = document.querySelector('#workshop-clear');
  let current = readSession() || { id: null, name: '', blocks: createWorld(), raw: null };
  let dirty = false;
  let timer;
  let nextAfterName;
  let namingMode = 'save';
  let renamingTarget = null;
  let statusKey = '';
  let statusTemplateKey = '';

  function showStatus(key, templateKey = '') {
    statusKey = key;
    statusTemplateKey = templateKey;
    const displayName = templateKey ? t(templateKey) : current.name;
    status.textContent = key ? t(key, { name: displayName }) : '';
  }

  function flush() {
    clearTimeout(timer);
    if (!dirty) return true;
    try {
      if (current.id) current.raw = saveProject(current.id, current.name, current.blocks, current.raw);
      else rememberSession(null, current.blocks);
      dirty = false;
      showStatus(current.id ? '已自动保存「{name}」' : '');
      return true;
    } catch {
      showStatus('保存失败，请检查浏览器存储后重试。');
      return false;
    }
  }

  function activate(project, { resetHistory = true, statusOverride = null } = {}) {
    current = project;
    dirty = false;
    try { rememberSession(current.id, current.blocks); } catch {}
    replaceWorld(current.blocks, { resetHistory });
    if (statusOverride) showStatus(statusOverride.key, statusOverride.templateKey);
    else showStatus(current.id ? '正在搭建「{name}」' : '');
  }

  function makeButton(label, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = t(label);
    button.addEventListener('click', callback);
    return button;
  }

  function renderTemplates() {
    if (!templateList) return;
    templateList.replaceChildren();
    for (const template of TEMPLATES) {
      const row = document.createElement('div');
      row.className = 'workshop-project workshop-template';
      const meta = document.createElement('div');
      meta.className = 'workshop-project-meta';
      const title = document.createElement('strong');
      title.textContent = t(template.name);
      const desc = document.createElement('span');
      desc.className = 'workshop-template-desc';
      desc.textContent = t(template.description);
      meta.append(title, desc);
      const actions = document.createElement('div');
      actions.className = 'workshop-project-actions';
      const loadBtn = makeButton('载入', () => {
        leaveFor(() => {
          const blocks = createTemplateWorld(template.id);
          if (!blocks) return;
          library.close();
          activate(
            { id: null, name: '', blocks, raw: null },
            { resetHistory: true, statusOverride: { key: '已载入模板「{name}」', templateKey: template.name } },
          );
        });
      });
      actions.append(loadBtn);
      row.append(meta, actions);
      templateList.append(row);
    }
  }

  function renderLibrary() {
    clear.disabled = current.blocks.size === 0;
    list.replaceChildren();
    try {
      const projects = listProjects();
      if (!projects.length) list.textContent = t('还没有已保存的作品。');
      for (const { id, name, count } of projects) {
        const row = document.createElement('div');
        row.className = 'workshop-project';
        if (id === current.id) row.classList.add('active');

        const meta = document.createElement('div');
        meta.className = 'workshop-project-meta';
        const titleRow = document.createElement('div');
        titleRow.className = 'workshop-project-title';
        const title = document.createElement('strong');
        title.textContent = name;
        titleRow.append(title);
        if (id === current.id) {
          const badge = document.createElement('span');
          badge.className = 'workshop-badge';
          badge.textContent = t('当前');
          titleRow.append(badge);
        }
        const countLabel = document.createElement('span');
        countLabel.className = 'workshop-count';
        countLabel.textContent = t('{count} 块', { count });
        meta.append(titleRow, countLabel);

        const actions = document.createElement('div');
        actions.className = 'workshop-project-actions';
        const open = makeButton('继续搭建', () => {
          if (id === current.id) {
            library.close();
            return;
          }
          leaveFor(() => {
            try {
              const project = readProject(id);
              if (!project) throw new Error('Project unavailable');
              library.close();
              activate({ id, ...project });
            } catch {
              openLibrary('无法读取这件作品。');
            }
          });
        });
        const rename = makeButton('重命名', () => askRename(id, name));
        const remove = makeButton('删除', () => removeFromLibrary(id, name));
        actions.append(open, rename, remove);
        row.append(meta, actions);
        list.append(row);
      }
    } catch {
      list.textContent = t('浏览器存储不可用。');
    }
    renderTemplates();
  }

  function openLibrary(error) {
    renderLibrary();
    if (error) {
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = t(error);
      list.prepend(message);
    }
    if (!library.open) library.showModal();
  }

  async function removeFromLibrary(id, name) {
    if (!flush()) {
      openLibrary('保存失败，请检查浏览器存储后重试。');
      return;
    }
    library.close();
    try {
      const project = readProject(id);
      if (!project) throw new Error('Project unavailable');
      const confirmed = await window.SiteData.confirmDialog({
        title: t('删除作品'),
        message: t('删除「{name}」？此操作无法撤销。', { name }),
        confirmText: t('删除'),
        danger: true,
      });
      if (confirmed) {
        deleteProject(id, project.raw);
        if (id === current.id) activate({ id: null, name: '', blocks: createWorld(), raw: null });
      }
      openLibrary();
    } catch {
      openLibrary('无法删除这件作品。');
    }
  }

  async function clearCurrent() {
    if (!current.blocks.size) return;
    library.close();
    const confirmed = await window.SiteData.confirmDialog({
      title: t('清空当前作品'),
      message: t('清空「{name}」的全部 {count} 个方块？清空后仍可用撤销恢复。', {
        name: current.name || t('未命名作品'),
        count: current.blocks.size,
      }),
      confirmText: t('清空'),
      danger: true,
    });
    if (!confirmed) {
      openLibrary();
      return;
    }
    try {
      if (typeof onClear === 'function') {
        onClear();
        dirty = true;
        flush();
      } else {
        const empty = createWorld();
        if (current.id) current.raw = saveProject(current.id, current.name, empty, current.raw);
        else rememberSession(null, empty);
        clearTimeout(timer);
        dirty = false;
        current.blocks = empty;
        replaceWorld(empty, { resetHistory: false });
        showStatus(current.id ? '已自动保存「{name}」' : '');
      }
    } catch {
      openLibrary('保存失败，请检查浏览器存储后重试。');
    }
  }

  function openNamingModal({ mode, titleKey, initialName, showNote, target = null, then = null }) {
    if (library.open) library.close();
    namingMode = mode;
    renamingTarget = target;
    nextAfterName = then;
    if (namingTitle) {
      namingTitle.dataset.i18n = titleKey;
      namingTitle.textContent = t(titleKey);
    }
    if (saveNote) saveNote.hidden = !showNote;
    input.value = initialName;
    nameError.textContent = '';
    naming.showModal();
    if (mode === 'rename') input.select();
  }

  function askName(then) {
    openNamingModal({
      mode: 'save',
      titleKey: '保存作品',
      initialName: current.name,
      showNote: true,
      then,
    });
  }

  function askRename(id, name) {
    if (!flush()) {
      openLibrary('保存失败，请检查浏览器存储后重试。');
      return;
    }
    const project = readProject(id);
    if (!project) {
      openLibrary('无法读取这件作品。');
      return;
    }
    openNamingModal({
      mode: 'rename',
      titleKey: '重命名作品',
      initialName: name,
      showNote: false,
      target: { id, name, raw: project.raw },
    });
  }

  function leaveFor(then) {
    if (!current.id && current.blocks.size) {
      askName(then);
      return;
    }
    if (flush()) then();
    else if (library.open) openLibrary('保存失败，请检查浏览器存储后重试。');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      nameError.textContent = t('请输入作品名称。');
      return;
    }
    if (namingMode === 'rename' && renamingTarget) {
      try {
        const raw = renameProject(renamingTarget.id, name, renamingTarget.raw);
        if (renamingTarget.id === current.id) {
          current = { ...current, name, raw };
          showStatus('已重命名为「{name}」');
        }
        renamingTarget = null;
        naming.close();
        openLibrary();
      } catch {
        nameError.textContent = t('重命名失败，请稍后重试。');
      }
      return;
    }
    try {
      const id = crypto.randomUUID();
      const raw = saveProject(id, name, current.blocks, null);
      current = { ...current, id, name, raw };
      dirty = false;
      clearTimeout(timer);
      try { rememberSession(id, current.blocks); } catch {}
      showStatus('已自动保存「{name}」');
      naming.close();
      nextAfterName?.();
    } catch {
      nameError.textContent = t('保存失败，请检查浏览器存储后重试。');
    }
  });

  function cancelNaming() {
    const returnToLibrary = namingMode === 'rename';
    renamingTarget = null;
    naming.close();
    if (returnToLibrary) openLibrary();
  }

  document.querySelector('#workshop-works').addEventListener('click', () => {
    openLibrary(flush() ? undefined : '保存失败，请检查浏览器存储后重试。');
  });
  document.querySelector('#workshop-save').addEventListener('click', () => {
    if (!current.id) askName(() => openLibrary());
    else if (flush()) openLibrary();
  });
  document.querySelector('#workshop-new').addEventListener('click', () => leaveFor(() => {
    library.close();
    activate({ id: null, name: '', blocks: createWorld(), raw: null });
  }));
  document.querySelector('#workshop-close-library').addEventListener('click', () => library.close());
  clear.addEventListener('click', clearCurrent);
  document.querySelector('#workshop-cancel-name').addEventListener('click', cancelNaming);
  naming.addEventListener('cancel', (event) => {
    if (namingMode === 'rename') {
      event.preventDefault();
      cancelNaming();
    }
  });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
  document.addEventListener('i18n:change', () => {
    showStatus(statusKey, statusTemplateKey);
    if (library.open) renderLibrary();
    if (naming.open && namingTitle) {
      namingTitle.textContent = t(namingMode === 'rename' ? '重命名作品' : '保存作品');
    }
  });
  if (current.id) showStatus('正在搭建「{name}」');
  return {
    blocks: current.blocks,
    getProjectName: () => current.name,
    edited() {
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(flush, 180);
    },
  };
}
