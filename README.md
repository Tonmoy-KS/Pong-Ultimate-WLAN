# Pong Ultimate: WLAN Edition

A feature-rich multiplayer Pong game for web browsers, supporting local play, advanced AI, WAN multiplayer, tournaments, player profiles, lifetime stats, leaderboards, avatars, chat, achievements, and more.

![Logo](.images/file_000000009e0061faa0be6c0f399832d7.png)

## Features

- **Player Profiles:** Nickname, skin, avatar (default or upload), persistent lifetime stats.
- **Avatars:** Choose from cool defaults or upload your own.
- **Tournaments:** WAN tournament brackets, champion display, bracket progression.
- **WAN Multiplayer:** Play with friends over LAN/WAN using the WebSocket server.
- **Advanced AI:** Multiple difficulty levels, learning/adaptive mode, personalities.
- **Power-Ups:** Speed, shrink/grow paddle, multi-ball, slow, invisibility, reverse, crazy ball, and more.
- **Lifetime Statistics:** Games played, wins, losses, win rate, goals, power-ups, saves, tournaments, streaks.
- **Leaderboards:** Persistent global leaderboard (top 50).
- **Achievements:** Unlockable achievements for milestones and special events.
- **Custom Skins & Events:** Multiple paddle, ball, and background skins with seasonal event modes.
- **Chat:** Colorful, in-game chat for multiplayer matches.
- **Replay System:** Save and replay your games locally.
- **Settings:** Adjust power-up frequency, ball speed, paddle size, and custom rules.
- **Accessibility:** Assist mode, touch and keyboard controls, responsive UI.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Tonmoy-KS/WLAN-PingPong.git
cd WLAN-PingPong
```

### 2. Install Server Dependencies

```bash
npm install ws
```

### 3. Start the WebSocket Server

```bash
node server.js
```

The server runs on `ws://localhost:8080` by default.  
To play WAN multiplayer, ensure this port is accessible to other devices (port forwarding/firewall).

### 4. Run in Browser

Open `index.html` in your browser (Chrome recommended).

### 5. Avatars

Add your avatar images to the `avatars` folder. Default avatars are included.

## How to Play

- **Local/Offline:** Click **"Play vs AI"** and choose your AI difficulty.
- **WAN Multiplayer:** Click **"Find Match"**. The server will pair you with another player.
- **Tournaments:** Click **"Tournament"** to view brackets and join scheduled matches.
- **Profile:** Customize your nickname, avatar, and skin. Lifetime stats are persistent.
- **Settings:** Tune ball speed, paddle size, and power-up frequency.
- **Leaderboards:** Click **"Leaderboard"** to see top players and stats.

## Folder Structure

```
./
├── index.html
├── style.css
├── game.js
├── server.js
├── avatars/
│   ├── default.png
│   ├── cat.png
│   ├── dog.png
│   ├── alien.png
│   └── robot.png
├── images/
│   └── main.png
├── README.md
```

## Server Features

- Player profile management
- Persistent leaderboard and tournament data (`pong-server-data.json`)
- WAN matchmaking and bracket scheduling
- Tournament creation and champion display

## Browser Compatibility

- Desktop: Chrome, Firefox, Edge recommended
- Mobile: Touch controls supported; landscape mode recommended

## Contributing

Pull requests welcome!  
Please open an issue for bug reports, feature requests, or questions.

## License

MIT License

---

© 2025 Tonmoy-KS