import { Annotation } from '@codemirror/state';
import { foldEffect, unfoldEffect, foldedRanges } from '@codemirror/language';

export const FOLD_STORAGE_KEY = 'gme_codeblock_folds';

export const foldRestoreAnnotation = Annotation.define();

/**
 * Derives a storage key for the given file object
 */
export function getFileStorageKey(activeFile) {
  if (!activeFile) return 'global:default';
  if (activeFile.repo) {
    return `repo:${activeFile.repo}:${activeFile.branch || ''}:${activeFile.path || activeFile.name || 'untitled'}`;
  }
  return `local:${activeFile.path || activeFile.name || 'untitled'}`;
}

/**
 * Checks if a language or file is recognized as Excalidraw
 */
export function isExcalidrawBlock(lang, fileName = '') {
  if (fileName && (fileName.endsWith('.excalidraw.md') || fileName.endsWith('.excalidraw'))) {
    return true;
  }
  if (!lang) return false;
  const l = String(lang).trim().toLowerCase();
  return l === 'excalidraw' || l.startsWith('excalidraw') || l === 'json:excalidraw' || l.startsWith('json:excalidraw');
}

/**
 * Fast 32-bit FNV-1a hash
 */
export function hashString(str) {
  if (!str) return '0';
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Extracts preview text from the first content line of a code block
 */
export function getFirstLineText(doc, block) {
  if (!doc || block.lineCount < 1) return '';
  const firstContentLineNum = block.startLineNumber + 1;
  if (firstContentLineNum <= doc.lines) {
    return doc.line(firstContentLineNum).text.trim().slice(0, 80);
  }
  return '';
}

/**
 * Scans fenced code blocks in a CodeMirror document
 */
export function scanCodeBlocks(doc) {
  const blocks = [];
  const totalLines = doc.lines;
  let inBlock = false;
  let startLine = null;
  let fenceChar = '';
  let fenceLen = 0;

  for (let i = 1; i <= totalLines; i++) {
    const line = doc.line(i);
    const text = line.text;
    const match = text.match(/^(\s*)(`{3,}|~{3,})(.*)$/);

    if (!inBlock) {
      if (match) {
        inBlock = true;
        fenceChar = match[2][0];
        fenceLen = match[2].length;
        startLine = {
          number: i,
          from: line.from,
          to: line.to,
          text: line.text,
          lang: match[3].trim(),
          fenceLen
        };
      }
    } else {
      const closeMatch = text.match(/^(\s*)(`{3,}|~{3,})\s*$/);
      if (closeMatch && closeMatch[2][0] === fenceChar && closeMatch[2].length >= fenceLen) {
        blocks.push({
          startLineNumber: startLine.number,
          startPos: startLine.from,
          startLineTo: startLine.to,
          endLineNumber: i,
          endPos: line.to,
          lineCount: i - startLine.number - 1,
          lang: startLine.lang
        });
        inBlock = false;
        startLine = null;
      }
    }
  }

  // Handle unclosed code block reaching end of document
  if (inBlock && startLine && totalLines > startLine.number) {
    const lastLine = doc.line(totalLines);
    blocks.push({
      startLineNumber: startLine.number,
      startPos: startLine.from,
      startLineTo: startLine.to,
      endLineNumber: totalLines,
      endPos: lastLine.to,
      lineCount: totalLines - startLine.number,
      lang: startLine.lang
    });
  }

  return blocks;
}

/**
 * Tests if range [from, to] is currently folded in CodeMirror state
 */
export function isRangeFolded(state, from, to) {
  let folded = false;
  const folds = foldedRanges(state);
  folds.between(from, to, (f, t) => {
    if (f <= from && t >= to) {
      folded = true;
      return false;
    }
  });
  return folded;
}

/**
 * Reads all saved fold maps from localStorage
 */
export function getSavedFoldStateMap() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FOLD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Error reading saved codeblock folds:', e);
    return {};
  }
}

/**
 * Checks whether a specific block in a file should be folded
 */
export function getSavedBlockFoldState(fileKey, block, index, doc, fileName = '') {
  const allSaved = getSavedFoldStateMap();
  const fileFolds = allSaved[fileKey];

  if (fileFolds) {
    const firstLineText = getFirstLineText(doc, block);
    const contentHash = hashString(firstLineText);
    const primaryKey = `${index}:${block.lang}:${contentHash}`;
    const indexKey = `idx:${index}:${block.lang}`;
    const contentKey = firstLineText ? `content:${block.lang}:${contentHash}` : null;

    if (fileFolds[primaryKey] !== undefined) {
      return Boolean(fileFolds[primaryKey]);
    }
    if (contentKey && fileFolds[contentKey] !== undefined) {
      return Boolean(fileFolds[contentKey]);
    }
    if (fileFolds[indexKey] !== undefined) {
      return Boolean(fileFolds[indexKey]);
    }
  }

  // Default: excalidraw blocks are collapsed initially, others are expanded
  return isExcalidrawBlock(block.lang, fileName);
}

/**
 * Saves the current fold states of all codeblocks for a given file
 */
export function saveBlockFoldStates(fileKey, blocksWithState) {
  if (typeof localStorage === 'undefined' || !fileKey) return;
  try {
    const allSaved = getSavedFoldStateMap();
    const fileFolds = allSaved[fileKey] || {};

    for (const item of blocksWithState) {
      const { block, index, doc, isFolded } = item;
      const firstLineText = getFirstLineText(doc, block);
      const contentHash = hashString(firstLineText);
      const primaryKey = `${index}:${block.lang}:${contentHash}`;
      const indexKey = `idx:${index}:${block.lang}`;
      
      fileFolds[primaryKey] = isFolded;
      fileFolds[indexKey] = isFolded;
      if (firstLineText) {
        fileFolds[`content:${block.lang}:${contentHash}`] = isFolded;
      }
    }

    allSaved[fileKey] = fileFolds;

    // Prune old entries if map gets too large (> 100 entries)
    const keys = Object.keys(allSaved);
    if (keys.length > 100) {
      delete allSaved[keys[0]];
    }

    localStorage.setItem(FOLD_STORAGE_KEY, JSON.stringify(allSaved));
  } catch (err) {
    console.warn('Failed to save codeblock fold states:', err);
  }
}

/**
 * Applies saved or default fold states onto the CodeMirror EditorView
 */
export function applyFoldStates(view, fileKey, fileName = '') {
  if (!view || !view.state) return;
  const doc = view.state.doc;
  const blocks = scanCodeBlocks(doc);
  const effects = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.lineCount < 1) continue;

    const shouldFold = getSavedBlockFoldState(fileKey, block, i, doc, fileName);
    const currentlyFolded = isRangeFolded(view.state, block.startLineTo, block.endPos);

    if (shouldFold && !currentlyFolded) {
      effects.push(foldEffect.of({ from: block.startLineTo, to: block.endPos }));
    } else if (!shouldFold && currentlyFolded) {
      effects.push(unfoldEffect.of({ from: block.startLineTo, to: block.endPos }));
    }
  }

  if (effects.length > 0) {
    view.dispatch({
      effects,
      annotations: foldRestoreAnnotation.of(true)
    });
  }
}
