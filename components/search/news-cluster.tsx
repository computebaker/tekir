import { Newspaper, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface NewsResult {
  title: string;
  description: string;
  url: string;
  source: string;
  age: string;
  thumbnail?: string;
  favicon?: string;
}

interface NewsClusterProps {
  newsResults: NewsResult[];
  isOpen: boolean;
  onToggle: () => void;
  description: string;
}

export function NewsCluster({ newsResults, isOpen, onToggle, description }: NewsClusterProps) {
  const resolveImageSrc = (t: string | { src?: string; source?: string; original?: string } | null | undefined): string | null => {
    if (!t) return null;
    if (typeof t === 'string') return t;
    if ((t as any).src) return (t as any).src;
    if ((t as any).source) return (t as any).source;
    if ((t as any).original) return (t as any).original;
    return null;
  };

  if (newsResults.length === 0) return null;

  return (
    <div className="mt-8 mb-8 blurry-outline cluster-enter">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center justify-between"
        aria-expanded={isOpen}
        aria-controls="news-inline-cluster"
      >
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm mb-0 font-medium text-muted-foreground">News</h3>
        </div>
        <ChevronDown className={`ml-2 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
      </button>
      {!isOpen && (
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      )}
      {isOpen && (
        <div className="relative mt-4 mb-4 blurry-outline cluster-enter">
          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {newsResults.slice(0, 4).map((article, idx) => (
                <a key={`news-${idx}`} href={article.url || '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start group hover:shadow-md p-2 rounded-lg bg-card border border-border transition-colors">
                  <div className="w-28 h-16 flex-shrink-0 overflow-hidden rounded-md bg-muted relative">
                    {resolveImageSrc(article.thumbnail) ? (
                      <Image src={resolveImageSrc(article.thumbnail)!} alt={article.title} fill unoptimized className="object-cover group-hover:scale-105 transition-transform" sizes="112px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Newspaper className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold line-clamp-2 mb-1 group-hover:text-primary">{article.title}</h4>
                    {article.description && <p className="text-sm text-muted-foreground line-clamp-2">{article.description}</p>}
                    <div className="text-xs text-muted-foreground mt-2">{(article.source || '')}{article.age ? ` • ${article.age}` : ''}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
