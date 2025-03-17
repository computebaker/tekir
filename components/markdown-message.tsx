import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { cn } from "@/lib/utils";

// Add this plugin to handle line breaks
import remarkBreaks from "remark-breaks";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      className={cn("prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap", className)}
      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} // Add remarkBreaks plugin
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        p({ children }) {
          return <p className="whitespace-pre-wrap">{children}</p>;
        },
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          return match ? (
            <SyntaxHighlighter
              // @ts-ignore
              style={coldarkDark as Record<string, React.CSSProperties>}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        // Override table to add horizontal scroll for mobile
        table({ children }) {
          return (
            <div className="overflow-auto w-full">
              <table className="border-collapse border border-border">{children}</table>
            </div>
          );
        },
        // Style links properly
        a({ children, href }) {
          return (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline"
            >
              {children}
            </a>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
