#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_ATLAS_WIDTH = 1536;
const EXPECTED_ATLAS_HEIGHT = 1872;
const DEFAULT_ROOT = path.resolve(__dirname, "..");
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parseVp8LossySize(payload) {
  for (let index = 0; index <= payload.length - 10; index += 1) {
    if (payload[index] === 0x9d && payload[index + 1] === 0x01 && payload[index + 2] === 0x2a) {
      return {
        width: payload.readUInt16LE(index + 3) & 0x3fff,
        height: payload.readUInt16LE(index + 5) & 0x3fff
      };
    }
  }
  throw new Error("Could not find VP8 frame header");
}

function parseVp8LosslessSize(payload) {
  if (payload[0] !== 0x2f) {
    throw new Error("Invalid VP8L signature");
  }
  const bits = payload.readUInt32LE(1);
  return {
    width: (bits & 0x3fff) + 1,
    height: ((bits >> 14) & 0x3fff) + 1
  };
}

function parseWebpSize(buffer) {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Not a WebP RIFF file");
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + chunkSize;
    if (payloadEnd > buffer.length) {
      throw new Error(`Invalid WebP chunk size for ${chunkType}`);
    }

    const payload = buffer.subarray(payloadStart, payloadEnd);
    if (chunkType === "VP8X") {
      if (payload.length < 10) {
        throw new Error("Invalid VP8X chunk");
      }
      return {
        width: readUInt24LE(payload, 4) + 1,
        height: readUInt24LE(payload, 7) + 1
      };
    }
    if (chunkType === "VP8 ") {
      return parseVp8LossySize(payload);
    }
    if (chunkType === "VP8L") {
      return parseVp8LosslessSize(payload);
    }

    offset = payloadEnd + (chunkSize % 2);
  }

  throw new Error("Missing WebP image chunk");
}

function isRootFileName(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === path.basename(value) &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("..")
  );
}

