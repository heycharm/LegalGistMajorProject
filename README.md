
# LegalGist - AI Legal Assistant for Indian Law

LegalGist is an AI-powered legal chatbot specialized in Indian Constitutional Law and the Indian Penal Code (IPC). Built with modern web technologies and AI integration, it provides users with accurate information and guidance on Indian legal matters.

## Features

- **Specialized Legal Knowledge**: Focused exclusively on Indian Constitutional Law and IPC
- **Modern UI/UX**: Dark mode interface with elegant design and responsive layout
- **User Authentication**: Registration and login with email/password, Google, and GitHub OAuth
- **File Attachments**: Upload and analyze legal documents
- **Chat History**: Review and continue previous conversations
- **User Accounts**: Manage profile information and settings
- **Supabase Integration**: Backend storage for user data, chat history, and files

## Technical Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **State Management**: React Query
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **File Storage**: Supabase Storage
- **AI Integration**: Google Gemini 2.0 API

## Getting Started

### Setup Supabase Integration

1. Click on the green Supabase button in the top right corner of the Lovable interface
2. Connect to your Supabase project or create a new one
3. Follow the on-screen instructions to complete the integration

### Setting Up Gemini API

1. Sign up for Google AI Studio (https://ai.google.dev/)
2. Create an API key for Gemini 2.0
3. Add the API key to your Supabase Edge Function Secrets

## Database Schema

Once Supabase is connected, create the following tables:

### profiles
- `id` (references auth.users.id)
- `name` (text)
- `created_at` (timestamp with time zone)
- `last_login` (timestamp with time zone)

### chats
- `id` (uuid, primary key)
- `user_id` (references auth.users.id)
- `title` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### messages
- `id` (uuid, primary key)
- `chat_id` (references chats.id)
- `content` (text)
- `is_bot` (boolean)
- `created_at` (timestamp with time zone)

### attachments
- `id` (uuid, primary key)
- `message_id` (references messages.id)
- `file_path` (text)
- `file_name` (text)
- `file_type` (text)
- `created_at` (timestamp with time zone)

## Development

To run the project locally:

```bash
npm install
npm run dev
```

## Deployment

This project can be deployed using Lovable's publishing feature:

1. In Lovable, click on Share > Publish
2. Follow the on-screen instructions to deploy your application
