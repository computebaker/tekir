"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircleMore, Check, X } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

interface Props {
  query?: string;
  results?: any[];
  wikiData?: any;
  suggestions?: any[];
  aiResponse?: string | null;
  searchEngine?: string;
  searchType?: string;
}

export default function FloatingFeedback({ query, results, wikiData, suggestions, aiResponse, searchEngine, searchType }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const payload = () => ({
    query,
    results,
    wikipedia: wikiData,
    autocomplete: suggestions,
    karakulak: aiResponse,
    searchEngine,
    searchType,
    // Include userId if logged in so admin can see username/email in feedback list
    userId: user?.id,
    liked,
    comment,
  });

  const handleSubmit = async () => {
    if (liked === null) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => {
          setOpen(false);
          setTimeout(() => { setSent(false); setLiked(null); setComment(''); }, 260);
        }, 1400); // match success-fade duration (1400ms)
      } else {
        console.error('Feedback failed', await res.text());
        alert('Failed to send feedback.');
      }
    } catch (err) {
      console.error('Feedback error', err);
      alert('Failed to send feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed right-4 bottom-6 z-50">
      <div className="flex flex-col items-end gap-2">
        <div
          className={`origin-bottom-right transform transition-all duration-200 ease-out ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}
          aria-hidden={!open}
          style={open ? { animation: 'tekir-feedback-pop 260ms cubic-bezier(.2,.9,.2,1)' } : undefined}
        >
          <style>{`
            @keyframes tekir-feedback-pop {
              0% { transform: translateY(6px) scale(0.92); opacity: 0 }
              60% { transform: translateY(-6px) scale(1.06); opacity: 1 }
              100% { transform: translateY(0) scale(1); opacity: 1 }
            }

            @keyframes tekir-feedback-check {
              0% { transform: scale(0.6); opacity: 0 }
              60% { transform: scale(1.12); opacity: 1 }
              100% { transform: scale(1); opacity: 1 }
            }

            @keyframes tekir-feedback-success-fade {
              0% { opacity: 1 }
              80% { opacity: 1 }
              100% { opacity: 0 }
            }
          `}</style>

          {sent ? (
            <div className="w-80 p-6 rounded-xl shadow-lg bg-card border border-border text-sm text-foreground flex flex-col items-center gap-2" role="status" aria-live="polite" style={{ animation: 'tekir-feedback-success-fade 1400ms ease-in forwards' }}>
              <Check className="w-12 h-12 text-green-600" style={{ animation: 'tekir-feedback-check 360ms cubic-bezier(.2,.9,.2,1)' }} />
              <div className="font-semibold">Feedback sent</div>
            </div>
          ) : (
            <div className="w-80 p-4 rounded-xl shadow-lg bg-card border border-border text-sm text-foreground">
              <div className="mb-2 font-semibold">Was this search helpful?</div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setLiked(true)}
                  className={`flex-1 px-3 py-2 rounded-md transition-colors duration-150 ${liked === true ? 'bg-green-600 text-white' : 'bg-background border border-border text-foreground'}`}
                >
                  <Check className="w-4 h-4 inline mr-2" />
                  Yes
                </button>
                <button
                  onClick={() => setLiked(false)}
                  className={`flex-1 px-3 py-2 rounded-md transition-colors duration-150 ${liked === false ? 'bg-red-600 text-white' : 'bg-background border border-border text-foreground'}`}
                >
                  <X className="w-4 h-4 inline mr-2" />
                  No
                </button>
              </div>
              <div className="mb-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add more information..."
                  className="w-full min-h-[72px] p-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => { setOpen(false); setLiked(null); setComment(''); }}
                  className="px-3 py-1 rounded-md text-sm"
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={liked === null || submitting}>
                  {submitting ? 'Sending...' : sent ? 'Sent' : 'Submit'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Layered circular outlines: outer black -> white -> main black button */}
        <div className="rounded-full p-0.5 bg-black shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
          <div className="rounded-full p-[2px] bg-white">
            <button
              onClick={() => setOpen(v => !v)}
              title="Send feedback"
              className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white shadow-xl"
            >
              <MessageCircleMore className="w-4 h-4" />
              <span className="hidden sm:inline">Feedback</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
