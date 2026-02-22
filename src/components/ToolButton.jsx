import React from 'react';

function ToolButton({ icon, onClick, title }) {
  return (
    <button 
      onClick={onClick}
      title={title}
      className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors flex items-center justify-center shrink-0"
    >
      {icon}
    </button>
  );
}

export default ToolButton;
