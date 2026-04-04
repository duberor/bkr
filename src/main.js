import './styles/main.scss';
import 'virtual:svg-icons-register';
import './components/layout/app-root/app-root.js';

const appRoot = document.querySelector('#app');

appRoot.innerHTML = `
  <div class="light-overlay" aria-hidden="true"></div>
  <app-root></app-root>
`;

const lightOverlay = appRoot.querySelector('.light-overlay');

if (lightOverlay) {
  let currentX = window.innerWidth * 0.82;
  let currentY = window.innerHeight * 0.18;
  let targetX = currentX;
  let targetY = currentY;
  let animationFrameId = 0;

  const applyPosition = () => {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;

    lightOverlay.style.setProperty('--x', `${currentX}px`);
    lightOverlay.style.setProperty('--y', `${currentY}px`);

    if (Math.abs(targetX - currentX) > 0.4 || Math.abs(targetY - currentY) > 0.4) {
      animationFrameId = window.requestAnimationFrame(applyPosition);
      return;
    }

    animationFrameId = 0;
  };

  const queueAnimation = () => {
    if (!animationFrameId) {
      animationFrameId = window.requestAnimationFrame(applyPosition);
    }
  };

  const handlePointerMove = (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    queueAnimation();
  };

  const handlePointerLeave = () => {
    targetX = window.innerWidth * 0.82;
    targetY = window.innerHeight * 0.18;
    queueAnimation();
  };

  const handleResize = () => {
    targetX = Math.min(targetX, window.innerWidth);
    targetY = Math.min(targetY, window.innerHeight);
    queueAnimation();
  };

  lightOverlay.style.setProperty('--x', `${currentX}px`);
  lightOverlay.style.setProperty('--y', `${currentY}px`);

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('blur', handlePointerLeave);
  window.addEventListener('resize', handleResize, { passive: true });
}
