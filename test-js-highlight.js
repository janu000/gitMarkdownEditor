import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeHighlight, { ignoreMissing: true })
  .use(rehypeStringify);

const md = "```javascript\nfunction greet(name) {\n  console.log(\`Hello, \${name}! Welcome to GME.\`);\n}\ngreet('Developer');\n```";
const result = await processor.process(md);
console.log(String(result));
