import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

const remarkOffsetPlugin = () => (tree, file) => {
  const walk = (node) => {
    if (node.type === 'footnoteDefinition') return; 
    if (node.position) {
      node.data = node.data || {};
      node.data.hProperties = node.data.hProperties || {};
      let start = node.position.start.offset;
      let end = node.position.end.offset;
      node.data.hProperties['data-offset-start'] = String(start);
      node.data.hProperties['data-offset-end'] = String(end);

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
      }
      walk(child);
    }
  };
  walk(tree);
};

const processor = unified()
  .use(remarkParse)
  .use(remarkOffsetPlugin)
  .use(remarkRehype)
  .use(rehypeSyncPlugin)
  .use(rehypeHighlight, { ignoreMissing: true })
  .use(rehypeStringify);

const md = "```javascript\nfunction test() {\n  console.log('hello');\n}\n```";
const result = await processor.process(md);
console.log(String(result));
