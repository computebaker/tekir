"use client";
/* eslint-disable react-hooks/rules-of-hooks */

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import { useAuth } from "@/components/auth-provider";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarkdownMessage } from "@/components/markdown-message";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2, MoreHorizontal } from "lucide-react";

type ChatRecord = {
  _id: Id<"chats">;
  title?: string;
  messages: any[];
  updatedAt: number;
};

export default function ChatPage() {
  const { user, status } = useAuth();
  const [chatId, setChatId] = useState<Id<"chats"> | null>(null);
  const [model, setModel] = useState<string>('openai/gpt-4o-mini');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isNaming, setIsNaming] = useState(false);

  const userId = user?.id as unknown as Id<"users"> | undefined;
  const chats = useQuery(api.chats.list, userId ? { userId, limit: 50 } : "skip") as ChatRecord[] | undefined;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const createChat = useMutation(api.chats.create);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const appendMessages = useMutation(api.chats.appendMessages);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const renameChat = useMutation(api.chats.rename);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updateMessage = useMutation(api.chats.updateMessage);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const removeChat = useMutation(api.chats.remove);
  const estimateTokens = (val: string) => Math.ceil((val ?? '').length / 4);

  const [editingId, setEditingId] = useState<Id<"chats"> | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading,
    stop,
    reload,
  } = useChat({
    api: "/api/chat",
    id: chatId || undefined,
    body: { model },
    onFinish: async (m, extras: any) => {
      if (!userId) return;
      const convMsg = {
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: Date.now(),
        model,
      };
      const usage = extras?.usage || (m as any)?.usage;
      if (!chatId) {
        const firstUser = messages[0]
          ? { id: messages[0].id, role: messages[0].role as any, content: messages[0].content, createdAt: Date.now(), model }
          : undefined;
        const id = await createChat({ userId, title: messages[0]?.content?.slice?.(0, 60), model, firstMessages: [firstUser, convMsg].filter(Boolean) as any });
        setChatId(id);

        // Auto-name chat from first user message
        const firstText = (messages[0]?.content as any) ?? '';
        if (firstText && typeof firstText === 'string') {
          setIsNaming(true);
          try {
            const res = await fetch('/api/chat/name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: firstText, model }) });
            const data = await res.json();
            if (data?.title) {
              await renameChat({ id, userId, title: data.title } as any);
            }
          } catch {}
          finally { setIsNaming(false); }
        }
        // Persist usage to the just-created assistant message
        if (usage?.completionTokens) {
          await updateMessage({ id, userId, messageId: m.id, patch: { tokensOut: usage.completionTokens, tokensIn: usage.promptTokens } } as any);
        } else {
          const estOut = estimateTokens(typeof m.content === 'string' ? (m.content as string) : JSON.stringify(m.content));
          await updateMessage({ id, userId, messageId: m.id, patch: { tokensOut: estOut } } as any);
        }
      } else {
        await appendMessages({ id: chatId, userId, messages: [convMsg] });
        if (usage?.completionTokens) {
          await updateMessage({ id: chatId, userId, messageId: m.id, patch: { tokensOut: usage.completionTokens, tokensIn: usage.promptTokens } } as any);
        } else {
          const estOut = estimateTokens(typeof m.content === 'string' ? (m.content as string) : JSON.stringify(m.content));
          await updateMessage({ id: chatId, userId, messageId: m.id, patch: { tokensOut: estOut } } as any);
        }
      }
    },
  });

  // When user selects a previous chat, load its messages
  const loadChat = (chat: ChatRecord) => {
    setChatId(chat._id);
    setMessages(
      chat.messages.map((m: any) => ({ id: m.id, role: m.role as any, content: m.content }))
    );
  };

  const startNew = () => {
    setChatId(null);
    setMessages([]);
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-6 max-w-lg text-center space-y-4">
          <h1 className="text-xl font-semibold">Sign in to chat</h1>
          <p className="text-sm text-muted-foreground">You need an account to use Tekir Chat.</p>
          <div className="flex justify-center gap-3">
            <Link href="/auth/signin" className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium">Sign in</Link>
            <Link href="/auth/signup" className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90 text-sm font-medium">Create account</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0 md:w-16'} transition-all duration-200 overflow-hidden border-r bg-muted/20 hidden md:flex flex-col`}>
        <div className="p-3 flex items-center justify-between">
          <div className="font-semibold">Your chats</div>
          <div className="flex gap-2">
            <Button size="sm" variant="muted" onClick={() => setSidebarOpen((s)=>!s)}>{sidebarOpen ? <ChevronLeft className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}</Button>
            <Button size="sm" onClick={startNew}>New</Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats?.length ? (
            <ul className="px-2 pb-2 space-y-1">
              {chats.map((c) => (
                <li key={c._id} className="group">
                  {editingId === c._id ? (
                    <div className="px-3 py-2">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && editingTitle.trim()) {
                            await renameChat({ id: c._id, userId: userId!, title: editingTitle.trim() } as any);
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="h-8 text-sm"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={async () => { if (editingTitle.trim()) { await renameChat({ id: c._id, userId: userId!, title: editingTitle.trim() } as any); setEditingId(null);} }}>Save</Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className={`w-full rounded hover:bg-muted ${chatId === c._id ? 'bg-muted' : ''} flex items-start justify-between`}>
                      <button
                        className="flex-1 text-left px-3 py-2"
                        onClick={() => loadChat(c)}
                      >
                        <div className="truncate text-sm font-medium">{c.title || 'Untitled chat'}</div>
                        <div className="text-xs text-muted-foreground">{new Date(c.updatedAt).toLocaleString()}</div>
                      </button>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 pt-2 flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditingId(c._id); setEditingTitle(c.title || ''); }}
                          title="Rename"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={async () => {
                            await removeChat({ id: c._id, userId: userId! } as any);
                            if (chatId === c._id) {
                              startNew();
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">No chats yet</div>
          )}
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <h1 className="text-2xl font-semibold mb-2">What’s on your mind?</h1>
                <p className="text-muted-foreground">Ask anything and I’ll help you think it through.</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${m.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-muted text-foreground'}`}>
                    {m.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className="prose prose-invert max-w-none" title={`Model: ${model}`}>
                    <MarkdownMessage content={m.content as any} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            // persist user message immediately
            const last = input.trim();
            if (last && userId) {
              const userMsg = { id: Math.random().toString(36).slice(2), role: 'user', content: last, createdAt: Date.now(), model, tokensIn: estimateTokens(last) };
              if (!chatId) {
                const id = await createChat({ userId, title: last.slice(0, 60), model, firstMessages: [userMsg] as any });
                setChatId(id);
              } else {
                await appendMessages({ id: chatId, userId, messages: [userMsg] as any });
              }
            }
            handleSubmit(e);
          }}
          className="border-t p-3 sm:p-4"
        >
          <div className="mx-auto max-w-3xl flex gap-2">
            <select value={model} onChange={(e)=>setModel(e.target.value)} className="h-9 px-2 rounded-md border bg-background text-sm">
              <optgroup label="OpenAI via OpenRouter">
                <option value="openai/gpt-4o-mini">GPT-4o mini</option>
                <option value="openai/gpt-4o">GPT-4o</option>
              </optgroup>
              <optgroup label="Google">
                <option value="google/gemini-1.5-flash-8b">Gemini 1.5 Flash 8B</option>
                <option value="google/gemini-1.5-pro">Gemini 1.5 Pro</option>
              </optgroup>
              <optgroup label="Mistral">
                <option value="mistralai/mistral-small">Mistral Small</option>
                <option value="mistralai/mixtral-8x7b-instruct">Mixtral 8x7B</option>
              </optgroup>
              <optgroup label="Meta Llama">
                <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
                <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
              </optgroup>
            </select>
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask me anything…"
            />
            <Button type="submit" disabled={isLoading}>Send</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
