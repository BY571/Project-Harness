"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { GraphTooltip, type TooltipData } from "./graph-tooltip";
import { useActiveTag } from "./active-tag-context";
import { useActiveWorkspace } from "@/components/workspace-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectGraphProps {
  projects: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    priority: string;
    workspaceId?: string | null;
    tags: { tag: { id: string; name: string; color: string } }[];
    outgoingRelations: {
      id: string;
      type: string;
      targetProjectId: string;
    }[];
    tasks: { id: string; completed: boolean }[];
    notes: { id: string; type: string; resolved: boolean }[];
  }>;
  tags: { id: string; name: string; color: string }[];
  activeTagId?: string | null;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  tags: { tag: { id: string; name: string; color: string } }[];
  tasks: { id: string; completed: boolean }[];
  notes: { id: string; type: string; resolved: boolean }[];
  radius: number;
  color: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  not_started: "#6b7280",
  in_progress: "#3b82f6",
  on_hold: "#f59e0b",
  done: "#22c55e",
};

const STATUS_STROKE_COLORS: Record<string, string> = {
  not_started: "#9ca3af",
  in_progress: "#60a5fa",
  on_hold: "#fbbf24",
  done: "#4ade80",
};

const PRIORITY_RADIUS: Record<string, number> = {
  low: 20,
  medium: 25,
  high: 30,
  urgent: 35,
};

