const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let clients = new Set();

let gameState = {
  players: {},
  grid: [],
  gridSize: 10,
};

function initGrid() {
  gameState.grid = [];
  for (let i = 0; i < gameState.gridSize * gameState.gridSize; i++) {
    gameState.grid.push(null);
  }
}

initGrid();

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

wss.on('connection', ws => {
  clients.add(ws);
  const playerId = Date.now().toString();
  gameState.players[playerId] = { id: playerId, color: getRandomColor(), name: `Player-${playerId.slice(-4)}` };
  ws.send(JSON.stringify({ type: 'init', state: gameState, playerId }));

  broadcast({ type: 'players', players: gameState.players });

  ws.on('message', message => {
    const data = JSON.parse(message);
    if (data.type === 'claim') {
      const { index, playerId } = data;
      if (canClaimTile(index, playerId)) {
        gameState.grid[index] = playerId;
        broadcast({ type: 'updateGrid', grid: gameState.grid });
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    delete gameState.players[playerId];
    broadcast({ type: 'players', players: gameState.players });
  });
});

function canClaimTile(index, playerId) {
  if (gameState.grid[index] !== null) return false;
  // Simple adjacency check: must be adjacent to owned tile or no owned tiles yet
  const size = gameState.gridSize;
  const adjacentIndices = [
    index - 1,
    index + 1,
    index - size,
    index + size,
  ].filter(i => i >= 0 && i < size * size);

  // If player has no tiles yet, allow claim anywhere
  if (!gameState.grid.includes(playerId)) return true;

  return adjacentIndices.some(i => gameState.grid[i] === playerId);
}

function getRandomColor() {
  const colors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0'];
  return colors[Math.floor(Math.random() * colors.length)];
}

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
