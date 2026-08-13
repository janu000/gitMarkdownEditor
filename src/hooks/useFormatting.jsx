import { useCallback } from 'react';
import { redo, undo } from '@codemirror/commands';
import { EditorView } from 'codemirror';

// Helper to detect any list prefix at the start of a string
// Group 1: Indentation, Group 2: The actual marker (for numbered lists)
const LIST_PREFIX_REGEX = /^(\s*)(?:([-*+]\s+\[[ xX]\]\s+)|([-*+]\s+)|(\d+)\.\s+)/;
const NUMBERED_MARKER_REGEX = /^(\s*)(\d+)\.\s+/;

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
        const match = lineText.match(LIST_PREFIX_REGEX);
        
        if (match) {
            const existingFullPrefix = match[0];
            const indentation = match[1];
            
            // If it's the SAME prefix (ignoring indentation for the comparison is tricky, 
            // but usually prefix includes indentation in our calls)
            // Let's check if the line starts with exact prefix
            if (lineText.startsWith(prefix)) {
                view.dispatch({
                    changes: { from: line.from, to: line.from + prefix.length, insert: '' },
                    selection: { 
                        anchor: Math.max(line.from, from - prefix.length), 
                        head: Math.max(line.from, to - prefix.length) 
                    },
                    scrollIntoView: true
                });
            } else {
                // It's a DIFFERENT list prefix, SWAP it while preserving indentation
                const newPrefix = indentation + prefix;
                view.dispatch({
                    changes: { from: line.from, to: line.from + existingFullPrefix.length, insert: newPrefix },
                    selection: { 
                        anchor: from + (newPrefix.length - existingFullPrefix.length), 
                        head: to + (newPrefix.length - existingFullPrefix.length) 
                    },
                    scrollIntoView: true
                });
            }
        } else {
            // No prefix at all, toggle it ON
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

        const allHaveSamePrefix = lines.every(l => l.text.startsWith(prefix) || l.text.trim().length === 0);

        const changes = lines.map(l => {
            if (l.text.trim().length === 0) return null;
            
            const match = l.text.match(LIST_PREFIX_REGEX);
            if (allHaveSamePrefix) {
                if (l.text.startsWith(prefix)) {
                    return { from: l.from, to: l.from + prefix.length, insert: '' };
                }
            } else {
                if (match) {
                    const existingFullPrefix = match[0];
                    const indentation = match[1];
                    const newPrefix = indentation + prefix;
                    if (existingFullPrefix !== newPrefix) {
                        return { from: l.from, to: l.from + existingFullPrefix.length, insert: newPrefix };
                    }
                } else {
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

    // Helper to find what the number should be based on the previous line
    const getContextualInfo = (lineNum) => {
        if (lineNum <= 1) return { num: startNumber, indent: "" };
        const prevLine = state.doc.line(lineNum - 1);
        const match = prevLine.text.match(NUMBERED_MARKER_REGEX);
        if (match) {
            return { num: parseInt(match[2], 10) + 1, indent: match[1] };
        }
        // If not numbered, maybe preserve indentation of the previous line anyway?
        const indentMatch = prevLine.text.match(/^(\s*)/);
        return { num: startNumber, indent: indentMatch ? indentMatch[1] : "" };
    };

    if (state.doc.lineAt(from).number === state.doc.lineAt(to).number) {
        const line = state.doc.lineAt(from);
        const match = line.text.match(LIST_PREFIX_REGEX);
        const info = getContextualInfo(line.number);
        
        if (match) {
            const existingFullPrefix = match[0];
            const isAlreadyNumbered = NUMBERED_MARKER_REGEX.test(existingFullPrefix);
            
            if (isAlreadyNumbered) {
                // Toggle OFF
                view.dispatch({
                    changes: { from: line.from, to: line.from + existingFullPrefix.length, insert: '' },
                    selection: { 
                        anchor: Math.max(line.from, from - existingFullPrefix.length), 
                        head: Math.max(line.from, to - existingFullPrefix.length) 
                    },
                    scrollIntoView: true
                });
            } else {
                // SWAP other list for numbered list
                const indentation = match[1] || info.indent;
                const newPrefix = `${indentation}${info.num}. `;
                view.dispatch({
                    changes: { from: line.from, to: line.from + existingFullPrefix.length, insert: newPrefix },
                    selection: { 
                        anchor: from + (newPrefix.length - existingFullPrefix.length), 
                        head: to + (newPrefix.length - existingFullPrefix.length) 
                    },
                    scrollIntoView: true
                });
            }
        } else {
            // Toggle ON
            const indentation = line.text.match(/^(\s*)/)[0] || info.indent;
            const newPrefix = `${indentation}${info.num}. `;
            const hasSelection = from !== to;
            const isEmptyLine = line.text.trim().length === 0;
            const insert = (!hasSelection && isEmptyLine) ? newPrefix + defaultText : newPrefix;
            
            // If the line was just indentation, we replace it to avoid double indent
            const fromPos = isEmptyLine ? line.from : line.from;
            const toPos = isEmptyLine ? line.from + line.text.length : line.from;

            view.dispatch({
                changes: { from: fromPos, to: toPos, insert },
                selection: (!hasSelection && isEmptyLine)
                    ? { anchor: line.from + newPrefix.length, head: line.from + newPrefix.length + defaultText.length }
                    : { anchor: from + (newPrefix.length - (toPos - fromPos)), head: to + (newPrefix.length - (toPos - fromPos)) },
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

        const allHaveNumberedPrefix = lines.every(l => NUMBERED_MARKER_REGEX.test(l.text) || l.text.trim().length === 0);

        const info = getContextualInfo(startLine.number);
        let currentNum = info.num;

        const changes = lines.map(l => {
            if (l.text.trim().length === 0) return null;
            
            const match = l.text.match(LIST_PREFIX_REGEX);
            if (allHaveNumberedPrefix) {
                // Toggle OFF
                const m = l.text.match(NUMBERED_MARKER_REGEX);
                if (m) {
                    return { from: l.from, to: l.from + m[0].length, insert: '' };
                }
            } else {
                // Toggle ON or SWAP
                const indentation = match ? match[1] : (l.text.match(/^(\s*)/)[0] || info.indent);
                const newPrefix = `${indentation}${currentNum++}. `;
                
                if (match) {
                    const existingFullPrefix = match[0];
                    return { from: l.from, to: l.from + existingFullPrefix.length, insert: newPrefix };
                } else {
                    return { from: l.from, to: l.from, insert: newPrefix };
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

    const setBlockType = useCallback((level) => {
        const view = editorRef.current;
        if (!view || !(view instanceof EditorView)) return;

        const { state } = view;
        const { from, to } = state.selection.main;
        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);
        const prefix = level === 0 ? '' : `${'#'.repeat(level)} `;
        const changes = [];

        for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber++) {
            const line = state.doc.line(lineNumber);
            const heading = line.text.match(/^#{1,6}\s+/);
            changes.push({
                from: line.from,
                to: line.from + (heading ? heading[0].length : 0),
                insert: prefix,
            });
        }

        view.dispatch({ changes, scrollIntoView: true });
        view.focus();
    }, [editorRef]);

    const undoChange = useCallback(() => {
        const view = editorRef.current;
        if (view instanceof EditorView) undo(view);
    }, [editorRef]);

    const redoChange = useCallback(() => {
        const view = editorRef.current;
        if (view instanceof EditorView) redo(view);
    }, [editorRef]);

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
    setBlockType,
    undoChange,
    redoChange,
    toggleCode,
    toggleMath
  };
}
