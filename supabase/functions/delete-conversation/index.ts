
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteRequest {
  conversationId?: string;
  chatId?: string;
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { conversationId, chatId, userId } = await req.json() as DeleteRequest;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Validate that at least one ID is provided
    if (!conversationId && !chatId) {
      return new Response(
        JSON.stringify({ error: 'Either conversationId or chatId must be provided' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    let result;

    // Delete by conversation ID
    if (conversationId) {
      console.log(`Deleting conversation ${conversationId} for user ${userId}`);
      
      const { data, error } = await supabaseClient
        .from('chats')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
      
      if (error) throw error;
      result = { deleted: 'conversation', id: conversationId, success: true };
    } 
    // Delete by chat ID
    else if (chatId) {
      console.log(`Deleting chat ${chatId} for user ${userId}`);
      
      const { data, error } = await supabaseClient
        .from('chats')
        .delete()
        .eq('id', chatId)
        .eq('user_id', userId);
      
      if (error) throw error;
      result = { deleted: 'chat', id: chatId, success: true };
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error('Error deleting chat:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
