import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/layout/navbar";
import {
  Paperclip,
  Send,
  Bot,
  User as UserIcon,
  Loader2,
  FileText,
  X,
  MessageSquarePlus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { toast } from "@/components/ui/use-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";
import pdfjsLib from "@/lib/pdfWorker";
import html2pdf from 'html2pdf.js';

interface ChatDBMessage {
  id: string;
  created_at: string;
  user_id: string | null;
  prompt: string | null;
  response: string | null;
  message: string | null;
  conversation_id?: string | null;
  attachments?: File[];
  document_name?: string;   // ✅ matches Supabase
  has_document?: boolean;  
  law_category?: string;
}

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  attachments?: File[];
  documentName?: string; // Add this to store the document name
  hasDocument?: boolean; // Add this to track if a message had a document
  lawCategory?: string;
}

// New law keywords and categories
const lawKeywords: Record<string, string[]> = {
  "Criminal Law": [
    "IPC", "FIR", "arrest", "bail", "charge sheet", "Section 302", "murder", "theft", "assault"
  ],
  "Family Law": [
    "divorce", "alimony", "child custody", "Hindu Marriage Act", "Section 13", "maintenance", "dowry"
  ],
  "Contract Law": [
    "breach of contract", "agreement", "consideration", "offer", "acceptance", "Indian Contract Act"
  ],
  "Property Law": [
    "ownership", "partition", "title deed", "immovable property", "transfer of property", "land dispute"
  ],
  "Constitutional Law": [
    "Article 14", "Article 32", "fundamental rights", "writ petition", "Supreme Court", "PIL"
  ],
  "Labour Law": [
    "wages", "industrial dispute", "employee", "termination", "gratuity", "EPF", "bonus"
  ],
  "Corporate Law": [
    "company act", "memorandum of association", "shareholder", "director", "LLP"
  ],
  "Cyber Law": [
    "IT Act", "cybercrime", "data breach", "digital signature", "hacking", "phishing"
  ]
};

function classifyLaw(text: string): string[] {
  const scoreMap: Record<string, number> = {};
  const lowerText = text.toLowerCase();

  for (const category in lawKeywords) {
    let score = 0;
    lawKeywords[category].forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) score++;
    });
    scoreMap[category] = score;
  }

  // Sort by highest score
  const sorted = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] === 0) return ["Unknown/General Law"];
  // Return all categories with the highest score
  return sorted.filter(([_, score]) => score === sorted[0][1]).map(([cat]) => cat);
}

const loadingPhrases = [
  'Analyzing precedent…',
  'Reviewing court data…',
  'Consulting legal texts…',
  'Drafting response…',
];

