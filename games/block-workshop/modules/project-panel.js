import { deleteProject, listProjects, readProject, readSession, rememberSession, saveProject } from './projects.js';
import { createWorld } from './world.js';

const t = (key, params) => window.I18N.t(key, params);

export function bindProjects(replaceWorld) {
  const library = document.querySelector('#workshop-library');
  const naming = document.querySelector('#workshop-naming');
  const list = document.querySelector('#workshop-projects');
  const form = document.querySelector('#workshop-naming-form');
  const input = document.querySelector('#workshop-name');
  const nameError = document.querySelector('#workshop-name-error');
  const status = document.querySelector('#workshop-save-status');
  const clear = document.querySelector('#workshop-clear');
  let current = readSession() || { id: null, name: '', blocks: createWorld(), raw: null };
  let dirty = false;
  let timer;
  let nextAfterName;
  let statusKey = '';

  function showStatus(key) {
    statusKey = key;
    status.textContent = key ? t(key, { name: current.name }) : '';
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

  function activate(project) {
    current = project;
    dirty = false;
    try { rememberSession(current.id, current.blocks); } catch {}
    replaceWorld(current.blocks);
    showStatus(current.id ? '正在搭建「{name}」' : '');
  }

  function makeButton(label, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = t(label);
    button.addEventListener('click', callback);
    return button;
  }

  function renderLibrary() {
    clear.disabled = current.blocks.size === 0;
    list.replaceChildren();
    try {
      const projects = listProjects();
      if (!projects.length) list.textContent = t('还没有已保存的作品。');
      for (const { id, name } of projects) {
        const row = document.createElement('div');
        row.className = 'workshop-project';
        const title = document.createElement('span');
        title.textContent = name;
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
        const remove = makeButton('删除', () => removeFromLibrary(id, name));
        row.append(title, open, remove);
        list.append(row);
      }
    } catch {
      list.textContent = t('浏览器存储不可用。');
    }
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
      message: t('清空「{name}」的全部 {count} 个方块？此操作无法撤销。', {
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
    const empty = createWorld();
    try {
      if (current.id) current.raw = saveProject(current.id, current.name, empty, current.raw);
      else rememberSession(null, empty);
      clearTimeout(timer);
      dirty = false;
      current.blocks = empty;
      replaceWorld(empty);
      showStatus(current.id ? '已自动保存「{name}」' : '');
    } catch {
      openLibrary('保存失败，请检查浏览器存储后重试。');
    }
  }

  function askName(then) {
    if (library.open) library.close();
    nextAfterName = then;
    input.value = current.name;
    nameError.textContent = '';
    naming.showModal();
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
    try {
      const id = crypto.randomUUID();
      const raw = saveProject(id, name, current.blocks, null);
      current = { ...current, id, name, raw };
      dirty = false;
      clearTimeout(timer);
      try { rememberSession(id, current.blocks); } catch {}
      showStatus('已自动保存「{name}」');
      naming.close();
      nextAfterName();
    } catch {
      nameError.textContent = t('保存失败，请检查浏览器存储后重试。');
    }
  });

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
  document.querySelector('#workshop-cancel-name').addEventListener('click', () => naming.close());
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
  document.addEventListener('i18n:change', () => {
    showStatus(statusKey);
    if (library.open) renderLibrary();
  });
  if (current.id) showStatus('正在搭建「{name}」');
  return {
    blocks: current.blocks,
    edited() {
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(flush, 180);
    },
  };
}
