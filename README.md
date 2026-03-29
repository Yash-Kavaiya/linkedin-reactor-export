# LinkedIn Reactor Exporter — Chrome Extension

Exports all reactors (likers) from any LinkedIn post to a CSV file with one click.

## Features
- Auto-scrolls the reactors popup to load ALL people
- Exports: Name, LinkedIn URL, Headline, Reaction type
- Downloads CSV directly to your computer
- Works on any LinkedIn post

## Install (Developer Mode)

1. Open Chrome → go to `chrome://extensions/`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder: `linkedin-reactor-export/`
5. The extension icon appears in your toolbar ✅

## How to Use

1. Open a LinkedIn post
2. Click the **reaction count** (e.g. "98 reactions") to open the popup
3. Click the extension icon 💼 in your toolbar
4. Click **Export All Reactors**
5. CSV downloads automatically to your Downloads folder

## Output CSV Format

```
Name, LinkedIn URL, Headline, Reaction
Piyush Saxena, https://www.linkedin.com/in/piyush-saxena-9a256410, SVP at HCLTech, LIKE
John Furrier, https://www.linkedin.com/in/furrier, Host at theCUBE, PRAISE
...
```

## Notes
- You must be **logged into LinkedIn** for this to work
- Open the reactions popup BEFORE clicking Export
- The extension auto-scrolls to load all reactors (may take a few seconds for large lists)
