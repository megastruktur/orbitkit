# env.sh — source this in later task briefs (T02/T03+).
# Paths only; contains NO secrets. Idempotent.
export JAVA_HOME="$HOME/Android/jdk-17.0.20.1+1"
export ANDROID_HOME="$HOME/Android/Sdk"
# NDK deliberately not installed (T03 decides version): when present, set:
# export NDK_HOME="$ANDROID_HOME/ndk/<version>"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
