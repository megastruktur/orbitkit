use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::plugin::{PluginApi, PluginHandle};
use tauri::{AppHandle, Runtime};
use crate::error::Result;
use crate::RecorderStateResponse;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "dev.orbitkit.recorder";

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<OrbitkitRecorder<R>> {
    #[cfg(target_os = "android")]
    {
        let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "OrbitkitRecorderPlugin")?;
        Ok(OrbitkitRecorder { handle })
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = api;
        Err(Error::unsupported("mobile is only supported on android"))
    }
}

pub struct OrbitkitRecorder<R: Runtime> {
    #[cfg(target_os = "android")]
    handle: PluginHandle<R>,
    #[cfg(not(target_os = "android"))]
    _marker: std::marker::PhantomData<R>,
}

impl<R: Runtime> OrbitkitRecorder<R> {
    pub fn run_mobile_plugin<T: DeserializeOwned>(
        &self,
        method: &str,
        payload: impl Serialize,
    ) -> Result<T> {
        #[cfg(target_os = "android")]
        {
            self.handle
                .run_mobile_plugin(method, payload)
                .map_err(Into::into)
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = (method, payload);
            Err(Error::unsupported("mobile is only supported on android"))
        }
    }

    pub fn start_foreground(&self) -> Result<()> {
        self.run_mobile_plugin("startForeground", ())
    }

    pub fn pause(&self) -> Result<()> {
        self.run_mobile_plugin("pause", ())
    }

    pub fn resume(&self) -> Result<()> {
        self.run_mobile_plugin("resume", ())
    }

    pub fn stop(&self) -> Result<()> {
        self.run_mobile_plugin("stop", ())
    }

    pub fn state(&self) -> Result<RecorderStateResponse> {
        self.run_mobile_plugin("state", ())
    }

    pub fn post_standby_notification(&self) -> Result<()> {
        self.run_mobile_plugin("postStandbyNotification", ())
    }

    pub fn get_persisted_state(&self) -> Result<serde_json::Value> {
        self.run_mobile_plugin("getPersistedState", ())
    }

    pub fn recover_state(&self) -> Result<serde_json::Value> {
        self.run_mobile_plugin("recoverState", ())
    }
}
