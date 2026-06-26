#version 300 es
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
}
