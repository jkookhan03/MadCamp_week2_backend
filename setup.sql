CREATE DATABASE IF NOT EXISTS mad_week2;

USE mad_week2;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  userName VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (userId)
);

CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roomName VARCHAR(255) NOT NULL,
  password VARCHAR(255) DEFAULT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  game VARCHAR(255) DEFAULT 'tab_game',
  duration INT DEFAULT 20
);

CREATE TABLE participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255),
  roomId INT,
  userName VARCHAR(255),
  isLeader BOOLEAN DEFAULT FALSE,
  isReady BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (userId) REFERENCES users(userId),
  FOREIGN KEY (roomId) REFERENCES rooms(id),
  joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roomId INT,
  userId VARCHAR(255),
  score INT,
  gameName VARCHAR(255),
  duration INT,
  FOREIGN KEY (userId) REFERENCES users(userId),
  FOREIGN KEY (roomId) REFERENCES rooms(id),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_high_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(255),
  gameName VARCHAR(255),
  duration INT,
  highScore INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(userId)
);

-- 기본 게임 종류와 시간을 저장할 테이블
CREATE TABLE game_defaults (
  gameName VARCHAR(255),
  duration INT
);

-- 기본 게임 종류와 시간 데이터 삽입
INSERT INTO game_defaults (gameName, duration) VALUES
  ('Tab Game', 10),
  ('Tab Game', 20),
  ('Tab Game', 30),
  ('Balloon Game', 10),
  ('Balloon Game', 20),
  ('Balloon Game', 30),
  ('Star Game', 10),
  ('Star Game', 20),
  ('Star Game', 30);

-- 트리거 생성
DELIMITER //

CREATE TRIGGER after_user_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO user_high_scores (userId, gameName, duration, highScore)
  SELECT NEW.userId, gameName, duration, 0 FROM game_defaults;
END //

DELIMITER ;