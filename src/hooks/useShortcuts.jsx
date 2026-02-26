import { useEffect } from 'react';
import { matchesShortcut } from '../utils/shortcutManager';

export default function useShortcuts(shortcuts, actions) {
  const { 
    saveToGitHub, handleExportPdf, 
    insertText, insertListItem, insertNumberedList, insertTaskList,
    toggleCode, toggleMath
  } = actions;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (matchesShortcut(e, shortcuts.save)) { e.preventDefault(); saveToGitHub(); }
      if (matchesShortcut(e, shortcuts.print)) { e.preventDefault(); handleExportPdf(); }
      if (matchesShortcut(e, shortcuts.bold)) { e.preventDefault(); insertText('**', '**', 'bold text'); }
      if (matchesShortcut(e, shortcuts.italic)) { e.preventDefault(); insertText('*', '*', 'italic text'); }
      if (matchesShortcut(e, shortcuts.strikethrough)) { e.preventDefault(); insertText('~~', '~~', 'strikethrough text'); }
      if (matchesShortcut(e, shortcuts.link)) { e.preventDefault(); insertText('[', '](url)', 'link text'); }
      if (matchesShortcut(e, shortcuts.image)) { e.preventDefault(); insertText('![alt text](', ')', 'image url'); }
      if (matchesShortcut(e, shortcuts.unordered_list)) { e.preventDefault(); insertListItem('- ', 'List item'); }
      if (matchesShortcut(e, shortcuts.numbered_list)) { e.preventDefault(); insertNumberedList(1, 'Numbered item'); }
      if (matchesShortcut(e, shortcuts.task_list)) { e.preventDefault(); insertTaskList('- [ ] ', 'Task'); }
      if (matchesShortcut(e, shortcuts.quote)) { e.preventDefault(); insertText('> ', '', 'Quote'); }
      if (matchesShortcut(e, shortcuts.code_block)) { e.preventDefault(); toggleCode(); }
      if (matchesShortcut(e, shortcuts.inline_code)) { e.preventDefault(); toggleCode(); }
      if (matchesShortcut(e, shortcuts.table)) { e.preventDefault(); insertText('\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n', '', ''); }
      if (matchesShortcut(e, shortcuts.math_block)) { e.preventDefault(); toggleMath(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveToGitHub, handleExportPdf, insertText, insertListItem, insertNumberedList, insertTaskList, shortcuts]);
}
