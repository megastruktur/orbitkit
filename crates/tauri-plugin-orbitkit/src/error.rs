use serde::{Deserialize, Serialize};

pub type Result<T, E = Error> = std::result::Result<T, E>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    PermissionDenied,
    Unsupported,
    NotFound,
    InvalidConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, thiserror::Error)]
#[error("{code:?}: {message}")]
pub struct Error {
    pub code: ErrorCode,
    pub message: String,
}

impl Error {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn permission_denied(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::PermissionDenied, message)
    }

    pub fn unsupported(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Unsupported, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotFound, message)
    }

    pub fn invalid_config(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidConfig, message)
    }

    pub fn from_reject_code(
        code: Option<&str>,
        message: Option<String>,
        fallback: impl Into<String>,
    ) -> Self {
        let msg = message.unwrap_or_else(|| fallback.into());
        match code.map(|c| c.to_ascii_lowercase()).as_deref() {
            Some("permission_denied") => Self::permission_denied(msg),
            Some("not_found") => Self::not_found(msg),
            Some("invalid_config") | Some("invalid_argument") => Self::invalid_config(msg),
            Some("unsupported") => Self::unsupported(msg),
            _ => Self::unsupported(msg),
        }
    }
}

#[cfg(mobile)]
impl From<tauri::plugin::mobile::PluginInvokeError> for Error {
    fn from(err: tauri::plugin::mobile::PluginInvokeError) -> Self {
        match err {
            tauri::plugin::mobile::PluginInvokeError::InvokeRejected(resp) => {
                let fallback = resp.to_string();
                Self::from_reject_code(resp.code.as_deref(), resp.message, fallback)
            }
            tauri::plugin::mobile::PluginInvokeError::UnreachableWebview => {
                Self::unsupported("the webview is unreachable")
            }
            tauri::plugin::mobile::PluginInvokeError::Jni(e) => {
                Self::unsupported(format!("jni error: {e}"))
            }
            tauri::plugin::mobile::PluginInvokeError::CannotDeserializeResponse(e) => {
                Self::unsupported(format!("failed to deserialize response: {e}"))
            }
            tauri::plugin::mobile::PluginInvokeError::CannotSerializePayload(e) => {
                Self::unsupported(format!("failed to serialize payload: {e}"))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_serialization() {
        let err = Error::unsupported("popups not supported");
        let json = serde_json::to_string(&err).expect("serialize error");
        assert_eq!(
            json,
            r#"{"code":"unsupported","message":"popups not supported"}"#
        );

        let err_perm = Error::permission_denied("SAW denied");
        let json_perm = serde_json::to_string(&err_perm).expect("serialize error");
        assert_eq!(
            json_perm,
            r#"{"code":"permission_denied","message":"SAW denied"}"#
        );

        let err_not_found = Error::not_found("popup foo not found");
        let json_not_found = serde_json::to_string(&err_not_found).expect("serialize error");
        assert_eq!(
            json_not_found,
            r#"{"code":"not_found","message":"popup foo not found"}"#
        );

        let err_config = Error::invalid_config("bad id");
        let json_config = serde_json::to_string(&err_config).expect("serialize error");
        assert_eq!(
            json_config,
            r#"{"code":"invalid_config","message":"bad id"}"#
        );

        // Exhaustive match over ErrorCode with NO wildcard arm (so a 5th variant is a compile error)
        for code in [
            ErrorCode::PermissionDenied,
            ErrorCode::Unsupported,
            ErrorCode::NotFound,
            ErrorCode::InvalidConfig,
        ] {
            match code {
                ErrorCode::PermissionDenied => {}
                ErrorCode::Unsupported => {}
                ErrorCode::NotFound => {}
                ErrorCode::InvalidConfig => {}
            }
        }
    }
    #[test]
    fn test_reject_code_mapping() {
        let err1 = Error::from_reject_code(
            Some("PERMISSION_DENIED"),
            Some("SAW required".into()),
            "fallback",
        );
        assert_eq!(err1.code, ErrorCode::PermissionDenied);
        assert_eq!(err1.message, "SAW required");

        let err2 = Error::from_reject_code(
            Some("permission_denied"),
            None,
            "fallback permission error",
        );
        assert_eq!(err2.code, ErrorCode::PermissionDenied);
        assert_eq!(err2.message, "fallback permission error");

        let err3 = Error::from_reject_code(
            Some("UNSUPPORTED"),
            Some("Not supported on Android".into()),
            "fallback",
        );
        assert_eq!(err3.code, ErrorCode::Unsupported);
        assert_eq!(err3.message, "Not supported on Android");

        let err4 = Error::from_reject_code(
            Some("NOT_FOUND"),
            Some("Target window missing".into()),
            "fallback",
        );
        assert_eq!(err4.code, ErrorCode::NotFound);
        assert_eq!(err4.message, "Target window missing");

        let err5 = Error::from_reject_code(
            Some("INVALID_CONFIG"),
            Some("Malformed options".into()),
            "fallback",
        );
        assert_eq!(err5.code, ErrorCode::InvalidConfig);
        assert_eq!(err5.message, "Malformed options");

        let err5_arg = Error::from_reject_code(
            Some("INVALID_ARGUMENT"),
            Some("Bad argument".into()),
            "fallback",
        );
        assert_eq!(err5_arg.code, ErrorCode::InvalidConfig);
        assert_eq!(err5_arg.message, "Bad argument");

        // Unrecognized Kotlin reject codes map to ErrorCode::Unsupported per F6
        let err6 = Error::from_reject_code(
            Some("OVERLAY_SHOW_FAILED"),
            Some("Failed to attach window".into()),
            "fallback",
        );
        assert_eq!(err6.code, ErrorCode::Unsupported);
        assert_eq!(err6.message, "Failed to attach window");

        let err7 = Error::from_reject_code(
            Some("SETTINGS_FAILED"),
            Some("Could not launch settings intent".into()),
            "fallback",
        );
        assert_eq!(err7.code, ErrorCode::Unsupported);
        assert_eq!(err7.message, "Could not launch settings intent");

        let err8 = Error::from_reject_code(
            None,
            None,
            "unspecified failure",
        );
        assert_eq!(err8.code, ErrorCode::Unsupported);
        assert_eq!(err8.message, "unspecified failure");
    }

    #[cfg(mobile)]
    #[test]
    fn test_plugin_invoke_error_mobile_conversion() {
        let resp = tauri::plugin::mobile::ErrorResponse {
            code: Some("PERMISSION_DENIED".to_string()),
            message: Some("Need overlay permission".to_string()),
            data: (),
        };
        let pie = tauri::plugin::mobile::PluginInvokeError::InvokeRejected(resp);
        let err: Error = pie.into();
        assert_eq!(err.code, ErrorCode::PermissionDenied);
        assert_eq!(err.message, "Need overlay permission");

        let unk_resp = tauri::plugin::mobile::ErrorResponse {
            code: Some("OVERLAY_SHOW_FAILED".to_string()),
            message: Some("Crash on show".to_string()),
            data: (),
        };
        let pie_unk = tauri::plugin::mobile::PluginInvokeError::InvokeRejected(unk_resp);
        let err_unk: Error = pie_unk.into();
        assert_eq!(err_unk.code, ErrorCode::Unsupported);
        assert_eq!(err_unk.message, "Crash on show");
    }
}
