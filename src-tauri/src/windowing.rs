use serde::{Deserialize, Serialize};
use tauri::{
    window::Color, AppHandle, LogicalSize, Manager, PhysicalPosition, Runtime, Size, WebviewWindow,
};

const EDGE_VISIBILITY_PX: i32 = 48;
const MIN_DYNAMIC_WINDOW_WIDTH: u32 = 160;
const MIN_DYNAMIC_WINDOW_HEIGHT: u32 = 180;
const MAX_DYNAMIC_WINDOW_WIDTH: u32 = 760;
const MAX_DYNAMIC_WINDOW_HEIGHT: u32 = 720;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    hit_edge: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WindowSize {
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AnchorOffset {
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResizeAnchor {
    current: AnchorOffset,
    next: AnchorOffset,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WorkArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PositionLimits {
    min_x: i32,
    max_x: i32,
    min_y: i32,
    max_y: i32,
}

pub(crate) fn main_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())
}

fn clamp(value: i32, min: i32, max: i32) -> i32 {
    value.max(min).min(max)
}

fn loose_position_limits(size: WindowSize, work_area: WorkArea) -> PositionLimits {
    PositionLimits {
        min_x: work_area.x - size.width as i32 + EDGE_VISIBILITY_PX,
        max_x: work_area.x + work_area.width as i32 - EDGE_VISIBILITY_PX,
        min_y: work_area.y - size.height as i32 + EDGE_VISIBILITY_PX,
        max_y: work_area.y + work_area.height as i32 - EDGE_VISIBILITY_PX,
    }
}

fn clamp_position(
    size: WindowSize,
    work_area: WorkArea,
    requested_x: i32,
    requested_y: i32,
) -> PhysicalPosition<i32> {
    let limits = loose_position_limits(size, work_area);
    PhysicalPosition::new(
        clamp(requested_x, limits.min_x, limits.max_x),
        clamp(requested_y, limits.min_y, limits.max_y),
    )
}

fn center_position(size: WindowSize, work_area: WorkArea) -> PhysicalPosition<i32> {
    PhysicalPosition::new(
        work_area.x + (work_area.width as i32 - size.width as i32) / 2,
        work_area.y + (work_area.height as i32 - size.height as i32) / 2,
    )
}

fn normalize_window_size(width: u32, height: u32) -> WindowSize {
    WindowSize {
        width: width.clamp(MIN_DYNAMIC_WINDOW_WIDTH, MAX_DYNAMIC_WINDOW_WIDTH),
        height: height.clamp(MIN_DYNAMIC_WINDOW_HEIGHT, MAX_DYNAMIC_WINDOW_HEIGHT),
    }
}

fn logical_window_size_to_physical(size: WindowSize, scale_factor: f64) -> WindowSize {
    let physical =
        LogicalSize::new(size.width as f64, size.height as f64).to_physical::<u32>(scale_factor);
    WindowSize {
        width: physical.width,
        height: physical.height,
    }
}

fn scale_anchor_offset(offset: AnchorOffset, scale_factor: f64) -> AnchorOffset {
    AnchorOffset {
        x: offset.x * scale_factor,
        y: offset.y * scale_factor,
    }
}

fn scale_resize_anchor(anchor: ResizeAnchor, scale_factor: f64) -> ResizeAnchor {
    ResizeAnchor {
        current: scale_anchor_offset(anchor.current, scale_factor),
        next: scale_anchor_offset(anchor.next, scale_factor),
    }
}

fn resize_anchor_position(
    current_position: PhysicalPosition<i32>,
    current_size: WindowSize,
    next_size: WindowSize,
    work_area: WorkArea,
) -> PhysicalPosition<i32> {
    let anchor_x = current_position.x + current_size.width as i32 / 2;
    let anchor_y = current_position.y + current_size.height as i32;
    clamp_position(
        next_size,
        work_area,
        anchor_x - next_size.width as i32 / 2,
        anchor_y - next_size.height as i32,
    )
}

fn resize_anchor_position_with_offsets(
    current_position: PhysicalPosition<i32>,
    _current_size: WindowSize,
    next_size: WindowSize,
    work_area: WorkArea,
    anchor: ResizeAnchor,
) -> PhysicalPosition<i32> {
    let anchor_x = current_position.x as f64 + anchor.current.x;
    let anchor_y = current_position.y as f64 + anchor.current.y;
    clamp_position(
        next_size,
        work_area,
        (anchor_x - anchor.next.x).round() as i32,
        (anchor_y - anchor.next.y).round() as i32,
    )
}

fn current_work_area<R: Runtime>(window: &WebviewWindow<R>) -> Result<WorkArea, String> {
    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or(window
            .primary_monitor()
            .map_err(|error| error.to_string())?)
        .ok_or_else(|| "monitor not found".to_string())?;
    let work_area = monitor.work_area();
    Ok(WorkArea {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
    })
}

fn outer_window_size<R: Runtime>(window: &WebviewWindow<R>) -> Result<WindowSize, String> {
    let size = window.outer_size().map_err(|error| error.to_string())?;
    Ok(WindowSize {
        width: size.width,
        height: size.height,
    })
}

pub(crate) fn clamp_loose_position<R: Runtime>(
    window: &WebviewWindow<R>,
    requested_x: i32,
    requested_y: i32,
) -> Result<PhysicalPosition<i32>, String> {
    Ok(clamp_position(
        outer_window_size(window)?,
        current_work_area(window)?,
        requested_x,
        requested_y,
    ))
}

pub(crate) fn reset_window_position<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<WindowBounds, String> {
    let monitor = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "primary monitor not found".to_string())?;
    let work_area = monitor.work_area();
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let next = PhysicalPosition::new(
        work_area.position.x + work_area.size.width as i32 - size.width as i32 - EDGE_VISIBILITY_PX,
        work_area.position.y + work_area.size.height as i32
            - size.height as i32
            - EDGE_VISIBILITY_PX,
    );
    window
        .set_position(next)
        .map_err(|error| error.to_string())?;
    Ok(WindowBounds {
        x: next.x,
        y: next.y,
        width: size.width,
        height: size.height,
        hit_edge: String::new(),
    })
}

