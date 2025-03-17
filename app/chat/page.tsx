"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Send, Bot, ChevronDown, User, FileCode } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(    {
    id: "llama-3-1-80b",
    name: "Llama 3.1 80B",
    description: "Meta's largest open-source model",
    icon: "/meta.png"
  });
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const models: ModelOption[] = [
    {
      id: "deepseek-r1",
      name: "Deepseek R1",
      description: "Powerful multilingual reasoning model",
      icon: "/deepseek.png"
    },
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelDropdownOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update document title
  useEffect(() => {
    document.title = "Tekir Chat - AI Assistant";
  }, []);

  const handleModelSelect = (model: ModelOption) => {
    setSelectedModel(model);
    setModelDropdownOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Add user message to chat
    const userMessage: Message = { role: "user", content: input };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Create placeholder for assistant's response
      setMessages(prevMessages => [...prevMessages, { role: "assistant", content: "" }]);
      
      // Send request to server-side API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          model: selectedModel.id
        })
      });
      
      // Handle rate limiting errors
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

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedResponse = "";
      
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (value) {
          const chunkText = decoder.decode(value, { stream: true });
          accumulatedResponse += chunkText;
          
          // Update the last message (which is the assistant's response)
          setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            newMessages[newMessages.length - 1] = {
              role: "assistant",
              content: accumulatedResponse
            };
            return newMessages;
          });
        }
      }
      
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      
      // Remove the empty assistant message if there was an error
      setMessages(prevMessages => prevMessages.slice(0, -1));
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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/tekir.png" alt="Tekir Logo" width={32} height={32} />
            </Link>
          </div>
          
          {/* Model selector */}
          <div className="relative" ref={modelDropdownRef}>
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              <Image 
                src={selectedModel.icon} 
                alt={selectedModel.name} 
                width={20} 
                height={20} 
                className="rounded"
              />
              <span>{selectedModel.name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {modelDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg bg-background border border-border shadow-lg z-10">
                <div className="p-1">
                  {models.map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors ${
                        selectedModel.id === model.id ? 'bg-muted' : ''
                      }`}
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
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-grow flex flex-col max-w-5xl mx-auto w-full p-4 md:p-8">
        {messages.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
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
        ) : (
          <div className="flex-grow overflow-y-auto mb-4 space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] md:max-w-[70%] rounded-lg p-4 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <div className="p-1.5 rounded-full bg-background/10">
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div className="ml-2 font-medium">
                      {message.role === "user" ? "You" : "Tekir AI"}
                    </div>
                  </div>
                  
                  {/* Replace text content with MarkdownMessage component */}
                  {message.content ? (
                    <MarkdownMessage 
                      content={message.content} 
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
        )}

        {/* Message input */}
        <form onSubmit={handleSendMessage} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full p-4 pr-12 rounded-lg border border-border bg-background resize-none min-h-[56px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-3 bottom-3 p-0 w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center ${
              input.trim() && !isLoading
                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg hover:scale-105 active:scale-95 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            aria-label="Send message"
          >
            {isLoading ? (
              <div className="h-5 w-5 border-2 border-t-transparent border-primary-foreground/30 rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            )}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 px-6 border-t border-border bg-background mt-auto">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-muted-foreground">
              🇹🇷 Tekir was made in Turkiye!
            </p>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Terms
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <a
              href="https://instagram.com/tekirsearch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Instagram"
            >
              <Image src="/instagram.svg" alt="Instagram" width={20} height={20} className="w-5 h-5" />
            </a>
            <a
              href="https://github.com/tekircik"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="GitHub"
            >
              <Image src="/github.svg" alt="Github" width={20} height={20} className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
