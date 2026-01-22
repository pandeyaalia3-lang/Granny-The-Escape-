
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameStatus, GameState, Vector2, Wall, Furniture, Projectile, Trap, GameSettings } from './types';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_RADIUS, GRANNY_RADIUS, 
  PLAYER_SPEED, PLAYER_SPRINT_SPEED, GRANNY_BASE_SPEED, GRANNY_CHASE_SPEED,
  WALLS, SPAWN_POINTS, EXIT_DOOR, FURNITURE, ROUTINE_NODES
} from './constants';
import Joystick from './components/Joystick';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [day, setDay] = useState(1);
  const [inventory, setInventory] = useState<string[]>([]);
  const [shake, setShake] = useState(0);
  const [gameTimeStr, setGameTimeStr] = useState("05:00 AM");
  const [canHidePrompt, setCanHidePrompt] = useState(false);
  const [canInteractPrompt, setCanInteractPrompt] = useState<Furniture | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [ammo, setAmmo] = useState(0);
  const [hasWeapon, setHasWeapon] = useState(false);
  
  // Persistent Settings
  const [settings, setSettings] = useState<GameSettings>({
    difficulty: 'NORMAL',
    sensitivity: 1.0,
    showScanlines: true,
    bloodEffects: true
  });

  const stateRef = useRef<GameState & { walkCycle: number; jumpHeight: number }>({
    player: { pos: { ...SPAWN_POINTS.player }, radius: PLAYER_RADIUS, rotation: 0, speed: PLAYER_SPEED },
    granny: { pos: { ...SPAWN_POINTS.granny }, radius: GRANNY_RADIUS, rotation: 0, speed: GRANNY_BASE_SPEED },
    items: SPAWN_POINTS.items.map(item => ({ ...item, collected: false })),
    traps: [],
    status: GameStatus.MENU,
    day: 1,
    inventory: [],
    lastNoisePos: null,
    isJumping: false,
    jumpCooldown: 0,
    isHiding: false,
    isPeeking: false,
    wasSeenHiding: false,
    gameTime: 300,
    isGrannySleeping: true,
    fearLevel: 0,
    noiseLevel: 0,
    stamina: 100,
    score: 0,
    highScore: parseInt(localStorage.getItem('granny_highscore') || '0'),
    grannyState: 'WANDERING',
    grannyTargetNode: 0,
    workTimer: 0,
    checkTimer: 0,
    stunTimer: 0,
    trapTimer: 0,
    ammo: 0,
    hasWeapon: false,
    projectiles: [],
    walkCycle: 0,
    jumpHeight: 0,
    settings: settings
  });

  const inputRef = useRef({ move: { x: 0, y: 0 }, jump: false, action: false, sprint: false, peek: false, fire: false });

  const resetGame = (nextDay = false) => {
    const d = nextDay ? day + 1 : 1;
    setDay(d);
    
    // Difficulty Multipliers
    let gSpeedMult = 1.0;
    if (settings.difficulty === 'EASY') gSpeedMult = 0.75;
    if (settings.difficulty === 'EXTREME') gSpeedMult = 1.4;

    stateRef.current = {
      ...stateRef.current,
      player: { pos: { ...SPAWN_POINTS.player }, radius: PLAYER_RADIUS, rotation: 0, speed: PLAYER_SPEED },
      granny: { pos: { ...SPAWN_POINTS.granny }, radius: GRANNY_RADIUS, rotation: 0, speed: (GRANNY_BASE_SPEED + (d * 0.1)) * gSpeedMult },
      items: nextDay ? stateRef.current.items : SPAWN_POINTS.items.map(item => ({ ...item, collected: false })),
      status: GameStatus.PLAYING,
      day: d,
      inventory: nextDay ? stateRef.current.inventory : [],
      lastNoisePos: null,
      isJumping: false,
      jumpCooldown: 0,
      isHiding: false,
      isPeeking: false,
      wasSeenHiding: false,
      gameTime: 300,
      isGrannySleeping: d === 1,
      fearLevel: 0,
      noiseLevel: 0,
      stamina: 100,
      score: nextDay ? stateRef.current.score : 0,
      grannyState: 'WANDERING',
      workTimer: 0,
      stunTimer: 0,
      trapTimer: 0,
      projectiles: [],
      traps: [],
    };
    if (!nextDay) {
      setInventory([]);
      setScore(0);
      setAmmo(0);
      setHasWeapon(false);
    }
    setStatus(GameStatus.PLAYING);
  };

  const checkCollision = (pos: Vector2, radius: number, walls: Wall[], furniture: Furniture[]): boolean => {
    for (const wall of walls) {
      const closestX = Math.max(wall.x, Math.min(pos.x, wall.x + wall.w));
      const closestY = Math.max(wall.y, Math.min(pos.y, wall.y + wall.h));
      const dx = pos.x - closestX;
      const dy = pos.y - closestY;
      if ((dx * dx) + (dy * dy) < radius * radius) return true;
    }
    for (const f of furniture) {
      if (['CREAKY_FLOOR', 'VASE', 'STOVE', 'RADIO'].includes(f.type)) continue;
      const closestX = Math.max(f.x, Math.min(pos.x, f.x + f.w));
      const closestY = Math.max(f.y, Math.min(pos.y, f.y + f.h));
      const dx = pos.x - closestX;
      const dy = pos.y - closestY;
      if ((dx * dx) + (dy * dy) < radius * radius) return true;
    }
    return false;
  };

  const update = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== GameStatus.PLAYING && status !== GameStatus.PLAYING) return;
    if (status === GameStatus.PAUSED || status === GameStatus.SETTINGS) return;

    // --- Time ---
    s.gameTime += 0.05;
    if (s.gameTime >= 600) s.isGrannySleeping = false;
    const hours = Math.floor(s.gameTime / 60) % 24;
    const mins = Math.floor(s.gameTime % 60);
    setGameTimeStr(`${(hours % 12 || 12).toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`);

    const { move, jump, action, peek, fire, sprint } = inputRef.current;

    // --- Hiding ---
    let nearSpot: Furniture | null = null;
    FURNITURE.forEach(f => {
      if (f.canHide) {
        const dx = s.player.pos.x - (f.x + f.w/2);
        const dy = s.player.pos.y - (f.y + f.h/2);
        if (Math.abs(dx) < f.w/2 + 25 && Math.abs(dy) < f.h/2 + 25) {
          nearSpot = f;
          if (action && !s.isHiding) { 
            s.isHiding = true; 
            s.player.pos = { x: f.x + f.w/2, y: f.y + f.h/2 };
            // If Granny sees you hide, you're in trouble
            const dist = Math.sqrt(Math.pow(s.player.pos.x - s.granny.pos.x, 2) + Math.pow(s.player.pos.y - s.granny.pos.y, 2));
            const viewAngle = Math.atan2(s.player.pos.y - s.granny.pos.y, s.player.pos.x - s.granny.pos.x);
            const angleDiff = Math.abs(viewAngle - s.granny.rotation);
            s.wasSeenHiding = dist < 280 && !s.isGrannySleeping && s.grannyState !== 'STUNNED' && angleDiff < 1.0;
          }
        }
      }
    });
    setCanHidePrompt(!!nearSpot && !s.isHiding);

    // --- Interactions ---
    let nearInteract: Furniture | null = null;
    FURNITURE.forEach(f => {
      if (f.type === 'RADIO') {
        const dist = Math.sqrt(Math.pow(s.player.pos.x - (f.x + f.w/2), 2) + Math.pow(s.player.pos.y - (f.y + f.h/2), 2));
        if (dist < 50) {
          nearInteract = f;
          if (action) {
            f.isDistracting = true;
            s.lastNoisePos = { x: f.x + f.w/2, y: f.y + f.h/2 };
            s.noiseLevel = 1.0;
            setTimeout(() => f.isDistracting = false, 5000);
          }
        }
      }
    });
    setCanInteractPrompt(nearInteract);

    // --- Trap Logic ---
    if (s.trapTimer > 0) {
      s.trapTimer--;
      s.noiseLevel = Math.max(s.noiseLevel, 0.5);
    } else {
      s.traps.forEach(t => {
        if (t.active) {
          const dist = Math.sqrt(Math.pow(s.player.pos.x - t.pos.x, 2) + Math.pow(s.player.pos.y - t.pos.y, 2));
          if (dist < 20) {
            t.active = false;
            s.trapTimer = 180;
            s.stamina = Math.max(0, s.stamina - 40);
            s.lastNoisePos = { ...s.player.pos };
            s.noiseLevel = 1.0;
            setShake(20);
          }
        }
      });
    }

    // --- Movement ---
    if (!s.isHiding && s.trapTimer <= 0) {
      s.noiseLevel = Math.max(0, s.noiseLevel - 0.01);
      const isMoving = Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1;
      const currentSpeed = (isMoving && sprint && s.stamina > 0) ? PLAYER_SPRINT_SPEED : PLAYER_SPEED;
      
      if (isMoving) {
        s.walkCycle += 0.2;
        if (sprint) { s.stamina = Math.max(0, s.stamina - 0.4); s.noiseLevel = Math.max(s.noiseLevel, 0.4); }
        else s.stamina = Math.min(100, s.stamina + 0.1);

        const nextX = s.player.pos.x + move.x * currentSpeed * settings.sensitivity;
        const nextY = s.player.pos.y + move.y * currentSpeed * settings.sensitivity;
        if (!checkCollision({ x: nextX, y: s.player.pos.y }, s.player.radius, WALLS, FURNITURE)) s.player.pos.x = nextX;
        if (!checkCollision({ x: s.player.pos.x, y: nextY }, s.player.radius, WALLS, FURNITURE)) s.player.pos.y = nextY;
        s.player.rotation = Math.atan2(move.y, move.x);

        FURNITURE.forEach(f => {
          if (f.type === 'CREAKY_FLOOR') {
            const dist = Math.sqrt(Math.pow(s.player.pos.x - (f.x + f.w/2), 2) + Math.pow(s.player.pos.y - (f.y + f.h/2), 2));
            if (dist < 30) { s.noiseLevel = Math.max(s.noiseLevel, 0.6); s.lastNoisePos = { ...s.player.pos }; }
          }
          if (f.type === 'VASE' && !f.isBroken) {
            const dist = Math.sqrt(Math.pow(s.player.pos.x - (f.x + f.w/2), 2) + Math.pow(s.player.pos.y - (f.y + f.h/2), 2));
            if (dist < 15) { f.isBroken = true; s.noiseLevel = 1.0; s.lastNoisePos = { ...s.player.pos }; setShake(15); }
          }
        });
      } else s.stamina = Math.min(100, s.stamina + 0.3);

      if (jump && !s.isJumping && s.jumpCooldown <= 0) {
        s.isJumping = true; s.jumpCooldown = 60;
        s.noiseLevel = 0.8; s.lastNoisePos = { ...s.player.pos };
      }
      if (s.isJumping) {
        s.jumpHeight = Math.sin((60 - s.jumpCooldown) / 60 * Math.PI) * 25;
        if (s.jumpCooldown <= 0) s.isJumping = false;
      }
      if (s.jumpCooldown > 0) s.jumpCooldown--;
    } else if (s.isHiding) {
      s.isPeeking = peek;
      if (Math.abs(move.x) > 0.5 || Math.abs(move.y) > 0.5) s.isHiding = false;
    }

    // --- Weapon ---
    if (fire && s.hasWeapon && s.ammo > 0 && !s.isHiding) {
      s.ammo--; setAmmo(s.ammo);
      s.projectiles.push({
        pos: { ...s.player.pos },
        velocity: { x: Math.cos(s.player.rotation) * 8, y: Math.sin(s.player.rotation) * 8 },
        active: true
      });
      s.noiseLevel = 1.0;
    }
    inputRef.current.fire = false;
    s.projectiles.forEach(p => {
      if (!p.active) return;
      p.pos.x += p.velocity.x; p.pos.y += p.velocity.y;
      if (checkCollision(p.pos, 4, WALLS, FURNITURE)) p.active = false;
      const gDist = Math.sqrt(Math.pow(p.pos.x - s.granny.pos.x, 2) + Math.pow(p.pos.y - s.granny.pos.y, 2));
      if (gDist < GRANNY_RADIUS + 5 && !s.isGrannySleeping) {
        p.active = false; s.grannyState = 'STUNNED'; s.stunTimer = 600;
      }
    });
    s.projectiles = s.projectiles.filter(p => p.active);

    // --- Items ---
    s.items.forEach(item => {
      if (!item.collected) {
        const dx = s.player.pos.x - item.pos.x;
        const dy = s.player.pos.y - item.pos.y;
        if (Math.sqrt(dx*dx + dy*dy) < 30) {
          item.collected = true;
          if (item.type === 'WEAPON') { s.hasWeapon = true; setHasWeapon(true); }
          else if (item.type === 'AMMO') { s.ammo++; setAmmo(s.ammo); }
          else { s.inventory.push(item.id); setInventory([...s.inventory]); }
          s.score += 500; setScore(s.score);
        }
      }
    });

    // --- AI Brain (Routine System) ---
    if (!s.isGrannySleeping) {
      const dist = Math.sqrt(Math.pow(s.player.pos.x - s.granny.pos.x, 2) + Math.pow(s.player.pos.y - s.granny.pos.y, 2));
      const canSeePlayer = !s.isHiding && dist < (settings.difficulty === 'EXTREME' ? 350 : 250);
      s.fearLevel = Math.max(0, 1 - (dist / 350));

      if (s.grannyState === 'STUNNED') {
        s.stunTimer--;
        if (s.stunTimer <= 0) s.grannyState = 'WANDERING';
      } else if (canSeePlayer) {
        s.grannyState = 'CHASING';
        s.lastNoisePos = { ...s.player.pos };
      } else if (s.lastNoisePos) {
        s.grannyState = 'SEARCHING';
      } else if (s.workTimer > 0) {
        s.grannyState = 'WORKING';
        s.workTimer--;
        if (s.workTimer % 300 === 0 && Math.random() < 0.3) {
          s.traps.push({ pos: { ...s.granny.pos }, active: true, isSetByGranny: true });
        }
      } else {
        s.grannyState = 'WANDERING';
      }

      // Checking Hiding Spots
      if (s.grannyState === 'SEARCHING' && dist < 50) {
        const hSpot = FURNITURE.find(f => f.canHide && Math.sqrt(Math.pow(f.x + f.w/2 - s.granny.pos.x, 2) + Math.pow(f.y + f.h/2 - s.granny.pos.y, 2)) < 60);
        if (hSpot && (s.wasSeenHiding || Math.random() < 0.05)) {
          s.grannyState = 'CHECKING';
          s.checkTimer = 120;
          hSpot.isBeingChecked = true;
        } else if (dist < 30) s.lastNoisePos = null;
      }

      if (s.grannyState === 'CHECKING') {
        s.checkTimer--;
        if (s.checkTimer <= 0) {
          s.grannyState = 'WANDERING';
          FURNITURE.forEach(f => f.isBeingChecked = false);
          s.wasSeenHiding = false; // Reset seen flag after checking
          if (s.isHiding) {
            const hDist = Math.sqrt(Math.pow(s.player.pos.x - s.granny.pos.x, 2) + Math.pow(s.player.pos.y - s.granny.pos.y, 2));
            if (hDist < 60) {
              setShake(40);
              if (s.day < 5) { s.status = GameStatus.CUTSCENE; setTimeout(() => resetGame(true), 2000); }
              else { s.status = GameStatus.CAUGHT; setStatus(GameStatus.CAUGHT); }
            }
          }
        }
      } else if (s.grannyState !== 'WORKING') {
        let target = s.lastNoisePos || ROUTINE_NODES[s.grannyTargetNode];
        const angle = Math.atan2(target.y - s.granny.pos.y, target.x - s.granny.pos.x);
        
        let gSpeed = s.grannyState === 'CHASING' ? GRANNY_CHASE_SPEED : s.granny.speed;
        if (settings.difficulty === 'EASY') gSpeed *= 0.8;
        if (settings.difficulty === 'EXTREME') gSpeed *= 1.2;

        const gnX = s.granny.pos.x + Math.cos(angle) * gSpeed;
        const gnY = s.granny.pos.y + Math.sin(angle) * gSpeed;
        
        if (!checkCollision({ x: gnX, y: s.granny.pos.y }, s.granny.radius, WALLS, [])) s.granny.pos.x = gnX;
        if (!checkCollision({ x: s.granny.pos.x, y: gnY }, s.granny.radius, WALLS, [])) s.granny.pos.y = gnY;
        s.granny.rotation = angle;

        if (!s.lastNoisePos) {
          const nodeDist = Math.sqrt(Math.pow(s.granny.pos.x - target.x, 2) + Math.pow(s.granny.pos.y - target.y, 2));
          if (nodeDist < 20) {
            s.grannyTargetNode = (s.grannyTargetNode + 1) % ROUTINE_NODES.length;
            s.workTimer = 300 + Math.random() * 600;
          }
        }
      }

      // Catch Check
      if (dist < (s.player.radius + s.granny.radius - 5) && !s.isHiding) {
        setShake(40);
        if (s.day < 5) { s.status = GameStatus.CUTSCENE; setTimeout(() => resetGame(true), 2000); }
        else { s.status = GameStatus.CAUGHT; setStatus(GameStatus.CAUGHT); }
      }
    }

    const exitReady = s.inventory.length >= 3;
    if (exitReady) {
      const dx = s.player.pos.x - (EXIT_DOOR.x + EXIT_DOOR.w/2);
      const dy = s.player.pos.y - (EXIT_DOOR.y + EXIT_DOOR.h/2);
      if (Math.abs(dx) < 30 && Math.abs(dy) < 40) {
        s.score += 5000;
        if (s.score > s.highScore) localStorage.setItem('granny_highscore', s.score.toString());
        s.status = GameStatus.ESCAPED; setStatus(GameStatus.ESCAPED);
      }
    }

    if (shake > 0) setShake(v => v - 1);
    inputRef.current.action = false;
  }, [day, shake, status, settings]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);

    // Floor
    ctx.fillStyle = '#050505'; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
    for(let i=0; i<CANVAS_WIDTH; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,600); ctx.stroke(); }
    for(let i=0; i<600; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(800,i); ctx.stroke(); }

    // Furniture
    FURNITURE.forEach(f => {
      ctx.fillStyle = f.isBeingChecked ? '#450a0a' : f.isDistracting ? '#064e3b' : '#1a1a1a';
      ctx.fillRect(f.x,f.y,f.w,f.h);
      ctx.strokeStyle = '#333'; ctx.strokeRect(f.x,f.y,f.w,f.h);
      if (f.type === 'STOVE') { ctx.fillStyle = '#ef444433'; ctx.fillRect(f.x+10,f.y+10,f.w-20,f.h-20); }
    });

    // Traps
    s.traps.forEach(t => {
      if (t.active) {
        ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(t.pos.x, t.pos.y, 10, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#f87171'; ctx.stroke();
      }
    });

    // Walls
    ctx.fillStyle = '#111';
    WALLS.forEach(w => { ctx.fillRect(w.x,w.y,w.w,w.h); ctx.strokeStyle = '#222'; ctx.strokeRect(w.x,w.y,w.w,w.h); });

    // Projectiles
    ctx.fillStyle = '#fde68a';
    s.projectiles.forEach(p => { ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 4, 0, Math.PI*2); ctx.fill(); });

    // Exit
    const hasAll = s.inventory.length >= 3;
    ctx.fillStyle = hasAll ? '#065f46' : '#450a0a'; ctx.fillRect(EXIT_DOOR.x, EXIT_DOOR.y, EXIT_DOOR.w, EXIT_DOOR.h);

    // Items
    s.items.forEach(item => {
      if (!item.collected) {
        ctx.fillStyle = item.type === 'WEAPON' ? '#4ade80' : '#fbbf24';
        ctx.beginPath(); ctx.arc(item.pos.x, item.pos.y, 8, 0, Math.PI*2); ctx.fill();
      }
    });

    // Player
    if (!s.isHiding) {
      const bob = Math.sin(s.walkCycle) * 3;
      ctx.save(); ctx.translate(s.player.pos.x, s.player.pos.y); ctx.rotate(s.player.rotation);
      const jScale = 1 + (s.jumpHeight / 50); ctx.scale(jScale, jScale);
      ctx.fillStyle = s.trapTimer > 0 ? '#ef4444' : '#3b82f6'; ctx.fillRect(-12,-12+bob,24,24);
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(0,bob,10,0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Granny
    ctx.save(); ctx.translate(s.granny.pos.x, s.granny.pos.y);
    if (s.isGrannySleeping) { ctx.rotate(Math.PI/2); ctx.fillStyle = '#3f3f46'; }
    else { ctx.rotate(s.granny.rotation); ctx.fillStyle = s.grannyState === 'CHASING' ? '#ef4444' : '#7f1d1d'; }
    ctx.fillRect(-15,-15,30,30);
    ctx.fillStyle = '#d1d5db'; ctx.beginPath(); ctx.arc(0,0,12,0, Math.PI*2); ctx.fill();
    
    if (s.grannyState === 'WORKING') {
      ctx.fillStyle = 'white'; ctx.font = '10px bold Arial'; ctx.fillText('🛠️ Tasks', -20, -25);
    } else if (s.grannyState === 'STUNNED') {
      ctx.fillStyle = '#60a5fa'; ctx.font = '10px bold Arial'; ctx.fillText('😵 STUNNED', -20, -25);
    }
    ctx.restore();

    // Lighting
    const grad = ctx.createRadialGradient(s.player.pos.x, s.player.pos.y, 40, s.player.pos.x, s.player.pos.y, 350);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, `rgba(0,0,0,${0.85 + (s.fearLevel * 0.1)})`);
    ctx.fillStyle = grad; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
    ctx.restore();
  }, [shake, settings]);

  useEffect(() => {
    let frameId: number;
    const loop = () => { if (canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); if (ctx) { update(); draw(ctx); } } frameId = requestAnimationFrame(loop); };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [update, draw]);

  // Utility to handle sprint input toggling from the UI.
  const toggleSprint = (sprinting: boolean) => {
    inputRef.current.sprint = sprinting;
  };

  const toggleSetting = (key: keyof GameSettings) => {
    const newSettings = { ...settings, [key]: !settings[key as any] };
    setSettings(newSettings as any);
    stateRef.current.settings = newSettings as any;
  };

  const setDifficulty = (diff: GameSettings['difficulty']) => {
    const newSettings = { ...settings, difficulty: diff };
    setSettings(newSettings);
    stateRef.current.settings = newSettings;
  };

  return (
    <div className={`relative w-full h-screen bg-black flex items-center justify-center overflow-hidden ${settings.showScanlines ? 'scanlines' : ''} ${stateRef.current.fearLevel > 0.8 ? 'animate-pulse' : ''}`}>
      <div className="relative shadow-2xl border-4 border-zinc-900 rounded-lg overflow-hidden bg-zinc-950">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="max-w-full max-h-[90vh] object-contain" />
        <div className="vignette absolute inset-0 pointer-events-none" />
        
        {stateRef.current.isHiding && (
          <div className={`absolute inset-0 z-40 transition-all duration-300 flex items-center justify-center pointer-events-none ${stateRef.current.isPeeking ? 'bg-black/40' : 'bg-black/90'}`}>
             <div className="w-full h-full border-[120px] border-black/90 flex flex-col items-center justify-center">
                {!stateRef.current.isPeeking && <p className="text-zinc-600 font-creepster text-4xl animate-pulse uppercase tracking-[0.2em]">Hiding...</p>}
             </div>
          </div>
        )}
      </div>

      {status === GameStatus.MENU && (
        <div className="absolute inset-0 bg-black/98 z-[100] flex flex-col items-center justify-center p-4">
          <h1 className="text-red-700 text-9xl font-nosifer mb-4 tracking-tighter drop-shadow-[0_0_25px_rgba(255,0,0,0.6)]">GRANNY</h1>
          <p className="text-zinc-500 text-xl mb-12 font-creepster uppercase tracking-widest">The Nightmare Returns</p>
          <div className="mb-8 text-zinc-400 font-bold">HIGHSCORE: <span className="text-yellow-500">{stateRef.current.highScore}</span></div>
          <div className="flex flex-col gap-4">
            <button onClick={() => resetGame()} className="px-24 py-6 bg-red-800 text-white text-3xl font-nosifer hover:bg-red-700 transition-all border-b-8 border-red-950 active:border-0 active:translate-y-2">PLAY</button>
            <button onClick={() => setStatus(GameStatus.SETTINGS)} className="px-24 py-4 bg-zinc-800 text-zinc-300 text-xl font-nosifer hover:bg-zinc-700 transition-all">SETTINGS</button>
          </div>
        </div>
      )}

      {status === GameStatus.SETTINGS && (
        <div className="absolute inset-0 bg-black/90 z-[110] flex flex-col items-center justify-center p-8">
          <div className="bg-zinc-900 p-12 rounded-3xl border-4 border-zinc-800 shadow-2xl max-w-md w-full">
            <h2 className="text-red-600 text-5xl font-nosifer mb-10 text-center">SETTINGS</h2>
            
            <div className="space-y-8">
              <div className="flex flex-col gap-2">
                <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Difficulty</span>
                <div className="flex gap-2">
                  {['EASY', 'NORMAL', 'EXTREME'].map(d => (
                    <button key={d} onClick={() => setDifficulty(d as any)} className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${settings.difficulty === d ? 'bg-red-700 text-white' : 'bg-zinc-800 text-zinc-500'}`}>{d}</button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-300 font-bold">SCANLINES</span>
                <button onClick={() => toggleSetting('showScanlines')} className={`w-14 h-8 rounded-full transition-all relative ${settings.showScanlines ? 'bg-red-700' : 'bg-zinc-800'}`}>
                  <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${settings.showScanlines ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-zinc-300 font-bold">SENSITIVITY</span>
                <input type="range" min="0.5" max="2.0" step="0.1" value={settings.sensitivity} onChange={(e) => setSettings({...settings, sensitivity: parseFloat(e.target.value)})} className="w-full accent-red-700" />
              </div>
            </div>

            <button onClick={() => setStatus(GameStatus.MENU)} className="mt-12 w-full py-4 bg-red-800 text-white font-nosifer rounded-xl">SAVE & EXIT</button>
          </div>
        </div>
      )}

      {status === GameStatus.PLAYING && (
        <>
          {/* Top HUD */}
          <div className="absolute top-6 left-6 flex flex-col gap-3 z-50">
            <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-6">
              <span className="text-red-600 font-nosifer text-2xl tracking-widest">DAY {day}</span>
              <div className="h-2 w-48 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-600" style={{ width: `${(5 - day + 1) / 5 * 100}%` }} />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="bg-zinc-900/90 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-3">
                 <span className="text-zinc-500 text-[10px] font-bold uppercase">Stamina</span>
                 <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${stateRef.current.stamina}%` }} />
                 </div>
              </div>
            </div>
          </div>

          <button onClick={() => setStatus(GameStatus.PAUSED)} className="absolute top-6 right-6 z-50 w-12 h-12 bg-black/60 rounded-full border border-white/10 flex items-center justify-center text-white text-xl">II</button>

          {/* Controls */}
          <div className="absolute bottom-12 left-12 z-50 flex flex-col gap-4">
             <Joystick onMove={(dir) => inputRef.current.move = dir} />
             <button onMouseDown={() => toggleSprint(true)} onMouseUp={() => toggleSprint(false)} 
               className={`w-32 py-3 rounded-2xl border-2 font-bold uppercase tracking-widest text-[10px] ${stateRef.current.stamina > 20 ? 'bg-blue-900/40 border-blue-500 text-blue-300' : 'bg-zinc-900 border-zinc-700 text-zinc-600'}`}>Sprint</button>
          </div>

          <div className="absolute bottom-12 right-12 z-50 flex flex-col gap-6 items-center">
            {hasWeapon && !stateRef.current.isHiding && (
              <button onClick={() => inputRef.current.fire = true} className="w-24 h-24 rounded-full bg-emerald-600/80 border-4 border-emerald-300 text-white flex flex-col items-center justify-center shadow-2xl active:scale-90">
                <span className="text-3xl">🎯</span>
              </button>
            )}
            {stateRef.current.isHiding ? (
              <button onMouseDown={() => inputRef.current.peek = true} onMouseUp={() => inputRef.current.peek = false}
                className="w-24 h-24 rounded-full bg-red-900/80 border-4 border-red-500 text-white flex flex-col items-center justify-center shadow-2xl active:scale-90">
                <span className="text-3xl">👁️</span>
              </button>
            ) : (
              (canHidePrompt || canInteractPrompt) && (
                <button onClick={() => inputRef.current.action = true} className="w-28 h-28 rounded-3xl bg-zinc-800 border-4 border-zinc-600 text-white flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-all">
                  <span className="text-3xl">{canInteractPrompt ? '📻' : '📦'}</span>
                </button>
              )
            )}
            <button onMouseDown={() => inputRef.current.jump = true} 
              className="w-36 h-36 rounded-full bg-white/5 border-4 border-white/20 text-white font-bold text-3xl flex items-center justify-center shadow-2xl active:bg-white/20 transition-all">JUMP</button>
          </div>
        </>
      )}

      {status === GameStatus.PAUSED && (
        <div className="absolute inset-0 bg-black/80 z-[2