pub(crate) fn center_window_position<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<WindowBounds, String> {
    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or(window
            .primary_monitor()
            .map_err(|error| error.to_string())?)
        .ok_or_else(|| "monitor not found".to_string())?;
    let work_area = monitor.work_area();
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let next = center_position(
        WindowSize {
            width: size.width,
            height: size.height,
        },
        WorkArea {
            x: work_area.position.x,
            y: work_area.position.y,
            width: work_area.size.width,
            height: work_area.size.height,
        },
    );
    window
        .set_position(next)
        .map_err(|error| error.to_string())?;
    Ok(WindowBounds {
        x: next.x,
        y: next.y,
        width: size.width,
        height: size.height,
        hit_edge: String::new(),
    })
}

pub(crate) fn position_initial_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = main_window(app)?;
    let _ = window.set_decorations(false);
    let _ = window.set_shadow(false);
    let _ = window.set_resizable(false);
    let _ = window.set_always_on_top(true);
    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
    let _ = window.set_size(Size::Logical(LogicalSize::new(320.0, 340.0)));
    reset_window_position(&window)?;
    window.show().map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn move_window_by<R: Runtime>(
    window: &WebviewWindow<R>,
    x: f64,
    y: f64,
) -> Result<WindowBounds, String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let requested_x = position.x + x.round() as i32;
    let requested_y = position.y + y.round() as i32;
    let next = clamp_loose_position(window, requested_x, requested_y)?;
    let hit_edge = if next.x != requested_x {
        if requested_x < next.x {
            "left"
        } else {
            "right"
        }
    } else if next.y != requested_y {
        if requested_y < next.y {
            "top"
        } else {
            "bottom"
        }
    } else {
        ""
    };
    window
        .set_position(next)
        .map_err(|error| error.to_string())?;
    Ok(WindowBounds {
        x: next.x,
        y: next.y,
        width: size.width,
        height: size.height,
        hit_edge: hit_edge.to_string(),
    })
}

