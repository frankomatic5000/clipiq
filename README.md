# ClipIQ

**The AI Video Editor That Talks Back**

Edit videos using natural language commands. Upload, transcribe, and transform your content with simple prompts.

## Tech Stack

- **Frontend**: Next.js 15 + Tailwind 4 + shadcn/ui
- **Backend**: Supabase (Auth + PostgreSQL)
- **Storage**: Cloudflare R2
- **Queue**: Bull + Redis
- **Transcription**: faster-whisper
- **Video Processing**: FFmpeg

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.9+ (for Whisper)
- Redis
- Supabase account
- Cloudflare R2 bucket

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your credentials
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Cloudflare R2
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=clipiq-videos

# Redis
REDIS_URL=redis://localhost:6379

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

1. Create a Supabase project
2. Enable Google OAuth in Authentication → Providers
3. Enable Apple OAuth in Authentication → Providers
4. Run the SQL in `supabase/schema.sql` in the Supabase SQL Editor

### Running the App

```bash
# Start the development server
npm run dev

# Start Redis (if not already running)
brew services start redis  # macOS
# or
docker run -d -p 6379:6379 redis  # Docker
```

### Running the Transcription Worker

The transcription worker runs separately to process video uploads:

```bash
# Install faster-whisper (Python)
pip install faster-whisper

# Start the worker
npx ts-node src/workers/transcription-worker.ts
```

Or in development:

```bash
npm run worker
```

## Project Structure

```
clipiq/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   ├── dashboard/    # Dashboard page
│   │   ├── login/        # Login page
│   │   ├── signup/       # Signup page
│   │   └── editor/       # Video editor (WIP)
│   ├── components/       # React components
│   │   ├── ui/           # shadcn/ui components
│   │   └── upload/       # Upload components
│   ├── lib/              # Utilities
│   │   ├── supabase/     # Supabase clients
│   │   ├── r2/           # R2/S3 client
│   │   └── queue/        # Bull queue config
│   └── workers/          # Background workers
├── supabase/             # Database schema
└── .env.example          # Environment template
```

## Development

```bash
# Run linting
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT © 2026 ClipIQ
