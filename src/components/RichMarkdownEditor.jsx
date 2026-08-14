import { forwardRef, memo, useEffect, useEffectEvent, useImperativeHandle, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Crepe } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { imageBlockSchema } from '@milkdown/kit/component/image-block';
import { NodeSelection, TextSelection, Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { replaceAll, $prose } from '@milkdown/kit/utils';
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history';
import {
  addBlockTypeCommand,
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  inlineCodeSchema,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  setBlockTypeCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand,
  wrapInHeadingCommand,
} from '@milkdown/kit/preset/commonmark';
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip';
import { createTable, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import useStore from '../store/useStore';
import ExcalidrawBlock from './ExcalidrawBlock';
import { createDefaultExcalidrawScene, parseExcalidrawContent } from '../utils/excalidraw';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

const searchPluginKey = new PluginKey('gmeSearchPlugin');

function buildSearchRegex(query, options = {}) {
  if (!query) return null;
  const { matchCase = false, wholeWord = false, regex = false } = options;
  let pattern = query;
  if (!regex) {
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  if (wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  const flags = matchCase ? 'g' : 'gi';
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function findMatchesInDoc(doc, query, options = {}) {
  if (!doc || !query) return [];
  const re = buildSearchRegex(query, options);
  if (!re) return [];

  const matches = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      let blockText = '';
      const indexToDocPos = [];

      node.forEach((child, offset) => {
        if (child.isText) {
          const startPos = pos + 1 + offset;
          const text = child.text || '';
          for (let i = 0; i < text.length; i++) {
            blockText += text[i];
            indexToDocPos.push(startPos + i);
          }
        } else if (child.isAtom || child.isLeaf) {
          const startPos = pos + 1 + offset;
          blockText += ' ';
          indexToDocPos.push(startPos);
        }
      });

      if (!blockText) return;

      re.lastIndex = 0;
      let m;
      while ((m = re.exec(blockText)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        const matchStart = m.index;
        const matchEnd = m.index + m[0].length;
        if (matchStart < indexToDocPos.length && matchEnd - 1 < indexToDocPos.length) {
          const from = indexToDocPos[matchStart];
          const to = indexToDocPos[matchEnd - 1] + 1;
          matches.push({
            from,
            to,
            text: m[0],
          });
        }
      }
    }
  });

  return matches;
}

function buildDecorations(doc, matches, activeIndex) {
  if (!doc || !matches || matches.length === 0) return DecorationSet.empty;
  const decos = [];
  for (let i = 0; i < matches.length; i++) {
    const { from, to } = matches[i];
    if (from < to && to <= doc.content.size) {
      const isActive = i === activeIndex;
      decos.push(
        Decoration.inline(from, to, {
          class: isActive 
            ? 'gme-search-match gme-search-match-selected' 
            : 'gme-search-match',
        })
      );
    }
  }
  return DecorationSet.create(doc, decos);
}

function scrollToMatch(view, pos) {
  try {
    const coords = view.coordsAtPos(pos);
    const container = view.dom.closest('.rich-markdown-editor') || view.dom.parentElement;
    if (container && coords) {
      const containerRect = container.getBoundingClientRect();
      if (coords.top < containerRect.top + 60 || coords.bottom > containerRect.bottom - 60) {
        const targetScrollTop = container.scrollTop + (coords.top - containerRect.top) - containerRect.height / 2;
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      }
    }
  } catch {
    // fallback
  }
}

const createSearchPlugin = () =>
  $prose(() => {
    return new Plugin({
      key: searchPluginKey,
      state: {
        init() {
          return {
            decorations: DecorationSet.empty,
            matches: [],
            activeIndex: -1,
            query: '',
            options: {},
          };
        },
        apply(tr, prevState, oldState, newState) {
          const meta = tr.getMeta(searchPluginKey);
          if (meta) {
            return meta;
          }
          if (tr.docChanged && prevState.query) {
            const matches = findMatchesInDoc(newState.doc, prevState.query, prevState.options);
            let activeIdx = prevState.activeIndex;
            if (activeIdx >= matches.length) activeIdx = matches.length - 1;
            const decos = buildDecorations(newState.doc, matches, activeIdx);
            return {
              ...prevState,
              matches,
              activeIndex: activeIdx,
              decorations: decos,
            };
          }
          return prevState;
        },
      },
      props: {
        decorations(state) {
          return searchPluginKey.getState(state)?.decorations || DecorationSet.empty;
        },
      },
    });
  });

const RichMarkdownEditor = memo(forwardRef(({
  content,
  setContent,
  onSelectionFormatChange,
  theme = 'light',
  onOpenExcalidrawModal,
  onUpdate,
}, ref) => {
  const containerRef = useRef(null);
  const crepeRef = useRef(null);
  const contentRef = useRef(content || '');
  const markdownRef = useRef(content || '');
  const isApplyingExternalContentRef = useRef(false);
  const onSelectionFormatChangeRef = useRef(onSelectionFormatChange);
  const onUpdateRef = useRef(onUpdate);
  const [excalidrawPortals, setExcalidrawPortals] = useState([]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Search state from store
  const searchQuery = useStore(state => state.searchQuery);
  const searchOptions = useStore(state => state.searchOptions);
  const isSearchVisible = useStore(state => state.isSearchVisible);
  const setSearchResults = useStore(state => state.setSearchResults);

  const isSearchVisibleRef = useRef(isSearchVisible);
  const searchQueryRef = useRef(searchQuery);
  const searchOptionsRef = useRef(searchOptions);

  useEffect(() => {
    isSearchVisibleRef.current = isSearchVisible;
    searchQueryRef.current = searchQuery;
    searchOptionsRef.current = searchOptions;
  }, [isSearchVisible, searchQuery, searchOptions]);

  useEffect(() => {
    onSelectionFormatChangeRef.current = onSelectionFormatChange;
  }, [onSelectionFormatChange]);

  const updateSearchDecorations = useCallback((targetActiveIndex = null) => {
    const crepe = crepeRef.current;
    if (!crepe) return;

    let view = null;
    try {
      crepe.editor.action((ctx) => {
        view = ctx.get(editorViewCtx);
      });
    } catch {
      return;
    }
    if (!view) return;

    const query = searchQueryRef.current;
    const options = searchOptionsRef.current;
    const isVisible = isSearchVisibleRef.current;

    if (!isVisible || !query) {
      const tr = view.state.tr.setMeta(searchPluginKey, {
        decorations: DecorationSet.empty,
        matches: [],
        activeIndex: -1,
        query: '',
        options: options || {},
      });
      view.dispatch(tr);
      setSearchResults({ current: 0, total: 0 });
      return;
    }

    const matches = findMatchesInDoc(view.state.doc, query, options);
    let activeIdx = targetActiveIndex;

    if (activeIdx === null || activeIdx < 0 || activeIdx >= matches.length) {
      const { from, to } = view.state.selection;
      activeIdx = matches.findIndex(m => m.from <= to && m.to >= from);
      if (activeIdx === -1 && matches.length > 0) {
        activeIdx = matches.findIndex(m => m.from >= from);
        if (activeIdx === -1) activeIdx = 0;
      }
    }

    const decos = buildDecorations(view.state.doc, matches, activeIdx);
    const tr = view.state.tr.setMeta(searchPluginKey, {
      decorations: decos,
      matches,
      activeIndex: activeIdx,
      query,
      options,
    });
    view.dispatch(tr);

    setSearchResults({
      current: matches.length > 0 && activeIdx >= 0 ? activeIdx + 1 : (matches.length > 0 ? 1 : 0),
      total: matches.length,
    });
  }, [setSearchResults]);

  // Keep a ref to updateSearchDecorations so Crepe event listeners can call it without re-init
  const updateSearchDecorationsRef = useRef(updateSearchDecorations);
  useEffect(() => {
    updateSearchDecorationsRef.current = updateSearchDecorations;
  }, [updateSearchDecorations]);

  // Trigger search update only when search parameters change - this only modifies decorations in ProseMirror
  useEffect(() => {
    updateSearchDecorations();
  }, [isSearchVisible, searchQuery, searchOptions, updateSearchDecorations]);

  const syncActiveSearchMatchOnSelection = useCallback(() => {
    const crepe = crepeRef.current;
    if (!crepe) return;
    try {
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        if (!view) return;
        const pluginState = searchPluginKey.getState(view.state);
        if (!pluginState || !pluginState.matches?.length) return;

        const { from, to } = view.state.selection;
        const foundIdx = pluginState.matches.findIndex(m => m.from <= to && m.to >= from);
        if (foundIdx !== -1 && foundIdx !== pluginState.activeIndex) {
          const decos = buildDecorations(view.state.doc, pluginState.matches, foundIdx);
          const tr = view.state.tr.setMeta(searchPluginKey, {
            ...pluginState,
            activeIndex: foundIdx,
            decorations: decos,
          });
          view.dispatch(tr);
          useStore.getState().setSearchResults({
            current: foundIdx + 1,
            total: pluginState.matches.length,
          });
        }
      });
    } catch {
      // ignore
    }
  }, []);

  const syncActiveSearchMatchOnSelectionRef = useRef(syncActiveSearchMatchOnSelection);
  useEffect(() => {
    syncActiveSearchMatchOnSelectionRef.current = syncActiveSearchMatchOnSelection;
  }, [syncActiveSearchMatchOnSelection]);

  const getSelectionFormats = (selectionView) => {
    let view = selectionView;
    if (!view && crepeRef.current) {
      try {
        crepeRef.current.editor.action((ctx) => {
          view = ctx.get(editorViewCtx);
        });
      } catch {
        // Ignore context error if editor not ready
      }
    }

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const editor = containerRef.current?.querySelector('.ProseMirror');
    if (!editor) return null;

    const headingType = view?.state.schema.nodes.heading;
    const headingLevel = view?.state.selection.$from.parent.type === headingType
      ? view.state.selection.$from.parent.attrs.level
      : null;

    const activeMarks = view ? (view.state.storedMarks || view.state.selection.$from.marks()) : [];
    const isMarkActive = (typeOrName) => {
      if (!activeMarks || !activeMarks.length) return false;
      const target = typeOrName.toLowerCase();
      return activeMarks.some(m => {
        const name = m.type.name.toLowerCase();
        return name === target || name.includes(target);
      });
    };

    const anchor = selection?.anchorNode?.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : selection?.anchorNode;

    const hasFormat = (selector) => {
      if (anchor instanceof Element && anchor.closest(selector)) return true;
      if (range) {
        const fragment = range.cloneContents();
        if (fragment.querySelector(selector)) return true;
      }
      return false;
    };

    return {
      bold: isMarkActive('strong') || isMarkActive('bold') || hasFormat('strong, b'),
      italic: isMarkActive('emphasis') || isMarkActive('em') || isMarkActive('italic') || hasFormat('em, i'),
      strikethrough: isMarkActive('strike') || isMarkActive('strikethrough') || hasFormat('s, del, strike'),
      heading1: headingLevel === 1 || hasFormat('h1'),
      heading2: headingLevel === 2 || hasFormat('h2'),
      code: isMarkActive('code') || isMarkActive('inlinecode') || hasFormat('code:not(pre code)'),
      link: isMarkActive('link') || hasFormat('a'),
      math: isMarkActive('math') || hasFormat('[data-type="math_inline"]'),
    };
  };

  const handleMarkdownUpdate = useEffectEvent((markdown) => {
    if (isApplyingExternalContentRef.current || markdown === markdownRef.current) return;

    markdownRef.current = markdown;
    setContent(markdown);
  });

  const newlyCreatedBlockIdsRef = useRef(new Set());

  // Scan ProseMirror editor for Excalidraw code blocks and prepare portal containers
  const refreshExcalidrawBlocks = useCallback(() => {
    const crepe = crepeRef.current;
    if (!crepe || !containerRef.current) return;

    let view = null;
    try {
      crepe.editor.action((ctx) => {
        view = ctx.get(editorViewCtx);
      });
    } catch {
      return;
    }

    if (!view) return;

    const portals = [];
    view.state.doc.descendants((node, pos) => {
      if (
        node.type.name === 'code_block' &&
        (node.attrs?.language === 'excalidraw' || node.attrs?.language === 'json:excalidraw')
      ) {
        try {
          const dom = view.nodeDOM(pos);
          if (dom && dom instanceof HTMLElement) {
            if (!dom.dataset.gmeBlockId) {
              dom.dataset.gmeBlockId = `excalidraw-${Math.random().toString(36).slice(2, 9)}`;
            }
            const blockId = dom.dataset.gmeBlockId;

            let mountTarget = dom.querySelector('.excalidraw-rich-mount');
            if (!mountTarget) {
              mountTarget = document.createElement('div');
              mountTarget.className = 'excalidraw-rich-mount w-full';
              dom.classList.add('excalidraw-code-block-host');
              dom.appendChild(mountTarget);
            }

            const rawText = node.textContent || '';
            const parsed = parseExcalidrawContent(rawText);
            const isAutoEdit = newlyCreatedBlockIdsRef.current.has(blockId);
            if (isAutoEdit) {
              newlyCreatedBlockIdsRef.current.delete(blockId);
            }

            portals.push({
              id: blockId,
              target: mountTarget,
              pos,
              nodeSize: node.nodeSize,
              rawCode: rawText,
              parsed,
              autoEdit: isAutoEdit,
            });
          }
        } catch (err) {
          console.error('Error attaching Excalidraw block portal:', err);
        }
      }
    });

    setExcalidrawPortals(portals);
  }, []);

  const refreshExcalidrawBlocksRef = useRef(refreshExcalidrawBlocks);
  useEffect(() => {
    refreshExcalidrawBlocksRef.current = refreshExcalidrawBlocks;
  }, [refreshExcalidrawBlocks]);

  useImperativeHandle(ref, () => {
    const runCommand = (command, payload) => {
      const crepe = crepeRef.current;
      if (!crepe) return false;

      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        ctx.get(commandsCtx).call(command.key, payload);
        view.focus();
        onSelectionFormatChangeRef.current?.(getSelectionFormats(view));
      });
      return true;
    };

    const getContext = () => {
      const crepe = crepeRef.current;
      if (!crepe) return null;

      let context = null;
      crepe.editor.action((ctx) => {
        context = ctx;
      });
      return context;
    };

    const findInlineMath = (state, mathType) => {
      if (state.selection instanceof NodeSelection && state.selection.node.type === mathType) {
        return { node: state.selection.node, pos: state.selection.from };
      }

      let result = null;
      state.doc.nodesBetween(Math.max(0, state.selection.from - 1), state.selection.to + 1, (node, pos) => {
        if (node.type === mathType) result = { node, pos };
      });
      return result;
    };

    return {
      getScrollElement: () => containerRef.current,
      getSelectionFormats: () => {
        return getSelectionFormats();
      },
      bold: () => runCommand(toggleStrongCommand),
      italic: () => runCommand(toggleEmphasisCommand),
      strikethrough: () => runCommand(toggleStrikethroughCommand),
      heading: (level) => {
        const ctx = getContext();
        if (!ctx) return false;

        const view = ctx.get(editorViewCtx);
        const { $from } = view.state.selection;
        const headingType = view.state.schema.nodes.heading;
        const isActiveHeading = $from.parent.type === headingType && $from.parent.attrs.level === level;

        return isActiveHeading
          ? runCommand(setBlockTypeCommand, { nodeType: paragraphSchema.type(ctx) })
          : runCommand(wrapInHeadingCommand, level);
      },
      setBlockType: (level) => {
        const ctx = getContext();
        if (!ctx) return false;
        const nodeType = level === 0 ? paragraphSchema.type(ctx) : ctx.get(editorViewCtx).state.schema.nodes.heading;
        return runCommand(setBlockTypeCommand, level === 0 ? { nodeType } : { nodeType, attrs: { level } });
      },
      undo: () => runCommand(undoCommand),
      redo: () => runCommand(redoCommand),
      bulletList: () => {
        const ctx = getContext();
        return ctx ? runCommand(wrapInBlockTypeCommand, { nodeType: bulletListSchema.type(ctx) }) : false;
      },
      numberedList: () => {
        const ctx = getContext();
        return ctx ? runCommand(wrapInBlockTypeCommand, { nodeType: orderedListSchema.type(ctx) }) : false;
      },
      taskList: () => {
        const ctx = getContext();
        return ctx ? runCommand(wrapInBlockTypeCommand, { nodeType: listItemSchema.type(ctx), attrs: { checked: false } }) : false;
      },
      quote: () => {
        const ctx = getContext();
        return ctx ? runCommand(wrapInBlockTypeCommand, { nodeType: blockquoteSchema.type(ctx) }) : false;
      },
      link: () => runCommand(toggleLinkCommand),
      image: () => {
        const ctx = getContext();
        return ctx ? runCommand(addBlockTypeCommand, { nodeType: imageBlockSchema.type(ctx) }) : false;
      },
      insertTable: () => {
        const ctx = getContext();
        return ctx ? runCommand(addBlockTypeCommand, { nodeType: createTable(ctx, 3, 3) }) : false;
      },
      code: () => {
        const ctx = getContext();
        if (!ctx) return false;
        return runCommand(toggleInlineCodeCommand);
      },
      codeBlock: () => {
        const ctx = getContext();
        if (!ctx) return false;

        const view = ctx.get(editorViewCtx);
        const { from, to, empty } = view.state.selection;
        if (view.state.selection.$from.parent.type === codeBlockSchema.type(ctx)) {
          return runCommand(setBlockTypeCommand, { nodeType: paragraphSchema.type(ctx) });
        }
        if (empty) return runCommand(addBlockTypeCommand, { nodeType: codeBlockSchema.type(ctx) });

        const inlineMath = findInlineMath(view.state, view.state.schema.nodes.math_inline);
        const isInlineCode = view.state.doc.rangeHasMark(from, to, inlineCodeSchema.type(ctx));
        const text = inlineMath ? inlineMath.node.attrs.value : view.state.doc.textBetween(from, to, '\n');
        const language = inlineMath ? 'LaTeX' : isInlineCode ? 'C' : '';
        const codeBlock = codeBlockSchema.type(ctx).create({ language }, text ? view.state.schema.text(text) : null);
        const transaction = view.state.tr.replaceSelectionWith(codeBlock);
        const codeStart = transaction.mapping.map(from, -1) + 1;
        transaction.setSelection(TextSelection.create(transaction.doc, codeStart, codeStart + text.length));
        view.dispatch(transaction);
        view.focus();
        return true;
      },
      math: () => {
        const ctx = getContext();
        if (!ctx) return false;

        const view = ctx.get(editorViewCtx);
        const mathType = view.state.schema.nodes.math_inline;
        if (!mathType) return false;

        const inlineMath = findInlineMath(view.state, mathType);
        if (inlineMath) {
          const transaction = view.state.tr.replaceWith(
            inlineMath.pos,
            inlineMath.pos + inlineMath.node.nodeSize,
            view.state.schema.text(inlineMath.node.attrs.value)
          );
          view.dispatch(transaction);
          view.focus();
          return true;
        }

        const { from, to } = view.state.selection;
        const value = view.state.doc.textBetween(from, to);
        const transaction = view.state.tr.replaceWith(from, to, mathType.create({ value }));
        transaction.setSelection(NodeSelection.create(transaction.doc, from));
        view.dispatch(transaction);
        view.focus();
        return true;
      },
      insertText: (text) => {
        const ctx = getContext();
        if (!ctx) return false;
        const view = ctx.get(editorViewCtx);
        const { from, to } = view.state.selection;
        view.dispatch(view.state.tr.insertText(text, from, to));
        view.focus();
        return true;
      },
      insertDrawing: (customScene) => {
        const ctx = getContext();
        if (!ctx) return false;

        const view = ctx.get(editorViewCtx);
        const scene = customScene || createDefaultExcalidrawScene();
        const jsonStr = JSON.stringify(scene, null, 2);
        const codeBlock = codeBlockSchema.type(ctx).create(
          { language: 'excalidraw' },
          view.state.schema.text(jsonStr)
        );

        const newBlockId = `excalidraw-${Math.random().toString(36).slice(2, 9)}`;
        newlyCreatedBlockIdsRef.current.add(newBlockId);

        const transaction = view.state.tr.replaceSelectionWith(codeBlock);
        view.dispatch(transaction);
        view.focus();

        try {
          const nextMd = crepe.getMarkdown();
          markdownRef.current = nextMd;
          setContent(nextMd);
        } catch (e) {
          console.warn('Could not extract markdown after inserting drawing:', e);
        }

        setTimeout(() => {
          try {
            crepeRef.current?.editor?.action((actionCtx) => {
              const currentView = actionCtx.get(editorViewCtx);
              const { from } = currentView.state.selection;
              currentView.state.doc.descendants((node, pos) => {
                if (
                  node.type.name === 'code_block' &&
                  (node.attrs?.language === 'excalidraw' || node.attrs?.language === 'json:excalidraw')
                ) {
                  if (pos <= from && pos + node.nodeSize >= from - 2) {
                    const dom = currentView.nodeDOM(pos);
                    if (dom && dom instanceof HTMLElement && !dom.dataset.gmeBlockId) {
                      dom.dataset.gmeBlockId = newBlockId;
                    }
                  }
                }
              });
            });
          } catch {
            // ignore
          }
          refreshExcalidrawBlocksRef.current?.();
        }, 40);
        return true;
      },
      updateDrawing: (pos, updatedData) => {
        const crepe = crepeRef.current;
        if (!crepe) return false;

        let success = false;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const jsonStr = JSON.stringify(updatedData, null, 2);
          let targetPos = pos;
          let currentNode = typeof pos === 'number' ? view.state.doc.nodeAt(pos) : null;

          // If node at pos is not an excalidraw code_block, search for one nearby or in doc
          if (!currentNode || currentNode.type.name !== 'code_block') {
            view.state.doc.descendants((node, p) => {
              if (!currentNode && node.type.name === 'code_block' && (node.attrs?.language === 'excalidraw' || node.attrs?.language === 'json:excalidraw')) {
                if (typeof pos === 'number' && Math.abs(p - pos) < 50) {
                  targetPos = p;
                  currentNode = node;
                }
              }
            });
            if (!currentNode) {
              view.state.doc.descendants((node, p) => {
                if (!currentNode && node.type.name === 'code_block' && (node.attrs?.language === 'excalidraw' || node.attrs?.language === 'json:excalidraw')) {
                  targetPos = p;
                  currentNode = node;
                }
              });
            }
          }

          if (currentNode && currentNode.type.name === 'code_block') {
            const tr = view.state.tr.replaceWith(
              targetPos + 1,
              targetPos + currentNode.nodeSize - 1,
              view.state.schema.text(jsonStr)
            );
            view.dispatch(tr);
            success = true;
          }
        });

        if (success) {
          try {
            const nextMd = crepe.getMarkdown();
            markdownRef.current = nextMd;
            setContent(nextMd);
          } catch (e) {
            console.warn('Could not extract markdown after updating drawing:', e);
          }
          setTimeout(() => refreshExcalidrawBlocksRef.current?.(), 30);
        }
        return success;
      },
      findNext: () => {
        const crepe = crepeRef.current;
        if (!crepe) return false;
        let found = false;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          if (!view) return;
          const query = useStore.getState().searchQuery;
          const options = useStore.getState().searchOptions;
          if (!query) return;

          const matches = findMatchesInDoc(view.state.doc, query, options);
          if (matches.length === 0) {
            useStore.getState().setSearchResults({ current: 0, total: 0 });
            return;
          }

          const { to } = view.state.selection;
          let nextIdx = matches.findIndex(m => m.from >= to);
          if (nextIdx === -1) nextIdx = 0;

          const match = matches[nextIdx];
          const decos = buildDecorations(view.state.doc, matches, nextIdx);
          const tr = view.state.tr
            .setSelection(TextSelection.create(view.state.doc, match.from, match.to))
            .scrollIntoView()
            .setMeta(searchPluginKey, {
              decorations: decos,
              matches,
              activeIndex: nextIdx,
              query,
              options,
            });

          view.dispatch(tr);
          view.focus();

          useStore.getState().setSearchResults({
            current: nextIdx + 1,
            total: matches.length,
          });

          scrollToMatch(view, match.from);
          found = true;
        });
        return found;
      },
      findPrevious: () => {
        const crepe = crepeRef.current;
        if (!crepe) return false;
        let found = false;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          if (!view) return;
          const query = useStore.getState().searchQuery;
          const options = useStore.getState().searchOptions;
          if (!query) return;

          const matches = findMatchesInDoc(view.state.doc, query, options);
          if (matches.length === 0) {
            useStore.getState().setSearchResults({ current: 0, total: 0 });
            return;
          }

          const { from } = view.state.selection;
          let prevIdx = -1;
          for (let i = matches.length - 1; i >= 0; i--) {
            if (matches[i].to <= from) {
              prevIdx = i;
              break;
            }
          }
          if (prevIdx === -1) prevIdx = matches.length - 1;

          const match = matches[prevIdx];
          const decos = buildDecorations(view.state.doc, matches, prevIdx);
          const tr = view.state.tr
            .setSelection(TextSelection.create(view.state.doc, match.from, match.to))
            .scrollIntoView()
            .setMeta(searchPluginKey, {
              decorations: decos,
              matches,
              activeIndex: prevIdx,
              query,
              options,
            });

          view.dispatch(tr);
          view.focus();

          useStore.getState().setSearchResults({
            current: prevIdx + 1,
            total: matches.length,
          });

          scrollToMatch(view, match.from);
          found = true;
        });
        return found;
      },
      replaceNext: () => {
        const crepe = crepeRef.current;
        if (!crepe) return false;
        let success = false;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          if (!view) return;
          const query = useStore.getState().searchQuery;
          const replaceText = useStore.getState().replaceQuery;
          const options = useStore.getState().searchOptions;
          if (!query) return;

          const matches = findMatchesInDoc(view.state.doc, query, options);
          if (matches.length === 0) {
            useStore.getState().setSearchResults({ current: 0, total: 0 });
            return;
          }

          const { from, to } = view.state.selection;
          let matchIdx = matches.findIndex(m => m.from === from && m.to === to);
          let targetMatch = null;

          if (matchIdx !== -1) {
            targetMatch = matches[matchIdx];
          } else {
            matchIdx = matches.findIndex(m => m.from >= from);
            if (matchIdx === -1) matchIdx = 0;
            targetMatch = matches[matchIdx];
          }

          if (!targetMatch) return;

          const tr = view.state.tr;
          if (replaceText) {
            tr.replaceWith(targetMatch.from, targetMatch.to, view.state.schema.text(replaceText));
          } else {
            tr.delete(targetMatch.from, targetMatch.to);
          }

          const newMatches = findMatchesInDoc(tr.doc, query, options);
          if (newMatches.length > 0) {
            const nextPos = targetMatch.from + (replaceText ? replaceText.length : 0);
            let nextIdx = newMatches.findIndex(m => m.from >= nextPos);
            if (nextIdx === -1) nextIdx = 0;
            const nextMatch = newMatches[nextIdx];

            tr.setSelection(TextSelection.create(tr.doc, nextMatch.from, nextMatch.to));
            tr.scrollIntoView();
            tr.setMeta(searchPluginKey, {
              decorations: buildDecorations(tr.doc, newMatches, nextIdx),
              matches: newMatches,
              activeIndex: nextIdx,
              query,
              options,
            });

            view.dispatch(tr);
            view.focus();

            useStore.getState().setSearchResults({
              current: nextIdx + 1,
              total: newMatches.length,
            });
            scrollToMatch(view, nextMatch.from);
          } else {
            tr.setMeta(searchPluginKey, {
              decorations: DecorationSet.empty,
              matches: [],
              activeIndex: -1,
              query,
              options,
            });
            view.dispatch(tr);
            view.focus();
            useStore.getState().setSearchResults({ current: 0, total: 0 });
          }
          success = true;
        });
        return success;
      },
      replaceAll: () => {
        const crepe = crepeRef.current;
        if (!crepe) return false;
        let success = false;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          if (!view) return;
          const query = useStore.getState().searchQuery;
          const replaceText = useStore.getState().replaceQuery;
          const options = useStore.getState().searchOptions;
          if (!query) return;

          const matches = findMatchesInDoc(view.state.doc, query, options);
          if (matches.length === 0) return;

          const tr = view.state.tr;
          for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            if (replaceText) {
              tr.replaceWith(m.from, m.to, view.state.schema.text(replaceText));
            } else {
              tr.delete(m.from, m.to);
            }
          }

          tr.setMeta(searchPluginKey, {
            decorations: DecorationSet.empty,
            matches: [],
            activeIndex: -1,
            query,
            options,
          });

          view.dispatch(tr);
          view.focus();

          useStore.getState().setSearchResults({ current: 0, total: 0 });
          success = true;
        });
        return success;
      },
    };
  }, []);

  useEffect(() => {
    contentRef.current = content || '';
  }, [content]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    let isDisposed = false;
    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: contentRef.current,
      features: {
        [Crepe.Feature.TopBar]: false,
        [Crepe.Feature.Toolbar]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: 'Start writing...',
          mode: 'block',
        },
        [Crepe.Feature.Latex]: {
          katexOptions: { throwOnError: false },
        },
      },
    });

    const searchPluginInstance = createSearchPlugin();
    crepe.editor.use(searchPluginInstance);

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (isDisposed) return;
        handleMarkdownUpdate(markdown);
      });
      listener.updated((ctx) => {
        if (isDisposed) return;
        try {
          const view = ctx.get(editorViewCtx);
          onSelectionFormatChangeRef.current?.(getSelectionFormats(view));
          refreshExcalidrawBlocksRef.current?.();
          if (isSearchVisibleRef.current && searchQueryRef.current) {
            const pluginState = searchPluginKey.getState(view.state);
            if (pluginState) {
              useStore.getState().setSearchResults({
                current: pluginState.matches?.length > 0 ? (pluginState.activeIndex >= 0 ? pluginState.activeIndex + 1 : 1) : 0,
                total: pluginState.matches?.length || 0,
              });
            }
          }
          onUpdateRef.current?.();
        } catch {
          // ignore if editor view not ready
        }
      });
    });

    const initialize = async () => {
      await crepe.create();

      if (isDisposed) {
        await crepe.destroy();
        return;
      }

      crepeRef.current = crepe;
      markdownRef.current = crepe.getMarkdown();

      const updateSelectionFormats = () => {
        onSelectionFormatChangeRef.current?.(getSelectionFormats());
        if (isSearchVisibleRef.current && searchQueryRef.current) {
          syncActiveSearchMatchOnSelectionRef.current?.();
        }
      };
      containerRef.current.addEventListener('mouseup', updateSelectionFormats);
      containerRef.current.addEventListener('keyup', updateSelectionFormats);
      containerRef.current.addEventListener('focusin', updateSelectionFormats);
      document.addEventListener('selectionchange', updateSelectionFormats);

      const cleanupSelectionFormats = () => {
        containerRef.current?.removeEventListener('mouseup', updateSelectionFormats);
        containerRef.current?.removeEventListener('keyup', updateSelectionFormats);
        containerRef.current?.removeEventListener('focusin', updateSelectionFormats);
        document.removeEventListener('selectionchange', updateSelectionFormats);
      };

      if (contentRef.current !== markdownRef.current) {
        isApplyingExternalContentRef.current = true;
        crepe.editor.action(replaceAll(contentRef.current, true));
        markdownRef.current = contentRef.current;
        isApplyingExternalContentRef.current = false;
      }

      crepeRef.current.cleanupSelectionFormats = cleanupSelectionFormats;
      setTimeout(() => refreshExcalidrawBlocksRef.current?.(), 100);
      updateSearchDecorationsRef.current?.();
      onUpdateRef.current?.();
    };

    void initialize();

    return () => {
      isDisposed = true;
      crepe.cleanupSelectionFormats?.();
      if (crepeRef.current === crepe) crepeRef.current = null;
      void crepe.destroy();
    };
  }, []);

  useEffect(() => {
    const crepe = crepeRef.current;
    const nextContent = content || '';

    if (!crepe || nextContent === markdownRef.current) return;

    isApplyingExternalContentRef.current = true;
    crepe.editor.action(replaceAll(nextContent, true));
    markdownRef.current = nextContent;
    isApplyingExternalContentRef.current = false;
    setTimeout(() => refreshExcalidrawBlocksRef.current?.(), 100);
  }, [content]);

  // Handle in-place canvas update inside ProseMirror
  const handleBlockChange = (pos, updatedData) => {
    const crepe = crepeRef.current;
    if (!crepe) return;

    let success = false;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const jsonStr = JSON.stringify(updatedData, null, 2);
      const currentNode = view.state.doc.nodeAt(pos);
      if (currentNode && currentNode.type.name === 'code_block') {
        const tr = view.state.tr.replaceWith(
          pos + 1,
          pos + currentNode.nodeSize - 1,
          view.state.schema.text(jsonStr)
        );
        view.dispatch(tr);
        success = true;
      }
    });

    if (success) {
      try {
        const nextMd = crepe.getMarkdown();
        markdownRef.current = nextMd;
        setContent(nextMd);
      } catch {
        // ignore
      }
    }
  };

  // Handle block deletion
  const handleBlockDelete = (pos, nodeSize) => {
    const crepe = crepeRef.current;
    if (!crepe) return;

    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = view.state.tr.delete(pos, pos + nodeSize);
      view.dispatch(tr);
    });

    try {
      const nextMd = crepe.getMarkdown();
      markdownRef.current = nextMd;
      setContent(nextMd);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className={`rich-markdown-editor h-full overflow-y-auto custom-scrollbar ${theme === 'dark' ? 'rich-markdown-editor-dark' : ''}`}
      />

      {/* Excalidraw Block Portals rendered right inside WYSIWYG document */}
      {excalidrawPortals.map((portal) =>
        portal.target ? (
          ReactDOM.createPortal(
            <ExcalidrawBlock
              key={portal.id}
              rawCode={portal.rawCode}
              parsedData={portal.parsed}
              autoEdit={portal.autoEdit}
              theme={theme}
              isEditable={true}
              onChange={(updatedData) => handleBlockChange(portal.pos, updatedData)}
              onDelete={() => handleBlockDelete(portal.pos, portal.nodeSize)}
            />,
            portal.target
          )
        ) : null
      )}
    </div>
  );
}));

RichMarkdownEditor.displayName = 'RichMarkdownEditor';

export default RichMarkdownEditor;