import React, { memo, useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting as cmSyntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

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
  }
});

const CodeMirrorEditor = memo(({ 
  viewMode, 
  splitRatio, 
  editorRef, 
  content, 
  setContent, 
  handleScroll,
  theme,
  syntaxHighlighting
}) => {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Initialize Editor
  useEffect(() => {
    if (!containerRef.current) return;

    let debounceTimer;

    const startState = EditorState.create({
      doc: content || '',
      extensions: [
        basicSetup,
        languageConfig.of(syntaxHighlighting ? markdown({ codeLanguages: languages }) : []),
        highlightConfig.of(syntaxHighlighting ? cmSyntaxHighlighting(theme === 'dark' ? darkHighlightStyle : lightHighlightStyle) : []),
        baseThemeConfig.of(getBaseTheme(theme)),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              const newContent = update.state.doc.toString();
              contentRef.current = newContent;
              setContent(newContent);
            }, 300);
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

    const scroller = view.scrollDOM;
    scroller.addEventListener('scroll', handleScroll);

    return () => {
      clearTimeout(debounceTimer);
      scroller.removeEventListener('scroll', handleScroll);
      view.destroy();
    };
  }, []);

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
    const currentText = viewRef.current.state.doc.toString();
    if (content !== currentText) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: content || '' }
      });
    }
  }, [content]);

  if (viewMode === 'preview') return null;

  return (
    <div 
      id="editor-container" 
      ref={containerRef}
      className={`h-full bg-white dark:bg-[#0d1117] overflow-hidden custom-scrollbar ${viewMode === 'split' ? '' : 'flex-1'}`} 
      style={viewMode === 'split' ? { width: `${splitRatio * 100}%` } : {}}
    />
  );
});

CodeMirrorEditor.displayName = 'CodeMirrorEditor';

export default CodeMirrorEditor;
