import React, { memo, useEffect, useRef } from 'react';
import { 
  lineNumbers, highlightActiveLineGutter, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor,
  highlightActiveLine, keymap, EditorView, scrollPastEnd,
  ViewPlugin, Decoration, WidgetType
} from '@codemirror/view';
import { EditorState, Compartment, Transaction, StateField, StateEffect } from '@codemirror/state';
import { 
  codeFolding, foldEffect, unfoldEffect, foldedRanges, foldState,
  foldGutter, indentOnInput, syntaxHighlighting as cmSyntaxHighlighting, 
  bracketMatching, foldKeymap, HighlightStyle 
} from '@codemirror/language';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { 
  setSearchQuery, SearchQuery, search,
  openSearchPanel
} from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { tags as t } from '@lezer/highlight';
import useStore from '../store/useStore';
import {
  scanCodeBlocks,
  isRangeFolded,
  getFileStorageKey,
  saveBlockFoldStates,
  applyFoldStates,
  foldRestoreAnnotation
} from '../utils/codeBlockFoldStorage';

const languageConfig = new Compartment();
const highlightConfig = new Compartment();
const baseThemeConfig = new Compartment();

class FoldButtonWidget extends WidgetType {
  constructor(isCollapsed, startPos, startLineTo, endPos, lineCount) {
    super();
    this.isCollapsed = isCollapsed;
    this.startPos = startPos;
    this.startLineTo = startLineTo;
    this.endPos = endPos;
    this.lineCount = lineCount;
  }

  eq(other) {
    return this.isCollapsed === other.isCollapsed &&
           this.startPos === other.startPos &&
           this.startLineTo === other.startLineTo &&
           this.endPos === other.endPos &&
           this.lineCount === other.lineCount;
  }

  toDOM(view) {
    const btn = document.createElement('span');
    btn.className = `cm-codeblock-fold-btn ${this.isCollapsed ? 'is-collapsed' : 'is-expanded'}`;
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '-1');
    btn.setAttribute('title', this.isCollapsed ? `Expand code block (${this.lineCount} lines)` : `Collapse code block (${this.lineCount} lines)`);
    
    btn.innerHTML = this.isCollapsed
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    btn.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const folded = isRangeFolded(view.state, this.startLineTo, this.endPos);
      if (folded) {
        view.dispatch({
          effects: unfoldEffect.of({ from: this.startLineTo, to: this.endPos })
        });
      } else {
        view.dispatch({
          effects: foldEffect.of({ from: this.startLineTo, to: this.endPos })
        });
      }
    };

    return btn;
  }

  ignoreEvent() {
    return true;
  }
}

const codeBlockFoldPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.getDecorations(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged || update.state.field(foldState, false) !== update.startState.field(foldState, false)) {
      this.decorations = this.getDecorations(update.view);
    }
  }

  getDecorations(view) {
    const builder = [];
    const doc = view.state.doc;
    const blocks = scanCodeBlocks(doc);

    for (const block of blocks) {
      if (block.lineCount < 1) continue;

      const isCollapsed = isRangeFolded(view.state, block.startLineTo, block.endPos);

      // Add the inline fold button to the left of the start of the code block line
      builder.push(
        Decoration.widget({
          widget: new FoldButtonWidget(isCollapsed, block.startPos, block.startLineTo, block.endPos, block.lineCount),
          side: -1
        }).range(block.startPos)
      );
    }

    return Decoration.set(builder, true);
  }
}, {
  decorations: v => v.decorations
});

const tableDecoration = Decoration.mark({ class: "cm-table-highlight" });

const tableHighlightPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.getDecorations(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.getDecorations(update.view);
    }
  }

  getDecorations(view) {
    const builder = [];
    const doc = view.state.doc;

    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        const line = doc.lineAt(pos);
        const pipeCount = (line.text.match(/\|/g) || []).length;

        if (pipeCount > 1) {
          for (let i = 0; i < line.text.length; i++) {
            if (line.text[i] === '|') {
              builder.push(tableDecoration.range(line.from + i, line.from + i + 1));

              // Also highlight segments between pipes if they consist of dashes (allowing whitespace)
              let j = i + 1;
              while (j < line.text.length && line.text[j] === ' ') j++; // Skip leading whitespace
              
              let dashStart = j;
              while (j < line.text.length && line.text[j] === '-') j++; // Find dashes
              let dashEnd = j;
              
              if (dashEnd > dashStart) { // Found some dashes
                while (j < line.text.length && line.text[j] === ' ') j++; // Skip trailing whitespace
                if (j < line.text.length && line.text[j] === '|') {
                  builder.push(tableDecoration.range(line.from + dashStart, line.from + dashEnd));
                }
              }
            }
          }
        }
        pos = line.to + 1;
      }
    }
    return Decoration.set(builder);
  }
}, {
  decorations: v => v.decorations
});

