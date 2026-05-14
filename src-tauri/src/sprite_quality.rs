#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    const CELL_WIDTH: u32 = 192;
    const CELL_HEIGHT: u32 = 208;

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
}
