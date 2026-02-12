"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ExternalLink, ChevronDown } from 'lucide-react';

type WikiProps = {
  wikiData: any;
};

export default function WikiNotebook({ wikiData }: WikiProps) {
  const [expanded, setExpanded] = useState(false);
  const [facts, setFacts] = useState<any | null>(null);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [factsError, setFactsError] = useState<string | null>(null);

  const pageUrl = wikiData?.content_urls?.desktop?.page || wikiData?.pageUrl || '#';
  const title = wikiData?.title;
  const lang = wikiData?.lang || wikiData?.language || 'en';
  const paragraphs = (wikiData?.extract || '').split(/\n{2,}|\r\n{2,}/);
  const first = paragraphs[0] || '';
  const full = wikiData?.extract || '';

  useEffect(() => {
    if (!title) return;
    let mounted = true;
    const fetchFacts = async () => {
      setLoadingFacts(true);
      setFactsError(null);
      try {
        const q = new URL('/api/wikidata', location.href);
        q.searchParams.set('title', title);
        q.searchParams.set('lang', String(lang || 'en'));
        const res = await fetch(q.toString());
        if (!res.ok) throw new Error(await res.text());
        const j = await res.json();
        if (!mounted) return;
        setFacts(j.facts || null);
      } catch (err: any) {
        if (!mounted) return;
        setFactsError(err?.message || 'failed');
      } finally {
        if (mounted) setLoadingFacts(false);
      }
    };
    fetchFacts();
    return () => {
      mounted = false;
    };
  }, [title, lang]);

  if (!wikiData) return null;

  return (
  <div className="p-4 lg:p-6 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-md break-words whitespace-normal overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg lg:text-xl font-semibold mb-1 leading-tight break-words">{wikiData.title}</h3>
          {wikiData.description && (
            <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 mb-2 lg:mb-3">{wikiData.description}</p>
          )}
        </div>
        {wikiData.thumbnail && (
          <div className="w-24 h-24 rounded overflow-hidden flex-shrink-0">
            <Image src={wikiData.thumbnail.source} alt={wikiData.title} width={96} height={96} unoptimized className="object-cover" />
          </div>
        )}
      </div>

      <div className="mt-2">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2 whitespace-normal break-words">{expanded ? full : first}</p>
        {full !== first && (
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'Read more'}
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex flex-col gap-1">
          <div><a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Open on Wikipedia <ExternalLink className="w-3 h-3 inline-block ml-1" /></a></div>
        </div>
        <div className="mt-3">
          {/* Only render facts header when loading OR when there are visible facts to show */}
          {loadingFacts || (facts && typeof facts === 'object' && Object.keys(facts).length > 0) ? (
            <>
              <h4 className="text-sm font-semibold mb-2">Facts</h4>
              {loadingFacts && (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-5/6" />
                </div>
              )}
              {!loadingFacts && factsError && (
                // If facts failed to load we intentionally omit the facts block per UX request
                null
              )}
              {!loadingFacts && !factsError && facts && (
                <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1 break-words whitespace-normal">
                  {Object.keys(facts).map((key) => {
                    const val = (facts as any)[key];
                    if (val == null) return null;

                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

                    // coordinates
                    if (key === 'coordinates' && val.lat && val.lon) {
                      return <div key={key}><span className="font-medium">{label}:</span> {val.lat}, {val.lon}</div>;
                    }

                    // arrays
                    if (Array.isArray(val)) {
                      const parts = val.map((v: any) => {
                        if (!v) return '';
                        if (typeof v === 'string' || typeof v === 'number') return String(v);
                        if (v.url && typeof v.url === 'string') return { text: v.label || v.file || v.url, url: v.url };
                        if (v.label) return v.label;
                        if (v.id) return v.id;
                        return JSON.stringify(v);
                      }).filter(Boolean);
                      if (parts.length === 0) return null;
                      return (
                        <div key={key}>
                          <span className="font-medium">{label}:</span>{' '}
                          {parts.map((p: any, i: number) => (
                            typeof p === 'string'
                              ? (
                                /^https?:\/\//i.test(p)
                                  ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-words max-w-full">{p}{i < parts.length - 1 ? ', ' : ''}</a>
                                  : <span key={i}>{p}{i < parts.length - 1 ? ', ' : ''}</span>
                              )
                              : (
                                p.wikidataUrl
                                  ? <a key={i} href={p.wikidataUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-words max-w-full">{p.label || p.id}{i < parts.length - 1 ? ', ' : ''}</a>
                                  : <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-words max-w-full">{p.text}{i < parts.length - 1 ? ', ' : ''}</a>
                              )
                          ))}
                        </div>
                      );
                    }

                    // numbers
                    if (typeof val === 'number') return <div key={key}><span className="font-medium">{label}:</span> {val.toLocaleString()}</div>;

                    // objects with label or url
            if (typeof val === 'object') {
              if (val.url && typeof val.url === 'string') return <div key={key}><span className="font-medium">{label}:</span> <a href={val.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-words max-w-full">{val.label || val.url}</a></div>;
                      if (val.label || val.id) return <div key={key}><span className="font-medium">{label}:</span> {val.label || val.id}</div>;
                      return <div key={key}><span className="font-medium">{label}:</span> {JSON.stringify(val)}</div>;
                    }

                    // fallback: render http/https as links
                    if (typeof val === 'string' && /^https?:\/\//i.test(val)) {
                      return <div key={key}><span className="font-medium">{label}:</span> <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-words max-w-full">{val}</a></div>;
                    }
                    return <div key={key}><span className="font-medium">{label}:</span> {String(val)}</div>;
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
