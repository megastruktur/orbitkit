use std::ffi::{CStr, CString};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

#[cfg(target_os = "android")]
extern "C" {
    fn __android_log_print(
        prio: std::os::raw::c_int,
        tag: *const std::os::raw::c_char,
        fmt: *const std::os::raw::c_char,
        ...
    ) -> std::os::raw::c_int;
}

pub fn log_fmt() -> &'static CStr {
    c"%s"
}

pub fn to_safe_cstring(s: &str) -> CString {
    let sanitized: Vec<u8> = s.bytes().filter(|&b| b != 0).collect();
    CString::new(sanitized).expect("sanitized bytes contain no null bytes")
}

pub fn log_android_info(tag: &str, message: &str) {
    #[cfg(target_os = "android")]
    {
        let c_tag = to_safe_cstring(tag);
        let c_msg = to_safe_cstring(message);
        let c_fmt = log_fmt();
        unsafe {
            __android_log_print(4 /* ANDROID_LOG_INFO */, c_tag.as_ptr(), c_fmt.as_ptr(), c_msg.as_ptr());
        }
    }
    eprintln!("[{}] {}", tag, message);
    log::info!("[{}] {}", tag, message);
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JniActionRecord {
    pub receipt_id: u64,
    pub action: String,
    pub timestamp_millis: u64,
    pub rust_tag: String,
    pub webview_suspended: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MenuAction {
    pub id: String,
    pub source: String,
}

type MenuActionCallback = Box<dyn Fn(&MenuAction) + Send + Sync + 'static>;
type EventEmitterCallback = Arc<dyn Fn(&str, &serde_json::Value) + Send + Sync + 'static>;

pub const MENU_ACTION_EVENT: &str = "orbitkit://menu-action";

static RECEIPT_COUNTER: AtomicU64 = AtomicU64::new(1);
static ACTION_LOG: Mutex<Vec<JniActionRecord>> = Mutex::new(Vec::new());
static MENU_ACTION_HANDLERS: Mutex<Vec<Arc<MenuActionCallback>>> = Mutex::new(Vec::new());
static EVENT_EMITTER: Mutex<Option<EventEmitterCallback>> = Mutex::new(None);

pub fn register_event_emitter<F: Fn(&str, &serde_json::Value) + Send + Sync + 'static>(emitter: F) {
    if let Ok(mut guard) = EVENT_EMITTER.lock() {
        *guard = Some(Arc::new(emitter));
    }
}

pub fn clear_event_emitter() {
    if let Ok(mut guard) = EVENT_EMITTER.lock() {
        *guard = None;
    }
}

/// Pure function building the menu action event payload.
pub fn build_menu_action_payload(id: &str, source: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "source": source,
    })
}

/// Pure / extracted dispatch function emitting overlay action event to registered emitter.
pub fn emit_overlay_menu_action(id: &str) -> serde_json::Value {
    let payload = build_menu_action_payload(id, "overlay");
    let emitter = {
        if let Ok(guard) = EVENT_EMITTER.lock() {
            guard.clone()
        } else {
            None
        }
    };
    if let Some(emitter) = emitter {
        emitter(MENU_ACTION_EVENT, &payload);
    }
    payload
}
fn current_timestamp_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn register_menu_action_handler<F: Fn(&MenuAction) + Send + Sync + 'static>(handler: F) {
    if let Ok(mut handlers) = MENU_ACTION_HANDLERS.lock() {
        handlers.push(Arc::new(Box::new(handler)));
    }
}
pub fn clear_menu_action_handlers() {
    if let Ok(mut handlers) = MENU_ACTION_HANDLERS.lock() {
        handlers.clear();
    }
}

pub fn notify_menu_action(action: &MenuAction) {
    let handlers = {
        if let Ok(guard) = MENU_ACTION_HANDLERS.lock() {
            guard.clone()
        } else {
            Vec::new()
        }
    };
    for handler in handlers {
        handler(action);
    }
}

pub fn process_native_action(action: &str) -> String {
    let receipt_id = RECEIPT_COUNTER.fetch_add(1, Ordering::SeqCst);
    let now = current_timestamp_millis();

    let record = JniActionRecord {
        receipt_id,
        action: action.to_string(),
        timestamp_millis: now,
        rust_tag: "Rust_JNI_Bridge".to_string(),
        webview_suspended: true,
    };

    let log_msg = format!(
        "[RUST-JNI-RECEIPT] receiptId={} action=\"{}\" timestamp={} webviewSuspended=true (Direct native dispatch, no WebView JS)",
        receipt_id, action, now
    );
    log_android_info("OrbitkitJni", &log_msg);

    if let Ok(mut log) = ACTION_LOG.lock() {
        log.push(record.clone());
    }

    let menu_action = MenuAction {
        id: action.to_string(),
        source: "overlay".to_string(),
    };
    notify_menu_action(&menu_action);

    // Emit global event for webview listeners (@tauri-apps/api/event listen("orbitkit://menu-action"))
    emit_overlay_menu_action(action);

    serde_json::to_string(&record).unwrap_or_else(|_| "{\"status\":\"OK\"}".to_string())
}

