"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bot, ChevronDown, User, FileCode, MoreVertical, Edit, Trash, Plus, ArrowRight } from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// Add new ChatSession interface
interface ChatSession {
  id: string;
  model: ModelOption;
  messages: Message[];
  createdAt: number;
  locked: boolean;
  customTitle?: string;
}

export default function ChatPage() {
  // Replace states:
  // Remove: const [messages, setMessages] = useState<Message[]>([]);
  // Remove: const [selectedModel, setSelectedModel] = useState<ModelOption>(...);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>("");

  // Add new state for context menu
  const [contextMenuOpen, setContextMenuOpen] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuChatId, setContextMenuChatId] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [newChatTitle, setNewChatTitle] = useState<string>("");
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Add a state variable for mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem("tekirChats");
    if (stored) {
      const arr: ChatSession[] = JSON.parse(stored);
      setChats(arr); // load stored chats
      setCurrentChatId(arr.length ? arr[arr.length - 1].id : "");
    } else {
      // Don't auto-create a chat; just initialize with empty array
      setChats([]);
    }
  }, []);
  const currentChat = chats.find(chat => chat.id === currentChatId) || null;
  const [input, setInput] = useState<string>("");

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState<boolean>(false);

  // Helper: save chats in localStorage
  const saveChats = (updatedChats: ChatSession[]) => {
    setChats(updatedChats);
    localStorage.setItem("tekirChats", JSON.stringify(updatedChats));
  };

  // Define the default model (Llama)
  const defaultModel: ModelOption = {
    id: "llama-3-1-80b",
    name: "Llama 3.1 80B",
    description: "Meta's largest open-source model",
    icon: "/meta.png"
  };

  // Create new chat session with default model
  const handleNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      model: defaultModel,
      messages: [],
      createdAt: Date.now(),
      locked: false,
    };
    const updatedChats = [...chats, newChat];
    saveChats(updatedChats);
    setCurrentChatId(newChat.id);
  };

  const models: ModelOption[] = [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o mini",
      description: "Fast and efficient model by OpenAI",
      icon: "/openai.png"
    },
    {
      id: "llama-3-1-80b",
      name: "Llama 3.1 80B",
      description: "Meta's largest open-source model",
      icon: "/meta.png"
    }
  ];
  
  // Add a new useEffect to handle query parameters
  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const queryInput = searchParams.get('q');
      
      if (queryInput && !isLoading) {
        // Create a new chat if none exists
        const newChat: ChatSession = {
          id: Date.now().toString(),
          model: defaultModel,
          messages: [],
          createdAt: Date.now(),
          locked: false,
        };
        
        const updatedChats = [...chats, newChat];
        saveChats(updatedChats);
        
        // Don't set input in the text field
        // Instead directly create and send the user message
        const userMessage: Message = { role: "user", content: queryInput };
        const updatedChat = { 
          ...newChat, 
          messages: [userMessage],
          locked: true,  // Lock chat since this is the first message
        };
        
        const updatedChatsWithMessage = updatedChats.map(chat => 
          chat.id === newChat.id ? updatedChat : chat
        );
        saveChats(updatedChatsWithMessage);
        setCurrentChatId(newChat.id);
        
        // Remove the query parameter from URL without refreshing
        window.history.replaceState({}, '', '/chat');
        
        // Send the message to API
        setIsLoading(true);
        setError(null);
        
        // Create a function to handle the API call (similar to handleSendMessage but without UI updates)
        (async () => {
          try {
            // Add placeholder for assistant's reply
            const placeholder: Message = { role: "assistant", content: "" };
            const chatWithPlaceholder = {
              ...updatedChat,
              messages: [...updatedChat.messages, placeholder],
            };
            const updatedChatsPlaceholder = updatedChatsWithMessage.map(chat =>
              chat.id === newChat.id ? chatWithPlaceholder : chat
            );
            saveChats(updatedChatsPlaceholder);
            
            const response = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: chatWithPlaceholder.messages,
                model: updatedChat.model.id 
              })
            });
            
            if (response.status === 429) {
              const errorData = await response.json();
              throw new Error(`Rate limit exceeded: ${errorData.message}`);
            }
            if (!response.ok) {
              throw new Error(`API request failed with status ${response.status}`);
            }
            if (!response.body) {
              throw new Error("Response body is null");
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let assistantResponse = "";
            while (!done) {
              const { value, done: doneReading } = await reader.read();
              done = doneReading;
              if (value) {
                const chunk = decoder.decode(value, { stream: true });
                assistantResponse += chunk;
                
                // Update both state and localStorage
                const updatedChats = chats.map(chat => {
                  if (chat.id === newChat.id) {
                    const newMessages = [...chat.messages];
                    newMessages[newMessages.length - 1] = { role: "assistant", content: assistantResponse };
                    return { ...chat, messages: newMessages };
                  }
                  return chat;
                });
                saveChats(updatedChats); // This updates both state and localStorage
              }
            }
          } catch (err) {
            console.error("Error sending message:", err);
            setError(err instanceof Error ? err.message : "Failed to send message");
            // Remove the placeholder on error without removing old messages
            setChats(prevChats =>
              prevChats.map(chat => {
                if (chat.id === newChat.id) {
                  return { ...chat, messages: chat.messages.slice(0, chat.messages.length - 1) };
                }
                return chat;
              })
            );
          } finally {
            setIsLoading(false);
          }
        })();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.length]); // Run only when chats length changes to prevent infinite loops

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Handle clicks outside model dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && 
          !modelDropdownRef.current.contains(event.target as Node) && 
          modelDropdownOpen) {
        setModelDropdownOpen(false);
      }
      
      // Close context menu if open
      if (contextMenuRef.current && 
          !contextMenuRef.current.contains(event.target as Node) && 
          contextMenuOpen) {
        setContextMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelDropdownOpen, contextMenuOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages]);

  // Update document title
  useEffect(() => {
    document.title = "Tekir Chat - AI Assistant";
  }, []);

  // Focus the rename input when it becomes visible
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [isRenaming]);

  // Modify model selector so it only works when chat isn’t locked
  const handleModelSelect = (model: ModelOption) => {
    if (currentChat && !currentChat.locked) {
      const updatedChat = { ...currentChat, model };
      const updatedChats = chats.map(chat => chat.id === currentChat.id ? updatedChat : chat);
      saveChats(updatedChats);
    }
    setModelDropdownOpen(false);
  };

  // Fix handleSendMessage to create a new chat if none exists