const mathDecoration = Decoration.mark({ class: "cm-math-highlight" });
const mathCommandDecoration = Decoration.mark({ class: "cm-math-command-highlight" });

const mathHighlightPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.getDecorations(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.getDecorations(update.view);
    }
  }

  getDecorations(view) {
    const builder = [];
    const doc = view.state.doc;
    const text = doc.toString();

    for (const { from, to } of view.visibleRanges) {
      const rangeText = text.slice(from, to);
      
      // Block Math: $$ ... $$
      const blockRegex = /\$\$\n?([\s\S]+?)\n?\$\$/g;
      let match;
      while ((match = blockRegex.exec(rangeText)) !== null) {
        const start = from + match.index;
        const end = start + match[0].length;
        this.addMathDecorations(builder, start, end, text);
      }
      
      // Inline Math: $ ... $
      const inlineRegex = /(?<!\$)\$((?:\\\$|[^$])+)\$(?!\$)/g;
      while ((match = inlineRegex.exec(rangeText)) !== null) {
        const start = from + match.index;
        const end = start + match[0].length;
        this.addMathDecorations(builder, start, end, text);
      }
    }
    return Decoration.set(builder, true);
  }

  addMathDecorations(builder, start, end, fullText) {
    builder.push(mathDecoration.range(start, end));
    
    const mathContent = fullText.slice(start, end);
    const cmdRegex = /\\[a-zA-Z]+/g;
    let cmdMatch;
    while ((cmdMatch = cmdRegex.exec(mathContent)) !== null) {
      const cmdStart = start + cmdMatch.index;
      const cmdEnd = cmdStart + cmdMatch[0].length;
      builder.push(mathCommandDecoration.range(cmdStart, cmdEnd));
    }
  }
}, {
  decorations: v => v.decorations
});

// Modern, pleasant colors for Light Mode
const lightHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, color: "#4f46e5", fontWeight: "bold" },
  { tag: t.heading2, color: "#4f46e5", fontWeight: "bold" },
  { tag: t.heading3, color: "#4f46e5", fontWeight: "bold" },
  { tag: t.keyword, color: "#7c3aed" },
  { tag: t.atom, color: "#2563eb" },
  { tag: t.number, color: "#d97706" },
  { tag: t.string, color: "#059669" },
  { tag: t.comment, color: "#9ca3af", fontStyle: "italic" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.link, color: "#4f46e5", textDecoration: "underline" },
  { tag: t.url, color: "#6b7280" },
  { tag: t.monospace, color: "#db2777" },
  { tag: t.strikethrough, textDecoration: "line-through" },
]);

// Modern, pleasant colors for Dark Mode
const darkHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, color: "#818cf8", fontWeight: "bold" },
  { tag: t.heading2, color: "#818cf8", fontWeight: "bold" },
  { tag: t.heading3, color: "#818cf8", fontWeight: "bold" },
  { tag: t.keyword, color: "#a78bfa" },
  { tag: t.atom, color: "#60a5fa" },
  { tag: t.number, color: "#fbbf24" },
  { tag: t.string, color: "#34d399" },
  { tag: t.comment, color: "#6b7280", fontStyle: "italic" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.link, color: "#818cf8", textDecoration: "underline" },
  { tag: t.url, color: "#9ca3af" },
  { tag: t.monospace, color: "#f472b6" },
  { tag: t.strikethrough, textDecoration: "line-through" },
]);

// custom basicSetup without searchKeymap
const customBasicSetup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  codeFolding(),
  codeBlockFoldPlugin,
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  tableHighlightPlugin,
  mathHighlightPlugin,
  search({
    top: true,
    createPanel: () => ({ dom: document.createElement("div") }) // Dummy panel to prevent default UI from showing
  }),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    // ...searchKeymap, // Removed to disable default search UI
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap
  ])
];

