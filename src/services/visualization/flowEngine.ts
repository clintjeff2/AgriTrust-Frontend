import { computeBundledEdges } from "@/src/services/visualization/edgeBundler";
import type { FlowCamera, FlowEdge, FlowNode, ParticleState } from "@/src/types/visualization";

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
in vec4 a_color;
in float a_size;
uniform vec2 u_resolution;
uniform vec2 u_camera;
uniform float u_zoom;
uniform float u_pixelRatio;
out vec4 v_color;
void main() {
  vec2 world = (a_position + u_camera) * u_zoom;
  vec2 clip = (world / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = clamp(a_size * u_zoom * u_pixelRatio, 2.0, 48.0);
  v_color = a_color;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  float core = smoothstep(0.5, 0.0, dist);
  float glow = smoothstep(0.5, 0.12, dist) * 0.45;
  float alpha = max(core, glow) * v_color.a;
  outColor = vec4(v_color.rgb * (0.65 + core), alpha);
}`;

const TICK_MS = 1000 / 60;
const STRIDE = 7;
const MAX_PIXEL_RATIO = 3;

export interface FlowEngineOptions {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  background?: [number, number, number, number];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate WebGL shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function parseColor(color = "#22c55e"): [number, number, number, number] {
  const hex = color.replace("#", "");
  const value = Number.parseInt(hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 0.9];
}

export class FlowEngine {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly buffer: WebGLBuffer;
  private animationId = 0;
  private lastTick = performance.now();
  private accumulator = 0;
  private particles: ParticleState[] = [];
  private edges: FlowEdge[] = [];
  private edgeVertices = new Float32Array();
  private particleVertices = new Float32Array();
  private camera: FlowCamera = { x: 0, y: 0, zoom: 1 };
  private pointer?: { id: number; x: number; y: number };
  private background: [number, number, number, number];

  constructor(private readonly canvas: HTMLCanvasElement, options: FlowEngineOptions = {}) {
    const gl = canvas.getContext("webgl2", { antialias: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is required for supply chain flow visualization");
    this.gl = gl;
    this.background = options.background ?? [0.02, 0.05, 0.1, 1];
    this.program = this.createProgram();
    this.vao = gl.createVertexArray() ?? this.fail("Unable to allocate vertex array");
    this.buffer = gl.createBuffer() ?? this.fail("Unable to allocate vertex buffer");
    this.configureGeometry();
    this.attachGestures();
    this.setData(options.nodes ?? [], options.edges ?? []);
    this.resize();
  }

  setData(nodes: FlowNode[], edges: FlowEdge[]): void {
    this.particles = nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      vx: node.vx ?? 0,
      vy: node.vy ?? 0,
      mass: node.mass ?? 1,
      size: node.size ?? 10,
      color: parseColor(node.color),
    }));
    this.edges = edges;
    this.rebuildEdgeVertices();
  }

  start(): void {
    if (this.animationId) return;
    const frame = (now: number) => {
      this.accumulator += now - this.lastTick;
      this.lastTick = now;
      while (this.accumulator >= TICK_MS) {
        this.tick(TICK_MS / 1000);
        this.accumulator -= TICK_MS;
      }
      this.render();
      this.animationId = requestAnimationFrame(frame);
    };
    this.lastTick = performance.now();
    this.animationId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = 0;
  }

  resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  dispose(): void {
    this.stop();
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }

  private tick(dt: number): void {
    const centerX = this.canvas.width * 0.5;
    const centerY = this.canvas.height * 0.5;
    const byId = new Map(this.particles.map((p) => [p.id, p]));
    for (const edge of this.edges) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const force = 0.0008 * (edge.bundleWeight ?? 1);
      source.vx += dx * force;
      source.vy += dy * force;
      target.vx -= dx * force;
      target.vy -= dy * force;
    }
    for (const particle of this.particles) {
      particle.vx += (centerX - particle.x) * 0.00004 / particle.mass;
      particle.vy += (centerY - particle.y) * 0.00004 / particle.mass;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
      particle.x += particle.vx * dt * 60;
      particle.y += particle.vy * dt * 60;
    }
    this.rebuildEdgeVertices();
  }

  private render(): void {
    this.resize();
    const gl = this.gl;
    gl.clearColor(...this.background);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_resolution"), this.canvas.width, this.canvas.height);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_camera"), this.camera.x, this.camera.y);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_zoom"), this.camera.zoom);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_pixelRatio"), Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    this.upload(this.edgeVertices);
    gl.drawArrays(gl.LINES, 0, this.edgeVertices.length / STRIDE);
    this.particleVertices = new Float32Array(this.particles.flatMap((p) => [p.x, p.y, ...p.color, p.size]));
    this.upload(this.particleVertices);
    gl.drawArrays(gl.POINTS, 0, this.particles.length);
  }

  private rebuildEdgeVertices(): void {
    const nodes = this.particles.map((p) => ({ id: p.id, x: p.x, y: p.y }));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const vertices: number[] = [];
    for (const edge of computeBundledEdges(nodes, this.edges)) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) continue;
      const control = edge.controlPoints[0];
      const color = parseColor(edge.color ?? "#38bdf8");
      vertices.push(source.x, source.y, ...color, 2, control.x, control.y, ...color, 2, control.x, control.y, ...color, 2, target.x, target.y, ...color, 2);
    }
    this.edgeVertices = new Float32Array(vertices);
  }

  private upload(data: Float32Array): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);
  }

  private configureGeometry(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const position = gl.getAttribLocation(this.program, "a_position");
    const color = gl.getAttribLocation(this.program, "a_color");
    const size = gl.getAttribLocation(this.program, "a_size");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, STRIDE * 4, 0);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(color, 4, gl.FLOAT, false, STRIDE * 4, 2 * 4);
    gl.enableVertexAttribArray(size);
    gl.vertexAttribPointer(size, 1, gl.FLOAT, false, STRIDE * 4, 6 * 4);
  }

  private createProgram(): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram() ?? this.fail("Unable to allocate WebGL program");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Unable to link shader program");
    return program;
  }

  private attachGestures(): void {
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointerdown", (event) => {
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      this.camera.x += (event.clientX - this.pointer.x) / this.camera.zoom;
      this.camera.y += (event.clientY - this.pointer.y) / this.camera.zoom;
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    this.canvas.addEventListener("pointerup", () => { this.pointer = undefined; });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const nextZoom = this.camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08);
      this.camera.zoom = Math.min(4, Math.max(0.25, nextZoom));
    }, { passive: false });
  }

  private fail(message: string): never {
    throw new Error(message);
  }
}
