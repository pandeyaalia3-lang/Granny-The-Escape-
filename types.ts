
export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  pos: Vector2;
  radius: number;
  rotation: number;
  speed: number;
}

export interface Item {
  id: string;
  name: string;
  pos: Vector2;
  collected: boolean;
  type: 'KEY' | 'HAMMER' | 'FUSE' | 'CROWBAR' | 'WEAPON' | 'AMMO' | 'TRAP';
}

export interface Projectile {
  pos: Vector2;
  velocity: Vector2;
  active: boolean;
}

export interface Trap {
  pos: Vector2;
  active: boolean;
  isSetByGranny: boolean;
}

export interface Furniture {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'BED' | 'TABLE' | 'WARDROBE' | 'VASE' | 'CREAKY_FLOOR' | 'STOVE' | 'RADIO';
  canHide: boolean;
  isBroken?: boolean;
  isBeingChecked?: boolean;
  isDistracting?: boolean;
}

export enum GameStatus {
  MENU,
  PLAYING,
  CAUGHT,
  ESCAPED,
  CUTSCENE,
  PAUSED,
  SETTINGS
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GameSettings {
  difficulty: 'EASY' | 'NORMAL' | 'EXTREME';
  sensitivity: number;
  showScanlines: boolean;
  bloodEffects: boolean;
}

export interface GameState {
  player: Entity;
  granny: Entity;
  items: Item[];
  traps: Trap[];
  status: GameStatus;
  day: number;
  inventory: string[];
  lastNoisePos: Vector2 | null;
  isJumping: boolean;
  jumpCooldown: number;
  isHiding: boolean;
  isPeeking: boolean;
  wasSeenHiding: boolean;
  gameTime: number; 
  isGrannySleeping: boolean;
  fearLevel: number;
  noiseLevel: number;
  stamina: number;
  score: number;
  highScore: number;
  grannyState: 'WANDERING' | 'CHASING' | 'SEARCHING' | 'CHECKING' | 'STUNNED' | 'WORKING';
  grannyTargetNode: number;
  workTimer: number;
  checkTimer: number;
  stunTimer: number;
  trapTimer: number;
  ammo: number;
  hasWeapon: boolean;
  projectiles: Projectile[];
  settings: GameSettings;
}
