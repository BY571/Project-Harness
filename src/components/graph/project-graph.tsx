"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { Settings } from "lucide-react";
import { GraphTooltip, type TooltipData } from "./graph-tooltip";
import { useActiveTag } from "./active-tag-context";
import { useActiveWorkspace } from "@/components/workspace-context";
import { applyAccentColor, removeAccentColor } from "@/components/accent-color-initializer";

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
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_RADIUS: Record<string, number> = {
  low: 8,
  medium: 10,
  high: 12,
  urgent: 14,
};

function linkDashArray(type: string): string | null {
  if (type === "based_on") return "6,3";
  if (type === "related_to") return "2,2";
  return null; // solid for follow_up
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectGraph({ projects: allProjects, tags }: ProjectGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const router = useRouter();
  const { activeTagId } = useActiveTag();
  const { activeWorkspaceId } = useActiveWorkspace();

  // Graph style settings
  const DEFAULTS = { nodeColor: "#22d3ee", fillOpacity: 1, strokeOpacity: 0.8 };
  const [showSettings, setShowSettings] = useState(false);
  const [nodeColor, setNodeColor] = useState(DEFAULTS.nodeColor);
  const [fillOpacity, setFillOpacity] = useState(DEFAULTS.fillOpacity);
  const [strokeOpacity, setStrokeOpacity] = useState(DEFAULTS.strokeOpacity);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("graph-style");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.nodeColor) setNodeColor(s.nodeColor);
        if (s.fillOpacity !== undefined) setFillOpacity(s.fillOpacity);
        if (s.strokeOpacity !== undefined) setStrokeOpacity(s.strokeOpacity);
      }
    } catch { /* ignore */ }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem("graph-style", JSON.stringify({ nodeColor, fillOpacity, strokeOpacity }));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 1500);
  };

  const handleResetSettings = () => {
    setNodeColor(DEFAULTS.nodeColor);
    setFillOpacity(DEFAULTS.fillOpacity);
    setStrokeOpacity(DEFAULTS.strokeOpacity);
    localStorage.removeItem("graph-style");
    removeAccentColor();
  };

  // Live-update node styling + app-wide accent color
  useEffect(() => {
    // Update CSS custom properties for the entire app
    applyAccentColor(nodeColor);

    // Update D3 node circles
    const svg = svgRef.current;
    if (!svg) return;
    const d3Svg = d3.select(svg);
    d3Svg.selectAll(".node-circle")
      .attr("fill", nodeColor)
      .attr("fill-opacity", fillOpacity)
      .attr("stroke", nodeColor)
      .attr("stroke-opacity", strokeOpacity);

    // Update the SVG neon-tag-link filter flood color
    d3Svg.select("#neon-tag-link feFlood").attr("flood-color", nodeColor);
  }, [nodeColor, fillOpacity, strokeOpacity]);

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

    const uniqueTags = tags;
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

    // Glow filter for nodes (hover)
    const filter = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Neon glow filter for nodes (always on, subtle)
    const neonNodeFilter = defs
      .append("filter")
      .attr("id", "neon-node")
      .attr("x", "-80%")
      .attr("y", "-80%")
      .attr("width", "260%")
      .attr("height", "260%");
    neonNodeFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "6")
      .attr("in", "SourceGraphic")
      .attr("result", "blur");
    neonNodeFilter
      .append("feColorMatrix")
      .attr("in", "blur")
      .attr("type", "matrix")
      .attr("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0")
      .attr("result", "dimBlur");
    const neonNodeMerge = neonNodeFilter.append("feMerge");
    neonNodeMerge.append("feMergeNode").attr("in", "dimBlur");
    neonNodeMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Neon glow filter for links
    const neonLinkFilter = defs
      .append("filter")
      .attr("id", "neon-link")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    neonLinkFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("in", "SourceGraphic")
      .attr("result", "blur");
    const neonLinkMerge = neonLinkFilter.append("feMerge");
    neonLinkMerge.append("feMergeNode").attr("in", "blur");
    neonLinkMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Cyan neon glow for shared-tag links
    const neonTagLinkFilter = defs
      .append("filter")
      .attr("id", "neon-tag-link")
      .attr("x", "-30%")
      .attr("y", "-30%")
      .attr("width", "160%")
      .attr("height", "160%");
    neonTagLinkFilter
      .append("feFlood")
      .attr("flood-color", "#22d3ee")
      .attr("flood-opacity", "0.6")
      .attr("result", "cyan");
    neonTagLinkFilter
      .append("feComposite")
      .attr("in", "cyan")
      .attr("in2", "SourceGraphic")
      .attr("operator", "in")
      .attr("result", "cyanShape");
    neonTagLinkFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("in", "cyanShape")
      .attr("result", "glow");
    const neonTagMerge = neonTagLinkFilter.append("feMerge");
    neonTagMerge.append("feMergeNode").attr("in", "glow");
    neonTagMerge.append("feMergeNode").attr("in", "SourceGraphic");

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
    // Shared-tag links (projects that share at least one tag)
    // -----------------------------------------------------------------------

    interface TagLink {
      source: string;
      target: string;
      color: string;
      tagName: string;
    }

    const tagLinks: TagLink[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const sharedTag = a.tags.find((at) =>
          b.tags.some((bt) => bt.tag.id === at.tag.id)
        );
        if (sharedTag) {
          tagLinks.push({
            source: a.id,
            target: b.id,
            color: sharedTag.tag.color,
            tagName: sharedTag.tag.name,
          });
        }
      }
    }

    const tagLinkGroup = g.append("g").attr("class", "tag-links");

    const tagLinkElements = tagLinkGroup
      .selectAll<SVGLineElement, TagLink>("line")
      .data(tagLinks)
      .join("line")
      .attr("stroke", "#6b7280")
      .attr("stroke-width", 1.2)
      .attr("stroke-opacity", 0.4)
      .attr("filter", "url(#neon-tag-link)");

    // -----------------------------------------------------------------------
    // Links (project relations)
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
      .attr("filter", "url(#neon-link)")
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
          .attr("r", d.radius + 3)
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
      .attr("fill", nodeColor)
      .attr("fill-opacity", fillOpacity)
      .attr("stroke", nodeColor)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", strokeOpacity)
      .attr("filter", "url(#neon-node)");

    // Task progress ring
    nodeElements.each(function (d) {
      if (d.tasks.length === 0) return;
      const completed = d.tasks.filter((t) => t.completed).length;
      const ratio = completed / d.tasks.length;
      if (ratio === 0) return;

      const r = d.radius + 3;
      const circumference = 2 * Math.PI * r;

      d3.select(this)
        .append("circle")
        .attr("r", r)
        .attr("fill", "none")
        .attr("stroke", nodeColor)
        .attr("stroke-width", 1.5)
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
      .attr("dy", (d) => d.radius + 14)
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
          .distance(160)
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody().strength(-500).distanceMax(500))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.radius + 20).strength(0.9))
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

    // Build a lookup for quick node access by id
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    function ticked() {
      // Update shared-tag links
      tagLinkElements
        .attr("x1", (d) => nodeById.get(d.source)?.x ?? 0)
        .attr("y1", (d) => nodeById.get(d.source)?.y ?? 0)
        .attr("x2", (d) => nodeById.get(d.target)?.x ?? 0)
        .attr("y2", (d) => nodeById.get(d.target)?.y ?? 0);

      // Update relation links (shortened to stop at node edge)
      function shortenedEnd(source: GraphNode, target: GraphNode) {
        const dx = (target.x ?? 0) - (source.x ?? 0);
        const dy = (target.y ?? 0) - (source.y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return { x: target.x ?? 0, y: target.y ?? 0 };
        return {
          x: (target.x ?? 0) - (dx / dist) * target.radius,
          y: (target.y ?? 0) - (dy / dist) * target.radius,
        };
      }

      linkElements
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => shortenedEnd(d.source as GraphNode, d.target as GraphNode).x)
        .attr("y2", (d) => shortenedEnd(d.source as GraphNode, d.target as GraphNode).y);

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
      d3Svg.selectAll(".tag-links line").transition().duration(300).attr("opacity", 0.35);
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

    // Highlight shared-tag links for the active tag
    d3Svg
      .selectAll<SVGLineElement, { source: string; target: string }>(".tag-links line")
      .transition()
      .duration(300)
      .attr("opacity", (d) =>
        matchingProjectIds.has(d.source) && matchingProjectIds.has(d.target) ? 0.6 : 0.04,
      );

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

      {/* Settings toggle */}
      <button
        onClick={() => setShowSettings((s) => !s)}
        className="absolute top-4 right-4 p-2 rounded-lg bg-gray-900/80 backdrop-blur-sm border border-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
        title="Graph settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-14 right-4 w-56 bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-800 p-4 space-y-4">
          <div className="text-xs font-medium text-gray-300">Accent Color</div>

          <label className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">Color</span>
            <input
              type="color"
              value={nodeColor}
              onChange={(e) => setNodeColor(e.target.value)}
              className="h-7 w-10 rounded border border-gray-700 bg-transparent cursor-pointer"
            />
          </label>

          <label className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Fill opacity</span>
              <span className="text-xs text-gray-500">{Math.round(fillOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={fillOpacity}
              onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 accent-cyan-400"
            />
          </label>

          <label className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Stroke opacity</span>
              <span className="text-xs text-gray-500">{Math.round(strokeOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={strokeOpacity}
              onChange={(e) => setStrokeOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 accent-cyan-400"
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleResetSettings}
              className="flex-1 text-xs py-1.5 rounded-md border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleSaveSettings}
              className="flex-1 text-xs py-1.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
            >
              {settingsSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 bg-gray-900/80 backdrop-blur-sm rounded-lg px-4 py-2.5 border border-gray-800">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="font-medium text-gray-300 mr-1">Size:</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border border-cyan-400/60 bg-cyan-400/20" />
            low
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border border-cyan-400/60 bg-cyan-400/20" />
            urgent
          </span>
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
          <span className="flex items-center gap-1">
            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#22d3ee" strokeWidth="1.2" strokeOpacity="0.6" /></svg>
            shared tag
          </span>
        </div>
      </div>

      {/* Tooltip */}
      <GraphTooltip data={tooltip} />
    </div>
  );
}
