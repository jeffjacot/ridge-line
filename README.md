# Ridge Line — deploy this to your phone's home screen

## 1. Put this code on GitHub (no command line needed)
1. Go to github.com and sign up (free) if you don't have an account.
2. Click the **+** in the top right → **New repository**. Name it `ridge-line`, keep it Public, click **Create repository**.
3. On the new repo's page, click **"uploading an existing file"**.
4. Unzip the file I gave you, then drag *everything inside the folder* (package.json, index.html, vite.config.js, the `src` folder, the `public` folder, etc.) into the upload box.
5. Scroll down, click **Commit changes**.

## 2. Deploy it with Vercel (free)
1. Go to vercel.com → **Sign Up** → choose **Continue with GitHub**.
2. Click **Add New… → Project**.
3. Find and **Import** your `ridge-line` repo.
4. Vercel auto-detects Vite — leave all settings as-is.
5. Click **Deploy**. Wait ~1 minute.
6. You'll get a URL like `ridge-line-yourname.vercel.app`. That's your real, live app.

## 3. Add it to your iPhone home screen
1. Open your Vercel URL in **Safari** (must be Safari, not Chrome, for this to work on iOS).
2. Tap the **Share** icon (square with an arrow) at the bottom.
3. Scroll down, tap **Add to Home Screen**.
4. Tap **Add**. A Ridge Line icon now sits on your home screen and opens full-screen, no browser bar.

(Android: open the URL in Chrome → tap the **⋮** menu → **Add to Home screen** / **Install app**.)

## Making changes later
Whenever I give you an updated `App.jsx`, go to the file in your GitHub repo, click the pencil (edit) icon, delete everything, paste in the new version, and commit. Vercel redeploys automatically within about a minute — no other steps needed.

## About your data
This app stores everything in your phone's browser (`localStorage`) — nothing is sent to a server. That means:
- It's private to this device/browser.
- Code updates won't erase it.
- Clearing Safari's site data, or a full phone reset, *would* erase it — so use **Settings → Backup & restore → Export backup** in the app occasionally to save a JSON file you can restore from later.

## One feature that needs extra setup
The **"Estimate" (AI food lookup)** button in the Nutrition tab called Anthropic's API directly using a proxy that only exists inside Claude.ai's artifact preview. On this standalone deployment it won't work out of the box — it'll fail gracefully with an error message. Everything else (the local food database, custom manual entries, saved meals, training log, charts, etc.) works exactly the same. If you want the AI estimate working live too, that requires a small backend to hold an API key securely — let me know and I can build that as a separate step.
