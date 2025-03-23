const express = require('express');
const router = express.Router();
const mysql = require('mysql');
require('dotenv').config();

// MySQL 연결 설정
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

// 방 생성 엔드포인트
router.post('/rooms', (req, res) => {
  const { roomName, userId, userName, password } = req.body;
  console.log('Create room request received:', roomName, userId, userName, password);

  if (!roomName || !userId || !userName) {
    res.status(400).send('방 이름, 사용자 ID와 이름을 입력해주세요.');
    return;
  }

  const createRoomQuery = 'INSERT INTO rooms (roomName, password) VALUES (?, ?)';
  db.query(createRoomQuery, [roomName, password], (err, results) => {
    if (err) {
      console.error('Error inserting into database:', err);
      res.status(500).send('Database insert error');
      return;
    }

    const roomId = results.insertId;

    // 방 생성 시 방장으로 참가
    const joinRoomQuery = 'INSERT INTO participants (roomId, userId, userName, isLeader) VALUES (?, ?, ?, ?)';
    db.query(joinRoomQuery, [roomId, userId, userName, true], (err, joinResults) => {
      if (err) {
        console.error('Error inserting into database:', err);
        res.status(500).send('Database insert error');
        return;
      }

      res.status(201).send({ status: 'Room created', roomId: roomId, roomName: roomName });
    });
  });
});

// 방 참가 엔드포인트
router.post('/rooms/:id/join', (req, res) => {
  const { id } = req.params;
  const { userId, userName, password } = req.body;

  if (!userId || !userName) {
    res.status(400).send('사용자 ID와 이름을 입력해주세요.');
    return;
  }

  const checkRoomQuery = 'SELECT * FROM rooms WHERE id = ?';
  db.query(checkRoomQuery, [id], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      res.status(500).send('Database query error');
      return;
    }

    const room = results[0];

    if (room.password && room.password !== password) {
      res.status(403).send('비밀번호가 틀렸습니다.');
      return;
    }

    const checkLeaderQuery = 'SELECT * FROM participants WHERE roomId = ? AND isLeader = TRUE';
    db.query(checkLeaderQuery, [id], (err, leaderResults) => {
      if (err) {
        console.error('Error querying database:', err);
        res.status(500).send('Database query error');
        return;
      }

      const isLeader = leaderResults.length === 0; // 방에 방장이 없으면 새로 들어오는 사람이 방장이 된다.

      const joinRoomQuery = 'INSERT INTO participants (roomId, userId, userName, isLeader) VALUES (?, ?, ?, ?)';
      db.query(joinRoomQuery, [id, userId, userName, isLeader], (err, joinResults) => {
        if (err) {
          console.error('Error inserting into database:', err);
          res.status(500).send('Database insert error');
          return;
        }
        res.status(201).send({ status: 'User joined', roomId: id, userId, userName, isLeader });
      });
    });
  });
});

// 준비 상태 업데이트 엔드포인트
router.post('/rooms/:id/ready', (req, res) => {
  const { id } = req.params;
  const { userId, isReady } = req.body;

  const updateReadyQuery = 'UPDATE participants SET isReady = ? WHERE roomId = ? AND userId = ?';
  db.query(updateReadyQuery, [isReady, id, userId], (err, results) => {
    if (err) {
      console.error('Error updating database:', err);
      res.status(500).send('Database update error');
      return;
    }
    res.status(200).send({ status: 'Ready state updated', userId, isReady });
  });
});

// 방장 권한 넘기기 엔드포인트
router.post('/rooms/:id/transfer-leadership', (req, res) => {
  const { id } = req.params;
  const { currentLeaderId, newLeaderId } = req.body;

  const revokeLeaderQuery = 'UPDATE participants SET isLeader = FALSE WHERE roomId = ? AND userId = ?';
  const assignLeaderQuery = 'UPDATE participants SET isLeader = TRUE WHERE roomId = ? AND userId = ?';

  db.query(revokeLeaderQuery, [id, currentLeaderId], (err, results) => {
    if (err) {
      console.error('Error updating database:', err);
      res.status(500).send('Database update error');
      return;
    }

    db.query(assignLeaderQuery, [id, newLeaderId], (err, results) => {
      if (err) {
        console.error('Error updating database:', err);
        res.status(500).send('Database update error');
        return;
      }
      res.status(200).send({ status: 'Leadership transferred', newLeaderId });
    });
  });
});

// 방 목록 조회 엔드포인트
router.get('/rooms', (req, res) => {
  console.log('Get rooms request received');
  const getRoomsQuery = 'SELECT id, roomName, password FROM rooms';
  db.query(getRoomsQuery, (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      res.status(500).send('Database query error');
      return;
    }
    res.send(results);
  });
});

