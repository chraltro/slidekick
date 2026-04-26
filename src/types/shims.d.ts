declare module 'markdown-it-attrs' {
  import type MarkdownIt from 'markdown-it';
  const plugin: MarkdownIt.PluginWithOptions;
  export default plugin;
}

declare module '*.css?inline' {
  const css: string;
  export default css;
}

declare module '*?inline' {
  const value: string;
  export default value;
}
