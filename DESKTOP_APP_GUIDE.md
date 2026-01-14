# Desktop App Guide - macOS Bot Controller

## 🎉 What You Get

A beautiful macOS desktop application to control your arbitrage bot with:
- ✅ Start/Stop buttons
- ✅ Real-time bot output
- ✅ Statistics dashboard
- ✅ Status indicators
- ✅ Native macOS look and feel

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/rakeito/flash-loan-app/desktop-app
npm install
```

### 2. Start the App

```bash
npm start
```

A window will open with the bot controller interface!

## Features

### 🎮 Controls

**Start Bot Button**
- Click to start the arbitrage bot
- Bot begins scanning DexScreener
- Status indicator turns green

**Stop Bot Button**
- Click to stop the bot gracefully
- Bot stops after current scan
- Status indicator turns red

### 📊 Dashboard

**Status Card**
- Real-time bot status
- Visual indicator (green/red dot)
- Pulsing animation when running

**Configuration Card**
- Contract address
- Network/RPC URL
- Easy to verify settings

**Statistics**
- **Uptime**: How long bot has been running
- **Scans**: Number of DexScreener scans performed
- **Opportunities**: Arbitrage opportunities found
- **Trades**: Successful trades executed

### 📺 Output Window

- Real-time bot logs
- Auto-scrolls to latest output
- Dark theme for readability
- Clear button to reset

## Using the App

### Starting the Bot

1. Open the app (`npm start`)
2. Verify configuration (contract address, network)
3. Click "▶️ Start Bot"
4. Watch the output window for activity
5. Monitor statistics as they update

### Monitoring

- **Green dot** = Bot is running
- **Red dot** = Bot is stopped
- **Output window** = See what bot is doing
- **Statistics** = Track performance

### Stopping the Bot

1. Click "⏹️ Stop Bot"
2. Bot stops gracefully
3. Status changes to "Stopped"

## Building a macOS App

To create a standalone macOS app:

```bash
cd desktop-app
npm run build
```

This creates a `.dmg` file in the `dist` folder that you can:
- Double-click to install
- Drag to Applications folder
- Launch like any other macOS app

## App Layout

```
┌─────────────────────────────────────┐
│   🤖 Flash Loan Arbitrage Bot       │
│        Control Panel                │
├─────────────────────────────────────┤
│  Status: 🟢 Running                 │
│  Contract: 0x45e1...F54            │
│  Network: sepolia.base.org         │
├─────────────────────────────────────┤
│  [▶️ Start Bot]  [⏹️ Stop Bot]     │
├─────────────────────────────────────┤
│  Bot Output:                        │
│  ┌───────────────────────────────┐ │
│  │ [1:40:28 PM] 🔍 Scan #2       │ │
│  │ ✅ Found 13 pairs             │ │
│  │ ⚠️  No opportunities found   │ │
│  └───────────────────────────────┘ │
├─────────────────────────────────────┤
│  Statistics:                        │
│  Uptime: 00:05:23                   │
│  Scans: 10  |  Opportunities: 0     │
│  Trades: 0                          │
└─────────────────────────────────────┘
```

## Troubleshooting

### App won't open
- Make sure you ran `npm install`
- Check Node.js is installed: `node --version`
- Try: `npm start` from desktop-app directory

### Bot won't start
- Check `bot/.env` is configured
- Verify contract address is correct
- Check network RPC URL is accessible

### No output showing
- Bot may be starting up (wait a few seconds)
- Check bot script exists: `bot/arbitrage-bot.js`
- Verify bot/.env has correct settings

### Statistics not updating
- Statistics parse from bot output
- They update as bot runs
- May take a scan cycle to show data

## Customization

### Change Colors
Edit `desktop-app/styles.css`:
```css
.btn-start {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}
```

### Add Features
Edit `desktop-app/renderer.js` to add:
- More statistics
- Additional controls
- Custom functionality

## Keyboard Shortcuts

- `Cmd+Q` - Quit app
- `Cmd+W` - Close window (on macOS, app stays in dock)

## Next Steps

1. ✅ App created
2. ⏭️ Run: `cd desktop-app && npm start`
3. ⏭️ Start bot from the app
4. ⏭️ Monitor and enjoy!

The desktop app makes it easy to control your bot with a beautiful interface! 🚀
