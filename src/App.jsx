import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GripVertical } from 'lucide-react';

// Utils
import { utf8_to_b64, b64_to_utf8 } from './utils/encoding';
import { fallbackParse, inlineParse } from './utils/markdown';
import { parseEmojis } from './utils/emojis';
import { loadShortcuts, matchesShortcut } from './utils/shortcutManager';

// Components
import Toast from './components/Toast';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import FormattingToolbar from './components/FormattingToolbar';
import Editor from './components/Editor';
import Preview from './components/Preview';
import ShortcutModal from './components/ShortcutModal';

// Safely attempt to load README.md
const readmeFiles = import.meta.glob('../README.md', { query: '?raw', eager: true, import: 'default' });
const defaultContent = Object.keys(readmeFiles).length > 0 ? Object.values(readmeFiles)[0] : null;

const DEFAULT_MARKDOWN = `
# Welcome to Git Markdown Editor

Git Markdown Editor is a powerful, browser-based Markdown editor.

### Features
- **GitHub Integration**: Connect your account and edit files directly from your repos.
- **Local Workspace**: Edit and save files on your local browser storage.
- **Live Preview**: See your changes in real-time.
- **Math Support**: Write equations using KaTeX.

Get started by editing this text or connecting your GitHub account!
`;

export default function App() {
  // --- Editor State ---
  const [content, setContent] = useState(() => {
    const savedDraft = localStorage.getItem('gme_draft');
    if (savedDraft) return savedDraft;
    return defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN;
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
  const [processor, setProcessor] = useState(null);
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  
  // --- GitHub State ---
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('gme_gh_token') || '');
  const [ghUser, setGhUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [currentRepo, setCurrentRepo] = useState(null);
  const currentRepoRef = useRef(null);
  const [repoContents, setRepoContents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const currentBranchRef = useRef('');
  const [pathStack, setPathStack] = useState([]); 
  const [activeFile, setActiveFile] = useState(null); 
  const activeFileRef = useRef(null);
  const [manualRepo, setManualRepo] = useState('');
  const [hiddenRepos, setHiddenRepos] = useState(() => JSON.parse(localStorage.getItem('gme_hidden_repos') || '[]'));
  
  // --- Local File Workspace State ---
  const [, setLocalFileHandle] = useState(null);
  const [localFileName, setLocalFileName] = useState('');
  const [localWorkspaceFiles, setLocalWorkspaceFiles] = useState(() => JSON.parse(localStorage.getItem('gme_local_workspace') || '[]'));
  const [pendingOps, setPendingOps] = useState({}); 
  const [tocHeadings, setTocHeadings] = useState([]);
  // --- UI State ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [loadingState, setLoadingState] = useState('');
  const [toast, setToast] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const [shortcuts, setShortcuts] = useState(loadShortcuts());

  // Sync refs for async callbacks
  useEffect(() => { currentRepoRef.current = currentRepo; }, [currentRepo]);
  useEffect(() => { currentBranchRef.current = currentBranch; }, [currentBranch]);
  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { localStorage.setItem('gme_local_workspace', JSON.stringify(localWorkspaceFiles)); }, [localWorkspaceFiles]);
  useEffect(() => { localStorage.setItem('gme_hidden_repos', JSON.stringify(hiddenRepos)); }, [hiddenRepos]);

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
      // Load legacy KaTeX script as fallback
      await loadScript("https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js");
      
      try {
        setLoadingState('Loading parser...');
        const [
          { unified },
          { default: remarkParse },
          { default: remarkGfm },
          { default: remarkMath },
          { default: remarkRehype },
          { default: rehypeKatex },
          { default: rehypeStringify },
          { default: remarkEmoji }
        ] = await Promise.all([
          import('https://cdn.jsdelivr.net/npm/unified@11/+esm'),
          import('https://cdn.jsdelivr.net/npm/remark-parse@11/+esm'),
          import('https://cdn.jsdelivr.net/npm/remark-gfm@4/+esm'),
          import('https://cdn.jsdelivr.net/npm/remark-math@6/+esm'),
          import('https://cdn.jsdelivr.net/npm/remark-rehype@11/+esm'),
          import('https://cdn.jsdelivr.net/npm/rehype-katex@7/+esm'),
          import('https://cdn.jsdelivr.net/npm/rehype-stringify@10/+esm'),
          import('https://cdn.jsdelivr.net/npm/remark-emoji@4/+esm')
        ]);

        const remarkOffsetPlugin = () => (tree) => {
          const walk = (node) => {
            if (node.position) {
              node.data = node.data || {};
              node.data.hProperties = node.data.hProperties || {};
              node.data.hProperties['data-offset-start'] = String(node.position.start.offset);
              node.data.hProperties['data-offset-end'] = String(node.position.end.offset);
              
              // Apply hover-able class to meaningful content nodes
              const syncableTypes = ['text', 'strong', 'emphasis', 'inlineCode', 'link', 'image', 'heading', 'paragraph', 'listItem', 'blockquote', 'code', 'tableCell'];
              if (syncableTypes.includes(node.type)) {
                node.data.hProperties.className = [...(node.data.hProperties.className || []), 'cursor-sync-target'];
              }
            }
            if (node.children) node.children.forEach(walk);
          };
          walk(tree);
        };

        const proc = unified()
          .use(remarkParse)
          .use(remarkGfm)
          .use(remarkMath)
          .use(remarkEmoji)
          .use(remarkOffsetPlugin)
          .use(remarkRehype, { allowDangerousHtml: true })
          .use(rehypeKatex)
          .use(rehypeStringify, { allowDangerousHtml: true });

        setProcessor(() => proc);
        setLoadingState('');
        
        // Use a slight delay to ensure state has propagated
        setTimeout(() => {
          setContent(c => { updatePreview(c, proc); return c; });
        }, 100);
      } catch (err) {
        console.error("Unified load failed, falling back to Marked.js", err);
        setLoadingState('Sync limited (Marked.js)');
        // Brief toast for diagnostics if sync is critical
        showToast("AST Parser unavailable (network/CSP), falling back to scrolling only.", "info");
        
        await loadScript("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
        
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
        setLoadingState('');
      }
    };

    initParser();
  }, []);

  // --- Autosave & Parsing Updates ---
  const updateTOC = useCallback((fileContent, filePath) => {
    const lines = fileContent.split('\n');
    const headings = lines.reduce((acc, line, index) => {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        acc.push({
          level: match[1].length,
          name: inlineParse(match[2]),
          rawName: match[2],
          line: index,
          type: 'heading',
          path: `${filePath}#L${index + 1}`
        });
      }
      return acc;
    }, []);
    setTocHeadings(headings);
  }, []);

  const updatePreview = useCallback(async (md, procOverride = null) => {
    const proc = procOverride || processor;
    if (proc) {
      try {
        const result = await proc.process(md);
        setParsedHtml(String(result));
        return;
      } catch (e) {
        console.error("Unified process failed", e);
      }
    }

    const processedMd = parseEmojis(md);
    if (window.marked && window.katex) {
      setParsedHtml(window.marked.parse(processedMd));
    } else {
      setParsedHtml(fallbackParse(processedMd));
    }
  }, [processor]);

  useEffect(() => {
    localStorage.setItem('gme_draft', content);
    updatePreview(content);
    
    // Live update TOC if we are currently looking at it for the active file
    if (pathStack.length > 0 && pathStack[pathStack.length - 1].isTOC && activeFile) {
      if (pathStack[pathStack.length - 1].path === activeFile.path) {
        updateTOC(content, activeFile.path);
      }
    }
  }, [content, updatePreview, pathStack, activeFile, updateTOC]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

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
  const apiRequest = useCallback(async (endpoint, method = 'GET', body = null, customToken = null, useCache = false) => {
    const tokenToUse = customToken || ghToken;
    let url = `https://api.github.com${endpoint}`;
    
    // Only add cache-buster if we explicitly want to skip cache
    if (method === 'GET' && !useCache) {
      url += `${url.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${tokenToUse}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      // Use 'default' (let the browser/CDN handle it) if useCache is true, 
      // otherwise force 'no-store' for a fresh request.
      cache: useCache ? 'default' : 'no-store',
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
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('gme_gh_token');
          setGhToken('');
          if (!silent) showToast('Invalid GitHub Token', 'error');
        } else {
          if (!silent) showToast('GitHub API Error', 'error');
        }
        setLoadingState('');
        return;
      }

      const user = await res.json();
      setGhToken(token);
      localStorage.setItem('gme_gh_token', token);
      setGhUser(user);
      setShowAuthModal(false);
      fetchRepos(token);
      if (!silent) showToast('Connected to GitHub');
    } catch (_error) {
      // Don't remove token on network errors/timeout
      if (!silent) showToast('Connection Error', 'error');
    }
    setLoadingState('');
  }, [fetchRepos, setGhToken, setGhUser, setShowAuthModal, showToast]);

  useEffect(() => {
    const savedToken = localStorage.getItem('gme_gh_token');
    if (savedToken) {
      verifyGitHubToken(savedToken, true);
    }
  }, [verifyGitHubToken]);

  const fetchRepoContents = async (repoFullName, path = '', branch = null, forceRefreshBranches = false) => {
    setLoadingState('fetching');
    try {
      let targetBranch = branch || currentBranch;
      
      // Fetch repo info and branches if:
      // 1. Switching to a DIFFERENT repository
      // 2. We don't have ANY branch state yet
      // 3. User explicitly requested a force refresh (e.g. via Update button)
      if (repoFullName !== currentRepo || !targetBranch || forceRefreshBranches) {
        const [repoInfo, branchesData] = await Promise.all([
          apiRequest(`/repos/${repoFullName}`),
          apiRequest(`/repos/${repoFullName}/branches`)
        ]);
        
        setBranches(branchesData);
        if (!branch && !currentBranch) {
          targetBranch = repoInfo.default_branch;
          setCurrentBranch(targetBranch);
        }
      }

      const data = await apiRequest(`/repos/${repoFullName}/contents/${path}?ref=${targetBranch}`);
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

  const loadTOC = async (file) => {
    if (file.type === 'dir') return;
    if (!file.name.match(/\.(md|txt|mdx)$/i)) {
      showToast('TOC only supported for Markdown files', 'error');
      return;
    }

    let fileContent = '';
    if (!currentRepo) {
      fileContent = file.content || '';
    } else {
      setLoadingState('fetching');
      try {
        const data = await apiRequest(`/repos/${currentRepo}/contents/${file.path}?ref=${currentBranch}`, 'GET', null, null, true);
        fileContent = b64_to_utf8(data.content);
      } catch (_error) {
        showToast('Failed to load file for TOC', 'error');
        setLoadingState('');
        return;
      }
      setLoadingState('');
    }

    updateTOC(fileContent, file.path);
    setPathStack([...pathStack, { ...file, isTOC: true }]);
  };

  const getWorkspaceFiles = () => {
    if (pathStack.length > 0 && pathStack[pathStack.length - 1].isTOC) {
      return tocHeadings;
    }

    if (currentRepo) {
      // Filter out files that are being deleted OR being updated (to replace with pending version)
      let files = repoContents.filter(f => {
        const op = pendingOps[f.path];
        if (!op) return true;
        return op.action !== 'delete' && op.action !== 'add';
      });
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
    const branchContext = currentBranchRef.current;

    if (!currentActiveFile) return;
    
    if (!repoContext) {
      const updated = localWorkspaceFiles.map(f => f.path === currentActiveFile.path ? { ...f, content: content } : f);
      setLocalWorkspaceFiles(updated);
      showToast('Saved locally');
      return;
    }

    setLoadingState('saving');
    // Optimistic Update
    setPendingOps(prev => ({ 
      ...prev, 
      [currentActiveFile.path]: { action: 'add', file: { ...currentActiveFile, status: 'pending' }, content: content } 
    }));
    showToast(`Committing ${currentActiveFile.name}...`);

    (async () => {
      try {
        const body = {
          message: `Update ${currentActiveFile.name} via Git Markdown Editor`,
          content: utf8_to_b64(content),
          sha: currentActiveFile.sha,
          branch: branchContext
        };
        const data = await apiRequest(`/repos/${repoContext}/contents/${currentActiveFile.path}`, 'PUT', body);
        const updatedFile = { ...currentActiveFile, sha: data.content.sha };
        
        setPendingOps(prev => { const newState = { ...prev }; delete newState[currentActiveFile.path]; return newState; });
        setActiveFile(updatedFile);
        showToast('Successfully committed to GitHub!');
        // Force reload from GitHub with no-store to ensure cache is updated and sync is verified
        await loadFile(updatedFile, true);
      } catch (_error) {
        setPendingOps(prev => { const newState = { ...prev }; delete newState[currentActiveFile.path]; return newState; });
        showToast('Failed to save to GitHub', 'error');
      }
      setLoadingState('');
    })();
  }, [content, localWorkspaceFiles, showToast, apiRequest]);

  const loadFile = async (file, forceFresh = false) => {
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
      const data = await apiRequest(`/repos/${currentRepo}/contents/${file.path}?ref=${currentBranch}`, 'GET', null, null, !forceFresh);
      const decodedContent = b64_to_utf8(data.content);
      setContent(decodedContent);
      setActiveFile({ path: file.path, sha: data.sha, name: file.name });
      setLocalFileName('');     
      showToast(forceFresh ? `Synced with GitHub` : `Loaded ${file.name}`);
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
        const sourceData = await apiRequest(`/repos/${currentRepo}/contents/${fileToRename.path}?ref=${currentBranch}`);
        const createBody = {
          message: `Rename ${fileToRename.name} to ${newName} via Git Markdown Editor`,
          content: sourceData.content.replace(/\n/g, ''),
          branch: currentBranch
        };
        const createRes = await apiRequest(`/repos/${currentRepo}/contents/${newPath}`, 'PUT', createBody);

        const deleteBody = { 
          message: `Rename ${fileToRename.name} to ${newName} (cleanup)`, 
          sha: sourceData.sha,
          branch: currentBranch
        };
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

        const body = { 
          message: `Delete ${fileToDelete.name} via Git Markdown Editor`, 
          sha: fileToDelete.sha,
          branch: currentBranch
        };
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
        const body = { 
          message: `Create ${fileName} via Git Markdown Editor`, 
          content: utf8_to_b64(initialContent),
          branch: currentBranch
        };
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

  const createBranch = async (branchName) => {
    if (!currentRepo || !currentBranch) return;
    setLoadingState('saving');
    try {
      // 1. Get current branch SHA
      const branchData = await apiRequest(`/repos/${currentRepo}/branches/${currentBranch}`);
      const sha = branchData.commit.sha;
      
      // 2. Create new reference
      await apiRequest(`/repos/${currentRepo}/git/refs`, 'POST', {
        ref: `refs/heads/${branchName}`,
        sha: sha
      });
      
      showToast(`Created branch ${branchName}`);
      
      // 3. Refresh branches and switch
      const branchesData = await apiRequest(`/repos/${currentRepo}/branches`);
      setBranches(branchesData);
      setCurrentBranch(branchName);
      fetchRepoContents(currentRepo, '', branchName);
    } catch (_error) {
      showToast(`Failed to create branch: ${_error.message}`, 'error');
    }
    setLoadingState('');
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

  const jumpToLine = useCallback((line) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < Math.min(line, lines.length); i++) {
        offset += lines[i].length + 1; // +1 for the newline
    }

    textarea.focus();
    textarea.setSelectionRange(offset, offset);
    
    // Smooth scroll into view
    const lineHeight = 24; // Approximation based on text-sm and leading-relaxed
    textarea.scrollTop = line * lineHeight - (textarea.clientHeight / 2);
  }, [content]);

  const jumpToOffset = useCallback((start, end) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    textarea.focus();
    
    // Just set the selection without any scrolling
    requestAnimationFrame(() => {
      textarea.setSelectionRange(start, end);
    });
  }, []);

  const handlePreviewClick = useCallback((e) => {
    let target = e.target;
    // Walk up the DOM to find the nearest element with offset data
    while (target && target !== e.currentTarget) {
      const start = target.getAttribute('data-offset-start');
      const end = target.getAttribute('data-offset-end');
      
      if (start !== null && end !== null) {
        // We found a node with offset data. 
        // Prevent default browser behavior (like link navigation)
        e.preventDefault();
        e.stopPropagation();
        
        const s = parseInt(start, 10);
        const e_offset = parseInt(end, 10);
        
        if (!isNaN(s) && !isNaN(e_offset)) {
          jumpToOffset(s, e_offset);
        }
        return;
      }
      target = target.parentElement;
    }
  }, [jumpToOffset]);

  const syncPreviewToEditor = useCallback(() => {
    // We no longer highlight or scroll the preview on editor cursor movement
  }, []);

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
      if (matchesShortcut(e, shortcuts.code_block)) { e.preventDefault(); insertText('```\n', '\n```', 'code block'); }
      if (matchesShortcut(e, shortcuts.inline_code)) { e.preventDefault(); insertText('`', '`', 'inline code'); }
      if (matchesShortcut(e, shortcuts.table)) { e.preventDefault(); insertText('\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n', '', ''); }
      if (matchesShortcut(e, shortcuts.math_block)) { e.preventDefault(); insertText('$$\n', '\n$$', 'E = mc^2'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveToGitHub, handleExportPdf, insertText, insertListItem, insertNumberedList, insertTaskList, shortcuts]);

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

  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      {toast && <Toast type={toast.type} message={toast.message} />}

      <AuthModal 
        showAuthModal={showAuthModal} 
        setShowAuthModal={setShowAuthModal} 
        verifyGitHubToken={verifyGitHubToken} 
        loadingState={loadingState} 
      />

      <ShortcutModal
        show={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
        onShortcutsUpdated={setShortcuts}
      />

      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        sidebarWidth={sidebarWidth}
        ghUser={ghUser}
        setShowAuthModal={setShowAuthModal}
        setShowShortcutModal={setShowShortcutModal}
        importLocalFile={importLocalFile}
        createFile={createFile}
        getWorkspaceFiles={getWorkspaceFiles}
        loadFile={loadFile}
        activeFile={activeFile}
        renameFile={renameFile}
        deleteFile={deleteFile}
        setGhToken={setGhToken}
        setGhUser={setGhUser}
        currentRepo={currentRepo}
        repos={repos}
        loadingState={loadingState}
        hiddenRepos={hiddenRepos}
        setHiddenRepos={setHiddenRepos}
        fetchRepoContents={fetchRepoContents}
        manualRepo={manualRepo}
        setManualRepo={setManualRepo}
        pathStack={pathStack}
        setPathStack={setPathStack}
        setCurrentRepo={setCurrentRepo}
        branches={branches}
        currentBranch={currentBranch}
        setCurrentBranch={setCurrentBranch}
        createBranch={createBranch}
        loadTOC={loadTOC}
        jumpToLine={jumpToLine}
      />

      {isSidebarOpen && (
        <div 
          id="sidebar-resizer" 
          className="w-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-10 flex items-center justify-center group" 
          onMouseDown={() => { setIsResizingSidebar(true); document.body.style.cursor = 'col-resize'; }}
        >
          <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity group-hover:bg-white" />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Toolbar 
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          activeFile={activeFile}
          currentRepo={currentRepo}
          currentBranch={currentBranch}
          content={content}
          localFileName={localFileName}
          theme={theme}
          setTheme={setTheme}
          viewMode={viewMode}
          setViewMode={setViewMode}
          handleDownload={handleDownload}
          handleExportPdf={handleExportPdf}
          saveToGitHub={saveToGitHub}
          loadingState={loadingState}
          shortcuts={shortcuts}
          isUnified={!!processor}
        />

        <FormattingToolbar 
          viewMode={viewMode}
          insertText={insertText}
          insertListItem={insertListItem}
          insertNumberedList={insertNumberedList}
          insertTaskList={insertTaskList}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          emojiPickerRef={emojiPickerRef}
          shortcuts={shortcuts}
        />

        <div className="flex-1 flex overflow-hidden relative">
          <Editor 
            viewMode={viewMode}
            splitRatio={splitRatio}
            editorRef={editorRef}
            content={content}
            setContent={setContent}
            handleScroll={handleScroll}
            onKeyUp={syncPreviewToEditor}
            onSelect={syncPreviewToEditor}
            onClick={syncPreviewToEditor}
          />

          {viewMode === 'split' && (
            <div 
              id="split-resizer" 
              className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-800 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-10 flex items-center justify-center group" 
              onMouseDown={() => { setIsResizingSplit(true); document.body.style.cursor = 'col-resize'; }}
            >
              <div className="h-8 w-0.5 bg-gray-400 dark:bg-gray-600 rounded group-hover:bg-white transition-colors" />
            </div>
          )}

          <Preview 
            viewMode={viewMode}
            splitRatio={splitRatio}
            previewRef={previewRef}
            handleScroll={handleScroll}
            parsedHtml={parsedHtml}
            onClick={handlePreviewClick}
          />
        </div>
      </div>
    </div>
  );
}