function linkDashArray(type: string): string | null {
  if (type === "based_on") return "6,3";
  if (type === "related_to") return "2,2";
  return null; // solid for follow_up
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectGraph({ projects: allProjects, tags, activeTagId: propActiveTagId }: ProjectGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const router = useRouter();
  const { activeTagId: contextActiveTagId } = useActiveTag();
  const { activeWorkspaceId } = useActiveWorkspace();

  const activeTagId = propActiveTagId !== undefined ? propActiveTagId : contextActiveTagId;

  // Filter projects by active workspace
  const projects = activeWorkspaceId
    ? allProjects.filter((p) => p.workspaceId === activeWorkspaceId)
    : allProjects;

  // Stable callback for navigation
  const navigateToProject = useCallback(
    (id: string) => {
      router.push(`/projects/${id}`);
    },
    [router],
  );

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg || projects.length === 0) return;

    // -----------------------------------------------------------------------
    // Dimensions
    // -----------------------------------------------------------------------

    let width = container.clientWidth;
    let height = container.clientHeight;

    // -----------------------------------------------------------------------
    // Prepare data
    // -----------------------------------------------------------------------

    const nodes: GraphNode[] = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      tags: p.tags,
      tasks: p.tasks,
      notes: p.notes,
      radius: PRIORITY_RADIUS[p.priority] ?? 25,
      color: STATUS_COLORS[p.status] ?? "#6b7280",
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));

    const links: GraphLink[] = projects.flatMap((p) =>
      p.outgoingRelations
        .filter((r) => nodeIds.has(r.targetProjectId))
        .map((r) => ({
          id: r.id,
          type: r.type,
          source: p.id,
          target: r.targetProjectId,
        })),
    );

    // -----------------------------------------------------------------------
    // Cluster centers based on tags
    // -----------------------------------------------------------------------

    const uniqueTags = tags.length > 0 ? tags : [];
    const tagClusterCenters: Record<string, { x: number; y: number }> = {};
    const clusterRadius = Math.min(width, height) * 0.32;

    uniqueTags.forEach((tag, i) => {
      const angle = (2 * Math.PI * i) / uniqueTags.length - Math.PI / 2;
      tagClusterCenters[tag.id] = {
        x: width / 2 + clusterRadius * Math.cos(angle),
        y: height / 2 + clusterRadius * Math.sin(angle),
      };
    });

    function getNodeClusterCenter(node: GraphNode) {
      if (node.tags.length === 0) return { x: width / 2, y: height / 2 };
      let cx = 0;
      let cy = 0;
      let count = 0;
      for (const t of node.tags) {
        const center = tagClusterCenters[t.tag.id];
        if (center) {
          cx += center.x;
          cy += center.y;
          count++;
        }
      }
      if (count === 0) return { x: width / 2, y: height / 2 };
      return { x: cx / count, y: cy / count };
    }

    // -----------------------------------------------------------------------
    // D3 setup
    // -----------------------------------------------------------------------

    const d3Svg = d3.select(svg);
    d3Svg.selectAll("*").remove();

    // Defs for arrowheads and glow filter
    const defs = d3Svg.append("defs");

    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#4b5563");

    // Glow filter for nodes
    const filter = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Root group for zoom/pan
    const g = d3Svg.append("g");

    // -----------------------------------------------------------------------
    // Cluster backgrounds
    // -----------------------------------------------------------------------

    const clusterGroup = g.append("g").attr("class", "clusters");

    uniqueTags.forEach((tag) => {
      const center = tagClusterCenters[tag.id];
      if (!center) return;

      // Count projects in this tag to size the bubble
      const count = nodes.filter((n) =>
        n.tags.some((t) => t.tag.id === tag.id),
      ).length;
      if (count === 0) return;

      const bubbleRadius = Math.max(60, 40 + count * 22);

      clusterGroup
        .append("circle")
        .attr("cx", center.x)
        .attr("cy", center.y)
        .attr("r", bubbleRadius)
        .attr("fill", tag.color)
        .attr("opacity", 0.06)
        .attr("stroke", tag.color)
        .attr("stroke-opacity", 0.12)
        .attr("stroke-width", 1);

      clusterGroup
        .append("text")
        .attr("x", center.x)
        .attr("y", center.y - bubbleRadius - 8)
        .attr("text-anchor", "middle")
        .attr("fill", tag.color)
        .attr("opacity", 0.5)
        .attr("font-size", "11px")
        .attr("font-weight", "500")
        .attr("letter-spacing", "0.05em")
        .text(tag.name.toUpperCase());
    });

    // -----------------------------------------------------------------------
    // Links
    // -----------------------------------------------------------------------

    const linkGroup = g.append("g").attr("class", "links");

    const linkElements = linkGroup
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(links)
      .join("line")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead)")
      .each(function (d) {
        const dash = linkDashArray(d.type);
        if (dash) {
          d3.select(this).attr("stroke-dasharray", dash);
        }
      });

    // -----------------------------------------------------------------------
    // Nodes
    // -----------------------------------------------------------------------

    const nodeGroup = g.append("g").attr("class", "nodes");

    const nodeElements = nodeGroup
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        navigateToProject(d.id);
      })
      .on("mouseenter", (event, d) => {
        // Highlight the main node circle
        d3.select(event.currentTarget)
          .select(".node-circle")
          .transition()
          .duration(150)
          .attr("r", d.radius + 4)
          .attr("filter", "url(#glow)");

        setTooltip({
          name: d.name,
          status: d.status,
          description: d.description,
          tasksCompleted: d.tasks.filter((t) => t.completed).length,
          tasksTotal: d.tasks.length,
          blockerCount: d.notes.filter(
            (n) => n.type === "blocker" && !n.resolved,
          ).length,
          x: event.clientX,
          y: event.clientY,
        });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) =>
          prev ? { ...prev, x: event.clientX, y: event.clientY } : null,
        );
      })
      .on("mouseleave", (event, d) => {
        d3.select(event.currentTarget)
          .select(".node-circle")
          .transition()
          .duration(200)
          .attr("r", d.radius)
          .attr("filter", null);

        setTooltip(null);
      });

    // Circle (main node circle — class used for hover targeting)
    nodeElements
      .append("circle")
      .attr("class", "node-circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.color)
      .attr("stroke", (d) => STATUS_STROKE_COLORS[d.status] ?? "#9ca3af")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.7);

    // Task progress ring
    nodeElements.each(function (d) {
      if (d.tasks.length === 0) return;
      const completed = d.tasks.filter((t) => t.completed).length;
      const ratio = completed / d.tasks.length;
      if (ratio === 0) return;

      const r = d.radius + 4;
      const circumference = 2 * Math.PI * r;

      d3.select(this)
        .append("circle")
        .attr("r", r)
        .attr("fill", "none")
        .attr("stroke", "#22c55e")
        .attr("stroke-width", 2.5)
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", `${circumference * ratio} ${circumference * (1 - ratio)}`)
        .attr("stroke-dashoffset", circumference * 0.25)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");
    });

    // Label
    nodeElements
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 16)
      .attr("fill", "#d1d5db")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("pointer-events", "none")
      .text((d) => (d.name.length > 18 ? d.name.slice(0, 16) + "..." : d.name));

    // -----------------------------------------------------------------------
    // Force simulation
    // -----------------------------------------------------------------------

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(120)
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody().strength(-300).distanceMax(400))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.radius + 12).strength(0.8))
      .force(
        "clusterX",
        d3
          .forceX<GraphNode>()
          .x((d) => getNodeClusterCenter(d).x)
          .strength(0.15),
      )
      .force(
        "clusterY",
        d3
          .forceY<GraphNode>()
          .y((d) => getNodeClusterCenter(d).y)
          .strength(0.15),
      )
      .force("centerX", d3.forceX(width / 2).strength(0.02))
      .force("centerY", d3.forceY(height / 2).strength(0.02))
      .alphaDecay(0.02)
      .velocityDecay(0.35)
      .on("tick", ticked);

    simulationRef.current = simulation;

    function ticked() {
      linkElements
        .attr("x1", (d) => {
          const source = d.source as GraphNode;
          return source.x ?? 0;
        })
        .attr("y1", (d) => {
          const source = d.source as GraphNode;
          return source.y ?? 0;
        })
        .attr("x2", (d) => {
          const target = d.target as GraphNode;
          const source = d.source as GraphNode;
          // Shorten line to stop at node edge
          const dx = (target.x ?? 0) - (source.x ?? 0);
          const dy = (target.y ?? 0) - (source.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return target.x ?? 0;
          return (target.x ?? 0) - (dx / dist) * target.radius;
        })
        .attr("y2", (d) => {
          const target = d.target as GraphNode;
          const source = d.source as GraphNode;
          const dx = (target.x ?? 0) - (source.x ?? 0);
          const dy = (target.y ?? 0) - (source.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return target.y ?? 0;
          return (target.y ?? 0) - (dy / dist) * target.radius;
        });

      nodeElements.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    }

    // -----------------------------------------------------------------------
    // Drag behavior
    // -----------------------------------------------------------------------

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeElements.call(drag);

    // -----------------------------------------------------------------------
    // Zoom & Pan
    // -----------------------------------------------------------------------

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    d3Svg.call(zoom);

    // Initial zoom to fit
    const initialScale = Math.min(1, Math.min(width, height) / 600);
    d3Svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(initialScale)
        .translate(-width / 2, -height / 2),
    );

    // -----------------------------------------------------------------------
    // Resize observer
    // -----------------------------------------------------------------------

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth === 0 || newHeight === 0) continue;
        width = newWidth;
        height = newHeight;
        d3Svg.attr("width", width).attr("height", height);

        // Update center forces
        simulation.force("centerX", d3.forceX(width / 2).strength(0.02));
        simulation.force("centerY", d3.forceY(height / 2).strength(0.02));

        // Recalculate cluster centers
        const newClusterRadius = Math.min(width, height) * 0.32;
        uniqueTags.forEach((tag, i) => {
          const angle = (2 * Math.PI * i) / uniqueTags.length - Math.PI / 2;
          tagClusterCenters[tag.id] = {
            x: width / 2 + newClusterRadius * Math.cos(angle),
            y: height / 2 + newClusterRadius * Math.sin(angle),
          };
        });

        simulation.alpha(0.3).restart();
      }
    });

    resizeObserver.observe(container);

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      simulation.stop();
      simulationRef.current = null;
      resizeObserver.disconnect();
    };
  }, [projects, tags, navigateToProject, activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Tag filtering effect
  // -------------------------------------------------------------------------

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || projects.length === 0) return;

    const d3Svg = d3.select(svg);

    if (!activeTagId) {
      // Reset all opacities
      d3Svg.selectAll(".nodes g").transition().duration(300).attr("opacity", 1);
      d3Svg.selectAll(".links line").transition().duration(300).attr("opacity", 0.6);
      d3Svg.selectAll(".clusters circle").transition().duration(300).attr("opacity", 0.06);
      d3Svg.selectAll(".clusters text").transition().duration(300).attr("opacity", 0.5);
      return;
    }

    const matchingProjectIds = new Set(
      projects
        .filter((p) => p.tags.some((t) => t.tag.id === activeTagId))
        .map((p) => p.id),
    );

    d3Svg
      .selectAll<SVGGElement, GraphNode>(".nodes g")
      .transition()
      .duration(300)
      .attr("opacity", (d) => (matchingProjectIds.has(d.id) ? 1 : 0.12));

    d3Svg
      .selectAll<SVGLineElement, GraphLink>(".links line")
      .transition()
      .duration(300)
      .attr("opacity", (d) => {
        const sourceId = typeof d.source === "object" ? (d.source as GraphNode).id : d.source;
        const targetId = typeof d.target === "object" ? (d.target as GraphNode).id : d.target;
        return matchingProjectIds.has(sourceId as string) &&
          matchingProjectIds.has(targetId as string)
          ? 0.6
          : 0.06;
      });

    // Highlight the matching cluster bubble
    d3Svg
      .selectAll<SVGCircleElement, unknown>(".clusters circle")
      .transition()
      .duration(300)
      .attr("opacity", 0.03);
    d3Svg
      .selectAll<SVGTextElement, unknown>(".clusters text")
      .transition()
      .duration(300)
      .attr("opacity", 0.2);
  }, [activeTagId, projects]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="text-4xl opacity-20">&#9679;&#8213;&#9679;</div>
          <p className="text-sm">
            No projects yet. Create your first project to see the graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-background">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ display: "block" }}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 bg-gray-900/80 backdrop-blur-sm rounded-lg px-4 py-2.5 border border-gray-800">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="font-medium text-gray-300 mr-1">Status:</span>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize">{status.replace("_", " ")}</span>
            </span>
          ))}
        </div>
        <div className="border-l border-gray-700 pl-3 flex items-center gap-3 text-xs text-gray-400">
          <span className="font-medium text-gray-300 mr-1">Links:</span>
          <span className="flex items-center gap-1">
            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#6b7280" strokeWidth="1.5" /></svg>
            follow-up
          </span>
          <span className="flex items-center gap-1">
            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="6,3" /></svg>
            based on
          </span>
          <span className="flex items-center gap-1">
            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="2,2" /></svg>
            related
          </span>
        </div>
      </div>

      {/* Tooltip */}
      <GraphTooltip data={tooltip} />
    </div>
  );
}
