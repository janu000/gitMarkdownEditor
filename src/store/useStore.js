import { create } from 'zustand';
import { loadShortcuts } from '../utils/shortcutManager';

const welcomeFiles = import.meta.glob('../../welcome.md', { query: '?raw', eager: true, import: 'default' });
export const defaultContent = Object.keys(welcomeFiles).length > 0 ? Object.values(welcomeFiles)[0] : null;

export const DEFAULT_MARKDOWN = `
# Welcome to Git Markdown Editor

Git Markdown Editor is a powerful, browser-based Markdown editor.

### Features
- **GitHub Integration**: Connect your account and edit files directly from your repos.
- **Local Workspace**: Edit and save files on your local browser storage.
- **Live Preview**: See your changes in real-time.
- **Math Support**: Write equations using KaTeX.

Get started by editing this text or connecting your GitHub account!
`;

const useStore = create((set, get) => ({
  // --- UI State ---
  theme: (() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
      return localStorage.getItem('theme');
    }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  })(),
  setTheme: (theme) => set((state) => {
    const newTheme = typeof theme === 'function' ? theme(state.theme) : theme;
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', newTheme);
    return { theme: newTheme };
  }),
  
  viewMode: (() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('gme_view_mode');
      if (saved === 'edit' || saved === 'split' || saved === 'preview') {
        return saved;
      }
    }
    return 'split';
  })(),
  setViewMode: (viewMode) => set((state) => {
    const newViewMode = typeof viewMode === 'function' ? viewMode(state.viewMode) : viewMode;
    if (typeof localStorage !== 'undefined') localStorage.setItem('gme_view_mode', newViewMode);
    return { viewMode: newViewMode };
  }),

  editorMode: typeof localStorage !== 'undefined' && localStorage.getItem('gme_editor_mode') === 'visual' ? 'visual' : 'source',
  setEditorMode: (editorMode) => set((state) => {
    const newEditorMode = typeof editorMode === 'function' ? editorMode(state.editorMode) : editorMode;
    if (typeof localStorage !== 'undefined') localStorage.setItem('gme_editor_mode', newEditorMode);
    return { editorMode: newEditorMode };
  }),
  
  syntaxHighlighting: true,
  setSyntaxHighlighting: (syntaxHighlighting) => set((state) => ({ syntaxHighlighting: typeof syntaxHighlighting === 'function' ? syntaxHighlighting(state.syntaxHighlighting) : syntaxHighlighting })),
  
  loadingState: '',
  setLoadingState: (loadingState) => set((state) => ({ loadingState: typeof loadingState === 'function' ? loadingState(state.loadingState) : loadingState })),
  
  toast: null,
  showToast: (message, type = 'success') => {
    const newToast = { message, type };
    set({ toast: newToast });
    setTimeout(() => {
      if (get().toast === newToast) {
        set({ toast: null });
      }
    }, 3000);
  },
  
  showAuthModal: false,
  setShowAuthModal: (showAuthModal) => set((state) => ({ showAuthModal: typeof showAuthModal === 'function' ? showAuthModal(state.showAuthModal) : showAuthModal })),
  
  showShortcutModal: false,
  setShowShortcutModal: (showShortcutModal) => set((state) => ({ showShortcutModal: typeof showShortcutModal === 'function' ? showShortcutModal(state.showShortcutModal) : showShortcutModal })),
  
  showEmojiPicker: false,
  setShowEmojiPicker: (showEmojiPicker) => set((state) => ({ showEmojiPicker: typeof showEmojiPicker === 'function' ? showEmojiPicker(state.showEmojiPicker) : showEmojiPicker })),
  
  showFormattingTools: true,
  setShowFormattingTools: (showFormattingTools) => set((state) => ({ showFormattingTools: typeof showFormattingTools === 'function' ? showFormattingTools(state.showFormattingTools) : showFormattingTools })),

  shortcuts: loadShortcuts(),
  setShortcuts: (shortcuts) => set((state) => ({ shortcuts: typeof shortcuts === 'function' ? shortcuts(state.shortcuts) : shortcuts })),
  
  // --- Editor & File State ---
  content: defaultContent !== null ? defaultContent : DEFAULT_MARKDOWN,
  setContent: (content) => set((state) => ({ content: typeof content === 'function' ? content(state.content) : content })),
  
  localFileName: '',
  setLocalFileName: (localFileName) => set((state) => ({ localFileName: typeof localFileName === 'function' ? localFileName(state.localFileName) : localFileName })),
  
  activeFile: (() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('gme_last_active_file');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  })(),
  setActiveFile: (activeFile) => set((state) => {
    const newActiveFile = typeof activeFile === 'function' ? activeFile(state.activeFile) : activeFile;
    if (typeof localStorage !== 'undefined') {
      if (newActiveFile) {
        localStorage.setItem('gme_last_active_file', JSON.stringify(newActiveFile));
      } else {
        localStorage.removeItem('gme_last_active_file');
      }
    }
    return { activeFile: newActiveFile };
  }),
  
  pendingOps: {},
  setPendingOps: (pendingOps) => set((state) => ({ pendingOps: typeof pendingOps === 'function' ? pendingOps(state.pendingOps) : pendingOps })),
  
  pathStack: [],
  setPathStack: (pathStack) => set((state) => ({ pathStack: typeof pathStack === 'function' ? pathStack(state.pathStack) : pathStack })),
  
  expandedPaths: new Set(),
  setExpandedPaths: (expandedPaths) => set((state) => ({ expandedPaths: typeof expandedPaths === 'function' ? expandedPaths(state.expandedPaths) : expandedPaths })),
  
  modifiedFiles: new Set(),
  setModifiedFiles: (modifiedFiles) => set((state) => ({ modifiedFiles: typeof modifiedFiles === 'function' ? modifiedFiles(state.modifiedFiles) : modifiedFiles })),

  // --- Search State ---
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  replaceQuery: '',
  setReplaceQuery: (replaceQuery) => set({ replaceQuery }),
  isSearchVisible: false,
  setSearchVisible: (isVisible) => set({ isSearchVisible: isVisible }),
  isReplaceVisible: false,
  setReplaceVisible: (isVisible) => set({ isReplaceVisible: isVisible }),
  searchOptions: {
    matchCase: false,
    wholeWord: false,
    regex: false,
  },
  setSearchOptions: (options) => set((state) => ({ 
    searchOptions: typeof options === 'function' ? options(state.searchOptions) : { ...state.searchOptions, ...options } 
  })),
  searchResults: { current: 0, total: 0 },
  setSearchResults: (results) => set({ searchResults: results }),
}));

export default useStore;
