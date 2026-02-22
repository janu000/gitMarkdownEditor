import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Github, FileText, Folder, Save, Eye, Edit3, Columns, 
  Bold, Italic, Link as LinkIcon, List, ListOrdered, Image as ImageIcon, 
  Code, Heading1, Heading2, Quote, LogOut, Plus, ChevronRight,
  AlertCircle, CheckCircle2, Loader2, ArrowLeft, EyeOff, Trash2, RefreshCcw,
  CheckSquare, Strikethrough, Table, Sigma, FileEdit, Sun, Moon, FileUp, Download, HardDrive, GripVertical, Printer
} from 'lucide-react';

// ==========================================
// CONCEPTUAL FILE: utils/encoding.js
// ==========================================
const utf8_to_b64 = (str) => window.btoa(unescape(encodeURIComponent(str)));
const b64_to_utf8 = (str) => decodeURIComponent(escape(window.atob(str)));

// ==========================================
// CONCEPTUAL FILE: utils/markdownParser.js
// ==========================================
const fallbackParse = (md) => {
  if (!md) return '';
  let html = md.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Using RegExp constructor to avoid the markdown fence sequence (three backticks) in the source code
  html = html.replace(new RegExp('\`\`\`([\\s\\S]*?)\`\`\`', 'g'), '<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto my-4 text-sm font-mono text-gray-900 dark:text-gray-200"><code>$1</code></pre>');
  
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm text-pink-600 dark:text-pink-400 font-mono">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-white">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">$1</h2>');
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

// ==========================================
// CONCEPTUAL FILE: components/Toast.jsx
// ==========================================
const Toast = ({ type, message }) => (
  <div className={`fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-lg shadow-xl border ${
    type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' : 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
  } transition-all duration-300 animate-in fade-in slide-in-from-top-4`}>
    {type === 'error' ? <AlertCircle className="w-5 h-5 mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
    {message}
  </div>
);

// ==========================================
// CONCEPTUAL FILE: components/ToolButton.jsx
// ==========================================
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

// ==========================================
// CONCEPTUAL FILE: App.jsx (Main Entry)
// ==========================================

import defaultContent from '../README.md?raw';

export default function App() {
  // --- Editor State ---
  const [content, setContent] = useState(() => {
    const savedDraft = localStorage.getItem('markhub_draft');
    if (savedDraft) return savedDraft;
    return defaultContent;
  });
  
  // --- Theme State ---
  const [theme, setTheme] = useState(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
      return localStorage.getItem('theme');
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  // --- Layout State ---
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingSplit, setIsResizingSplit] = useState(false);

  // --- View Mode & HTML Parsing ---
  const [viewMode, setViewMode] = useState('split');
  const [parsedHtml, setParsedHtml] = useState('');
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  
  // --- GitHub State ---
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('gh_token') || '');
  const [ghUser, setGhUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [currentRepo, setCurrentRepo] = useState(null);
  const currentRepoRef = useRef(null);
  const [repoContents, setRepoContents] = useState([]);
  const [pathStack, setPathStack] = useState([]); 
  const [activeFile, setActiveFile] = useState(null); 
  const activeFileRef = useRef(null);
  const [manualRepo, setManualRepo] = useState('');
  const [hiddenRepos, setHiddenRepos] = useState(() => JSON.parse(localStorage.getItem('markhub_hidden_repos') || '[]'));
  
  // --- Local File Workspace State ---
  const [, setLocalFileHandle] = useState(null);
  const [localFileName, setLocalFileName] = useState('');
  const [localWorkspaceFiles, setLocalWorkspaceFiles] = useState(() => JSON.parse(localStorage.getItem('markhub_local_workspace') || '[]'));
  const [pendingOps, setPendingOps] = useState({}); 

  // --- UI State ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadingState, setLoadingState] = useState('');
  const [toast, setToast] = useState(null);

  // Sync refs for async callbacks
  useEffect(() => { currentRepoRef.current = currentRepo; }, [currentRepo]);
  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { localStorage.setItem('markhub_local_workspace', JSON.stringify(localWorkspaceFiles)); }, [localWorkspaceFiles]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // --- Theme Application ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- Resizing Handlers ---
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(150, Math.min(e.clientX, 600));
        setSidebarWidth(newWidth);
      }
      if (isResizingSplit) {
        const mainArea = editorRef.current?.parentElement?.parentElement;
        if (mainArea) {
          const rect = mainArea.getBoundingClientRect();
          const relativeX = e.clientX - rect.left;
          const newRatio = Math.max(0.2, Math.min(relativeX / rect.width, 0.8));
          setSplitRatio(newRatio);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingSplit(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizingSidebar || isResizingSplit) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingSplit]);

  // --- Load External Markdown Parser & KaTeX ---
  useEffect(() => {
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
      document.head.appendChild(link);
    }

    const loadScript = (src) => new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      document.head.appendChild(script);
    });

    const initParser = async () => {
      await loadScript("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js");
      
      if (window.marked && window.katex) {
        const blockMath = {
          name: 'blockMath', level: 'block',
          start(src) { return src.indexOf('$$'); },
          tokenizer(src) {
            const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
            if (match) return { type: 'blockMath', raw: match[0], text: match[1] };
          },
          renderer(token) {
            return `<div class="katex-display-wrapper py-2">${window.katex.renderToString(token.text, { throwOnError: false, displayMode: true })}</div>`;
          }
        };

        const inlineMath = {
          name: 'inlineMath', level: 'inline',
          start(src) { return src.indexOf('$'); },
          tokenizer(src) {
            const match = /^\$([^\s$][^$\n]*?[^\s$]|[^\s$])\$/.exec(src);
            if (match) return { type: 'inlineMath', raw: match[0], text: match[1] };
          },
          renderer(token) {
            return window.katex.renderToString(token.text, { throwOnError: false, displayMode: false });
          }
        };

        window.marked.use({ extensions: [blockMath, inlineMath] });
        window.marked.setOptions({ gfm: true, breaks: true });
        
        // Trigger initial parse update once loaded
        setContent(c => { updatePreview(c); return c; });
      }
    };

    initParser();
  }, []);

  // --- Autosave & Parsing Updates ---
  const updatePreview = useCallback((md) => {
    if (window.marked && window.katex) {
      setParsedHtml(window.marked.parse(md));
    } else {
      setParsedHtml(fallbackParse(md));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('markhub_draft', content);
    updatePreview(content);
  }, [content, updatePreview]);

  // --- Toolbar Insertion Utilities ---
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
  }, []);

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
  }, []);

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

    setContent(textarea.value.substring(0, start) + newContent + textarea.value.substring(end));

    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    }, 0);
  }, []);

  const insertTaskList = useCallback((prefix, defaultText = '') => {
    insertListItem(prefix, defaultText);
  }, [insertListItem]);

  // --- GitHub API Interactions ---
  const apiRequest = useCallback(async (endpoint, method = 'GET', body = null, customToken = null) => {
    const tokenToUse = customToken || ghToken;
    let url = `https://api.github.com${endpoint}`;
    if (method === 'GET') {
      url += `${url.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${tokenToUse}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: body ? JSON.stringify(body) : null
    });
    if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
    return response.json();
  }, [ghToken]);

  const fetchRepos = useCallback(async (tokenOverride = null) => {
    setLoadingState('fetching');
    try {
      const data = await apiRequest('/user/repos?affiliation=owner,collaborator&sort=updated&per_page=100', 'GET', null, tokenOverride);
      setRepos(Array.isArray(data) ? data.filter(repo => repo?.permissions?.push === true) : []);
    } catch (_error) {
      showToast('Failed to fetch repositories', 'error');
    }
    setLoadingState('');
  }, [apiRequest, showToast, setRepos]);

  const verifyGitHubToken = useCallback(async (token, silent = false) => {
    setLoadingState('verifying');
    try {
      const user = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${token}` }
      }).then(res => {
        if (!res.ok) throw new Error('Invalid Token');
        return res.json();
      });
      setGhToken(token);
      localStorage.setItem('gh_token', token);
      setGhUser(user);
      setShowAuthModal(false);
      fetchRepos(token);
      if (!silent) showToast('Connected to GitHub');
    } catch (_error) {
      localStorage.removeItem('gh_token');
      setGhToken('');
      if (!silent) showToast('Invalid GitHub Token', 'error');
    }
    setLoadingState('');
  }, [fetchRepos, setGhToken, setGhUser, setShowAuthModal, showToast]);

  useEffect(() => {
    const savedToken = localStorage.getItem('gh_token');
    if (savedToken) {
      verifyGitHubToken(savedToken, true);
    }
  }, [verifyGitHubToken]);

  const fetchRepoContents = async (repoFullName, path = '') => {
    setLoadingState('fetching');
    try {
      const data = await apiRequest(`/repos/${repoFullName}/contents/${path}`);
      setRepoContents(Array.isArray(data) ? data.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      }) : [data]);
      setCurrentRepo(repoFullName);
      if (path === '') setPathStack([]);
    } catch (_error) {
      showToast('Failed to fetch folder contents', 'error');
    }
    setLoadingState('');
  };

  const getWorkspaceFiles = () => {
    if (currentRepo) {
      let files = repoContents.filter(f => !pendingOps[f.path] || pendingOps[f.path].action !== 'delete');
      const pendingAdds = Object.values(pendingOps).filter(op => op.action === 'add' && op.file).map(op => ({ ...op.file, status: 'pending' }));
      files = [...files, ...pendingAdds];
      return files.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });
    } else {
      return localWorkspaceFiles.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });
    }
  };

  // --- File Operation Actions ---
  const saveToGitHub = useCallback(async () => {
    const currentActiveFile = activeFileRef.current;
    const repoContext = currentRepoRef.current; 

    if (!currentActiveFile) return;
    
    if (!repoContext) {
      const updated = localWorkspaceFiles.map(f => f.path === currentActiveFile.path ? { ...f, content: content } : f);
      setLocalWorkspaceFiles(updated);
      showToast('Saved locally');
      return;
    }

    setLoadingState('saving');
    try {
      const body = {
        message: `Update ${currentActiveFile.name} via Git Markdown Editor`,
        content: utf8_to_b64(content),
        sha: currentActiveFile.sha
      };
      const data = await apiRequest(`/repos/${repoContext}/contents/${currentActiveFile.path}`, 'PUT', body);
      setActiveFile({ ...currentActiveFile, sha: data.content.sha });
      showToast('Successfully committed to GitHub!');
    } catch (_error) {
      showToast('Failed to save to GitHub', 'error');
    }
    setLoadingState('');
  }, [content, localWorkspaceFiles, showToast, apiRequest]);

  const loadFile = async (file) => {
    if (file.type === 'dir') {
      setPathStack([...pathStack, file]);
      if (currentRepo) fetchRepoContents(currentRepo, file.path);
      return;
    }
    
    if (!file.name.match(/\.(md|txt|mdx)$/i)) {
      showToast('Only Markdown/Text files are supported', 'error');
      return;
    }

    if (!currentRepo) {
      setContent(file.content || '');
      setActiveFile(file);
      setLocalFileName('');
      return;
    }

    const pendingOp = pendingOps[file.path];
    if (pendingOp && pendingOp.action === 'add') {
      if (pendingOp.content !== undefined) {
        setContent(pendingOp.content);
              setActiveFile(file);
              setLocalFileName('');        return;
      } else {
        showToast('File is syncing, please wait...', 'info');
        return;
      }
    }

    setLoadingState('fetching');
    try {
      const data = await apiRequest(`/repos/${currentRepo}/contents/${file.path}`);
      const decodedContent = b64_to_utf8(data.content);
      setContent(decodedContent);
      setActiveFile({ path: file.path, sha: data.sha, name: file.name });
      setLocalFileHandle(null); 
      setLocalFileName('');     
      showToast(`Loaded ${file.name}`);
    } catch (_error) {
      showToast('Failed to load file', 'error');
    }
    setLoadingState('');
  };

  const renameFile = async (fileToRename) => {
    const newName = prompt(`Rename ${fileToRename.name} to:`, fileToRename.name);
    if (!newName || newName === fileToRename.name) return;

    const currentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
    const newPath = currentPath ? `${currentPath}/${newName}` : newName;

    if (!currentRepo) {
      const existingFile = localWorkspaceFiles.find(f => f.path !== fileToRename.path && f.name === newName);
      if (existingFile) {
        showToast(`File with name '${newName}' already exists.`, 'error');
        return;
      }
      setLocalWorkspaceFiles(localWorkspaceFiles.map(f => 
        f.path === fileToRename.path ? { ...f, name: newName, path: newPath } : f
      ));
      if (activeFile?.path === fileToRename.path) {
        setActiveFile({ ...activeFile, name: newName, path: newPath });
      }
      showToast(`Renamed to ${newName}`);
      return;
    }

    // Git Mode Rename Optimistic
    const newFile = { ...fileToRename, name: newName, path: newPath };
    setPendingOps(prev => ({
      ...prev,
      [fileToRename.path]: { action: 'delete' },
      [newPath]: { action: 'add', file: newFile }
    }));
    if (activeFile?.path === fileToRename.path) setActiveFile(newFile);
    showToast(`Renaming to ${newName}...`);

    (async () => {
      try {
        const sourceData = await apiRequest(`/repos/${currentRepo}/contents/${fileToRename.path}`);
        const createBody = {
          message: `Rename ${fileToRename.name} to ${newName} via Git Markdown Editor`,
          content: sourceData.content.replace(/\n/g, ''), 
        };
        const createRes = await apiRequest(`/repos/${currentRepo}/contents/${newPath}`, 'PUT', createBody);

        const deleteBody = { message: `Rename ${fileToRename.name} to ${newName} (cleanup)`, sha: sourceData.sha };
        await apiRequest(`/repos/${currentRepo}/contents/${fileToRename.path}`, 'DELETE', deleteBody);

        setRepoContents(prev => {
          const filtered = prev.filter(f => f.path !== fileToRename.path);
          return [...filtered, { name: newName, path: newPath, type: 'file', sha: createRes.content.sha }].sort((a, b) => {
             if (a.type === b.type) return a.name.localeCompare(b.name);
             return a.type === 'dir' ? -1 : 1;
          });
        });
        
        setPendingOps(prev => {
          const newState = { ...prev };
          delete newState[fileToRename.path];
          delete newState[newPath];
          return newState;
        });
        showToast(`Renamed ${newName}`);
        
        const currentDirPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
        fetchRepoContents(currentRepo, currentDirPath);
        if (activeFile && activeFile.path === newPath) setActiveFile({ ...activeFile, sha: createRes.content.sha });
      } catch (_error) {
        showToast(`Failed to rename: ${_error.message || 'Unknown error'}`, 'error');
        setPendingOps(prev => {
          const newState = { ...prev };
          delete newState[fileToRename.path];
          delete newState[newPath];
          return newState;
        });
        if (activeFile?.path === newPath) setActiveFile(fileToRename);
      }
    })();
  };

  const deleteFile = async (fileToDelete) => {
    if (!window.confirm(`Delete ${fileToDelete.name}?`)) return;

    if (!currentRepo) {
      setLocalWorkspaceFiles(localWorkspaceFiles.filter(f => f.path !== fileToDelete.path));
      if (activeFile?.path === fileToDelete.path) {
        setActiveFile(null);
        setContent('');
      }
      showToast(`Deleted ${fileToDelete.name}`);
      return;
    }

    setPendingOps(prev => ({ ...prev, [fileToDelete.path]: { action: 'delete' } }));
    if (activeFile?.path === fileToDelete.path) {
      setActiveFile(null);
      setContent('');
    }
    showToast(`Deleting ${fileToDelete.name}...`);

    (async () => {
      try {
        if (pendingOps[fileToDelete.path]?.action === 'add') {
          setPendingOps(prev => { const newState = { ...prev }; delete newState[fileToDelete.path]; return newState; });
          return;
        }

        const body = { message: `Delete ${fileToDelete.name} via Git Markdown Editor`, sha: fileToDelete.sha };
        await apiRequest(`/repos/${currentRepo}/contents/${fileToDelete.path}`, 'DELETE', body);

        setRepoContents(prev => prev.filter(f => f.path !== fileToDelete.path));
        setPendingOps(prev => { const newState = { ...prev }; delete newState[fileToDelete.path]; return newState; });
        showToast(`Deleted ${fileToDelete.name}`);
        
        const currentDirPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
        fetchRepoContents(currentRepo, currentDirPath);
      } catch (_error) {
        showToast(`Failed to delete ${fileToDelete.name}`, 'error');
        setPendingOps(prev => { const newState = { ...prev }; delete newState[fileToDelete.path]; return newState; });
      }
    })();
  };

  const createFile = async (fileName, initialContent = '') => {
    const currentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '';
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;

    if (!currentRepo) {
      const existingFile = localWorkspaceFiles.find(f => f.name === fileName);
      if (existingFile) {
        showToast(`File '${fileName}' already exists.`, 'error');
        return;
      }
      const newFile = { name: fileName, path: filePath, type: 'file', content: initialContent };
      setLocalWorkspaceFiles([...localWorkspaceFiles, newFile]);
      setActiveFile(newFile);
      setContent(initialContent);
      showToast(`Created ${fileName}`);
      return;
    }

    const tempFile = { name: fileName, path: filePath, type: 'file', sha: null, content: initialContent };
    setPendingOps(prev => ({ ...prev, [filePath]: { action: 'add', file: tempFile, content: initialContent } }));
    setActiveFile(tempFile);
    setContent(initialContent);
    showToast(`Creating ${fileName}...`); 

    (async () => {
      try {
        const body = { message: `Create ${fileName} via Git Markdown Editor`, content: utf8_to_b64(initialContent) };
        const data = await apiRequest(`/repos/${currentRepo}/contents/${filePath}`, 'PUT', body);
        
        const newFileEntry = { name: fileName, path: filePath, type: 'file', sha: data.content.sha };
        setRepoContents(prev => {
          const filtered = prev.filter(f => f.path !== filePath);
          return [...filtered, newFileEntry].sort((a, b) => {
             if (a.type === b.type) return a.name.localeCompare(b.name);
             return a.type === 'dir' ? -1 : 1;
          });
        });

        setPendingOps(prev => { const newState = { ...prev }; delete newState[filePath]; return newState; });
        setActiveFile(prev => prev && prev.path === filePath ? { ...prev, sha: data.content.sha } : prev);
        fetchRepoContents(currentRepo, currentPath);
        showToast(`Synced ${fileName}`);
      } catch (_error) {
        showToast(`Failed to create file: ${fileName}`, 'error');
        setPendingOps(prev => { const newState = { ...prev }; delete newState[filePath]; return newState; });
        setActiveFile(prev => prev && prev.path === filePath ? null : prev);
      }
    })();
  };

  // --- External Actions ---
  const handleExportPdf = useCallback(() => window.print(), []);
  
  const handleDownload = () => {
    const fileName = activeFile?.name || localFileName || 'untitled.md';
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${fileName}`);
  };

  const importLocalFile = async () => {
    if (!('showOpenFilePicker' in window)) {
      showToast('Browser not supported for direct file access.', 'error');
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md', '.markdown', '.mdx', '.txt'] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      const text = await file.text();
      createFile(file.name, text);
    } catch (_error) {
      if (_error.name !== 'AbortError') showToast('Failed to open local file', 'error');
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd && e.key === 's') { e.preventDefault(); saveToGitHub(); }
      if (isCtrlOrCmd && e.key === 'p') { e.preventDefault(); handleExportPdf(); }

      if (isCtrlOrCmd && e.key === 'b') { e.preventDefault(); insertText('**', '**', 'bold text'); }
      if (isCtrlOrCmd && e.key === 'i') { e.preventDefault(); insertText('*', '*', 'italic text'); }
      if (isCtrlOrCmd && e.shiftKey && e.key === 'S') { e.preventDefault(); insertText('~~', '~~', 'strikethrough text'); }
      if (isCtrlOrCmd && e.key === 'k') { e.preventDefault(); insertText('[', '](url)', 'link text'); }
      if (isCtrlOrCmd && e.altKey && e.key === 'i') { e.preventDefault(); insertText('![alt text](', ')', 'image url'); }
      if (isCtrlOrCmd && e.shiftKey && e.key === 'U') { e.preventDefault(); insertListItem('- ', 'List item'); }
      if (isCtrlOrCmd && e.shiftKey && e.key === 'O') { e.preventDefault(); insertNumberedList(1, 'Numbered item'); }
      if (isCtrlOrCmd && e.shiftKey && e.key === 'L') { e.preventDefault(); insertTaskList('- [ ] ', 'Task'); }
      if (isCtrlOrCmd && e.shiftKey && e.key === 'Q') { e.preventDefault(); insertText('> ', '', 'Quote'); }
      if (isCtrlOrCmd && e.altKey && e.key === 'c') { e.preventDefault(); insertText('```\n', '\n```', 'code block'); }
      if (isCtrlOrCmd && e.altKey && e.key === '`') { e.preventDefault(); insertText('`', '`', 'inline code'); }
      if (isCtrlOrCmd && e.altKey && e.key === 't') { e.preventDefault(); insertText('\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n', '', ''); }
      if (isCtrlOrCmd && e.altKey && e.key === 'm') { e.preventDefault(); insertText('$$\n', '\n$$', 'E = mc^2'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveToGitHub, handleExportPdf, insertText, insertListItem, insertNumberedList, insertTaskList]);

  const handleScroll = (e) => {
    if (viewMode !== 'split') return;
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);
    
    if (e.target === editorRef.current && previewRef.current) {
      previewRef.current.scrollTop = scrollRatio * (previewRef.current.scrollHeight - previewRef.current.clientHeight);
    } else if (e.target === previewRef.current && editorRef.current) {
      editorRef.current.scrollTop = scrollRatio * (editorRef.current.scrollHeight - editorRef.current.clientHeight);
    }
  };

  // --- RENDER HELPERS ---
  const renderSidebar = () => (
    <div id="main-sidebar" className="flex-shrink-0 bg-gray-50 dark:bg-[#161b22] border-r border-gray-200 dark:border-gray-800 flex flex-col transition-none overflow-hidden relative" style={{ width: isSidebarOpen ? sidebarWidth : 0 }}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <span className="font-bold flex items-center text-gray-900 dark:text-gray-100 truncate">
          <Github className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400 shrink-0" /> Explorer
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {!ghUser ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 p-4 rounded-lg text-center">
              <Github className="w-8 h-8 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Sync files with your GitHub repositories.</p>
              <button onClick={() => setShowAuthModal(true)} className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded text-sm font-medium transition-colors text-gray-900 dark:text-gray-200">
                Connect Account
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">Local Workspace</h3>
                <div className="flex space-x-1">
                  <button onClick={importLocalFile} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded" title="Import File"><FileUp className="w-3 h-3" /></button>
                  <button onClick={() => createFile(prompt('Enter new file name:') || 'untitled.md')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded" title="New file"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
              <ul className="space-y-1">
                {getWorkspaceFiles().map(file => (
                  <li key={file.path}>
                    <div className="flex items-center group">
                      <button onClick={() => loadFile(file)} className={`flex-1 flex items-center px-2 py-1.5 rounded text-sm transition-colors text-left group min-w-0 ${activeFile?.path === file.path ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                        <FileText className="w-4 h-4 mr-2 text-gray-500 shrink-0" />
                        <span className="flex-1 truncate min-w-0" title={file.name}>{file.name}</span>
                      </button>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); renameFile(file); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all rounded mr-1"><FileEdit className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </li>
                ))}
                {getWorkspaceFiles().length === 0 && <p className="text-xs text-gray-500 px-2 italic">No files</p>}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white dark:bg-[#0d1117] p-2 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="flex items-center truncate">
                <img src={ghUser.avatar_url} alt="Avatar" className="w-6 h-6 rounded-full mr-2" />
                <span className="text-sm font-medium truncate text-gray-900 dark:text-gray-200">{ghUser.login}</span>
              </div>
              <button onClick={() => { setGhToken(''); setGhUser(null); localStorage.removeItem('gh_token'); }} className="text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded" title="Disconnect"><LogOut className="w-4 h-4" /></button>
            </div>
            {!currentRepo ? (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Repositories</h3>
                {loadingState === 'fetching' ? (
                  <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
                ) : (
                  <div className="space-y-4">
                    <ul className="space-y-1">
                      {repos.filter(r => !hiddenRepos.includes(r.full_name)).map(repo => (
                        <li key={repo.id} className="flex items-center group">
                          <button onClick={() => fetchRepoContents(repo.full_name)} className="flex-1 flex items-center px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-l text-sm text-gray-700 dark:text-gray-300 transition-colors text-left overflow-hidden">
                            <Folder className="w-4 h-4 mr-2 text-blue-500 dark:text-indigo-400 shrink-0" />
                            <span className="truncate">{repo.name}</span>
                          </button>
                          <button onClick={() => setHiddenRepos([...hiddenRepos, repo.full_name])} className="opacity-0 group-hover:opacity-100 px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all rounded-r"><EyeOff className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ul>
                    {hiddenRepos.length > 0 && (
                      <div className="px-1 -mt-2 mb-2">
                        <button onClick={() => setHiddenRepos([])} className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Restore {hiddenRepos.length} hidden repo(s)</button>
                      </div>
                    )}
                    <div className="px-1 border-t border-gray-200 dark:border-gray-800 pt-3">
                      <p className="text-xs text-gray-500 mb-2">Can't see your repo? Enter manually:</p>
                      <div className="flex space-x-2">
                        <input type="text" placeholder="owner/repo" value={manualRepo} onChange={(e) => setManualRepo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manualRepo && fetchRepoContents(manualRepo)} className="flex-1 w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 focus:outline-none" />
                        <button onClick={() => manualRepo && fetchRepoContents(manualRepo)} disabled={!manualRepo} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded text-xs font-medium text-gray-700 dark:text-gray-300">Go</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate" title={currentRepo}>{currentRepo}</h3>
                  <div className="flex space-x-1">
                    <button onClick={() => { if (pathStack.length > 0) { const ns = [...pathStack]; ns.pop(); setPathStack(ns); fetchRepoContents(currentRepo, ns.length > 0 ? ns[ns.length - 1].path : ''); } else { setCurrentRepo(null); setPathStack([]); } }} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded"><ArrowLeft className="w-3 h-3" /></button>
                    <button onClick={importLocalFile} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded"><FileUp className="w-3 h-3" /></button>
                    <button onClick={() => createFile(prompt('Enter new file name:') || 'untitled.md')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded"><Plus className="w-3 h-3" /></button>
                    <button onClick={() => fetchRepoContents(currentRepo, pathStack.length > 0 ? pathStack[pathStack.length - 1].path : '')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs bg-gray-200 dark:bg-gray-800 px-1.5 py-1 rounded"><RefreshCcw className="w-3 h-3" /></button>
                  </div>
                </div>
                {pathStack.length > 0 && (
                  <button onClick={() => { const ns = [...pathStack]; ns.pop(); setPathStack(ns); fetchRepoContents(currentRepo, ns.length > 0 ? ns[ns.length - 1].path : ''); }} className="w-full flex items-center px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <ArrowLeft className="w-4 h-4 mr-2 shrink-0" /><span className="truncate">.. / {pathStack[pathStack.length-1].name}</span>
                  </button>
                )}
                {loadingState === 'fetching' ? <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div> : (
                  <ul className="space-y-1">
                    {getWorkspaceFiles().map(file => (
                      <li key={file.sha || file.path}>
                        <div className={`flex items-center group ${file.status === 'pending' ? 'opacity-70' : ''}`}>
                          <button onClick={() => loadFile(file)} className={`flex-1 flex items-center px-2 py-1.5 rounded text-sm transition-colors text-left group min-w-0 ${activeFile?.path === file.path ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                            {file.type === 'dir' ? <Folder className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400 shrink-0" /> : <FileText className={`w-4 h-4 mr-2 shrink-0 ${file.status === 'pending' ? 'text-amber-500 animate-pulse' : 'text-gray-500'}`} />}
                            <span className={`flex-1 truncate min-w-0 ${file.status === 'pending' ? 'text-amber-600 dark:text-amber-400 italic' : ''}`} title={file.name}>
                              {file.name} {file.status === 'pending' && <span className="text-[10px] ml-1 opacity-75">(Syncing)</span>}
                            </span>
                          </button>
                          {file.type === 'file' && (
                            <div className={`flex items-center transition-opacity ${file.status === 'pending' ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                              <button onClick={(e) => { e.stopPropagation(); renameFile(file); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded mr-1"><FileEdit className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); deleteFile(file); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                    {getWorkspaceFiles().length === 0 && <p className="text-xs text-gray-500 px-2 italic">Empty folder</p>}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      {toast && <Toast type={toast.type} message={toast.message} />}

      {/* GitHub Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b22] border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-2 flex items-center"><Github className="w-6 h-6 mr-2" /> Connect GitHub</h2>
            <p className="text-sm text-gray-400 mb-6">Enter a Personal Access Token (classic) with <code className="bg-gray-800 px-1 rounded">repo</code> scope to sync files.</p>
            <input type="password" placeholder="ghp_xxxxxxxxxxxx" id="pat-input" onKeyDown={(e) => e.key === 'Enter' && verifyGitHubToken(e.target.value)} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-4 transition-all" />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowAuthModal(false)} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={() => verifyGitHubToken(document.getElementById('pat-input').value)} disabled={loadingState === 'verifying'} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center">
                {loadingState === 'verifying' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {renderSidebar()}

      {isSidebarOpen && (
        <div id="sidebar-resizer" className="w-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-10 flex items-center justify-center group" onMouseDown={() => { setIsResizingSidebar(true); document.body.style.cursor = 'col-resize'; }}>
          <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity group-hover:bg-white" />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div id="top-toolbar" className="h-14 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors mr-2">
              <Columns className="w-5 h-5" />
            </button>
            <div className="flex items-center text-sm">
              {activeFile ? (
                <>
                  <span className="text-gray-500">{currentRepo} / </span>
                  <span className="text-gray-900 dark:text-gray-200 ml-1 font-medium">{activeFile.name}</span>
                  {content !== localStorage.getItem('markhub_draft') && <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2" title="Unsaved changes"></span>}
                </>
              ) : localFileName ? (
                <>
                  <span className="text-gray-500 italic">Local / </span>
                  <span className="text-gray-900 dark:text-gray-200 ml-1 font-medium">{localFileName}</span>
                </>
              ) : (
                <span className="text-gray-500 italic">Local Draft (Unsynced)</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5 border border-gray-300 dark:border-gray-700 mr-4">
              <button onClick={() => setViewMode('edit')} className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('split')} className={`p-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Columns className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('preview')} className={`p-1.5 rounded-md transition-all ${viewMode === 'preview' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Eye className="w-4 h-4" /></button>
            </div>
            <button onClick={handleDownload} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2" title="Download File"><Download className="w-5 h-5" /></button>
            <button onClick={handleExportPdf} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-gray-800 rounded mr-2" title="Export to PDF"><Printer className="w-5 h-5" /></button>
            <button onClick={saveToGitHub} disabled={!activeFile || loadingState === 'saving'} className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeFile ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
              {loadingState === 'saving' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {currentRepo ? 'Commit' : 'Save'}
            </button>
          </div>
        </div>

        {viewMode !== 'preview' && (
          <div id="formatting-toolbar" className="h-10 bg-gray-50 dark:bg-[#0d1117] border-b border-gray-200 dark:border-gray-800 flex items-center px-4 space-x-1 overflow-x-auto shrink-0 custom-scrollbar">
            <ToolButton icon={<Bold className="w-4 h-4" />} onClick={() => insertText('**', '**', 'bold text')} title="Bold" />
            <ToolButton icon={<Italic className="w-4 h-4" />} onClick={() => insertText('*', '*', 'italic text')} title="Italic" />
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
            <ToolButton icon={<Heading1 className="w-4 h-4" />} onClick={() => insertText('# ', '', 'Heading 1')} title="Heading 1" />
            <ToolButton icon={<Heading2 className="w-4 h-4" />} onClick={() => insertText('## ', '', 'Heading 2')} title="Heading 2" />
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
            <ToolButton icon={<List className="w-4 h-4" />} onClick={() => insertListItem('- ', 'List item')} title="Bullet List" />
            <ToolButton icon={<ListOrdered className="w-4 h-4" />} onClick={() => insertNumberedList(1, 'Numbered item')} title="Numbered List" />
            <ToolButton icon={<CheckSquare className="w-4 h-4" />} onClick={() => insertTaskList('- [ ] ', 'Task')} title="Task List" />
            <ToolButton icon={<Quote className="w-4 h-4" />} onClick={() => insertText('> ', '', 'Quote')} title="Blockquote" />
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
            <ToolButton icon={<LinkIcon className="w-4 h-4" />} onClick={() => insertText('[', '](url)', 'link text')} title="Link" />
            <ToolButton icon={<ImageIcon className="w-4 h-4" />} onClick={() => insertText('![alt text](', ')', 'image url')} title="Image" />
            <ToolButton icon={<Table className="w-4 h-4" />} onClick={() => insertText('\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n', '', '')} title="Table" />
            <ToolButton icon={<Code className="w-4 h-4" />} onClick={() => insertText('```\n', '\n```', 'code block')} title="Code Block" />
            <ToolButton icon={<Sigma className="w-4 h-4" />} onClick={() => insertText('$$\n', '\n$$', 'E = mc^2')} title="Math Block" />
            <ToolButton icon={<Strikethrough className="w-4 h-4" />} onClick={() => insertText('~~', '~~', 'strikethrough text')} title="Strikethrough" />
          </div>
        )}

        <div className="flex-1 flex overflow-hidden relative">
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div id="editor-container" className={`h-full flex flex-col bg-white dark:bg-[#0d1117] ${viewMode === 'split' ? '' : 'flex-1'}`} style={viewMode === 'split' ? { width: `${splitRatio * 100}%` } : {}}>
              <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleScroll}
                className="flex-1 w-full bg-transparent text-gray-900 dark:text-gray-300 font-mono text-sm leading-relaxed p-6 resize-none focus:outline-none custom-scrollbar"
                placeholder="Start typing your markdown here..."
                spellCheck="false"
              />
            </div>
          )}

          {viewMode === 'split' && (
            <div id="split-resizer" className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-800 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-10 flex items-center justify-center group" onMouseDown={() => { setIsResizingSplit(true); document.body.style.cursor = 'col-resize'; }}>
              <div className="h-8 w-0.5 bg-gray-400 dark:bg-gray-600 rounded group-hover:bg-white transition-colors" />
            </div>
          )}

          {(viewMode === 'preview' || viewMode === 'split') && (
            <div id="preview-container" ref={previewRef} onScroll={handleScroll} className={`h-full bg-white dark:bg-[#0d1117] overflow-y-auto p-8 custom-scrollbar relative ${viewMode === 'split' ? '' : 'flex-1'}`} style={viewMode === 'split' ? { width: `${(1 - splitRatio) * 100}%` } : {}}>
              <div className="max-w-3xl mx-auto w-full">
                <div className="markdown-body text-gray-900 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: parsedHtml }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}