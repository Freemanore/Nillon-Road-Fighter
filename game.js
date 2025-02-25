class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.score = 0;
    this.gameOver = false;
    this.gameStarted = false;
    this.startScreenAlpha = 1.0;
    this.roadOffset = 0;
    this.roadSpeed = 5;
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 60;
    this.signOffset = 0;
    this.swerveOffset = 0;
    this.swerveSpeed = 0;
    this.baseSpeed = 5; // Initial game speed
    this.gameStartTime = Date.now(); // Track game start time
    this.bullets = [];
    this.ammo = 15;
    this.maxAmmo = 15;
    this.lastAmmoRefillTime = Date.now();
    this.powerUps = [];
    this.speedReductionActive = false;
    this.speedReductionEndTime = 0;
    this.startScreenAlpha = 1.0; // For fade effect

    // Player car
    this.player = {
      x: this.canvas.width / 2 - 15,
      y: this.canvas.height - 100,
      width: 40, // Bus width
      height: 80, // Made the bus longer
      speed: 5,
      color: "#ff0000",
    };

    // Array to store enemy cars
    this.enemies = [];

    // Input handling
    this.keys = {};
    window.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;
      if (e.code === "Space" && this.ammo > 0) {
        this.shoot();
      }
    });
    window.addEventListener("keyup", (e) => (this.keys[e.key] = false));

    // Start the game loop
    this.gameLoop();
  }

  update() {
    if (!this.gameStarted) {
      if (Object.keys(this.keys).length > 0) {
        this.gameStarted = true;
      }
      return;
    }
    if (this.gameOver) return;

    // Calculate elapsed time in seconds
    const elapsedTime = (Date.now() - this.gameStartTime) / 1000;

    // Time-based difficulty scaling (30% tougher)
    const timeMultiplier = 1 + elapsedTime / 20; // Increase difficulty every 20 seconds (faster scaling)
    const scoreMultiplier = 1 + this.score / 350; // More aggressive score-based scaling
    const combinedMultiplier = Math.min(
      3.9,
      (timeMultiplier + scoreMultiplier) / 2
    ); // Higher difficulty cap

    // Update road animation with combined speed scaling
    this.roadOffset =
      (this.roadOffset + this.roadSpeed * combinedMultiplier) % 40;
    this.signOffset =
      (this.signOffset + this.roadSpeed * combinedMultiplier) % 240;

    // Adjust enemy spawn rate based on time (30% faster spawning)
    this.enemySpawnInterval = Math.max(15, 45 - Math.floor(elapsedTime / 10)); // Decrease interval every 10 seconds, minimum 15

    // Rest of update logic
    if (this.keys["ArrowLeft"] && this.player.x > 60) {
      this.swerveSpeed = Math.max(this.swerveSpeed - 0.05, -1.2); // Smoother acceleration
    } else if (
      this.keys["ArrowRight"] &&
      this.player.x < this.canvas.width - 90
    ) {
      this.swerveSpeed = Math.min(this.swerveSpeed + 0.05, 1.2); // Smoother acceleration
    } else {
      this.swerveSpeed *= 0.95; // Smoother deceleration
    }

    this.swerveOffset += this.swerveSpeed;
    this.player.x += this.swerveSpeed * (this.player.speed * 0.9); // Smoother movement speed

    // Keep player within bounds
    this.player.x = Math.max(
      60,
      Math.min(this.canvas.width - 90, this.player.x)
    );

    // Spawn enemies
    this.enemySpawnTimer++;
    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.spawnEnemy();
      this.enemySpawnTimer = 0;
    }

    // Increase game speed based on score
    const speedMultiplier = 1 + this.score / 500; // Increase speed every 500 points
    this.roadSpeed = this.baseSpeed * speedMultiplier;

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const enemySpeedMultiplier = this.speedReductionActive ? 0.5 : 1;
      enemy.y += enemy.speed * combinedMultiplier * enemySpeedMultiplier;

      // Prevent collisions between enemies
      for (let j = 0; j < this.enemies.length; j++) {
        if (i !== j) {
          const other = this.enemies[j];
          const verticalDist = Math.abs(enemy.y - other.y);
          const horizontalDist = Math.abs(enemy.x - other.x);

          if (verticalDist < 60 && horizontalDist < 40) {
            // Adjust horizontal position to prevent overlap
            if (enemy.x < other.x) {
              enemy.x = Math.max(60, enemy.x - 1);
            } else {
              enemy.x = Math.min(this.canvas.width - 90, enemy.x + 1);
            }
          }
        }
      }

      // Remove enemies that are off screen
      if (enemy.y > this.canvas.height) {
        this.enemies.splice(i, 1);
        this.score += 10;
        document.getElementById("score").textContent = `$NIL: ${this.score}`;
      }

      // Check for collision
      if (this.checkCollision(this.player, enemy)) {
        this.gameOver = true;
      }
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.y -= bullet.speed;

      // Remove bullets that are off screen
      if (bullet.y < 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check for collision with enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (this.checkCollision(bullet, enemy)) {
          // Create explosion effect
          this.drawExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
          // Remove both bullet and enemy
          this.bullets.splice(i, 1);
          this.enemies.splice(j, 1);
          this.score += 20;
          document.getElementById("score").textContent = `$NIL: ${this.score}`;
          break;
        }
      }
    }

    // Update power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      powerUp.y += powerUp.speed;

      // Remove power-ups that are off screen
      if (powerUp.y > this.canvas.height) {
        this.powerUps.splice(i, 1);
        continue;
      }

      // Check for collision with player
      if (this.checkCollision(this.player, powerUp)) {
        if (powerUp.type === 'ammo') {
          this.ammo = Math.min(this.maxAmmo, this.ammo + 15);
          this.lastAmmoRefillTime = Date.now();
        } else if (powerUp.type === 'slowdown') {
          this.speedReductionActive = true;
          this.speedReductionEndTime = Date.now() + 5000; // 5 seconds duration
        }
        this.powerUps.splice(i, 1);
      }
    }

    // Handle ammo depletion
    if (Date.now() - this.lastAmmoRefillTime > 60000) { // 1 minute
      this.ammo = 0;
    }

    // Handle speed reduction power-up
    if (this.speedReductionActive && Date.now() > this.speedReductionEndTime) {
      this.speedReductionActive = false;
    }

    // Spawn power-ups occasionally
    if (Math.random() < 0.002) { // Reduced spawn rate for power-ups
      this.spawnPowerUp();
    }

    // Apply speed reduction effect (only affects road animation)
    const effectiveSpeed = this.speedReductionActive ? 0.5 : 1;
    this.roadSpeed = this.baseSpeed * speedMultiplier * effectiveSpeed;

  }

  draw() {
    // Clear canvas
    this.ctx.fillStyle = "#404040";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.gameStarted) {
      // Draw start screen
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "16px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        "Can you securely deliver the warriors",
        this.canvas.width / 2,
        this.canvas.height / 2 - 20
      );
      this.ctx.fillText(
        "to ETH Denver?",
        this.canvas.width / 2,
        this.canvas.height / 2
      );
      this.ctx.fillText(
        "We'll see...",
        this.canvas.width / 2,
        this.canvas.height / 2 + 20
      );
      this.ctx.font = "12px Arial";
      this.ctx.fillText(
        "Press any key to start",
        this.canvas.width / 2,
        this.canvas.height / 2 + 50
      );
      return;
    }

    // Draw road
    this.ctx.fillStyle = "#808080";
    this.ctx.fillRect(50, 0, this.canvas.width - 100, this.canvas.height);

    // Draw road lines
    this.ctx.fillStyle = "#ffffff";
    for (let y = -40 + this.roadOffset; y < this.canvas.height; y += 40) {
      this.ctx.fillRect(this.canvas.width / 2 - 2, y, 4, 20);
    }

    // Draw road signs
    for (let y = -120 + this.signOffset; y < this.canvas.height; y += 240) {
      // Left sign (hexagonal)
      this.ctx.fillStyle = "#FF0000";
      this.ctx.beginPath();
      const leftX = 25;
      const rightX = this.canvas.width - 25; // Define rightX for the right sign
      const size = 25;
      this.drawHexagonalSign(leftX, y + 20, size);
      this.ctx.fill();

      // Left sign text
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.font = "bold 8px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText("ETH", leftX, y + 12);
      this.ctx.fillText("Denver", leftX, y + 18);

      // Left sign arrow
      this.ctx.beginPath();
      this.ctx.moveTo(leftX - 2, y + 35);
      this.ctx.lineTo(leftX + 2, y + 35);
      this.ctx.lineTo(leftX + 2, y + 31);
      this.ctx.lineTo(leftX + 10, y + 31);
      this.ctx.lineTo(leftX, y + 25);
      this.ctx.lineTo(leftX - 10, y + 31);
      this.ctx.lineTo(leftX - 2, y + 31);
      this.ctx.closePath();
      this.ctx.fill();

      // Right sign (hexagonal)
      this.ctx.fillStyle = "#FF0000";
      this.ctx.beginPath();
      this.drawHexagonalSign(rightX, y + 20, size);
      this.ctx.fill();

      // Right sign text
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.font = "bold 8px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText("ETH", rightX, y + 12);
      this.ctx.fillText("Denver", rightX, y + 18);

      // Right sign arrow
      this.ctx.beginPath();
      this.ctx.moveTo(rightX - 6, y + 35);
      this.ctx.lineTo(rightX + 6, y + 35);
      this.ctx.lineTo(rightX + 6, y + 31);
      this.ctx.lineTo(rightX + 10, y + 31);
      this.ctx.lineTo(rightX, y + 25);
      this.ctx.lineTo(rightX - 10, y + 31);
      this.ctx.lineTo(rightX - 6, y + 31);
      this.ctx.closePath();
      this.ctx.fill();
    }

    // Draw player (bus)
    this.drawBus(this.player.x, this.player.y);

    // Draw enemies (race cars)
    this.enemies.forEach((enemy) => {
      this.drawRaceCar(enemy.x, enemy.y, enemy.color);
    });

    // Draw bullets
    this.bullets.forEach(bullet => {
      this.drawBullet(bullet.x, bullet.y);
    });

    // Draw power-ups
    this.powerUps.forEach(powerUp => {
      this.drawPowerUp(powerUp);
    });

    // Draw ammo counter
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "left";
    this.ctx.fillText(`Ammo: ${this.ammo}`, 10, this.canvas.height - 10);

    // Draw game over message
    if (this.gameOver) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "30px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        "Game Over!",
        this.canvas.width / 2,
        this.canvas.height / 2
      );
      this.ctx.font = "20px Arial";
      this.ctx.fillText(
        "Press R to restart",
        this.canvas.width / 2,
        this.canvas.height / 2 + 40
      );
    }
  }

  drawBus(x, y) {
    // Main bus body - vintage style
    this.ctx.fillStyle = "#D4AF37"; // Classic gold color
    this.ctx.fillRect(x, y, 40, 80);

    // Front grille (black)
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(x + 5, y + 75, 30, 5);

    // Windows (rounded corners effect)
    this.ctx.fillStyle = "#87CEEB";
    // Front window
    this.ctx.fillRect(x + 5, y + 5, 30, 15);
    // Side windows (3 on each side)
    for (let i = 0; i < 3; i++) {
      this.ctx.fillRect(x, y + 25 + i * 18, 5, 12);
      this.ctx.fillRect(x + 35, y + 25 + i * 18, 5, 12);
    }

    // Wheels with chrome hubcaps
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(x - 2, y + 10, 4, 10);
    this.ctx.fillRect(x + 38, y + 10, 4, 10);
    this.ctx.fillRect(x - 2, y + 60, 4, 10);
    this.ctx.fillRect(x + 38, y + 60, 4, 10);

    // Chrome hubcaps
    this.ctx.fillStyle = "#C0C0C0";
    this.ctx.fillRect(x - 1, y + 13, 2, 4);
    this.ctx.fillRect(x + 39, y + 13, 2, 4);
    this.ctx.fillRect(x - 1, y + 63, 2, 4);
    this.ctx.fillRect(x + 39, y + 63, 2, 4);

    // Nillion Logo (exact SVG path)
    this.ctx.fillStyle = "#0066FF";
    this.ctx.save(); // Save the current context state
    this.ctx.beginPath();
    this.ctx.translate(x + 6, y + 20);
    this.ctx.scale(0.8, 0.8);
    this.ctx.moveTo(10.6614, 27.8172);
    this.ctx.lineTo(10.6614, 52.5676);
    this.ctx.lineTo(0, 52.5676);
    this.ctx.lineTo(0, 19.0785);
    this.ctx.lineTo(33.5243, 19.0785);
    this.ctx.lineTo(33.5243, 52.5676);
    this.ctx.lineTo(22.8644, 52.5676);
    this.ctx.lineTo(22.8644, 27.8172);
    this.ctx.lineTo(10.6614, 27.8172);
    this.ctx.fill();
    this.ctx.restore(); // Restore the context state instead of manually resetting the transform
  }

  drawRaceCar(x, y, color) {
    // Car body
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x + 5, y, 20, 40);

    // Car top
    this.ctx.fillRect(x + 8, y + 10, 14, 20);

    // Windows
    this.ctx.fillStyle = "#87CEEB";
    this.ctx.fillRect(x + 10, y + 15, 10, 10);

    // Wheels
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(x + 2, y + 5, 4, 8);
    this.ctx.fillRect(x + 24, y + 5, 4, 8);
    this.ctx.fillRect(x + 2, y + 27, 4, 8);
    this.ctx.fillRect(x + 24, y + 27, 4, 8);

    // Spoiler
    this.ctx.fillStyle = "#FF0000";
    this.ctx.fillRect(x + 3, y, 24, 3);
  }

  shoot() {
    if (this.ammo > 0) {
      const bullet = {
        x: this.player.x + this.player.width / 2 - 2,
        y: this.player.y,
        width: 4,
        height: 10,
        speed: 8,
      };
      this.bullets.push(bullet);
      this.ammo--;
    }
  }

  spawnPowerUp() {
    const roadWidth = this.canvas.width - 100;
    const laneWidth = roadWidth / 3;
    const leftEdge = 50;
    const lanes = [
      leftEdge + laneWidth / 2,
      leftEdge + laneWidth * 1.5,
      leftEdge + laneWidth * 2.5,
    ];
    const selectedLane = lanes[Math.floor(Math.random() * lanes.length)];
    const powerUp = {
      x: selectedLane,
      y: -30,
      width: 20,
      height: 20,
      type: Math.random() < 0.5 ? 'ammo' : 'slowdown',
      speed: 3,
    };
    this.powerUps.push(powerUp);
  }

  drawBullet(x, y) {
    // Draw candle body (larger and more prominent)
    this.ctx.fillStyle = "#FF4500";
    this.ctx.fillRect(x - 1, y, 6, 15);
    
    // Draw candle borders (thicker outline)
    this.ctx.strokeStyle = "#8B0000";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - 1, y, 6, 15);
    
    // Draw candle wicks (more prominent)
    this.ctx.fillStyle = "#8B0000";
    // Upper wick (thicker)
    this.ctx.fillRect(x + 1.5, y - 4, 2, 4);
    // Lower wick (thicker)
    this.ctx.fillRect(x + 1.5, y + 15, 2, 4);
    
    // Add glow effect
    const gradient = this.ctx.createRadialGradient(x + 2, y + 7.5, 0, x + 2, y + 7.5, 10);
    gradient.addColorStop(0, 'rgba(255, 69, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x + 2, y + 7.5, 10, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawPowerUp(powerUp) {
    if (powerUp.type === 'ammo') {
      // Draw two parallel red candles with variations
      const candleWidth = 4;
      const spacing = 4;
      const x1 = powerUp.x - spacing;
      const x2 = powerUp.x + spacing;
      
      // First candle (slightly taller)
      this.ctx.fillStyle = '#FF4444';
      this.ctx.fillRect(x1 - candleWidth/2, powerUp.y - 8, candleWidth, 16);
      // Wick
      this.ctx.fillRect(x1, powerUp.y - 12, 1, 4);
      this.ctx.fillRect(x1, powerUp.y + 8, 1, 4);
      
      // Second candle (slightly shorter but wider)
      this.ctx.fillStyle = '#FF0000';
      this.ctx.fillRect(x2 - (candleWidth+1)/2, powerUp.y - 6, candleWidth + 1, 12);
      // Wick
      this.ctx.fillRect(x2, powerUp.y - 10, 1, 4);
      this.ctx.fillRect(x2, powerUp.y + 6, 1, 4);
      
      // Add glow effect
      const gradient = this.ctx.createRadialGradient(powerUp.x, powerUp.y, 0, powerUp.x, powerUp.y, 12);
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(powerUp.x, powerUp.y, 12, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Draw a green trading candle for speed power-up
      this.ctx.fillStyle = '#32CD32';
      this.ctx.fillRect(powerUp.x - 3, powerUp.y - 10, 6, 20);
      
      // Add glow effect
      const gradient = this.ctx.createRadialGradient(powerUp.x, powerUp.y, 0, powerUp.x, powerUp.y, 15);
      gradient.addColorStop(0, 'rgba(50, 205, 50, 0.2)');
      gradient.addColorStop(1, 'rgba(50, 205, 50, 0)');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(powerUp.x, powerUp.y, 15, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawExplosion(x, y) {
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 20);
    gradient.addColorStop(0, '#FFFF00');
    gradient.addColorStop(0.5, '#FF4500');
    gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 20, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawHexagonalSign(x, y, size) {
    const angle = Math.PI / 3;
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const xPos = x + size * Math.cos(i * angle);
      const yPos = y + size * Math.sin(i * angle);
      if (i === 0) {
        this.ctx.moveTo(xPos, yPos);
      } else {
        this.ctx.lineTo(xPos, yPos);
      }
    }
    this.ctx.closePath();
  }

  spawnEnemy() {
    // Ensure minimum vertical distance between enemies
    const minVerticalDistance = 100;
    let canSpawn = true;

    // Check if there's enough space
    for (const enemy of this.enemies) {
      if (Math.abs(enemy.y - -50) < minVerticalDistance) {
        canSpawn = false;
        break;
      }
    }

    if (canSpawn) {
      // Calculate road width and lane positions
      const roadWidth = this.canvas.width - 100; // Total road width
      const laneWidth = roadWidth / 3; // Width of each lane
      const leftEdge = 50; // Left edge of the road

      // Define lane center positions
      const lanes = [
        leftEdge + laneWidth / 2, // Left lane center
        leftEdge + laneWidth * 1.5, // Middle lane center
        leftEdge + laneWidth * 2.5, // Right lane center
      ];

      // Select a random lane with equal probability
      const selectedLane = lanes[Math.floor(Math.random() * lanes.length)];

      // Add controlled randomness within the lane (+/- 15 pixels)
      const randomOffset = (Math.random() - 0.5) * 30;

      // Calculate final x position with bounds checking
      const finalX = Math.max(
        leftEdge + 10, // Keep away from left edge
        Math.min(
          this.canvas.width - 60, // Keep away from right edge
          selectedLane + randomOffset
        )
      );

      const enemy = {
        x: finalX,
        y: -50,
        width: 20, // Adjusted to match the race car visual width
        height: 40, // Adjusted to match the race car visual height
        speed: 4 + Math.random() * 2.6, // 30% faster enemy cars
        color: "#" + Math.floor(Math.random() * 16777215).toString(16),
      };
      this.enemies.push(enemy);
    }
  }

  checkCollision(rect1, rect2) {
    // Get the actual visual dimensions for both objects
    const isPlayer1 = rect1 === this.player;
    const isPlayer2 = rect2 === this.player;

    // Player bus dimensions (including wheels)
    const player = {
      width: 44, // 40 body + 2 wheels on each side
      height: 80, // Adjusted for longer bus
      wheelOffset: 2,
    };

    // Enemy car dimensions (including wheels and spoiler)
    const enemy = {
      width: 30, // 24 body + wheels
      height: 43, // 40 body + 3 spoiler
      wheelOffset: 2,
    };

    // Calculate actual boundaries for first rectangle
    const rect1Bounds = {
      left: rect1.x - (isPlayer1 ? player.wheelOffset : enemy.wheelOffset),
      right: rect1.x + (isPlayer1 ? player.width : enemy.width),
      top: rect1.y,
      bottom: rect1.y + (isPlayer1 ? player.height : enemy.height),
    };

    // Calculate actual boundaries for second rectangle
    const rect2Bounds = {
      left: rect2.x - (isPlayer2 ? player.wheelOffset : enemy.wheelOffset),
      right: rect2.x + (isPlayer2 ? player.width : enemy.width),
      top: rect2.y,
      bottom: rect2.y + (isPlayer2 ? player.height : enemy.height),
    };

    // Check for collision using actual visual boundaries
    return (
      rect1Bounds.left < rect2Bounds.right &&
      rect1Bounds.right > rect2Bounds.left &&
      rect1Bounds.top < rect2Bounds.bottom &&
      rect1Bounds.bottom > rect2Bounds.top
    );
  }

  gameLoop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.gameLoop());
  }

  restart() {
    this.score = 0;
    document.getElementById("score").textContent = "$NIL: 0";
    this.gameOver = false;
    this.enemies = [];
    this.bullets = [];
    this.powerUps = [];
    this.ammo = this.maxAmmo;
    this.lastAmmoRefillTime = Date.now();
    this.speedReductionActive = false;
    this.speedReductionEndTime = 0;
    this.player.x = this.canvas.width / 2 - 15;
    this.player.y = this.canvas.height - 100;
    this.gameStartTime = Date.now(); // Reset game start time on restart
  }
}

// Initialize the game
const game = new Game();

// Add restart functionality
window.addEventListener("keydown", (e) => {
  if (e.key === "r" && game.gameOver) {
    game.restart();
  }
});