pub fn get_jni_action_log() -> Vec<JniActionRecord> {
    ACTION_LOG.lock().map(|l| l.clone()).unwrap_or_default()
}

pub fn clear_jni_action_log() {
    if let Ok(mut log) = ACTION_LOG.lock() {
        log.clear();
    }
}

/// Wraps an action execution in `catch_unwind`, logging and returning a standardized
/// JSON error payload if a panic occurs in user callbacks or emitters.
pub fn guarded<F: FnOnce() -> String>(f: F) -> String {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)) {
        Ok(res) => res,
        Err(err) => {
            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                (*s).to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "panic in native action handler".to_string()
            };
            log_android_info(
                "OrbitkitJni",
                &format!("[RUST-JNI-ERROR] Panic in native action: {}", msg),
            );
            serde_json::json!({
                "status": "ERROR",
                "error": msg,
            })
            .to_string()
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction(
    mut env: jni::JNIEnv,
    _class: jni::objects::JClass,
    action: jni::objects::JString,
) -> jni::sys::jstring {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let action_str: String = match env.get_string(&action) {
            Ok(s) => s.into(),
            Err(e) => {
                log_android_info(
                    "OrbitkitJni",
                    &format!("[RUST-JNI-ERROR] Failed to read action JString: {:?}", e),
                );
                "UNKNOWN".to_string()
            }
        };

        let response_json = guarded(|| process_native_action(&action_str));

        match env.new_string(&response_json) {
            Ok(js) => js.into_raw(),
            Err(e) => {
                log_android_info(
                    "OrbitkitJni",
                    &format!("[RUST-JNI-ERROR] Failed to allocate return JString: {:?}", e),
                );
                std::ptr::null_mut()
            }
        }
    }));

    match result {
        Ok(ptr) => ptr,
        Err(err) => {
            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                (*s).to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "panic in JNI export onNativeAction".to_string()
            };
            log_android_info(
                "OrbitkitJni",
                &format!("[RUST-JNI-ERROR] Fatal panic in JNI export: {}", msg),
            );
            std::ptr::null_mut()
        }
    }
}

#[no_mangle]
pub extern "system" fn Java_dev_orbitkit_native_OrbitkitJniBridge_00024Companion_onNativeAction(
    env: jni::JNIEnv,
    class: jni::objects::JClass,
    action: jni::objects::JString,
) -> jni::sys::jstring {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction(env, class, action)
    }));
    match result {
        Ok(ptr) => ptr,
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "system" fn Java_dev_orbitkit_native_OrbitkitJniBridge_getActionCount(
    _env: jni::JNIEnv,
    _class: jni::objects::JClass,
) -> jni::sys::jlong {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        ACTION_LOG.lock().map(|l| l.len() as i64).unwrap_or(0)
    }))
    .unwrap_or(0)
}

