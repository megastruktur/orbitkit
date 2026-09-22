use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
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

/// Log directly to Android logcat from Rust native code.
/// This guarantees log entries appear in `adb logcat` even when the WebView is suspended.
pub fn log_android_info(tag: &str, message: &str) {
    #[cfg(target_os = "android")]
    {
        use std::ffi::CString;
        if let (Ok(c_tag), Ok(c_fmt)) = (CString::new(tag), CString::new("%s\0")) {
            if let Ok(c_msg) = CString::new(message) {
                unsafe {
                    __android_log_print(4 /* ANDROID_LOG_INFO */, c_tag.as_ptr(), c_fmt.as_ptr(), c_msg.as_ptr());
                }
            }
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

static RECEIPT_COUNTER: AtomicU64 = AtomicU64::new(1);
static ACTION_LOG: Mutex<Vec<JniActionRecord>> = Mutex::new(Vec::new());

fn current_timestamp_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Core logic processing native action from Kotlin JNI bridge.
/// Receives action string, records it, logs to logcat and Rust log,
/// and returns JSON string acknowledgment.
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

    serde_json::to_string(&record).unwrap_or_else(|_| "{\"status\":\"OK\"}".to_string())
}

/// Retrieve all recorded JNI actions (used for verification & test inspection).
pub fn get_jni_action_log() -> Vec<JniActionRecord> {
    ACTION_LOG.lock().map(|l| l.clone()).unwrap_or_default()
}

/// Clear recorded JNI actions.
pub fn clear_jni_action_log() {
    if let Ok(mut log) = ACTION_LOG.lock() {
        log.clear();
    }
}

// ---------------------------------------------------------------------------
// JNI Export Functions (called from dev.orbitkit.native.OrbitkitJniBridge)
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "system" fn Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction(
    mut env: jni::JNIEnv,
    _class: jni::objects::JClass,
    action: jni::objects::JString,
) -> jni::sys::jstring {
    let action_str: String = match env.get_string(&action) {
        Ok(s) => s.into(),
        Err(e) => {
            log_android_info("OrbitkitJni", &format!("[RUST-JNI-ERROR] Failed to read action JString: {:?}", e));
            "UNKNOWN".to_string()
        }
    };

    let response_json = process_native_action(&action_str);

    match env.new_string(&response_json) {
        Ok(js) => js.into_raw(),
        Err(e) => {
            log_android_info("OrbitkitJni", &format!("[RUST-JNI-ERROR] Failed to allocate return JString: {:?}", e));
            std::ptr::null_mut()
        }
    }
}

/// Fallback export if Kotlin companion object dispatch is invoked.
#[no_mangle]
pub extern "system" fn Java_dev_orbitkit_native_OrbitkitJniBridge_00024Companion_onNativeAction(
    env: jni::JNIEnv,
    class: jni::objects::JClass,
    action: jni::objects::JString,
) -> jni::sys::jstring {
    Java_dev_orbitkit_native_OrbitkitJniBridge_onNativeAction(env, class, action)
}

/// JNI helper to query Rust-side action count.
#[no_mangle]
pub extern "system" fn Java_dev_orbitkit_native_OrbitkitJniBridge_getActionCount(
    _env: jni::JNIEnv,
    _class: jni::objects::JClass,
) -> jni::sys::jlong {
    let count = ACTION_LOG.lock().map(|l| l.len() as i64).unwrap_or(0);
    count
}

/// JNI helper to retrieve entire action log as JSON.
#[no_mangle]
pub extern "system" fn Java_dev_orbitkit_native_OrbitkitJniBridge_getActionLogJson(
    env: jni::JNIEnv,
    _class: jni::objects::JClass,
) -> jni::sys::jstring {
    let actions = get_jni_action_log();
    let json = serde_json::to_string(&actions).unwrap_or_else(|_| "[]".to_string());
    match env.new_string(&json) {
        Ok(js) => js.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

// ---------------------------------------------------------------------------
// Tauri Commands (for IPC frontend inspection and debug affordances)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn jni_get_action_log() -> Vec<JniActionRecord> {
    get_jni_action_log()
}

#[tauri::command]
pub fn jni_clear_action_log() {
    clear_jni_action_log();
}

#[tauri::command]
pub fn jni_trigger_native_action(action: String) -> String {
    process_native_action(&action)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_native_action_records_and_returns_json() {
        clear_jni_action_log();
        let res1 = process_native_action("ACT_A");
        let parsed: JniActionRecord = serde_json::from_str(&res1).expect("valid json record");
        assert_eq!(parsed.action, "ACT_A");
        assert!(parsed.receipt_id >= 1);
        assert!(parsed.webview_suspended);

        let res2 = process_native_action("ACT_B");
        let parsed2: JniActionRecord = serde_json::from_str(&res2).expect("valid json record");
        assert_eq!(parsed2.action, "ACT_B");
        assert_eq!(parsed2.receipt_id, parsed.receipt_id + 1);

        let history = get_jni_action_log();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].action, "ACT_A");
        assert_eq!(history[1].action, "ACT_B");
    }

    #[test]
    fn test_recorder_actions_through_jni() {
        clear_jni_action_log();
        for act in ["REC_START", "REC_PAUSE", "REC_RESUME", "REC_STOP"] {
            let res = process_native_action(act);
            let parsed: JniActionRecord = serde_json::from_str(&res).expect("valid json");
            assert_eq!(parsed.action, act);
        }
        let history = get_jni_action_log();
        assert_eq!(history.len(), 4);
    }
}