const Chat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content:
        "Hello! I'm LegalGist, an AI legal assistant specialized in Indian Constitutional Law and IPC. How can I help you today?",
      isBot: true,
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileContents, setFileContents] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [conversationId, setConversationId] = useState<string>("");
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [lawCategory, setLawCategory] = useState<string>("Unknown");
  const chatExportRef = useRef<HTMLDivElement>(null);
  const [loadingPhraseIdx, setLoadingPhraseIdx] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setConversationId(uuidv4());
    }
  }, [conversationId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get("id") || localStorage.getItem("chatId");
  
    if (chatId) {
      loadChatById(chatId);
      // If the chatId is in the URL, set read-only mode
      if (params.get("id")) setIsReadOnly(true);
      else setIsReadOnly(false);
    } else {
      const newId = uuidv4();
      localStorage.setItem("chatId", newId);
      setConversationId(newId);
      setIsReadOnly(false);
      // setMessages([welcomeMessage]);
    }
  }, [location.search]);
  
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem("chatId", conversationId);
    }
  }, [conversationId]);
  

  const loadChatById = async (chatId: string) => {
    setIsLoadingChat(true);
    try {
      // Fetch all messages for this conversation (root + replies)
      const { data: conversationData, error: conversationError } =
        await supabase
          .from("chats")
          .select("*")
          .or(`conversation_id.eq.${chatId},id.eq.${chatId}`)
          .order("created_at", { ascending: true });

      if (conversationError) throw conversationError;

      if (conversationData && conversationData.length > 0) {
        // Find the root message (id === chatId)
        const rootMsg = conversationData.find(msg => msg.id === chatId);
        // Set conversationId to root's conversation_id if present, else to root id
        if (rootMsg) {
          setConversationId(rootMsg.conversation_id || rootMsg.id);
        } else {
          setConversationId(chatId);
        }
        processMessagesFromDB(conversationData);
        return;
      }

      // Fallback: try to fetch a single message
      const { data: singleChatData, error: singleChatError } = await supabase
        .from("chats")
        .select("*")
        .eq("id", chatId)
        .single();

      if (singleChatError) {
        console.error("Error loading chat:", singleChatError);
        toast({
          title: "Error",
          description: "Chat conversation not found",
          variant: "destructive",
        });
        navigate("/chat");
        return;
      }

      setConversationId(singleChatData.conversation_id || singleChatData.id);
      processMessagesFromDB([singleChatData]);
    } catch (error) {
      console.error("Error loading chat:", error);
      toast({
        title: "Error",
        description: error.message || JSON.stringify(error),
        variant: "destructive",
      });

      const newId = uuidv4();
      setConversationId(newId);
      setMessages([
        {
          id: "welcome",
          content:
            "Hello! I'm LegalGist, an AI legal assistant specialized in Indian Constitutional Law and IPC. How can I help you today?",
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const processMessagesFromDB = (chatMessages: ChatDBMessage[]) => {
    console.log("Raw messages from DB:", chatMessages);
    if (!chatMessages || chatMessages.length === 0) {
      setMessages([
        {
          id: "welcome",
          content:
            "Hello! I'm LegalGist, an AI legal assistant specialized in Indian Constitutional Law and IPC. How can I help you today?",
          isBot: true,
          timestamp: new Date(),
          
        },
        
      ]);
      
      return;
      
    }
  
    const convertedMessages: Message[] = [
      
      {
        
        id: "welcome",
        content:
          "Hello! I'm LegalGist, an AI legal assistant specialized in Indian Constitutional Law and IPC. How can I help you today?",
        isBot: true,
        timestamp: new Date(),
      },
    ];
  
    
      for (const msg of chatMessages) {
        const sharedDocInfo = {
          hasDocument: msg.has_document ?? false,
          documentName: msg.document_name ?? "",
        };
        if (msg.prompt || sharedDocInfo.hasDocument)
          {
          // User's message
          convertedMessages.push({
            id: `user-${msg.id}`,
            content: msg.prompt ?? '',
            isBot: false,
            timestamp: new Date(msg.created_at),
            ...sharedDocInfo,
            lawCategory: msg.law_category,
          });
        }
        
        if (msg.response) {
          // Bot's reply
          convertedMessages.push({
            id: `bot-${msg.id}`,
            content: msg.response,
            isBot: true,
            timestamp: new Date(msg.created_at),
          });
        }
      }
      
    
  
    setMessages(convertedMessages);
    console.log("Processed messages:", convertedMessages);
  };
  

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFiles([file]);

      if (file.type === "application/pdf" || file.type === "text/plain") {
        setIsProcessingFile(true);
        try {
          const content = await readFileContent(file);
          setFileContents(content);
          setPdfContent(content);
          // Detect law category
          const detectedCategories = classifyLaw(content);
          setLawCategory(detectedCategories.join(', '));
          toast({
            title: "File processed",
            description: `Successfully extracted content from ${file.name}`,
          });
        } catch (error) {
          console.error("Error reading file:", error);
          toast({
            title: "Error",
            description: "Failed to extract content from the file",
            variant: "destructive",
          });
          setFileContents(null);
          setPdfContent(null);
          setLawCategory("Unknown");
        } finally {
          setIsProcessingFile(false);
        }
      }
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(e.target.result as string);
          } else {
            reject(new Error("Failed to read text file"));
          }
        };
        reader.onerror = () => reject(new Error("Error reading text file"));
        reader.readAsText(file);
        return;
      }

      if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = async (e) => {
          if (!e.target?.result) {
            reject(new Error("Failed to read PDF file"));
            return;
          }

          try {
            const arrayBuffer = e.target.result as ArrayBuffer;
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer })
              .promise;

            let textContent = "";

            // Extract text from each page
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const pageText = content.items
                .map((item: any) => item.str)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

              textContent += pageText + "\n\n";
            }

            // Clean up the text
            textContent = textContent
              .replace(/\n{3,}/g, "\n\n") // Replace multiple newlines with double newlines
              .replace(/\s+/g, " ") // Replace multiple spaces with single space
              .trim();

            resolve(textContent);
          } catch (error) {
            console.error("PDF processing error:", error);
            reject(new Error("Error processing PDF content"));
          }
        };

        reader.onerror = () => reject(new Error("Error reading PDF file"));
        reader.readAsArrayBuffer(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const content = e.target.result.toString();
          resolve(content);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileContents(null);
    setLawCategory("Unknown");
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const startNewChat = () => {
    const newId = uuidv4();
    setConversationId(newId);
    setPdfContent(null);

    setMessages([
      {
        id: "welcome",
        content:
          "Hello! I'm LegalGist, an AI legal assistant specialized in Indian Constitutional Law and IPC. How can I help you today?",
        isBot: true,
        timestamp: new Date(),
      },
    ]);

    setInput("");
    setSelectedFiles([]);
    setFileContents(null);

    navigate("/chat");
  };

  const handleSendMessage = async () => {
    if ((input.trim() === "" && !fileContents) || isLoading) return;
  
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      isBot: false,
      timestamp: new Date(),
      attachments: selectedFiles.length > 0 ? selectedFiles : undefined,
      documentName: selectedFiles.length > 0 ? selectedFiles[0].name : undefined,
      hasDocument: selectedFiles.length > 0,
      lawCategory: lawCategory,
    };
  
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
  
    try {
      if (!conversationId) {
        setConversationId(uuidv4());
      }
  
      // Construct the prompt with PDF context if available
      let prompt = input.trim();
      if (pdfContent) {
        prompt = `Based on the following document:\n\n${pdfContent}\n\nAnswer this question:\n${input.trim()}`;
      }
  
      const { data, error } = await supabase.functions.invoke("legal-chat", {
        body: {
          prompt: prompt,
          fileContent: pdfContent,
        },
      });
  
      if (error) {
        console.error("Edge Function error:", error);
        throw new Error(error.message || "Failed to get response from AI");
      }
  
      if (!data || !data.response) {
        throw new Error("No response received from AI");
      }
  
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        isBot: true,
        timestamp: new Date(),
      };
  
      setMessages((prev) => [...prev, botMessage]);
  
      if (user) {
        // Include document name and has_document flag
        await supabase.from("chats").insert({
          user_id: user.id,
          prompt: input.trim(),
          response: data.response,
          conversation_id: conversationId,
          message: pdfContent ? "Document Analysis" : input.trim(),
          document_content: pdfContent,
          document_name: selectedFiles.length > 0 ? selectedFiles[0].name : null,
          has_document: true,
          law_category: lawCategory,
        });
      }
  
      // We can now clear selectedFiles from the UI, but we've saved the info to the database
      setSelectedFiles([]);
      setFileContents(null);
    } catch (error) {
      console.error("Error sending message:", error);
  
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "I apologize, but I'm having trouble processing your request right now. Please try again with a different query.",
        isBot: true,
        timestamp: new Date(),
      };
  
      setMessages((prev) => [...prev, errorMessage]);
  
      toast({
        title: "Error",
        description:
          error.message || "Failed to get a response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // PDF export handler
  const handleDownloadPDF = () => {
    if (!chatExportRef.current) return;
    const opt = {
      margin:       0.5,
      filename:     `LegalGist_Chat_${new Date().toISOString().slice(0,10)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };
    html2pdf().set(opt).from(chatExportRef.current).save();
  };

  // Rotating loading phrase effect
  useEffect(() => {
    if (!isLoading) return;
    setLoadingPhraseIdx(0);
    const interval = setInterval(() => {
      setLoadingPhraseIdx((idx) => (idx + 1) % loadingPhrases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Helper to highlight matches in a line
  function highlightMatches(line: string, term: string) {
    if (!term) return line;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return line.split(regex).map((part, i) =>
      regex.test(part) ? <span key={i} className="bg-yellow-200 text-black rounded px-1">{part}</span> : part
    );
  }

  return (
    <div className="flex flex-col bg-background">
    <Navbar />
    <SidebarProvider defaultOpen>
      <div className="flex flex-1 overflow-hidden pt-16">
        <ChatSidebar onStartNewChat={startNewChat} />
  
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* PDF Download & Share Button */}
          <div className="flex justify-end px-4 pt-4">
            <Button onClick={handleDownloadPDF} variant="outline" size="sm">
              Download as PDF
            </Button>
          </div>
          {/* CHAT MESSAGES SCROLL AREA */}
          <div ref={chatExportRef} className="flex-1 px-4 md:px-6 py-4 space-y-6">
            {/* PDF/Text Preview Search */}
            {fileContents && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    type="text"
                    placeholder="Search in document..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                  {searchTerm && (
                    <Button size="sm" variant="ghost" onClick={() => setSearchTerm("")}>Clear</Button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto border rounded bg-background p-2 text-xs font-mono whitespace-pre-wrap">
                  {fileContents.split(/\r?\n/).map((line, idx) => (
                    <div key={idx} className={searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase()) ? "bg-yellow-100 rounded" : ""}>
                      {highlightMatches(line, searchTerm)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* PDF Header */}
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">LegalGist Chat Conversation</h2>
              <div className="text-sm text-muted-foreground">{new Date().toLocaleString()}</div>
            </div>
            {isLoadingChat ? (
              <div className="flex items-center justify-center ">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading conversation...
                </span>
              </div>
            ) : (
              messages.map((message) => {
                console.log("Message data:", message);
                return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.isBot ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`flex gap-3 mt-20 max-w-[80%] lg:max-w-[70%] ${
                      message.isBot ? "flex-row" : "flex-row-reverse"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                        message.isBot ? "bg-primary/20" : "bg-accent/30"
                      }`}
                    >
                      {message.isBot ? (
                        <Bot className="w-4 h-4 text-primary" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-accent" />
                      )}
                    </div>
                    <div className="flex flex-col space-y-1">
                      <Card
                        className={`overflow-hidden shadow-sm ${
                          message.isBot
                            ? "border-primary/20 bg-background"
                            : "border-accent/20 bg-muted/30"
                        }`}
                      >
                    <CardContent className="p-3 text-sm whitespace-pre-wrap">
  {message.content} 

  {(message.attachments?.length > 0 || message.hasDocument) && (
    <div className="mt-2 space-y-1">
      {/* Render any actual file objects if present */}
      {message.attachments?.map((file, index) => (
        <div
          key={`attached-${message.id}-${index}`}
          className="text-xs bg-accent/10 rounded-md p-1 px-2 flex items-center gap-1"
        >
          <FileText className="w-3 h-3" />
          {message.documentName}
          {/* Law Category Label for sent document */}
          {index === 0 && message.lawCategory && message.lawCategory !== "Unknown" && (
            <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
              {message.lawCategory}
            </span>
          )}
        </div>
      ))}

      {/* Fallback: render documentName if no attachments */}
      {(!message.attachments?.length && message.hasDocument && message.documentName) && (
        <div
          className="text-xs bg-accent/10 rounded-md p-1 px-2 flex items-center gap-1"
        >
          <FileText className="w-3 h-3" />
          {message.documentName}
          {/* Law Category Label for sent document */}
          {message.lawCategory && message.lawCategory !== "Unknown" && (
            <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
              {message.lawCategory}
            </span>
          )}
        </div>
      )}
    </div>
  )}


</CardContent>

                      </Card>
                      <span className="text-xs text-muted-foreground px-2">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
            )}
  
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%] items-center">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-1 flex items-center">
                    <div className="min-w-[180px] max-w-[260px] rounded bg-muted flex items-center px-3 py-1 text-sm font-medium text-muted-foreground animate-pulse whitespace-nowrap overflow-hidden text-ellipsis">
                      {loadingPhrases[loadingPhraseIdx]}
                    </div>
                  </div>
                </div>
              </div>
            )}
  
            <div ref={messagesEndRef} />
          </div>
  
          {/* INPUT AREA */}
          <div className="border-t p-3 bg-background">
            {isReadOnly && (
              <div className="mb-2 text-center text-sm text-muted-foreground">
                <span>This chat is in <b>read-only</b> mode. You cannot send messages or upload files.</span>
              </div>
            )}
            {!isReadOnly && (
              <>
                <div className="flex gap-2 mb-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setInput('Summarize this')}>Summarize this</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setInput('Explain legal implications')}>Explain legal implications</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setInput('Draft legal reply')}>Draft legal reply</Button>
                </div>
                <form onSubmit={handleSubmit} className="relative">
                  {selectedFiles.length > 0 && (
                    <div className="absolute bottom-full mb-2 left-0 right-0">
                      <div className="bg-background/80 backdrop-blur-sm rounded-md p-2 flex flex-wrap gap-2 border">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="bg-accent/20 text-xs rounded-full px-2 py-1 flex items-center"
                          >
                            {isProcessingFile ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <FileText className="w-3 h-3 mr-1" />
                            )}
                            <span className="truncate max-w-[150px]">
                              {file.name}
                            </span>
                            {/* Law Category Label */}
                            {lawCategory !== "Unknown" && !isProcessingFile && (
                              <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                                {lawCategory}
                              </span>
                            )}
                            <button
                              type="button"
                              className="ml-1 text-muted-foreground hover:text-foreground"
                              onClick={() => handleRemoveFile(index)}
                              disabled={isProcessingFile}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {isProcessingFile && (
                          <span className="text-xs text-muted-foreground">
                            Processing document...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
          
                  <div className="relative flex items-center gap-2 bg-background rounded-lg border shadow-sm">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.txt,.doc,.docx"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleFileButtonClick}
                      className="flex-shrink-0"
                      aria-label="Attach file"
                      disabled={isProcessingFile || isLoading}
                    >
                      {isProcessingFile ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Paperclip className="h-5 w-5" />
                      )}
                    </Button>
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        fileContents
                          ? "Ask about the uploaded document..."
                          : "Ask about Indian Constitution or IPC..."
                      }
                      className="border-none focus-visible:ring-1 focus-visible:ring-primary h-10"
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      variant="default"
                      size="sm"
                      className="flex-shrink-0"
                      disabled={
                        isLoading || (input.trim() === "" && !fileContents)
                      }
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  </div>

  );
};

export default Chat;
