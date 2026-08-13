import React, { memo } from 'react';
import { 
  Bold, Italic, Heading1, Heading2, List, ListOrdered, CheckSquare, 
  Quote, Link as LinkIcon, Image as ImageIcon, Table, Code, Sigma, 
  Strikethrough, Smile, Redo2, SquareCode, Undo2
} from 'lucide-react';
import ToolButton from './ToolButton';
import { emojiCategories } from '../utils/emojis';
import { formatShortcut } from '../utils/shortcutManager';

const FormattingToolbar = memo(({ 
  viewMode, 
  insertText, 
  insertListItem, 
  insertNumberedList, 
  insertTaskList,
  insertTable,
  undo,
  redo,
  toggleCode,
  insertCodeBlock,
  toggleMath,
  activeFormats,
  showEmojiPicker,
  setShowEmojiPicker,
  emojiPickerRef,
  shortcuts
}) => {
  if (viewMode === 'preview') return null;

  return (
    <div id="formatting-toolbar" className="h-[var(--bottom-bar-height)] bg-gray-50 dark:bg-[#0d1117] flex items-center flex-wrap px-4 py-0.5 space-x-1 shrink-0">
      <ToolButton icon={<Undo2 className="w-5 h-5" />} onClick={undo} title="Undo" />
      <ToolButton icon={<Redo2 className="w-5 h-5" />} onClick={redo} title="Redo" />
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
      <ToolButton active={activeFormats?.bold} icon={<Bold className="w-5 h-5" />} onClick={() => insertText('**', '**', 'bold text')} title={`Bold (${formatShortcut(shortcuts.bold)})`} />
      <ToolButton active={activeFormats?.italic} icon={<Italic className="w-5 h-5" />} onClick={() => insertText('*', '*', 'italic text')} title={`Italic (${formatShortcut(shortcuts.italic)})`} />
      <ToolButton active={activeFormats?.strikethrough} icon={<Strikethrough className="w-5 h-5" />} onClick={() => insertText('~~', '~~', 'strikethrough text')} title={`Strikethrough (${formatShortcut(shortcuts.strikethrough)})`} />
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
      <ToolButton active={activeFormats?.heading1} icon={<Heading1 className="w-5 h-5" />} onClick={() => insertText('# ', '', 'Heading 1')} title="Heading 1" />
      <ToolButton active={activeFormats?.heading2} icon={<Heading2 className="w-5 h-5" />} onClick={() => insertText('## ', '', 'Heading 2')} title="Heading 2" />
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
      <ToolButton icon={<List className="w-5 h-5" />} onClick={() => insertListItem('- ', 'List item')} title={`Bullet List (${formatShortcut(shortcuts.unordered_list)})`} />
      <ToolButton icon={<ListOrdered className="w-5 h-5" />} onClick={() => insertNumberedList(1, 'Numbered item')} title={`Numbered List (${formatShortcut(shortcuts.numbered_list)})`} />
      <ToolButton icon={<CheckSquare className="w-5 h-5" />} onClick={() => insertTaskList('- [ ] ', 'Task')} title={`Task List (${formatShortcut(shortcuts.task_list)})`} />
      <ToolButton icon={<Quote className="w-5 h-5" />} onClick={() => insertText('> ', '', 'Quote')} title={`Blockquote (${formatShortcut(shortcuts.quote)})`} />
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
      <ToolButton active={activeFormats?.link} icon={<LinkIcon className="w-5 h-5" />} onClick={() => insertText('[', '](url)', 'link text')} title={`Link (${formatShortcut(shortcuts.link)})`} />
      <ToolButton icon={<ImageIcon className="w-5 h-5" />} onClick={() => insertText('![alt text](', ')', 'image url')} title={`Image (${formatShortcut(shortcuts.image)})`} />
      <ToolButton icon={<Table className="w-5 h-5" />} onClick={insertTable} title={`Table (${formatShortcut(shortcuts.table)})`} />
      <ToolButton active={activeFormats?.code} icon={<Code className="w-5 h-5" />} onClick={() => toggleCode()} title={`Code (${formatShortcut(shortcuts.code_block)})`} />
      <ToolButton icon={<SquareCode className="w-5 h-5" />} onClick={insertCodeBlock} title="Code Block (Text)" />
      <ToolButton active={activeFormats?.math} icon={<Sigma className="w-5 h-5" />} onClick={() => toggleMath()} title={`Math (${formatShortcut(shortcuts.math_block)})`} />
      
      <div className="relative inline-block">
        <ToolButton icon={<Smile className="w-5 h-5" />} onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji" />
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute top-full mt-2 right-0 z-50 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 p-3 rounded-lg shadow-xl w-64 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {emojiCategories.map(category => (
                <div key={category.name} className="mb-3 last:mb-0">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 px-1">{category.name}</h4>
                  <div className="grid grid-cols-6 gap-1">
                    {category.emojis.map(e => (
                      <button 
                        key={e.short} 
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => { insertText(e.char); setShowEmojiPicker(false); }} 
                        className="hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 rounded transition-colors text-lg flex items-center justify-center" 
                        title={e.short}
                      >
                        {e.char}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

FormattingToolbar.displayName = 'FormattingToolbar';

export default FormattingToolbar;
