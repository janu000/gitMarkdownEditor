# 🚀 Welcome to Git Markdown Editor

Git Markdown Editor (GME) is a professional-grade, browser-native Markdown environment designed for developers and writers who live in GitHub but demand a polished, seamless local editing experience. 

Because this application is **100% client-side**, there are no intermediate servers and no cloning required. Your files, keystrokes, and tokens flow directly and securely between your browser and the official GitHub API.

## ⚡ Quick Start

1. **Connect to GitHub**: Click the **Login** button to authenticate and sync your repositories.
2. **Open a File**: Browse your repos or use the **Local Workspace** to edit files directly on your machine.
3. **Start Writing**: Watch the high-precision preview update in real-time as you type!

---


## 🛠️ Deep GitHub Integration

* **Direct API Sync**: Edit files and commit them back to your branches instantly using Base64 UTF-8 syncing.
* **Branch Management**: Switch between existing branches or create new ones on the fly right from the explorer.
* **Optimistic UI & Smart Caching**: Experience zero-latency file operations. Renaming, deleting, and creating files reflect immediately in the UI while syncing safely in the background. Browser caching ensures lightning-fast directory navigation.
* **Repository Browser**: Filter your accessible repositories, manually enter any `owner/repo`, or hide specific repos to keep your workspace clean.

---

## 💻 Local Workspace & Export

Don't want to sync to GitHub? GME has you covered for local and offline work:

* **In-Browser Workspace**: Manage a virtual file system right in your browser. Powered by **IndexedDB**, GME automatically saves your drafts for multiple open files, allowing you to switch between them without losing any work.
* **Native File Access**: Use the native File System Access API to open, edit, and save files directly to your hard drive.
* **Flexible Export**: Download your current drafts as `.md` files or export them to professional-grade **PDFs** with custom print styles.
* **PWA Ready**: Install the editor as a standalone desktop or mobile application for a native app-like experience.

---

## 🎨 Modern UI & Customization

* **Three View Modes**: Toggle between **Edit** (maximum focus), **Split** (side-by-side editing), and **Preview** (final document verification).
* **Intelligent Theming**: Full Dark and Light mode support that automatically detects your system preferences.
* **Resizable Layouts**: Click and drag to resize the file explorer sidebar or adjust your editor/preview split ratio exactly how you like it.
* **Interactive TOC**: Double-click any `.md` file in the sidebar to browse its headings as a virtual directory. Click a heading to jump instantly to that line in the editor!

---

## 🔑 How to Get Your GitHub Token

To access your repositories, you need a **GitHub Personal Access Token (PAT)**. Your token is stored securely *only* in your browser's `localStorage`. 

1. Log in to GitHub and navigate to your **Settings**.
2. Scroll down the left sidebar and click **Developer settings** at the very bottom.
3. Select **Personal access tokens** and choose **Tokens (classic)**.
4. Click the **Generate new token (classic)** button.
5. Give your token a descriptive note (e.g., "Git Markdown Editor").
6. **Crucial Step:** Under "Select scopes", check the box for **`repo`**. This grants the editor the necessary permissions to read and commit files.
7. Scroll to the bottom and click **Generate token**.
8. **Copy the token immediately** (GitHub will only show it once) and paste it into the editor's login prompt.

---

## ⌨️ Keyboard Shortcuts & Pro Tips

GME is built for speed. You can customize these shortcuts anytime, but here are the defaults to get you started:

| Command | Mac | Windows/Linux |
|---------|-----|---------------|
| **Save to GitHub** | `⌘ + S` | `Ctrl + S` |
| **Export to PDF** | `⌘ + P` | `Ctrl + P` |
| **Bold** | `⌘ + B` | `Ctrl + B` |
| **Italic** | `⌘ + I` | `Ctrl + I` |
| **Link** | `⌘ + K` | `Ctrl + K` |
| **Code Block** | `⌘ + Alt + C` | `Ctrl + Alt + C` |
| **Math Block** | `⌘ + Alt + X` | `Ctrl + Alt + X` |
| **Table** | `⌘ + Alt + T` | `Ctrl + Alt + T` |

**💡 Pro Tip: Multi-Line Formatting**
Unlike standard text areas, GME allows you to apply formatting to multiple lines at once! Just highlight a block of text and click the Unordered List, Numbered List, or Task List button (or use the keyboard shortcuts) to instantly format all selected lines simultaneously.

---

## 📝 Supported Markdown Syntax

Git Markdown Editor supports standard Markdown along with several powerful extensions for developers.

### 📐 Advanced Math (KaTeX)
Write complex equations using LaTeX syntax.
- **Inline**: Use single dollar signs like `$E=mc^2$`: $E=mc^2$.
- **Block**: Use double dollar signs for centered equations:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### 🏗️ GitHub Flavored Markdown (GFM)
- **Task Lists**: `- [x] Done` and `- [ ] Pending`.
- **Tables**: Full support for alignment and formatting.
- **Strikethrough**: `~~deleted text~~`.
- **Autolinks**: URLs and email addresses are automatically converted to links.

### 💻 Syntax Highlighting
Beautiful, theme-aware highlighting for your code:
```javascript
function greet(name) {
  console.log(`Hello, ${name}! Welcome to GME.`);
}
greet('Developer');
```

### 🚀 Emojis & Rich Media
- Use standard `:shortcodes:` like `:rocket:` 🚀.
- Access the **Emoji Picker** via the toolbar to browse Gitmojis, Status, and more.

### 🔗 Asset Handling
- **Images**: Standard `![alt](url)` syntax.
- **Links**: Use `[text](url)` for standard links.

---

*Ready to dive in? Delete this text and start writing!*