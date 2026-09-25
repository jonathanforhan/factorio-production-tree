// Renders the production tree as an SVG diagram: item nodes as cards, and a single clickable
// "branch" badge below each node showing the building that makes it (icon + count needed) -
// clicking either the node or its badge opens the editor for that production step.

import type { ProductionNode } from '../domain/graph';
import type { GameData } from '../domain/types';
import { formatNumber, formatRate, titleCase } from './format';
import { createIcon } from './icon';
import { attachTooltip, tooltipRow } from './tooltip';

export interface TreeView {
  el: HTMLDivElement;
  render(root: ProductionNode | null, gameData: GameData, selectedPath: string | null): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_WIDTH = 176;
const NODE_HEIGHT = 60;
const H_GAP = 30;
const V_GAP = 132;
const BADGE_WIDTH = 68;
const BADGE_HEIGHT = 30;

interface LayoutNode {
  node: ProductionNode;
  x: number;
  y: number;
  subtreeWidth: number;
  children: LayoutNode[];
}

function buildLayout(node: ProductionNode, depth: number): LayoutNode {
  const children = node.children.map((c) => buildLayout(c, depth + 1));
  const childrenWidth =
    children.reduce((sum, c) => sum + c.subtreeWidth, 0) + Math.max(0, children.length - 1) * H_GAP;
  return { node, x: 0, y: depth * V_GAP, subtreeWidth: Math.max(NODE_WIDTH, childrenWidth), children };
}

function assignX(layoutNode: LayoutNode, leftEdge: number): void {
  layoutNode.x = leftEdge + layoutNode.subtreeWidth / 2;
  if (layoutNode.children.length === 0) return;
  const childrenWidth =
    layoutNode.children.reduce((sum, c) => sum + c.subtreeWidth, 0) + (layoutNode.children.length - 1) * H_GAP;
  let cursor = leftEdge + (layoutNode.subtreeWidth - childrenWidth) / 2;
  for (const child of layoutNode.children) {
    assignX(child, cursor);
    cursor += child.subtreeWidth + H_GAP;
  }
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

export function createTreeView(onSelect: (path: string) => void): TreeView {
  const container = document.createElement('div');
  container.className = 'fpt-tree';

  let pan = { x: 0, y: 0 };
  let scale = 1;
  let lastRootPath: string | null = null;
  let dragging: { startX: number; startY: number; panX: number; panY: number } | null = null;

  function applyTransform(viewport: SVGGElement): void {
    viewport.setAttribute('transform', `translate(${pan.x} ${pan.y}) scale(${scale})`);
  }

  function render(root: ProductionNode | null, gameData: GameData, selectedPath: string | null): void {
    container.replaceChildren();

    if (!root) {
      const empty = document.createElement('div');
      empty.className = 'fpt-tree__empty';
      empty.textContent = 'Search for an item above to build its production tree.';
      container.appendChild(empty);
      return;
    }

    const rootLayout = buildLayout(root, 0);
    assignX(rootLayout, 0);
    const treeWidth = rootLayout.subtreeWidth;

    const svg = svgEl('svg', {
      width: '100%',
      height: '100%',
      viewBox: `0 0 ${Math.max(1, container.clientWidth)} ${Math.max(1, container.clientHeight)}`,
    });
    const viewport = svgEl('g', { class: 'fpt-tree__viewport' }) as SVGGElement;
    svg.appendChild(viewport);

    if (root.path !== lastRootPath) {
      const margin = 40;
      const availableWidth = Math.max(200, container.clientWidth - margin * 2);
      scale = Math.min(1, availableWidth / treeWidth);
      pan = { x: (container.clientWidth - treeWidth * scale) / 2, y: margin };
      lastRootPath = root.path;
    }
    applyTransform(viewport);

    const drawNode = (layoutNode: LayoutNode): void => {
      const { node } = layoutNode;
      const hasBadge = !!(node.recipe && node.machineId);
      const badgeY = layoutNode.y + NODE_HEIGHT + (V_GAP - NODE_HEIGHT - BADGE_HEIGHT) / 2;

      // edges: stem from node down to badge, then fan out to each child
      if (hasBadge) {
        const stemTop = layoutNode.y + NODE_HEIGHT;
        const badgeMidY = badgeY + BADGE_HEIGHT / 2;
        viewport.appendChild(
          svgEl('line', {
            class: 'fpt-edge',
            x1: layoutNode.x,
            y1: stemTop,
            x2: layoutNode.x,
            y2: badgeY,
          }),
        );
        for (const child of layoutNode.children) {
          const path = `M ${layoutNode.x} ${badgeMidY} C ${layoutNode.x} ${badgeMidY + 40}, ${child.x} ${child.y - 40}, ${child.x} ${child.y}`;
          viewport.appendChild(svgEl('path', { class: 'fpt-edge', d: path, fill: 'none' }));
        }
      }

      // node card
      const fo = svgEl('foreignObject', {
        x: layoutNode.x - NODE_WIDTH / 2,
        y: layoutNode.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
      const card = document.createElement('div');
      card.className = 'fpt-node';
      if (node.path === selectedPath) card.classList.add('is-selected');
      if (node.isRaw) card.classList.add('fpt-node--raw');
      if (node.truncatedCycle) card.classList.add('fpt-node--cycle');

      const item = gameData.items.get(node.itemId);
      card.appendChild(createIcon(gameData, item?.icon ?? node.itemId, 32));
      const text = document.createElement('div');
      text.className = 'fpt-node__text';
      const name = document.createElement('div');
      name.className = 'fpt-node__name';
      name.textContent = item?.name ?? titleCase(node.itemId);
      const rate = document.createElement('div');
      rate.className = 'fpt-node__rate';
      rate.textContent = formatRate(node.ratePerSec);
      text.append(name, rate);
      card.appendChild(text);

      if (node.qualityId !== 'normal') {
        const badge = document.createElement('span');
        badge.className = `fpt-quality-dot fpt-quality-dot--${node.qualityId}`;
        card.appendChild(badge);
      }

      attachTooltip(card, () => {
        const box = document.createElement('div');
        box.className = 'fpt-tooltip__box';
        const heading = document.createElement('strong');
        heading.textContent = item?.name ?? titleCase(node.itemId);
        box.appendChild(heading);
        box.appendChild(tooltipRow('Rate', formatRate(node.ratePerSec)));
        if (node.recipe) box.appendChild(tooltipRow('Recipe', node.recipe.name));
        if (node.truncatedCycle) box.appendChild(tooltipRow('Note', 'Cycle - branch truncated'));
        else if (node.isRaw) box.appendChild(tooltipRow('Note', 'No known recipe - raw input'));
        return box;
      });

      if (hasBadge || node.recipe) {
        card.classList.add('fpt-node--clickable');
        card.addEventListener('click', () => onSelect(node.path));
      }

      fo.appendChild(card);
      viewport.appendChild(fo);

      if (hasBadge) {
        const machine = gameData.items.get(node.machineId!);
        const badgeFo = svgEl('foreignObject', {
          x: layoutNode.x - BADGE_WIDTH / 2,
          y: badgeY,
          width: BADGE_WIDTH,
          height: BADGE_HEIGHT,
        });
        const badgeEl = document.createElement('div');
        badgeEl.className = 'fpt-badge';
        badgeEl.appendChild(createIcon(gameData, machine?.icon ?? node.machineId!, 20));
        const count = document.createElement('span');
        count.className = 'fpt-badge__count';
        count.textContent = `×${Math.ceil(node.machineCount - 1e-9)}`;
        badgeEl.appendChild(count);
        badgeEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect(node.path);
        });
        attachTooltip(badgeEl, () => {
          const box = document.createElement('div');
          box.className = 'fpt-tooltip__box';
          const heading = document.createElement('strong');
          heading.textContent = machine?.name ?? titleCase(node.machineId!);
          box.appendChild(heading);
          box.appendChild(tooltipRow('Buildings needed', `${Math.ceil(node.machineCount - 1e-9)}`));
          box.appendChild(tooltipRow('Exact', formatNumber(node.machineCount, 3)));
          box.appendChild(tooltipRow('Power', `${formatNumber(node.powerUsageKw, 1)} kW`));
          return box;
        });
        badgeFo.appendChild(badgeEl);
        viewport.appendChild(badgeFo);
      }

      for (const child of layoutNode.children) drawNode(child);
    };

    drawNode(rootLayout);
    container.appendChild(svg);

    // --- pan & zoom ---
    svg.addEventListener('pointerdown', (e) => {
      // Don't hijack clicks on interactive elements (node cards, badges) into a pan gesture -
      // pointer capture below would otherwise retarget their click event to the svg itself,
      // so it would never reach the card/badge's own click listener.
      if ((e.target as Element).closest?.('.fpt-node, .fpt-badge')) return;
      dragging = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      svg.setPointerCapture(e.pointerId);
      container.classList.add('is-dragging');
    });
    svg.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      pan = { x: dragging.panX + (e.clientX - dragging.startX), y: dragging.panY + (e.clientY - dragging.startY) };
      applyTransform(viewport);
    });
    const endDrag = () => {
      dragging = null;
      container.classList.remove('is-dragging');
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const prevScale = scale;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.min(3, Math.max(0.15, scale * factor));
        // zoom toward the cursor position
        pan = {
          x: cursorX - ((cursorX - pan.x) / prevScale) * scale,
          y: cursorY - ((cursorY - pan.y) / prevScale) * scale,
        };
        applyTransform(viewport);
      },
      { passive: false },
    );
  }

  return { el: container, render };
}
