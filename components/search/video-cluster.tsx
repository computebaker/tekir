import { Video, ChevronDown, Search } from "lucide-react";
import Image from "next/image";

interface VideoResult {
  title?: string;
  name?: string;
  description?: string;
  url?: string;
  content_url?: string;
  thumbnail?: string | { src?: string; source?: string; original?: string };
  site?: string;
  source?: string;
}

interface VideoClusterProps {
  videoResults: VideoResult[];
  isOpen: boolean;
  onToggle: () => void;
  description: string;
  videoFallback: string;
}

export function VideoCluster({ videoResults, isOpen, onToggle, description, videoFallback }: VideoClusterProps) {
  const resolveImageSrc = (t: string | { src?: string; source?: string; original?: string } | null | undefined): string | null => {
    if (!t) return null;
    if (typeof t === 'string') return t;
    if ((t as any).src) return (t as any).src;
    if ((t as any).source) return (t as any).source;
    if ((t as any).original) return (t as any).original;
    return null;
  };

  if (videoResults.length === 0) return null;

  return (
    <div className="mt-8 mb-8 blurry-outline cluster-enter">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center justify-between"
        aria-expanded={isOpen}
        aria-controls="videos-inline-cluster"
      >
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm text-muted-foreground mb-0 font-medium">Videos</h3>
        </div>
        <ChevronDown className={`ml-2 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
      </button>
      {!isOpen && (
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      )}
      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4 cluster-enter">
          {videoResults.slice(0, 4).map((v, idx) => (
            <a key={`video-${idx}`} href={v.url || v.content_url || '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start group hover:shadow-md p-2 rounded-lg bg-card border border-border transition-colors">
              <div className="w-32 h-20 flex-shrink-0 overflow-hidden rounded-md bg-muted relative">
                {resolveImageSrc(v.thumbnail) ? (
                  <Image src={resolveImageSrc(v.thumbnail)!} alt={v.title || videoFallback} fill unoptimized className="object-cover group-hover:scale-105 transition-transform" sizes="128px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Search className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold line-clamp-2 mb-1 group-hover:text-primary">{v.title || v.name}</h4>
                {v.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{v.description}</p>}
                <div className="text-xs text-muted-foreground">{v.site || v.source || ''}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
