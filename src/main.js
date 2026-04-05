import './styles/main.scss';
import 'virtual:svg-icons-register';
import './components/layout/app-root/app-root.js';

const appRoot = document.querySelector('#app');

appRoot.innerHTML = `
  <app-root></app-root>
`;

const appShell = appRoot.querySelector('app-root');

if (appShell) {
  const getBasePosition = () => ({
    x: window.innerWidth * 1.06,
    y: window.innerHeight * 0.1,
  });

  const getPointerOffset = (pointerX, pointerY) => {
    const normalizedX = pointerX / Math.max(window.innerWidth, 1) - 0.5;
    const normalizedY = pointerY / Math.max(window.innerHeight, 1) - 0.5;

    return {
      x: normalizedX * 64,
      y: normalizedY * 42,
    };
  };

  const basePosition = getBasePosition();
  let currentX = basePosition.x;
  let currentY = basePosition.y;
  let targetX = currentX;
  let targetY = currentY;
  let animationFrameId = 0;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const applyPosition = () => {
    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;

    appShell.style.setProperty('--ambient-x', `${currentX}px`);
    appShell.style.setProperty('--ambient-y', `${currentY}px`);

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
    if (prefersReducedMotion) return;

    const base = getBasePosition();
    const offset = getPointerOffset(event.clientX, event.clientY);
    targetX = base.x + offset.x;
    targetY = base.y + offset.y;
    queueAnimation();
  };

  const handlePointerLeave = () => {
    const base = getBasePosition();
    targetX = base.x;
    targetY = base.y;
    queueAnimation();
  };

  const handleResize = () => {
    const base = getBasePosition();
    targetX = base.x;
    targetY = base.y;
    queueAnimation();
  };

  appShell.style.setProperty('--ambient-x', `${currentX}px`);
  appShell.style.setProperty('--ambient-y', `${currentY}px`);

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('blur', handlePointerLeave);
  window.addEventListener('resize', handleResize, { passive: true });
}
