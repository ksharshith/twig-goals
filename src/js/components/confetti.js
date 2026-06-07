/* ====================================================
   CONFETTI CELEBRATION PARTICLE SYSTEM
   ==================================================== */

let activeAnimationFrameId = null;
let resizeListener = null;

// Starts the confetti burst animation on canvas
export function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Cancel any running celebration animation
  if (activeAnimationFrameId) {
    cancelAnimationFrame(activeAnimationFrameId);
  }

  // Adjust canvas dimension coordinates to fit browser viewport
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Track window resize dynamically to prevent canvas distortion
  if (resizeListener) {
    window.removeEventListener('resize', resizeListener);
  }
  resizeListener = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resizeListener);

  const colors = [
    '#FF2D55', // System Pink
    '#FF9500', // System Orange
    '#FFCC00', // System Yellow
    '#4CD964', // System Green
    '#5AC8FA', // System Teal
    '#007AFF', // System Blue
    '#AF52DE'  // System Purple
  ];

  const particleCount = 160;
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height - 20, // Start above the viewport screen
      size: Math.random() * 6 + 6, // Random particle scale sizes
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 4 + 3, // Gravity speed
      speedX: Math.random() * 4 - 2, // Wind drift range
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 5 - 2.5,
      wobbleSpeed: Math.random() * 0.05 + 0.02,
      wobbleTime: Math.random() * 100
    });
  }

  // Draw loop callback
  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let anyVisible = false;

    particles.forEach(p => {
      // Calculate physics and offset updates
      p.y += p.speedY;
      p.wobbleTime += p.wobbleSpeed;
      p.x += p.speedX + Math.sin(p.wobbleTime) * 0.6; // Wind sway
      p.rotation += p.rotationSpeed;

      // Draw particle if inside viewport bounds
      if (p.y < canvas.height + 20) {
        anyVisible = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        // Drawing slightly rectangular shape mimicking paper confetti scraps
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      }
    });

    if (anyVisible) {
      activeAnimationFrameId = requestAnimationFrame(drawFrame);
    } else {
      stopConfetti();
    }
  }

  drawFrame();
}

// Terminates the celebration particle loop and clears the canvas viewport
export function stopConfetti() {
  if (activeAnimationFrameId) {
    cancelAnimationFrame(activeAnimationFrameId);
    activeAnimationFrameId = null;
  }
  
  if (resizeListener) {
    window.removeEventListener('resize', resizeListener);
    resizeListener = null;
  }

  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
