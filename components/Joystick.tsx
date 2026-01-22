
import React, { useState, useRef, useEffect } from 'react';

interface JoystickProps {
  onMove: (dir: { x: number; y: number }) => void;
}

const Joystick: React.FC<JoystickProps> = ({ onMove }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    setActive(true);
  };

  const handleMove = (e: TouchEvent | MouseEvent) => {
    if (!active || !baseRef.current) return;

    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2;

    const limitedDistance = Math.min(distance, maxRadius);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * limitedDistance;
    const ny = Math.sin(angle) * limitedDistance;

    setPosition({ x: nx, y: ny });
    onMove({ x: nx / maxRadius, y: ny / maxRadius });
  };

  const handleEnd = () => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (active) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [active]);

  return (
    <div 
      ref={baseRef}
      className="relative w-32 h-32 rounded-full bg-white/10 border-2 border-white/20 backdrop-blur-sm flex items-center justify-center touch-none"
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      <div 
        className="w-12 h-12 rounded-full bg-red-600/60 shadow-lg shadow-red-900/50"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      />
    </div>
  );
};

export default Joystick;
