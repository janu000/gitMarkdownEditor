import { memo, useEffect, useState } from 'react';
import { Bold, Code, Italic, Link, Sigma, SquareCode, Strikethrough, Palette } from 'lucide-react';
import ToolButton from './ToolButton';
import { formatShortcut } from '../utils/shortcutManager';

const FLOATING_TOOLBAR_WIDTH = 296;

const FloatingFormattingToolbar = memo(({
  enabled,
  insertText,
  insertDrawing,
  toggleCode,
  insertCodeBlock,
  toggleMath,
  activeFormats,
  shortcuts,
}) => {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const updatePosition = () => {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const editor = document.querySelector('.rich-markdown-editor .ProseMirror');

      if (!range || range.collapsed || !editor || !editor.contains(range.commonAncestorContainer)) {
        setPosition(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) {
        setPosition(null);
        return;
      }

      setPosition({
        left: Math.min(Math.max(rect.left + rect.width / 2, FLOATING_TOOLBAR_WIDTH / 2 + 8), window.innerWidth - FLOATING_TOOLBAR_WIDTH / 2 - 8),
        top: Math.max(8, rect.top - 42),
      });
    };

    document.addEventListener('selectionchange', updatePosition);
    document.addEventListener('mouseup', updatePosition);
    document.addEventListener('keyup', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    updatePosition();

    return () => {
      document.removeEventListener('selectionchange', updatePosition);
      document.removeEventListener('mouseup', updatePosition);
      document.removeEventListener('keyup', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [enabled]);

  if (!enabled || !position) return null;

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 border border-gray-200 bg-white p-1 rounded-md shadow-xl dark:border-gray-800 dark:bg-[#161b22]"
      style={{ left: position.left, top: position.top, transform: 'translateX(-50%)' }}
    >
      <ToolButton active={activeFormats?.bold} icon={<Bold className="w-4 h-4" />} onClick={() => insertText('**', '**', 'bold text')} title={`Bold (${formatShortcut(shortcuts.bold)})`} />
      <ToolButton active={activeFormats?.italic} icon={<Italic className="w-4 h-4" />} onClick={() => insertText('*', '*', 'italic text')} title={`Italic (${formatShortcut(shortcuts.italic)})`} />
      <ToolButton active={activeFormats?.strikethrough} icon={<Strikethrough className="w-4 h-4" />} onClick={() => insertText('~~', '~~', 'strikethrough text')} title={`Strikethrough (${formatShortcut(shortcuts.strikethrough)})`} />
      <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5" />
      <ToolButton active={activeFormats?.link} icon={<Link className="w-4 h-4" />} onClick={() => insertText('[', '](url)', 'link text')} title={`Link (${formatShortcut(shortcuts.link)})`} />
      <ToolButton icon={<Palette className="w-4 h-4" />} onClick={insertDrawing} title="Insert Excalidraw Drawing" />
      <ToolButton active={activeFormats?.math} icon={<Sigma className="w-4 h-4" />} onClick={toggleMath} title={`Math (${formatShortcut(shortcuts.math_block)})`} />
      <ToolButton active={activeFormats?.code} icon={<Code className="w-4 h-4" />} onClick={toggleCode} title={`Code (${formatShortcut(shortcuts.code_block)})`} />
      <ToolButton icon={<SquareCode className="w-4 h-4" />} onClick={insertCodeBlock} title="Code Block (Text)" />
    </div>
  );
});

FloatingFormattingToolbar.displayName = 'FloatingFormattingToolbar';

export default FloatingFormattingToolbar;