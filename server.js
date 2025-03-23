const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');
const roomRoutes = require('./room'); // room.js 파일 임포트
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});  

db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    throw err;
  }
  console.log('MySQL Connected...');
});

// 로그인 엔드포인트
app.post('/login', (req, res) => {
  const { userId, userName } = req.body;
  console.log('Login request received:', userId, userName);

  const checkUserQuery = 'SELECT * FROM users WHERE userId = ?';
  db.query(checkUserQuery, [userId], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      res.status(500).send('Database query error');
      return;
    }

    if (results.length > 0) {
      res.send({ status: 'loggedIn', userId, userName });
    } else {
      const insertUserQuery = 'INSERT INTO users (userId, userName) VALUES (?, ?)';
      db.query(insertUserQuery, [userId, userName], (err, results) => {
        if (err) {
          console.error('Error inserting into database:', err);
          res.status(500).send('Database insert error');
          return;
        }
        res.send({ status: 'registered', userId, userName });
      });
    }
  });
});

// 방 라우트 사용
app.use('/api', roomRoutes);

const PORT = 80;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// WebSocket 서버 설정
const wss = new WebSocket.Server({ server });

const clients = {};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);

    if (parsedMessage.type === 'join') {
      const roomId = parsedMessage.roomId;
      if (!clients[roomId]) {
        clients[roomId] = [];
      }
      clients[roomId].push(ws);
    }

    if (parsedMessage.type === 'start-game') {
      const roomId = parsedMessage.roomId;
      const game = parsedMessage.game;
      const duration = parsedMessage.duration;
      if (clients[roomId]) {
        clients[roomId].forEach(client => {
          client.send(JSON.stringify({ type: 'game-started', roomId, game, duration }));
        });
      }
    }
  });

  ws.on('close', () => {
    for (const roomId in clients) {
      clients[roomId] = clients[roomId].filter(client => client !== ws);
    }
  });
});