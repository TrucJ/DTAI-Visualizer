// --- Các biến toàn cục (tham khảo global.js) ---
let radius = 10; // Mặc định, nếu cần thiết radius có thể được lấy từ dữ liệu JSON
const hexSize = 24;
let scale = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false, startDragX = 0, startDragY = 0;
let hasMoved = false;
let touchStartDistance = null;

// Các cấu hình màu sắc và nhãn (tham khảo global.js)
const tileColors = {
  danger: "red",
  shield: "skyblue",
  gold1: "#FFFF66",
  gold2: "#FFFF44",
  gold3: "#FFFF22",
  gold4: "#FFFF00",
  gold5: "#FFEE00",
  gold6: "#FFDD00"
};
const tileLabels = {
  danger: "D",
  shield: "S"
};

// Lấy đối tượng canvas (ID: hexMap)
const canvas = document.getElementById("hexMap");
const ctx = canvas.getContext("2d");

// Các đối tượng DOM trong panel và overlay
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const infoSpan = document.getElementById("info");
const uploadArea = document.getElementById("uploadArea");
const overlay = document.getElementById("uploadOverlay");
const overlayFileInput = document.getElementById("overlayFileInput");

// Dữ liệu các state (mảng các state) và state hiện tại
let states = [];
let currentState = 0;

// Cập nhật kích thước canvas theo container (sử dụng devicePixelRatio)
function updateCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  const leftPanel = document.querySelector('.left-panel');
  const width = leftPanel.clientWidth;
  const height = leftPanel.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

// Lấy tâm của canvas
function getCenter() {
  return {
    x: canvas.clientWidth / 2,
    y: canvas.clientHeight / 2
  };
}

// --- Các hàm vẽ canvas (tham khảo canvas.js) ---
// Hàm lấy tọa độ các đỉnh của hexagon
function getHexCornerCoords(cx, cy) {
  const corners = [];
  const size = hexSize * scale;
  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i - 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    corners.push({
      x: cx + size * Math.cos(angle_rad),
      y: cy + size * Math.sin(angle_rad)
    });
  }
  return corners;
}

// Vẽ hexagon tại vị trí (cx, cy) với label và màu nền
function drawHex(cx, cy, label, fillColor) {
  const corners = getHexCornerCoords(cx, cy);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  ctx.strokeStyle = "black";
  ctx.stroke();

  if (label) {
    const fontSize = 16 * scale;
    if (fontSize > 6) {
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, cy);
    }
  }
}

// Hàm chuyển đổi từ tọa độ axial sang pixel
function axialToPixel(q, r) {
  const sqrt3 = Math.sqrt(3);
  const center = getCenter();
  const x = hexSize * scale * sqrt3 * (q + r / 2);
  const y = hexSize * scale * (3 / 2 * r);
  return {x: center.x + x, y: center.y + y};
}

// Hàm cập nhật bảng thông tin các player
function updatePlayersTable(state) {
  const tableBody = document.querySelector("#playersTable tbody");
  tableBody.innerHTML = ""; // Xóa dữ liệu cũ

  state.players.forEach((player, index) => {
    const row = document.createElement("tr");

    const cellPlayer = document.createElement("td");
    cellPlayer.textContent = index + 1;
    row.appendChild(cellPlayer);

    const cellPoints = document.createElement("td");
    cellPoints.textContent = player.points;
    row.appendChild(cellPoints);

    const cellMissiles = document.createElement("td");
    const missiles = player.missiles;
    cellMissiles.textContent = missiles;
    row.appendChild(cellMissiles);

    tableBody.appendChild(row);
  });
}

// --- Hàm vẽ map (drawMap) cập nhật ---
// Sau khi vẽ map và các player, gọi updatePlayersTable(state)
function drawMap(state) {
  updateCanvasSize();
  const center = getCenter();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const map = state.map;
  radius = map.radius;

  // Tạo dictionary cho các cell có trong dữ liệu (key: "q,r,s")
  const cellMap = {};
  map.cells.forEach(cell => {
    const key = `${cell.q},${cell.r},${cell.s}`;
    cellMap[key] = cell;
  });

  // Duyệt qua tất cả các ô trong vùng có bán kính radius
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const s = -q - r;
      const key = `${q},${r},${s}`;
      const pos = axialToPixel(q, r);
      let fillColor, label = "";
      if (cellMap.hasOwnProperty(key)) {
        const cell = cellMap[key];
        label = cell.value;
        if (cell.value === "D" || cell.value === "S") {
          fillColor = tileColors[cell.value === "D" ? "danger" : "shield"];
        } else if (!isNaN(parseInt(cell.value))) {
          const count = Math.min(Math.max(parseInt(cell.value), 1), 6);
          fillColor = tileColors["gold" + count];
        } else {
          fillColor = "white";
        }
      } else {
        fillColor = "white";
      }
      drawHex(pos.x, pos.y, label, fillColor);
    }
  }

  // Vẽ treasure nếu xuất hiện
  if (map.treasure_appeared) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, 15 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = "gold";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();
    ctx.font = `bold ${14 * scale}px Arial`;
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(map.treasure_value, center.x, center.y);
  }

  // Line from player to missile targets
  state.players.forEach(player => {
    if (player.missiles_fired && player.missiles_fired.length > 0) {
      const pPos = axialToPixel(player.q, player.r);
      player.missiles_fired.forEach(missile => {
        const mPos = axialToPixel(missile.q, missile.r);
        ctx.beginPath();
        ctx.moveTo(pPos.x, pPos.y);
        ctx.lineTo(mPos.x, mPos.y);
        ctx.strokeStyle = "orangered";
        ctx.stroke();
      });
    }
  });

  // Vẽ các player
  state.players.forEach(player => {
    const pos = axialToPixel(player.q, player.r);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 12 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = player.alive ? "limegreen" : "gray";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();

    ctx.font = `bold ${12 * scale}px Arial`;
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.points, pos.x, pos.y);

    if (player.shield) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 15 * scale, 0, 2 * Math.PI);
      ctx.strokeStyle = "dodgerblue";
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  });

  // Vẽ các missiles
  state.players.forEach(player => {
    if (player.missiles_fired && player.missiles_fired.length > 0) {
      player.missiles_fired.forEach(missile => {
        const mPos = axialToPixel(missile.q, missile.r);
        // Vòng tròn ngoài
        ctx.beginPath();
        ctx.arc(mPos.x, mPos.y, 8 * scale, 0, 2 * Math.PI);
        ctx.fillStyle = "orangered";
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.stroke();
        // Vòng tròn trong
        ctx.beginPath();
        ctx.arc(mPos.x, mPos.y, 4 * scale, 0, 2 * Math.PI);
        ctx.fillStyle = "yellow";
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.stroke();
      });
    }
  });

  infoSpan.textContent = `Moves left: ${map.moveleft} | State: ${currentState + 1} / ${states.length}`;
  // Cập nhật bảng player
  updatePlayersTable(state);
}