const getBaseTheme = (theme) => EditorView.theme({
  "&": { height: "100%", fontSize: "14px", backgroundColor: "transparent !important" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { 
    overflow: "auto", 
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    lineHeight: "1.625",
    padding: "32px 32px 32px 64px"
  },
  ".cm-content": { 
    padding: "0",
    color: theme === 'dark' ? "#d1d5db" : "#1f2937"
  },
  ".cm-cursor": {
    borderLeftColor: theme === 'dark' ? "#fff" : "#000"
  },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", display: "none" },
  ".cm-activeLine": {
     backgroundColor: theme === 'dark' ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)"
  },
  ".cm-selectionBackground": {
     backgroundColor: theme === 'dark' ? "rgba(79, 70, 229, 0.3) !important" : "rgba(79, 70, 229, 0.1) !important"
  },
  ".cm-searchMatch": {
    backgroundColor: theme === 'dark' ? "rgba(255, 255, 0, 0.25)" : "rgba(255, 255, 0, 0.4)",
    outline: theme === 'dark' ? "1px solid rgba(255, 255, 0, 0.5)" : "1px solid rgba(255, 255, 0, 0.8)"
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "rgba(255, 150, 50, 0.6) !important",
    outline: "1px solid rgba(255, 150, 50, 1) !important"
  },
  ".cm-table-highlight": {
    color: theme === 'dark' ? "#f9e616 !important" : "#059669 !important",
    fontWeight: "bold"
  },
  ".cm-math-highlight": {
    color: theme === 'dark' ? "#f9e616 !important" : "#059669 !important"
  },
  ".cm-math-command-highlight": {
    color: theme === 'dark' ? "#f472b6 !important" : "#db2777 !important",
    fontWeight: "bold"
  }
  });

