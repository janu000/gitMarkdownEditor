// src/utils/markdownWorker.js

let processor = null;
const chunkCache = new Map();

// Simplified inline parser for TOC names (equivalent to src/utils/markdown.js)
const inlineParse = (text) => {
  if (!text) return '';
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[10px] text-pink-600 dark:text-pink-400 font-mono">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  return html;
};

async function initDOM() {
  if (self.document) return;
  try {
    const { parseHTML } = await import('linkedom');
    const { document, DOMParser, Node, Element, window, CustomEvent } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    self.document = document;
    self.document.compatMode = 'CSS1Compat';
    self.DOMParser = DOMParser;
    self.Node = Node;
    self.Element = Element;
    self.window = window;
    self.CustomEvent = CustomEvent;
  } catch (err) {
    console.error("Worker DOM polyfill failed", err);
  }
}

async function initProcessor() {
  if (processor) return;
  await initDOM();
  try {
    const [
      { unified },
      { default: remarkParse },
      { default: remarkGfm },
      { default: remarkMath },
      { default: remarkRehype },
      { default: rehypeKatex },
      { default: rehypeStringify },
      { default: remarkEmoji },
      { default: rehypeHighlight }
    ] = await Promise.all([
      import('unified'),
      import('remark-parse'),
      import('remark-gfm'),
      import('remark-math'),
      import('remark-rehype'),
      import('rehype-katex'),
      import('rehype-stringify'),
      import('remark-emoji'),
      import('rehype-highlight')
    ]);

    const remarkOffsetPlugin = () => (tree, file) => {
      const walk = (node) => {
        if (node.type === 'footnoteDefinition') return; // Ignore footnotes as anchors
        if (node.position) {
          node.data = node.data || {};
          node.data.hProperties = node.data.hProperties || {};
          let start = node.position.start.offset;
          let end = node.position.end.offset;
          if (node.type === 'tableCell') {
            const rawContent = file.value.slice(node.position.start.offset, node.position.end.offset);
            const trimmedMatch = rawContent.match(/^([\s|]*)(.*?)[\s|]*$/s);
            if (trimmedMatch) {
              const leadingLength = trimmedMatch[1].length;
              start = node.position.start.offset + leadingLength;
              end = start + trimmedMatch[2].length;
            }
          } else if (node.type === 'listItem') {
            const rawContent = file.value.slice(node.position.start.offset, node.position.end.offset);
            const trimmedMatch = rawContent.match(/^([\s\-*+]*|[\s\d.]*)(.*)$/s);
            if (trimmedMatch) {
              start = node.position.start.offset + trimmedMatch[1].length;
            }
          }
          node.data.hProperties['data-offset-start'] = String(start);
          node.data.hProperties['data-offset-end'] = String(end);
          
          if (node.type === 'math') {
            node.data.hName = 'div';
            node.data.hProperties.className = [...(node.data.hProperties.className || []), 'math', 'math-display'];
          } else if (node.type === 'inlineMath') {
            node.data.hName = 'span';
            node.data.hProperties.className = [...(node.data.hProperties.className || []), 'math', 'math-inline'];
          }

          const syncableTypes = ['text', 'strong', 'emphasis', 'inlineCode', 'link', 'image', 'heading', 'paragraph', 'listItem', 'blockquote', 'code', 'tableCell', 'math', 'inlineMath'];
          if (syncableTypes.includes(node.type)) {
            if (node.type === 'code' && node.lang) {
              node.data.hProperties.className = [...(node.data.hProperties.className || []), 'language-' + node.lang];
            }
            node.data.hProperties.className = [...(node.data.hProperties.className || []), 'cursor-sync-target'];
          }
        }
        if (node.children) node.children.forEach(walk);
      };
      walk(tree);
    };

    const rehypeSyncPlugin = () => (tree) => {
      const walk = (node) => {
        if (!node.children) return;
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (child.type === 'element') {
            // Fix code blocks: Ensure pre tag has the offset attributes
            if (child.tagName === 'pre') {
              const codeNode = child.children?.find(c => c.tagName === 'code');
              if (codeNode && codeNode.properties?.['data-offset-start']) {
                child.properties = child.properties || {};
                child.properties['data-offset-start'] = codeNode.properties['data-offset-start'];
                child.properties['data-offset-end'] = codeNode.properties['data-offset-end'];
                const classes = Array.isArray(child.properties.className) ? child.properties.className : (child.properties.className ? [child.properties.className] : []);
                if (!classes.includes('cursor-sync-target')) {
                  child.properties.className = [...classes, 'cursor-sync-target'];
                }
              }
            }
            
            // Fix math and other custom blocks: Wrap any div/span that has offsets but might be replaced by subsequent plugins
            const hasOffset = child.properties?.['data-offset-start'];
            const isPotentialWrapper = child.tagName === 'div' || child.tagName === 'span';
            const isAlreadyWrapped = child.properties?.className?.includes?.('sync-wrapper');

            if (hasOffset && isPotentialWrapper && !isAlreadyWrapped) {
              const start = child.properties['data-offset-start'];
              const end = child.properties['data-offset-end'];
              const isDisplay = child.tagName === 'div' || (child.properties?.className?.includes?.('math-display'));
              
              const wrapper = {
                type: 'element',
                tagName: isDisplay ? 'div' : 'span',
                properties: {
                  'data-offset-start': start,
                  'data-offset-end': end,
                  className: ['cursor-sync-target', 'sync-wrapper', isDisplay ? 'display-wrapper' : 'inline-wrapper']
                },
                children: [child]
              };
              
              // Remove attributes from child to avoid duplication and infinite loop
              delete child.properties['data-offset-start'];
              delete child.properties['data-offset-end'];
              
              node.children[i] = wrapper;
              walk(wrapper);
              continue; 
            }
          }
          walk(child);
        }
      };
      walk(tree);
    };

    processor = unified()
      .use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkEmoji).use(remarkOffsetPlugin)
      .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeSyncPlugin).use(rehypeKatex).use(rehypeHighlight, { ignoreMissing: true }).use(rehypeStringify, { allowDangerousHtml: true });
  } catch (err) {
    console.error("Worker Unified init failed", err);
    throw err;
  }
}

