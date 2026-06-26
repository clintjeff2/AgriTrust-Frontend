#version 300 es
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
}
