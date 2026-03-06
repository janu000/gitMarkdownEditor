import React, { memo, useEffect, useRef } from 'react';
import { 
  lineNumbers, highlightActiveLineGutter, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor,
  highlightActiveLine, keymap, EditorView, scrollPastEnd
} from '@codemirror/view';
import { EditorState, Compartment, Transaction } from '@codemirror/state';
import { 
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

const themeConfig = new Compartment();
const languageConfig = new Compartment();
const highlightConfig = new Compartment();
const baseThemeConfig = new Compartment();

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
  { tag: t.heading1, color: "#a5b4fc", fontWeight: "bold" },
  { tag: t.heading2, color: "#a5b4fc", fontWeight: "bold" },
  { tag: t.heading3, color: "#a5b4fc", fontWeight: "bold" },
  { tag: t.keyword, color: "#a78bfa" },
  { tag: t.atom, color: "#60a5fa" },
  { tag: t.number, color: "#fbbf24" },
  { tag: t.string, color: "#34d399" },
  { tag: t.comment, color: "#6b7280", fontStyle: "italic" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.link, color: "#a5b4fc", textDecoration: "underline" },
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
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  cmSyntaxHighlighting(lightHighlightStyle), // Default highlight style
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
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
    padding: "24px"
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
  }
});

const isUrl = (str) => {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
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
            clearTimeout(debounceTimer);
            const syncDelay = update.state.doc.length < 10000 ? 10 : 300;
            
            debounceTimer = setTimeout(() => {
              const newContent = update.state.doc.toString();
              contentRef.current = newContent;
              setContent(newContent);
            }, syncDelay);
          }
          
          if (onUpdateRef.current && (update.docChanged || update.geometryChanged || update.viewportChanged)) {
            onUpdateRef.current(update);
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

    return () => {
      clearTimeout(debounceTimer);
      view.destroy();
    };
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
    
    if (content !== undefined && content !== currentText) {
      view.dispatch({
        changes: { from: 0, to: currentText.length, insert: content || '' },
        selection: { anchor: 0 },
        annotations: Transaction.remote.of(true)
      });
      contentRef.current = content;
    }
  }, [content]);

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
