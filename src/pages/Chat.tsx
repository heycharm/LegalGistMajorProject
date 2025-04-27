import { useState, useRef, useEffect } from "react";
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
}

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  attachments?: File[];
  documentName?: string; // Add this to store the document name
  hasDocument?: boolean; // Add this to track if a message had a document
}

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
    } else {
      const newId = uuidv4();
      localStorage.setItem("chatId", newId);
      setConversationId(newId);
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
      const { data: conversationData, error: conversationError } =
        await supabase
          .from("chats")
          .select("*")
          .eq("conversation_id", chatId)
          .order("created_at", { ascending: true });

      if (conversationError) throw conversationError;

      if (conversationData && conversationData.length > 0) {
        console.log("Fetched conversation data:", conversationData);
        setConversationId(chatId);
        processMessagesFromDB(conversationData);
        return;
      }

      const { data: singleChatData, error: singleChatError } = await supabase
        .from("chats")
        .select("*")
        .eq("id", chatId)
        .single();

      if (singleChatError) {
        console.error("Error loading chat:", singleChatError);
        // toast({
        //   title: "Error",
        //   description: "Chat conversation not found",
        //   variant: "destructive",
        // });
        navigate("/chat");
        return;
      }

      const convId = singleChatData.conversation_id || chatId;
      setConversationId(convId);

      if (singleChatData.conversation_id) {
        const { data: relatedMessages, error: relatedError } = await supabase
          .from("chats")
          .select("*")
          .eq("conversation_id", singleChatData.conversation_id)
          .order("created_at", { ascending: true });

        if (relatedError) throw relatedError;

        if (relatedMessages && relatedMessages.length > 0) {
          processMessagesFromDB(relatedMessages);
          return;
        }
      }

      processMessagesFromDB([singleChatData]);
    } catch (error) {
      console.error("Error loading chat:", error);
      toast({
        title: "Error",
        description: "Failed to load chat conversation",
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
            content: msg.prompt ?? '',    // 🛠️ use prompt instead of message
            isBot: false,
            timestamp: new Date(msg.created_at),
            ...sharedDocInfo,
            // hasDocument: msg.has_document || false,
            // documentName: msg.document_name || "",
          });
        }
        
        if (msg.response) {
          // Bot's reply
          convertedMessages.push({
            id: `bot-${msg.id}`,
            content: msg.response,
            isBot: true,
            timestamp: new Date(msg.created_at),
            // hasDocument: msg.has_document || false,
            // documentName: msg.document_name || "",
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

  return (
    <div className="flex flex-col bg-background">
    <Navbar />
    <SidebarProvider defaultOpen>
      <div className="flex flex-1 overflow-hidden pt-16">
        <ChatSidebar onStartNewChat={startNewChat} />
  
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* CHAT MESSAGES SCROLL AREA */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6 h-0 custom-scrollbar">
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
      </div>
    ))}

    {/* Fallback: render documentName if no attachments */}
    {(!message.attachments?.length && message.hasDocument && message.documentName) && (
      <div
        className="text-xs bg-accent/10 rounded-md p-1 px-2 flex items-center gap-1"
      >
        <FileText className="w-3 h-3" />
        {message.documentName}
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
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-6 w-24 animate-pulse rounded-full bg-muted"></div>
                  </div>
                </div>
              </div>
            )}
  
            <div ref={messagesEndRef} />
          </div>
  
          {/* INPUT AREA */}
          <div className="border-t p-3 bg-background">
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
          </div>
        </div>
      </div>
    </SidebarProvider>
  </div>

  );
};

export default Chat;
