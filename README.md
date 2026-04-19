# Voxa

Voxa is a real-time meeting copilot web application that listens to live audio, transcribes conversations, and generates context-aware suggestions during ongoing discussions. It helps users stay engaged, ask better questions, and extract meaningful insights in real time.

---

## Overview

Voxa continuously processes live audio input and transforms it into actionable intelligence through a structured pipeline:

audio → transcription → context filtering → suggestions → detailed responses → chat

The system is designed to prioritize relevance, low latency, and efficient token usage while maintaining a clean and responsive user experience.

---

## Features

- Real-time audio capture from the browser microphone  
- Incremental transcription using Whisper Large V3 (via Groq)  
- Live suggestions refreshed periodically based on recent conversation  
- Exactly three suggestions per batch, each designed to be immediately useful  
- Context-aware suggestion types:
  - question
  - insight
  - clarification or fact-check  
- Clickable suggestions that generate detailed responses  
- Continuous chat system with context awareness  
- Export session data including transcript, suggestions, and chat history  
- Settings panel for user-provided Groq API key and configurable prompts  

---

## Tech Stack

Frontend:
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)

Backend:
- Next.js API Routes

AI Integration:
- Groq API  
  - Whisper Large V3 (speech-to-text)  
  - GPT-OSS 120B (suggestions and chat)  

---

## Architecture Overview

The system is divided into three primary layers:

### Frontend
- Transcript Panel: Displays live transcription updates  
- Suggestions Panel: Shows batches of suggestions based on recent context  
- Chat Panel: Handles detailed responses and user queries  

### Backend API Routes
- `/api/transcribe` → Handles audio upload and transcription via Whisper  
- `/api/suggestions` → Generates structured suggestions  
- `/api/detail` → Produces detailed responses when a suggestion is clicked  

### Data Flow

1. Audio is captured in chunks from the microphone  
2. Audio is sent to the transcription API  
3. Transcript is appended incrementally  
4. A context window is extracted from recent transcript  
5. Suggestions are generated using the context  
6. User clicks a suggestion → detailed response is generated  
7. Chat history is maintained for the session  

---

## Project Structure

```
/app
  /api
    /transcribe
    /suggestions
    /detail
  /components
    TranscriptPanel.tsx
    SuggestionsPanel.tsx
    ChatPanel.tsx
  /settings
  /page.tsx

/lib
  groqClient.ts
  contextWindow.ts

/hooks

/store
  useStore.ts

/types
```

---

## Prompt Engineering Strategy

The system enforces strict control over model output:

- Exactly three suggestions per cycle  
- Each suggestion is concise (max ~20 words)  
- Suggestions are intentionally diverse:
  - one question  
  - one insight  
  - one clarification or answer  

This improves usability and avoids redundant or generic outputs.

Prompts are structured to:
- minimize verbosity  
- enforce formatting  
- reduce hallucination risk  
- maintain consistency across responses  

---

## Context Window Strategy

Instead of sending the full transcript, Voxa uses a sliding context window:

- Only recent transcript (last N entries or last X seconds) is used  
- Reduces token usage significantly  
- Improves response latency  
- Maintains relevance to the current conversation  

Additionally, transcript compression removes filler words such as:
- um  
- uh  
- okay  
- yeah  

This further reduces token overhead without losing meaning.

---

## Performance and Latency Optimization

- Context window limits reduce prompt size  
- Controlled `max_tokens` for each API call  
- Suggestions generated at intervals instead of every input  
- Avoids redundant API calls when context has not changed  

These optimizations ensure the system remains responsive during live conversations.

---

## Tradeoffs

- Reduced context window improves speed but may miss older references  
- Strict output constraints improve UX but limit model creativity  
- Simpler UI prioritizes clarity over visual complexity  
- No persistent storage to keep the system lightweight  

---

## Setup Instructions

1. Clone the repository
```
git clone <your-repo-url>
cd voxa
```

2. Install dependencies
```
npm install
```

3. Run development server
```
npm run dev
```

4. Open in browser  
http://localhost:3000

5. Add your Groq API key in the Settings panel

---

## API Key Handling

- Users must provide their own Groq API key  
- The key is stored locally (e.g., localStorage)  
- No API keys are stored in the repository  
- No backend persistence is used  

---

## Export Feature

The application allows exporting session data including:

- Full transcript  
- All suggestion batches  
- Complete chat history  
- Timestamps for each entry  

Export format: JSON  

---

## Future Improvements

- Streaming responses for lower latency  
- Smarter context selection using semantic ranking  
- Adaptive suggestion types based on conversation intent  
- Persistent sessions with storage  
- Multi-language support  

---

## Conclusion

Voxa is designed as a real-time, context-aware assistant that balances usability, performance, and intelligent prompting. The system demonstrates practical application of LLMs in live environments with careful attention to latency, token efficiency, and structured outputs.