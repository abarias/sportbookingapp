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
