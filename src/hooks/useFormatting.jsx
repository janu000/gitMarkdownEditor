import { useCallback } from 'react';
import { EditorView } from 'codemirror';

export default function useFormatting(editorRef) {
  const insertText = useCallback((before, after = '', defaultText = '') => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.doc.sliceString(from, to);
    
    // Check if the selected text is already wrapped
    const isWrappedInternally = after 
        ? (selectedText.startsWith(before) && selectedText.endsWith(after) && selectedText.length >= (before.length + after.length))
        : selectedText.startsWith(before);

    if (isWrappedInternally) {
        // Toggle off: remove wrapping from within selection
        const newText = after 
            ? selectedText.slice(before.length, selectedText.length - after.length)
            : selectedText.slice(before.length);
        view.dispatch({
            changes: { from, to, insert: newText },
            selection: { anchor: from, head: from + newText.length },
            scrollIntoView: true
        });
    } else {
        // Check if the selection is surrounded by the wrapping
        const beforeRange = state.doc.sliceString(Math.max(0, from - before.length), from);
        const afterRange = after ? state.doc.sliceString(to, Math.min(state.doc.length, to + after.length)) : '';
        
        if (beforeRange === before && (after ? afterRange === after : true)) {
            // Toggle off: remove wrapping around selection
            view.dispatch({
                changes: { from: from - before.length, to: to + (after ? after.length : 0), insert: selectedText },
                selection: { anchor: from - before.length, head: from - before.length + selectedText.length },
                scrollIntoView: true
            });
        } else {
            // Toggle on: add wrapping
            const textToInsert = selectedText || defaultText;
            view.dispatch({
                changes: { from, to, insert: before + textToInsert + after },
                selection: { anchor: from + before.length, head: from + before.length + textToInsert.length },
                scrollIntoView: true
            });
        }
    }
    view.focus();
  }, [editorRef]);

  const insertListItem = useCallback((prefix, defaultText = '') => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    
    // Handle single line or empty selection
    if (state.doc.lineAt(from).number === state.doc.lineAt(to).number) {
        const line = state.doc.lineAt(from);
        const lineText = line.text;
        
        if (lineText.startsWith(prefix)) {
            // Toggle off
            view.dispatch({
                changes: { from: line.from, to: line.from + prefix.length, insert: '' },
                selection: { anchor: Math.max(line.from, from - prefix.length), head: Math.max(line.from, to - prefix.length) },
                scrollIntoView: true
            });
        } else {
            // Toggle on
            const hasSelection = from !== to;
            const isEmptyLine = lineText.length === 0;
            const insert = (!hasSelection && isEmptyLine) ? prefix + defaultText : prefix;
            
            view.dispatch({
                changes: { from: line.from, to: line.from, insert },
                selection: (!hasSelection && isEmptyLine) 
                    ? { anchor: line.from + prefix.length, head: line.from + prefix.length + defaultText.length }
                    : { anchor: from + prefix.length, head: to + prefix.length },
                scrollIntoView: true
            });
        }
    } else {
        // Multi-line selection
        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);
        const lines = [];
        for (let i = startLine.number; i <= endLine.number; i++) {
            lines.push(state.doc.line(i));
        }

        const allHavePrefix = lines.every(l => l.text.startsWith(prefix) || l.text.trim().length === 0);

        const changes = lines.map(l => {
            if (allHavePrefix) {
                if (l.text.startsWith(prefix)) {
                    return { from: l.from, to: l.from + prefix.length, insert: '' };
                }
            } else {
                if (l.text.trim().length > 0 && !l.text.startsWith(prefix)) {
                    return { from: l.from, to: l.from, insert: prefix };
                }
            }
            return null;
        }).filter(Boolean);

        if (changes.length > 0) {
            view.dispatch({
                changes,
                scrollIntoView: true
            });
        }
    }
    view.focus();
  }, [editorRef]);

  const insertNumberedList = useCallback((startNumber = 1, defaultText = 'Numbered item') => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const numRegex = /^\d+\.\s/;

    if (state.doc.lineAt(from).number === state.doc.lineAt(to).number) {
        const line = state.doc.lineAt(from);
        const match = line.text.match(numRegex);
        
        if (match) {
            // Toggle off
            view.dispatch({
                changes: { from: line.from, to: line.from + match[0].length, insert: '' },
                selection: { anchor: Math.max(line.from, from - match[0].length), head: Math.max(line.from, to - match[0].length) },
                scrollIntoView: true
            });
        } else {
            // Toggle on
            const prefix = `${startNumber}. `;
            const hasSelection = from !== to;
            const isEmptyLine = line.text.length === 0;
            const insert = (!hasSelection && isEmptyLine) ? prefix + defaultText : prefix;
            
            view.dispatch({
                changes: { from: line.from, to: line.from, insert },
                selection: (!hasSelection && isEmptyLine)
                    ? { anchor: line.from + prefix.length, head: line.from + prefix.length + defaultText.length }
                    : { anchor: from + prefix.length, head: to + prefix.length },
                scrollIntoView: true
            });
        }
    } else {
        // Multi-line selection
        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);
        const lines = [];
        for (let i = startLine.number; i <= endLine.number; i++) {
            lines.push(state.doc.line(i));
        }

        const allHavePrefix = lines.every(l => numRegex.test(l.text) || l.text.trim().length === 0);

        let currentNum = startNumber;
        const changes = lines.map(l => {
            if (allHavePrefix) {
                const match = l.text.match(numRegex);
                if (match) {
                    return { from: l.from, to: l.from + match[0].length, insert: '' };
                }
            } else {
                if (l.text.trim().length > 0 && !numRegex.test(l.text)) {
                    const prefix = `${currentNum++}. `;
                    return { from: l.from, to: l.from, insert: prefix };
                }
            }
            return null;
        }).filter(Boolean);

        if (changes.length > 0) {
            view.dispatch({
                changes,
                scrollIntoView: true
            });
        }
    }
    view.focus();
  }, [editorRef]);

  const insertTaskList = useCallback((prefix, defaultText = '') => {
    insertListItem(prefix, defaultText);
  }, [insertListItem]);

  const toggleCode = useCallback((defaultText = 'code') => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.doc.sliceString(from, to);
    
    // 1. Check if we are currently in a BLOCK
    const isBlockWrapped = selectedText.startsWith('```\n') && selectedText.endsWith('\n```');
    const isBlockSurrounded = state.doc.sliceString(from - 4, from) === '```\n' && state.doc.sliceString(to, to + 4) === '\n```';

    if (isBlockWrapped || isBlockSurrounded) {
        // Toggle OFF: Block -> None
        const start = isBlockWrapped ? from : from - 4;
        const end = isBlockWrapped ? to : to + 4;
        const content = isBlockWrapped ? selectedText.slice(4, -4) : selectedText;
        
        view.dispatch({
            changes: { from: start, to: end, insert: content },
            selection: { anchor: start, head: start + content.length },
            scrollIntoView: true
        });
        view.focus();
        return;
    }

    // 2. Check if we are currently INLINE
    const isInlineWrapped = selectedText.startsWith('`') && selectedText.endsWith('`') && selectedText.length >= 2;
    const isInlineSurrounded = state.doc.sliceString(from - 1, from) === '`' && state.doc.sliceString(to, to + 1) === '`';

    if (isInlineWrapped || isInlineSurrounded) {
        // Toggle to BLOCK: Inline -> Block
        const start = isInlineWrapped ? from : from - 1;
        const end = isInlineWrapped ? to : to + 1;
        const content = (isInlineWrapped ? selectedText.slice(1, -1) : selectedText) || defaultText;
        const blockText = '```\n' + content + '\n```';
        
        view.dispatch({
            changes: { from: start, to: end, insert: blockText },
            selection: { anchor: start + 4, head: start + 4 + content.length },
            scrollIntoView: true
        });
        view.focus();
        return;
    }

    // 3. Toggle to INLINE: None -> Inline
    const content = selectedText || defaultText;
    const inlineText = '`' + content + '`';
    view.dispatch({
        changes: { from, to, insert: inlineText },
        selection: { anchor: from + 1, head: from + 1 + content.length },
        scrollIntoView: true
    });
    view.focus();
  }, [editorRef]);

  const toggleMath = useCallback((defaultText = 'E = mc^2') => {
    const view = editorRef.current;
    if (!view || !(view instanceof EditorView)) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const selectedText = state.doc.sliceString(from, to);
    
    // 1. Check if we are currently in a BLOCK
    const isBlockWrapped = selectedText.startsWith('$$\n') && selectedText.endsWith('\n$$');
    const isBlockSurrounded = state.doc.sliceString(from - 3, from) === '$$\n' && state.doc.sliceString(to, to + 3) === '\n$$';

    if (isBlockWrapped || isBlockSurrounded) {
        // Toggle OFF: Block -> None
        const start = isBlockWrapped ? from : from - 3;
        const end = isBlockWrapped ? to : to + 3;
        const content = isBlockWrapped ? selectedText.slice(3, -3) : selectedText;
        
        view.dispatch({
            changes: { from: start, to: end, insert: content },
            selection: { anchor: start, head: start + content.length },
            scrollIntoView: true
        });
        view.focus();
        return;
    }

    // 2. Check if we are currently INLINE
    const isInlineWrapped = selectedText.startsWith('$') && selectedText.endsWith('$') && selectedText.length >= 2;
    const isInlineSurrounded = state.doc.sliceString(from - 1, from) === '$' && state.doc.sliceString(to, to + 1) === '$';

    if (isInlineWrapped || isInlineSurrounded) {
        // Toggle to BLOCK: Inline -> Block
        const start = isInlineWrapped ? from : from - 1;
        const end = isInlineWrapped ? to : to + 1;
        const content = (isInlineWrapped ? selectedText.slice(1, -1) : selectedText) || defaultText;
        const blockText = '$$\n' + content + '\n$$';
        
        view.dispatch({
            changes: { from: start, to: end, insert: blockText },
            selection: { anchor: start + 3, head: start + 3 + content.length },
            scrollIntoView: true
        });
        view.focus();
        return;
    }

    // 3. Toggle to INLINE: None -> Inline
    const content = selectedText || defaultText;
    const inlineText = '$' + content + '$';
    view.dispatch({
        changes: { from, to, insert: inlineText },
        selection: { anchor: from + 1, head: from + 1 + content.length },
        scrollIntoView: true
    });
    view.focus();
  }, [editorRef]);

  return {
    insertText,
    insertListItem,
    insertNumberedList,
    insertTaskList,
    toggleCode,
    toggleMath
  };
}
