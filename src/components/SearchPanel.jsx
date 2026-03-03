import React, { useEffect, useRef, useCallback } from 'react';
import { 
  X, ArrowUp, ArrowDown, ChevronRight, ChevronDown,
  Replace, ReplaceAll, CaseSensitive, WholeWord, Regex 
} from 'lucide-react';
import useStore from '../store/useStore';
import { findNext, findPrevious, replaceNext, replaceAll, SearchQuery, setSearchQuery } from '@codemirror/search';
import { undo, redo } from '@codemirror/commands';

const SearchPanel = ({ editorRef }) => {
  const searchQuery = useStore(state => state.searchQuery);
  const setSearchQueryStore = useStore(state => state.setSearchQuery);
  const replaceQuery = useStore(state => state.replaceQuery);
  const setReplaceQuery = useStore(state => state.setReplaceQuery);
  const isSearchVisible = useStore(state => state.isSearchVisible);
  const setSearchVisible = useStore(state => state.setSearchVisible);
  const isReplaceVisible = useStore(state => state.isReplaceVisible);
  const setReplaceVisible = useStore(state => state.setReplaceVisible);
  const searchOptions = useStore(state => state.searchOptions);
  const setSearchOptions = useStore(state => state.setSearchOptions);
  const searchResults = useStore(state => state.searchResults);

  const findInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && isSearchVisible) {
        setSearchVisible(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSearchVisible, setSearchVisible]);

  useEffect(() => {
    if (isSearchVisible && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [isSearchVisible]);

  const handleFindNext = useCallback((e) => {
    e?.preventDefault();
    if (editorRef.current) findNext(editorRef.current);
  }, [editorRef]);

  const handleFindPrev = useCallback((e) => {
    e?.preventDefault();
    if (editorRef.current) findPrevious(editorRef.current);
  }, [editorRef]);

  const handleReplace = useCallback((e) => {
    e?.preventDefault();
    if (editorRef.current) {
      const { matchCase, wholeWord, regex } = searchOptions;
      editorRef.current.dispatch({
        effects: setSearchQuery.of(new SearchQuery({
          search: searchQuery,
          replace: replaceQuery,
          caseSensitive: matchCase,
          wholeWord: wholeWord,
          regexp: regex
        }))
      });
      replaceNext(editorRef.current);
    }
  }, [editorRef, searchQuery, replaceQuery, searchOptions]);

  const handleReplaceAll = useCallback((e) => {
    e?.preventDefault();
    if (editorRef.current) {
      const { matchCase, wholeWord, regex } = searchOptions;
      editorRef.current.dispatch({
        effects: setSearchQuery.of(new SearchQuery({
          search: searchQuery,
          replace: replaceQuery,
          caseSensitive: matchCase,
          wholeWord: wholeWord,
          regexp: regex
        }))
      });
      replaceAll(editorRef.current);
    }
  }, [editorRef, searchQuery, replaceQuery, searchOptions]);

  const toggleOption = (option) => {
    setSearchOptions({ [option]: !searchOptions[option] });
  };

  const handleInputKeyDown = (e, action, type) => {
    const isMod = e.metaKey || e.ctrlKey;
    
    // Forward Undo/Redo to Editor
    if (isMod && e.key === 'z') {
      e.preventDefault(); e.stopPropagation();
      if (editorRef.current) undo(editorRef.current);
      return;
    }
    if (isMod && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault(); e.stopPropagation();
      if (editorRef.current) redo(editorRef.current);
      return;
    }

    // Tab Navigation
    if (e.key === 'Tab') {
      if (isReplaceVisible) {
        if (type === 'find' && !e.shiftKey) {
          e.preventDefault();
          replaceInputRef.current?.focus();
          return;
        }
        if (type === 'replace' && e.shiftKey) {
          e.preventDefault();
          findInputRef.current?.focus();
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (isMod && e.altKey && isReplaceVisible) {
        handleReplaceAll();
      } else {
        action();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      setSearchVisible(false);
    }
  };

  if (!isSearchVisible) return null;

  return (
    <div className="search-panel">
      <div className="search-panel-container">
        
        {/* Row 1: Find */}
        <div className="search-row">
          <button 
            onClick={() => setReplaceVisible(!isReplaceVisible)}
            className="search-expand-btn"
          >
            {isReplaceVisible ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          
          <div className="search-input-container">
            <input
              ref={findInputRef}
              type="text"
              placeholder="Find"
              value={searchQuery}
              onChange={(e) => setSearchQueryStore(e.target.value)}
              onKeyDown={(e) => handleInputKeyDown(e, () => {
                if (e.shiftKey) handleFindPrev(); else handleFindNext();
              }, 'find')}
              className="search-input search-input-find"
            />
            <div className="search-options-container">
              {searchQuery && (
                <span className="search-counter">
                  {searchResults.total > 0 
                    ? `${searchResults.current}/${searchResults.total}`
                    : '0/0'}
                </span>
              )}
              <OptionButton 
                active={searchOptions.matchCase} 
                onClick={() => toggleOption('matchCase')}
                title="Match Case (Alt+C)"
              >
                <CaseSensitive size={16} />
              </OptionButton>
              <OptionButton 
                active={searchOptions.wholeWord} 
                onClick={() => toggleOption('wholeWord')}
                title="Match Whole Word (Alt+W)"
              >
                <WholeWord size={16} />
              </OptionButton>
              <OptionButton 
                active={searchOptions.regex} 
                onClick={() => toggleOption('regex')}
                title="Use Regular Expression (Alt+R)"
              >
                <Regex size={16} />
              </OptionButton>
            </div>
          </div>

          <div className="search-actions">
            <IconButton onClick={handleFindPrev} title="Previous Match (Shift+F3)">
              <ArrowUp size={18} />
            </IconButton>
            <IconButton onClick={handleFindNext} title="Next Match (F3)">
              <ArrowDown size={18} />
            </IconButton>
            <IconButton onClick={() => setSearchVisible(false)} title="Close (Escape)">
              <X size={18} />
            </IconButton>
          </div>
        </div>

        {/* Row 2: Replace */}
        {isReplaceVisible && (
          <div className="search-row search-row-animate">
            {/* Spacer for toggle button alignment */}
            <div className="w-[22px]" />
            
            <div className="search-input-container">
              <input
                ref={replaceInputRef}
                type="text"
                placeholder="Replace"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(e, handleReplace, 'replace')}
                className="search-input"
              />
            </div>

            <div className="search-actions">
              <IconButton onClick={handleReplace} title="Replace (Enter)">
                <Replace size={18} />
              </IconButton>
              <IconButton onClick={handleReplaceAll} title="Replace All (Ctrl+Alt+Enter)">
                <ReplaceAll size={18} />
              </IconButton>
              {/* Spacer to align with the X button above */}
              <div className="w-[22px]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const OptionButton = ({ active, onClick, children, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`search-option-btn ${
      active 
        ? 'search-option-btn-active' 
        : 'search-option-btn-inactive'
    }`}
  >
    {children}
  </button>
);

const IconButton = ({ onClick, children, title }) => (
  <button
    onClick={onClick}
    title={title}
    className="search-icon-btn"
  >
    {children}
  </button>
);

export default SearchPanel;
