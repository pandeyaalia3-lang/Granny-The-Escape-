
import { Wall, Vector2, Furniture, Item } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

export const PLAYER_RADIUS = 14;
export const GRANNY_RADIUS = 18;

export const PLAYER_SPEED = 2.4;
export const PLAYER_SPRINT_SPEED = 4.0;
export const GRANNY_BASE_SPEED = 1.0;
export const GRANNY_CHASE_SPEED = 2.3;

export const WALLS: Wall[] = [
  { x: 0, y: 0, w: 800, h: 25 },
  { x: 0, y: 575, w: 800, h: 25 },
  { x: 0, y: 0, w: 25, h: 600 },
  { x: 775, y: 0, w: 25, h: 600 },
  
  // Room Dividers
  { x: 25, y: 250, w: 200, h: 20 }, // Bedroom Wall
  { x: 400, y: 25, w: 20, h: 200 }, // Hallway Wall
  { x: 400, y: 320, w: 20, h: 255 }, // Hallway Wall Bottom
  { x: 550, y: 250, w: 225, h: 20 }, // Kitchen Wall
];

export const FURNITURE: Furniture[] = [
  // Hiding Spots
  { x: 50, y: 50, w: 60, h: 100, type: 'BED', canHide: true },
  { x: 450, y: 40, w: 40, h: 80, type: 'WARDROBE', canHide: true },
  { x: 40, y: 450, w: 80, h: 110, type: 'BED', canHide: true },
  
  // Interactive Points
  { x: 650, y: 40, w: 80, h: 60, type: 'STOVE', canHide: false }, // Granny Cooks here
  { x: 100, y: 300, w: 40, h: 40, type: 'RADIO', canHide: false }, // Player can use as distraction
  
  // Obstacles
  { x: 550, y: 450, w: 100, h: 60, type: 'TABLE', canHide: false },
  
  // Noise Makers
  { x: 450, y: 350, w: 20, h: 20, type: 'VASE', canHide: false },
  { x: 150, y: 200, w: 100, h: 30, type: 'CREAKY_FLOOR', canHide: false },
];

export const ROUTINE_NODES: Vector2[] = [
  { x: 100, y: 100 }, // Bedroom
  { x: 680, y: 100 }, // Kitchen (Stove)
  { x: 600, y: 450 }, // Dining Area
  { x: 100, y: 500 }, // Storage
];

export const EXIT_DOOR: Wall = { x: 765, y: 240, w: 35, h: 120 };

export const SPAWN_POINTS = {
  player: { x: 80, y: 200 },
  granny: { x: 700, y: 500 },
  items: [
    { id: 'key_1', name: 'Master Key', pos: { x: 710, y: 70 }, type: 'KEY' as const, collected: false },
    { id: 'hammer', name: 'Hammer', pos: { x: 340, y: 500 }, type: 'HAMMER' as const, collected: false },
    { id: 'fuse', name: 'Fuse', pos: { x: 50, y: 520 }, type: 'FUSE' as const, collected: false },
    { id: 'tranq_gun', name: 'Tranq Gun', pos: { x: 600, y: 50 }, type: 'WEAPON' as const, collected: false },
    { id: 'dart_1', name: 'Dart', pos: { x: 200, y: 400 }, type: 'AMMO' as const, collected: false },
  ]
};
