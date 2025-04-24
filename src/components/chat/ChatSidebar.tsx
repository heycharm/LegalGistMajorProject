import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Trash2, MessageSquarePlus, PanelLeftClose, ChevronRight } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

export const ChatSidebar = ({ onStartNewChat }: ChatSidebarProps) => {
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();

  useEffect(() => {
    if (user?.id) {
      fetchChatHistory();
      
      const channel = supabase
        .channel('chat-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chats',
            filter: `user_id=eq.${user?.id}`,
          },
          () => {
            fetchChatHistory();
          }
        )
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
      
      const uniqueConversations = Array.from(conversationMap.values());
      setChatHistory(uniqueConversations);
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
    navigate(`/chat?id=${conversationId || chatId}`);
  };

  const handleDeleteChat = async (chatId: string, conversationId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm("Are you sure you want to delete this chat?")) {
      return;
    }
    
    try {
      console.log("Attempting to delete chat:", { chatId, conversationId });
      
      if (!user?.id) {
        console.error("No authenticated user found");
        throw new Error("You must be logged in to delete chats");
      }

      let deleteStatus;
      
      if (conversationId) {
        deleteStatus = await supabase.functions.invoke('delete-conversation', {
          body: { 
            conversationId,
            userId: user.id 
          }
        });
        
        console.log("Delete conversation response:", deleteStatus);
      } else {
        deleteStatus = await supabase.functions.invoke('delete-conversation', {
          body: { 
            chatId,
            userId: user.id 
          }
        });
        
        console.log("Delete single chat response:", deleteStatus);
      }

      await fetchChatHistory();
      
      toast({
        description: "Chat deleted successfully",
      });
      
      const urlParams = new URLSearchParams(window.location.search);
      const currentChatId = urlParams.get('id');
      
      if (currentChatId === conversationId || currentChatId === chatId) {
        console.log("Navigating away from deleted chat");
        navigate('/chat');
        
        if (onStartNewChat) {
          onStartNewChat();
        }
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

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border/50 p-4 pt-16 flex justify-between items-center">
        {/* <h2 className={`text-lg font-semibold ${state === 'collapsed' ? 'hidden' : ''}`}>
          Conversations
        </h2> */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onStartNewChat}
                variant="ghost"
                size="icon"
                className="hover:bg-accent/20 mt-[20px]"
              >
                <MessageSquarePlus className="h-20 w-5  " />
                <span className="sr-only">New Chat</span>
              </Button>
            </TooltipTrigger>
            {state === 'collapsed' && (
              <TooltipContent side="right">
                New Chat
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-5rem)]">
          <SidebarGroup>
            <SidebarMenu>
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : chatHistory.length > 0 ? (
                chatHistory.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      onClick={() => handleOpenChat(chat.id, chat.conversation_id)}
                      className="w-full group hover:bg-accent/20 transition-colors"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium">
                          {chat.prompt || "New Conversation"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(chat.created_at)}
                        </p>
                      </div>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={(e) => handleDeleteChat(chat.id, chat.conversation_id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </SidebarMenuAction>
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
    </Sidebar>
  );
};
