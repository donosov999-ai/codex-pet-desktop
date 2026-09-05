#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    const CELL_WIDTH: u32 = 192;
    const CELL_HEIGHT: u32 = 208;
    const STATES: &[(&str, u32, u32)] = &[
        ("idle", 0, 6),
        ("running-right", 1, 8),
        ("running-left", 2, 8),
        ("waving", 3, 4),
        ("jumping", 4, 5),
        ("failed", 5, 8),
        ("waiting", 6, 6),
        ("running", 7, 6),
        ("review", 8, 6),
    ];
    const V2_LOOK_STATES: &[(&str, u32, u32)] =
        &[("look-000-157.5", 9, 8), ("look-180-337.5", 10, 8)];

    #[derive(Clone, Copy, Debug)]
    struct Bounds {
        width: u32,
        height: u32,
    }

    fn repo_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repo root")
            .to_path_buf()
    }

    fn alpha_bounds(image: &image::RgbaImage, row: u32, col: u32) -> Bounds {
        let x0 = col * CELL_WIDTH;
        let y0 = row * CELL_HEIGHT;
        let mut left = CELL_WIDTH;
        let mut top = CELL_HEIGHT;
        let mut right = 0;
        let mut bottom = 0;
        let mut found = false;

        for y in 0..CELL_HEIGHT {
            for x in 0..CELL_WIDTH {
                let alpha = image.get_pixel(x0 + x, y0 + y).0[3];
                if alpha == 0 {
                    continue;
                }
                found = true;
                left = left.min(x);
                top = top.min(y);
                right = right.max(x + 1);
                bottom = bottom.max(y + 1);
            }
        }

        assert!(
            found,
            "expected non-empty sprite cell at row {row}, col {col}"
        );
        Bounds {
            width: right - left,
            height: bottom - top,
        }
    }

    /// The scan window must be the pack's cell, not the app-wide constant.
    ///
    /// With a 314px cell and a 192px window the scan only ever saw the left half of a frame:
    /// nothing was found for centred poses, and the bounds arithmetic underflowed. The cell is a
    /// property of the pack now, so every reader of the atlas has to be told which one it is.
    fn visible_ink_bounds(
        image: &image::RgbaImage,
        row: u32,
        col: u32,
        cell_width: u32,
    ) -> Option<Bounds> {
        let x0 = col * cell_width;
        let y0 = row * CELL_HEIGHT;
        let mut left = cell_width;
        let mut top = CELL_HEIGHT;
        let mut right = 0;
        let mut bottom = 0;
        let mut count = 0;

        for y in 0..CELL_HEIGHT {
            for x in 0..cell_width {
                let [red, green, blue, alpha] = image.get_pixel(x0 + x, y0 + y).0;
                let near_white = red > 245 && green > 245 && blue > 245;
                if alpha <= 16 || near_white {
                    continue;
                }
                count += 1;
                left = left.min(x);
                top = top.min(y);
                right = right.max(x + 1);
                bottom = bottom.max(y + 1);
            }
        }

        // right/left stay untouched when nothing was found, so guard the subtraction rather than
        // trusting the count: a frame can hold ink outside the window we were told to scan.
        if count < 120 || right <= left || bottom <= top {
            return None;
        }
        Some(Bounds {
            width: right - left,
            height: bottom - top,
        })
    }

    /// The cell a pack draws in, taken from its own manifest.
    ///
    /// These checks used to assert CELL_WIDTH * 8 outright. That constant is one of the reasons
    /// the four-legged packs shipped cropped: a wolf in profile needs a 314px cell and a fox 297,
    /// and the art was cut down to 192 so that this assertion would pass. A gate that enforces the
    /// cause of a defect is worse than no gate. A pack that declares `atlas` is measured against
    /// what it declares — the same field the renderer reads — and a pack that declares nothing is
    /// still held to the old geometry.
    fn declared_cell(manifest: &serde_json::Value) -> (u32, u32) {
        let atlas = manifest.get("atlas");
        let width = atlas
            .and_then(|a| a.get("cellWidth"))
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(CELL_WIDTH as u64) as u32;
        let columns = atlas
            .and_then(|a| a.get("columns"))
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(8) as u32;
        (width, columns)
    }

    #[test]
    /// Moved off the native pack: mi-fen was dropped together with the other native skins.
    /// The check itself still matters — a click-reaction frame must not be noticeably shorter
    /// than idle and must not be blown up, or the pet appears to crouch or swell on click,
    /// which reads as a glitch rather than a gesture.
    fn click_action_keeps_idle_body_proportions() {
        let path = repo_root().join("resources/pets/grovi/spritesheet.webp");
        let manifest: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(repo_root().join("resources/pets/grovi/pet.json"))
                .expect("read grovi pet.json"),
        )
        .expect("parse grovi pet.json");
        let (cell_width, columns) = declared_cell(&manifest);
        let image = image::open(&path)
            .unwrap_or_else(|error| panic!("open {}: {error}", path.display()))
            .to_rgba8();
        assert_eq!(image.dimensions(), (cell_width * columns, CELL_HEIGHT * 9));

        let idle = alpha_bounds(&image, 0, 0);
        for col in 0..4 {
            let waving = alpha_bounds(&image, 3, col);
            assert!(
                waving.height * 100 >= idle.height * 85,
                "click frame {col} is too short: {:?}, idle {:?}",
                waving,
                idle
            );
            // Not "no wider than idle" but "not blown up". The old bound came from the native
            // pack, whose wave never moved an arm out. A real wave widens the silhouette — that
            // IS the gesture; what we must catch is a swollen frame, not a raised paw.
            // Measured on grovi: wave 166 against idle 165, one pixel.
            assert!(
                waving.width * 100 <= idle.width * 115,
                "click frame {col} is blown up: {:?}, idle {:?}",
                waving,
                idle
            );
        }
    }

    #[test]
    fn every_declared_pet_frame_has_visible_ink() {
        let pets_root = repo_root().join("resources/pets");
        let entries = std::fs::read_dir(&pets_root)
            .unwrap_or_else(|error| panic!("read {}: {error}", pets_root.display()));

        for entry in entries {
            let entry = entry.expect("read pet dir entry");
            let pet_dir = entry.path();
            if !pet_dir.is_dir() {
                continue;
            }
            let pet_id = pet_dir
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let path = pet_dir.join("spritesheet.webp");
            let manifest_path = pet_dir.join("pet.json");
            let manifest: serde_json::Value = serde_json::from_str(
                &std::fs::read_to_string(&manifest_path)
                    .unwrap_or_else(|error| panic!("read {}: {error}", manifest_path.display())),
            )
            .unwrap_or_else(|error| panic!("parse {}: {error}", manifest_path.display()));
            let sprite_version_number = manifest
                .get("spriteVersionNumber")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(1);
            let expected_rows = if sprite_version_number >= 2 { 11 } else { 9 };
            let image = image::open(&path)
                .unwrap_or_else(|error| panic!("open {}: {error}", path.display()))
                .to_rgba8();
            let (cell_width, columns) = declared_cell(&manifest);
            assert_eq!(
                image.dimensions(),
                (cell_width * columns, CELL_HEIGHT * expected_rows),
                "{pet_id} atlas dimensions"
            );

            let extra_states = if sprite_version_number >= 2 {
                V2_LOOK_STATES
            } else {
                &[]
            };
            // Take the frame count from where the app takes it: the pack's stateTimings.
            //
            // The gate used to walk a list of its own with the counts baked in. That agreed with
            // reality only while every pack was identical; since the cell and the frame count
            // became pack properties the list was wrong in both directions - it checked cells a
            // pack does not have and skipped the ones it declared. Zero means "no art for this
            // state": the app never enters it, so there is nothing here to check.
            for (state, row, default_frames) in STATES.iter().chain(extra_states) {
                let frames = manifest
                    .get("stateTimings")
                    .and_then(|t| t.get(state))
                    .and_then(|t| t.get("frames"))
                    .and_then(serde_json::Value::as_u64)
                    .map_or(*default_frames, |value| value as u32);
                for col in 0..frames {
                    let bounds = visible_ink_bounds(&image, *row, col, cell_width).unwrap_or_else(|| {
                        panic!("{pet_id} {state} frame {col} is visually blank")
                    });
                    assert!(
                        bounds.width >= 16 && bounds.height >= 16,
                        "{pet_id} {state} frame {col} is too small: {:?}",
                        bounds
                    );
                }
            }
        }
    }
}
