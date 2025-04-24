
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// List of legal keywords to detect legal content
const legalKeywords = [
  // Courts
  'supreme court', 'high court', 'district court', 'tribunal', 'bench', 'judicial', 'court of law',
  'sessions court', 'magistrate', 'civil court', 'criminal court', 'family court',
  
  // Legal terms
  'petition', 'writ', 'suo moto', 'jurisprudence', 'judgment', 'verdict', 'acquittal', 'conviction',
  'plaintiff', 'defendant', 'appellant', 'respondent', 'injunction', 'bail', 'habeas corpus',
  'prima facie', 'cognizance', 'adjudication', 'prosecution', 'litigation', 'arbitration',
  'affidavit', 'testimony', 'evidence', 'exhibit', 'contempt of court',
  
  // IPC
  'ipc', 'indian penal code', 'section', 'offense', 'punishment', 'criminal', 'penal',
  
  // Constitution
  'constitution', 'article', 'fundamental rights', 'directive principles', 'amendment',
  'constitutional', 'preamble', 'right to equality', 'right to freedom', 'right to life',
  
  // Legal professionals
  'lawyer', 'advocate', 'attorney', 'counsel', 'solicitor', 'legal counsel', 'senior advocate',
  'judge', 'chief justice', 'magistrate', 'bar council', 'bar association',
  
  // Legal documents
  'plaint', 'written statement', 'fir', 'charge sheet', 'bail application',
  'vakalatnama', 'legal notice', 'memorandum', 'subpoena', 'summons', 'warrant',
  
  // Acts and statutes
  'act', 'law', 'statute', 'ordinance', 'legislation', 'amendment', 'bill', 'regulation',
  'crpc', 'cpc', 'evidence act', 'contract act', 'property law',
  
  // Case references
  'versus', ' vs ', ' v. ', 'petitioner', 'air', 'scc', 'scr', 'judgment dated'
];

// Check if text contains legal content
function containsLegalContent(text: string): boolean {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  // Check for legal keywords
  return legalKeywords.some(keyword => lowerText.includes(keyword));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set')
    }

    const requestBody = await req.json()
    const { prompt, fileContent } = requestBody

    if (!prompt && !fileContent) {
      throw new Error('Either prompt or file content is required')
    }

    // Check if file content is legal content
    if (fileContent && !containsLegalContent(fileContent)) {
      return new Response(
        JSON.stringify({
          response: "I'm sorry, but the document you've uploaded doesn't appear to contain Indian legal content. I can only analyze documents related to Indian Constitutional Law, IPC, court judgments, or other Indian legal matters. Please upload a relevant legal document or ask me a question related to Indian law."
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if the prompt is about legal matters if no file content
    if (!fileContent && !containsLegalContent(prompt)) {
      return new Response(
        JSON.stringify({
          response: "I apologize, but I can only assist with queries related to Indian Constitutional Law, IPC, legal cases, and court proceedings. Please rephrase your question to focus on these topics."
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Construct the user query with file content if provided
    let userQuery = prompt || '';
    
    // If file content is provided, append it to the query
    if (fileContent) {
      userQuery = `${prompt || 'Please analyze this legal document in detail:'}\n\nDocument content:\n${fileContent}`;
    }

    // Debug output of file content length to help diagnose issues
    console.log(`File content length: ${fileContent ? fileContent.length : 0} characters`);
    if (fileContent && fileContent.length > 0) {
      console.log(`File content first 100 chars: ${fileContent.substring(0, 100)}...`);
    }

    // Using the Gemini 2.0 Flash endpoint with a more focused system prompt
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are LegalGist, an AI assistant specialized in Indian Constitutional Law, IPC (Indian Penal Code), and Indian legal cases.

                IMPORTANT RULES:
                1. ONLY answer questions related to:
                   - Indian Constitutional Law
                   - Indian Penal Code (IPC)
                   - Legal cases from Indian courts (Supreme Court, High Courts, etc.)
                   - Indian legal procedures and terminology
                   - Documents containing legal content related to Indian law
                   - Court Judgements

                2. If a question or document is NOT related to Indian law, courts, or legal matters, respond with:
                   "I apologize, but I can only assist with queries related to Indian Constitutional Law, IPC, legal cases, and court proceedings. Please rephrase your question to focus on these topics."

                3. When analyzing documents:
                   - Always provide detailed summaries of Indian legal content
                   - Include specific page numbers and line references when citing document content
                   - Highlight relevant sections of IPC or Constitutional articles with exact citations
                   - Point out any case law references with proper citations
                   - Identify court orders or judgments with their details
                   - If the document appears to contain encoded content or is unreadable, explain exactly what's in the document as best as you can

                4. Always cite with specificity:
                   - Relevant IPC sections with section numbers
                   - Constitutional articles with article numbers
                   - Case law precedents with full citations including year and court
                   - Court judgments with judgment dates and bench details

                5. Document format handling:
                   - For PDF content, analyze what text is available
                   - For documents with encoded/binary content, try to extract meaningful text
                   - If document appears partially readable, focus on the legible portions
                   - Include page numbers whenever possible

                Query: ${userQuery}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1, // Lower temperature for more factual responses
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048, // Increased token limit for more detailed responses
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data));
    
    // Extract the text from the response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't process your query. Please try again.";

    return new Response(
      JSON.stringify({ response: text }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})