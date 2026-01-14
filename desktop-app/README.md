# Flash Loan Bot Desktop Controller

A beautiful macOS desktop app to control your arbitrage bot.

## Features

✅ **Start/Stop Controls**
- One-click start/stop
- Visual status indicator
- Real-time feedback

✅ **Live Output**
- See bot logs in real-time
- Scrollable output window
- Clear button

✅ **Statistics Dashboard**
- Uptime tracking
- Scan count
- Opportunities found
- Trades executed

✅ **Configuration Display**
- Contract address
- Network/RPC URL
- Easy to verify settings

## Installation

### 1. Install Dependencies

```bash
cd desktop-app
npm install
```

### 2. Run the App

```bash
npm start
```

The app will open in a window.

## Building for macOS

### Create DMG Installer

```bash
npm run build
```

This will create a `.dmg` file in the `dist` folder that you can install on macOS.

## Usage

1. **Start the App**
   - Run `npm start` or double-click the built app
   - The window will open

2. **Start the Bot**
   - Click "▶️ Start Bot" button
   - Watch the output in real-time
   - Status indicator turns green

3. **Monitor**
   - See live bot output
   - Check statistics
   - Monitor uptime

4. **Stop the Bot**
   - Click "⏹️ Stop Bot" button
   - Bot stops gracefully

## App Structure

```
desktop-app/
├── main.js          # Electron main process
├── preload.js       # Preload script
├── renderer.js      # UI logic
├── index.html       # UI layout
├── styles.css       # Styling
└── package.json     # Dependencies
```

## Features in Detail

### Status Indicator
- 🟢 Green = Bot running
- 🔴 Red = Bot stopped
- Pulsing animation when running

### Output Window
- Real-time bot logs
- Auto-scrolls to latest
- Monospace font for readability
- Dark theme for easy reading

### Statistics
- **Uptime**: How long bot has been running
- **Scans**: Number of DexScreener scans
- **Opportunities**: Arbitrage opportunities found
- **Trades**: Successful trades executed

## Troubleshooting

### App won't start
- Make sure Node.js is installed
- Run `npm install` in desktop-app directory
- Check that Electron installed correctly

### Bot won't start
- Check that bot/.env is configured
- Verify contract address is correct
- Check network RPC URL

### No output
- Bot may be starting up
- Check bot/.env configuration
- Verify bot script exists

## Customization

Edit `styles.css` to customize:
- Colors
- Layout
- Fonts
- Sizes

Edit `renderer.js` to add:
- More statistics
- Additional controls
- Custom features

## Next Steps

1. ✅ App created
2. ⏭️ Install dependencies: `npm install`
3. ⏭️ Run app: `npm start`
4. ⏭️ Build installer: `npm run build` (optional)

Enjoy your desktop bot controller! 🚀
