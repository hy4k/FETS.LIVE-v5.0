# FETS.LIVE-2025

## Project Overview

This is a full-stack web application built with React, Vite, and Supabase. The frontend is a React application located in the `fets-point` directory, and it uses TypeScript, Tailwind CSS, and TanStack Query for data fetching. The backend is powered by Supabase, with database interaction handled through the Supabase client and potentially direct SQL scripts.

## Building and Running

This project uses `pnpm` as its package manager.

### Key Commands:

*   **Install Dependencies:**
    ```bash
    pnpm install
    ```

*   **Run Development Server:**
    ```bash
    pnpm dev
    ```
    This will start the Vite development server for the React application.

*   **Build for Production:**
    ```bash
    pnpm build
    ```
    This will create a production-ready build of the frontend application.

*   **Run Tests:**
    ```bash
    pnpm test
    ```
    This will run the test suite using Vitest.

*   **Run SQL Scripts:**
    ```bash
    pnpm sql
    ```
    This command is used to execute SQL scripts located in the `scripts` directory.

## Development Conventions

*   **Code Style:** The project uses ESLint for code linting. Run `pnpm lint` to check for linting errors.
*   **Typing:** The project uses TypeScript for static typing.
*   **Testing:** The project uses Vitest for unit and component testing. Test files are located in the `fets-point/src/test` directory.
