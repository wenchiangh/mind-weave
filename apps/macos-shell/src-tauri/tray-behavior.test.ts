import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tauri tray behavior", () => {
  it("uses accessory activation and toggles the menu bar panel", async () => {
    const source = await readFile(
      join(process.cwd(), "apps", "macos-shell", "src-tauri", "src", "lib.rs"),
      "utf8"
    );

    expect(source).toContain("\"show-panel\"");
    expect(source).toContain("ActivationPolicy::Accessory");
    expect(source).toContain("toggle_panel_window");
    expect(source).toContain("position_panel_window");
    expect(source).toContain("hide_panel_window");
    expect(source).toContain("load_tray_icon()");
    expect(source).toContain("Image::new");
    expect(source).toContain("include_bytes!(\"../icons/tray-template.rgba\")");
    expect(source).not.toContain(".icon(app.default_window_icon().cloned().unwrap())");
    expect(source).toContain(".icon_as_template(true)");
    expect(source).not.toContain("show_panel_window(app.handle())");
    expect(source).toContain("window.is_visible().unwrap_or(false)");
    expect(source).toContain("rect,");
    expect(source).toContain("toggle_panel_window(tray.app_handle(), Some(rect))");
    expect(source).toContain("position_panel_window(&window, tray_rect)");
    expect(source).toContain("window.set_position");
    expect(source).toContain("let _ = window.hide()");
    expect(source).toContain("let _ = window.unminimize()");
    expect(source).toContain("on_tray_icon_event");
    expect(source).toContain("WindowEvent::Focused(false)");
    expect(source).toContain("show_menu_on_left_click(false)");
  });
});