const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim()) return;

  // If no chat is selected, create a new one first
  if (!currentChat) {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      model: defaultModel,
      messages: [],
      createdAt: Date.now(),
      locked: false,
    };
    
    const updatedChats = [...chats, newChat];
    saveChats(updatedChats);
    setCurrentChatId(newChat.id);
    
    // Continue with sending the message by calling handleSendMessage again
    // after the state has been updated
    setTimeout(() => {
      handleSendMessage(e);
    }, 0);
    return;
  }
  
  // Rest of the original function for sending a message
  const userMessage: Message = { role: "user", content: input };
  // Append user message and lock chat if it's the first prompt
  const updatedChat = { 
    ...currentChat, 
    messages: [...currentChat.messages, userMessage],
    locked: currentChat.messages.length === 0 ? true : currentChat.locked,
  };
  const updatedChats = chats.map(chat => chat.id === currentChat.id ? updatedChat : chat);
  saveChats(updatedChats);
  setInput("");
  setIsLoading(true);
  setError(null);
  
  try {
    // Add placeholder for assistant's reply
    const placeholder: Message = { role: "assistant", content: "" };
    const chatWithPlaceholder = {
      ...updatedChat,
      messages: [...updatedChat.messages, placeholder],
    };
    const updatedChatsPlaceholder = chats.map(chat =>
      chat.id === currentChat.id ? chatWithPlaceholder : chat
    );
    saveChats(updatedChatsPlaceholder);
    
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chatWithPlaceholder.messages,
        model: updatedChat.model.id 
      })
    });
    
    if (response.status === 429) {
      const errorData = await response.json();
      throw new Error(`Rate limit exceeded: ${errorData.message}`);
    }
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    if (!response.body) {
      throw new Error("Response body is null");
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let assistantResponse = "";
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        assistantResponse += chunk;
        
        // Update both state and localStorage with each chunk
        const updatedChats = chats.map(chat => {
          if(chat.id === currentChat.id) {
            const newMessages = [...chat.messages];
            newMessages[newMessages.length - 1] = { role: "assistant", content: assistantResponse };
            return { ...chat, messages: newMessages };
          }
          return chat;
        });
        saveChats(updatedChats); // This updates both state and localStorage
      }
    }
  } catch (err) {
    console.error("Error sending message:", err);
    setError(err instanceof Error ? err.message : "Failed to send message");
    // Remove the placeholder on error without removing old messages
    setChats(prevChats =>
      prevChats.map(chat => {
        if (chat.id === currentChat.id) {
          return { ...chat, messages: chat.messages.slice(0, chat.messages.length - 1) };
        }
        return chat;
      })
    );
  } finally {
    setIsLoading(false);
  }
};

  // Handle text input resize and submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Replace your helper function with the following:
  const escapeInlineMath = (text: string): string => {
    // If the text is enclosed in $...$, assume it is a valid math block.
    if (/^\$.*\$$/.test(text.trim())) {
      return text;
    }
    // Otherwise, escape $ when immediately followed by a digit (optionally preceded by whitespace)
    return text.replace(/(\s?)\$(\d)/g, '$1\\$$2');
  };

  // Handle opening context menu
  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      // Get the first user message as default title or "Untitled Chat" if none
      const title = chat.messages.length > 0
        ? chat.messages[0].role === "user" 
          ? chat.messages[0].content 
          : "Untitled Chat"
        : "Untitled Chat";
      
      setNewChatTitle(title);
      setContextMenuChatId(chatId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuOpen(true);
      setIsRenaming(false);
    }
  };

  // Handle chat deletion
  const deleteChat = (chatId: string) => {
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    saveChats(updatedChats);
    
    // If we're deleting the current chat, switch to the most recent one
    if (chatId === currentChatId) {
      setCurrentChatId(updatedChats.length > 0 ? updatedChats[updatedChats.length - 1].id : "");
    }
    
    setContextMenuOpen(false);
  };

  // Start renaming a chat
  const startRenaming = () => {
    setIsRenaming(true);
  };

  // Save the new chat title (store in custom title field)
  const saveNewTitle = () => {
    const updatedChats = chats.map(chat => 
      chat.id === contextMenuChatId 
        ? { ...chat, customTitle: newChatTitle } 
        : chat
    );
    saveChats(updatedChats);
    setIsRenaming(false);
    setContextMenuOpen(false);
  };

  // Handle enter and escape keys in rename input
  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNewTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsRenaming(false);
      setContextMenuOpen(false);
    }
  };

  // Helper function to categorize a chat by its creation date
  const getChatDateCategory = (timestamp: number): string => {
    const now = new Date();
    const chatDate = new Date(timestamp);
    
    // Today: same day
    if (chatDate.toDateString() === now.toDateString()) {
      return "Today";
    }
    
    // Last 7 days: within the last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    if (chatDate >= oneWeekAgo) {
      return "Last 7 days";
    }
    
    // Last 30 days: within the last month
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);
    if (chatDate >= oneMonthAgo) {
      return "Last 30 days";
    }
    
    // Anything older
    return "Older";
  };
  
  // Function to group chats by date category
  const getChatsByDateCategory = () => {
    const chatsByCategory: Record<string, ChatSession[]> = {
      "Today": [],
      "Last 7 days": [],
      "Last 30 days": [],
      "Older": []
    };
    
    // Sort chats by date from newest to oldest before categorizing
    const sortedChats = [...chats].sort((a, b) => b.createdAt - a.createdAt);
    
    for (const chat of sortedChats) {
      const category = getChatDateCategory(chat.createdAt);
      chatsByCategory[category].push(chat);
    }
    
    return chatsByCategory;
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Header moved to the top, spanning full width */}
      <header className="fixed top-0 z-10 bg-background border-b border-border w-full">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/tekir.png" alt="Tekir Logo" width={32} height={32} />
            </Link>
            {/* Mobile menu toggle button */}
            <button 
              className="md:hidden block p-2 rounded focus:outline-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {/* Simple hamburger icon */}
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          {/* Single model selector that works with or without a selected chat */}
          <div className="relative" ref={modelDropdownRef}>
            <button
              onClick={() => {
                // Allow model selection only if no chat or if chat isn't locked
                if (!currentChat || !currentChat.locked) {
                  setModelDropdownOpen(!modelDropdownOpen);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted transition-colors ${currentChat?.locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <Image 
                src={(currentChat?.model || defaultModel).icon} 
                alt={(currentChat?.model || defaultModel).name} 
                width={20} 
                height={20} 
                className="rounded"
              />
              <span>{(currentChat?.model || defaultModel).name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {modelDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg bg-background border border-border shadow-lg z-10">
                <div className="p-1">
                  {models.map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors ${(currentChat?.model || defaultModel).id === model.id ? 'bg-muted' : ''}`}
                    >
                      <Image 
                        src={model.icon} 
                        alt={model.name} 
                        width={20} 
                        height={20} 
                        className="rounded" 
                      />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground text-left">{model.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Remove the duplicate model selector that was here */}
        </div>
      </header>
      
      {/* Add padding-top to account for the fixed header */}
      <div className="flex w-full mt-[61px]">
        {/* Wrap aside with conditional visibility for mobile */}
        <div className={`${mobileMenuOpen ? "block fixed md:static z-20 bg-background h-[calc(100vh-61px)]" : "hidden"} md:block border-r border-border`}>
          <aside className="w-64 h-full p-4 overflow-y-auto">
            <button
              onClick={() => {
                handleNewChat();
                setMobileMenuOpen(false); // Close mobile menu after creating a new chat
              }}
              className="w-full mb-4 px-3 py-2 rounded bg-primary text-primary-foreground flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
            
            {/* Updated chat list with date categories */}
            <div className="space-y-6">
              {Object.entries(getChatsByDateCategory()).map(([category, categoryChats]) => 
                categoryChats.length > 0 ? (
                  <div key={category}>
                    <h3 className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-2 px-1">{category}</h3>
                    <div className="space-y-1">
                      {categoryChats.map(chat => {
                        const title = chat.customTitle || (chat.messages.length > 0
                          ? chat.messages[0].role === "user" 
                            ? chat.messages[0].content 
                            : "Untitled Chat"
                          : "Untitled Chat");
                        
                        return (
                          <button
                            key={chat.id}
                            onClick={() => {
                              setCurrentChatId(chat.id);
                              setMobileMenuOpen(false);
                            }}
                            onContextMenu={(e) => handleContextMenu(e, chat.id)}
                            className={`w-full text-left px-3 py-2 rounded hover:bg-muted ${chat.id === currentChatId ? "bg-muted" : ""} group flex items-center justify-between`}
                          >
                            <span className="truncate flex-grow">{title.length > 20 ? title.substring(0, 20) + "..." : title}</span>
                            <button
                              className="p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 md:block hidden"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContextMenu(e, chat.id);
                              }}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null
              )}
            </div>

            {/* Context Menu */}
            {contextMenuOpen && (
              <div 
                ref={contextMenuRef}
                className="fixed bg-background border border-border rounded-md shadow-md py-1 z-50"
                style={{ 
                  top: contextMenuPosition.y, 
                  left: contextMenuPosition.x 
                }}
              >
                {isRenaming ? (
                  <div className="p-2 min-w-[180px]">
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      className="w-full px-2 py-1 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                      placeholder="Enter chat name"
                    />
                    <div className="flex justify-end mt-2">
                      <button 
                        onClick={() => setIsRenaming(false)} 
                        className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground mr-2"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={saveNewTitle} 
                        className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        startRenaming();
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm hover:bg-muted text-left"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Rename
                    </button>
                    <button
                      onClick={() => deleteChat(contextMenuChatId)}
                      className="flex items-center w-full px-3 py-2 text-sm hover:bg-muted text-red-500 text-left"
                    >
                      <Trash className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
        
        <div className="flex-grow flex flex-col">
          {/* Main chat area - adjust the height calculation to remove extra space */}
          <main className="flex flex-col h-[calc(100vh-61px)] max-w-5xl mx-auto w-full p-4 md:p-8">
            {chats.length === 0 ? (
              // Updated welcome screen for users with no chats
              <div className="flex-grow overflow-y-auto flex flex-col items-center justify-center text-center p-8">
                <Image src="/tekir.png" alt="Tekir Logo" width={80} height={80} className="mb-4" />
                <h2 className="text-3xl font-bold mb-3">Welcome to Tekir Chat</h2>
                <p className="text-muted-foreground max-w-lg mb-6">
                  The open source, fast and privacy focused AI chatbot app that runs right in your browser.
                </p>
                <div className="bg-primary/5 rounded-lg p-6 max-w-md border border-border">
                  <p className="mb-4">Start your conversation by creating a new chat</p>
                  <button
                    onClick={handleNewChat}
                    className="px-4 py-2 rounded bg-primary text-primary-foreground flex items-center justify-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Chat</span>
                  </button>
                </div>
              </div>
            ) : currentChat && currentChat.messages.length === 0 ? (
              // Updated empty chat screen with tekir-down.png icon
              <div className="flex-grow flex flex-col items-center justify-center text-center space-y-6">
                <Image src="/tekir-down.png" alt="Tekir AI" width={60} height={60} />
                <h2 className="text-2xl font-bold">How can I help you?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
                  {["Tell me about quantum computing", 
                    "Write a poem about the night sky", 
                    "Explain how blockchain works",
                    "Explain the open source world"].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }}
                      className="p-3 rounded-lg border border-border bg-background hover:bg-muted text-sm text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : currentChat ? (
              currentChat.messages.length === 0 ? (
                <div className="flex-grow flex items-center justify-center text-center">
                  <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="flex-grow overflow-y-auto mb-4 space-y-6 pr-1">
                  {currentChat.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] md:max-w-[70%] rounded-lg p-4 ${ message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted" }`}
                      >
                        <div className="flex items-center mb-2">
                          <div className="p-1.5 rounded-full bg-background/10">
                            {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                          <div className="ml-2 font-medium">
                            {message.role === "user" ? "You" : "Tekir AI"}
                          </div>
                        </div>
                        {message.content ? (
                          <MarkdownMessage 
                            content={message.role === "assistant" 
                              ? escapeInlineMath(message.content) 
                              : message.content} 
                            className={message.role === "user" ? "text-primary-foreground" : ""} 
                          />
                        ) : (message.role === "assistant" && isLoading && (
                          <span className="inline-block w-5 h-5 relative">
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="animate-ping absolute h-3 w-3 rounded-full bg-gray-400 opacity-75"></span>
                              <span className="relative rounded-full h-2 w-2 bg-gray-500"></span>
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">
                      Error: {error}. Please try again.
                    </div>
                  )}
                  <div ref={endOfMessagesRef} />
                </div>
              )
            ) : (
              // Welcome screen gets overflow-y-auto to scroll if needed
              <div className="flex-grow overflow-y-auto flex flex-col items-center justify-center text-center p-8">
                <Bot className="h-12 w-12 text-primary mb-4" />
                <h2 className="text-2xl font-bold mb-2">Welcome to Tekir Chat</h2>
                <p className="text-muted-foreground max-w-md mb-8">
                  Chat with advanced AI models in your browser. Ask questions, get information, or just have a conversation.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl mb-8">
                  {["Tell me about quantum computing", 
                    "Write a poem about the night sky", 
                    "Explain how blockchain works",
                    "Explain the open source world"].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }}
                      className="p-3 rounded-lg border border-border bg-background hover:bg-muted text-sm text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                
                {/* Add Markdown examples */}
                <div className="border border-border rounded-lg p-4 max-w-2xl w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <FileCode className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Markdown & LaTeX Support</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-2">
                    This chat supports Markdown formatting and LaTeX equations. Try these examples:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-left">
                    <div className="p-2 bg-muted rounded">
                      <code className="block mb-1"># Heading 1</code>
                      <code className="block mb-1">**Bold text**</code>
                      <code className="block">- Bullet list</code>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <code className="block mb-1">```python<br/>print("Hello")<br/>```</code>
                      <code className="block">$E = mc^2$</code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Input form with disabled state when no chat is selected */}
            <div className="mt-auto border-t border-border pt-2 pb-0">
              <form onSubmit={handleSendMessage} className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentChat ? "Type a message..." : "Create a new chat to start"}
                  className="w-full p-4 pr-12 rounded-lg border border-border bg-background resize-none min-h-[56px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  rows={1}
                  disabled={isLoading || !currentChat}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading || !currentChat}
                  className={`absolute right-3 bottom-3 p-0 w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center ${
                    input.trim() && !isLoading && currentChat
                      ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg hover:scale-105 active:scale-95 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 border-2 border-t-transparent border-primary-foreground/30 rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </button>
              </form>
              <div className="text-xs text-muted-foreground text-center mt-2">
                Tekir AI is an experimental project, messages you receive may display inaccurate or offensive information.
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