function splitIntoChunks(md) {
  const chunks = [];
  // Split on H1 and H2 headers, ensuring we capture headers at the start of the string too.
  const parts = md.split(/(?=\n#{1,2}\s|^#{1,2}\s)/);
  
  let currentOffset = 0;
  for (const part of parts) {
    if (part) {
      chunks.push({ text: part, offset: currentOffset });
      currentOffset += part.length;
    }
  }
  return chunks;
}

function generateTOC(md, filePath) {
  const lines = md.split('\n');
  return lines.reduce((acc, line, index) => {
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
}

function extractDefinitions(md) {
  return md.split('\n').filter(line => line.trim().match(/^\[.+\]: .+/)).join('\n');
}

self.onmessage = async (e) => {
  const { type: msgType, md, id, filePath, generateToc: shouldGenerateToc } = e.data;
  
  if (msgType === 'init') {
    try {
      await initProcessor();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
    return;
  }

  try {
    await initProcessor();
    const startTime = performance.now();
    const chunks = splitIntoChunks(md);
    const definitions = extractDefinitions(md);
    const htmlChunks = [];
    const toc = shouldGenerateToc ? generateTOC(md, filePath) : null;

    // Cache management
    if (chunkCache.size > 200) chunkCache.clear();

    for (const chunk of chunks) {
      const cacheKey = chunk.text + definitions; 
      let html;
      if (chunkCache.has(cacheKey)) {
        html = chunkCache.get(cacheKey);
      } else {
        const result = await processor.process({ 
          value: chunk.text + '\n\n' + definitions, 
          data: { chunkOffset: 0 } 
        });
        html = String(result);
        chunkCache.set(cacheKey, html);
      }

      // Re-base relative offsets from cache to absolute offsets for this chunk
      const rebasedHtml = html.replace(/data-offset-(start|end)="(\d+)"/g, (match, type, val) => {
        return `data-offset-${type}="${parseInt(val, 10) + chunk.offset}"`;
      });
      htmlChunks.push(rebasedHtml);
    }

    self.postMessage({ 
      type: 'success', 
      html: htmlChunks.join(''), 
      toc, 
      duration: performance.now() - startTime, 
      id 
    });
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message, id });
  }
};

