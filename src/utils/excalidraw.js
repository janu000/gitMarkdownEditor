// src/utils/excalidraw.js

export const DEFAULT_EXCALIDRAW_SCENE = {
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements: [],
  appState: {
    viewBackgroundColor: 'transparent',
    gridSize: null,
  },
  files: {},
};

/**
 * Creates a clean default Excalidraw scene object
 */
export function createDefaultExcalidrawScene(initialElements = [], customAppState = {}) {
  return {
    ...DEFAULT_EXCALIDRAW_SCENE,
    elements: initialElements,
    appState: {
      ...DEFAULT_EXCALIDRAW_SCENE.appState,
      ...customAppState,
    },
    files: {},
  };
}

/**
 * Parses Excalidraw content from either raw JSON, a fenced code block, or an Obsidian .excalidraw.md file.
 * @param {string|object} content
 * @returns {object|null}
 */
export function parseExcalidrawContent(content) {
  if (!content) return null;
  if (typeof content === 'object') {
    if (Array.isArray(content.elements) || content.type === 'excalidraw') {
      return normalizeSceneData(content);
    }
    return null;
  }

  const str = String(content).trim();

  // 1. Try direct JSON parse
  try {
    const parsed = JSON.parse(str);
    if (parsed && (Array.isArray(parsed.elements) || parsed.type === 'excalidraw')) {
      return normalizeSceneData(parsed);
    }
  } catch {
    // Not plain JSON, continue to regex extractors
  }

  // 2. Try fenced block ```excalidraw ... ```
  const codeBlockMatch = str.match(/```(?:excalidraw|json:excalidraw)\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      return normalizeSceneData(parsed);
    } catch {
      // ignore
    }
  }

  // 3. Try Obsidian Excalidraw format: %%# Drawing ... ```json ... ``` %%
  const obsidianMatch = str.match(/%%# Drawing[\s\S]*?```json\s*([\s\S]*?)\s*```[\s\S]*?%%/);
  if (obsidianMatch) {
    try {
      const parsed = JSON.parse(obsidianMatch[1]);
      return normalizeSceneData(parsed);
    } catch {
      // ignore
    }
  }

  // 4. Try any JSON block inside %% ... %%
  const commentMatch = str.match(/%%\s*```(?:json)?\s*([\s\S]*?)\s*```\s*%%/);
  if (commentMatch) {
    try {
      const parsed = JSON.parse(commentMatch[1]);
      return normalizeSceneData(parsed);
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Normalizes scene data to ensure elements array and appState exist.
 */
function normalizeSceneData(data) {
  if (!data) return null;
  const rawAppState = data.appState || {};
  const { collaborators, ...cleanAppState } = rawAppState;
  return {
    type: data.type || 'excalidraw',
    version: data.version || 2,
    source: data.source || 'https://excalidraw.com',
    elements: Array.isArray(data.elements) ? data.elements : [],
    appState: {
      viewBackgroundColor: cleanAppState.viewBackgroundColor || 'transparent',
      ...cleanAppState,
      collaborators: collaborators instanceof Map ? collaborators : new Map(),
    },
    files: data.files || {},
  };
}

/**
 * Strips non-serializable fields from appState for JSON storage
 */
function getSerializableScene(sceneData) {
  const normalized = normalizeSceneData(sceneData) || DEFAULT_EXCALIDRAW_SCENE;
  const { collaborators: _collaborators, ...serializableAppState } = normalized.appState || {};
  return {
    type: normalized.type || 'excalidraw',
    version: normalized.version || 2,
    source: normalized.source || 'https://excalidraw.com',
    elements: normalized.elements || [],
    appState: serializableAppState,
    files: normalized.files || {},
  };
}

/**
 * Serializes scene data to a fenced Markdown block
 */
export function serializeToCodeBlock(sceneData) {
  const serializable = getSerializableScene(sceneData);
  const jsonStr = JSON.stringify(serializable, null, 2);
  return `\`\`\`excalidraw\n${jsonStr}\n\`\`\``;
}

/**
 * Serializes scene data to an Obsidian-compatible .excalidraw.md document
 */
export function serializeToObsidianDoc(sceneData) {
  const serializable = getSerializableScene(sceneData);
  const jsonStr = JSON.stringify(serializable, null, 2);

  // Extract text elements for markdown searchability
  const textElements = (serializable.elements || [])
    .filter(el => el.type === 'text' && el.text)
    .map(el => el.text.trim())
    .filter(Boolean);

  const textSection = textElements.length > 0
    ? `\n# Text Elements\n${textElements.map(t => `- ${t}`).join('\n')}\n`
    : '';

  return `---
excalidraw-plugin: parsed
tags: [excalidraw]
---
${textSection}
%%# Drawing
\`\`\`json
${jsonStr}
\`\`\`
%%
`;
}

/**
 * Checks if a filename is an Excalidraw document
 */
export function isExcalidrawFile(filePath = '') {
  if (!filePath) return false;
  const lower = filePath.toLowerCase();
  return lower.endsWith('.excalidraw') || lower.endsWith('.excalidraw.md') || lower.endsWith('.excalidraw.svg');
}

let excalidrawModulePromise = null;

/**
 * Lazy loads @excalidraw/excalidraw
 */
export async function loadExcalidraw() {
  if (typeof window !== 'undefined' && !window.EXCALIDRAW_ASSET_PATH) {
    window.EXCALIDRAW_ASSET_PATH = '/';
  }
  if (!excalidrawModulePromise) {
    excalidrawModulePromise = import('@excalidraw/excalidraw');
  }
  return excalidrawModulePromise;
}

/**
 * Exports an Excalidraw scene to an SVG DOM element using @excalidraw/excalidraw's exportToSvg
 */
export async function exportSceneToSvg(sceneData, options = {}) {
  const normalized = normalizeSceneData(sceneData);
  if (!normalized || !normalized.elements || normalized.elements.length === 0) {
    // Return empty placeholder SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 120');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '120');
    svg.style.maxWidth = '100%';
    svg.innerHTML = `
      <rect width="100%" height="100%" fill="none" stroke="currentColor" stroke-dasharray="4 4" stroke-width="1.5" rx="8" opacity="0.25"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="currentColor" opacity="0.5" font-family="sans-serif" font-size="13">
        Empty Drawing • Double-click to edit
      </text>
    `;
    return svg;
  }

  const { exportToSvg } = await loadExcalidraw();
  const isDark = options.theme === 'dark';
  const cleanAppState = {
    ...(normalized.appState || {}),
    ...(options.appState || {}),
  };
  const safeCollaborators = cleanAppState.collaborators instanceof Map ? cleanAppState.collaborators : new Map();

  const exportPadding = options.exportPadding ?? 20;

  const svg = await exportToSvg({
    elements: normalized.elements,
    appState: {
      exportBackground: options.exportBackground ?? false,
      viewBackgroundColor: options.viewBackgroundColor ?? (isDark ? '#121212' : '#ffffff'),
      exportWithDarkMode: options.theme === 'dark',
      ...cleanAppState,
      collaborators: safeCollaborators,
    },
    files: normalized.files || {},
    exportPadding,
  });

  const scrollX = typeof cleanAppState.scrollX === 'number' ? cleanAppState.scrollX : null;
  const scrollY = typeof cleanAppState.scrollY === 'number' ? cleanAppState.scrollY : null;
  const zoom = cleanAppState.zoom?.value || (typeof cleanAppState.zoom === 'number' ? cleanAppState.zoom : 1) || 1;
  const targetHeight = options.height || cleanAppState.height || 420;
  const targetWidth = options.width || cleanAppState.width || 800;

  if (options.matchViewport && scrollX != null && scrollY != null && targetWidth > 0 && targetHeight > 0) {
    // exportToSvg translates elements to their padded bounds, so convert the
    // Excalidraw viewport into that exported coordinate space.
    let minX = Infinity;
    let minY = Infinity;
    for (const element of normalized.elements) {
      if (element.isDeleted) continue;
      let elementMinX = element.x ?? 0;
      let elementMinY = element.y ?? 0;
      if (Array.isArray(element.points) && element.points.length > 0) {
        for (const [pointX, pointY] of element.points) {
          if (element.x + pointX < elementMinX) elementMinX = element.x + pointX;
          if (element.y + pointY < elementMinY) elementMinY = element.y + pointY;
        }
      }
      if (elementMinX < minX) minX = elementMinX;
      if (elementMinY < minY) minY = elementMinY;
    }
    if (minX === Infinity) minX = 0;
    if (minY === Infinity) minY = 0;

    const vbX = -scrollX - minX + exportPadding;
    const vbY = -scrollY - minY + exportPadding;
    const vbW = targetWidth / zoom;
    const vbH = targetHeight / zoom;

    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', `${targetHeight}`);
    svg.style.width = '100%';
    svg.style.height = `${targetHeight}px`;
    svg.style.maxWidth = '100%';
    svg.style.display = 'block';
    svg.style.margin = '0';
  } else {
    svg.style.maxWidth = '100%';
    svg.style.width = 'auto';
    svg.style.height = 'auto';
    svg.style.display = 'block';
    svg.style.margin = '0';
  }

  return svg;
}
