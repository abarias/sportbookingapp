# AGENTS.md

## Product
This repository contains an MVP sports facility booking app for the Philippines.

## Goals
- Fast MVP delivery
- Clean architecture
- Low-cost deployment
- Strong correctness around booking availability and payment confirmation

## Tech Stack
- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- PayMongo
- Vercel deployment

## Coding Rules
- Use strict TypeScript
- Prefer server-side validation for all business rules
- Never trust client-side pricing or availability
- Keep functions small and readable
- Avoid overengineering
- Reuse components where sensible
- Use UTC in storage and Asia/Manila in display
- Prevent double booking through backend validation and transactional logic

## Domain Rules
- Booking is only confirmed after verified successful payment
- Minimum slot interval is 30 minutes
- No waitlisting
- Pending unpaid bookings expire automatically
- Availability must consider confirmed bookings, valid pending bookings, blocked schedules, and operating hours

## Expected Output Style
- Explain assumptions briefly
- Make incremental commits/changes
- Summarize changed files after each implementation phase
- Add TODOs only for post-MVP items

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
