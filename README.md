# JEE OneShot OS 2.0.0

This build follows the uploaded **JEE OS** project's root-oriented architecture: `index.html`, `app.js`, `server.js`, `start.bat`, `tracker.json`, `curriculum.json`, Supabase authentication/cloud sync, and a GitHub Actions Android APK workflow.

## Study plan
- Start date: **1 November 2026**
- Daily target: **one video/chapter per day**
- Rotation: **Physics → Chemistry → Mathematics**, repeating
- Curriculum: **43 Physics + 38 Chemistry + 35 Mathematics = 116 entries**
- No revision module and no tests module.

## Desktop launch (Windows)
1. Install Node.js 22 or newer.
2. Extract this ZIP to a writable folder.
3. Run `start.bat`.
4. The app opens at `http://127.0.0.1:3000`. Do not open `index.html` directly.

`server.js` is a small static server, matching the supplied JEE OS layout. `tracker.json` is the chapter/video seed snapshot and `curriculum.json` stores the plan metadata. Progress is stored locally per signed-in account and synchronized through Supabase.

## Login and cloud sync
Create an account or sign in with email and password. Use the same account on PC and Android to sync progress. The client uses the Supabase project URL and publishable key only; no service-role key is included. Progress is stored in `jee_one_shot_os_state` and protected by authenticated-user row-level security. The table is enabled for Supabase Realtime.

## Android APK
Push the project to a GitHub repository, then open **Actions → Build JEE OneShot OS APK → Run workflow**. Download the `JEE-OneShot-OS-debug-apk` artifact after the workflow succeeds. The ZIP contains the build workflow, not a prebuilt APK.

## Project layout
- `index.html` — HTML shell and Supabase browser SDK
- `app.js` — main application logic
- `chapters.js` and `data/` — chapter order and supplied video URLs
- `style.css` — application stylesheet
- `server.js` / `start.bat` — desktop launch architecture
- `tracker.json` — chapter/video seed snapshot
- `curriculum.json` — plan metadata
- `.github/workflows/build-apk.yml` — Android build workflow
