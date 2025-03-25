const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const infoSpan = document.getElementById('info');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// Các cấu hình cơ bản cho vẽ hexagon
const hexSize = 30; // bán kính hexagon
let scale = 1;
const sqrt3 = Math.sqrt(3);
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

// Màu sắc cho các loại ô (cells)
const cellColors = {
  "D": "rgba(255, 100, 100, 0.8)",  // ô danger
  "S": "rgba(135, 206, 235, 0.8)",  // ô shield
  "": "white" // ô trống
};

// Biến lưu dữ liệu các state và index hiện tại
let states = [];
let currentState = 0;

// Hàm chuyển đổi từ tọa độ axial sang pixel
function axialToPixel(q, r) {
  const x = hexSize * scale * sqrt3 * (q + r / 2);
  const y = hexSize * scale * (3 / 2 * r);
  return { x: centerX + x, y: centerY + y };
}

// Hàm lấy tọa độ các đỉnh của hexagon tại tâm (cx, cy)
function getHexCorners(cx, cy) {
  const corners = [];
  const size = hexSize * scale;
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30);
    corners.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle)
    });
  }
  return corners;
}

// Vẽ hexagon tại vị trí (cx, cy) với label và màu nền
function drawHex(cx, cy, label, fillColor) {
  const corners = getHexCorners(cx, cy);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = "black";
  ctx.stroke();

  // Vẽ label với font in đậm, kích thước tỷ lệ thuận với scale
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

// Hàm vẽ map dựa trên một state (dữ liệu JSON với key dạng snake_case)
function drawMap(state) {
  // Xóa canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const map = state.map;

  // Vẽ các ô cell của map (cells có các key: q, r, s, value)
  map.cells.forEach(cell => {
    const { q, r, s, value } = cell;
    const { x, y } = axialToPixel(q, r);
    let fillColor = cellColors[value] || "white";
    let label = value; // Hiển thị giá trị của cell
    drawHex(x, y, label, fillColor);
  });

  // Nếu treasure xuất hiện, vẽ một dấu hiệu ở giữa map
  if (map.treasure_appeared) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = "gold";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();
    ctx.font = `bold ${14 * scale}px Arial`;
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(map.treasure_value, centerX, centerY);
  }

  // Vẽ các player (players có các key: q, r, s, points, shield, alive, missiles, missiles_fired)
  const players = state.players;
  players.forEach(player => {
    const { q, r, s, points, shield, alive, missiles, missiles_fired } = player;
    const { x, y } = axialToPixel(q, r);
    // Vẽ vòng tròn cho player, xanh nếu alive, xám nếu không
    ctx.beginPath();
    ctx.arc(x, y, 10 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = alive ? "limegreen" : "gray";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();

    // Hiển thị điểm số của player
    ctx.font = `bold ${12 * scale}px Arial`;
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(points, x, y);

    // Nếu player có shield, vẽ vòng tròn bao quanh
    if (shield) {
      ctx.beginPath();
      ctx.arc(x, y, 15 * scale, 0, 2 * Math.PI);
      ctx.strokeStyle = "dodgerblue";
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Vẽ các missile đã bắn nếu có (missiles_fired là mảng các đối tượng có key q, r, s)
    if (missiles_fired && missiles_fired.length > 0) {
      missiles_fired.forEach(missile => {
        const { q: mq, r: mr, s: ms } = missile;
        const pos = axialToPixel(mq, mr);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5 * scale, 0, 2 * Math.PI);
        ctx.fillStyle = "orangered";
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.stroke();
      });
    }
  });

  // Hiển thị thông tin lượt di chuyển (moveleft)
  infoSpan.textContent = `Moves left: ${map.moveleft} | State: ${currentState + 1} / ${states.length}`;
}

// Cập nhật trạng thái của button next/previous dựa vào currentState
function updateButtons() {
  prevBtn.disabled = currentState <= 0;
  nextBtn.disabled = currentState >= states.length - 1;
}

// Xử lý file upload
fileInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
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
    } catch (err) {
      alert("Lỗi đọc file JSON: " + err.message);
    }
  };
  reader.readAsText(file);
});

// Xử lý sự kiện cho button Next
nextBtn.addEventListener('click', function() {
  if (currentState < states.length - 1) {
    currentState++;
    drawMap(states[currentState]);
    updateButtons();
  }
});

// Xử lý sự kiện cho button Previous
prevBtn.addEventListener('click', function() {
  if (currentState > 0) {
    currentState--;
    drawMap(states[currentState]);
    updateButtons();
  }
});
