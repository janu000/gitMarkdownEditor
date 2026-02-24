import { useCallback } from 'react';
import { EditorView } from 'codemirror';

export default function useFormatting(editorRef) {
  const insertText = useCallback((before, after = '', defaultText = '') => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.doc.sliceString(from, to) || defaultText;
    
    view.dispatch({
      changes: { from, to, insert: before + selectedText + after },
      selection: { anchor: from + before.length, head: from + before.length + selectedText.length },
      scrollIntoView: true
    });
    view.focus();
  }, [editorRef]);

  const insertListItem = useCallback((prefix, defaultText = '') => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    let selectedText = state.doc.sliceString(from, to);
    
    if (selectedText.length === 0) {
        const insert = prefix + defaultText;
        view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + prefix.length, head: from + prefix.length + defaultText.length },
            scrollIntoView: true
        });
    } else {
        const lines = selectedText.split('\n');
        const prefixedLines = lines.map(line => {
            if (line.trim().length > 0 && !line.trim().startsWith(prefix.trim())) return prefix + line;
            return line;
        });
        const newContent = prefixedLines.join('\n');
        view.dispatch({
            changes: { from, to, insert: newContent },
            selection: { anchor: from, head: from + newContent.length },
            scrollIntoView: true
        });
    }
    view.focus();
  }, [editorRef]);

  const insertNumberedList = useCallback((startNumber = 1, defaultText = 'Numbered item') => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    let selectedText = state.doc.sliceString(from, to);

    if (selectedText.length === 0) {
        const prefix = `${startNumber}. `;
        const insert = prefix + defaultText;
        view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + prefix.length, head: from + prefix.length + defaultText.length },
            scrollIntoView: true
        });
    } else {
        const lines = selectedText.split('\n');
        let currentNum = startNumber;
        const prefixedLines = lines.map(line => {
            if (line.trim().length > 0 && !/^\d+\.\s/.test(line.trim())) return `${currentNum++}. ${line}`;
            return line;
        });
        const newContent = prefixedLines.join('\n');
        view.dispatch({
            changes: { from, to, insert: newContent },
            selection: { anchor: from, head: from + newContent.length },
            scrollIntoView: true
        });
    }
    view.focus();
  }, [editorRef]);

  const insertTaskList = useCallback((prefix, defaultText = '') => {
    insertListItem(prefix, defaultText);
  }, [insertListItem]);

  return {
    insertText,
    insertListItem,
    insertNumberedList,
    insertTaskList
  };
}
