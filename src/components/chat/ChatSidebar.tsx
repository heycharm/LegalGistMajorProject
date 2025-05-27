import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Trash2, MessageSquarePlus, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';

interface ChatHistory {
  id: string;
  created_at: string;
  prompt?: string | null;
  response?: string | null;
  user_id?: string | null;
  message?: string | null;
  conversation_id?: string | null;
}

interface ChatSidebarProps {
  onStartNewChat?: () => void;
}

// Helper to render text with page breaks
function renderTextWithPageBreak(doc, textLines, x, y, lineHeight, pageWidth, pageHeight, marginX, topMargin) {
  for (let i = 0; i < textLines.length; i++) {
    if (y > pageHeight - marginX) {
      doc.addPage();
      y = topMargin;
    }
    doc.text(textLines[i], x, y);
    y += lineHeight;
  }
  return y;
}

export const ChatSidebar = ({ onStartNewChat }: ChatSidebarProps) => {
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchChatHistory();
      const channel = supabase
        .channel('chat-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `user_id=eq.${user.id}`,
        }, fetchChatHistory)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchChatHistory = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data) {
        setChatHistory([]);
        return;
      }

      const conversationMap = new Map<string, ChatHistory>();
      for (const chat of data) {
        const conversationId = chat.conversation_id || chat.id;
        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, {
            id: chat.id,
            created_at: chat.created_at,
            prompt: chat.prompt,
            response: chat.response,
            user_id: chat.user_id,
            message: chat.message,
            conversation_id: chat.conversation_id
          });
        }
      }

      setChatHistory(Array.from(conversationMap.values()));
    } catch (error: any) {
      console.error('Error fetching chat history:', error);
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChat = (chatId: string, conversationId: string | null) => {
    // For owner's navigation, use /chat and set conversationId in localStorage
    const convId = conversationId || chatId;
    localStorage.setItem('chatId', convId);
    navigate('/chat');
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteChat = async (chatId: string, conversationId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this chat?")) return;

    try {
      if (!user?.id) throw new Error("You must be logged in to delete chats");

      const deleteStatus = await supabase.functions.invoke('delete-conversation', {
        body: conversationId
          ? { conversationId, userId: user.id }
          : { chatId, userId: user.id }
      });

      console.log("Delete response:", deleteStatus);

      await fetchChatHistory();
      toast({ description: "Chat deleted successfully" });

      const urlParams = new URLSearchParams(window.location.search);
      const currentChatId = urlParams.get('id');
      if (currentChatId === conversationId || currentChatId === chatId) {
        navigate('/chat');
        if (onStartNewChat) onStartNewChat();
      }

    } catch (error: any) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Error",
        description: `Failed to delete chat: ${error.message || "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const downloadChatAsPDF = async (chat: ChatHistory) => {
    try {
      // Fetch all messages for this conversation (root + replies)
      const conversationId = chat.conversation_id || chat.id;
      const { data: messages, error } = await supabase
        .from('chats')
        .select('*')
        .or(`conversation_id.eq.${conversationId},id.eq.${conversationId}`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!messages || messages.length === 0) {
        toast({ title: 'No messages found for this chat.' });
        return;
      }

      // PDF setup
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 72; // 1 inch
      let y = 60;
      const bottomMargin = 72; // 1 inch
      const lineHeight = 15;
      const topMargin = 60;

      // Header
      doc.setFontSize(20);
      doc.setTextColor('#1a202c');
      doc.text('LegalGist Chat Conversation', pageWidth / 2, y, { align: 'center' });
      y += 28;
      doc.setFontSize(10);
      doc.setTextColor('#6b7280');
      doc.text(`Exported: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
      y += 28;
      doc.setDrawColor('#e5e7eb');
      doc.setLineWidth(1);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 20;

      // Messages
      doc.setFont('helvetica');
      messages.forEach((msg: any, idx: number) => {
        // User message
        if (msg.prompt || msg.message) {
          const userContent = doc.splitTextToSize(msg.prompt || msg.message, pageWidth - 2 * marginX - 10);
          const userBlockHeight = userContent.length * lineHeight + 16 + 8 + 12; // sender+time + text + divider + spacing
          if (y + 16 > pageHeight - bottomMargin) {
            doc.addPage();
            y = topMargin;
          }
          doc.setFontSize(12);
          doc.setTextColor('#059669'); // green
          doc.text(`You  •  ${new Date(msg.created_at).toLocaleString()}`, marginX, y);
          y += 16;
          doc.setFontSize(11);
          doc.setTextColor('#22223b');
          y = renderTextWithPageBreak(doc, userContent, marginX + 10, y, lineHeight, pageWidth, pageHeight, marginX, topMargin);
          y += 8;
          doc.setDrawColor('#e5e7eb');
          doc.setLineWidth(0.5);
          doc.line(marginX, y, pageWidth - marginX, y);
          y += 12;
        }
        // Bot message
        if (msg.response) {
          const botContent = doc.splitTextToSize(msg.response, pageWidth - 2 * marginX - 10);
          if (y + 16 > pageHeight - bottomMargin) {
            doc.addPage();
            y = topMargin;
          }
          doc.setFontSize(12);
          doc.setTextColor('#2563eb'); // blue
          doc.text(`LegalGist Bot  •  ${new Date(msg.created_at).toLocaleString()}`, marginX, y);
          y += 16;
          doc.setFontSize(11);
          doc.setTextColor('#111827');
          y = renderTextWithPageBreak(doc, botContent, marginX + 10, y, lineHeight, pageWidth, pageHeight, marginX, topMargin);
          y += 8;
          doc.setDrawColor('#e5e7eb');
          doc.setLineWidth(0.5);
          doc.line(marginX, y, pageWidth - marginX, y);
          y += 18;
        }
      });

      doc.save(`LegalGist_Chat_${chat.id}.pdf`);
    } catch (err) {
      toast({ title: 'Failed to export PDF', description: err.message, variant: 'destructive' });
    }
  };

  const SidebarContentComponent = () => (
    <>
      <SidebarHeader className="border-b border-border/50 p-4 pt-16 flex justify-between items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onStartNewChat}
                variant="ghost"
                size="icon"
                className="hover:bg-accent/20 mt-[20px]"
              >
                <MessageSquarePlus className="h-5 w-5" />
                <span className="sr-only">New Chat</span>
              </Button>
            </TooltipTrigger>
            {state === 'collapsed' && (
              <TooltipContent side="right">New Chat</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-5rem)]">
          <SidebarGroup>
            <SidebarMenu>
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : chatHistory.length > 0 ? (
                chatHistory.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <div className="flex w-full items-center justify-between">
                      <SidebarMenuButton
                        onClick={() => handleOpenChat(chat.id, chat.conversation_id)}
                        className="flex-1 group hover:bg-accent/20 transition-colors text-left"
                      >
                        <div className="flex items-center">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          <div className="overflow-hidden">
                            <p className="truncate font-medium">{chat.prompt || "New Conversation"}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(chat.created_at)}</p>
                          </div>
                        </div>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="ml-1">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadChatAsPDF(chat);
                            }}
                          >
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteChat(chat.id, chat.conversation_id, e)}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </SidebarMenuItem>
                ))
              ) : (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  {user ? "No chat history yet" : "Please log in to see chat history"}
                </p>
              )}
            </SidebarMenu>
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar>
          <SidebarContentComponent />
        </Sidebar>
      </div>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-4 left-4 z-50 bg-background border border-border"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <div className="h-full">
              <SidebarContentComponent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};
