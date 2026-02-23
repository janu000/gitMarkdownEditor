import { useState, useEffect, useCallback } from 'react';
import { fallbackParse, inlineParse } from '../utils/markdown';
import { parseEmojis } from '../utils/emojis';

export default function useMarkdownParser(showToast, setLoadingState) {
  const [parsedHtml, setParsedHtml] = useState('');
  const [processor, setProcessor] = useState(null);
  const [tocHeadings, setTocHeadings] = useState([]);

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

        const remarkOffsetPlugin = () => (tree, file) => {
          const walk = (node) => {
            if (node.position) {
              node.data = node.data || {};
              node.data.hProperties = node.data.hProperties || {};
              
              let start = node.position.start.offset;
              let end = node.position.end.offset;

              // Refine selection for table cells and list items to exclude delimiters
              if (node.type === 'tableCell' || node.type === 'listItem') {
                const rawContent = file.value.slice(start, end);
                const trimmedMatch = rawContent.match(/^([\s|*-]*)(.*?)[\s|]*$/s);
                if (trimmedMatch) {
                  const leadingLength = trimmedMatch[1].length;
                  const actualContentLength = trimmedMatch[2].length;
                  start += leadingLength;
                  end = start + actualContentLength;
                }
              }

              node.data.hProperties['data-offset-start'] = String(start);
              node.data.hProperties['data-offset-end'] = String(end);
              
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
        }
        setLoadingState('');
      }
    };

    initParser();
  }, [setLoadingState, showToast]);

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

  return {
    parsedHtml,
    processor,
    tocHeadings,
    updateTOC,
    updatePreview
  };
}
