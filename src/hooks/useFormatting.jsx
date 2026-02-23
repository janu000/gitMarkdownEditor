import { useCallback } from 'react';

export default function useFormatting(editorRef, setContent) {
  const insertText = useCallback((before, after = '', defaultText = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end) || defaultText;
    const newText = textarea.value.substring(0, start) + before + selectedText + after + textarea.value.substring(end);
    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  }, [editorRef, setContent]);

  const insertListItem = useCallback((prefix, defaultText = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    let selectedText = textarea.value.substring(start, end);
    let newContent, newSelectionStart, newSelectionEnd;
    if (selectedText.length === 0) {
        newContent = prefix + defaultText;
        newSelectionStart = start + prefix.length;
        newSelectionEnd = newSelectionStart + defaultText.length;
    } else {
        const lines = selectedText.split('\n');
        const prefixedLines = lines.map(line => {
            if (line.trim().length > 0 && !line.trim().startsWith(prefix.trim())) return prefix + line;
            return line;
        });
        newContent = prefixedLines.join('\n');
        newSelectionStart = start;
        newSelectionEnd = start + newContent.length; 
    }
    const newValue = textarea.value.substring(0, start) + newContent + textarea.value.substring(end);
    setContent(newValue);
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    }, 0);
  }, [editorRef, setContent]);

  const insertNumberedList = useCallback((startNumber = 1, defaultText = 'Numbered item') => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    let selectedText = textarea.value.substring(start, end);
    let newContent, newSelectionStart, newSelectionEnd;
    if (selectedText.length === 0) {
        newContent = `${startNumber}. ${defaultText}`;
        newSelectionStart = start + `${startNumber}. `.length;
        newSelectionEnd = newSelectionStart + defaultText.length;
    } else {
        const lines = selectedText.split('\n');
        let currentNum = startNumber;
        const prefixedLines = lines.map(line => {
            if (line.trim().length > 0 && !/^\d+\.\s/.test(line.trim())) return `${currentNum++}. ${line}`;
            return line;
        });
        newContent = prefixedLines.join('\n');
        newSelectionStart = start;
        newSelectionEnd = start + newContent.length;
    }
    const newValue = textarea.value.substring(0, start) + newContent + textarea.value.substring(end);
    setContent(newValue);
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    }, 0);
  }, [editorRef, setContent]);

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
