# BiblioTech v2.0: Strong Backend Architecture (Node.js + Supabase)

This document serves as the permanent record of the backend architecture designed to match the robustness of ASP.NET Core.

## 1. Architecture Overview
The system follows a modular, middleware-driven approach using Supabase Edge Functions (Deno runtime).

- **Core Engine**: Node.js/Deno.
- **Security**: JWT-based Auth + Service Role elevated permissions.
- **Integrity**: Zod-based schema validation.

## 2. Component Breakdown

### A. Middleware Layer (`_shared/middleware.ts`)
Handles cross-cutting concerns:
- **CORS**: Unified headers for web/native access.
- **Authentication**: Verifies JWT from headers and fetches user role.
- **Authorization**: Role-based access (e.g., `Admin` only).
- **Error Handling**: Standardized JSON error responses.

### B. Validation Layer (`_shared/validation.ts`)
Acts as the **DTO (Data Transfer Object)** layer:
- Defines strictly typed schemas using **Zod**.
- Provides a `validateRequest` helper to catch malformed data before business logic executes.

### C. Controller Layer (`admin-manager/index.ts`)
Centralizes business logic:
- Uses a path-based routing system (`create-user`, `list-users`, `delete-user`).
- Leverages the `service_role` client to perform administrative tasks (Identity Management).

## 3. Maintenance & Scaling
- **Adding new routes**: Simply add a new path handler in `admin-manager/index.ts`.
- **New Validation**: Add a schema to `validation.ts` and infer the type for TypeScript safety.
- **New Middleware**: Add functions to `middleware.ts` and wrap the main handler.

---
*Created by Antigravity AI - 2026-04-27*