pub(crate) fn resize_window<R: Runtime>(
    window: &WebviewWindow<R>,
    width: u32,
    height: u32,
    anchor: Option<ResizeAnchor>,
) -> Result<WindowBounds, String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let current_size = outer_window_size(window)?;
    let next_logical_size = normalize_window_size(width, height);
    let scale_factor = window.scale_factor().map_err(|error| error.to_string())?;
    let next_size = logical_window_size_to_physical(next_logical_size, scale_factor);
    let work_area = current_work_area(window)?;
    let next_position = anchor.map_or_else(
        || resize_anchor_position(position, current_size, next_size, work_area),
        |anchor| {
            resize_anchor_position_with_offsets(
                position,
                current_size,
                next_size,
                work_area,
                scale_resize_anchor(anchor, scale_factor),
            )
        },
    );
    window
        .set_size(Size::Logical(LogicalSize::new(
            next_logical_size.width as f64,
            next_logical_size.height as f64,
        )))
        .map_err(|error| error.to_string())?;
    window
        .set_position(next_position)
        .map_err(|error| error.to_string())?;
    Ok(WindowBounds {
        x: next_position.x,
        y: next_position.y,
        width: next_size.width,
        height: next_size.height,
        hit_edge: String::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loose_limits_allow_dragging_to_edges_with_visible_strip() {
        let limits = loose_position_limits(
            WindowSize {
                width: 320,
                height: 340,
            },
            WorkArea {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
        );

        assert_eq!(
            limits,
            PositionLimits {
                min_x: -272,
                max_x: 1872,
                min_y: -292,
                max_y: 1032
            }
        );
    }

    #[test]
    fn clamp_position_keeps_at_least_edge_visibility() {
        let size = WindowSize {
            width: 320,
            height: 340,
        };
        let work_area = WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };

        assert_eq!(
            clamp_position(size, work_area, -500, -500),
            PhysicalPosition::new(-272, -292)
        );
        assert_eq!(
            clamp_position(size, work_area, 2200, 1400),
            PhysicalPosition::new(1872, 1032)
        );
    }

    #[test]
    fn center_position_uses_current_work_area_center() {
        assert_eq!(
            center_position(
                WindowSize {
                    width: 320,
                    height: 340,
                },
                WorkArea {
                    x: 100,
                    y: 50,
                    width: 1920,
                    height: 1080,
                },
            ),
            PhysicalPosition::new(900, 420)
        );
    }

    #[test]
    fn resize_anchor_position_preserves_bottom_center() {
        assert_eq!(
            resize_anchor_position(
                PhysicalPosition::new(100, 200),
                WindowSize {
                    width: 320,
                    height: 340,
                },
                WindowSize {
                    width: 200,
                    height: 220,
                },
                WorkArea {
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080,
                },
            ),
            PhysicalPosition::new(160, 320)
        );
    }

    #[test]
    fn resize_anchor_position_can_preserve_pet_anchor() {
        let work_area = WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };
        let current_position = PhysicalPosition::new(100, 200);
        let current_size = WindowSize {
            width: 188,
            height: 201,
        };
        let next_size = WindowSize {
            width: 520,
            height: 440,
        };
        let current_anchor = AnchorOffset { x: 94.0, y: 204.0 };
        let next_anchor = AnchorOffset { x: 420.0, y: 324.0 };

        let opened = resize_anchor_position_with_offsets(
            current_position,
            current_size,
            next_size,
            work_area,
            ResizeAnchor {
                current: current_anchor,
                next: next_anchor,
            },
        );
        assert_eq!(
            PhysicalPosition::new(
                current_position.x + current_anchor.x as i32,
                current_position.y + current_anchor.y as i32
            ),
            PhysicalPosition::new(
                opened.x + next_anchor.x as i32,
                opened.y + next_anchor.y as i32
            )
        );

        let closed = resize_anchor_position_with_offsets(
            opened,
            next_size,
            current_size,
            work_area,
            ResizeAnchor {
                current: next_anchor,
                next: current_anchor,
            },
        );
        assert_eq!(closed, current_position);
    }

    #[test]
    fn resize_anchor_position_preserves_logical_pet_anchor_on_scaled_display() {
        let work_area = WorkArea {
            x: 0,
            y: 0,
            width: 3840,
            height: 2160,
        };
        let current_position = PhysicalPosition::new(100, 200);
        let current_size = WindowSize {
            width: 376,
            height: 402,
        };
        let next_size = WindowSize {
            width: 1040,
            height: 880,
        };
        let current_anchor = AnchorOffset { x: 94.0, y: 204.0 };
        let next_anchor = AnchorOffset { x: 420.0, y: 324.0 };
        let scale_factor = 2.0;

        let opened = resize_anchor_position_with_offsets(
            current_position,
            current_size,
            next_size,
            work_area,
            scale_resize_anchor(
                ResizeAnchor {
                    current: current_anchor,
                    next: next_anchor,
                },
                scale_factor,
            ),
        );

        assert_eq!(
            PhysicalPosition::new(
                current_position.x + (current_anchor.x * scale_factor).round() as i32,
                current_position.y + (current_anchor.y * scale_factor).round() as i32
            ),
            PhysicalPosition::new(
                opened.x + (next_anchor.x * scale_factor).round() as i32,
                opened.y + (next_anchor.y * scale_factor).round() as i32
            )
        );

        let closed = resize_anchor_position_with_offsets(
            opened,
            next_size,
            current_size,
            work_area,
            scale_resize_anchor(
                ResizeAnchor {
                    current: next_anchor,
                    next: current_anchor,
                },
                scale_factor,
            ),
        );
        assert_eq!(closed, current_position);
    }

    #[test]
    fn resize_anchor_position_keeps_loose_edge_visibility() {
        assert_eq!(
            resize_anchor_position(
                PhysicalPosition::new(1860, 980),
                WindowSize {
                    width: 200,
                    height: 220,
                },
                WindowSize {
                    width: 460,
                    height: 520,
                },
                WorkArea {
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080,
                },
            ),
            PhysicalPosition::new(1730, 680)
        );
    }

    #[test]
    fn normalize_window_size_clamps_extreme_requests() {
        assert_eq!(
            normalize_window_size(80, 90),
            WindowSize {
                width: 160,
                height: 180,
            }
        );
        assert_eq!(
            normalize_window_size(900, 1200),
            WindowSize {
                width: 760,
                height: 720,
            }
        );
    }
}