// 방 삭제 엔드포인트
router.delete('/rooms/:id', (req, res) => {
  const { id } = req.params;
  console.log('Delete room request received for id:', id);

  const deleteParticipantsQuery = 'DELETE FROM participants WHERE roomId = ?';
  db.query(deleteParticipantsQuery, [id], (err, results) => {
    if (err) {
      console.error('Error deleting participants:', err);
      res.status(500).send('Database delete error');
      return;
    }

    const deleteScoresQuery = 'DELETE FROM scores WHERE roomId = ?';
    db.query(deleteScoresQuery, [id], (err, results) => {
      if (err) {
        console.error('Error deleting scores:', err);
        res.status(500).send('Database delete error');
        return;
      }

      const deleteRoomQuery = 'DELETE FROM rooms WHERE id = ?';
      db.query(deleteRoomQuery, [id], (err, results) => {
        if (err) {
          console.error('Error deleting room:', err);
          res.status(500).send('Database delete error');
          return;
        }

        if (results.affectedRows === 0) {
          res.status(404).send('Room not found');
          return;
        }

        res.status(200).send({ status: 'Room deleted' });
      });
    });
  });
});

// 방 참가자 목록 조회 엔드포인트
router.get('/rooms/:id/participants', (req, res) => {
  const { id } = req.params;
  console.log('Get participants request received for room id:', id);

  const getParticipantsQuery = 'SELECT userId, userName, isLeader, isReady FROM participants WHERE roomId = ?';
  db.query(getParticipantsQuery, [id], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      res.status(500).send('Database query error');
      return;
    }
    res.send(results);
  });
});

// 방 나가기 엔드포인트 추가
router.post('/rooms/:id/leave', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const leaveRoomQuery = 'DELETE FROM participants WHERE roomId = ? AND userId = ?';
  db.query(leaveRoomQuery, [id, userId], (err, results) => {
    if (err) {
      console.error('Error deleting participant from database:', err);
      res.status(500).send('Database delete error');
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).send('Participant not found in the room');
      return;
    }

    // Check if there are any participants left in the room
    const checkParticipantsQuery = 'SELECT * FROM participants WHERE roomId = ?';
    db.query(checkParticipantsQuery, [id], (err, results) => {
      if (err) {
        console.error('Error querying database:', err);
        res.status(500).send('Database query error');
        return;
      }

      if (results.length === 0) {
        // No participants left, delete the room and its scores
        const deleteScoresQuery = 'DELETE FROM scores WHERE roomId = ?';
        db.query(deleteScoresQuery, [id], (err, results) => {
          if (err) {
            console.error('Error deleting scores:', err);
            res.status(500).send('Database delete error');
            return;
          }

          const deleteRoomQuery = 'DELETE FROM rooms WHERE id = ?';
          db.query(deleteRoomQuery, [id], (err, results) => {
            if (err) {
              console.error('Error deleting room:', err);
              res.status(500).send('Database delete error');
              return;
            }

            res.status(200).send({ status: 'Room and scores deleted due to no participants' });
          });
        });
      } else {
        res.status(200).send({ status: 'Participant left', roomId: id, userId });
      }
    });
  });
});

// 게임 시작 엔드포인트 추가
router.post('/rooms/:id/start-game', (req, res) => {
  const { id } = req.params;
  console.log('Start game request received for room id:', id);

  // 현재는 단순히 게임 시작 신호를 보내는 엔드포인트를 설정합니다.
  // 실제 게임 로직이 추가된다면 이곳에 추가하면 됩니다.
  res.status(200).send({ status: 'Game started' });
});

