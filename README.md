# GenesisClaw Backend

This repository runs the OpenClaw AI engine and connects to Telegram. It provides an API for analyzing research paper abstracts, extracting research gaps, generating execution plans for hackathons, and maintaining a leaderboard of top research gaps.

## Architecture

The system consists of several key components:

- **Server** (`server.js`): Express.js API server with endpoints for health checks and abstract analysis.
- **Pipeline** (`pipeline.js`): Orchestrates the entire workflow from abstract input to plan generation and leaderboard updates.
- **Gap Extractor** (`gap-extractor.js`): Uses Google Gemini AI to identify specific, falsifiable research gaps from abstracts.
- **Execution Planner** (`execution-planner.js`): Generates complete 24-hour hackathon execution plans based on gaps and GitHub context.
- **Gemini Client** (`gemini-client.js`): Handles communication with Google's Generative AI API.
- **Schemas** (`schemas/`): JSON schemas for validating gap and plan data structures.
- **Leaderboard** (`leaderboard.json`): Maintains a ranked list of top research gaps with citations.
- **Memory** (`memory/`): Stores pending abstracts for processing.
- **Tests** (`tests/`): Unit tests for core components.

## API Endpoints

### GET /health
Returns server status and version information.

### POST /api/analyze
Analyzes a research paper abstract and generates execution plans.

**Request Body:**
```json
{
  "abstract": "string — research paper abstract (min 50 chars)",
  "github_context": [
    {
      "name": "repo-name",
      "url": "https://github.com/user/repo",
      "description": "Repository description",
      "stars": 100
    }
  ]
}
```

**Response:**
```json
{
  "status": "success" | "partial" | "no_gaps" | "all_failed",
  "gaps": [...],
  "plans": [...],
  "meta": {
    "duration_ms": 1234,
    "timestamp": "2026-05-06T...",
    ...
  }
}
```

## Dependencies

- `@google/generative-ai`: For AI-powered gap extraction and planning
- `express`: Web framework for the API server
- `openclaw`: OpenClaw AI engine integration

## For Frontend Devs (React/Expo)
Use the `leaderboard.json` file in the root directory to mock your API calls and build the UI while the backend is spinning up.

## For Backend Devs (Node.js)
Because of Indian ISP firewalls blocking the Telegram API locally, **do not run this locally on a mobile hotspot.** 
Run this via **GitHub Codespaces**.

1. Open Codespaces.
2. Add your `.env` variables (GEMINI_API_KEY required).
3. Run `npm install`
4. Run `npm start`

## Testing

Run tests with:
```bash
npm test
```

Individual test files are available in the `tests/` directory for gap extraction and execution planning components.
