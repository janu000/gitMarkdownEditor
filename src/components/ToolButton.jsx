import React from 'react';

function ToolButton({ active = false, icon, onClick, title }) {
  return (
    <button 
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`p-1.5 rounded transition-colors flex items-center justify-center shrink-0 ${active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800'}`}
    >
      {icon}
    </button>
  );
}

export default ToolButton;