// 점수 저장 엔드포인트
router.post('/rooms/:id/score', (req, res) => {
  const { id } = req.params;
  const { userId, score, gameName, duration } = req.body;

  // 점수를 scores 테이블에 저장
  const saveScoreQuery = 'INSERT INTO scores (roomId, userId, score, gameName, duration) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE score = VALUES(score)';
  db.query(saveScoreQuery, [id, userId, score, gameName, duration], (err, results) => {
    if (err) {
      console.error('Error saving score to database:', err);
      res.status(500).send('Database save error');
      return;
    }

    // 최고 점수를 user_high_scores 테이블에 저장
    const checkHighScoreQuery = 'SELECT * FROM user_high_scores WHERE userId = ? AND gameName = ? AND duration = ?';
    db.query(checkHighScoreQuery, [userId, gameName, duration], (err, results) => {
      if (err) {
        console.error('Error checking existing high scores:', err);
        res.status(500).send('Database query error');
        return;
      }

      if (results.length > 0) {
        // 이미 저장된 최고 점수가 있는 경우, 기존 점수와 새로운 점수를 비교하여 더 높은 점수를 저장
        const existingHighScore = results[0].highScore;
        if (score > existingHighScore) {
          const updateHighScoreQuery = `
            UPDATE user_high_scores SET highScore = ? WHERE userId = ? AND gameName = ? AND duration = ?
          `;
          db.query(updateHighScoreQuery, [score, userId, gameName, duration], (err, results) => {
            if (err) {
              console.error('Error updating high score:', err);
              res.status(500).send('Database update error');
              return;
            }
            res.status(200).send({ status: 'Score and high score updated' });
          });
        } else {
          res.status(200).send({ status: 'Score updated, high score remains the same' });
        }
      } else {
        // 저장된 최고 점수가 없는 경우, 새로 삽입
        const insertHighScoreQuery = `
          INSERT INTO user_high_scores (userId, gameName, duration, highScore)
          VALUES (?, ?, ?, ?)
        `;
        db.query(insertHighScoreQuery, [userId, gameName, duration, score], (err, results) => {
          if (err) {
            console.error('Error inserting new high score:', err);
            res.status(500).send('Database insert error');
            return;
          }
          res.status(200).send({ status: 'Score and new high score inserted' });
        });
      }
    });
  });
});

// 점수 조회 엔드포인트
router.get('/rooms/:id/scores', (req, res) => {
  const { id } = req.params;
  const { gameName, duration } = req.query; // 쿼리 파라미터로 게임 이름과 시간을 받습니다.

  const getScoresQuery = 'SELECT users.userName, scores.score, scores.gameName, scores.duration FROM scores JOIN users ON scores.userId = users.userId WHERE scores.roomId = ? AND scores.gameName = ? AND scores.duration = ? ORDER BY scores.score DESC';
  db.query(getScoresQuery, [id, gameName, duration], (err, results) => {
    if (err) {
      console.error('Error querying scores from database:', err);
      res.status(500).send('Database query error');
      return;
    }
    res.send(results);
  });
});

// 최고 점수 조회 엔드포인트
router.get('/users/:userId/high-scores', (req, res) => {
  const { userId } = req.params;

  const getHighScoresQuery = `
    SELECT
      games.gameName,
      games.duration,
      IFNULL(scores.highScore, 0) AS highScore
    FROM
      (SELECT DISTINCT gameName, duration FROM user_high_scores) AS games
    LEFT JOIN
      user_high_scores AS scores
    ON
      games.gameName = scores.gameName
      AND games.duration = scores.duration
      AND scores.userId = ?
  `;

  db.query(getHighScoresQuery, [userId], (err, results) => {
    if (err) {
      console.error('Error querying high scores:', err);
      res.status(500).send('Database query error');
      return;
    }
    res.send(results);
  });
});


// 게임 설정 저장 엔드포인트
router.post('/rooms/:id/settings', (req, res) => {
  const { id } = req.params;
  const { game, duration } = req.body;

  const updateSettingsQuery = 'UPDATE rooms SET game = ?, duration = ? WHERE id = ?';
  db.query(updateSettingsQuery, [game, duration, id], (err, results) => {
    if (err) {
      console.error('Error updating game settings:', err);
      res.status(500).send('Database update error');
      return;
    }
    res.status(200).send({ status: 'Game settings updated', game, duration });
  });
});

// 게임 설정 조회 엔드포인트
router.get('/rooms/:id/settings', (req, res) => {
  const { id } = req.params;

  const getSettingsQuery = 'SELECT game, duration FROM rooms WHERE id = ?';
  db.query(getSettingsQuery, [id], (err, results) => {
    if (err) {
      console.error('Error fetching game settings:', err);
      res.status(500).send('Database query error');
      return;
    }
    res.send(results[0]);
  });
});

// 랭킹 조회 엔드포인트 추가
router.get('/rankings', (req, res) => {
  const getRankingsQuery = `
    SELECT 
      users.userName,
      user_high_scores.gameName,
      user_high_scores.duration,
      user_high_scores.highScore 
    FROM 
      user_high_scores 
    JOIN 
      users 
    ON 
      user_high_scores.userId = users.userId 
    ORDER BY 
      user_high_scores.highScore DESC
  `;
  
  db.query(getRankingsQuery, (err, results) => {
    if (err) {
      console.error('Error querying rankings:', err);
      res.status(500).send('Database query error');
      return;
    }
    res.send(results);
  });
});


module.exports = router;
