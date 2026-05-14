use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
