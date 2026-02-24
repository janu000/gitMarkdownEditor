import React, { memo, useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { languages } from '@codemirror/language-data';

const themeConfig = new Compartment();

const CodeMirrorEditor = memo(({ 
  viewMode, 
  splitRatio, 
  editorRef, 
  content, 
  setContent, 
  handleScroll,
  theme
}) => {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const contentRef = useRef(content); // Keep track of latest content without re-renders

  // Update contentRef whenever content prop changes from outside
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
        markdown({ codeLanguages: languages }),
        EditorView.lineWrapping,
        themeConfig.of(theme === 'dark' ? oneDark : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            // ✅ IMPROVEMENT: Don't stringify the whole document immediately.
            // CM6 internal 'Text' tree handles the edit efficiently.
            
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              const newContent = update.state.doc.toString();
              contentRef.current = newContent;
              setContent(newContent);
            }, 300); // Only flatten to string after 300ms of inactivity
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "14px", backgroundColor: "transparent !important" },
          ".cm-scroller": { 
            overflow: "auto", 
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            lineHeight: "1.625",
            padding: "24px"
          },
          ".cm-content": { padding: "0" },
          "&.cm-focused": { outline: "none" },
          ".cm-gutters": { backgroundColor: "transparent", border: "none", display: "none" }
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

  // Sync theme
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: themeConfig.reconfigure(theme === 'dark' ? oneDark : [])
    });
  }, [theme]);

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
