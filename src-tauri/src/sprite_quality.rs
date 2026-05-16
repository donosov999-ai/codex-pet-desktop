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

    fn visible_ink_bounds(image: &image::RgbaImage, row: u32, col: u32) -> Option<Bounds> {
        let x0 = col * CELL_WIDTH;
        let y0 = row * CELL_HEIGHT;
        let mut left = CELL_WIDTH;
        let mut top = CELL_HEIGHT;
        let mut right = 0;
        let mut bottom = 0;
        let mut count = 0;

        for y in 0..CELL_HEIGHT {
            for x in 0..CELL_WIDTH {
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

        (count >= 120).then_some(Bounds {
            width: right - left,
            height: bottom - top,
        })
    }

    #[test]
    fn mi_fen_click_action_keeps_idle_body_proportions() {
        let path = repo_root().join("resources/pets/mi-fen/spritesheet.webp");
        let image = image::open(&path)
            .unwrap_or_else(|error| panic!("open {}: {error}", path.display()))
            .to_rgba8();
        assert_eq!(image.dimensions(), (CELL_WIDTH * 8, CELL_HEIGHT * 9));

        let idle = alpha_bounds(&image, 0, 0);
        for col in 0..4 {
            let waving = alpha_bounds(&image, 3, col);
            assert!(
                waving.height * 100 >= idle.height * 85,
                "mi-fen click frame {col} is too short: {:?}, idle {:?}",
                waving,
                idle
            );
            assert!(
                waving.width <= idle.width,
                "mi-fen click frame {col} is wider than idle: {:?}, idle {:?}",
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
            let image = image::open(&path)
                .unwrap_or_else(|error| panic!("open {}: {error}", path.display()))
                .to_rgba8();
            assert_eq!(
                image.dimensions(),
                (CELL_WIDTH * 8, CELL_HEIGHT * 9),
                "{pet_id} atlas dimensions"
            );

            for (state, row, frames) in STATES {
                for col in 0..*frames {
                    let bounds = visible_ink_bounds(&image, *row, col).unwrap_or_else(|| {
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
