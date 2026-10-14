"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { ZoomIn, ZoomOut, Maximize2, RefreshCw, Layers, Info, Filter, Sparkles } from "lucide-react";

export interface GraphNode {
  id: string;
  name?: string;
  label: string;
  labels?: string[];
  properties?: Record<string, any>;
  color?: string;
  val?: number;
  type?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  properties?: Record<string, any>;
  highlighted?: boolean;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlightIds: string[];
  activeGraphName: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  Service: "#3b82f6",
  Person: "#10b981",
  Team: "#8b5cf6",
  Commit: "#f59e0b",
  ADR: "#ec4899",
  Document: "#64748b",
  Incident: "#ef4444",
  Pattern: "#06b6d4",
  RunbookStep: "#22c55e",
  Task: "#a855f7",
  Finding: "#eab308",
  ProposedAction: "#f97316",
};

export default function GraphCanvas({
  nodes,
  edges,
  highlightIds = [],
  activeGraphName,
  onRefresh,
  isLoading = false,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterLabel, setFilterLabel] = useState<string>("ALL");
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragNode, setDragNode] = useState<GraphNode | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Maintain simulation positions
  const simNodesRef = useRef<Map<string, GraphNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const pulseRef = useRef<number>(0);

  // Available labels in current dataset
  const availableLabels = useMemo(() => {
    const s = new Set<string>();
    nodes.forEach((n) => s.add(n.label || "Entity"));
    return Array.from(s);
  }, [nodes]);

  // Synchronize internal node positions with incoming props
  useEffect(() => {
    const existing = simNodesRef.current;
    const nextMap = new Map<string, GraphNode>();
    const width = 800;
    const height = 600;

    nodes.forEach((n, idx) => {
      const prev = existing.get(n.id);
      if (prev && prev.x !== undefined && prev.y !== undefined) {
        nextMap.set(n.id, { ...n, x: prev.x, y: prev.y, vx: prev.vx || 0, vy: prev.vy || 0 });
      } else {
        // Distribute in circular shell
        const angle = (idx / Math.max(1, nodes.length)) * 2 * Math.PI;
        const radius = 180 + (idx % 3) * 60;
        nextMap.set(n.id, {
          ...n,
          x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
          y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: 0,
        });
      }
    });

    simNodesRef.current = nextMap;
  }, [nodes]);

  // Force-directed physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      pulseRef.current = (pulseRef.current + 0.05) % (Math.PI * 2);

      const width = canvas.width;
      const height = canvas.height;
      const simNodes = Array.from(simNodesRef.current.values());

      // 1. Force Simulation Steps (Repulsion, Springs, Center Gravity)
      const kRepulse = 3500;
      const kSpring = 0.04;
      const targetDist = 130;
      const damping = 0.88;

      // Repulsion between all pairs
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const n1 = simNodes[i];
          const n2 = simNodes[j];
          const dx = (n2.x || 0) - (n1.x || 0);
          const dy = (n2.y || 0) - (n1.y || 0);
          const distSq = dx * dx + dy * dy + 1;
          const dist = Math.sqrt(distSq);
          if (dist < 400) {
            const force = kRepulse / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (dragNode?.id !== n1.id) {
              n1.vx = (n1.vx || 0) - fx;
              n1.vy = (n1.vy || 0) - fy;
            }
            if (dragNode?.id !== n2.id) {
              n2.vx = (n2.vx || 0) + fx;
              n2.vy = (n2.vy || 0) + fy;
            }
          }
        }
      }

      // Spring force along edges
      edges.forEach((edge) => {
        const src = simNodesRef.current.get(edge.source);
        const tgt = simNodesRef.current.get(edge.target);
        if (src && tgt) {
          const dx = (tgt.x || 0) - (src.x || 0);
          const dy = (tgt.y || 0) - (src.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const displacement = dist - targetDist;
          const force = displacement * kSpring;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (dragNode?.id !== src.id) {
            src.vx = (src.vx || 0) + fx;
            src.vy = (src.vy || 0) + fy;
          }
          if (dragNode?.id !== tgt.id) {
            tgt.vx = (tgt.vx || 0) - fx;
            tgt.vy = (tgt.vy || 0) - fy;
          }
        }
      });

      // Center gravity & velocity dampening
      const cx = width / 2;
      const cy = height / 2;
      simNodes.forEach((n) => {
        if (dragNode?.id !== n.id) {
          const toCenterX = (cx - (n.x || cx)) * 0.003;
          const toCenterY = (cy - (n.y || cy)) * 0.003;
          n.vx = ((n.vx || 0) + toCenterX) * damping;
          n.vy = ((n.vy || 0) + toCenterY) * damping;

          n.x = (n.x || cx) + (n.vx || 0);
          n.y = (n.y || cy) + (n.vy || 0);
        }
      });

      // 2. Clear canvas & apply pan/zoom
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Background graph grid dots
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      const gridSize = 40;
      for (let x = -width; x < width * 2; x += gridSize) {
        for (let y = -height; y < height * 2; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const hasHighlights = highlightIds.length > 0;

      // 3. Render Edges
      edges.forEach((edge) => {
        const src = simNodesRef.current.get(edge.source);
        const tgt = simNodesRef.current.get(edge.target);
        if (!src || !tgt) return;

        const isEdgeHighlighted =
          edge.highlighted ||
          (highlightIds.includes(src.id) && highlightIds.includes(tgt.id));

        ctx.beginPath();
        ctx.moveTo(src.x || 0, src.y || 0);
        ctx.lineTo(tgt.x || 0, tgt.y || 0);

        if (isEdgeHighlighted) {
          // Glowing electric path
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 3.5;
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Animated pulsing particle along edge
          const t = (Math.sin(pulseRef.current * 1.5) + 1) / 2;
          const px = (src.x || 0) + ((tgt.x || 0) - (src.x || 0)) * t;
          const py = (src.y || 0) + ((tgt.y || 0) - (src.y || 0)) * t;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#fef08a";
          ctx.shadowColor = "#facc15";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = hasHighlights ? "rgba(71, 85, 105, 0.25)" : "rgba(100, 116, 139, 0.45)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Draw edge relationship text at midpoint
        const midX = ((src.x || 0) + (tgt.x || 0)) / 2;
        const midY = ((src.y || 0) + (tgt.y || 0)) / 2;
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillStyle = isEdgeHighlighted ? "#67e8f9" : "rgba(148, 163, 184, 0.5)";
        ctx.textAlign = "center";
        ctx.fillText(edge.type || "", midX, midY - 4);
      });

      // 4. Render Nodes
      simNodes.forEach((node) => {
        // Label filter check
        if (filterLabel !== "ALL" && node.label !== filterLabel) {
          return;
        }

        const isHighlighted = highlightIds.includes(node.id);
        const isSelected = selectedNode?.id === node.id;
        const radius = (node.val || 1.0) * 14;
        const baseColor = node.color || COLOR_MAP[node.label] || "#94a3b8";

        // Glowing pulse aura for highlighted nodes
        if (isHighlighted) {
          const auraRadius = radius + 8 + Math.sin(pulseRef.current) * 4;
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, auraRadius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(6, 182, 212, 0.22)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, auraRadius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Selected halo
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        if (isHighlighted) {
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 18;
        } else if (hasHighlights) {
          ctx.globalAlpha = 0.45;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // Inner border
        ctx.lineWidth = 2;
        ctx.strokeStyle = isHighlighted ? "#ffffff" : "rgba(255, 255, 255, 0.25)";
        ctx.stroke();

        // Node text label
        const displayName = node.name || node.id;
        ctx.font = isHighlighted ? "bold 11px Inter, sans-serif" : "10px Inter, sans-serif";
        ctx.fillStyle = isHighlighted ? "#ffffff" : "#cbd5e1";
        ctx.textAlign = "center";
        ctx.fillText(displayName, node.x || 0, (node.y || 0) + radius + 14);

        // Small badge for node type
        ctx.font = "8px ui-monospace, monospace";
        ctx.fillStyle = isHighlighted ? "#67e8f9" : "rgba(148, 163, 184, 0.7)";
        ctx.fillText(node.label.toUpperCase(), node.x || 0, (node.y || 0) + radius + 24);
      });

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [edges, highlightIds, selectedNode, filterLabel, zoom, pan, dragNode]);

  // Mouse interaction: Node dragging and Canvas panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left - pan.x) / zoom;
    const clickY = (e.clientY - rect.top - pan.y) / zoom;

    // Check if clicked on a node
    const simNodes = Array.from(simNodesRef.current.values());
    const hit = simNodes.find((n) => {
      const radius = (n.val || 1.0) * 14;
      const dx = clickX - (n.x || 0);
      const dy = clickY - (n.y || 0);
      return Math.sqrt(dx * dx + dy * dy) <= radius + 5;
    });

    if (hit) {
      setDragNode(hit);
      setSelectedNode(hit);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragNode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const newX = (e.clientX - rect.left - pan.x) / zoom;
      const newY = (e.clientY - rect.top - pan.y) / zoom;
      dragNode.x = newX;
      dragNode.y = newY;
      dragNode.vx = 0;
      dragNode.vy = 0;
    } else if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragNode(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(3.0, Math.max(0.3, prev * factor)));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0a0d16] overflow-hidden rounded-xl border border-slate-800/80 shadow-2xl">
      {/* Top Canvas Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Left: Active Graph Pill & Status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg text-xs font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse-fast shadow-[0_0_8px_#22d3ee]" />
            <span className="text-slate-400">Namespace:</span>
            <span className="text-cyan-300 font-bold">{activeGraphName}</span>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg text-xs font-mono text-slate-300">
            {nodes.length} nodes · {edges.length} edges
          </div>

          {highlightIds.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/50 backdrop-blur-md shadow-lg text-xs font-mono text-cyan-300 animate-glow">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{highlightIds.length} Traversal Nodes Active</span>
            </div>
          )}
        </div>

        {/* Right: Zoom / Filter Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Label Filter Dropdown */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer font-mono"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">
                All Labels ({nodes.length})
              </option>
              {availableLabels.map((lbl) => (
                <option key={lbl} value={lbl} className="bg-slate-900 text-slate-200">
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z * 1.2))}
            title="Zoom In"
            className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-lg"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}
            title="Zoom Out"
            className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-lg"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            title="Fit to Screen"
            className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-lg"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh Graph"
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        width={1000}
        height={750}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Bottom Color Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md shadow-xl text-[11px] font-mono text-slate-300 pointer-events-auto">
        <span className="text-slate-500 font-semibold mr-1">Legend:</span>
        {Object.entries(COLOR_MAP)
          .filter(([label]) => availableLabels.includes(label))
          .map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
              <span className="text-slate-300">{label}</span>
            </div>
          ))}
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 z-20 w-80 max-h-96 rounded-xl bg-slate-900/95 border border-cyan-500/40 backdrop-blur-xl p-4 shadow-2xl flex flex-col overflow-hidden text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: selectedNode.color || COLOR_MAP[selectedNode.label] }}
              />
              <span className="font-bold text-white text-sm truncate">{selectedNode.name || selectedNode.id}</span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded text-sm hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="mt-2.5 space-y-2 overflow-y-auto pr-1">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-400">Label:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-semibold">{selectedNode.label}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-400">Node ID:</span>
              <span className="text-slate-200 truncate max-w-[160px]">{selectedNode.id}</span>
            </div>

            {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-slate-400 font-mono text-[11px] block mb-1">Properties:</span>
                <div className="bg-slate-950/80 rounded-lg p-2 font-mono text-[11px] space-y-1 border border-slate-800 max-h-40 overflow-y-auto">
                  {Object.entries(selectedNode.properties).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500">{k}:</span>
                      <span className="text-emerald-400 truncate max-w-[140px]" title={String(v)}>
                        {String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
