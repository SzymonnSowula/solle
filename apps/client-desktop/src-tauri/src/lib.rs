use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let status = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path])
            .status()
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(&path)
            .status()
    } else {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .status()
    };
    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(s) => Err(format!("Exit code: {}", s)),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn open_app(name: String) -> Result<(), String> {
    let status = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &name])
            .status()
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .args(["-a", &name])
            .status()
    } else {
        std::process::Command::new(&name)
            .status()
    };
    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(s) => Err(format!("Exit code: {}", s)),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn clipboard_write(text: String) -> Result<(), String> {
    use arboard::Clipboard;
    let mut clip = Clipboard::new().map_err(|e| e.to_string())?;
    clip.set_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
fn clipboard_read() -> Result<String, String> {
    use arboard::Clipboard;
    let mut clip = Clipboard::new().map_err(|e| e.to_string())?;
    clip.get_text().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![open_folder, open_app, clipboard_write, clipboard_read])
        .setup(|app| {
            // --------------------------------------------------
            // System tray menu
            // --------------------------------------------------
            let quit_i =
                tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i =
                tauri::menu::MenuItem::with_id(app, "show", "Show Volle", true, None::<&str>)?;
            let hide_i =
                tauri::menu::MenuItem::with_id(app, "hide", "Hide Volle", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Volle")
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => {
                        println!("[tray] Quit requested");
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // --------------------------------------------------
            // Global shortcut: Ctrl+Shift+Space
            // --------------------------------------------------
            let shortcut =
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, _shortcut, _event| {
                        if let Some(w) = app.get_webview_window("main") {
                            match w.is_visible() {
                                Ok(true) => {
                                    let _ = w.hide();
                                }
                                _ => {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                        }
                    })
                    .build(),
            )?;

            app.global_shortcut().register(shortcut)?;

            // Hide window on startup (tray only)
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }

            // Close-to-tray: prevent actual exit when user clicks X
            let app_handle = app.handle().clone();
            if let Some(w) = app.get_webview_window("main") {
                w.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
