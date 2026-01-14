# Admin Routing Structure

## Overview
The admin area uses a URL-based routing system where the app ID is part of the URL path. This ensures that all admin operations are scoped to a specific app.

## Route Structure

### Main Routes
- `/admin` - App selection page (shows when no app is selected)
- `/admin/login` - Admin login page
- `/admin/signup` - Admin signup page
- `/admin/create-app` - Create new app page

### App-Specific Routes
All app-specific routes follow the pattern `/admin/[appId]/...`

- `/admin/[appId]` - App dashboard (overview with links to bugs, features, settings)
- `/admin/[appId]/bugs` - Bug management for the app
- `/admin/[appId]/features` - Feature request management for the app
- `/admin/[appId]/settings` - App settings and configuration

## How It Works

### App Selection
1. User selects an app from the `AppDropdown` component
2. The app ID is stored in `localStorage` for persistence
3. User is redirected to `/admin/[appId]` (the app's dashboard)
4. The `AppDropdown` syncs with the URL to show the current app

### Navigation
- The `AdminHeader` component shows the app selector on all app-specific pages
- The `useAppId()` hook extracts the app ID from the URL params
- All app-specific operations use the app ID from the URL

### Creating a New App
1. User creates a new app via `/admin/create-app`
2. After creation, they are redirected to `/admin/[newAppId]`
3. The new app ID is saved to `localStorage`

## Key Components

### `AppDropdown`
- Displays all available apps
- Syncs with URL-based app selection
- Navigates to `/admin/[appId]` when an app is selected

### `AdminHeader`
- Shows user info and logout button
- Conditionally displays the app selector (via `showAppSelector` prop)
- Used on all admin pages

### `useAppId` Hook
- Extracts the app ID from URL params
- Returns `Id<"apps"> | null`
- Used in app-specific pages to get the current app context

## Example Usage

```tsx
// In an app-specific page
import { useAppId } from "@/hooks/useAppId";

export default function BugsPage() {
    const appId = useAppId();
    
    // Use appId to fetch bugs for this specific app
    const bugs = useQuery(api.bugs.queries.getByApp, { appId });
    
    // ...
}
```
