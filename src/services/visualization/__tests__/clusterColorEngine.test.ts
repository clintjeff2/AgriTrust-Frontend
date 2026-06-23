import { describe, expect, it } from "vitest";
import { ciede2000 } from "@/src/utils/color";
import { hashString } from "@/src/utils/hash";
import { generatePalette, getClusterColorAssignments, getMinimumAdjacentDistance } from "@/src/services/visualization/clusterColorEngine";
import type { ClusterColorInput } from "@/src/types/visualization";

describe("clusterColorEngine", () => {
  it("implements deterministic FNV-1a 64-bit hashing", () => {
    expect(hashString("").toString(16)).toBe("cbf29ce484222325");
    expect(hashString("cluster-region-west").toString(16)).toBe("701f5066669a218c");
  });

  it("generates a deterministic 32 hue by 5 luminance palette", () => {
    const palette = generatePalette(160, "supply-chain");
    expect(palette).toHaveLength(160);
    expect(new Set(palette.map((color) => color.paletteIndex)).size).toBe(160);
    expect(new Set(palette.map((color) => color.oklch.l)).size).toBe(5);
    expect(palette.map(({ clusterId, hex, paletteIndex }) => ({ clusterId, hex, paletteIndex })).slice(0, 8)).toMatchInlineSnapshot(`
      [
        {
          "clusterId": "palette-0",
          "hex": "#818900",
          "paletteIndex": 42,
        },
        {
          "clusterId": "palette-1",
          "hex": "#679100",
          "paletteIndex": 43,
        },
        {
          "clusterId": "palette-2",
          "hex": "#3f9711",
          "paletteIndex": 44,
        },
        {
          "clusterId": "palette-3",
          "hex": "#009b35",
          "paletteIndex": 45,
        },
        {
          "clusterId": "palette-4",
          "hex": "#009f59",
          "paletteIndex": 46,
        },
        {
          "clusterId": "palette-5",
          "hex": "#00a073",
          "paletteIndex": 47,
        },
        {
          "clusterId": "palette-6",
          "hex": "#00a085",
          "paletteIndex": 48,
        },
        {
          "clusterId": "palette-7",
          "hex": "#009e9d",
          "paletteIndex": 49,
        },
      ]
    `);
  });

  it("keeps color assignments stable for 50 random-looking cluster IDs", () => {
    const ids = Array.from({ length: 50 }, (_, index) => `cluster-${index}-${hashString(`visual-${index}`).toString(36)}`);
    const first = getClusterColorAssignments(ids);
    const second = getClusterColorAssignments(ids);

    expect([...first.values()].map((color) => color.hex)).toEqual([...second.values()].map((color) => color.hex));
    expect([...first.values()].map(({ clusterId, hex, paletteIndex }) => ({ clusterId, hex, paletteIndex }))).toMatchInlineSnapshot(`
      [
        {
          "clusterId": "cluster-0-3hohhpace4a9w",
          "hex": "#ff93ab",
          "paletteIndex": 129,
        },
        {
          "clusterId": "cluster-1-3hohi3bgaycaf",
          "hex": "#b476ef",
          "paletteIndex": 91,
        },
        {
          "clusterId": "cluster-2-3hohihck7seay",
          "hex": "#00a3fa",
          "paletteIndex": 85,
        },
        {
          "clusterId": "cluster-3-3hohivdo4mgbh",
          "hex": "#c66fde",
          "paletteIndex": 92,
        },
        {
          "clusterId": "cluster-4-3hohg55wqs27s",
          "hex": "#a84c00",
          "paletteIndex": 6,
        },
        {
          "clusterId": "cluster-5-3hohgj70nm48b",
          "hex": "#d5455d",
          "paletteIndex": 33,
        },
        {
          "clusterId": "cluster-6-3hohgx84kg68u",
          "hex": "#b14100",
          "paletteIndex": 5,
        },
        {
          "clusterId": "cluster-7-3hohhb98ha89d",
          "hex": "#0072c1",
          "paletteIndex": 21,
        },
        {
          "clusterId": "cluster-8-3hohel1h3fu5o",
          "hex": "#008218",
          "paletteIndex": 13,
        },
        {
          "clusterId": "cluster-9-3hohez2l09w67",
          "hex": "#de65ba",
          "paletteIndex": 94,
        },
        {
          "clusterId": "cluster-10-1golbp6nodzl1",
          "hex": "#9b5700",
          "paletteIndex": 7,
        },
        {
          "clusterId": "cluster-11-1golbb5jrjxki",
          "hex": "#e661a6",
          "paletteIndex": 95,
        },
        {
          "clusterId": "cluster-12-1golax4fupvjz",
          "hex": "#eba100",
          "paletteIndex": 103,
        },
        {
          "clusterId": "cluster-13-1golaj3bxvtjg",
          "hex": "#88c8ff",
          "paletteIndex": 151,
        },
        {
          "clusterId": "cluster-14-1gola52811rix",
          "hex": "#d14577",
          "paletteIndex": 32,
        },
        {
          "clusterId": "cluster-15-1gol9r1447pie",
          "hex": "#9e369a",
          "paletteIndex": 29,
        },
        {
          "clusterId": "cluster-16-1gol9d007dnhv",
          "hex": "#db8000",
          "paletteIndex": 70,
        },
        {
          "clusterId": "cluster-17-1gol8yywajlhc",
          "hex": "#c8b300",
          "paletteIndex": 105,
        },
        {
          "clusterId": "cluster-18-1goletfiz2fp9",
          "hex": "#9fc1ff",
          "paletteIndex": 152,
        },
        {
          "clusterId": "cluster-19-1golefef28doq",
          "hex": "#b5285f",
          "paletteIndex": 0,
        },
        {
          "clusterId": "cluster-20-1gov38yodcesu",
          "hex": "#786ae5",
          "paletteIndex": 57,
        },
        {
          "clusterId": "cluster-21-1gov3mzsa6gtd",
          "hex": "#a6328c",
          "paletteIndex": 30,
        },
        {
          "clusterId": "cluster-22-1gov2gwgjoars",
          "hex": "#ff79ac",
          "paletteIndex": 96,
        },
        {
          "clusterId": "cluster-23-1gov2uxkgicsb",
          "hex": "#009c3e",
          "paletteIndex": 45,
        },
        {
          "clusterId": "cluster-24-1gov4t340omuy",
          "hex": "#6caeff",
          "paletteIndex": 119,
        },
        {
          "clusterId": "cluster-25-1gov5747xiovh",
          "hex": "#00d0e4",
          "paletteIndex": 114,
        },
        {
          "clusterId": "cluster-26-1gov410w70itw",
          "hex": "#f26644",
          "paletteIndex": 67,
        },
        {
          "clusterId": "cluster-27-1gov4f203ukuf",
          "hex": "#ffbb00",
          "paletteIndex": 135,
        },
        {
          "clusterId": "cluster-28-1gov04pt2nyom",
          "hex": "#af2c75",
          "paletteIndex": 31,
        },
        {
          "clusterId": "cluster-29-1gov0iqwzi0p5",
          "hex": "#d0b1ff",
          "paletteIndex": 154,
        },
        {
          "clusterId": "cluster-30-1gp4usqp2au0n",
          "hex": "#0097c1",
          "paletteIndex": 51,
        },
        {
          "clusterId": "cluster-31-1gp4uepl5gs04",
          "hex": "#8765e0",
          "paletteIndex": 58,
        },
        {
          "clusterId": "cluster-32-1gp4vkswvyy1p",
          "hex": "#659100",
          "paletteIndex": 43,
        },
        {
          "clusterId": "cluster-33-1gp4v6rsz4w16",
          "hex": "#40b7ff",
          "paletteIndex": 118,
        },
        {
          "clusterId": "cluster-34-1gp4t8m9eylyj",
          "hex": "#009e9e",
          "paletteIndex": 49,
        },
        {
          "clusterId": "cluster-35-1gp4sul5i4jy0",
          "hex": "#ffa05d",
          "paletteIndex": 132,
        },
        {
          "clusterId": "cluster-36-1gp4u0oh8mpzl",
          "hex": "#ba96ff",
          "paletteIndex": 122,
        },
        {
          "clusterId": "cluster-37-1gp4tmndbsnz2",
          "hex": "#ff9a78",
          "paletteIndex": 131,
        },
        {
          "clusterId": "cluster-38-1gp4rohtrmdwf",
          "hex": "#6ee982",
          "paletteIndex": 141,
        },
        {
          "clusterId": "cluster-39-1gp4ragpusbvw",
          "hex": "#f36160",
          "paletteIndex": 66,
        },
        {
          "clusterId": "cluster-40-1gna8b7y56tug",
          "hex": "#ffa840",
          "paletteIndex": 133,
        },
        {
          "clusterId": "cluster-41-1gna8p9220vuz",
          "hex": "#ca488f",
          "paletteIndex": 63,
        },
        {
          "clusterId": "cluster-42-1gna93a5yuxvi",
          "hex": "#f25f76",
          "paletteIndex": 65,
        },
        {
          "clusterId": "cluster-43-1gna9hb9vozw1",
          "hex": "#00baa2",
          "paletteIndex": 80,
        },
        {
          "clusterId": "cluster-44-1gna9vcdsj1wk",
          "hex": "#8f3ead",
          "paletteIndex": 28,
        },
        {
          "clusterId": "cluster-45-1gnaa9dhpd3x3",
          "hex": "#517800",
          "paletteIndex": 11,
        },
        {
          "clusterId": "cluster-46-1gnaanelm75xm",
          "hex": "#00b86c",
          "paletteIndex": 78,
        },
        {
          "clusterId": "cluster-47-1gnab1fpj17y5",
          "hex": "#d6474a",
          "paletteIndex": 34,
        },
        {
          "clusterId": "cluster-48-1gna56z2uidq8",
          "hex": "#a87800",
          "paletteIndex": 40,
        },
        {
          "clusterId": "cluster-49-1gna5l06rcfqr",
          "hex": "#b63700",
          "paletteIndex": 4,
        },
      ]
    `);
  });

  it("keeps adjacent clusters at least 30 CIEDE2000 apart when palette capacity allows", () => {
    const clusters: ClusterColorInput[] = Array.from({ length: 24 }, (_, index) => ({
      id: `region-${index}`,
      adjacentIds: index === 0 ? ["region-23", "region-1"] : index === 23 ? ["region-22", "region-0"] : [`region-${index - 1}`, `region-${index + 1}`],
    }));

    const assignments = getClusterColorAssignments(clusters);
    expect(getMinimumAdjacentDistance(assignments, clusters)).toBeGreaterThanOrEqual(30);
  });

  it("can create assignments for 100 clusters without quadratic palette construction", () => {
    const ids = Array.from({ length: 100 }, (_, index) => `product-type-${index}`);
    const startedAt = performance.now();
    const assignments = getClusterColorAssignments(ids);
    const elapsed = performance.now() - startedAt;

    expect(assignments.size).toBe(100);
    expect(elapsed).toBeLessThan(25);
  });

  it("exposes CIEDE2000 distances for generated colors", () => {
    const [a, b] = generatePalette(2, "distance-check");
    expect(ciede2000(a.lab, b.lab)).toBeGreaterThan(0);
  });
});