// --- Xử lý sự kiện canvas: kéo, zoom, touch ---
// Drag
canvas.addEventListener("mousedown", function (event) {
  isDragging = true;
  hasMoved = false;
  startDragX = event.clientX;
  startDragY = event.clientY;
  canvas.style.cursor = "grabbing";
});
canvas.addEventListener("mousemove", function (event) {
  if (isDragging) {
    const dx = event.clientX - startDragX;
    const dy = event.clientY - startDragY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasMoved = true;
    }
    offsetX += dx;
    offsetY += dy;
    startDragX = event.clientX;
    startDragY = event.clientY;
    drawMap(states[currentState]);
  }
});
canvas.addEventListener("mouseup", function () {
  isDragging = false;
  canvas.style.cursor = "grab";
});
canvas.addEventListener("mouseleave", function () {
  isDragging = false;
  canvas.style.cursor = "grab";
});
// Zoom
canvas.addEventListener("wheel", function (event) {
  event.preventDefault();
  if (event.deltaY < 0) {
    scale *= 1.05;
  } else {
    scale /= 1.05;
  }
  drawMap(states[currentState]);
});
// Touch zoom
canvas.addEventListener("touchstart", function (event) {
  if (event.touches.length === 2) {
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    touchStartDistance = Math.sqrt(dx * dx + dy * dy);
  }
});
canvas.addEventListener("touchmove", function (event) {
  if (event.touches.length === 2 && touchStartDistance !== null) {
    event.preventDefault();
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    const newDistance = Math.sqrt(dx * dx + dy * dy);
    const scaleFactor = newDistance / touchStartDistance;
    scale *= scaleFactor;
    touchStartDistance = newDistance;
    drawMap(states[currentState]);
  }
});
canvas.addEventListener("touchend", function (event) {
  if (event.touches.length < 2) {
    touchStartDistance = null;
  }
});

// Cập nhật kích thước canvas khi load và resize
window.addEventListener('load', function () {
  updateCanvasSize();
  if (states.length > 0) drawMap(states[currentState]);
});
window.addEventListener('resize', updateCanvasSize);

// --- Xử lý các button Next / Previous ---
function updateButtons() {
  prevBtn.disabled = currentState <= 0;
  nextBtn.disabled = currentState >= states.length - 1;
}

prevBtn.addEventListener('click', function () {
  if (currentState > 0) {
    currentState--;
    drawMap(states[currentState]);
    updateButtons();
  }
});
nextBtn.addEventListener('click', function () {
  if (currentState < states.length - 1) {
    currentState++;
    drawMap(states[currentState]);
    updateButtons();
  }
});

// --- Xử lý file upload từ overlay ---
uploadArea.addEventListener("click", function() {
  overlayFileInput.click();
});
// Xử lý sự kiện kéo thả (drag & drop)
uploadArea.addEventListener("dragover", function(e) {
  e.preventDefault();
  uploadArea.style.backgroundColor = "#f0f0f0";
});
uploadArea.addEventListener("dragleave", function(e) {
  e.preventDefault();
  uploadArea.style.backgroundColor = "";
});
uploadArea.addEventListener("drop", function(e) {
  e.preventDefault();
  uploadArea.style.backgroundColor = "";
  const file = e.dataTransfer.files[0];
  if (file) {
    overlayFileInput.files = e.dataTransfer.files;
    // Gọi xử lý file upload (như đã định nghĩa trong phần xử lý overlayFileInput)
    const event = new Event('change');
    overlayFileInput.dispatchEvent(event);
  }
});
overlayFileInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      // File JSON phải có cấu trúc là 1 mảng các state
      states = JSON.parse(evt.target.result);
      if (!Array.isArray(states) || states.length === 0) {
        alert("File JSON không hợp lệ hoặc rỗng!");
        return;
      }
      currentState = 0;
      drawMap(states[currentState]);
      updateButtons();
      // Ẩn overlay sau khi upload thành công
      overlay.style.display = "none";
    } catch (err) {
      alert("Lỗi đọc file JSON: " + err.message);
    }
  };
  reader.readAsText(file);
});
