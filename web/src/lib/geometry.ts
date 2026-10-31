// Grid units (shared/map.ts) to SVG pixels, plus the waypoints agents glide along.
import { AGENT_IDS, DOORS, GRID, ROOMS } from "../../../shared/map";
import type { AgentId, DoorId, Point, RoomId, World } from "../../../shared/types";

/** Pixels per grid unit. 16 x 11 grid -> 1152 x 792. */
export const U = 72;
export const MAP_W = GRID.w * U;
export const MAP_H = GRID.h * U;

export const px = (p: Point): Point => ({ x: p.x * U, y: p.y * U });

export function roomRect(id: RoomId) {
  const r = ROOMS[id];
  return { x: r.x * U, y: r.y * U, w: r.w * U, h: r.h * U };
}

export function roomCenter(id: RoomId): Point {
  const r = roomRect(id);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export type DoorGeom = { center: Point; horizontal: boolean };

/** A door sits on a wall; `at` is the grid corner where its one-unit gap starts. */
export function doorGeom(id: DoorId): DoorGeom {
  const d = DOORS[id];
  const [a, b] = d.between.map((r) => ROOMS[r]);
  const onEdgeY = (r: typeof a) => r.y === d.at.y || r.y + r.h === d.at.y;
  const horizontal = onEdgeY(a) && onEdgeY(b);
  const center = horizontal ? { x: d.at.x + 0.5, y: d.at.y } : { x: d.at.x, y: d.at.y + 0.5 };
  return { center: px(center), horizontal };
}

export function doorBetween(a: RoomId, b: RoomId): DoorId | undefined {
  return (Object.keys(DOORS) as DoorId[]).find((id) => {
    const [x, y] = DOORS[id].between;
    return (x === a && y === b) || (x === b && y === a);
  });
}

/** Spread agents sharing a room so tokens never overlap. */
const SLOT_OFFSETS: Point[] = [
  { x: -46, y: 10 },
  { x: 0, y: 10 },
  { x: 46, y: 10 },
];

export function agentSlot(world: World, agent: AgentId): Point {
  const room = world.agents[agent].room;
  const here = AGENT_IDS.filter((id) => world.agents[id].room === room);
  const r = roomRect(room);
  const c = roomCenter(room);
  // Narrow rooms stack vertically.
  if (r.w < 3 * U) {
    const i = here.indexOf(agent);
    return { x: c.x, y: c.y - 40 + i * 40 };
  }
  const offsets = here.length === 1 ? [SLOT_OFFSETS[1]] : here.length === 2 ? [SLOT_OFFSETS[0], SLOT_OFFSETS[2]] : SLOT_OFFSETS;
  const o = offsets[here.indexOf(agent)];
  return { x: c.x + o.x, y: c.y + o.y };
}

/** Room centres joined through the door between each pair, ending at the agent's slot. */
export function pathWaypoints(world: World, agent: AgentId): Point[] {
  const path = world.agents[agent].lastPath;
  const pts: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    if (i > 0) {
      const door = doorBetween(path[i - 1], path[i]);
      if (door) pts.push(doorGeom(door).center);
    }
    pts.push(i === path.length - 1 ? agentSlot(world, agent) : roomCenter(path[i]));
  }
  return pts;
}

/** Where the Manor speaks from: the empty bottom-right of the house. */
export const MANOR_SIGIL: Point = { x: 12.8 * U, y: 8.6 * U };
/** Where Operator whispers enter the map. */
export const OPERATOR_POINT: Point = { x: 8.5 * U, y: 10.4 * U };
