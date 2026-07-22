#!/usr/bin/env python3

import argparse
from pathlib import Path

from PIL import Image


CELL_WIDTH = 192
CELL_HEIGHT = 208
COLUMNS = 8
STANDARD_ROWS = 9
DEFAULT_STATES = ["sleep", "eat", "wash", "play", "toilet"]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Build a standard Codex atlas plus a separate care-state atlas from approved frames."
    )
    parser.add_argument("--standard-source", required=True, type=Path)
    parser.add_argument("--frames-root", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--state", action="append", dest="states")
    return parser.parse_args()


def save_webp(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", lossless=True, method=6)


def main():
    args = parse_args()
    states = args.states or DEFAULT_STATES
    standard_source = Image.open(args.standard_source).convert("RGBA")
    expected_width = COLUMNS * CELL_WIDTH
    expected_height = STANDARD_ROWS * CELL_HEIGHT
    if standard_source.width != expected_width or standard_source.height < expected_height:
        raise SystemExit(
            f"Standard source must be {expected_width}px wide and at least {expected_height}px high; "
            f"got {standard_source.width}x{standard_source.height}"
        )

    save_webp(
        standard_source.crop((0, 0, expected_width, expected_height)),
        args.output_dir / "spritesheet.webp",
    )

    care_atlas = Image.new("RGBA", (expected_width, len(states) * CELL_HEIGHT), (0, 0, 0, 0))
    frame_counts = {}
    for row, state in enumerate(states):
        frame_paths = sorted((args.frames_root / state).glob("*.png"))
        if not frame_paths or len(frame_paths) > COLUMNS:
            raise SystemExit(f"State {state} must contain 1-{COLUMNS} PNG frames; found {len(frame_paths)}")
        frame_counts[state] = len(frame_paths)
        for column, frame_path in enumerate(frame_paths):
            frame = Image.open(frame_path).convert("RGBA")
            if frame.size != (CELL_WIDTH, CELL_HEIGHT):
                raise SystemExit(
                    f"Frame {frame_path} must be {CELL_WIDTH}x{CELL_HEIGHT}; got {frame.width}x{frame.height}"
                )
            care_atlas.alpha_composite(frame, (column * CELL_WIDTH, row * CELL_HEIGHT))

    save_webp(care_atlas, args.output_dir / "care-spritesheet.webp")
    print(
        {
            "ok": True,
            "standard": [expected_width, expected_height],
            "care": [care_atlas.width, care_atlas.height],
            "states": frame_counts,
        }
    )


if __name__ == "__main__":
    main()