const isUrl = (str) => {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const CodeMirrorEditor = memo(({ 
  editorRef, 
  content, 
  setContent, 
  theme,
  syntaxHighlighting,
  onUpdate
}) => {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const contentRef = useRef(content);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const activeFile = useStore(state => state.activeFile);
  const activeFileRef = useRef(activeFile);
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  const searchQuery = useStore(state => state.searchQuery);
  const searchOptions = useStore(state => state.searchOptions);
  const isSearchVisible = useStore(state => state.isSearchVisible);
  const setSearchResults = useStore(state => state.setSearchResults);

  // Use refs for search state to avoid stale closures in updateListener
  const searchStateRef = useRef({ searchQuery, searchOptions, isSearchVisible });
  useEffect(() => {
    searchStateRef.current = { searchQuery, searchOptions, isSearchVisible };
  }, [searchQuery, searchOptions, isSearchVisible]);

  // Initialize Editor
  useEffect(() => {
    if (!containerRef.current) return;

    let debounceTimer;

    const startState = EditorState.create({
      doc: content || '',
      extensions: [
        customBasicSetup,
        languageConfig.of(syntaxHighlighting ? markdown({ codeLanguages: languages }) : []),
        highlightConfig.of(syntaxHighlighting ? cmSyntaxHighlighting(theme === 'dark' ? darkHighlightStyle : lightHighlightStyle) : []),
        baseThemeConfig.of(getBaseTheme(theme)),
        EditorView.lineWrapping,
        scrollPastEnd(),
        EditorView.domEventHandlers({
          paste(event, view) {
            const { from, to } = view.state.selection.main;
            const text = event.clipboardData.getData('text/plain');
            if (!text) return false;

            if (isUrl(text)) {
              const selectedText = view.state.doc.sliceString(from, to);
              
              // If the selection is already a URL or looks like a link, paste normally
              if (isUrl(selectedText) || (selectedText.startsWith('[') && selectedText.endsWith(')'))) {
                return false;
              }

              const url = text.trim();
              const label = from === to ? url.replace(/^https?:\/\//, '') : selectedText;
              const insert = `[${label}](${url})`;

              view.dispatch({
                changes: { from, to, insert },
                selection: { anchor: from + 1, head: from + 1 + label.length },
                scrollIntoView: true
              });
              return true;
            }
            return false;
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            contentRef.current = newContent;
            clearTimeout(debounceTimer);
            const syncDelay = update.state.doc.length < 10000 ? 10 : 300;
            
            debounceTimer = setTimeout(() => {
              setContent(newContent);
            }, syncDelay);
          }
          
          if (onUpdateRef.current && (update.docChanged || update.geometryChanged || update.viewportChanged)) {
            onUpdateRef.current(update);
          }

          // Persist user-driven codeblock fold toggles across site refreshes
          const isRestore = update.transactions.some(tr => tr.annotation(foldRestoreAnnotation));
          if (!isRestore && update.state.field(foldState, false) !== update.startState.field(foldState, false)) {
            const doc = update.state.doc;
            const blocks = scanCodeBlocks(doc);
            const currentKey = getFileStorageKey(activeFileRef.current);
            const blocksWithState = blocks.map((b, i) => ({
              block: b,
              index: i,
              doc,
              isFolded: isRangeFolded(update.state, b.startLineTo, b.endPos)
            }));
            saveBlockFoldStates(currentKey, blocksWithState);
          }

          // Update search results
          const { isSearchVisible: freshIsVisible, searchQuery: freshQuery, searchOptions: freshOptions } = searchStateRef.current;
          
          if (freshIsVisible && freshQuery) {
            const doc = update.state.doc;
            const query = new SearchQuery({
              search: freshQuery,
              caseSensitive: freshOptions.matchCase,
              wholeWord: freshOptions.wholeWord,
              regexp: freshOptions.regex
            });
            
            const cursor = query.getCursor(doc);
            let total = 0;
            let current = 0;
            const selection = update.state.selection.main;

            let result = cursor.next();
            while (!result.done) {
              total++;
              if (result.value.from === selection.from && result.value.to === selection.to) {
                current = total;
              }
              result = cursor.next();
            }
            
            setSearchResults({ current, total });
          } else {
            setSearchResults({ current: 0, total: 0 });
          }
        })
      ]
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current
    });

    viewRef.current = view;
    if (editorRef) editorRef.current = view;

    // Apply saved or default fold states (e.g. excalidraw blocks collapsed by default) on initial mount
    applyFoldStates(view, getFileStorageKey(activeFileRef.current), activeFileRef.current?.name || '');

    return () => {
      clearTimeout(debounceTimer);
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync search state
  useEffect(() => {
    if (!viewRef.current) return;
    const { matchCase, wholeWord, regex } = searchOptions;
    
    viewRef.current.dispatch({
      effects: setSearchQuery.of(new SearchQuery({
        search: isSearchVisible ? searchQuery : '',
        caseSensitive: matchCase,
        wholeWord: wholeWord,
        regexp: regex
      }))
    });

    if (isSearchVisible) {
      openSearchPanel(viewRef.current);
    }
  }, [searchQuery, searchOptions, isSearchVisible]);

  // Sync theme and highlighting
  useEffect(() => {
    if (!viewRef.current) return;
    
    viewRef.current.dispatch({
      effects: [
        highlightConfig.reconfigure(syntaxHighlighting ? cmSyntaxHighlighting(theme === 'dark' ? darkHighlightStyle : lightHighlightStyle) : []),
        baseThemeConfig.reconfigure(getBaseTheme(theme))
      ]
    });
  }, [theme, syntaxHighlighting]);

  // Sync language
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: languageConfig.reconfigure(syntaxHighlighting ? markdown({ codeLanguages: languages }) : [])
    });
  }, [syntaxHighlighting]);

  // Sync content from outside (e.g. file load)
  useEffect(() => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const currentText = view.state.doc.toString();
    
    if (content !== undefined && content !== currentText && content !== contentRef.current) {
      view.dispatch({
        changes: { from: 0, to: currentText.length, insert: content || '' },
        selection: { anchor: 0 },
        annotations: Transaction.remote.of(true)
      });
      contentRef.current = content;
      applyFoldStates(view, getFileStorageKey(activeFileRef.current), activeFileRef.current?.name || '');
    }
  }, [content]);

  // Re-apply fold states when switching active files
  useEffect(() => {
    if (!viewRef.current) return;
    applyFoldStates(viewRef.current, getFileStorageKey(activeFile), activeFile?.name || '');
  }, [activeFile]);

  return (
    <div 
      id="editor-container" 
      ref={containerRef}
      className="h-full bg-white dark:bg-[#0d1117] overflow-hidden custom-scrollbar w-full" 
    />
  );
});

CodeMirrorEditor.displayName = 'CodeMirrorEditor';

export default CodeMirrorEditor;
