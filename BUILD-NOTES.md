# Build notes

- Requires Node.js 22+ for desktop serving and Java 21 for Android builds.
- Desktop: run `start.bat`; it launches `server.js` and opens the app at `http://127.0.0.1:3000`.
- Android CI: GitHub Actions copies `index.html`, `app.js`, `chapters.js`, `style.css`, `data/`, `public/`, and seed JSON files to `www/`, adds Capacitor Android, syncs, and builds `assembleDebug`.
- The browser loads Supabase JS from jsDelivr and uses native browser ES modules with JSON import attributes. Internet access is required for initial SDK loading and cloud sync.
- Use the same email/password account on desktop and Android.
