export const inlineParse = (text) => {
  if (!text) return '';
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[10px] text-pink-600 dark:text-pink-400 font-mono">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  
  return html;
};

export const fallbackParse = (md) => {
  if (!md) return '';
  let html = md.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Using RegExp constructor to avoid the markdown fence sequence (three backticks) in the source code
  html = html.replace(new RegExp('```([\\s\\S]*?)```', 'g'), '<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto my-4 text-sm font-mono text-gray-900 dark:text-gray-200"><code>$1</code></pre>');
  
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm text-pink-600 dark:text-pink-400 font-mono">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-white">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">$2</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-4xl font-extrabold mt-6 mb-6 text-gray-900 dark:text-white">$1</h1>');
  html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-500 pl-4 py-1 my-4 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-r">$1</blockquote>');
  html = html.replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-4 shadow-md" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 underline underline-offset-2" target="_blank">$1</a>');
  html = html.replace(/^\s*-\s(.*$)/gim, '<li class="ml-4 list-disc mb-1">$1</li>');
  html = html.replace(/<\/li>\n<li/g, '</li><li'); 
  return `<div class="space-y-4 text-gray-800 dark:text-gray-300 leading-relaxed">${html.split('\n\n').map(p => {
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<blockquote') || p.startsWith('<li')) return p;
    return `<p>${p}</p>`;
  }).join('')}</div>`;
};
