use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_notification::NotificationExt;

// ------------------------------------------------------------------
// Desktop automation commands
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Voice pipeline integration
// ------------------------------------------------------------------

/// Shared application state for the voice runtime.
struct VoiceState {
    /// Reference to the running pipeline (used for shutdown).
    pipeline: Option<Arc<volle_voice_runtime::VoicePipeline>>,
    /// Join handle for the pipeline thread.
    handle: Option<std::thread::JoinHandle<()>>,
}

impl VoiceState {
    fn new() -> Self {
        Self {
            pipeline: None,
            handle: None,
        }
    }

    fn is_running(&self) -> bool {
        self.pipeline.is_some()
    }
}

/// Start the voice pipeline in a background thread.
///
/// The pipeline listens for the wake phrase ("Hej Volle"), then streams
/// audio to the backend WebSocket.  Events are forwarded to the frontend
/// via Tauri events and system notifications.
#[tauri::command]
fn start_voice_pipeline(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Mutex<VoiceState>>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;

    if guard.is_running() {
        return Ok(());
    }

    // Channel for pipeline -> Tauri events.
    let (tx, rx) = crossbeam_channel::unbounded::<volle_voice_runtime::VoiceEvent>();

    let config = volle_voice_runtime::VoicePipelineConfig {
        event_sender: Some(tx),
        ..Default::default()
    };

    let pipeline = Arc::new(
        volle_voice_runtime::VoicePipeline::new(config).map_err(|e| e.to_string())?
    );

    // --- Event forwarding thread ------------------------------------
    let app_handle_events = app_handle.clone();
    std::thread::spawn(move || {
        while let Ok(event) = rx.recv() {
            match event {
                volle_voice_runtime::VoiceEvent::WakeWord => {
                    let _ = app_handle_events.emit("wake-word-detected", ());
                    let _ = app_handle_events
                        .notification()
                        .builder()
                        .title("Volle")
                        .body("Wake word detected — listening")
                        .show();

                    // Show + focus main window.
                    if let Some(w) = app_handle_events.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                volle_voice_runtime::VoiceEvent::SpeechStarted => {
                    let _ = app_handle_events.emit("speech-started", ());
                }
                volle_voice_runtime::VoiceEvent::SpeechEnded => {
                    let _ = app_handle_events.emit("speech-ended", ());
                }
                volle_voice_runtime::VoiceEvent::Error(err) => {
                    let _ = app_handle_events.emit("voice-error", err);
                }
            }
        }
    });

    // --- Pipeline thread --------------------------------------------
    let pipeline_thread = Arc::clone(&pipeline);
    let handle = std::thread::spawn(move || {
        if let Err(e) = pipeline_thread.run_blocking() {
            eprintln!("[voice-runtime] pipeline error: {}", e);
        }
    });

    guard.pipeline = Some(pipeline);
    guard.handle = Some(handle);

    Ok(())
}

/// Gracefully stop the voice pipeline.
#[tauri::command]
fn stop_voice_pipeline(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Mutex<VoiceState>>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;

    if let Some(pipeline) = guard.pipeline.take() {
        pipeline.shutdown();
    }
    if let Some(handle) = guard.handle.take() {
        // Don't block the UI thread waiting for the pipeline to finish.
        std::thread::spawn(move || {
            let _ = handle.join();
        });
    }

    Ok(())
}

// ------------------------------------------------------------------
// Main entry
// ------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .manage(Mutex::new(VoiceState::new()))
        .invoke_handler(tauri::generate_handler![
            open_folder,
            open_app,
            clipboard_write,
            clipboard_read,
            start_voice_pipeline,
            stop_voice_pipeline
        ])
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
            let start_i = tauri::menu::MenuItem::with_id(
                app,
                "start-listening",
                "Start Listening",
                true,
                None::<&str>,
            )?;
            let stop_i = tauri::menu::MenuItem::with_id(
                app,
                "stop-listening",
                "Stop Listening",
                true,
                None::<&str>,
            )?;

            let menu = tauri::menu::Menu::with_items(
                app,
                &[&show_i, &hide_i, &start_i, &stop_i, &quit_i],
            )?;

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
                    "start-listening" => {
                        let handle = app.clone();
                        std::thread::spawn(move || {
                            let _ = start_voice_pipeline(handle);
                        });
                    }
                    "stop-listening" => {
                        let handle = app.clone();
                        std::thread::spawn(move || {
                            let _ = stop_voice_pipeline(handle);
                        });
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

            // Optionally auto-start voice pipeline on boot
            // let handle = app.handle().clone();
            // std::thread::spawn(move || {
            //     let _ = start_voice_pipeline(handle);
            // });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
