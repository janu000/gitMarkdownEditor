import { forwardRef, memo, useEffect, useEffectEvent, useImperativeHandle, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Crepe } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { imageBlockSchema } from '@milkdown/kit/component/image-block';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { replaceAll } from '@milkdown/kit/utils';
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
import ExcalidrawBlock from './ExcalidrawBlock';
import { createDefaultExcalidrawScene, parseExcalidrawContent } from '../utils/excalidraw';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

const RichMarkdownEditor = memo(forwardRef(({
  content,
  setContent,
  onSelectionFormatChange,
  theme = 'light',
  onOpenExcalidrawModal,
}, ref) => {
  const containerRef = useRef(null);
  const crepeRef = useRef(null);
  const contentRef = useRef(content || '');
  const markdownRef = useRef(content || '');
  const isApplyingExternalContentRef = useRef(false);
  const onSelectionFormatChangeRef = useRef(onSelectionFormatChange);
  const [excalidrawPortals, setExcalidrawPortals] = useState([]);

  useEffect(() => {
    onSelectionFormatChangeRef.current = onSelectionFormatChange;
  }, [onSelectionFormatChange]);

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
          refreshExcalidrawBlocks();
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
          setTimeout(refreshExcalidrawBlocks, 30);
        }
        return success;
      },
    };
  }, [refreshExcalidrawBlocks]);

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
          refreshExcalidrawBlocks();
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
      setTimeout(refreshExcalidrawBlocks, 100);
    };

    void initialize();

    return () => {
      isDisposed = true;
      crepe.cleanupSelectionFormats?.();
      if (crepeRef.current === crepe) crepeRef.current = null;
      void crepe.destroy();
    };
  }, [refreshExcalidrawBlocks]);

  useEffect(() => {
    const crepe = crepeRef.current;
    const nextContent = content || '';

    if (!crepe || nextContent === markdownRef.current) return;

    isApplyingExternalContentRef.current = true;
    crepe.editor.action(replaceAll(nextContent, true));
    markdownRef.current = nextContent;
    isApplyingExternalContentRef.current = false;
    setTimeout(refreshExcalidrawBlocks, 100);
  }, [content, refreshExcalidrawBlocks]);

  // Handle in-place canvas update inside ProseMirror
  const handleBlockChange = (pos, updatedData) => {
    const crepe = crepeRef.current;
    if (!crepe) return;

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
      }
    });
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
              onOpenFullscreen={(data) => {
                if (onOpenExcalidrawModal) {
                  onOpenExcalidrawModal(data, portal.rawCode, portal.pos, portal.pos + portal.nodeSize);
                }
              }}
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