#[no_mangle]
pub extern "system" fn Java_dev_orbitkit_native_OrbitkitJniBridge_getActionLogJson(
    env: jni::JNIEnv,
    _class: jni::objects::JClass,
) -> jni::sys::jstring {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let actions = get_jni_action_log();
        let json = serde_json::to_string(&actions).unwrap_or_else(|_| "[]".to_string());
        match env.new_string(&json) {
            Ok(js) => js.into_raw(),
            Err(_) => std::ptr::null_mut(),
        }
    }));
    match result {
        Ok(ptr) => ptr,
        Err(_) => std::ptr::null_mut(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn test_process_native_action_records_and_returns_json() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        clear_jni_action_log();
        let res1 = process_native_action("ACT_A");
        let parsed: JniActionRecord = serde_json::from_str(&res1).expect("valid json record");
        assert_eq!(parsed.action, "ACT_A");
        assert!(parsed.receipt_id >= 1);
        assert!(parsed.webview_suspended);
        assert_eq!(parsed.rust_tag, "Rust_JNI_Bridge");
        assert!(parsed.timestamp_millis > 0);

        let res2 = process_native_action("ACT_B");
        let parsed2: JniActionRecord = serde_json::from_str(&res2).expect("valid json record");
        assert_eq!(parsed2.action, "ACT_B");
        assert_eq!(parsed2.receipt_id, parsed.receipt_id + 1);
        assert!(parsed2.webview_suspended);
        assert_eq!(parsed2.rust_tag, "Rust_JNI_Bridge");

        let history = get_jni_action_log();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].action, "ACT_A");
        assert_eq!(history[1].action, "ACT_B");
        clear_jni_action_log();
    }

    #[test]
    fn test_recorder_actions_through_jni() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        clear_jni_action_log();
        for act in ["REC_START", "REC_PAUSE", "REC_RESUME", "REC_STOP"] {
            let res = process_native_action(act);
            let parsed: JniActionRecord = serde_json::from_str(&res).expect("valid json");
            assert_eq!(parsed.action, act);
            assert!(parsed.webview_suspended);
            assert_eq!(parsed.rust_tag, "Rust_JNI_Bridge");
        }
        let history = get_jni_action_log();
        assert_eq!(history.len(), 4);
        clear_jni_action_log();
    }

    #[test]
    fn test_log_fmt_and_safe_cstring() {
        assert_eq!(log_fmt().to_bytes(), b"%s");
        assert_eq!(log_fmt().to_bytes_with_nul(), b"%s\0");

        let normal_tag = to_safe_cstring("OrbitkitJni");
        assert_eq!(normal_tag.as_bytes(), b"OrbitkitJni");

        let with_null = to_safe_cstring("tag\0with\0null");
        assert_eq!(with_null.as_bytes(), b"tagwithnull");
    }

    #[test]
    fn test_build_menu_action_payload() {
        let payload = build_menu_action_payload("action_test_1", "overlay");
        assert_eq!(payload["id"], "action_test_1");
        assert_eq!(payload["source"], "overlay");
    }

    #[test]
    fn test_emit_overlay_menu_action_calls_registered_emitter() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        clear_event_emitter();

        let call_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let captured_event = Arc::new(Mutex::new(String::new()));
        let captured_payload = Arc::new(Mutex::new(serde_json::Value::Null));

        let c_count = call_count.clone();
        let c_event = captured_event.clone();
        let c_payload = captured_payload.clone();

        register_event_emitter(move |event, payload| {
            c_count.fetch_add(1, Ordering::SeqCst);
            *c_event.lock().unwrap() = event.to_string();
            *c_payload.lock().unwrap() = payload.clone();
        });

        let payload = emit_overlay_menu_action("my_action");
        assert_eq!(call_count.load(Ordering::SeqCst), 1);
        assert_eq!(*captured_event.lock().unwrap(), "orbitkit://menu-action");
        assert_eq!(captured_payload.lock().unwrap()["id"], "my_action");
        assert_eq!(captured_payload.lock().unwrap()["source"], "overlay");
        assert_eq!(payload["id"], "my_action");
        assert_eq!(payload["source"], "overlay");

        clear_event_emitter();
    }

    #[test]
    fn test_process_native_action_emits_overlay_event_and_notifies_handler() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        clear_jni_action_log();
        clear_event_emitter();
        clear_menu_action_handlers();

        let jni_called = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let jni_captured_id = Arc::new(Mutex::new(String::new()));
        let j_called = jni_called.clone();
        let j_id = jni_captured_id.clone();

        register_menu_action_handler(move |action| {
            j_called.fetch_add(1, Ordering::SeqCst);
            *j_id.lock().unwrap() = action.id.clone();
        });

        let emitter_called = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let emitter_payload = Arc::new(Mutex::new(serde_json::Value::Null));
        let e_called = emitter_called.clone();
        let e_payload = emitter_payload.clone();

        register_event_emitter(move |_event, payload| {
            e_called.fetch_add(1, Ordering::SeqCst);
            *e_payload.lock().unwrap() = payload.clone();
        });

        let json = process_native_action("overlay_btn_clicked");
        assert!(json.contains("\"action\":\"overlay_btn_clicked\""));

        assert_eq!(jni_called.load(Ordering::SeqCst), 1);
        assert_eq!(*jni_captured_id.lock().unwrap(), "overlay_btn_clicked");

        assert_eq!(emitter_called.load(Ordering::SeqCst), 1);
        assert_eq!(emitter_payload.lock().unwrap()["id"], "overlay_btn_clicked");
        assert_eq!(emitter_payload.lock().unwrap()["source"], "overlay");

        clear_jni_action_log();
        clear_event_emitter();
        clear_menu_action_handlers();
    }

    #[test]
    fn test_guarded_handles_handler_panic_without_abort() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        clear_jni_action_log();
        clear_event_emitter();
        clear_menu_action_handlers();

        register_menu_action_handler(|_action| {
            panic!("simulated user callback panic");
        });

        let res = guarded(|| process_native_action("test_panic_action"));
        let parsed: serde_json::Value =
            serde_json::from_str(&res).expect("valid json error response");
        assert_eq!(parsed["status"], "ERROR");
        assert!(parsed["error"]
            .as_str()
            .unwrap()
            .contains("simulated user callback panic"));

        clear_menu_action_handlers();
        clear_jni_action_log();
    }

    #[test]
    fn test_guarded_handles_emitter_panic_without_abort() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        clear_jni_action_log();
        clear_event_emitter();
        clear_menu_action_handlers();

        register_event_emitter(|_event, _payload| {
            panic!("simulated emitter panic");
        });

        let res = guarded(|| process_native_action("test_emitter_panic"));
        let parsed: serde_json::Value =
            serde_json::from_str(&res).expect("valid json error response");
        assert_eq!(parsed["status"], "ERROR");
        assert!(parsed["error"]
            .as_str()
            .unwrap()
            .contains("simulated emitter panic"));

        clear_event_emitter();
        clear_jni_action_log();
    }

    #[test]
    fn test_event_emitter_reentrancy_no_deadlock() {
        let _guard = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        clear_event_emitter();

        let called = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let c = called.clone();

        register_event_emitter(move |_event, _payload| {
            c.store(true, Ordering::SeqCst);
            clear_event_emitter();
        });

        emit_overlay_menu_action("test_reentrancy");
        assert!(called.load(Ordering::SeqCst));
        clear_event_emitter();
    }
}
