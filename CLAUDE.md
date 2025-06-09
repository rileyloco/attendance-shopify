# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Attendance Management System integrated with Shopify for order tracking. It's a React-based web application deployed on Netlify with serverless functions.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint

# Test Netlify functions locally (port 8888)
netlify dev
```

## Architecture

### Frontend Stack
- **React 19.1** with React Router DOM for routing
- **Vite** as the build tool
- **Tailwind CSS v4** for styling with custom theme configuration
- **Supabase** for database operations
- **CSS variables** for theming system

### Key Application Routes
- `/` - Home page
- `/customers` - Customer management
- `/attendance` - Attendance tracking
- `/log` - Attendance logs
- `/orders` - Shopify order management
- `/console` - Admin console
- `/kiosk` - Self-service kiosk mode

### Backend
- Serverless function at `netlify/functions/shopify-orders.js` handles Shopify API integration
- Requires environment variables: `SHOPIFY_STORE_URL`, `SHOPIFY_API_TOKEN`

### Database
- Uses Supabase (PostgreSQL-based)
- Client initialized in `src/lib/supabase.js`
- Customer caching implemented in `src/lib/customerCache.js`

## Important Configuration

### Vite Development Server
- Configured with proxy for Netlify functions: `/.netlify/functions` ’ `http://localhost:9999`
- Host set to `true` for LAN access

### Deployment
- Netlify deployment with automatic builds
- Node version 18
- SPA routing configured with catch-all redirect

## Code Conventions

### File Structure
- Components in `src/components/`
- Page components in `src/pages/`
- Utilities and libraries in `src/lib/`
- Context providers in `src/context/`

### Styling
- Tailwind utility classes preferred
- Theme colors use CSS variables defined in the theme system
- Responsive design required for all components

### State Management
- React Context for theme management
- Local state for component-specific data
- Supabase for persistent data