function validatePetResources(petsRoot, options = {}) {
  const expectedWidth = options.expectedWidth || EXPECTED_ATLAS_WIDTH;
  const expectedHeight = options.expectedHeight || EXPECTED_ATLAS_HEIGHT;
  const pets = [];
  const errors = [];

  const entries = fs.existsSync(petsRoot)
    ? fs.readdirSync(petsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const petDir = path.join(petsRoot, entry.name);
    const manifestPath = path.join(petDir, "pet.json");
    const petReport = {
      id: entry.name,
      ok: true,
      displayName: "",
      version: "",
      spritesheet: "",
      width: 0,
      height: 0,
      errors: []
    };

    try {
      if (!fs.existsSync(manifestPath)) {
        throw new Error("Missing pet.json");
      }
      const manifest = readJson(manifestPath);
      petReport.id = manifest.id || entry.name;
      petReport.displayName = manifest.displayName || manifest.name || "";
      petReport.version = manifest.version || "1.0.0";
      petReport.spriteVersionNumber = Number.isInteger(Number(manifest.spriteVersionNumber))
        ? Number(manifest.spriteVersionNumber)
        : 1;
      if (!petReport.id) {
        petReport.errors.push("pet.json id is required");
      } else if (petReport.id !== entry.name) {
        petReport.errors.push(`pet.json id must match directory name: expected ${entry.name}, got ${petReport.id}`);
      }
      if (!petReport.displayName) {
        petReport.errors.push("pet.json displayName is required");
      }
      petReport.author = typeof manifest.author === "string" ? manifest.author.trim() : "";
      petReport.license = typeof manifest.license === "string" ? manifest.license.trim() : "";
      petReport.minAppVersion = typeof manifest.minAppVersion === "string" ? manifest.minAppVersion.trim() : "";
      petReport.tags = Array.isArray(manifest.tags) ? manifest.tags.filter((tag) => typeof tag === "string" && tag.trim()) : manifest.tags;
      petReport.changelog = Array.isArray(manifest.changelog)
        ? manifest.changelog.filter((entry) => typeof entry === "string" && entry.trim())
        : manifest.changelog;
      if (!petReport.author) {
        petReport.errors.push("author is required");
      }
      if (!petReport.license) {
        petReport.errors.push("license is required");
      }
      if (!SEMVER_RE.test(petReport.minAppVersion)) {
        petReport.errors.push("minAppVersion must be x.y.z");
      }
      if (!Array.isArray(manifest.tags)) {
        petReport.errors.push("tags must be an array");
      } else if (!petReport.tags.length) {
        petReport.errors.push("tags must include at least one tag");
      } else if (new Set(petReport.tags).size !== petReport.tags.length) {
        petReport.errors.push("tags must not contain duplicates");
      }
      if (!Array.isArray(manifest.changelog)) {
        petReport.errors.push("changelog must be an array");
      } else if (!petReport.changelog.length) {
        petReport.errors.push("changelog must include at least one entry");
      }

      const spritesheet = manifest.spritesheetPath || "spritesheet.webp";
      petReport.spritesheet = spritesheet;
      if (!isRootFileName(spritesheet)) {
        petReport.errors.push("spritesheetPath must be a root-level file name without /, \\, or ..");
      } else if (!fs.existsSync(path.join(petDir, spritesheet))) {
        petReport.errors.push(`Missing spritesheet: ${spritesheet}`);
      } else {
        const spritesheetPath = path.join(petDir, spritesheet);
        const size = parseWebpSize(fs.readFileSync(spritesheetPath));
        petReport.width = size.width;
        petReport.height = size.height;
        const rowsFromHeight = size.height / 208;
        const heightOk =
          size.height === expectedHeight ||
          (size.height % 208 === 0 && rowsFromHeight >= 9 && rowsFromHeight <= 12);
        if (size.width !== expectedWidth || !heightOk) {
          petReport.errors.push(
            `Expected spritesheet ${expectedWidth}x${expectedHeight} (or 1536 x 208*rows, 9-12 rows), got ${size.width}x${size.height}`
          );
        }
        const requiredRows = petReport.spriteVersionNumber >= 2 ? 11 : 9;
        if (rowsFromHeight !== requiredRows) {
          petReport.errors.push(
            `spriteVersionNumber ${petReport.spriteVersionNumber} requires ${requiredRows} rows, got ${rowsFromHeight}`
          );
        }
      }

      if (manifest.care !== undefined) {
        const care = manifest.care;
        if (!care || typeof care !== "object" || Array.isArray(care)) {
          petReport.errors.push("care must be an object");
        } else {
          const careSheet = care.spritesheetPath;
          const atlas = care.atlas && typeof care.atlas === "object" ? care.atlas : {};
          const states = care.states && typeof care.states === "object" && !Array.isArray(care.states)
            ? care.states
            : {};
          const columns = Number(atlas.columns);
          const rows = Number(atlas.rows);
          const cellWidth = Number(atlas.cellWidth);
          const cellHeight = Number(atlas.cellHeight);
          const expectedCareWidth = columns * cellWidth;
          const expectedCareHeight = rows * cellHeight;
          const careReport = {
            spritesheet: careSheet || "",
            width: 0,
            height: 0,
            stateCount: Object.keys(states).length
          };
          petReport.care = careReport;

          if (!isRootFileName(careSheet)) {
            petReport.errors.push("care.spritesheetPath must be a root-level file name");
          } else if (!fs.existsSync(path.join(petDir, careSheet))) {
            petReport.errors.push(`Missing care spritesheet: ${careSheet}`);
          } else if (
            ![columns, rows, cellWidth, cellHeight].every((value) => Number.isInteger(value) && value > 0)
          ) {
            petReport.errors.push("care.atlas dimensions must be positive integers");
          } else {
            const careSize = parseWebpSize(fs.readFileSync(path.join(petDir, careSheet)));
            careReport.width = careSize.width;
            careReport.height = careSize.height;
            if (careSize.width !== expectedCareWidth || careSize.height !== expectedCareHeight) {
              petReport.errors.push(
                `Expected care spritesheet ${expectedCareWidth}x${expectedCareHeight}, got ${careSize.width}x${careSize.height}`
              );
            }
          }

          if (!Object.keys(states).length) {
            petReport.errors.push("care.states must include at least one state");
          }
          for (const [stateId, state] of Object.entries(states)) {
            const row = Number(state?.row);
            const frames = Number(state?.frames);
            const fps = Number(state?.fps);
            const loops = state?.loops === undefined ? null : Number(state.loops);
            const durationMs = state?.durationMs === undefined ? null : Number(state.durationMs);
            if (!/^[a-z0-9][a-z0-9_-]*$/i.test(stateId)) {
              petReport.errors.push(`Invalid care state id: ${stateId}`);
            }
            if (!Number.isInteger(row) || row < 0 || row >= rows) {
              petReport.errors.push(`Invalid care row for ${stateId}: ${state?.row}`);
            }
            if (!Number.isInteger(frames) || frames < 1 || frames > columns) {
              petReport.errors.push(`Invalid care frame count for ${stateId}: ${state?.frames}`);
            }
            if (!Number.isFinite(fps) || fps <= 0) {
              petReport.errors.push(`Invalid care fps for ${stateId}: ${state?.fps}`);
            }
            if (loops !== null && (!Number.isInteger(loops) || loops < 1)) {
              petReport.errors.push(`Invalid care loop count for ${stateId}: ${state?.loops}`);
            }
            if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs < 1000)) {
              petReport.errors.push(`Invalid care duration for ${stateId}: ${state?.durationMs}`);
            }
            if (state?.timeline !== undefined) {
              const timeline = state.timeline;
              let timelineDurationMs = 0;
              let timelineSteps = 0;
              if (!Array.isArray(timeline) || !timeline.length) {
                petReport.errors.push(`Invalid care timeline for ${stateId}: expected at least one segment`);
              } else {
                for (const segment of timeline) {
                  const segmentFrames = segment?.frames;
                  const frameDurationMs = Number(segment?.frameDurationMs);
                  const repeat = segment?.repeat === undefined ? 1 : Number(segment.repeat);
                  if (
                    !Array.isArray(segmentFrames) ||
                    !segmentFrames.length ||
                    segmentFrames.some((frame) => !Number.isInteger(Number(frame)) || Number(frame) < 0 || Number(frame) >= frames)
                  ) {
                    petReport.errors.push(`Invalid care timeline frames for ${stateId}`);
                  }
                  if (!Number.isFinite(frameDurationMs) || frameDurationMs < 50) {
                    petReport.errors.push(`Invalid care timeline frame duration for ${stateId}`);
                  }
                  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100) {
                    petReport.errors.push(`Invalid care timeline repeat for ${stateId}`);
                  }
                  if (
                    Array.isArray(segmentFrames) &&
                    segmentFrames.length &&
                    Number.isFinite(frameDurationMs) &&
                    frameDurationMs >= 50 &&
                    Number.isInteger(repeat) &&
                    repeat >= 1 &&
                    repeat <= 100
                  ) {
                    timelineSteps += segmentFrames.length * repeat;
                    timelineDurationMs += segmentFrames.length * repeat * frameDurationMs;
                  }
                }
                if (timelineSteps > 512) {
                  petReport.errors.push(`Care timeline is too long for ${stateId}: ${timelineSteps} steps`);
                }
                if (durationMs !== null && timelineDurationMs !== durationMs) {
                  petReport.errors.push(
                    `Care timeline duration mismatch for ${stateId}: expected ${durationMs}, got ${timelineDurationMs}`
                  );
                }
              }
            }
          }
          if (
            care.autonomousStates !== undefined &&
            (!Array.isArray(care.autonomousStates) || care.autonomousStates.some((stateId) => !states[stateId]))
          ) {
            petReport.errors.push("care.autonomousStates must reference declared care states");
          }
        }
      }
    } catch (error) {
      petReport.errors.push(error.message);
    }

    petReport.ok = petReport.errors.length === 0;
    if (!petReport.ok) {
      errors.push({ id: petReport.id, errors: petReport.errors });
    }
    pets.push(petReport);
  }

  return {
    ok: errors.length === 0,
    expected: {
      width: expectedWidth,
      height: expectedHeight,
      columns: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208
    },
    pets,
    errors
  };
}

function writeQaReport(report, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
}

function main() {
  const root = DEFAULT_ROOT;
  const petsRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "resources", "pets");
  const outFile = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, "release", "petpacks", "qa.json");
  const report = validatePetResources(petsRoot);
  writeQaReport(report, outFile);
  if (!report.ok) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, petCount: report.pets.length, outFile }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  isRootFileName,
  parseWebpSize,
  validatePetResources,
  writeQaReport
};
