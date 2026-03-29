# 💼 LinkedIn Reactor Exporter Pro

> Export all reactors & commenters from any LinkedIn post — with analytics, history, and smart filtering.

![Version](https://img.shields.io/badge/version-2.0.0-blue) ![Manifest](https://img.shields.io/badge/manifest-v3-green) ![License](https://img.shields.io/badge/license-MIT-purple)

---

## ✨ Features

| Feature | Description |
|---|---|
| ⬇️ **Export Reactors** | All people who reacted to a post (auto-scrolls to load all) |
| 💬 **Export Commenters** | Also capture all commenters with their comment text |
| 📊 **Analytics Tab** | Reaction breakdown charts, top reactors, engagement stats |
| 🕐 **Export History** | Re-download any previous export without revisiting the post |
| 🎯 **Reaction Filter** | Filter by Like 👍, Celebrate 👏, Love ❤️, Insightful 💡, etc. |
| 📄 **CSV + JSON** | Export in CSV, JSON, or both simultaneously |
| 📋 **Copy to Clipboard** | One-click copy CSV or JSON |
| ⚙️ **Settings Page** | Customize auto-scroll, formats, history size |
| 🔘 **Floating Button** | Inject Export button directly on LinkedIn posts |

---

## 🚀 Install (Developer Mode)

1. Download / clone this repo
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `linkedin-reactor-export/` folder
6. Pin the 💼 icon to your toolbar

---

## 📖 How to Use

### Export Reactors
1. Open a LinkedIn post (must be logged in)
2. Click the **reaction count** (e.g. "98 reactions") to open the reactions popup
3. Click the 💼 extension icon
4. Configure options (include commenters, format, reaction filter)
5. Click **Export All Reactors**
6. CSV / JSON downloads automatically to your Downloads folder

### View Analytics
- After any export, switch to the **📊 Analytics** tab
- See reaction breakdown, total stats, top reactors

### Re-download Past Exports
- Switch to the **🕐 History** tab
- Download CSV/JSON or copy any past export

---

## 📄 CSV Output Format

```
Type,Name,LinkedIn URL,Headline,Reaction,Comment
Reactor,John Furrier,https://linkedin.com/in/furrier,Host at theCUBE,PRAISE,
Reactor,Piyush Saxena,https://linkedin.com/in/piyush-saxena-9a256410,SVP HCLTech,LIKE,
Commenter,Jane Doe,https://linkedin.com/in/janedoe,AI Engineer,,"Great content!"
```

## JSON Output Format

```json
{
  "exported_at": "2026-03-29T08:00:00.000Z",
  "post_url": "https://www.linkedin.com/posts/...",
  "summary": {
    "total_reactors": 98,
    "total_commenters": 12,
    "total_unique": 108
  },
  "reactors": [...],
  "commenters": [...]
}
```

---

## ⚠️ Notes

- **You must be logged into LinkedIn** — unauthenticated access doesn't show reactor lists
- Open the **reactions popup first** before clicking Export
- Auto-scroll may take 5–15 seconds for large lists (200+ reactors)
- Respects LinkedIn's DOM — works with their current UI (as of 2026)

---

## 📁 File Structure

```
linkedin-reactor-export/
├── manifest.json       # Extension manifest (v3)
├── background.js       # Service worker (history storage)
├── content.js          # LinkedIn page injector + scraper
├── content.css         # Floating button styles
├── popup.html          # Main popup UI
├── popup.js            # Popup logic
├── options.html        # Settings page
├── icons/              # Extension icons (16/48/128px)
└── README.md
```

---

## 🛠️ Tech Stack

- Chrome Extension Manifest V3
- Vanilla JS (no dependencies)
- Chrome Storage API (sync + local)
- Chrome Downloads API

---

## 📜 License

MIT — free to use, modify, and distribute.

---

*Made with ❤️ by Yash Kavaiya*
