const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory score storage for leaderboard mock
const scoreStore = new Map();

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Score & Leaderboard Proxy Mock (matches dreamlo proxy and moku-scores client)
app.all(['/proxy', '/api/scores'], (req, res) => {
  const query = { ...req.query, ...req.body };
  const gameId = query.gameId || 'default';
  const action = query.action;

  if (action === 'submit') {
    const score = parseInt(query.score, 10) || 0;
    const name = String(query.name || 'Moku');
    const level = parseInt(query.seconds, 10) || parseInt(query.level, 10) || 1;

    if (!scoreStore.has(gameId)) {
      scoreStore.set(gameId, []);
    }
    const list = scoreStore.get(gameId);
    list.push({
      playerName: name,
      score,
      level,
      date: new Date().toISOString(),
    });
    list.sort((a, b) => b.score - a.score);
    return res.json({ submitted: true });
  }

  // Action: get / top ranking
  const limit = Math.min(parseInt(query.limit, 10) || 25, 50);
  const list = (scoreStore.get(gameId) || []).slice(0, limit);
  const ranking = list.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  res.json({ gameId, ranking });
});

// Serve static files from repository root
app.use(express.static(path.join(__dirname), {
  extensions: ['html', 'htm']
}));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Moku Series server running on http://${HOST}:${PORT}`);
});
